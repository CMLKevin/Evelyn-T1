/**
 * Unified Tool System Types
 * 
 * Defines the type system for Evelyn's unified agent tools.
 * All tools share this common interface for consistent handling.
 */

import { Socket } from 'socket.io';

// ========================================
// Core Tool Types
// ========================================

export type ToolName = 
  | 'edit_document'
  | 'create_artifact'
  | 'update_artifact'
  | 'update_artifact_file'
  | 'add_artifact_file'
  | 'delete_artifact_file'
  | 'web_search'
  | 'x_search'
  | 'run_python'
  | 'browse_url';

export type ToolParameterType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface ToolParameter {
  type: ToolParameterType;
  description: string;
  required?: boolean;
  default?: any;
  enum?: string[];
}

export interface ToolDefinition {
  name: ToolName;
  description: string;
  parameters: Record<string, ToolParameter>;
  /** Whether this tool can run in parallel with others */
  parallelizable: boolean;
  /** Estimated execution time category */
  executionTime: 'instant' | 'fast' | 'slow';
}

// ========================================
// Tool Execution Context
// ========================================

export interface ToolContext {
  /** Socket for real-time updates */
  socket?: Socket | (() => Socket | null);
  /** Current user's ID (if authenticated) */
  userId?: number;
  /** Active document ID (if in collaborate/artifact context) */
  activeDocumentId?: number;
  /** Active document content */
  activeDocumentContent?: string;
  /** Active artifact ID */
  activeArtifactId?: string;
  /** Correlation ID for tracing */
  correlationId: string;
  /** Activity ID for this tool execution */
  activityId?: number;
}

// ========================================
// Tool Call Parsing
// ========================================

export interface ParsedToolCall {
  name: ToolName;
  params: Record<string, any>;
  /** Raw XML/text that was parsed */
  rawText: string;
  /** Position in the response where this tool call was found */
  startIndex: number;
  endIndex: number;
}

export interface ToolParseResult {
  /** Text response (non-tool content) */
  textResponse: string;
  /** Parsed tool calls */
  toolCalls: ParsedToolCall[];
  /** Whether parsing was successful */
  success: boolean;
  /** Parsing errors if any */
  errors?: string[];
}

// ========================================
// Tool Execution Results
// ========================================

export type ToolResultStatus = 'success' | 'error' | 'partial' | 'cancelled';

export interface ToolResult {
  toolName: ToolName;
  status: ToolResultStatus;
  /** Result data (tool-specific) */
  data?: any;
  /** Human-readable summary */
  summary: string;
  /** Error message if failed */
  error?: string;
  /** Execution time in ms */
  executionTimeMs: number;
  /** Whether follow-up LLM call is needed */
  needsFollowUp: boolean;
  /** Suggested follow-up prompt if needed */
  followUpPrompt?: string;
}

// ========================================
// Specific Tool Parameters
// ========================================

export interface RespondParams {
  message: string;
  split?: boolean;
}

export interface EditDocumentParams {
  documentId: number;
  goal: string;
  approach?: 'write_full' | 'replace_section';
}

// CreateArtifactParams and UpdateArtifactParams defined below in Artifact Types section

export interface WebSearchParams {
  query: string;
}

export interface XSearchParams {
  query: string;
  maxResults?: number;
}

export interface RunPythonParams {
  code: string;
  showOutput?: boolean;
}

export interface BrowseUrlParams {
  url: string;
  extractContent?: boolean;
  screenshot?: boolean;
}

// ========================================
// Tool Executor Interface
// ========================================

export interface ToolExecutor<TParams = any, TResult = any> {
  /** Tool name this executor handles */
  toolName: ToolName;
  
  /** Validate parameters before execution */
  validate(params: TParams): { valid: boolean; errors?: string[] };
  
  /** Execute the tool */
  execute(params: TParams, context: ToolContext): Promise<ToolResult & { data?: TResult }>;
  
  /** Abort execution if possible */
  abort?(): Promise<void>;
}

// ========================================
// Artifact Types (Multi-file project support)
// ========================================

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

/** Parameters for creating an artifact */
export interface CreateArtifactParams {
  type: ArtifactType;
  title: string;
  description?: string;
  
  // For single-file artifacts
  code?: string;
  
  // For multi-file projects
  files?: Array<{ path: string; content: string }>;
  framework?: ArtifactFramework;
  entryFile?: string;
  
  autoRun?: boolean;
}

/** Parameters for updating an artifact */
export interface UpdateArtifactParams {
  artifactId: string;
  code?: string;           // For single-file updates
  description?: string;
}

/** Parameters for file operations */
export interface UpdateArtifactFileParams {
  artifactId: string;
  path: string;
  content: string;
}

export interface AddArtifactFileParams {
  artifactId: string;
  path: string;
  content: string;
  language?: FileLanguage;
}

export interface DeleteArtifactFileParams {
  artifactId: string;
  path: string;
}

// ========================================
// Unified Response
// ========================================

export interface UnifiedToolResponse {
  /** Text response to show user */
  response: string;
  /** Tool results */
  toolResults: ToolResult[];
  /** Created/updated artifacts */
  artifacts: Artifact[];
  /** Document changes */
  documentChanges: Array<{
    documentId: number;
    changesSummary: string;
    changesCount: number;
  }>;
  /** Whether the response is complete or streaming */
  complete: boolean;
  /** Total execution time */
  totalTimeMs: number;
}
