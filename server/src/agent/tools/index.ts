/**
 * Unified Tool System
 * 
 * Central registry and executor for all Evelyn tools.
 * Handles tool registration, validation, and parallel execution.
 */

import type {
  ToolName,
  ToolExecutor,
  ToolContext,
  ToolResult,
  ParsedToolCall,
  UnifiedToolResponse,
  Artifact
} from './types.js';
import { parseToolCalls, hasToolCalls } from './toolParser.js';
import { TOOL_DEFINITIONS, generateToolPrompt, validateToolParams, getToolReliabilityConfig } from './toolDefinitions.js';
import { createToolFailureError, createCircuitBreakerError } from '../types/agenticTypes.js';

// Re-export types and utilities
export * from './types.js';
export * from './toolParser.js';
export * from './toolDefinitions.js';

// ========================================
// Circuit Breaker
// ========================================

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 60000; // 1 minute

class CircuitBreaker {
  private states: Map<ToolName, CircuitBreakerState> = new Map();

  isOpen(toolName: ToolName): boolean {
    const state = this.states.get(toolName);
    if (!state) return false;

    // Auto-reset after timeout
    if (state.isOpen && Date.now() - state.lastFailureTime > CIRCUIT_BREAKER_RESET_MS) {
      this.reset(toolName);
      return false;
    }

    return state.isOpen;
  }

  recordFailure(toolName: ToolName): void {
    const state = this.states.get(toolName) || { failures: 0, lastFailureTime: 0, isOpen: false };
    state.failures++;
    state.lastFailureTime = Date.now();

    if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      state.isOpen = true;
      console.warn(`[CircuitBreaker] ⚡ Circuit OPEN for ${toolName} after ${state.failures} failures`);
    }

    this.states.set(toolName, state);
  }

  recordSuccess(toolName: ToolName): void {
    // Reset on success
    this.states.delete(toolName);
  }

  reset(toolName: ToolName): void {
    this.states.delete(toolName);
    console.log(`[CircuitBreaker] 🔄 Circuit RESET for ${toolName}`);
  }

  getState(toolName: ToolName): CircuitBreakerState | undefined {
    return this.states.get(toolName);
  }
}

const circuitBreaker = new CircuitBreaker();

