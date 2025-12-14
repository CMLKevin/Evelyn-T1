/**
 * Run Python Executor
 * 
 * Executes Python code using Grok's code_execution capability.
 * Provides a secure REPL environment with common packages.
 */

import type { ToolExecutor, ToolContext, ToolResult, RunPythonParams } from '../types.js';
import { openRouterClient } from '../../../providers/openrouter.js';

export interface PythonExecutionResult {
  code: string;
  output: string;
  error?: string;
  executionSuccess: boolean;
}

export class RunPythonExecutor implements ToolExecutor<RunPythonParams, PythonExecutionResult> {
  toolName = 'run_python' as const;

  validate(params: RunPythonParams): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!params.code || typeof params.code !== 'string') {
      errors.push('code is required and must be a string');
    }

    if (params.code && params.code.length > 50000) {
      errors.push('code exceeds maximum length of 50,000 characters');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(params: RunPythonParams, context: ToolContext): Promise<ToolResult & { data?: PythonExecutionResult }> {
    const startTime = Date.now();
    const { code, showOutput = true } = params;

    try {
      console.log(`[RunPythonExecutor] 🐍 Executing Python code (${code.length} chars)`);

      // Use Grok's code_execution tool
      const messages = [
        {
          role: 'user' as const,
          content: `Execute this Python code and return the output:\n\n\`\`\`python\n${code}\n\`\`\`\n\nShow the complete output, including any printed values and the final result.`
        }
      ];

      const result = await openRouterClient.completeWithAgentTools(
        messages,
        { tools: [{ type: 'code_execution' }], tool_choice: 'auto' }
      );

      const output = result.content;
      
      // Check if execution had errors
      const hasError = output.toLowerCase().includes('error') || 
                       output.toLowerCase().includes('traceback') ||
                       output.toLowerCase().includes('exception');

      // Emit result to frontend
      if (context.socket && showOutput) {
        const socket = typeof context.socket === 'function' ? context.socket() : context.socket;
        if (socket) {
          socket.emit('tool:python_result', {
            correlationId: context.correlationId,
            code,
            output,
            success: !hasError
          });
        }
      }

      console.log(`[RunPythonExecutor] ✅ Execution complete (${hasError ? 'with errors' : 'success'})`);

      return {
        toolName: this.toolName,
        status: hasError ? 'partial' : 'success',
        data: {
          code,
          output,
          error: hasError ? output : undefined,
          executionSuccess: !hasError
        },
        summary: hasError ? 'Python execution completed with errors' : 'Python execution successful',
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: hasError
      };
    } catch (error) {
      console.error('[RunPythonExecutor] ❌ Error:', error);
      
      return {
        toolName: this.toolName,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: 'Python execution failed',
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false
      };
    }
  }
}
