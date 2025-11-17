// Approximate token counter
// Rough heuristic: ~4 chars per token for English, adjust for other languages
export function estimateTokens(text: string): number {
  if (!text) return 0;
  
  // Basic heuristic: word count * 1.3 (accounts for subword tokens)
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words * 1.3);
}

export function estimateMessagesTokens(messages: Array<{ role: string; content: string }>): number {
  // Each message has overhead (role, formatting)
  const overhead = messages.length * 4;
  const contentTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
  return overhead + contentTokens;
}

export function truncateToTokens(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokens(text);
  
  if (estimatedTokens <= maxTokens) {
    return text;
  }

  // Estimate character limit
  const ratio = maxTokens / estimatedTokens;
  const charLimit = Math.floor(text.length * ratio);
  
  // Truncate at word boundary
  const truncated = text.slice(0, charLimit);
  const lastSpace = truncated.lastIndexOf(' ');
  
  return lastSpace > 0 ? truncated.slice(0, lastSpace) + '...' : truncated + '...';
}

