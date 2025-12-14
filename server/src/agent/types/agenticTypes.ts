/**
 * Agentic Code Editor - Unified Types
 * 
 * Comprehensive type definitions for the agentic code editing system.
 * These types are used by both backend and can be exported for frontend.
 */

// ========================================
// Edit Intent & Goals
// ========================================

export type EditComplexity = 'simple' | 'moderate' | 'complex';
export type GoalStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface EditingGoal {
  id: string;
  goal: string;
  approach: string;
  expectedChanges: string[];
  estimatedComplexity: EditComplexity;
  estimatedSteps: number;
}

export interface SubGoal {
  id: string;
  parentGoalId: string;
  description: string;
  status: GoalStatus;
  estimatedSteps: number;
  actualSteps: number;
  dependencies: string[];
  order: number;
}

export interface EditPlan {
  id: string;
  overallGoal: EditingGoal;
  subGoals: SubGoal[];
  currentSubGoalId: string | null;
  estimatedTotalSteps: number;
  actualSteps: number;
  startedAt: number;
  completedAt?: number;
}

export interface EditIntentResult {
  shouldEdit: boolean;
  confidence: number;
  reasoning: string;
  editingGoal?: EditingGoal;
  suggestedApproach?: string;
}

// ========================================
// Tool System
// ========================================

export type ToolName = 'read_file' | 'write_to_file' | 'replace_in_file' | 'search_files';

export interface ToolCall {
  id: string;
  tool: ToolName;
  params: Record<string, any>;
  timestamp: number;
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  duration: number;
}

export interface ParsedToolCall {
  tool: ToolName;
  params: Record<string, string>;
  rawXml: string;
  confidence: number;
  corrections: string[];
}

// ========================================
// Structured Thinking
// ========================================

export interface StructuredThought {
  observation: string;
  plan: string;
  risk: RiskLevel;
  toolChoice: string;
  confidence: number;
  reasoning?: string;
}

// ========================================
// Iterations & Progress
// ========================================

export interface AgenticIteration {
  id: string;
  step: number;
  subGoalId?: string;
  timestamp: number;
  duration: number;
  
  // Thinking
  think: string;
  structuredThought?: StructuredThought;
  
  // Action
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  
  // State
  goalStatus: GoalStatus;
  contentSnapshot?: string; // For rollback
  
  // Verification
  verification?: EditVerification;
}

export interface EditVerification {
  valid: boolean;
  diffSummary: string;
  changesCount: number;
  linesAdded: number;
  linesRemoved: number;
  syntaxValid: boolean;
  confidence: number;
  warnings: string[];
}

// ========================================
// Edit Changes
// ========================================

export type ChangeType = 'write' | 'replace' | 'insert' | 'delete';

export interface EditChange {
  id: string;
  type: ChangeType;
  description: string;
  lineStart?: number;
  lineEnd?: number;
  before?: string;
  after?: string;
  timestamp: number;
}

export interface DiffHunk {
  type: 'add' | 'remove' | 'context';
  lineNumber: number;
  content: string;
}

// ========================================
// Checkpoints & Rollback
// ========================================

export interface EditCheckpoint {
  id: string;
  iteration: number;
  content: string;
  timestamp: number;
  description: string;
  subGoalId?: string;
}

// ========================================
// Cursor & Presence
// ========================================

export type CursorAction = 'idle' | 'thinking' | 'reading' | 'typing' | 'selecting' | 'searching' | 'verifying';

export interface CursorPosition {
  line: number;
  column: number;
}

export interface CursorPresence {
  action: CursorAction;
  cursor?: CursorPosition;
  selection?: { start: CursorPosition; end: CursorPosition };
  targetDescription?: string;
}

// ========================================
// WebSocket Events
// ========================================

export interface AgenticEditEvent {
  type: 'start' | 'progress' | 'iteration' | 'tool_call' | 'tool_result' | 'verification' | 'checkpoint' | 'complete' | 'error';
  timestamp: number;
  data: any;
}

export interface EditProgressEvent {
  editId: string;
  phase: 'intent' | 'planning' | 'executing' | 'verifying' | 'complete';
  progress: number; // 0-100
  currentStep: number;
  totalSteps: number;
  currentSubGoal?: string;
  message: string;
}

export interface IterationEvent {
  editId: string;
  iteration: AgenticIteration;
  plan?: EditPlan;
}

export interface ContentChangeEvent {
  editId: string;
  documentId: number;
  content: string;
  diff?: DiffHunk[];
  changeType: 'incremental' | 'full';
}

// ========================================
// Full Context
// ========================================

export interface FullEditingContext {
  // Document
  documentId: number;
  documentTitle: string;
  documentContent: string;
  documentType: 'text' | 'code' | 'mixed';
  language?: string | null;
  
