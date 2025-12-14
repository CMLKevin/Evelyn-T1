/**
 * Unit Tests for Agentic Tool Parser
 * Tests multi-pass parsing, XML extraction, corrections, verification
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  ToolParser,
  createToolParser,
  createEditVerifier,
  createCheckpointManager,
} from '../agent/agenticToolParser.js';

describe('ToolParser', () => {
  let parser: ToolParser;

  beforeEach(() => {
    parser = createToolParser();
  });

  describe('parse() - Exact XML Match', () => {
    test('parses valid write_to_file tool call', () => {
      const response = `<write_to_file>
<path>test.ts</path>
<content>console.log("hello");</content>
</write_to_file>`;

      const result = parser.parse(response);
      
      expect(result.success).toBe(true);
      expect(result.toolCall?.tool).toBe('write_to_file');
      expect(result.toolCall?.params.path).toBe('test.ts');
      expect(result.toolCall?.confidence).toBe(1.0);
    });

    test('parses replace_in_file with search/replace', () => {
      const response = `<replace_in_file><path>app.js</path><content>
<<<<<<< SEARCH
old code
======= REPLACE
new code
>>>>>>> REPLACE
</content></replace_in_file>`;

      const result = parser.parse(response);
      
      expect(result.success).toBe(true);
      expect(result.toolCall?.tool).toBe('replace_in_file');
      expect(result.toolCall?.params.content).toContain('SEARCH');
    });

    test('parses read_file tool call', () => {
      const response = `<read_file><path>config.json</path></read_file>`;
      const result = parser.parse(response);
      
      expect(result.success).toBe(true);
      expect(result.toolCall?.tool).toBe('read_file');
    });

    test('rejects unknown tool names', () => {
      const response = `<unknown_tool><path>test.ts</path></unknown_tool>`;
      const result = parser.parse(response);
      
      expect(result.success).toBe(false);
      // Parser tries multiple passes and may return different error messages
      expect(result.error).toBeTruthy();
    });

    test('returns failure for no tool in response', () => {
      const response = `I'll describe the changes without using a tool.`;
      const result = parser.parse(response);
      
      expect(result.success).toBe(false);
    });
  });

  describe('parse() - Multi-Pass Corrections', () => {
    test('extracts tool from response with thinking', () => {
      const response = `<thought>I need to write code.</thought>
<write_to_file><path>test.ts</path><content>code</content></write_to_file>
GOAL ACHIEVED`;

      const result = parser.parse(response);
      
      expect(result.success).toBe(true);
      expect(result.toolCall?.tool).toBe('write_to_file');
    });

    test('handles empty content', () => {
      const response = `<write_to_file><path>empty.ts</path><content></content></write_to_file>`;
      const result = parser.parse(response);
      
      expect(result.success).toBe(true);
    });

    test('handles multiline content', () => {
      const response = `<replace_in_file><path>app.js</path><content>
<<<<<<< SEARCH
function old() {
  return 1;
}
======= REPLACE
function newFn() {
  return 2;
}
>>>>>>> REPLACE
</content></replace_in_file>`;

      const result = parser.parse(response);
      
      expect(result.success).toBe(true);
      expect(result.toolCall?.params.content).toContain('function old()');
    });
  });
});

describe('EditVerifier', () => {
  const verifier = createEditVerifier();

  test('detects added lines', () => {
    const result = verifier.verify('line1', 'line1\nline2', 'write_to_file');
    expect(result.valid).toBe(true);
    expect(result.changesCount).toBeGreaterThan(0);
  });

  test('detects removed lines', () => {
    const result = verifier.verify('line1\nline2', 'line1', 'replace_in_file');
    expect(result.valid).toBe(true);
    expect(result.changesCount).toBeGreaterThan(0);
  });

  test('detects no changes', () => {
    const result = verifier.verify('same', 'same', 'write_to_file');
    expect(result.changesCount).toBe(0);
  });

  test('validates TypeScript syntax', () => {
    const result = verifier.verify('const x = 1;', 'const x: number = 1;', 'replace_in_file', 'typescript');
    expect(result.syntaxValid).toBe(true);
  });
});

describe('CheckpointManager', () => {
  test('creates and retrieves checkpoints', () => {
    const manager = createCheckpointManager(3);
    const cp = manager.create('content v1', 1, 'Initial');
    
    expect(cp.id).toBeTruthy();
    expect(cp.content).toBe('content v1');
  });

  test('getLatest returns most recent checkpoint', () => {
    const manager = createCheckpointManager(3);
    manager.create('v1', 1, 'First');
    const cp2 = manager.create('v2', 2, 'Second');
    
    const latest = manager.getLatest();
    expect(latest?.content).toBe('v2');
    expect(latest?.id).toBe(cp2.id);
  });

  test('rollbackTo returns checkpoint content', () => {
    const manager = createCheckpointManager(3);
    const cp1 = manager.create('v1', 1, 'First');
    manager.create('v2', 2, 'Second');
    
    const result = manager.rollbackTo(cp1.id);
    expect(result.success).toBe(true);
    expect(result.content).toBe('v1');
  });

  test('rollbackTo fails for unknown id', () => {
    const manager = createCheckpointManager(3);
    const result = manager.rollbackTo('unknown-id');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test('respects max checkpoints limit', () => {
    const manager = createCheckpointManager(2);
    manager.create('v1', 1, 'First');
    manager.create('v2', 2, 'Second');
    manager.create('v3', 3, 'Third');
    
    const checkpoints = manager.list();
    expect(checkpoints.length).toBeLessThanOrEqual(2);
  });

  test('list returns all checkpoints in order', () => {
    const manager = createCheckpointManager(5);
    manager.create('v1', 1, 'First');
    manager.create('v2', 2, 'Second');
    
    const list = manager.list();
    expect(list.length).toBe(2);
    expect(list[0].content).toBe('v1');
    expect(list[1].content).toBe('v2');
  });
});
