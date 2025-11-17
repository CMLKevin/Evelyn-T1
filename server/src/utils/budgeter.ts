import { estimateTokens } from './tokenizer.js';

interface BudgetConfig {
  inMax: number;        // Max input tokens
  reserveOut: number;   // Reserve fraction for output (e.g., 0.3)
}

interface ContextComponent {
  name: string;
  content: string;
  priority: number;     // Higher = more important
  minTokens?: number;   // Minimum tokens to include (if included at all)
  maxTokens?: number;   // Maximum tokens to include
}

export class Budgeter {
  private config: BudgetConfig;

  constructor(config: BudgetConfig) {
    this.config = config;
  }

  pack(components: ContextComponent[]): string[] {
    const availableTokens = Math.floor(this.config.inMax * (1 - this.config.reserveOut));
    
    // Sort by priority (descending)
    const sorted = [...components].sort((a, b) => b.priority - a.priority);
    
    const packed: string[] = [];
    let usedTokens = 0;

    for (const component of sorted) {
      const tokens = estimateTokens(component.content);
      const minTokens = component.minTokens || 0;
      const maxTokens = component.maxTokens || tokens;

      // Skip if it doesn't fit minimum
      if (usedTokens + minTokens > availableTokens) {
        continue;
      }

      // Determine how many tokens we can use
      const budgetRemaining = availableTokens - usedTokens;
      const tokensToUse = Math.min(tokens, maxTokens, budgetRemaining);

      if (tokensToUse >= minTokens) {
        // Truncate if needed
        let content = component.content;
        if (tokens > tokensToUse) {
          // Estimate character ratio
          const ratio = tokensToUse / tokens;
          const charLimit = Math.floor(content.length * ratio);
          const truncated = content.slice(0, charLimit);
          const lastSpace = truncated.lastIndexOf(' ');
          content = lastSpace > 0 ? truncated.slice(0, lastSpace) + '...' : truncated;
        }

        packed.push(content);
        usedTokens += estimateTokens(content);
      }

      // Stop if budget exhausted
      if (usedTokens >= availableTokens) {
        break;
      }
    }

    return packed;
  }

  estimateTokens(text: string): number {
    return estimateTokens(text);
  }
}

