/**
 * Update Artifact File Executor
 * 
 * Updates a specific file within a multi-file artifact project.
 */

import type { ToolExecutor, ToolContext, ToolResult, UpdateArtifactFileParams, Artifact, ArtifactType } from '../types.js';
import { db } from '../../../db/client.js';

export class UpdateArtifactFileExecutor implements ToolExecutor<UpdateArtifactFileParams, Artifact> {
  toolName = 'update_artifact_file' as const;

  validate(params: UpdateArtifactFileParams): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!params.artifactId || typeof params.artifactId !== 'string') {
      errors.push('artifactId is required and must be a string');
    }

    if (!params.path || typeof params.path !== 'string') {
      errors.push('path is required and must be a string');
    }

    if (typeof params.content !== 'string') {
      errors.push('content is required and must be a string');
    }

    if (params.content && params.content.length > 100000) {
      errors.push('content exceeds maximum length of 100,000 characters');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(params: UpdateArtifactFileParams, context: ToolContext): Promise<ToolResult & { data?: Artifact }> {
    const startTime = Date.now();
    const { artifactId, path, content } = params;

    try {
      // Find existing artifact
      const existing = await db.artifact.findUnique({
        where: { id: artifactId },
        include: { files: true }
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

      // Find the file
      const file = existing.files.find(f => f.path === path);
      if (!file) {
        return {
          toolName: this.toolName,
          status: 'error',
          error: `File not found: ${path}`,
          summary: 'File not found in artifact',
          executionTimeMs: Date.now() - startTime,
          needsFollowUp: false
        };
      }

      console.log(`[UpdateArtifactFileExecutor] 📝 Updating file: ${path} in ${artifactId}`);

      // Update the file
      await db.artifactFile.update({
        where: { id: file.id },
        data: {
          content,
          updatedAt: new Date()
        }
      });

      // Create version snapshot
      const newVersion = existing.version + 1;
      const filesSnapshot = existing.files.map(f => ({
        path: f.path,
        content: f.path === path ? content : f.content
      }));

      await db.artifactVersion.create({
        data: {
          artifactId,
          version: newVersion,
          filesSnapshot: JSON.stringify(filesSnapshot),
          description: `Updated ${path}`
        }
      });

      // Update artifact version
      const updated = await db.artifact.update({
        where: { id: artifactId },
        data: {
          version: newVersion,
          status: 'idle',
          updatedAt: new Date()
        },
        include: { files: true }
      });

      // Build artifact response
      const artifact: Artifact = {
        id: updated.id,
        type: updated.type as ArtifactType,
        title: updated.title,
        description: updated.description ?? undefined,
        code: updated.code ?? undefined,
        entryFile: updated.entryFile ?? undefined,
        framework: updated.framework as Artifact['framework'],
        files: updated.files.map(f => ({
          id: f.id,
          path: f.path,
          name: f.name,
          language: f.language as any,
          content: f.content,
          isEntryPoint: f.isEntryPoint,
          isHidden: f.isHidden
        })),
        status: updated.status as Artifact['status'],
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        version: updated.version
      };

      // Emit update event
      if (context.socket) {
        const socket = typeof context.socket === 'function' ? context.socket() : context.socket;
        if (socket) {
          socket.emit('artifact:file_updated', {
            correlationId: context.correlationId,
            artifactId,
            path,
            content,
            version: newVersion
          });
        }
      }

      console.log(`[UpdateArtifactFileExecutor] ✅ Updated file: ${path} (v${newVersion})`);

      return {
        toolName: this.toolName,
        status: 'success',
        data: artifact,
        summary: `Updated file: ${path}`,
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false
      };
    } catch (error) {
      console.error('[UpdateArtifactFileExecutor] ❌ Error:', error);
      
      return {
        toolName: this.toolName,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: 'Failed to update file',
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false
      };
    }
  }
}
