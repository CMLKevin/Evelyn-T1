/**
 * Artifact Types for Frontend
 * Supports both single-file artifacts and multi-file projects
 */

export type ArtifactType = 'project' | 'react' | 'html' | 'python' | 'svg' | 'mermaid' | 'markdown';
export type ArtifactStatus = 'idle' | 'running' | 'building' | 'success' | 'error';
export type ArtifactFramework = 'react' | 'vue' | 'svelte' | 'vanilla' | 'python' | 'node';
export type FileLanguage = 
  | 'typescript' | 'javascript' | 'tsx' | 'jsx'
  | 'html' | 'css' | 'scss' | 'less'
  | 'json' | 'yaml' | 'toml'
  | 'python' | 'markdown' | 'plaintext';

/** Individual file within an artifact project */
export interface ArtifactFile {
  id?: number;
  path: string;       // Full path: "src/components/Header.tsx"
  name: string;       // Just filename: "Header.tsx"
  language: FileLanguage;
  content: string;
  isEntryPoint: boolean;
  isHidden: boolean;
  isDirty?: boolean;  // Has unsaved changes (frontend only)
  createdAt?: string;
  updatedAt?: string;
}

/** Artifact - can be single-file or multi-file project */
export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  description?: string;
  
  // Legacy single-file support
  code?: string;
  
  // Multi-file project settings
  entryFile?: string;
  framework?: ArtifactFramework;
  files?: ArtifactFile[];
  
  // Preview and status
  preview?: string;
  status: ArtifactStatus;
  output?: string;
  error?: string;
  
  // Deployment
  publishedUrl?: string;
  publishedAt?: string;
  
  // Metadata
  messageId?: number;
  documentId?: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactVersion {
  id: number;
  artifactId: string;
  version: number;
  code?: string;           // Legacy single-file
  filesSnapshot?: string;  // JSON snapshot for multi-file
  description?: string;
  createdAt: string;
}

// Language mapping for syntax highlighting (Monaco editor languages)
export const ARTIFACT_LANGUAGES: Record<ArtifactType, string> = {
  project: 'typescript',
  react: 'typescript',
  html: 'html',
  python: 'python',
  svg: 'xml',
  mermaid: 'markdown',
  markdown: 'markdown'
};

// File extension to Monaco language mapping
export const FILE_LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescriptreact',
  js: 'javascript',
  jsx: 'javascriptreact',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  py: 'python',
  md: 'markdown',
  svg: 'xml',
  xml: 'xml'
};

// Icons for each artifact type
export const ARTIFACT_ICONS: Record<ArtifactType, string> = {
  project: 'FolderCode',
  react: 'Component',
  html: 'Globe',
  python: 'Terminal',
  svg: 'Image',
  mermaid: 'GitBranch',
  markdown: 'FileText'
};

// Display names for artifact types
export const ARTIFACT_TYPE_NAMES: Record<ArtifactType, string> = {
  project: 'Project',
  react: 'React Component',
  html: 'HTML/CSS/JS',
  python: 'Python',
  svg: 'SVG Image',
  mermaid: 'Diagram',
  markdown: 'Markdown'
};

// File icons based on extension
export const FILE_ICONS: Record<string, string> = {
  ts: 'FileType',
  tsx: 'FileCode',
  js: 'FileJson',
  jsx: 'FileCode',
  html: 'FileCode',
  css: 'Palette',
  scss: 'Palette',
  json: 'FileJson',
  md: 'FileText',
  py: 'FileType',
  svg: 'Image',
  png: 'Image',
  jpg: 'Image',
  gif: 'Image'
};

/** Check if artifact is multi-file */
export function isMultiFileArtifact(artifact: Artifact): boolean {
  return artifact.type === 'project' || (artifact.files !== undefined && artifact.files.length > 0);
}

/** Get the code to display/run for an artifact */
export function getArtifactCode(artifact: Artifact): string {
  if (artifact.code) {
    return artifact.code;
  }
  if (artifact.files && artifact.entryFile) {
    const entryFile = artifact.files.find(f => f.path === artifact.entryFile);
    return entryFile?.content || '';
  }
  if (artifact.files && artifact.files.length > 0) {
    return artifact.files[0].content;
  }
  return '';
}
