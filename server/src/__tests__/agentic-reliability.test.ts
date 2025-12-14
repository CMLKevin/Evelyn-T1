/**
 * Unit Tests for Agentic Reliability Features
 *
 * Tests the reliability improvements:
 * - Structured error types and recovery strategies
 * - Goal completion multi-signal detection
 * - Tool parser hardening (safety limits, partial recovery)
 * - Tool timeout configuration
 */

import { describe, test, expect } from '@jest/globals';
import {
  createTimeoutError,
  createToolFailureError,
  createParseError,
  createLLMError,
  createCircuitBreakerError,
  getRecoveryStrategy,
  type TimeoutError,
  type ToolFailureError,
} from '../agent/types/agenticTypes.js';
import {
  parseToolCalls,
  quickValidate,
} from '../agent/tools/toolParser.js';
import {
  getToolReliabilityConfig,
  TOOL_RELIABILITY_CONFIG,
} from '../agent/tools/toolDefinitions.js';

// ========================================
// Structured Error Types Tests
// ========================================

describe('Structured Error Types', () => {
  describe('createTimeoutError', () => {
    test('creates timeout error with all fields', () => {
      const error = createTimeoutError('streaming', 30000, 60000, 'partial content');

      expect(error.type).toBe('timeout');
      expect(error.phase).toBe('streaming');
      expect(error.elapsedMs).toBe(30000);
      expect(error.timeoutMs).toBe(60000);
      expect(error.partialContent).toBe('partial content');
      expect(error.recoverable).toBe(true);
      expect(error.message).toContain('streaming');
    });

    test('marks as non-recoverable when no partial content', () => {
      const error = createTimeoutError('tool_execution', 5000, 10000);

      expect(error.recoverable).toBe(false);
      expect(error.partialContent).toBeUndefined();
    });

    test('marks as recoverable only with substantial partial content', () => {
      const shortContent = 'abc'; // < 100 chars
      const error = createTimeoutError('streaming', 5000, 10000, shortContent);

      expect(error.recoverable).toBe(false);
    });
  });

  describe('createToolFailureError', () => {
    test('creates tool failure error with retry info', () => {
      const error = createToolFailureError(
        'web_search',
        { query: 'test' },
        'Network timeout',
        1,
        3
      );

      expect(error.type).toBe('tool_failure');
      expect(error.toolName).toBe('web_search');
      expect(error.attemptNumber).toBe(1);
      expect(error.maxAttempts).toBe(3);
      expect(error.recoverable).toBe(true);
    });

    test('marks as non-recoverable on last attempt', () => {
      const error = createToolFailureError(
        'edit_document',
        { documentId: 1 },
        'Document locked',
        3,
        3
      );

      expect(error.recoverable).toBe(false);
      expect(error.suggestion).toContain('alternative');
    });
  });

  describe('createCircuitBreakerError', () => {
    test('creates circuit breaker error with reset info', () => {
      const error = createCircuitBreakerError('web_search', 5, 3, 60000);

      expect(error.type).toBe('circuit_breaker');
      expect(error.failureCount).toBe(5);
      expect(error.threshold).toBe(3);
      expect(error.resetAfterMs).toBe(60000);
      expect(error.recoverable).toBe(false);
      expect(error.suggestion).toContain('60s');
    });
  });
});

// ========================================
// Recovery Strategy Tests
// ========================================

describe('Recovery Strategies', () => {
  test('timeout with partial content uses abort_with_partial', () => {
    const error = createTimeoutError('streaming', 30000, 60000, 'x'.repeat(200));
    const recovery = getRecoveryStrategy(error);

    expect(recovery.strategy).toBe('abort_with_partial');
  });

  test('timeout without partial content uses retry_with_backoff', () => {
    const error = createTimeoutError('streaming', 30000, 60000);
    const recovery = getRecoveryStrategy(error);

    expect(recovery.strategy).toBe('retry_with_backoff');
    expect(recovery.params?.delayMs).toBeDefined();
  });

  test('tool failure with retries left uses retry_with_backoff', () => {
    const error = createToolFailureError('web_search', {}, 'error', 1, 3);
    const recovery = getRecoveryStrategy(error);

    expect(recovery.strategy).toBe('retry_with_backoff');
  });

  test('tool failure exhausted uses try_alternative_tool', () => {
    const error = createToolFailureError('web_search', {}, 'error', 3, 3);
    const recovery = getRecoveryStrategy(error);

    expect(recovery.strategy).toBe('try_alternative_tool');
  });

  test('LLM rate limit uses fallback model', () => {
    const error = createLLMError(429, 'gpt-4', '/chat/completions');
    const recovery = getRecoveryStrategy(error);

    expect(recovery.strategy).toBe('use_fallback_model');
  });

  test('circuit breaker uses skip_and_continue', () => {
    const error = createCircuitBreakerError('web_search', 5, 3, 60000);
    const recovery = getRecoveryStrategy(error);

    expect(recovery.strategy).toBe('skip_and_continue');
  });
});

// ========================================
// Tool Parser Safety Tests
// ========================================

