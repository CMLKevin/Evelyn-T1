/**
 * Update Artifact Executor
 * 
 * Updates an existing artifact with new code.
 * Creates a new version for history tracking.
 */

import type { ToolExecutor, ToolContext, ToolResult, UpdateArtifactParams, Artifact } from '../types.js';
import { db } from '../../../db/client.js';

export class UpdateArtifactExecutor implements ToolExecutor<UpdateArtifactParams, Artifact> {
  toolName = 'update_artifact' as const;

  validate(params: UpdateArtifactParams): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!params.artifactId || typeof params.artifactId !== 'string') {
      errors.push('artifactId is required and must be a string');
    }

    // Code is optional now (for multi-file, use updateArtifactFile)
    if (params.code !== undefined && typeof params.code !== 'string') {
      errors.push('code must be a string if provided');
    }

    if (params.code && params.code.length > 100000) {
      errors.push('code exceeds maximum length of 100,000 characters');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(params: UpdateArtifactParams, context: ToolContext): Promise<ToolResult & { data?: Artifact }> {
    const startTime = Date.now();
    const { artifactId, code, description } = params;

    try {
      // Find existing artifact
      const existing = await db.artifact.findUnique({
        where: { id: artifactId }
      });

      if (!existing) {
        return {
          toolName: this.toolName,
          status: 'error',
          error: `Artifact not found: ${artifactId}`,
          summary: 'Artifact not found',
          executionTimeMs: Date.now() - startTime,
          needsFollowUp: false
        };
      }

      console.log(`[UpdateArtifactExecutor] 📝 Updating artifact: ${artifactId}`);

      // Create new version
      const newVersion = existing.version + 1;
      
      // Only create version if code is provided
      if (code) {
        await db.artifactVersion.create({
          data: {
            artifactId,
            version: newVersion,
            code,
            description: description || `Version ${newVersion}`
          }
        });
      }

      // Update artifact
      const updateData: any = {
        version: newVersion,
        status: 'idle',
        output: null,
        error: null,
        updatedAt: new Date()
      };
      
      if (code) {
        updateData.code = code;
      }

      const updated = await db.artifact.update({
        where: { id: artifactId },
        data: updateData
      });

      // Convert to Artifact type
      const artifact: Artifact = {
        id: updated.id,
        type: updated.type as Artifact['type'],
        title: updated.title,
        code: updated.code ?? undefined,
        preview: updated.preview ?? undefined,
        status: updated.status as Artifact['status'],
        output: updated.output ?? undefined,
        error: updated.error ?? undefined,
        messageId: updated.messageId ?? undefined,
        documentId: updated.documentId ?? undefined,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        version: updated.version
      };

      // Emit update event
      if (context.socket) {
        const socket = typeof context.socket === 'function' ? context.socket() : context.socket;
        if (socket) {
          socket.emit('artifact:updated', {
            correlationId: context.correlationId,
            artifact,
            previousVersion: existing.version
          });
        }
      }

      console.log(`[UpdateArtifactExecutor] ✅ Updated to version ${newVersion}`);

      return {
        toolName: this.toolName,
        status: 'success',
        data: artifact,
        summary: `Updated artifact "${existing.title}" to version ${newVersion}`,
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false
      };
    } catch (error) {
      console.error('[UpdateArtifactExecutor] ❌ Error:', error);
      
      return {
        toolName: this.toolName,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: 'Failed to update artifact',
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false
      };
    }
  }
}