// ========================================
// Retry Utilities
// ========================================

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  toolName: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Tool ${toolName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

// ========================================
// Tool Registry
// ========================================

class ToolRegistry {
  private executors: Map<ToolName, ToolExecutor> = new Map();
  private executionHistory: Array<{
    toolName: ToolName;
    startTime: number;
    endTime?: number;
    success: boolean;
    error?: string;
  }> = [];

  /**
   * Register a tool executor
   */
  register<TParams, TResult>(executor: ToolExecutor<TParams, TResult>): void {
    if (!TOOL_DEFINITIONS[executor.toolName]) {
      throw new Error(`Cannot register executor for unknown tool: ${executor.toolName}`);
    }
    this.executors.set(executor.toolName, executor);
    console.log(`[ToolRegistry] ✅ Registered executor: ${executor.toolName}`);
  }

  /**
   * Get a tool executor
   */
  getExecutor(toolName: ToolName): ToolExecutor | undefined {
    return this.executors.get(toolName);
  }

  /**
   * Check if a tool has a registered executor
   */
  hasExecutor(toolName: ToolName): boolean {
    return this.executors.has(toolName);
  }

  /**
   * Get all registered tool names
   */
  getRegisteredTools(): ToolName[] {
    return Array.from(this.executors.keys());
  }

  /**
   * Execute a single tool with retry logic, timeout, and circuit breaker
   */
  async executeTool(
    toolName: ToolName,
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const executor = this.executors.get(toolName);
    const reliabilityConfig = getToolReliabilityConfig(toolName);

    // Check circuit breaker first
    if (circuitBreaker.isOpen(toolName)) {
      const state = circuitBreaker.getState(toolName);
      const error = createCircuitBreakerError(
        toolName,
        state?.failures || CIRCUIT_BREAKER_THRESHOLD,
        CIRCUIT_BREAKER_THRESHOLD,
        CIRCUIT_BREAKER_RESET_MS
      );
      console.warn(`[ToolRegistry] ⚡ Circuit breaker OPEN for ${toolName}, skipping execution`);
      return {
        toolName,
        status: 'error',
        summary: `Tool ${toolName} temporarily disabled due to repeated failures`,
        error: error.message,
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false,
        data: { agenticError: error }
      };
    }

    if (!executor) {
      return {
        toolName,
        status: 'error',
        summary: `No executor registered for tool: ${toolName}`,
        error: `Tool ${toolName} is not available`,
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false
      };
    }

    // Validate parameters
    const validation = executor.validate(params);
    if (!validation.valid) {
      return {
        toolName,
        status: 'error',
        summary: `Invalid parameters for ${toolName}`,
        error: validation.errors?.join(', '),
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false
      };
    }

    // Execute with retry logic
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < reliabilityConfig.maxRetries) {
      attempt++;
      const attemptStartTime = Date.now();

      try {
        console.log(`[ToolRegistry] 🔧 Executing: ${toolName} (attempt ${attempt}/${reliabilityConfig.maxRetries})`);

        // Execute with timeout
        const result = await withTimeout(
          executor.execute(params, context),
          reliabilityConfig.timeoutMs,
          toolName
        );

        // Success - record and return
        circuitBreaker.recordSuccess(toolName);
        this.executionHistory.push({
          toolName,
          startTime: attemptStartTime,
          endTime: Date.now(),
          success: result.status === 'success'
        });

        console.log(`[ToolRegistry] ✅ ${toolName} completed in ${result.executionTimeMs}ms`);
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        console.warn(
          `[ToolRegistry] ⚠️ ${toolName} attempt ${attempt} failed: ${lastError.message}` +
          (attempt < reliabilityConfig.maxRetries ? ` (will retry)` : ' (no more retries)')
        );

        this.executionHistory.push({
          toolName,
          startTime: attemptStartTime,
          endTime: Date.now(),
          success: false,
          error: lastError.message
        });

        // Record failure for circuit breaker
        circuitBreaker.recordFailure(toolName);

        // If we have more retries, wait before next attempt
        if (attempt < reliabilityConfig.maxRetries) {
          const backoffDelay = reliabilityConfig.retryDelayMs *
            Math.pow(reliabilityConfig.retryBackoffMultiplier, attempt - 1);
          console.log(`[ToolRegistry] ⏳ Waiting ${backoffDelay}ms before retry...`);
          await delay(backoffDelay);
        }
      }
    }

    // All retries exhausted
    const errorMsg = lastError?.message || 'Unknown error';
    const toolError = createToolFailureError(
      toolName,
      params,
      errorMsg,
      attempt,
      reliabilityConfig.maxRetries
    );

    console.error(`[ToolRegistry] ❌ ${toolName} failed after ${attempt} attempts: ${errorMsg}`);

    return {
      toolName,
      status: 'error',
      summary: `${toolName} failed after ${attempt} attempts`,
      error: errorMsg,
      executionTimeMs: Date.now() - startTime,
      needsFollowUp: false,
      data: { agenticError: toolError, attempts: attempt }
    };
  }

  /**
   * Execute multiple tools, parallelizing where possible
   */
  async executeTools(
    toolCalls: ParsedToolCall[],
    context: ToolContext
  ): Promise<ToolResult[]> {
    if (toolCalls.length === 0) {
      return [];
    }

    // Separate parallelizable and sequential tools
    const parallelizable: ParsedToolCall[] = [];
    const sequential: ParsedToolCall[] = [];

    for (const call of toolCalls) {
      const def = TOOL_DEFINITIONS[call.name];
      if (def?.parallelizable) {
        parallelizable.push(call);
      } else {
        sequential.push(call);
      }
    }

    const results: ToolResult[] = [];

    // Execute parallelizable tools concurrently
    if (parallelizable.length > 0) {
      console.log(`[ToolRegistry] ⚡ Executing ${parallelizable.length} tools in parallel`);
      const parallelResults = await Promise.all(
        parallelizable.map(call => this.executeTool(call.name, call.params, context))
      );
      results.push(...parallelResults);
    }

    // Execute sequential tools one by one
    for (const call of sequential) {
      const result = await this.executeTool(call.name, call.params, context);
      results.push(result);
      
      // Stop on critical errors for sequential tools
      if (result.status === 'error' && call.name === 'edit_document') {
        console.warn(`[ToolRegistry] ⚠️ Stopping sequential execution due to edit_document error`);
        break;
      }
    }

    return results;
  }

  /**
   * Get execution statistics
   */
  getStats(): {
    totalExecutions: number;
    successRate: number;
    avgExecutionTime: number;
    byTool: Record<string, { count: number; successRate: number }>;
  } {
    const total = this.executionHistory.length;
    const successful = this.executionHistory.filter(h => h.success).length;
    const totalTime = this.executionHistory.reduce(
      (sum, h) => sum + ((h.endTime || Date.now()) - h.startTime),
      0
    );

    const byTool: Record<string, { count: number; success: number }> = {};
    for (const h of this.executionHistory) {
      if (!byTool[h.toolName]) {
        byTool[h.toolName] = { count: 0, success: 0 };
      }
      byTool[h.toolName].count++;
      if (h.success) byTool[h.toolName].success++;
    }

    return {
      totalExecutions: total,
      successRate: total > 0 ? successful / total : 0,
      avgExecutionTime: total > 0 ? totalTime / total : 0,
      byTool: Object.fromEntries(
        Object.entries(byTool).map(([name, stats]) => [
          name,
          { count: stats.count, successRate: stats.success / stats.count }
        ])
      )
    };
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
  }
}

