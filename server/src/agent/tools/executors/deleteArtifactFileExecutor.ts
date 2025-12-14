/**
 * Delete Artifact File Executor
 * 
 * Deletes a file from a multi-file artifact project.
 */

import type { ToolExecutor, ToolContext, ToolResult, DeleteArtifactFileParams, Artifact, ArtifactType } from '../types.js';
import { db } from '../../../db/client.js';

export class DeleteArtifactFileExecutor implements ToolExecutor<DeleteArtifactFileParams, Artifact> {
  toolName = 'delete_artifact_file' as const;

  validate(params: DeleteArtifactFileParams): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!params.artifactId || typeof params.artifactId !== 'string') {
      errors.push('artifactId is required and must be a string');
    }

    if (!params.path || typeof params.path !== 'string') {
      errors.push('path is required and must be a string');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(params: DeleteArtifactFileParams, context: ToolContext): Promise<ToolResult & { data?: Artifact }> {
    const startTime = Date.now();
    const { artifactId, path } = params;

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

      // Don't allow deleting the last file
      if (existing.files.length <= 1) {
        return {
          toolName: this.toolName,
          status: 'error',
          error: 'Cannot delete the last file in a project',
          summary: 'Cannot delete last file',
          executionTimeMs: Date.now() - startTime,
          needsFollowUp: false
        };
      }

      console.log(`[DeleteArtifactFileExecutor] 🗑️ Deleting file: ${path} from ${artifactId}`);

      // Delete the file
      await db.artifactFile.delete({
        where: { id: file.id }
      });

      // Create version snapshot (without deleted file)
      const newVersion = existing.version + 1;
      const filesSnapshot = existing.files
        .filter(f => f.path !== path)
        .map(f => ({ path: f.path, content: f.content }));

      await db.artifactVersion.create({
        data: {
          artifactId,
          version: newVersion,
          filesSnapshot: JSON.stringify(filesSnapshot),
          description: `Deleted ${path}`
        }
      });

      // Update entry file if we deleted it
      let newEntryFile = existing.entryFile;
      if (existing.entryFile === path) {
        const remainingFiles = existing.files.filter(f => f.path !== path);
        newEntryFile = remainingFiles[0]?.path || null;
      }

      // Update artifact version
      const updated = await db.artifact.update({
        where: { id: artifactId },
        data: {
          version: newVersion,
          entryFile: newEntryFile,
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
          socket.emit('artifact:file_deleted', {
            correlationId: context.correlationId,
            artifactId,
            path,
            version: newVersion
          });
        }
      }

      console.log(`[DeleteArtifactFileExecutor] ✅ Deleted file: ${path} (v${newVersion})`);

      return {
        toolName: this.toolName,
        status: 'success',
        data: artifact,
        summary: `Deleted file: ${path}`,
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false
      };
    } catch (error) {
      console.error('[DeleteArtifactFileExecutor] ❌ Error:', error);
      
      return {
        toolName: this.toolName,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: 'Failed to delete file',
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false
      };
    }
  }
}
