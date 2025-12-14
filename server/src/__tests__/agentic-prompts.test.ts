/**
 * Unit Tests for Agentic Prompts V2
 * Tests prompt generation for different complexities, document windowing, and utilities
 */

import { describe, test, expect } from '@jest/globals';
import {
  buildTrivialEditPrompt,
  buildSimpleEditPrompt,
  buildComplexEditPrompt,
  buildIterationPrompt,
  createDocumentWindow,
  createDiffSummary,
  estimateComplexity,
  estimateTokens,
  isWithinTokenBudget,
  type OptimizedContext,
  type EditGoal,
  type IterationState,
} from '../agent/agenticPromptsV2.js';

// ========================================
// Test Fixtures
// ========================================

const mockDoc: OptimizedContext = {
  documentId: 1,
  title: 'test.ts',
  content: 'const x = 1;\nfunction hello() {\n  return "world";\n}',
  language: 'typescript',
  contentType: 'code',
  totalLines: 4,
  totalChars: 50,
};

const mockGoal: EditGoal = {
  goal: 'Add error handling to the function',
  approach: 'wrap in try-catch',
  complexity: 'simple',
  estimatedChanges: 2,
};

// ========================================
// Prompt Generation Tests
// ========================================

describe('buildTrivialEditPrompt()', () => {
  test('includes goal in prompt', () => {
    const prompt = buildTrivialEditPrompt(mockGoal, mockDoc);
    expect(prompt).toContain(mockGoal.goal);
  });

  test('includes document title', () => {
    const prompt = buildTrivialEditPrompt(mockGoal, mockDoc);
    expect(prompt).toContain(mockDoc.title);
  });

  test('includes document content', () => {
    const prompt = buildTrivialEditPrompt(mockGoal, mockDoc);
    expect(prompt).toContain('const x = 1');
  });

  test('includes write_to_file tool instruction', () => {
    const prompt = buildTrivialEditPrompt(mockGoal, mockDoc);
    expect(prompt).toContain('write_to_file');
  });

  test('emphasizes tool requirement', () => {
    const prompt = buildTrivialEditPrompt(mockGoal, mockDoc);
    expect(prompt.toLowerCase()).toContain('must');
  });

  test('includes language hint in code block', () => {
    const prompt = buildTrivialEditPrompt(mockGoal, mockDoc);
    expect(prompt).toContain('typescript');
  });
});

describe('buildSimpleEditPrompt()', () => {
  test('includes goal and document info', () => {
    const window = createDocumentWindow(mockDoc.content);
    const prompt = buildSimpleEditPrompt(mockGoal, mockDoc, window);
    
    expect(prompt).toContain(mockGoal.goal);
    expect(prompt).toContain(mockDoc.title);
  });

  test('includes both tool options', () => {
    const window = createDocumentWindow(mockDoc.content);
    const prompt = buildSimpleEditPrompt(mockGoal, mockDoc, window);
    
    expect(prompt).toContain('write_to_file');
    expect(prompt).toContain('replace_in_file');
  });

  test('includes workflow instructions', () => {
    const window = createDocumentWindow(mockDoc.content);
    const prompt = buildSimpleEditPrompt(mockGoal, mockDoc, window);
    
    expect(prompt).toContain('WORKFLOW');
  });

  test('shows line range for large documents', () => {
    const largeContent = Array(200).fill('line').join('\n');
    const largeDoc = { ...mockDoc, content: largeContent, totalLines: 200 };
    const window = createDocumentWindow(largeContent);
    const prompt = buildSimpleEditPrompt(mockGoal, largeDoc, window);
    
    // Should mention lines if truncated
    if (window.hasMore.before || window.hasMore.after) {
      expect(prompt).toMatch(/lines?|L\d+/i);
    }
  });
});

describe('buildComplexEditPrompt()', () => {
  test('includes structured thought template', () => {
    const window = createDocumentWindow(mockDoc.content);
    const complexGoal = { ...mockGoal, complexity: 'complex' as const };
    const prompt = buildComplexEditPrompt(complexGoal, mockDoc, window);
    
    expect(prompt).toContain('<thought>');
    expect(prompt).toContain('<observe>');
    expect(prompt).toContain('<plan>');
  });

  test('includes goal prominently', () => {
    const window = createDocumentWindow(mockDoc.content);
    const prompt = buildComplexEditPrompt(mockGoal, mockDoc, window);
    
    expect(prompt).toContain('GOAL');
    expect(prompt).toContain(mockGoal.goal.slice(0, 30));
  });

  test('emphasizes tool requirement', () => {
    const window = createDocumentWindow(mockDoc.content);
    const prompt = buildComplexEditPrompt(mockGoal, mockDoc, window);
    
    expect(prompt).toContain('MUST');
  });
});

describe('buildIterationPrompt()', () => {
  test('includes iteration progress', () => {
    const state: IterationState = {
      iteration: 2,
      maxIterations: 5,
      changesApplied: 1,
      lastToolUsed: 'write_to_file',
      lastToolResult: { success: true, message: 'File written' },
      currentContent: mockDoc.content,
      originalContent: mockDoc.content,
    };
    const window = createDocumentWindow(mockDoc.content);
    
    const prompt = buildIterationPrompt(state, window, mockGoal.goal);
    
    // Prompt shows iteration number and max iterations
    expect(prompt).toContain('5'); // max iterations
    expect(prompt).toMatch(/ITERATION|iteration|\d+\/5/); // iteration info
  });

  test('includes previous result info', () => {
    const state: IterationState = {
      iteration: 2,
      maxIterations: 5,
      changesApplied: 1,
      lastToolUsed: 'replace_in_file',
      lastToolResult: { success: true, message: 'Replaced' },
      currentContent: mockDoc.content,
      originalContent: mockDoc.content,
    };
    const window = createDocumentWindow(mockDoc.content);
    
    const prompt = buildIterationPrompt(state, window, mockGoal.goal);
    
    // Should reference previous action
    expect(prompt.toLowerCase()).toMatch(/replace|previous|last/);
  });
});

