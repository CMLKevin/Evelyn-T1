import dotenv from 'dotenv';
import { openRouterClient } from './openrouter.js';

dotenv.config();

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_BASE = process.env.PERPLEXITY_BASE || 'https://api.perplexity.ai';
const MODEL_SEARCH_SIMPLE = process.env.MODEL_SEARCH_SIMPLE || 'sonar-pro';
const MODEL_SEARCH_COMPLEX = process.env.MODEL_SEARCH_COMPLEX || 'sonar-reasoning';

if (!PERPLEXITY_API_KEY) {
  throw new Error('PERPLEXITY_API_KEY environment variable is required');
}

interface SearchResult {
  query: string;
  model: string;
  answer: string;
  citations: string[];
  relatedQuestions?: string[];
  rawResponse: any;
}

interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  citations?: string[];
}

class PerplexityClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = PERPLEXITY_BASE;
    this.apiKey = PERPLEXITY_API_KEY!; // Non-null assertion safe due to check at line 11-13
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async search(query: string, complexity: 'simple' | 'complex' = 'simple'): Promise<SearchResult> {
    const model = complexity === 'simple' ? MODEL_SEARCH_SIMPLE : MODEL_SEARCH_COMPLEX;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful search assistant. Provide comprehensive, accurate information with multiple citations. Include specific facts, figures, and details from credible sources.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        return_citations: true,
        return_related_questions: true,
        search_recency_filter: 'month'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Perplexity error: ${response.status} ${error}`);
    }

    const data = await response.json() as PerplexityResponse;
    const answer = data.choices[0].message.content;
    const citations = data.citations || [];
    const relatedQuestions = (data as any).related_questions || [];

    console.log(`[Perplexity] Search completed - ${citations.length} citations, ${relatedQuestions.length} related questions`);

    return {
      query,
      model,
      answer,
      citations,
      relatedQuestions,
      rawResponse: data
    };
  }

  /**
   * Specialized search for finding entry URLs for agentic browsing.
   * Uses Sonar Pro with an optimized prompt. Falls back to smart URL construction if no citations.
   */
  async findEntryUrl(query: string): Promise<SearchResult> {
    const queryLower = query.toLowerCase();
    
    // Check if query mentions specific sites - construct URL directly as fallback
    const sitePatterns: Record<string, (topic: string) => string> = {
      reddit: (topic) => {
        // Extract topic from query
        const topicMatch = topic.match(/(?:about|for|on)\s+([^.]+)/i);
        const searchTerm = topicMatch ? topicMatch[1].trim() : topic.replace(/reddit/gi, '').trim();
        // Encode and search Reddit
        return `https://www.reddit.com/search/?q=${encodeURIComponent(searchTerm)}&sort=relevance&t=month`;
      },
      'hacker news': () => 'https://news.ycombinator.com/',
      hackernews: () => 'https://news.ycombinator.com/',
      github: (topic) => {
        const searchTerm = topic.replace(/github/gi, '').trim();
        return `https://github.com/search?q=${encodeURIComponent(searchTerm)}&type=repositories`;
      }
    };

    let fallbackUrl: string | null = null;
    for (const [site, urlBuilder] of Object.entries(sitePatterns)) {
      if (queryLower.includes(site)) {
        fallbackUrl = urlBuilder(query);
        console.log(`[Perplexity] Detected ${site} in query, fallback URL prepared: ${fallbackUrl}`);
        break;
      }
    }

    const model = MODEL_SEARCH_SIMPLE; // Use Sonar Pro

    // Craft a prompt that ensures we get relevant URLs
    const searchPrompt = `Find the exact, direct URL for: "${query}"

CRITICAL: You must provide at least one working URL in your citations.

Focus on finding:
- Discussion forums (Reddit, HackerNews, etc.) if mentioned
- Official sources or news sites
- Active community pages with recent posts
- Popular threads or discussions

Provide the most relevant URL as your primary citation. The URL should be directly accessible and contain the requested content.`;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a web search expert. Your primary job is to provide direct, working URLs. ALWAYS include at least one URL citation in your response. Prioritize URLs that lead directly to active discussions and the most relevant content.'
          },
          {
            role: 'user',
            content: searchPrompt
          }
        ],
        temperature: 0.2, // Even lower for more deterministic results
        max_tokens: 500,
        return_citations: true,
        return_related_questions: false,
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Perplexity error: ${response.status} ${error}`);
    }

    const data = await response.json() as PerplexityResponse;
    const answer = data.choices[0].message.content;
    let citations = data.citations || [];

    console.log(`[Perplexity] Entry URL search completed - ${citations.length} citations found`);
    console.log(`[Perplexity] Answer: ${answer.substring(0, 200)}...`);
    
    // Fallback 1: Extract URLs from the answer text if no citations
    if (citations.length === 0) {
      console.log(`[Perplexity] No citations returned, attempting to extract URLs from answer...`);
      // Match URLs but stop at markdown brackets or parentheses
      const urlRegex = /https?:\/\/[^\s<>")\]]+/g;
      const extractedUrls = answer.match(urlRegex);
      if (extractedUrls && extractedUrls.length > 0) {
        // Clean up URLs - remove trailing punctuation and markdown artifacts
        citations = extractedUrls
          .map(url => url.replace(/[\])}.,;:!?]+$/, '')) // Remove trailing punctuation
          .filter(url => url.length > 0)
          .slice(0, 3); // Take up to 3 URLs
        console.log(`[Perplexity] Extracted ${citations.length} URLs from answer text`);
      }
    }
    
    // Fallback 2: Use smart constructed URL if still no citations
    if (citations.length === 0 && fallbackUrl) {
      console.log(`[Perplexity] Using smart fallback URL: ${fallbackUrl}`);
      citations = [fallbackUrl];
    }
    
    if (citations.length > 0) {
      console.log(`[Perplexity] Primary entry URL: ${citations[0]}`);
    } else {
      console.log(`[Perplexity] WARNING: No URLs found through any method`);
    }

    return {
      query,
      model,
      answer,
      citations,
      relatedQuestions: [],
      rawResponse: data
    };
  }

  async synthesize(searchResult: SearchResult): Promise<string> {
    // Extract key points and format for Evelyn
    const bullets: string[] = [];
    
    // Parse the answer for key facts
    const sentences = searchResult.answer.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const topSentences = sentences.slice(0, 5);
    
    topSentences.forEach((sentence, idx) => {
      const citation = searchResult.citations[idx] || searchResult.citations[0] || '';
      if (sentence.trim()) {
        bullets.push(`• ${sentence.trim()}${citation ? ` [${citation}]` : ''}`);
      }
    });

    const synthesis = `Based on current information:\n\n${bullets.join('\n')}\n\nIn summary: ${sentences[0]?.trim() || searchResult.answer.slice(0, 200)}`;
    
    return synthesis;
  }

  async generateSummary(searchResult: SearchResult): Promise<string> {
    // Use MODEL_THINK_SIMPLE to generate a ~500 word summary for context inclusion
    const prompt = `You are summarizing web search results for an AI assistant's context memory. Your goal is to create a concise, information-dense summary of approximately 500 words that captures the key facts, insights, and details from the search results.

Search Query: "${searchResult.query}"

Search Results:
${searchResult.answer}

Citations: ${searchResult.citations.join(', ')}

Create a comprehensive summary that:
1. Captures the most important facts and information
2. Includes specific details, numbers, dates, names when relevant
3. Organizes information logically by topic or theme
4. Is approximately 500 words (can be slightly shorter or longer if needed)
5. Uses clear, concise language suitable for context inclusion
6. Maintains objectivity and accuracy

Write the summary now:`;

    try {
      const summary = await openRouterClient.simpleThought(prompt);
      console.log(`[Perplexity] Generated summary: ${summary.length} characters (~${Math.round(summary.split(/\s+/).length)} words)`);
      return summary;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Perplexity] Summary generation failed:', errorMessage);
      
      // Check if it's a timeout/connection error
      if (errorMessage.includes('timeout') || errorMessage.includes('terminated') || errorMessage.includes('closed')) {
        console.warn('[Perplexity] Summary generation timed out or connection closed. Using fallback summary from search results.');
      }
      
      // Fallback to truncated answer if summary generation fails
      return searchResult.answer.slice(0, 2000) + (searchResult.answer.length > 2000 ? '...' : '');
    }
  }
}

export const perplexityClient = new PerplexityClient();

