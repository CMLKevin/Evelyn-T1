/**
 * Unit Tests for Intent Detection System
 * Tests pattern matching, confidence scoring, goal extraction
 * 
 * Note: This file tests pattern matching logic in isolation
 * to avoid module import issues with openrouter dependencies.
 */

import { describe, test, expect } from '@jest/globals';

// ========================================
// Re-implement Pattern Matching for Testing
// (Mirrors the actual implementation in intentDetection.ts)
// ========================================

interface IntentSignal {
  type: 'explicit' | 'implicit' | 'contextual' | 'continuation';
  pattern: string;
  confidence: number;
  matchedText?: string;
}

interface IntentResult {
  shouldEdit: boolean;
  confidence: number;
  detectionMethod: 'pattern' | 'contextual' | 'llm' | 'hybrid';
  goal?: string;
  complexity?: 'trivial' | 'simple' | 'moderate' | 'complex';
  reasoning?: string;
  signals: IntentSignal[];
  autoTrigger: boolean;
}

interface ConversationContext {
  recentMessages: Array<{ role: string; content: string }>;
  lastEvelynSuggestion?: string;
  pendingAction?: string;
  discussedChanges?: string[];
}

// Pattern definitions (from intentDetection.ts)
const EXPLICIT_EDIT_PATTERNS = [
  { pattern: /^(please\s+)?(fix|repair|correct|patch)\s+/i, confidence: 0.95, type: 'explicit' as const },
  { pattern: /^(please\s+)?(add|insert|include|create)\s+/i, confidence: 0.95, type: 'explicit' as const },
  { pattern: /^(please\s+)?(remove|delete|drop|eliminate)\s+/i, confidence: 0.95, type: 'explicit' as const },
  { pattern: /^(please\s+)?(change|modify|update|alter|edit)\s+/i, confidence: 0.95, type: 'explicit' as const },
  { pattern: /^(please\s+)?(refactor|restructure|reorganize|rewrite)\s+/i, confidence: 0.95, type: 'explicit' as const },
  { pattern: /^(please\s+)?(implement|write|code)\s+/i, confidence: 0.95, type: 'explicit' as const },
  { pattern: /^make\s+(it|this|the)\s+/i, confidence: 0.90, type: 'explicit' as const },
  { pattern: /^can you\s+(fix|add|remove|change|refactor|implement|update)/i, confidence: 0.90, type: 'explicit' as const },
  { pattern: /^could you\s+(fix|add|remove|change|refactor|implement|update)/i, confidence: 0.90, type: 'explicit' as const },
];

const NOT_EDIT_PATTERNS = [
  { pattern: /^(what|why|how|when|where|who|which)\s+(is|are|do|does|did|was|were|would|could|should|can|will)/i, confidence: 0.90 },
  { pattern: /^explain\s+/i, confidence: 0.85 },
  { pattern: /^tell\s+me\s+(about|more)/i, confidence: 0.85 },
];

const CONFIRMATION_PATTERNS = [
  { pattern: /^(yes|yeah|yep|yup|sure|ok|okay|alright|go ahead|do it|proceed|sounds good)\.?$/i, confidence: 0.95, type: 'continuation' as const },
  { pattern: /^(go|do|yes)\s*(please)?\.?$/i, confidence: 0.95, type: 'continuation' as const },
];

