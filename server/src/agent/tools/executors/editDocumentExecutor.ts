/**
 * Edit Document Executor
 * 
 * Wraps the existing agenticEngineV2 to provide document editing
 * as a unified tool. This is the bridge between the new tool system
 * and the existing agentic edit infrastructure.
 */

import type { ToolExecutor, ToolContext, ToolResult, EditDocumentParams } from '../types.js';
import { executeAgenticEditV2, type AgenticV2Result } from '../../agenticEngineV2.js';
import { db } from '../../../db/client.js';
import { COLLABORATE_CONFIG } from '../../../constants/index.js';

export interface EditDocumentResult {
  documentId: number;
  changesSummary: string;
  changesCount: number;
  iterations: number;
  editedContent: string;
  success: boolean;
}

export class EditDocumentExecutor implements ToolExecutor<EditDocumentParams, EditDocumentResult> {
  toolName = 'edit_document' as const;

  validate(params: EditDocumentParams): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!params.documentId || typeof params.documentId !== 'number') {
      errors.push('documentId is required and must be a number');
    }

    if (!params.goal || typeof params.goal !== 'string') {
      errors.push('goal is required and must be a string');
    }

    if (params.goal && params.goal.length < 3) {
      errors.push('goal must be at least 3 characters');
    }

    if (params.approach && !['write_full', 'replace_section'].includes(params.approach)) {
      errors.push('approach must be "write_full" or "replace_section"');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(params: EditDocumentParams, context: ToolContext): Promise<ToolResult & { data?: EditDocumentResult }> {
    const startTime = Date.now();
    const { documentId, goal, approach = 'write_full' } = params;

    try {
      // Fetch document from database
      const document = await db.collaborateDocument.findUnique({
        where: { id: documentId },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 1
          }
        }
      });

      if (!document) {
        return {
          toolName: this.toolName,
          status: 'error',
          error: `Document not found: ${documentId}`,
          summary: 'Document not found',
          executionTimeMs: Date.now() - startTime,
          needsFollowUp: false
        };
      }

      // Get latest content
      const latestVersion = document.versions[0];
      const content = latestVersion?.content || '';

      console.log(`[EditDocumentExecutor] 📝 Editing document ${documentId}: "${document.title}"`);
      console.log(`[EditDocumentExecutor] 🎯 Goal: ${goal}`);
      console.log(`[EditDocumentExecutor] 📊 Content length: ${content.length} chars`);

      // Create activity for tracking
      const activity = await db.toolActivity.create({
        data: {
          tool: 'code_edit',
          status: 'running',
          inputSummary: `Edit document ${documentId}: ${goal.slice(0, 100)}`,
          metadata: JSON.stringify({
            documentId,
            goal,
            approach,
            correlationId: context.correlationId
          })
        }
      });

      // Execute the agentic edit
      const result: AgenticV2Result = await executeAgenticEditV2(
        documentId,
        document.title,
        content,
        document.contentType as 'text' | 'code' | 'mixed',
        document.language,
        goal,
        activity.id,
        context.socket,
        {
          maxIterations: COLLABORATE_CONFIG.AGENTIC_EDIT.MAX_ITERATIONS,
          iterationTimeoutMs: COLLABORATE_CONFIG.AGENTIC_EDIT.ITERATION_TIMEOUT_MS,
          totalTimeoutMs: COLLABORATE_CONFIG.AGENTIC_EDIT.TOTAL_TIMEOUT_MS,
          streamResponses: COLLABORATE_CONFIG.AGENTIC_EDIT.STREAM_RESPONSES,
          enableCheckpoints: COLLABORATE_CONFIG.AGENTIC_EDIT.ENABLE_CHECKPOINTS,
          earlyTermination: COLLABORATE_CONFIG.AGENTIC_EDIT.EARLY_TERMINATION,
          tokenBudget: COLLABORATE_CONFIG.AGENTIC_EDIT.TOKEN_BUDGET
        }
      );

      // Update activity status
      await db.toolActivity.update({
        where: { id: activity.id },
        data: {
          status: result.success ? 'done' : 'error',
          outputSummary: result.summary,
          finishedAt: new Date()
        }
      });

      if (result.success && result.goalAchieved) {
        // Save the edited content - create new version
        const versionCount = await db.collaborateVersion.count({
          where: { documentId }
        });

        await db.collaborateVersion.create({
          data: {
            documentId,
            version: versionCount + 1,
            content: result.editedContent,
            description: result.summary,
            createdBy: 'evelyn',
            evelynNote: `Tool edit: ${goal}`
          }
        });

        // Update document timestamp
        await db.collaborateDocument.update({
          where: { id: documentId },
          data: { updatedAt: new Date() }
        });

        // Emit content change event
        if (context.socket) {
          const socket = typeof context.socket === 'function' ? context.socket() : context.socket;
          if (socket) {
            socket.emit('collaborate:content_changed', {
              documentId,
              content: result.editedContent,
              author: 'evelyn',
              timestamp: new Date().toISOString(),
              correlationId: context.correlationId
            });
          }
        }

        return {
          toolName: this.toolName,
          status: 'success',
          data: {
            documentId,
            changesSummary: result.summary,
            changesCount: result.changes.length,
            iterations: result.iterations.length,
            editedContent: result.editedContent,
            success: true
          },
          summary: `Made ${result.changes.length} changes: ${result.summary}`,
          executionTimeMs: Date.now() - startTime,
          needsFollowUp: false
        };
      } else {
        return {
          toolName: this.toolName,
          status: 'partial',
          data: {
            documentId,
            changesSummary: result.summary || 'Edit incomplete',
            changesCount: result.changes.length,
            iterations: result.iterations.length,
            editedContent: result.editedContent,
            success: false
          },
          summary: result.summary || 'Edit did not complete successfully',
          executionTimeMs: Date.now() - startTime,
          needsFollowUp: true,
          followUpPrompt: `The edit was not fully successful. Would you like me to try again with a different approach?`
        };
      }
    } catch (error) {
      console.error('[EditDocumentExecutor] ❌ Error:', error);
      
      return {
        toolName: this.toolName,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: 'Failed to edit document',
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: true,
        followUpPrompt: 'The edit failed due to an error. Should I try a different approach?'
      };
    }
  }

  async abort(): Promise<void> {
    // The agentic engine doesn't currently support abort
    // This would be a future enhancement
    console.log('[EditDocumentExecutor] Abort requested (not implemented)');
  }
}