  // User request
  userMessage: string;
  userInstruction: string;
  
  // Personality context
  evelynSystemPrompt: string;
  evelynMood: string;
  evelynRelationship: string;
  
  // Chat history
  recentMessages: Array<{ role: string; content: string; timestamp: string }>;
}

// ========================================
// Results
// ========================================

export interface AgenticEditResult {
  id: string;
  success: boolean;
  editedContent: string;
  originalContent: string;
  changes: EditChange[];
  goalAchieved: boolean;
  iterations: AgenticIteration[];
  plan?: EditPlan;
  checkpoints: EditCheckpoint[];
  summary: string;
  duration: number;
  stats: EditStats;
}

export interface EditStats {
  totalIterations: number;
  totalChanges: number;
  linesAdded: number;
  linesRemoved: number;
  charactersChanged: number;
  toolCallsCount: number;
  averageIterationTime: number;
  verificationsPassed: number;
  verificationsFailed: number;
}

// ========================================
// Configuration
// ========================================

export interface AgenticEditConfig {
  maxIterations: number;
  iterationTimeoutMs: number;
  totalTimeoutMs: number;
  enableVerification: boolean;
  enableCheckpoints: boolean;
  enableStreaming: boolean;
  verboseLogging: boolean;
}

export const DEFAULT_AGENTIC_CONFIG: AgenticEditConfig = {
  maxIterations: 10,
  iterationTimeoutMs: 90000,
  totalTimeoutMs: 300000,
  enableVerification: true,
  enableCheckpoints: true,
  enableStreaming: true,
  verboseLogging: true,
};

// ========================================
// Structured Error Types
// ========================================

export type AgenticErrorType =
  | 'timeout'
  | 'tool_failure'
  | 'parse_error'
  | 'llm_error'
  | 'validation_error'
  | 'circuit_breaker'
  | 'rate_limit'
  | 'network_error';

export interface AgenticErrorBase {
  type: AgenticErrorType;
  message: string;
  timestamp: number;
  recoverable: boolean;
  suggestion?: string;
}

export interface TimeoutError extends AgenticErrorBase {
  type: 'timeout';
  phase: 'streaming' | 'tool_execution' | 'intent_detection' | 'completion';
  elapsedMs: number;
  timeoutMs: number;
  partialContent?: string;
}

export interface ToolFailureError extends AgenticErrorBase {
  type: 'tool_failure';
  toolName: string;
  params: Record<string, any>;
  reason: string;
  attemptNumber: number;
  maxAttempts: number;
}

export interface ParseError extends AgenticErrorBase {
  type: 'parse_error';
  content: string;
  expectedFormat: string;
  parseAttempts: number;
}

export interface LLMError extends AgenticErrorBase {
  type: 'llm_error';
  status: number;
  model: string;
  endpoint: string;
  rawError?: string;
}

export interface ValidationError extends AgenticErrorBase {
  type: 'validation_error';
  field: string;
  issue: string;
  providedValue?: any;
  expectedType?: string;
}

export interface CircuitBreakerError extends AgenticErrorBase {
  type: 'circuit_breaker';
  toolName: string;
  failureCount: number;
  threshold: number;
  resetAfterMs: number;
}

export interface RateLimitError extends AgenticErrorBase {
  type: 'rate_limit';
  service: string;
  retryAfterMs?: number;
  currentUsage?: number;
  limit?: number;
}

export interface NetworkError extends AgenticErrorBase {
  type: 'network_error';
  endpoint: string;
  cause: string;
}

export type AgenticError =
  | TimeoutError
  | ToolFailureError
  | ParseError
  | LLMError
  | ValidationError
  | CircuitBreakerError
  | RateLimitError
  | NetworkError;

// ========================================
// Error Recovery Strategies
// ========================================

export type RecoveryStrategy =
  | 'retry_with_backoff'
  | 'use_fallback_model'
  | 'simplify_request'
  | 'try_alternative_tool'
  | 'reduce_context'
  | 'skip_and_continue'
  | 'abort_with_partial'
  | 'ask_user';

export interface RecoveryAction {
  strategy: RecoveryStrategy;
  params?: Record<string, any>;
  description: string;
}

