/**
 * Post-Process Pipeline
 * 
 * Handles background tasks after response generation:
 * - Memory classification and storage
 * - Mood updates
 * - Relationship updates
 * - Emotional thread tracking
 * - Micro-reflections
 * 
 * Extracted from the monolithic orchestrator for better separation of concerns.
 */

import { Socket } from 'socket.io';
import { db } from '../../db/client.js';
import { memoryEngine } from '../memory.js';
import { personalityEngine } from '../personality.js';
import { WS_EVENTS, ACTIVITY_TYPES, ACTIVITY_STATUS } from '../../constants/index.js';
import { 
  PersonalityError,
  generateCorrelationId,
  errorLogger 
} from '../errors/index.js';

// ========================================
// Types
// ========================================

export interface InnerThought {
  thought: string;
  responseApproach: string;
  emotionalTone: string;
  responseLength: string;
  memoryGuidance?: {
    shouldStore: boolean;
    importanceModifier: number;
    additionalContext: string;
  };
  moodImpact?: {
    valenceDelta: number;
    arousalDelta: number;
    newStance?: string;
  };
}

export interface PostProcessInput {
  userMessage: {
    id: number;
    content: string;
  };
  assistantMessage: {
    id: number;
    content: string;
  };
  combinedContent: string;
  privacy: string;
  innerThought?: InnerThought | null;
}

export interface PostProcessResult {
  memoryStored: boolean;
  memoryId?: number;
  memoryType?: string;
  moodUpdated: boolean;
  relationshipUpdated: boolean;
  errors: string[];
}

export interface PostProcessOptions {
  socket: Socket;
  correlationId?: string;
  skipMemory?: boolean;
  skipMood?: boolean;
  skipRelationship?: boolean;
}

// ========================================
// Post-Process Pipeline Class
// ========================================

export class PostProcessPipeline {
  private correlationId: string;

  constructor(correlationId?: string) {
    this.correlationId = correlationId || generateCorrelationId();
  }

  /**
   * Execute full post-processing pipeline
   */
  async execute(
    input: PostProcessInput,
    options: PostProcessOptions
  ): Promise<PostProcessResult> {
    const { socket, skipMemory, skipMood, skipRelationship } = options;
    const result: PostProcessResult = {
      memoryStored: false,
      moodUpdated: false,
      relationshipUpdated: false,
      errors: []
    };

    // Run all post-processing in parallel where possible
    const tasks: Promise<void>[] = [];

    if (!skipMemory) {
      tasks.push(this.processMemory(input, socket, result));
    }

    if (!skipMood) {
      tasks.push(this.processMood(input, socket, result));
    }

    if (!skipRelationship) {
      tasks.push(this.processRelationship(input, result));
    }

    // Always track emotional threads
    tasks.push(this.trackEmotionalThreads(input, result));

    // Wait for all tasks
    await Promise.allSettled(tasks);

    // Run micro-reflection in background (fire and forget)
    this.runMicroReflection(socket).catch(err => {
      console.error('[PostProcess] Micro-reflection error:', err instanceof Error ? err.message : String(err));
    });

    return result;
  }