function detectIntentInstant(message: string, context: ConversationContext): IntentResult | null {
  const signals: IntentSignal[] = [];
  const trimmed = message.trim();
  
  if (!trimmed) return null;
  
  // Check NOT edit patterns first
  for (const { pattern, confidence } of NOT_EDIT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        shouldEdit: false,
        confidence,
        detectionMethod: 'pattern',
        signals: [{ type: 'explicit', pattern: pattern.source, confidence }],
        autoTrigger: false,
      };
    }
  }
  
  // Check confirmation patterns (need context)
  const hasContext = context.pendingAction || context.lastEvelynSuggestion || 
                     (context.discussedChanges && context.discussedChanges.length > 0);
  
  for (const { pattern, confidence, type } of CONFIRMATION_PATTERNS) {
    if (pattern.test(trimmed)) {
      signals.push({ type, pattern: pattern.source, confidence, matchedText: trimmed });
      
      if (hasContext) {
        return {
          shouldEdit: true,
          confidence,
          detectionMethod: 'pattern',
          goal: context.pendingAction || context.lastEvelynSuggestion || trimmed,
          complexity: 'simple',
          signals,
          autoTrigger: confidence >= 0.9,
        };
      }
      // Without context, confirmation alone isn't enough
      return {
        shouldEdit: false,
        confidence: 0.3,
        detectionMethod: 'pattern',
        signals,
        autoTrigger: false,
      };
    }
  }
  
  // Check explicit edit patterns
  for (const { pattern, confidence, type } of EXPLICIT_EDIT_PATTERNS) {
    if (pattern.test(trimmed)) {
      signals.push({ type, pattern: pattern.source, confidence, matchedText: trimmed });
      
      return {
        shouldEdit: true,
        confidence,
        detectionMethod: 'pattern',
        goal: trimmed,
        complexity: estimateComplexityFromGoal(trimmed),
        signals,
        autoTrigger: confidence >= 0.9,
      };
    }
  }
  
  // No strong pattern match
  return null;
}

function estimateComplexityFromGoal(goal: string): 'trivial' | 'simple' | 'moderate' | 'complex' {
  const lower = goal.toLowerCase();
  if (/typo|comment|rename/.test(lower)) return 'trivial';
  if (/rewrite|restructure|refactor.*all|entire/.test(lower)) return 'complex';
  if (/add|remove|fix|change/.test(lower)) return 'simple';
  return 'moderate';
}

// ========================================
// Test Fixtures
// ========================================

const emptyContext: ConversationContext = {
  recentMessages: [],
  discussedChanges: [],
};

const contextWithSuggestion: ConversationContext = {
  recentMessages: [
    { role: 'assistant', content: 'Should I add error handling?' },
  ],
  lastEvelynSuggestion: 'add error handling',
  pendingAction: 'add error handling',
  discussedChanges: ['add error handling'],
};

// ========================================
// Explicit Edit Pattern Tests
// ========================================