export function getRecoveryStrategy(error: AgenticError): RecoveryAction {
  switch (error.type) {
    case 'timeout':
      if (error.partialContent && error.partialContent.length > 100) {
        return {
          strategy: 'abort_with_partial',
          description: 'Use the partial response that was received'
        };
      }
      return {
        strategy: 'retry_with_backoff',
        params: { delayMs: 2000, maxAttempts: 2 },
        description: 'Retry after a brief delay'
      };

    case 'tool_failure':
      if (error.attemptNumber < error.maxAttempts) {
        return {
          strategy: 'retry_with_backoff',
          params: { delayMs: 1000 * error.attemptNumber },
          description: `Retry attempt ${error.attemptNumber + 1} of ${error.maxAttempts}`
        };
      }
      return {
        strategy: 'try_alternative_tool',
        params: { failedTool: error.toolName },
        description: 'Try an alternative approach'
      };

    case 'parse_error':
      return {
        strategy: 'retry_with_backoff',
        params: { delayMs: 500, maxAttempts: 2 },
        description: 'Request a reformatted response'
      };

    case 'llm_error':
      if (error.status === 429 || error.status === 503) {
        return {
          strategy: 'use_fallback_model',
          params: { originalModel: error.model },
          description: 'Switch to a fallback model'
        };
      }
      return {
        strategy: 'retry_with_backoff',
        params: { delayMs: 3000 },
        description: 'Retry after delay'
      };

    case 'rate_limit':
      return {
        strategy: 'use_fallback_model',
        params: { retryAfterMs: error.retryAfterMs },
        description: 'Use fallback model due to rate limit'
      };

    case 'circuit_breaker':
      return {
        strategy: 'skip_and_continue',
        params: { skippedTool: error.toolName },
        description: `Skip ${error.toolName} and continue with other tools`
      };

    case 'validation_error':
      return {
        strategy: 'ask_user',
        description: 'Request clarification from user'
      };

    case 'network_error':
      return {
        strategy: 'retry_with_backoff',
        params: { delayMs: 5000, maxAttempts: 3 },
        description: 'Retry after network stabilizes'
      };

    default:
      return {
        strategy: 'abort_with_partial',
        description: 'Stop and report current progress'
      };
  }
}

// ========================================
// Error Factory Functions
// ========================================

export function createTimeoutError(
  phase: TimeoutError['phase'],
  elapsedMs: number,
  timeoutMs: number,
  partialContent?: string
): TimeoutError {
  return {
    type: 'timeout',
    phase,
    elapsedMs,
    timeoutMs,
    partialContent,
    message: `Timeout during ${phase}: ${elapsedMs}ms elapsed (limit: ${timeoutMs}ms)`,
    timestamp: Date.now(),
    recoverable: !!partialContent && partialContent.length > 100,
    suggestion: partialContent
      ? 'Partial response available - consider using it'
      : 'Try a simpler request or wait and retry'
  };
}

export function createToolFailureError(
  toolName: string,
  params: Record<string, any>,
  reason: string,
  attemptNumber: number,
  maxAttempts: number
): ToolFailureError {
  return {
    type: 'tool_failure',
    toolName,
    params,
    reason,
    attemptNumber,
    maxAttempts,
    message: `Tool ${toolName} failed (attempt ${attemptNumber}/${maxAttempts}): ${reason}`,
    timestamp: Date.now(),
    recoverable: attemptNumber < maxAttempts,
    suggestion: attemptNumber < maxAttempts
      ? `Retrying (${maxAttempts - attemptNumber} attempts remaining)`
      : 'Try an alternative approach'
  };
}

export function createParseError(
  content: string,
  expectedFormat: string,
  parseAttempts: number
): ParseError {
  return {
    type: 'parse_error',
    content: content.slice(0, 500),
    expectedFormat,
    parseAttempts,
    message: `Failed to parse ${expectedFormat} after ${parseAttempts} attempts`,
    timestamp: Date.now(),
    recoverable: parseAttempts < 3,
    suggestion: 'Request reformatted output from the model'
  };
}

export function createLLMError(
  status: number,
  model: string,
  endpoint: string,
  rawError?: string
): LLMError {
  const isRecoverable = status === 429 || status === 503 || status >= 500;
  return {
    type: 'llm_error',
    status,
    model,
    endpoint,
    rawError,
    message: `LLM error ${status} from ${model}: ${rawError || 'Unknown error'}`,
    timestamp: Date.now(),
    recoverable: isRecoverable,
    suggestion: isRecoverable
      ? 'Try again or use a fallback model'
      : 'Check API key and model availability'
  };
}

export function createCircuitBreakerError(
  toolName: string,
  failureCount: number,
  threshold: number,
  resetAfterMs: number
): CircuitBreakerError {
  return {
    type: 'circuit_breaker',
    toolName,
    failureCount,
    threshold,
    resetAfterMs,
    message: `Circuit breaker open for ${toolName}: ${failureCount} failures (threshold: ${threshold})`,
    timestamp: Date.now(),
    recoverable: false,
    suggestion: `Tool ${toolName} is temporarily disabled. Will reset in ${Math.round(resetAfterMs / 1000)}s`
  };
}
