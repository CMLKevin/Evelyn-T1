/**
 * Add Artifact File Executor
 * 
 * Adds a new file to a multi-file artifact project.
 */

import type { ToolExecutor, ToolContext, ToolResult, AddArtifactFileParams, Artifact, ArtifactType, FileLanguage } from '../types.js';
import { db } from '../../../db/client.js';

// Infer language from file path
function inferLanguage(path: string): FileLanguage {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, FileLanguage> = {
    'ts': 'typescript',
    'tsx': 'tsx',
    'js': 'javascript',
    'jsx': 'jsx',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'py': 'python',
    'md': 'markdown',
    'markdown': 'markdown'
  };
  return langMap[ext] || 'plaintext';
}

// Get filename from path
function getFileName(path: string): string {
  return path.split('/').pop() || path;
}

export class AddArtifactFileExecutor implements ToolExecutor<AddArtifactFileParams, Artifact> {
  toolName = 'add_artifact_file' as const;

  validate(params: AddArtifactFileParams): { valid: boolean; errors?: string[] } {
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

  async execute(params: AddArtifactFileParams, context: ToolContext): Promise<ToolResult & { data?: Artifact }> {
    const startTime = Date.now();
    const { artifactId, path, content, language } = params;

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

      // Check if file already exists
      const existingFile = existing.files.find(f => f.path === path);
      if (existingFile) {
        return {
          toolName: this.toolName,
          status: 'error',
          error: `File already exists: ${path}`,
          summary: 'File already exists',
          executionTimeMs: Date.now() - startTime,
          needsFollowUp: false
        };
      }

      console.log(`[AddArtifactFileExecutor] 📄 Adding file: ${path} to ${artifactId}`);

      // Create the new file
      const fileLanguage = language || inferLanguage(path);
      await db.artifactFile.create({
        data: {
          artifactId,
          path,
          name: getFileName(path),
          language: fileLanguage,
          content,
          isEntryPoint: false,
          isHidden: path.startsWith('.') || path.includes('node_modules')
        }
      });

      // Create version snapshot
      const newVersion = existing.version + 1;
      const filesSnapshot = [
        ...existing.files.map(f => ({ path: f.path, content: f.content })),
        { path, content }
      ];

      await db.artifactVersion.create({
        data: {
          artifactId,
          version: newVersion,
          filesSnapshot: JSON.stringify(filesSnapshot),
          description: `Added ${path}`
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
          socket.emit('artifact:file_added', {
            correlationId: context.correlationId,
            artifactId,
            file: {
              path,
              name: getFileName(path),
              language: fileLanguage,
              content
            },
            version: newVersion
          });
        }
      }

      console.log(`[AddArtifactFileExecutor] ✅ Added file: ${path} (v${newVersion})`);

      return {
        toolName: this.toolName,
        status: 'success',
        data: artifact,
        summary: `Added file: ${path}`,
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false
      };
    } catch (error) {
      console.error('[AddArtifactFileExecutor] ❌ Error:', error);
      
      return {
        toolName: this.toolName,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: 'Failed to add file',
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false
      };
    }
  }
}
