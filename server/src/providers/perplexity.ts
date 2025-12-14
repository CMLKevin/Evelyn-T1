/**
 * Perplexity Search Provider
 * 
 * Uses Perplexity Sonar Pro via OpenRouter for web search.
 * No proprietary Perplexity API key required - uses existing OpenRouter key.
 */

import { openRouterClient } from './openrouter.js';

// Perplexity models available on OpenRouter
const PERPLEXITY_SONAR_PRO = 'perplexity/sonar-pro';
const PERPLEXITY_SONAR_REASONING = 'perplexity/sonar-reasoning-pro';

interface SearchResult {
  query: string;
  model: string;
  answer: string;
  citations: string[];
  relatedQuestions?: string[];
  rawResponse?: any;
}

class PerplexityClient {
  /**
   * Extract URLs from text content
   */
  private extractUrls(content: string): string[] {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    const urls = content.match(urlRegex) || [];
    
    // Clean up URLs (remove trailing punctuation)
    return urls
      .map(url => url.replace(/[.,;:!?)]+$/, ''))
      .filter((url, idx, arr) => arr.indexOf(url) === idx); // Dedupe
  }

  /**
   * Perform a web search using Perplexity Sonar Pro via OpenRouter
   */
  async search(query: string, complexity: 'simple' | 'complex' = 'simple'): Promise<SearchResult> {
    const model = complexity === 'complex' ? PERPLEXITY_SONAR_REASONING : PERPLEXITY_SONAR_PRO;

    console.log(`[Perplexity] Searching with ${model}: "${query.slice(0, 50)}..."`);

    const messages = [
      {
        role: 'system' as const,
        content: 'You are a helpful search assistant. Provide comprehensive, accurate information with source URLs. Include specific facts, figures, and details from credible sources.'
      },
      {
        role: 'user' as const,
        content: query
      }
    ];

    let content = '';
    for await (const token of openRouterClient.streamChat(messages, model)) {
      content += token;
    }

    const citations = this.extractUrls(content);

    console.log(`[Perplexity] Search completed - ${citations.length} citations found`);

    return {
      query,
      model,
      answer: content,
      citations: citations.slice(0, 10),
      relatedQuestions: []
    };
  }

  /**
   * Specialized search for finding entry URLs for agentic browsing.
   * Uses Sonar Pro with an optimized prompt.
   */
  async findEntryUrl(query: string): Promise<SearchResult> {
    const queryLower = query.toLowerCase();
    
    // Smart fallback URLs for common sites
    const sitePatterns: Record<string, (topic: string) => string> = {
      reddit: (topic) => {
        const searchTerm = topic.replace(/reddit/gi, '').trim();
        return `https://www.reddit.com/search/?q=${encodeURIComponent(searchTerm)}&sort=relevance&t=month`;
      },
      'hacker news': () => 'https://news.ycombinator.com/',
      hackernews: () => 'https://news.ycombinator.com/',
      github: (topic) => {
        const searchTerm = topic.replace(/github/gi, '').trim();
        return `https://github.com/search?q=${encodeURIComponent(searchTerm)}&type=repositories`;
      },
      twitter: (topic) => {
        const searchTerm = topic.replace(/twitter|x\.com/gi, '').trim();
        return `https://x.com/search?q=${encodeURIComponent(searchTerm)}`;
      },
      youtube: (topic) => {
        const searchTerm = topic.replace(/youtube/gi, '').trim();
        return `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}`;
      }
    };

    let fallbackUrl: string | null = null;
    for (const [site, urlBuilder] of Object.entries(sitePatterns)) {
      if (queryLower.includes(site)) {
        fallbackUrl = urlBuilder(query);
        console.log(`[Perplexity] Detected ${site}, fallback URL: ${fallbackUrl}`);
        break;
      }
    }

    const messages = [
      {
        role: 'system' as const,
        content: 'You are a web search expert. Your job is to find direct, working URLs. Always include relevant source URLs in your response. Prioritize URLs that lead directly to the content requested.'
      },
      {
        role: 'user' as const,
        content: `Find the best URL to visit for: "${query}"

Provide the most relevant, directly accessible URL(s). Focus on:
- Discussion forums if mentioned (Reddit, HackerNews)
- Official sources or documentation
- Active community pages with recent content
- Popular articles or threads`
      }
    ];

    let content = '';
    for await (const token of openRouterClient.streamChat(messages, PERPLEXITY_SONAR_PRO)) {
      content += token;
    }

    let citations = this.extractUrls(content);
    
    console.log(`[Perplexity] Entry URL search - ${citations.length} URLs found`);
    
    // Use fallback if no URLs found
    if (citations.length === 0 && fallbackUrl) {
      console.log(`[Perplexity] Using fallback URL: ${fallbackUrl}`);
      citations = [fallbackUrl];
    }
    
    if (citations.length > 0) {
      console.log(`[Perplexity] Primary entry URL: ${citations[0]}`);
    }

    return {
      query,
      model: PERPLEXITY_SONAR_PRO,
      answer: content,
      citations,
      relatedQuestions: []
    };
  }

  /**
   * Synthesize search results into a formatted summary
   */
  async synthesize(searchResult: SearchResult): Promise<string> {
    const sentences = searchResult.answer.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const topSentences = sentences.slice(0, 5);
    
    const bullets = topSentences.map((sentence, idx) => {
      const citation = searchResult.citations[idx] || searchResult.citations[0] || '';
      return `• ${sentence.trim()}${citation ? ` [${citation}]` : ''}`;
    });

    return `Based on current information:\n\n${bullets.join('\n')}\n\nIn summary: ${sentences[0]?.trim() || searchResult.answer.slice(0, 200)}`;
  }

  /**
   * Generate a comprehensive summary of search results
   */
  async generateSummary(searchResult: SearchResult): Promise<string> {
    const prompt = `Summarize these search results in ~500 words for an AI's context memory.

Query: "${searchResult.query}"

Results:
${searchResult.answer}

Sources: ${searchResult.citations.join(', ')}

Create an information-dense summary that captures key facts, details, and insights.`;

    try {
      const summary = await openRouterClient.simpleThought(prompt);
      console.log(`[Perplexity] Generated summary: ${summary.length} chars`);
      return summary;
    } catch (error) {
      console.error('[Perplexity] Summary generation failed:', error);
      return searchResult.answer.slice(0, 2000);
    }
  }
}

export const perplexityClient = new PerplexityClient();