  /**
   * Process memory classification and storage
   */
  private async processMemory(
    input: PostProcessInput,
    socket: Socket,
    result: PostProcessResult
  ): Promise<void> {
    const classifyId = await this.logActivity(
      'classify',
      'running',
      'Analyzing conversation for memories...'
    );

    socket.emit(WS_EVENTS.SUBROUTINE.STATUS, {
      id: classifyId,
      tool: 'classify',
      status: ACTIVITY_STATUS.RUNNING
    });

    try {
      const memory = await memoryEngine.classifyAndStore(
        input.userMessage.content,
        input.combinedContent,
        input.assistantMessage.id,
        input.privacy,
        input.innerThought?.memoryGuidance
      );

      if (memory) {
        result.memoryStored = true;
        result.memoryId = memory.id;
        result.memoryType = memory.type;

        await this.completeActivity(
          classifyId,
          `Stored ${memory.type} memory (importance: ${memory.importance.toFixed(2)})`
        );

        socket.emit(WS_EVENTS.SUBROUTINE.STATUS, {
          id: classifyId,
          tool: 'classify',
          status: ACTIVITY_STATUS.DONE,
          summary: memory.type
        });
      } else {
        await this.completeActivity(classifyId, 'No significant memory to store');

        socket.emit(WS_EVENTS.SUBROUTINE.STATUS, {
          id: classifyId,
          tool: 'classify',
          status: ACTIVITY_STATUS.DONE
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Memory: ${errorMessage}`);
      console.error('[PostProcess] Memory classification error:', errorMessage);

      await this.completeActivity(classifyId, 'Memory classification failed');

      socket.emit(WS_EVENTS.SUBROUTINE.STATUS, {
        id: classifyId,
        tool: 'classify',
        status: ACTIVITY_STATUS.ERROR
      });
    }
  }

  /**
   * Process mood updates
   */
  private async processMood(
    input: PostProcessInput,
    socket: Socket,
    result: PostProcessResult
  ): Promise<void> {
    const evolveId = await this.logActivity(
      'evolve',
      'running',
      'Updating mood state...'
    );

    socket.emit(WS_EVENTS.SUBROUTINE.STATUS, {
      id: evolveId,
      tool: 'evolve',
      status: ACTIVITY_STATUS.RUNNING
    });

    try {
      await personalityEngine.updateMood(
        input.userMessage.content,
        input.combinedContent,
        input.innerThought?.moodImpact
      );

      result.moodUpdated = true;

      await this.completeActivity(evolveId, 'Mood updated');

      socket.emit(WS_EVENTS.SUBROUTINE.STATUS, {
        id: evolveId,
        tool: 'evolve',
        status: ACTIVITY_STATUS.DONE
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Mood: ${errorMessage}`);
      console.error('[PostProcess] Mood update error:', errorMessage);

      const agentError = new PersonalityError(
        'Mood update failed',
        undefined,
        {
          operation: 'processMood',
          component: 'PostProcessPipeline',
          correlationId: this.correlationId
        },
        { originalError: error instanceof Error ? error : undefined }
      );
      errorLogger.log(agentError);

      await this.completeActivity(evolveId, 'Mood update failed');

      socket.emit(WS_EVENTS.SUBROUTINE.STATUS, {
        id: evolveId,
        tool: 'evolve',
        status: ACTIVITY_STATUS.ERROR
      });
    }
  }

  /**
   * Process relationship updates
   */
  private async processRelationship(
    input: PostProcessInput,
    result: PostProcessResult
  ): Promise<void> {
    try {
      await personalityEngine.updateRelationship(
        input.userMessage.content,
        input.combinedContent,
        undefined,
        input.innerThought
      );

      result.relationshipUpdated = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Relationship: ${errorMessage}`);
      console.error('[PostProcess] Relationship update error:', errorMessage);
    }
  }

  /**
   * Track emotional threads for continuity
   */
  private async trackEmotionalThreads(
    input: PostProcessInput,
    result: PostProcessResult
  ): Promise<void> {
    try {
      await personalityEngine.trackEmotionalThread(
        input.userMessage.content,
        input.combinedContent,
        input.innerThought
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`EmotionalThread: ${errorMessage}`);
      console.error('[PostProcess] Emotional thread error:', errorMessage);
    }
  }

  /**
   * Run micro-reflection (background, non-blocking)
   */
  private async runMicroReflection(socket: Socket): Promise<void> {
    try {
      await personalityEngine.microReflect(socket);
    } catch (error) {
      console.error('[PostProcess] Micro-reflection error:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Log activity start
   */
  private async logActivity(
    tool: string,
    status: string,
    summary: string
  ): Promise<number> {
    const activity = await db.toolActivity.create({
      data: {
        tool,
        status,
        inputSummary: summary,
        outputSummary: null,
        metadata: null
      }
    });
    return activity.id;
  }

  /**
   * Complete activity
   */
  private async completeActivity(id: number, summary: string): Promise<void> {
    await db.toolActivity.update({
      where: { id },
      data: {
        status: 'done',
        outputSummary: summary
      }
    });
  }
}

// ========================================
// Factory Function
// ========================================

export function createPostProcessPipeline(correlationId?: string): PostProcessPipeline {
  return new PostProcessPipeline(correlationId);
}

export default PostProcessPipeline;