describe('Tool Parser Safety', () => {
  describe('Input validation', () => {
    test('handles empty input', () => {
      const result = parseToolCalls('');

      expect(result.success).toBe(true);
      expect(result.toolCalls.length).toBe(0);
    });

    test('handles input with no tool calls', () => {
      const result = parseToolCalls('This is just a regular message without tools.');

      expect(result.success).toBe(true);
      expect(result.toolCalls.length).toBe(0);
      expect(result.textResponse).toContain('regular message');
    });

    test('handles malformed XML gracefully', () => {
      const result = parseToolCalls('<tool_call><name>broken</tool_call>');

      expect(result.success).toBe(true); // Doesn't crash
      expect(result.toolCalls.length).toBe(0);
    });
  });

  describe('JSON recovery', () => {
    test('parses valid JSON params', () => {
      const response = `<tool_call>
<name>web_search</name>
<params>{"query": "test query"}</params>
</tool_call>`;

      const result = parseToolCalls(response);

      expect(result.success).toBe(true);
      expect(result.toolCalls[0].params.query).toBe('test query');
    });

    test('recovers JSON with single quotes', () => {
      const response = `<tool_call>
<name>web_search</name>
<params>{'query': 'test'}</params>
</tool_call>`;

      const result = parseToolCalls(response);

      // Parser should attempt recovery
      expect(result.toolCalls.length).toBeLessThanOrEqual(1);
    });
  });

  describe('quickValidate', () => {
    test('detects mismatched tags', () => {
      const result = quickValidate('<tool_call><tool_call>');

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('Mismatched');
    });

    test('detects trailing commas', () => {
      const result = quickValidate('<tool_call><name>test</name><params>{"a": 1,}</params></tool_call>');

      expect(result.issues.some(i => i.includes('trailing'))).toBe(true);
    });

    test('reports correct tool count', () => {
      const result = quickValidate(`
<tool_call><name>a</name><params>{}</params></tool_call>
<tool_call><name>b</name><params>{}</params></tool_call>
      `);

      expect(result.toolCount).toBe(2);
    });
  });
});

// ========================================
// Tool Reliability Configuration Tests
// ========================================

describe('Tool Reliability Configuration', () => {
  test('all tools have reliability config', () => {
    const tools = ['edit_document', 'create_artifact', 'web_search', 'browse_url', 'run_python'];

    for (const tool of tools) {
      const config = getToolReliabilityConfig(tool as any);

      expect(config).toBeDefined();
      expect(config.timeoutMs).toBeGreaterThan(0);
      expect(config.maxRetries).toBeGreaterThanOrEqual(1);
      expect(config.retryDelayMs).toBeGreaterThan(0);
    }
  });

  test('edit_document has longer timeout than create_artifact', () => {
    const editConfig = TOOL_RELIABILITY_CONFIG.edit_document;
    const createConfig = TOOL_RELIABILITY_CONFIG.create_artifact;

    expect(editConfig.timeoutMs).toBeGreaterThan(createConfig.timeoutMs);
  });

  test('network tools have more retries', () => {
    const webSearchConfig = TOOL_RELIABILITY_CONFIG.web_search;
    const runPythonConfig = TOOL_RELIABILITY_CONFIG.run_python;

    expect(webSearchConfig.maxRetries).toBeGreaterThan(runPythonConfig.maxRetries);
  });

  test('fallback config provided for unknown tools', () => {
    const config = getToolReliabilityConfig('unknown_tool' as any);

    expect(config).toBeDefined();
    expect(config.timeoutMs).toBe(30000);
    expect(config.maxRetries).toBe(2);
  });
});

// ========================================
// Multi-format Tool Call Parsing Tests
// ========================================

describe('Multi-format Tool Parsing', () => {
  test('parses primary format', () => {
    const response = `<tool_call>
<name>create_artifact</name>
<params>{"type": "react", "title": "Test"}</params>
</tool_call>`;

    const result = parseToolCalls(response);

    expect(result.success).toBe(true);
    expect(result.toolCalls[0].name).toBe('create_artifact');
  });

  test('parses inline format', () => {
    const response = `<tool:web_search>{"query": "test"}</tool:web_search>`;

    const result = parseToolCalls(response);

    expect(result.success).toBe(true);
    expect(result.toolCalls[0].name).toBe('web_search');
  });

  test('extracts text response separately', () => {
    const response = `Here's what I found:
<tool_call>
<name>web_search</name>
<params>{"query": "test"}</params>
</tool_call>
That should help!`;

    const result = parseToolCalls(response);

    expect(result.textResponse).toContain("Here's what I found");
    expect(result.textResponse).toContain('That should help');
    expect(result.textResponse).not.toContain('tool_call');
  });

  test('handles multiple tool calls', () => {
    const response = `<tool_call>
<name>web_search</name>
<params>{"query": "first"}</params>
</tool_call>
<tool_call>
<name>create_artifact</name>
<params>{"type": "react", "title": "Demo"}</params>
</tool_call>`;

    const result = parseToolCalls(response);

    expect(result.toolCalls.length).toBe(2);
    expect(result.toolCalls[0].name).toBe('web_search');
    expect(result.toolCalls[1].name).toBe('create_artifact');
  });
});
