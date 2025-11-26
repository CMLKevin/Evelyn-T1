/**
 * Agent Error Handling System
 * 
 * Provides structured error handling with:
 * - Error hierarchy for different error types
 * - Retry logic for transient failures
 * - Error context for debugging
 * - Error recovery strategies
 */

import { ErrorCode, ERROR_CODES } from '../../constants/index.js';

// ========================================
// Base Agent Error
// ========================================

export interface AgentErrorContext {
  operation: string;
  component: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export class AgentError extends Error {
  public readonly code: ErrorCode;
  public readonly retryable: boolean;
  public readonly context: AgentErrorContext;
  public readonly timestamp: Date;
  public readonly originalError?: Error;

  constructor(
    message: string,
    code: ErrorCode,
    context: AgentErrorContext,
    options?: {
      retryable?: boolean;
      originalError?: Error;
    }
  ) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    this.context = context;
    this.retryable = options?.retryable ?? false;
    this.originalError = options?.originalError;
    this.timestamp = new Date();

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AgentError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      retryable: this.retryable,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

// ========================================
// Specific Error Types
// ========================================

export class LLMError extends AgentError {
  constructor(
    message: string,
    code: ErrorCode = ERROR_CODES.LLM_API_ERROR,
    context: AgentErrorContext,
    options?: { retryable?: boolean; originalError?: Error }
  ) {
    super(message, code, context, options);
    this.name = 'LLMError';
  }
}

export class LLMTimeoutError extends LLMError {
  constructor(context: AgentErrorContext, timeoutMs: number) {
    super(
      `LLM request timed out after ${timeoutMs}ms`,
      ERROR_CODES.LLM_TIMEOUT,
      { ...context, metadata: { ...context.metadata, timeoutMs } },
      { retryable: true }
    );
    this.name = 'LLMTimeoutError';
  }
}

export class LLMRateLimitError extends LLMError {
  public readonly retryAfterMs?: number;

  constructor(context: AgentErrorContext, retryAfterMs?: number) {
    super(
      `LLM rate limit exceeded${retryAfterMs ? `, retry after ${retryAfterMs}ms` : ''}`,
      ERROR_CODES.LLM_RATE_LIMIT,
      { ...context, metadata: { ...context.metadata, retryAfterMs } },
      { retryable: true }
    );
    this.name = 'LLMRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class MemoryError extends AgentError {
  constructor(
    message: string,
    code: ErrorCode = ERROR_CODES.MEMORY_RETRIEVAL_FAILED,
    context: AgentErrorContext,
    options?: { retryable?: boolean; originalError?: Error }
  ) {
    super(message, code, context, options);
    this.name = 'MemoryError';
  }
}

export class EmbeddingError extends MemoryError {
  constructor(context: AgentErrorContext, originalError?: Error) {
    super(
      'Failed to generate embedding',
      ERROR_CODES.EMBEDDING_FAILED,
      context,
      { retryable: true, originalError }
    );
    this.name = 'EmbeddingError';
  }
}

export class PersonalityError extends AgentError {
  constructor(
    message: string,
    code: ErrorCode = ERROR_CODES.PERSONALITY_UPDATE_FAILED,
    context: AgentErrorContext,
    options?: { retryable?: boolean; originalError?: Error }
  ) {
    super(message, code, context, options);
    this.name = 'PersonalityError';
  }
}

export class PipelineError extends AgentError {
  constructor(
    message: string,
    code: ErrorCode = ERROR_CODES.PIPELINE_CONTEXT_MISSING,
    context: AgentErrorContext,
    options?: { retryable?: boolean; originalError?: Error }
  ) {
    super(message, code, context, options);
    this.name = 'PipelineError';
  }
}

export class DocumentError extends AgentError {
  constructor(
    message: string,
    code: ErrorCode = ERROR_CODES.DOCUMENT_NOT_FOUND,
    context: AgentErrorContext,
    options?: { retryable?: boolean; originalError?: Error }
  ) {
    super(message, code, context, options);
    this.name = 'DocumentError';
  }
}

// ========================================
// Error Factory
// ========================================

export function createError(
  type: 'llm' | 'memory' | 'personality' | 'pipeline' | 'document',
  message: string,
  context: AgentErrorContext,
  options?: { code?: ErrorCode; retryable?: boolean; originalError?: Error }
): AgentError {
  const ErrorClass = {
    llm: LLMError,
    memory: MemoryError,
    personality: PersonalityError,
    pipeline: PipelineError,
    document: DocumentError,
  }[type];

  const defaultCode = {
    llm: ERROR_CODES.LLM_API_ERROR,
    memory: ERROR_CODES.MEMORY_RETRIEVAL_FAILED,
    personality: ERROR_CODES.PERSONALITY_UPDATE_FAILED,
    pipeline: ERROR_CODES.PIPELINE_CONTEXT_MISSING,
    document: ERROR_CODES.DOCUMENT_NOT_FOUND,
  }[type];

  return new ErrorClass(
    message,
    options?.code || defaultCode,
    context,
    options
  );
}

// ========================================
// Retry Logic
// ========================================

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: ErrorCode[];
  onRetry?: (error: AgentError, attempt: number, delayMs: number) => void;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;
  let delayMs = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const isRetryable =
        error instanceof AgentError
          ? error.retryable &&
            (!opts.retryableErrors || opts.retryableErrors.includes(error.code))
          : false;

      // Handle rate limit with specific retry-after
      if (error instanceof LLMRateLimitError && error.retryAfterMs) {
        delayMs = error.retryAfterMs;
      }

      // If not retryable or last attempt, throw
      if (!isRetryable || attempt === opts.maxAttempts) {
        throw error;
      }

      // Notify retry callback
      if (opts.onRetry && error instanceof AgentError) {
        opts.onRetry(error, attempt, delayMs);
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      // Exponential backoff
      delayMs = Math.min(delayMs * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}

// ========================================
// Error Wrapping
// ========================================

/**
 * Wrap a function to catch and convert errors to AgentErrors
 */
export function wrapWithErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  component: string,
  operation: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof AgentError) {
        throw error;
      }

      // Convert unknown errors to AgentError
      throw new AgentError(
        error instanceof Error ? error.message : String(error),
        ERROR_CODES.UNKNOWN_ERROR,
        { component, operation },
        {
          originalError: error instanceof Error ? error : undefined,
        }
      );
    }
  }) as T;
}

