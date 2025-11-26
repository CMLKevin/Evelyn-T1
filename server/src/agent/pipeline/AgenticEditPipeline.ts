/**
 * Agentic Edit Pipeline
 * 
 * Orchestrates the agentic code editing flow:
 * 1. Intent detection with full context
 * 2. Goal extraction and validation
 * 3. Editing loop execution
 * 4. Result broadcasting and version management
 * 
 * Extracted from the monolithic orchestrator for better separation of concerns.
 */

import { Socket } from 'socket.io';
import { db } from '../../db/client.js';
import { detectEditIntentWithFullContext, executeAgenticEdit } from '../agenticCodeEditor.js';
import { personalityEngine } from '../personality.js';
import { WS_EVENTS, ACTIVITY_TYPES, ACTIVITY_STATUS } from '../../constants/index.js';
import { SYSTEM_PROMPTS } from '../../prompts/index.js';
import { 
  DocumentError,
  generateCorrelationId,
  errorLogger 
} from '../errors/index.js';

// ========================================
// Types
// ========================================

export interface DocumentContext {
  documentId: number;
  title: string;
  contentType: 'text' | 'code' | 'mixed';
  language: string | null;
  content: string;
}

export interface ChatMessage {
  role: string;
  content: string;
  timestamp: string;
}

export interface EditIntentResult {
  shouldEdit: boolean;
  confidence: number;
  reasoning: string;
  editingGoal?: {
    goal: string;
    approach: string;
    expectedChanges: string[];
    estimatedComplexity: 'simple' | 'moderate' | 'complex';
  };
}

export interface EditChange {
  type: 'write' | 'replace' | 'search';
  description: string;
  before?: string;
  after?: string;
}

export interface AgenticEditResult {
  success: boolean;
  editedContent: string;
  changes: EditChange[];
  goalAchieved: boolean;
  iterations: any[];
  summary: string;
}

export interface AgenticEditPipelineResult {
  editPerformed: boolean;
  intentResult: EditIntentResult;
  editResult?: AgenticEditResult;
  documentUpdated: boolean;
  versionCreated: boolean;
  error?: string;
}

export interface AgenticEditOptions {
  socket: Socket;
  activityId: number;
  recentMessages: ChatMessage[];
  correlationId?: string;
}

// ========================================
// Agentic Edit Pipeline Class
// ========================================

export class AgenticEditPipeline {
  private correlationId: string;

  constructor(correlationId?: string) {
    this.correlationId = correlationId || generateCorrelationId();
  }

