/**
 * Memory Pipeline
 * 
 * Handles memory retrieval, scoring, and context-aware recall.
 * Extracted from the monolithic orchestrator for better separation of concerns.
 */

import { Socket } from 'socket.io';
import { db } from '../../db/client.js';
import { memoryEngine } from '../memory.js';
import { WS_EVENTS, ACTIVITY_TYPES, ACTIVITY_STATUS } from '../../constants/index.js';
import { 
  MemoryError, 
  withRetry, 
  generateCorrelationId,
  errorLogger 
} from '../errors/index.js';
// Note: Using 'any' for Memory type to match existing memoryEngine implementation
// The interfaces in ../interfaces are the target types for future migration
type Memory = any;
type PersonalitySnapshot = { mood: { stance: string; valence: number; arousal: number } };

// ========================================
// Types
// ========================================

export interface MemoryRetrievalOptions {
  topK?: number;
  includeRecentContext?: boolean;
  recentContextCount?: number;
  moodContext?: { valence: number; arousal: number } | string;
}

export interface MemoryPipelineResult {
  memories: Memory[];
  retrievalMethod: string;
  error?: string;
}

export interface MemoryPipelineOptions {
  socket: Socket;
  source: 'chat' | 'collaborate';
  documentId?: number;
  correlationId?: string;
}

// ========================================
// Memory Pipeline Class
// ========================================

export class MemoryPipeline {
  private correlationId: string;

  constructor(correlationId?: string) {
    this.correlationId = correlationId || generateCorrelationId();
  }

  /**
   * Execute full memory retrieval pipeline
   */
  async execute(
    query: string,
    personality: PersonalitySnapshot,
    options: MemoryPipelineOptions & MemoryRetrievalOptions
  ): Promise<MemoryPipelineResult> {
    const { 
      socket, 
      source, 
      documentId,
      topK = 50,
      includeRecentContext = true,
      recentContextCount = 5,
      moodContext
    } = options;

    // Log activity start
    const activityId = await this.logActivity(
      ACTIVITY_TYPES.RECALL,
      ACTIVITY_STATUS.RUNNING,
      'Retrieving relevant memories...'
    );

    socket.emit(WS_EVENTS.SUBROUTINE.STATUS, {
      id: activityId,
      tool: ACTIVITY_TYPES.RECALL,
      status: ACTIVITY_STATUS.RUNNING
    });

    try {
      let memories: Memory[] = [];
      let retrievalMethod = 'basic';

      if (includeRecentContext) {
        // Get recent conversation for context
        console.log('[MemoryPipeline] Fetching recent messages for context...');
        const recentMessages = await this.fetchRecentMessages(
          source, 
          documentId, 
          recentContextCount
        );
        const recentContext = recentMessages.map(m => m.content);
        console.log(`[MemoryPipeline] Fetched ${recentMessages.length} recent messages`);

        // Use context-aware retrieval
        // Pass mood as object { valence, arousal } or undefined
        const moodObj = typeof moodContext === 'object' && moodContext !== null
          ? { valence: moodContext.valence, arousal: moodContext.arousal }
          : undefined;
        memories = await this.retrieveWithContext(
          query,
          recentContext,
          topK,
          moodObj
        );
        retrievalMethod = 'context-aware';
      } else {
        // Basic retrieval
        memories = await this.retrieve(query, topK);
        retrievalMethod = 'basic';
      }

      console.log(`[MemoryPipeline] Retrieved ${memories.length} memories (${retrievalMethod})`);

      // Complete activity
      await this.completeActivity(activityId, `Retrieved ${memories.length} memories`, {
        memoryCount: memories.length,
        retrievalMethod
      });

      socket.emit(WS_EVENTS.SUBROUTINE.STATUS, {
        id: activityId,
        tool: ACTIVITY_TYPES.RECALL,
        status: ACTIVITY_STATUS.DONE,
        summary: `${memories.length} relevant memories`,
        metadata: {
          memoryCount: memories.length,
          retrievalMethod
        }
      });

      return {
        memories,
        retrievalMethod
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[MemoryPipeline] Memory retrieval failed:', errorMessage);

      const agentError = new MemoryError(
        'Memory retrieval failed',
        undefined,
        {
          operation: 'execute',
          component: 'MemoryPipeline',
          correlationId: this.correlationId
        },
        { originalError: error instanceof Error ? error : undefined }
      );
      errorLogger.log(agentError);

      await this.completeActivity(activityId, 'Memory retrieval failed');
      
      socket.emit(WS_EVENTS.SUBROUTINE.STATUS, {
        id: activityId,
        tool: ACTIVITY_TYPES.RECALL,
        status: ACTIVITY_STATUS.ERROR,
        summary: 'Memory retrieval failed'
      });

      // Return empty memories rather than failing completely
      return {
        memories: [],
        retrievalMethod: 'failed',
        error: errorMessage
      };
    }
  }

  /**
   * Basic memory retrieval by semantic similarity
   */
  async retrieve(query: string, topK: number = 30): Promise<Memory[]> {
    return await withRetry(
      () => memoryEngine.retrieve(query, topK),
      {
        maxAttempts: 2,
        initialDelayMs: 500,
        onRetry: (error, attempt) => {
          console.log(`[MemoryPipeline] Retrying memory retrieval (attempt ${attempt})`);
        }
      }
    );
  }

  /**
   * Context-aware memory retrieval
   */
  async retrieveWithContext(
    query: string,
    recentContext: string[],
    topK: number = 50,
    mood?: { valence: number; arousal: number }
  ): Promise<Memory[]> {
    return await withRetry(
      () => memoryEngine.retrieveWithContext(query, recentContext, topK, mood),
      {
        maxAttempts: 2,
        initialDelayMs: 500
      }
    );
  }

  /**
   * Fetch recent messages from the appropriate channel
   */
  private async fetchRecentMessages(
    source: 'chat' | 'collaborate',
    documentId?: number,
    take: number = 5
  ): Promise<Array<{ role: string; content: string; createdAt: Date }>> {
    const channelFilter = source === 'collaborate' && documentId
      ? {
          auxiliary: {
            contains: `"documentId":${documentId}`
          }
        }
      : source === 'collaborate'
        ? {
            auxiliary: {
              contains: '"channel":"collaborate"'
            }
          }
        : {
            OR: [
              { auxiliary: { contains: '"channel":"chat"' } },
              { auxiliary: { not: { contains: '"channel"' } } }
            ]
          };

    const messages = await db.message.findMany({
      where: channelFilter,
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        role: true,
        content: true,
        createdAt: true
      }
    });

    return messages.reverse();
  }