// ========================================
// Error Logging
// ========================================

export interface ErrorLogger {
  log(error: AgentError): void;
  getErrors(): AgentError[];
  getUnresolved(): AgentError[];
  resolve(correlationId: string): boolean;
}

class ErrorLoggerImpl implements ErrorLogger {
  private errors: AgentError[] = [];
  private resolved: Set<string> = new Set();

  log(error: AgentError): void {
    this.errors.push(error);
    
    // Console logging with severity
    const severity = this.getSeverity(error);
    const prefix = `[${severity.toUpperCase()}] [${error.context.component}]`;
    
    console.error(`${prefix} ${error.context.operation}: ${error.message}`);
    console.error(`  Code: ${error.code}`);
    console.error(`  Retryable: ${error.retryable}`);
    
    if (error.context.correlationId) {
      console.error(`  Correlation ID: ${error.context.correlationId}`);
    }
    
    if (error.originalError?.stack) {
      console.error(`  Original stack:`, error.originalError.stack);
    }
  }

  getErrors(): AgentError[] {
    return [...this.errors];
  }

  getUnresolved(): AgentError[] {
    return this.errors.filter(
      (e) => e.context.correlationId && !this.resolved.has(e.context.correlationId)
    );
  }

  resolve(correlationId: string): boolean {
    if (this.errors.some((e) => e.context.correlationId === correlationId)) {
      this.resolved.add(correlationId);
      return true;
    }
    return false;
  }

  private getSeverity(error: AgentError): 'low' | 'medium' | 'high' | 'critical' {
    // Critical errors that need immediate attention
    if (
      error.code === ERROR_CODES.LLM_API_ERROR ||
      error.code === ERROR_CODES.PIPELINE_CONTEXT_MISSING
    ) {
      return 'critical';
    }

    // High severity but potentially recoverable
    if (
      error.code === ERROR_CODES.LLM_RATE_LIMIT ||
      error.code === ERROR_CODES.MEMORY_STORAGE_FAILED
    ) {
      return 'high';
    }

    // Medium severity with retry potential
    if (error.retryable) {
      return 'medium';
    }

    return 'low';
  }
}

export const errorLogger = new ErrorLoggerImpl();

// ========================================
// Utility Functions
// ========================================

/**
 * Generate a correlation ID for request tracking
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if an error is a specific type
 */
export function isAgentError(error: unknown): error is AgentError {
  return error instanceof AgentError;
}

export function isLLMError(error: unknown): error is LLMError {
  return error instanceof LLMError;
}

export function isMemoryError(error: unknown): error is MemoryError {
  return error instanceof MemoryError;
}

/**
 * Extract user-friendly message from error
 */
export function getUserFriendlyMessage(error: AgentError): string {
  const messages: Record<ErrorCode, string> = {
    [ERROR_CODES.LLM_TIMEOUT]: 'The AI is taking longer than expected. Please try again.',
    [ERROR_CODES.LLM_RATE_LIMIT]: 'Too many requests. Please wait a moment and try again.',
    [ERROR_CODES.LLM_INVALID_RESPONSE]: 'The AI returned an unexpected response. Please try again.',
    [ERROR_CODES.LLM_API_ERROR]: 'There was an issue connecting to the AI service.',
    [ERROR_CODES.MEMORY_RETRIEVAL_FAILED]: 'Could not retrieve memories. Continuing without them.',
    [ERROR_CODES.MEMORY_STORAGE_FAILED]: 'Could not save this to memory.',
    [ERROR_CODES.EMBEDDING_FAILED]: 'Could not process the text for memory.',
    [ERROR_CODES.PERSONALITY_UPDATE_FAILED]: 'Could not update personality state.',
    [ERROR_CODES.MOOD_CALCULATION_FAILED]: 'Could not calculate mood changes.',
    [ERROR_CODES.PIPELINE_CONTEXT_MISSING]: 'Missing required context for processing.',
    [ERROR_CODES.PIPELINE_TIMEOUT]: 'The request took too long to process.',
    [ERROR_CODES.DOCUMENT_NOT_FOUND]: 'The document could not be found.',
    [ERROR_CODES.DOCUMENT_EDIT_FAILED]: 'Could not edit the document.',
    [ERROR_CODES.UNKNOWN_ERROR]: 'An unexpected error occurred.',
    [ERROR_CODES.VALIDATION_ERROR]: 'Invalid input provided.',
  };

  return messages[error.code] || 'Something went wrong. Please try again.';
}

export default {
  AgentError,
  LLMError,
  LLMTimeoutError,
  LLMRateLimitError,
  MemoryError,
  EmbeddingError,
  PersonalityError,
  PipelineError,
  DocumentError,
  createError,
  withRetry,
  wrapWithErrorHandling,
  errorLogger,
  generateCorrelationId,
  isAgentError,
  isLLMError,
  isMemoryError,
  getUserFriendlyMessage,
};
