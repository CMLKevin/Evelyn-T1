/**
 * Web Search Executor
 * 
 * Performs web searches using Grok's web_search capability
 * or Perplexity Sonar Pro via OpenRouter for research queries.
 */

import type { ToolExecutor, ToolContext, ToolResult, WebSearchParams } from '../types.js';
import { openRouterClient } from '../../../providers/openrouter.js';
import { getWebSearchProvider } from '../../../utils/settings.js';

// Perplexity Sonar Pro model on OpenRouter (has built-in web search)
const PERPLEXITY_MODEL = 'perplexity/sonar-pro';

export interface WebSearchResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  synthesis?: string;
  provider: 'grok' | 'perplexity';
}

export class WebSearchExecutor implements ToolExecutor<WebSearchParams, WebSearchResult> {
  toolName = 'web_search' as const;

  validate(params: WebSearchParams): { valid: boolean; errors?: string[] } {
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

  async execute(params: WebSearchParams, context: ToolContext): Promise<ToolResult & { data?: WebSearchResult }> {
    const startTime = Date.now();
    const { query } = params;

    try {
      console.log(`[WebSearchExecutor] 🔍 Searching: "${query}"`);

      // Get preferred search provider from settings
      const provider = await getWebSearchProvider();
      
      let searchResult: WebSearchResult;

      if (provider === 'grok') {
        // Use Grok's native web_search via OpenRouter
        searchResult = await this.searchWithGrok(query);
      } else {
        // Use Perplexity for deeper research
        searchResult = await this.searchWithPerplexity(query);
      }

      // Emit search results to frontend
      if (context.socket) {
        const socket = typeof context.socket === 'function' ? context.socket() : context.socket;
        if (socket) {
          socket.emit('tool:web_search', {
            correlationId: context.correlationId,
            query,
            results: searchResult.results,
            synthesis: searchResult.synthesis,
            provider: searchResult.provider
          });
        }
      }

      console.log(`[WebSearchExecutor] ✅ Found ${searchResult.results.length} results`);

      return {
        toolName: this.toolName,
        status: 'success',
        data: searchResult,
        summary: `Found ${searchResult.results.length} results for "${query}"`,
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false
      };
    } catch (error) {
      console.error('[WebSearchExecutor] ❌ Error:', error);
      
      return {
        toolName: this.toolName,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: 'Web search failed',
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false
      };
    }
  }

  private async searchWithGrok(query: string): Promise<WebSearchResult> {
    // Grok web search via OpenRouter with agent tools
    const messages = [
      {
        role: 'user' as const,
        content: `Search the web for: ${query}\n\nProvide a concise summary of the most relevant results with source URLs.`
      }
    ];

    const result = await openRouterClient.completeWithAgentTools(
      messages,
      { tools: [{ type: 'web_search' }], tool_choice: 'auto' }
    );

    const content = result.content;

    // Extract any cited URLs from the response
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    const urls = content.match(urlRegex) || [];

    return {
      query,
      results: urls.slice(0, 5).map((url: string, i: number) => ({
        title: `Result ${i + 1}`,
        url,
        snippet: ''
      })),
      synthesis: content,
      provider: 'grok'
    };
  }

  private async searchWithPerplexity(query: string): Promise<WebSearchResult> {
    // Use Perplexity Sonar Pro via OpenRouter - it has built-in web search
    const messages = [
      {
        role: 'user' as const,
        content: `${query}\n\nProvide a comprehensive answer with sources. Include relevant URLs.`
      }
    ];

    // Perplexity Sonar Pro has native web search - just call it directly
    let content = '';
    for await (const token of openRouterClient.streamChat(messages, PERPLEXITY_MODEL)) {
      content += token;
    }

    // Extract URLs from the response
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    const urls = content.match(urlRegex) || [];

    // Clean up URLs (remove trailing punctuation)
    const cleanUrls = urls.map(url => url.replace(/[.,;:!?)]+$/, ''));

    return {
      query,
      results: cleanUrls.slice(0, 8).map((url: string, i: number) => ({
        title: `Source ${i + 1}`,
        url,
        snippet: ''
      })),
      synthesis: content,
      provider: 'perplexity'
    };
  }
}