// Global registry instance
export const toolRegistry = new ToolRegistry();

// ========================================
// Unified Tool Handler
// ========================================

/**
 * Process an LLM response that may contain tool calls
 */
export async function processToolResponse(
  response: string,
  context: ToolContext
): Promise<UnifiedToolResponse> {
  const startTime = Date.now();
  
  // Parse tool calls from response
  const parseResult = parseToolCalls(response);
  
  if (parseResult.errors && parseResult.errors.length > 0) {
    console.warn('[Tools] Parse warnings:', parseResult.errors);
  }

  // If no tools, just return text response
  if (parseResult.toolCalls.length === 0) {
    return {
      response: parseResult.textResponse,
      toolResults: [],
      artifacts: [],
      documentChanges: [],
      complete: true,
      totalTimeMs: Date.now() - startTime
    };
  }

  console.log(`[Tools] Processing ${parseResult.toolCalls.length} tool calls`);

  // Execute tools
  const toolResults = await toolRegistry.executeTools(parseResult.toolCalls, context);

  // Extract artifacts and document changes from results
  const artifacts: Artifact[] = [];
  const documentChanges: Array<{ documentId: number; changesSummary: string; changesCount: number }> = [];

  for (const result of toolResults) {
    if (result.toolName === 'create_artifact' && result.status === 'success' && result.data) {
      artifacts.push(result.data as Artifact);
    }
    if (result.toolName === 'edit_document' && result.status === 'success' && result.data) {
      documentChanges.push(result.data);
    }
  }

  // Check if any tool needs follow-up
  const needsFollowUp = toolResults.some(r => r.needsFollowUp);

  return {
    response: parseResult.textResponse,
    toolResults,
    artifacts,
    documentChanges,
    complete: !needsFollowUp,
    totalTimeMs: Date.now() - startTime
  };
}

/**
 * Check if a response needs tool processing
 */
export function needsToolProcessing(response: string): boolean {
  return hasToolCalls(response);
}

/**
 * Execute an array of parsed tool calls
 */
export async function executeToolCalls(
  toolCalls: ParsedToolCall[],
  context: ToolContext
): Promise<UnifiedToolResponse> {
  const startTime = Date.now();
  
  if (toolCalls.length === 0) {
    return {
      response: '',
      toolResults: [],
      artifacts: [],
      documentChanges: [],
      complete: true,
      totalTimeMs: 0
    };
  }

  const toolResults = await toolRegistry.executeTools(toolCalls, context);

  // Extract artifacts and document changes
  const artifacts: Artifact[] = [];
  const documentChanges: Array<{ documentId: number; changesSummary: string; changesCount: number }> = [];

  for (const result of toolResults) {
    if (result.toolName === 'create_artifact' && result.status === 'success' && result.data) {
      artifacts.push(result.data as Artifact);
    }
    if (result.toolName === 'edit_document' && result.status === 'success' && result.data) {
      documentChanges.push(result.data);
    }
  }

  return {
    response: '',
    toolResults,
    artifacts,
    documentChanges,
    complete: true,
    totalTimeMs: Date.now() - startTime
  };
}

/**
 * Execute a single tool by name with params
 */
export async function executeTool(
  toolName: string,
  params: Record<string, any>,
  context: ToolContext
): Promise<ToolResult> {
  await initializeToolSystem();
  return toolRegistry.executeTool(toolName as any, params, context);
}

/**
 * Get the tool prompt section for system prompts
 */
export function getToolSystemPrompt(): string {
  return generateToolPrompt();
}

// ========================================
// Initialization
// ========================================

let initialized = false;

/**
 * Initialize the tool system with all executors
 * Call this once at server startup
 */
export async function initializeToolSystem(): Promise<void> {
  if (initialized) {
    console.log('[Tools] Already initialized');
    return;
  }

  console.log('[Tools] Initializing tool system...');

  // Import and register executors
  try {
    const executors = await import('./executors/index.js');
    
    toolRegistry.register(new executors.EditDocumentExecutor());
    toolRegistry.register(new executors.CreateArtifactExecutor());
    toolRegistry.register(new executors.UpdateArtifactExecutor());
    toolRegistry.register(new executors.UpdateArtifactFileExecutor());
    toolRegistry.register(new executors.AddArtifactFileExecutor());
    toolRegistry.register(new executors.DeleteArtifactFileExecutor());
    toolRegistry.register(new executors.WebSearchExecutor());
    toolRegistry.register(new executors.XSearchExecutor());
    toolRegistry.register(new executors.RunPythonExecutor());
    toolRegistry.register(new executors.BrowseUrlExecutor());
  } catch (e) {
    console.error('[Tools] Failed to load executors:', e);
  }

  const registered = toolRegistry.getRegisteredTools();
  console.log(`[Tools] ✅ Initialized with ${registered.length} tools: ${registered.join(', ')}`);
  
  initialized = true;
}