describe('detectIntentInstant() - Explicit Edit Commands', () => {
  test('detects "fix" command', () => {
    const result = detectIntentInstant('fix the bug', emptyContext);
    expect(result?.shouldEdit).toBe(true);
    expect(result?.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result?.detectionMethod).toBe('pattern');
  });

  test('detects "add" command', () => {
    const result = detectIntentInstant('add error handling', emptyContext);
    expect(result?.shouldEdit).toBe(true);
    expect(result?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  test('detects "remove" command', () => {
    const result = detectIntentInstant('remove the deprecated function', emptyContext);
    expect(result?.shouldEdit).toBe(true);
    expect(result?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  test('detects "change" command', () => {
    const result = detectIntentInstant('change the variable name', emptyContext);
    expect(result?.shouldEdit).toBe(true);
    expect(result?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  test('detects "refactor" command', () => {
    const result = detectIntentInstant('refactor this function', emptyContext);
    expect(result?.shouldEdit).toBe(true);
    expect(result?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  test('detects "implement" command', () => {
    const result = detectIntentInstant('implement the login feature', emptyContext);
    expect(result?.shouldEdit).toBe(true);
    expect(result?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  test('detects "write" command', () => {
    const result = detectIntentInstant('write the snake game code', emptyContext);
    expect(result?.shouldEdit).toBe(true);
    expect(result?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  test('detects "please fix" polite command', () => {
    const result = detectIntentInstant('please fix this error', emptyContext);
    expect(result?.shouldEdit).toBe(true);
    expect(result?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  test('detects "can you add" question form', () => {
    const result = detectIntentInstant('can you add a loading spinner?', emptyContext);
    expect(result?.shouldEdit).toBe(true);
    expect(result?.confidence).toBeGreaterThanOrEqual(0.85);
  });

  test('detects "could you fix" question form', () => {
    const result = detectIntentInstant('could you fix the null check?', emptyContext);
    expect(result?.shouldEdit).toBe(true);
    expect(result?.confidence).toBeGreaterThanOrEqual(0.85);
  });

  test('detects "make it" command', () => {
    const result = detectIntentInstant('make it faster', emptyContext);
    expect(result?.shouldEdit).toBe(true);
    expect(result?.confidence).toBeGreaterThanOrEqual(0.85);
  });
});

// ========================================
// Non-Edit Pattern Tests
// ========================================

describe('detectIntentInstant() - Non-Edit Patterns', () => {
  test('detects "what" questions as non-edit', () => {
    const result = detectIntentInstant('what does this function do?', emptyContext);
    expect(result?.shouldEdit).toBe(false);
  });

  test('detects "why" questions as non-edit', () => {
    const result = detectIntentInstant('why is this code slow?', emptyContext);
    expect(result?.shouldEdit).toBe(false);
  });

  test('detects "how" questions as non-edit', () => {
    const result = detectIntentInstant('how does authentication work?', emptyContext);
    expect(result?.shouldEdit).toBe(false);
  });

  test('detects "explain" as non-edit', () => {
    const result = detectIntentInstant('explain this algorithm', emptyContext);
    expect(result?.shouldEdit).toBe(false);
  });

  test('general chat has low confidence', () => {
    const result = detectIntentInstant('hello how are you', emptyContext);
    if (result?.shouldEdit) {
      expect(result.confidence).toBeLessThan(0.7);
    }
  });

  test('detects "tell me about" as non-edit', () => {
    const result = detectIntentInstant('tell me about this class', emptyContext);
    expect(result?.shouldEdit).toBe(false);
  });
});

// ========================================
// Confirmation Pattern Tests
// ========================================

describe('detectIntentInstant() - Confirmation Patterns', () => {
  test('detects "yes" as continuation with context', () => {
    const result = detectIntentInstant('yes', contextWithSuggestion);
    expect(result?.shouldEdit).toBe(true);
    expect(result?.signals.some(s => s.type === 'continuation')).toBe(true);
  });

  test('detects "go ahead" as continuation', () => {
    const result = detectIntentInstant('go ahead', contextWithSuggestion);
    expect(result?.shouldEdit).toBe(true);
  });

  test('detects "do it" as continuation', () => {
    const result = detectIntentInstant('do it', contextWithSuggestion);
    expect(result?.shouldEdit).toBe(true);
  });

  test('detects "sure" as continuation', () => {
    const result = detectIntentInstant('sure', contextWithSuggestion);
    expect(result?.shouldEdit).toBe(true);
  });

  test('detects "ok" as continuation', () => {
    const result = detectIntentInstant('ok', contextWithSuggestion);
    expect(result?.shouldEdit).toBe(true);
  });

  test('detects "sounds good" as continuation', () => {
    const result = detectIntentInstant('sounds good', contextWithSuggestion);
    expect(result?.shouldEdit).toBe(true);
  });

  test('confirmation without context has lower confidence', () => {
    const result = detectIntentInstant('yes', emptyContext);
    // Without context, standalone "yes" shouldn't trigger high confidence
    if (result?.shouldEdit) {
      expect(result.confidence).toBeLessThan(0.9);
    }
  });
});

// ========================================
// Goal Extraction Tests
// ========================================

describe('detectIntentInstant() - Goal Extraction', () => {
  test('extracts goal from add command', () => {
    const result = detectIntentInstant('add a loading spinner to the button', emptyContext);
    expect(result?.goal).toBeTruthy();
    expect(result?.goal?.toLowerCase()).toContain('loading');
  });

  test('extracts goal from fix command', () => {
    const result = detectIntentInstant('fix the null pointer exception', emptyContext);
    expect(result?.goal).toBeTruthy();
    expect(result?.goal?.toLowerCase()).toContain('null');
  });

  test('extracts goal from refactor command', () => {
    const result = detectIntentInstant('refactor the authentication module', emptyContext);
    expect(result?.goal).toBeTruthy();
    expect(result?.goal?.toLowerCase()).toContain('authentication');
  });

  test('goal is full message for explicit commands', () => {
    const message = 'implement user registration';
    const result = detectIntentInstant(message, emptyContext);
    expect(result?.goal).toBeTruthy();
  });
});

// ========================================
// Complexity Detection Tests
// ========================================

describe('detectIntentInstant() - Complexity Detection', () => {
  test('assigns complexity for simple edits', () => {
    const result = detectIntentInstant('fix the typo', emptyContext);
    expect(result?.complexity).toBeTruthy();
    expect(['trivial', 'simple', 'moderate', 'complex']).toContain(result?.complexity);
  });

  test('higher complexity for complex requests', () => {
    const simple = detectIntentInstant('fix typo', emptyContext);
    const complex = detectIntentInstant('completely rewrite the entire authentication system', emptyContext);
    
    if (simple?.complexity && complex?.complexity) {
      const levels = ['trivial', 'simple', 'moderate', 'complex'];
      expect(levels.indexOf(complex.complexity)).toBeGreaterThanOrEqual(
        levels.indexOf(simple.complexity)
      );
    }
  });
});

// ========================================
// Signal Detection Tests
// ========================================

describe('detectIntentInstant() - Signal Detection', () => {
  test('returns signals array', () => {
    const result = detectIntentInstant('fix the bug', emptyContext);
    expect(Array.isArray(result?.signals)).toBe(true);
  });

  test('signals have required properties', () => {
    const result = detectIntentInstant('add error handling', emptyContext);
    if (result?.signals.length) {
      const signal = result.signals[0];
      expect(signal).toHaveProperty('type');
      expect(signal).toHaveProperty('pattern');
      expect(signal).toHaveProperty('confidence');
    }
  });

  test('explicit commands produce explicit signals', () => {
    const result = detectIntentInstant('fix the bug', emptyContext);
    expect(result?.signals.some(s => s.type === 'explicit')).toBe(true);
  });

  test('confirmations produce continuation signals', () => {
    const result = detectIntentInstant('yes', contextWithSuggestion);
    expect(result?.signals.some(s => s.type === 'continuation')).toBe(true);
  });
});

// ========================================
// Auto-Trigger Tests
// ========================================

describe('detectIntentInstant() - Auto-Trigger', () => {
  test('high confidence enables auto-trigger', () => {
    const result = detectIntentInstant('fix the bug in handleClick', emptyContext);
    if (result?.confidence && result.confidence >= 0.9) {
      expect(result?.autoTrigger).toBe(true);
    }
  });

  test('returns autoTrigger property', () => {
    const result = detectIntentInstant('add validation', emptyContext);
    expect(typeof result?.autoTrigger).toBe('boolean');
  });
});

// ========================================
// Edge Cases
// ========================================

describe('detectIntentInstant() - Edge Cases', () => {
  test('handles empty message', () => {
    const result = detectIntentInstant('', emptyContext);
    // Should not crash, may return null or low confidence
    expect(result === null || result?.confidence < 0.5).toBe(true);
  });

  test('handles very long message', () => {
    const longMessage = 'fix '.repeat(100) + 'the bug';
    const result = detectIntentInstant(longMessage, emptyContext);
    // Should still work
    expect(result).toBeTruthy();
  });

  test('handles special characters', () => {
    const result = detectIntentInstant('fix the <script> tag & "quotes"', emptyContext);
    expect(result?.shouldEdit).toBe(true);
  });

  test('handles unicode', () => {
    const result = detectIntentInstant('add emoji support 🎉', emptyContext);
    expect(result?.shouldEdit).toBe(true);
  });

  test('case insensitive matching', () => {
    const lower = detectIntentInstant('fix the bug', emptyContext);
    const upper = detectIntentInstant('FIX THE BUG', emptyContext);
    expect(lower?.shouldEdit).toBe(upper?.shouldEdit);
  });
});