  /**
   * Format memories for inclusion in LLM context
   */
  formatMemoriesForContext(memories: Memory[], maxTokens: number = 2000): string {
    if (memories.length === 0) {
      return 'No relevant memories found.';
    }

    // Estimate tokens per memory (rough: 1 token ≈ 4 chars)
    const tokensPerMemory = memories.map(m => Math.ceil(m.text.length / 4));
    const totalTokens = tokensPerMemory.reduce((a, b) => a + b, 0);

    // If within budget, include all
    if (totalTokens <= maxTokens) {
      return memories
        .map((m, i) => `[${m.type.toUpperCase()}] ${m.text}`)
        .join('\n\n');
    }

    // Otherwise, prioritize by importance and include what fits
    const sortedMemories = [...memories].sort((a, b) => b.importance - a.importance);
    const included: Memory[] = [];
    let usedTokens = 0;

    for (const memory of sortedMemories) {
      const memoryTokens = Math.ceil(memory.text.length / 4);
      if (usedTokens + memoryTokens <= maxTokens) {
        included.push(memory);
        usedTokens += memoryTokens;
      }
    }

    return included
      .map((m, i) => `[${m.type.toUpperCase()}] ${m.text}`)
      .join('\n\n');
  }

  /**
   * Get time-ago string for memory display
   */
  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  }

  /**
   * Log activity start
   */
  private async logActivity(
    tool: string, 
    status: string, 
    summary: string,
    metadata?: any
  ): Promise<number> {
    const activity = await db.toolActivity.create({
      data: {
        tool,
        status,
        inputSummary: summary,
        outputSummary: null,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    });
    return activity.id;
  }

  /**
   * Complete activity
   */
  private async completeActivity(
    id: number, 
    summary: string,
    metadata?: any
  ): Promise<void> {
    await db.toolActivity.update({
      where: { id },
      data: {
        status: 'done',
        outputSummary: summary,
        metadata: metadata ? JSON.stringify(metadata) : undefined
      }
    });
  }
}

// ========================================
// Factory Function
// ========================================

export function createMemoryPipeline(correlationId?: string): MemoryPipeline {
  return new MemoryPipeline(correlationId);
}

export default MemoryPipeline;