// ========================================
// Document Window Tests
// ========================================

describe('createDocumentWindow()', () => {
  test('returns full content for small documents', () => {
    const content = 'line1\nline2\nline3';
    const window = createDocumentWindow(content);
    
    expect(window.content).toBe(content);
    expect(window.hasMore.before).toBe(false);
    expect(window.hasMore.after).toBe(false);
  });

  test('truncates large documents', () => {
    const lines = Array(200).fill('line content here').join('\n');
    const window = createDocumentWindow(lines);
    
    expect(window.content.split('\n').length).toBeLessThan(200);
    expect(window.hasMore.before || window.hasMore.after).toBe(true);
  });

  test('sets correct start and end lines', () => {
    const lines = Array(50).fill(0).map((_, i) => `line ${i}`).join('\n');
    const window = createDocumentWindow(lines);
    
    expect(window.startLine).toBeGreaterThanOrEqual(1);
    expect(window.endLine).toBeLessThanOrEqual(50);
  });

  test('focuses on target pattern', () => {
    const content = 'header\nheader\nTARGET_LINE\nfooter\nfooter';
    const window = createDocumentWindow(content, 'TARGET_LINE');
    
    expect(window.content).toContain('TARGET_LINE');
  });

  test('focuses on target line range', () => {
    const lines = Array(100).fill(0).map((_, i) => `line ${i}`).join('\n');
    const window = createDocumentWindow(lines, undefined, { start: 40, end: 50 });
    
    expect(window.startLine).toBeLessThanOrEqual(40);
    expect(window.endLine).toBeGreaterThanOrEqual(50);
  });
});

// ========================================
// Complexity Estimation Tests
// ========================================

describe('estimateComplexity()', () => {
  test('trivial for simple typo fix', () => {
    const result = estimateComplexity('fix typo', 'const x = 1;');
    expect(['trivial', 'simple']).toContain(result);
  });

  test('higher complexity for large content', () => {
    const largeContent = 'x'.repeat(10000);
    const result = estimateComplexity('refactor everything', largeContent);
    expect(['moderate', 'complex']).toContain(result);
  });

  test('higher complexity for complex goals', () => {
    const simple = estimateComplexity('add comment', 'code');
    const complex = estimateComplexity('rewrite all modules with new architecture', 'code');
    
    const levels = ['trivial', 'simple', 'moderate', 'complex'];
    expect(levels.indexOf(complex)).toBeGreaterThanOrEqual(levels.indexOf(simple));
  });

  test('returns valid complexity level', () => {
    const result = estimateComplexity('some goal', 'some content');
    expect(['trivial', 'simple', 'moderate', 'complex']).toContain(result);
  });
});

// ========================================
// Token Utilities Tests
// ========================================

describe('estimateTokens()', () => {
  test('returns positive number for text', () => {
    const tokens = estimateTokens('Hello world');
    expect(tokens).toBeGreaterThan(0);
  });

  test('returns 0 for empty string', () => {
    const tokens = estimateTokens('');
    expect(tokens).toBe(0);
  });

  test('scales with content length', () => {
    const short = estimateTokens('hello');
    const long = estimateTokens('hello '.repeat(100));
    expect(long).toBeGreaterThan(short);
  });

  test('reasonable estimate for code', () => {
    const code = 'function test() { return 42; }';
    const tokens = estimateTokens(code);
    // Rough estimate: ~1 token per 4 chars
    expect(tokens).toBeGreaterThan(5);
    expect(tokens).toBeLessThan(50);
  });
});

describe('isWithinTokenBudget()', () => {
  test('returns true for small content', () => {
    expect(isWithinTokenBudget('small', 1000)).toBe(true);
  });

  test('returns false for large content', () => {
    const large = 'word '.repeat(10000);
    expect(isWithinTokenBudget(large, 100)).toBe(false);
  });

  test('handles edge case at budget limit', () => {
    // Test near the boundary
    const content = 'word '.repeat(100);
    const tokens = estimateTokens(content);
    expect(isWithinTokenBudget(content, tokens + 10)).toBe(true);
    expect(isWithinTokenBudget(content, Math.max(1, tokens - 10))).toBe(false);
  });
});

// ========================================
// Diff Summary Tests
// ========================================

describe('createDiffSummary()', () => {
  test('shows additions', () => {
    const summary = createDiffSummary('a', 'a\nb\nc');
    expect(summary).toContain('+');
  });

  test('shows deletions', () => {
    const summary = createDiffSummary('a\nb\nc', 'a');
    expect(summary).toContain('-');
  });

  test('handles no changes', () => {
    const summary = createDiffSummary('same', 'same');
    expect(summary).toContain('0');
  });

  test('handles complete replacement', () => {
    const summary = createDiffSummary('old content', 'new content');
    expect(summary).toBeTruthy();
  });
});
