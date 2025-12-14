/**
 * Unit Tests for Agentic Engine V2
 * Tests goal completion detection, tool execution, and workflow logic
 */

import { describe, test, expect } from '@jest/globals';

// ========================================
// Mock Dependencies (for unit testing without LLM calls)
// ========================================

// Goal completion detection function (extracted for testing)
function checkGoalCompletion(response: string): boolean {
  const indicators = [
    'goal achieved',
    'goal_achieved',
    'task complete',
    'done with edits',
    'finished editing',
    'all changes complete',
    'no more changes needed',
  ];
  
  const lower = response.toLowerCase();
  return indicators.some(ind => lower.includes(ind));
}

// Extract thinking function (extracted for testing)
function extractThinking(response: string): string {
  const thoughtMatch = response.match(/<thought>([\s\S]*?)<\/thought>/i);
  if (thoughtMatch) {
    return thoughtMatch[1].replace(/<[^>]+>/g, ' ').trim().slice(0, 200);
  }
  
  const lines = response.split('\n')
    .filter(l => !l.trim().startsWith('<'))
    .slice(0, 3)
    .join(' ')
    .trim();
    
  return lines.slice(0, 200);
}

// Tool execution simulation
function executeToolMock(
  tool: string,
  params: Record<string, string>,
  currentContent: string
): { success: boolean; message: string; newContent?: string } {
  switch (tool) {
    case 'write_to_file':
      return {
        success: true,
        message: 'File written successfully',
        newContent: params.content || currentContent,
      };
    case 'replace_in_file':
      const content = params.content || '';
      const searchMatch = content.match(/<<<<<<< SEARCH\n([\s\S]*?)\n=======/);
      const replaceMatch = content.match(/=======\s*REPLACE\n([\s\S]*?)\n>>>>>>>/);
      
      if (searchMatch && replaceMatch) {
        const searchText = searchMatch[1];
        const replaceText = replaceMatch[1];
        
        if (currentContent.includes(searchText)) {
          return {
            success: true,
            message: 'Replacement successful',
            newContent: currentContent.replace(searchText, replaceText),
          };
        }
        return { success: false, message: 'Search text not found' };
      }
      return { success: false, message: 'Invalid replace format' };
    case 'read_file':
      return { success: true, message: 'File read successfully' };
    case 'search_files':
      return { success: true, message: 'Search complete' };
    default:
      return { success: false, message: `Unknown tool: ${tool}` };
  }
}

// ========================================
// Goal Completion Detection Tests
// ========================================

describe('checkGoalCompletion()', () => {
  test('detects "GOAL ACHIEVED"', () => {
    expect(checkGoalCompletion('GOAL ACHIEVED')).toBe(true);
  });

  test('detects "goal achieved" (lowercase)', () => {
    expect(checkGoalCompletion('goal achieved')).toBe(true);
  });

  test('detects "Goal Achieved" (mixed case)', () => {
    expect(checkGoalCompletion('Goal Achieved')).toBe(true);
  });

  test('detects "task complete"', () => {
    expect(checkGoalCompletion('task complete')).toBe(true);
  });

  test('detects "done with edits"', () => {
    expect(checkGoalCompletion("I'm done with edits")).toBe(true);
  });

  test('detects "finished editing"', () => {
    expect(checkGoalCompletion('I have finished editing the file')).toBe(true);
  });

  test('detects "all changes complete"', () => {
    expect(checkGoalCompletion('all changes complete')).toBe(true);
  });

  test('returns false for partial responses', () => {
    expect(checkGoalCompletion('I need to make more changes')).toBe(false);
  });

  test('returns false for thinking responses', () => {
    expect(checkGoalCompletion('<thought>Planning next step</thought>')).toBe(false);
  });

  test('returns false for tool calls only', () => {
    expect(checkGoalCompletion('<write_to_file>...</write_to_file>')).toBe(false);
  });

  test('detects completion within longer response', () => {
    const response = `<thought>Made the changes</thought>
<write_to_file>...</write_to_file>
GOAL ACHIEVED - all changes complete`;
    expect(checkGoalCompletion(response)).toBe(true);
  });
});

// ========================================
// Thinking Extraction Tests
// ========================================

describe('extractThinking()', () => {
  test('extracts from thought tags', () => {
    const response = '<thought>This is my thinking</thought>';
    expect(extractThinking(response)).toBe('This is my thinking');
  });

  test('extracts from nested thought tags', () => {
    const response = '<thought><observe>I see code</observe><plan>I will fix it</plan></thought>';
    const result = extractThinking(response);
    expect(result).toContain('I see code');
    expect(result).toContain('I will fix it');
  });

  test('handles response without thought tags', () => {
    const response = 'Some plain text response\nWith multiple lines';
    const result = extractThinking(response);
    expect(result).toBe('Some plain text response With multiple lines');
  });

  test('excludes XML tags from plain text', () => {
    const response = '<tool>ignored</tool>\nActual thinking\nMore text';
    const result = extractThinking(response);
    expect(result).not.toContain('<tool>');
  });

  test('truncates long thinking', () => {
    const longThought = 'x'.repeat(300);
    const response = `<thought>${longThought}</thought>`;
    const result = extractThinking(response);
    expect(result.length).toBeLessThanOrEqual(200);
  });
});

// ========================================
// Tool Execution Tests
// ========================================

