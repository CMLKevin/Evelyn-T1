import { estimateTokens, truncateToTokens } from '../utils/tokenizer.js';

describe('Tokenizer', () => {
  test('estimates tokens for simple text', () => {
    const text = 'This is a simple test';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(20);
  });

  test('truncates text to token limit', () => {
    const text = 'word '.repeat(100);
    const truncated = truncateToTokens(text, 10);
    expect(truncated.length).toBeLessThan(text.length);
    expect(truncated).toContain('...');
  });

  test('does not truncate if within limit', () => {
    const text = 'Short text';
    const truncated = truncateToTokens(text, 100);
    expect(truncated).toBe(text);
  });
});

