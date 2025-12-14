/**
 * Create Artifact Executor
 * 
 * Creates interactive artifacts that can be previewed and run.
 * Supports both single-file artifacts (React, HTML, Python, etc.)
 * and multi-file projects with full directory structure.
 */

import { v4 as uuidv4 } from 'uuid';
import type { ToolExecutor, ToolContext, ToolResult, CreateArtifactParams, Artifact, ArtifactType, ArtifactFile, FileLanguage } from '../types.js';
import { db } from '../../../db/client.js';

// Artifact templates for single-file types
const ARTIFACT_TEMPLATES: Partial<Record<ArtifactType, { wrapper: (code: string) => string; defaultImports?: string }>> = {
  react: {
    wrapper: (code: string) => `
import React, { useState, useEffect, useCallback, useMemo } from 'react';

${code}

// If no default export, try to render the first function component
const App = typeof Component !== 'undefined' ? Component : (() => <div>No component defined</div>);
export default App;
`,
    defaultImports: "import React from 'react';"
  },
  html: {
    wrapper: (code: string) => code // HTML is used as-is
  },
  python: {
    wrapper: (code: string) => code // Python is used as-is
  },
  svg: {
    wrapper: (code: string) => code // SVG is used as-is
  },
  mermaid: {
    wrapper: (code: string) => `\`\`\`mermaid\n${code}\n\`\`\``
  },
  markdown: {
    wrapper: (code: string) => code
  }
};

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

// Default entry files for different frameworks
const DEFAULT_ENTRY_FILES: Record<string, string> = {
  react: 'src/App.tsx',
  vue: 'src/App.vue',
  svelte: 'src/App.svelte',
  vanilla: 'index.html',
  python: 'main.py',
  node: 'src/index.ts'
};

export class CreateArtifactExecutor implements ToolExecutor<CreateArtifactParams, Artifact> {
  toolName = 'create_artifact' as const;

  validate(params: CreateArtifactParams): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    const validTypes: ArtifactType[] = ['project', 'react', 'html', 'python', 'svg', 'mermaid', 'markdown'];
    if (!params.type || !validTypes.includes(params.type)) {
      errors.push(`type must be one of: ${validTypes.join(', ')}`);
    }

    if (!params.title || typeof params.title !== 'string') {
      errors.push('title is required and must be a string');
    }

    if (params.title && params.title.length > 200) {
      errors.push('title must be less than 200 characters');
    }

    // For multi-file projects, either files or code must be provided
    if (params.type === 'project') {
      if (!params.files || params.files.length === 0) {
        errors.push('files array is required for project type');
      }
    } else {
      // For single-file artifacts, code is required
      if (!params.code && !params.files) {
        errors.push('code or files is required');
      }
    }

    // Check total code size
    if (params.code && params.code.length > 100000) {
      errors.push('code exceeds maximum length of 100,000 characters');
    }

    if (params.files) {
      const totalSize = params.files.reduce((sum, f) => sum + f.content.length, 0);
      if (totalSize > 500000) {
        errors.push('total files content exceeds maximum of 500,000 characters');
      }
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(params: CreateArtifactParams, context: ToolContext): Promise<ToolResult & { data?: Artifact }> {
    const startTime = Date.now();
    const { type, title, description, code, files, framework, entryFile, autoRun = true } = params;

    try {
      // Generate unique artifact ID
      const artifactId = `artifact_${uuidv4().slice(0, 8)}`;
      
      // Determine if this is a multi-file project
      const isMultiFile = type === 'project' || (files && files.length > 0);
      
      let processedCode: string | undefined;
      let artifactFiles: ArtifactFile[] = [];
      let selectedEntryFile = entryFile;
      
      if (isMultiFile && files) {
        // Multi-file project
        artifactFiles = files.map((f, idx) => ({
          path: f.path,
          name: getFileName(f.path),
          language: inferLanguage(f.path),
          content: f.content,
          isEntryPoint: idx === 0 || f.path === entryFile,
          isHidden: f.path.includes('node_modules') || f.path.startsWith('.')
        }));
        
        // Set default entry file if not specified
        if (!selectedEntryFile) {
          selectedEntryFile = framework ? DEFAULT_ENTRY_FILES[framework] : files[0]?.path;
        }
      } else if (code) {
        // Single-file artifact - process with template
        const template = ARTIFACT_TEMPLATES[type];
        processedCode = template ? template.wrapper(code) : code;
      }

      // Persist artifact to database
      const dbArtifact = await db.artifact.create({
        data: {
          id: artifactId,
          type,
          title,
          description,
          code: processedCode,
          entryFile: selectedEntryFile,
          framework,
          status: autoRun ? 'running' : 'idle',
          version: 1,
          documentId: context.activeDocumentId
        }
      });

      // Create artifact files if multi-file
      if (artifactFiles.length > 0) {
        await db.artifactFile.createMany({
          data: artifactFiles.map(f => ({
            artifactId,
            path: f.path,
            name: f.name,
            language: f.language,
            content: f.content,
            isEntryPoint: f.isEntryPoint,
            isHidden: f.isHidden
          }))
        });
      }

      // Create artifact object for return
      const artifact: Artifact = {
        id: dbArtifact.id,
        type: dbArtifact.type as ArtifactType,
        title: dbArtifact.title,
        description: dbArtifact.description ?? undefined,
        code: dbArtifact.code ?? undefined,
        entryFile: dbArtifact.entryFile ?? undefined,
        framework: dbArtifact.framework as Artifact['framework'],
        files: artifactFiles.length > 0 ? artifactFiles : undefined,
        status: dbArtifact.status as Artifact['status'],
        createdAt: dbArtifact.createdAt.toISOString(),
        updatedAt: dbArtifact.updatedAt.toISOString(),
        version: dbArtifact.version,
        documentId: dbArtifact.documentId ?? undefined
      };

      // Emit artifact creation event
      if (context.socket) {
        const socket = typeof context.socket === 'function' ? context.socket() : context.socket;
        if (socket) {
          socket.emit('artifact:created', {
            correlationId: context.correlationId,
            artifact,
            autoRun
          });

          // If autoRun, mark as ready for frontend execution
          if (autoRun) {
            artifact.status = 'idle';
            
            socket.emit('artifact:ready', {
              correlationId: context.correlationId,
              artifactId: artifact.id,
              type: artifact.type,
              isMultiFile
            });
          }
        }
      }

      const fileCount = artifactFiles.length || 1;
      console.log(`[CreateArtifactExecutor] ✨ Created artifact: ${artifactId} (${type}, ${fileCount} file${fileCount > 1 ? 's' : ''})`);

      return {
        toolName: this.toolName,
        status: 'success',
        data: artifact,
        summary: `Created ${type} artifact: "${title}"${fileCount > 1 ? ` with ${fileCount} files` : ''}`,
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false
      };
    } catch (error) {
      console.error('[CreateArtifactExecutor] ❌ Error:', error);
      
      return {
        toolName: this.toolName,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: 'Failed to create artifact',
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false
      };
    }
  }
}