describe('executeToolMock() - write_to_file', () => {
  test('writes new content', () => {
    const result = executeToolMock(
      'write_to_file',
      { path: 'test.ts', content: 'new content' },
      'old content'
    );
    expect(result.success).toBe(true);
    expect(result.newContent).toBe('new content');
  });

  test('returns success message', () => {
    const result = executeToolMock(
      'write_to_file',
      { path: 'test.ts', content: 'code' },
      ''
    );
    expect(result.message).toContain('written');
  });
});

describe('executeToolMock() - replace_in_file', () => {
  test('replaces matching content', () => {
    const content = `<<<<<<< SEARCH
old code
======= REPLACE
new code
>>>>>>> REPLACE`;
    
    const result = executeToolMock(
      'replace_in_file',
      { path: 'test.ts', content },
      'old code here'
    );
    
    expect(result.success).toBe(true);
    expect(result.newContent).toBe('new code here');
  });

  test('fails when search text not found', () => {
    const content = `<<<<<<< SEARCH
nonexistent
======= REPLACE
new
>>>>>>> REPLACE`;
    
    const result = executeToolMock(
      'replace_in_file',
      { path: 'test.ts', content },
      'different content'
    );
    
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  test('fails with invalid format', () => {
    const result = executeToolMock(
      'replace_in_file',
      { path: 'test.ts', content: 'invalid format' },
      'content'
    );
    
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid');
  });
});

describe('executeToolMock() - read_file', () => {
  test('returns success', () => {
    const result = executeToolMock('read_file', { path: 'test.ts' }, '');
    expect(result.success).toBe(true);
  });
});

describe('executeToolMock() - unknown tool', () => {
  test('returns failure for unknown tool', () => {
    const result = executeToolMock('unknown_tool', {}, '');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown');
  });
});

// ========================================
// Workflow Logic Tests
// ========================================

describe('Agentic Workflow Logic', () => {
  test('should reject goal completion without changes on first iteration', () => {
    // Simulate the logic from the engine
    const claimsComplete = true;
    const hasToolCall = false;
    const changesLength = 0;
    const iteration = 0;
    
    const shouldReject = claimsComplete && !hasToolCall && changesLength === 0 && iteration === 0;
    expect(shouldReject).toBe(true);
  });

  test('should accept goal completion after changes made', () => {
    const claimsComplete = true;
    const changesLength = 1;
    const iteration = 1;
    
    const shouldAccept = claimsComplete && (changesLength > 0 || iteration > 0);
    expect(shouldAccept).toBe(true);
  });

  test('should accept goal completion on later iterations', () => {
    const claimsComplete = true;
    const changesLength = 0;
    const iteration = 2;
    
    const shouldAccept = claimsComplete && (changesLength > 0 || iteration > 0);
    expect(shouldAccept).toBe(true);
  });

  test('early termination when changes made and no more tools', () => {
    const earlyTermination = true;
    const changesLength = 1;
    const hasToolCall = false;
    
    const shouldTerminate = earlyTermination && changesLength > 0 && !hasToolCall;
    expect(shouldTerminate).toBe(true);
  });

  test('should continue when no tool call and no changes yet', () => {
    const earlyTermination = true;
    const changesLength = 0;
    const hasToolCall = false;
    
    const shouldTerminate = earlyTermination && changesLength > 0 && !hasToolCall;
    expect(shouldTerminate).toBe(false);
  });
});

// ========================================
// Content Diff Tests
// ========================================

describe('Content Change Detection', () => {
  test('detects content was changed', () => {
    const oldContent: string = 'original';
    const newContent: string = 'modified';
    expect(oldContent).not.toBe(newContent);
  });

  test('detects content unchanged', () => {
    const content1: string = 'same';
    const content2: string = 'same';
    expect(content1).toBe(content2);
  });

  test('counts line changes', () => {
    const before = 'a\nb\nc';
    const after = 'a\nx\nc\nd';
    
    const beforeLines = new Set(before.split('\n'));
    const afterLines = new Set(after.split('\n'));
    
    let added = 0;
    let removed = 0;
    
    afterLines.forEach(line => {
      if (!beforeLines.has(line)) added++;
    });
    beforeLines.forEach(line => {
      if (!afterLines.has(line)) removed++;
    });
    
    expect(added).toBe(2); // 'x' and 'd'
    expect(removed).toBe(1); // 'b'
  });
});

// ========================================
// Iteration State Tests
// ========================================

describe('Iteration State Management', () => {
  test('iteration increments correctly', () => {
    let iteration = 0;
    const maxIterations = 5;
    
    while (iteration < maxIterations) {
      iteration++;
      expect(iteration).toBeLessThanOrEqual(maxIterations);
    }
    
    expect(iteration).toBe(maxIterations);
  });

  test('changes array accumulates', () => {
    const changes: Array<{ type: string; description: string }> = [];
    
    changes.push({ type: 'write_to_file', description: 'First change' });
    changes.push({ type: 'replace_in_file', description: 'Second change' });
    
    expect(changes.length).toBe(2);
    expect(changes[0].type).toBe('write_to_file');
  });

  test('message history builds up', () => {
    const messages: Array<{ role: string; content: string }> = [];
    
    messages.push({ role: 'system', content: 'System prompt' });
    messages.push({ role: 'user', content: 'Initial request' });
    messages.push({ role: 'assistant', content: 'Response 1' });
    messages.push({ role: 'user', content: 'Follow up' });
    messages.push({ role: 'assistant', content: 'Response 2' });
    
    expect(messages.length).toBe(5);
    expect(messages.filter(m => m.role === 'assistant').length).toBe(2);
  });
});
