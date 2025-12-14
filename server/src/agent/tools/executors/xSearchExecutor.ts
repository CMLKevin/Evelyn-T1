/**
 * X Search Executor
 * 
 * Searches X (Twitter) using Grok's x_search capability.
 */

import type { ToolExecutor, ToolContext, ToolResult, XSearchParams } from '../types.js';
import { openRouterClient } from '../../../providers/openrouter.js';

export interface XSearchResult {
  query: string;
  posts: Array<{
    author: string;
    content: string;
    timestamp?: string;
    likes?: number;
    retweets?: number;
  }>;
  synthesis?: string;
}

export class XSearchExecutor implements ToolExecutor<XSearchParams, XSearchResult> {
  toolName = 'x_search' as const;

  validate(params: XSearchParams): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!params.query || typeof params.query !== 'string') {
      errors.push('query is required and must be a string');
    }

    if (params.query && params.query.length < 2) {
      errors.push('query must be at least 2 characters');
    }

    if (params.query && params.query.length > 500) {
      errors.push('query must be less than 500 characters');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(params: XSearchParams, context: ToolContext): Promise<ToolResult & { data?: XSearchResult }> {
    const startTime = Date.now();
    const { query } = params;

    try {
      console.log(`[XSearchExecutor] 🐦 Searching X: "${query}"`);

      // Use Grok's x_search tool
      const messages = [
        {
          role: 'user' as const,
          content: `Search X (Twitter) for: ${query}\n\nSummarize the most relevant and recent posts. Include notable accounts and engagement metrics if available.`
        }
      ];

      const result = await openRouterClient.completeWithAgentTools(
        messages,
        { tools: [{ type: 'x_search' }], tool_choice: 'auto' }
      );

      const content = result.content;

      // Parse posts from response (simplified - Grok returns formatted text)
      const searchResult: XSearchResult = {
        query,
        posts: [], // Would parse from Grok's response
        synthesis: content
      };

      // Emit search results to frontend
      if (context.socket) {
        const socket = typeof context.socket === 'function' ? context.socket() : context.socket;
        if (socket) {
          socket.emit('tool:x_search', {
            correlationId: context.correlationId,
            query,
            synthesis: searchResult.synthesis,
            postCount: searchResult.posts.length
          });
        }
      }

      console.log(`[XSearchExecutor] ✅ X search complete`);

      return {
        toolName: this.toolName,
        status: 'success',
        data: searchResult,
        summary: `Searched X for "${query}"`,
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false
      };
    } catch (error) {
      console.error('[XSearchExecutor] ❌ Error:', error);
      
      return {
        toolName: this.toolName,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: 'X search failed',
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false
      };
    }
  }
}