  /**
   * Execute full agentic edit pipeline
   */
  async execute(
    userMessage: string,
    documentContext: DocumentContext,
    options: AgenticEditOptions
  ): Promise<AgenticEditPipelineResult> {
    const { socket, activityId, recentMessages } = options;

    try {
      // Get personality context for the editor
      const personalitySnapshot = await personalityEngine.getSnapshot();
      const moodText = `${personalitySnapshot.mood.stance} (valence: ${personalitySnapshot.mood.valence.toFixed(2)})`;

      // Build full context for intent detection
      const fullContext = {
        documentId: documentContext.documentId,
        documentTitle: documentContext.title,
        documentContent: documentContext.content,
        documentType: documentContext.contentType,
        language: documentContext.language,
        userMessage,
        userInstruction: userMessage,
        evelynSystemPrompt: SYSTEM_PROMPTS.EVELYN_CORE.slice(0, 500),
        evelynMood: moodText,
        evelynRelationship: 'creator-creation bond',
        recentMessages: recentMessages.slice(-5).map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp
        }))
      };

      // Step 1: Detect edit intent
      console.log('[AgenticEditPipeline] 🔍 Detecting edit intent...');
      this.emitProgress(socket, activityId, 'detecting', 'Analyzing if edit is needed...');

      const intentResult = await detectEditIntentWithFullContext(fullContext);

      console.log(`[AgenticEditPipeline] Intent: ${intentResult.shouldEdit ? 'EDIT' : 'RESPOND'} (${(intentResult.confidence * 100).toFixed(0)}%)`);

      if (!intentResult.shouldEdit || !intentResult.editingGoal) {
        this.emitProgress(socket, activityId, 'skipped', 'No edit needed');
        return {
          editPerformed: false,
          intentResult,
          documentUpdated: false,
          versionCreated: false
        };
      }

      // Step 2: Execute agentic edit
      console.log('[AgenticEditPipeline] ✏️ Executing agentic edit...');
      this.emitProgress(socket, activityId, 'editing', `Goal: ${intentResult.editingGoal.goal}`);

      const editResult = await executeAgenticEdit(
        documentContext.documentId,
        userMessage,
        documentContext.content,
        documentContext.contentType,
        documentContext.language,
        SYSTEM_PROMPTS.EVELYN_CORE,
        recentMessages,
        activityId,
        socket
      );

      if (!editResult.success || !editResult.goalAchieved) {
        console.log('[AgenticEditPipeline] ⚠️ Edit incomplete or failed');
        this.emitProgress(socket, activityId, 'partial', editResult.summary);
        
        return {
          editPerformed: true,
          intentResult,
          editResult,
          documentUpdated: false,
          versionCreated: false
        };
      }

      // Step 3: Update document and create version
      console.log('[AgenticEditPipeline] 💾 Saving changes...');
      this.emitProgress(socket, activityId, 'saving', 'Saving document changes...');

      const { documentUpdated, versionCreated } = await this.persistChanges(
        documentContext.documentId,
        editResult.editedContent,
        editResult.summary,
        editResult.changes,
        socket
      );

      // Complete
      this.emitProgress(socket, activityId, 'complete', `Made ${editResult.changes.length} change(s)`);

      return {
        editPerformed: true,
        intentResult,
        editResult,
        documentUpdated,
        versionCreated
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[AgenticEditPipeline] Error:', errorMessage);

      const agentError = new DocumentError(
        'Agentic edit failed',
        undefined,
        {
          operation: 'execute',
          component: 'AgenticEditPipeline',
          correlationId: this.correlationId,
          metadata: { documentId: documentContext.documentId }
        },
        { originalError: error instanceof Error ? error : undefined }
      );
      errorLogger.log(agentError);

      this.emitProgress(socket, activityId, 'error', errorMessage);

      return {
        editPerformed: false,
        intentResult: {
          shouldEdit: false,
          confidence: 0,
          reasoning: errorMessage
        },
        documentUpdated: false,
        versionCreated: false,
        error: errorMessage
      };
    }
  }

  /**
   * Persist document changes and create version
   * NOTE: This method uses dynamic access patterns to support varying database schemas.
   * The actual field names should match the Prisma schema.
   */
  private async persistChanges(
    documentId: number,
    newContent: string,
    summary: string,
    changes: EditChange[],
    socket: Socket
  ): Promise<{ documentUpdated: boolean; versionCreated: boolean }> {
    try {
      // Get current document - use dynamic access for schema flexibility
      const document = await (db.collaborateDocument as any).findUnique({
        where: { id: documentId }
      });

      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      // Get previous content (field name may vary by schema)
      const previousContent = (document as any).content || '';

      // Update document - use dynamic update for schema flexibility
      await (db.collaborateDocument as any).update({
        where: { id: documentId },
        data: {
          updatedAt: new Date(),
          // Add content field dynamically if schema supports it
          ...(previousContent !== undefined && { content: newContent })
        }
      });

      // Create version entry - field names may vary by schema
      const versionData: any = {
        documentId,
        metadata: JSON.stringify({
          summary,
          changes: changes.map(c => ({
            type: c.type,
            description: c.description
          })),
          previousLength: previousContent.length,
          newLength: newContent.length
        })
      };

      const version = await (db.collaborateVersion as any).create({
        data: versionData
      });

      // Broadcast content change to all connected clients
      socket.emit(WS_EVENTS.COLLABORATE.CONTENT_CHANGED, {
        documentId,
        content: newContent,
        source: 'agentic_edit',
        versionId: version.id,
        summary
      });

      console.log(`[AgenticEditPipeline] ✅ Saved version ${version.id}`);

      return {
        documentUpdated: true,
        versionCreated: true
      };

    } catch (error) {
      console.error('[AgenticEditPipeline] Persist error:', error);
      return {
        documentUpdated: false,
        versionCreated: false
      };
    }
  }

  /**
   * Emit progress updates to frontend
   */
  private emitProgress(
    socket: Socket,
    activityId: number,
    stage: string,
    message: string
  ): void {
    socket.emit(WS_EVENTS.COLLABORATE.EDIT_PROGRESS, {
      activityId,
      stage,
      message,
      timestamp: new Date().toISOString()
    });
  }
}

// ========================================
// Factory Function
// ========================================

export function createAgenticEditPipeline(correlationId?: string): AgenticEditPipeline {
  return new AgenticEditPipeline(correlationId);
}

export default AgenticEditPipeline;
