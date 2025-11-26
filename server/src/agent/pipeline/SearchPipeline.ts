/**
 * Search Pipeline
 * 
 * Handles web search decision-making, query refinement, and execution.
 * Extracted from the monolithic orchestrator for better separation of concerns.
 */

import { Socket } from 'socket.io';
import { db } from '../../db/client.js';
import { openRouterClient } from '../../providers/openrouter.js';
import { perplexityClient } from '../../providers/perplexity.js';
import { WS_EVENTS, ACTIVITY_TYPES, ACTIVITY_STATUS } from '../../constants/index.js';
import { 
  AgentError, 
  LLMError, 
  withRetry, 
  generateCorrelationId,
  errorLogger 
} from '../errors/index.js';
// Note: Using local types to match the actual Perplexity client types
// The interfaces in ../interfaces are the target types for future migration

// ========================================
// Types
// ========================================

export interface SearchDecision {
  needsSearch: boolean;
  confidence: number;
  rationale: string;
}

export interface PerplexitySearchResult {
  query: string;
  model: string;
  answer: string;
  citations: string[];
  relatedQuestions?: string[];
  rawResponse: any;
  synthesis?: string;
  summary?: string;
}

export interface SearchPipelineResult {
  performed: boolean;
  result?: PerplexitySearchResult;
  savedId?: number;
  error?: string;
}

export interface SearchPipelineOptions {
  socket: Socket;
  correlationId?: string;
}

// ========================================
// Prompts
// ========================================

const SEARCH_DECISION_PROMPT = `Analyze if this user message requires web search for current/factual information.

User message: "{{MESSAGE}}"

Consider:
- Does it ask about current events, news, or time-sensitive information?
- Does it request factual data that changes (weather, stock prices, scores, etc.)?
- Does it ask about people, places, or topics that need up-to-date context?
- Does it ask about technical knowledge that requires searching from academic sources?
- Does it contain any pop culture references that searching on the web would be helpful for answering?

Respond with JSON only:
{
  "needsSearch": true/false,
  "confidence": 0.0-1.0,
  "rationale": "Brief explanation"
}`;

const QUERY_REFINEMENT_PROMPT = `Transform this user message into an optimal web search query.

User message: "{{MESSAGE}}"

Guidelines:
- Extract the core factual question
- Remove conversational fluff and politeness
- Make it concise and search-engine friendly
- Include key entities, dates, or specifics
- If multiple questions, focus on the primary one

Examples:
User: "Hey, can you tell me what's happening with the latest iPhone release?"
Search: "latest iPhone release 2025 announcement"

User: "I'm curious about who won the World Cup recently"
Search: "World Cup 2024 winner results"

User: "What's the weather like in Tokyo today?"
Search: "Tokyo weather today current"

Respond with JSON only:
{
  "refinedQuery": "optimized search query",
  "rationale": "why this query is better"
}`;

// ========================================
// Search Pipeline Class
// ========================================

export class SearchPipeline {
  private correlationId: string;

  constructor(correlationId?: string) {
    this.correlationId = correlationId || generateCorrelationId();
  }

  /**
   * Decide if a query needs web search
   */
  async shouldSearch(query: string): Promise<boolean> {
    const decision = await this.decideSearch(query);
    return decision.needsSearch && decision.confidence >= 0.6;
  }

  /**
   * Get detailed search decision
   */
  async decideSearch(content: string): Promise<SearchDecision> {
    const prompt = SEARCH_DECISION_PROMPT.replace('{{MESSAGE}}', content);

    try {
      const response = await withRetry(
        () => openRouterClient.simpleThought(prompt),
        {
          maxAttempts: 2,
          initialDelayMs: 500,
          onRetry: (error, attempt) => {
            console.log(`[SearchPipeline] Retrying search decision (attempt ${attempt})`);
          }
        }
      );

      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        console.log(`[SearchPipeline] Search decision: ${result.needsSearch ? 'YES' : 'NO'} (${(result.confidence * 100).toFixed(0)}% confident)`);
        
        return {
          needsSearch: result.needsSearch,
          confidence: result.confidence,
          rationale: result.rationale || ''
        };
      }
    } catch (error) {
      const agentError = new LLMError(
        'Search decision failed',
        undefined,
        { 
          operation: 'decideSearch', 
          component: 'SearchPipeline',
          correlationId: this.correlationId 
        },
        { originalError: error instanceof Error ? error : undefined }
      );
      errorLogger.log(agentError);
    }

    // Fallback to heuristics if AI fails
    return this.fallbackSearchDecision(content);
  }

  /**
   * Fallback heuristic-based search decision
   */
  private fallbackSearchDecision(content: string): SearchDecision {
    const searchKeywords = [
      'latest', 'current', 'news', 'recent', 'today', 'now', 
      '2024', '2025', 'who is', 'what is', 'how to', 'where is',
      'price', 'cost', 'weather', 'score', 'result', 'update'
    ];
    
    const lowerContent = content.toLowerCase();
    const matchedKeywords = searchKeywords.filter(kw => lowerContent.includes(kw));
    const needsSearch = matchedKeywords.length > 0;
    
    return {
      needsSearch,
      confidence: needsSearch ? 0.7 : 0.3,
      rationale: needsSearch 
        ? `Contains search keywords: ${matchedKeywords.join(', ')}`
        : 'No search keywords detected (fallback heuristic)'
    };
  }

  /**
   * Refine query for better search results
   */
  async refineQuery(query: string): Promise<string> {
    const prompt = QUERY_REFINEMENT_PROMPT.replace('{{MESSAGE}}', query);

    try {
      const response = await withRetry(
        () => openRouterClient.simpleThought(prompt),
        { maxAttempts: 2, initialDelayMs: 500 }
      );

      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        console.log(`[SearchPipeline] Refined query: "${result.refinedQuery}"`);
        return result.refinedQuery;
      }
    } catch (error) {
      console.error('[SearchPipeline] Query refinement error:', error instanceof Error ? error.message : String(error));
    }

    // Fallback to original query
    return query;
  }

  /**
   * Execute search
   */
  async search(query: string, complexity: 'simple' | 'complex' = 'simple'): Promise<PerplexitySearchResult> {
    console.log(`[SearchPipeline] Executing ${complexity} search: "${query.slice(0, 50)}..."`);
    return await perplexityClient.search(query, complexity);
  }

  /**
   * Synthesize search results into a summary
   */
  async synthesize(result: PerplexitySearchResult): Promise<string> {
    return await perplexityClient.synthesize(result as any);
  }

  /**
   * Execute full search pipeline
   */
  async execute(
    content: string, 
    options: SearchPipelineOptions
  ): Promise<SearchPipelineResult> {
    const { socket } = options;

    // Check if search is needed
    const decision = await this.decideSearch(content);
    
    if (!decision.needsSearch || decision.confidence < 0.6) {
      return { performed: false };
    }

    // Refine the search query
    const refinedQuery = await this.refineQuery(content);
    
    // Log activity start
    const activityId = await this.logActivity(
      'search', 
      'running', 
      `Searching for: ${refinedQuery.slice(0, 100)}`
    );
    
    socket.emit(WS_EVENTS.SUBROUTINE.STATUS, {
      id: activityId,
      tool: ACTIVITY_TYPES.SEARCH,
      status: ACTIVITY_STATUS.RUNNING,
      query: refinedQuery
    });

    try {
      // Determine complexity
      const complexity = content.length > 200 || 
                        content.includes('why') || 
                        content.includes('how') 
                        ? 'complex' : 'simple';

      // Execute search
      const searchResult = await this.search(refinedQuery, complexity);
      const synthesis = await this.synthesize(searchResult);
      const summary = await perplexityClient.generateSummary(searchResult);
      
      console.log(`[SearchPipeline] Search complete | sources: ${searchResult.citations.length}`);

      // Save to database
      const savedResult = await db.searchResult.create({
        data: {
          query: refinedQuery,
          originalQuery: content !== refinedQuery ? content : null,
          answer: searchResult.answer,
          citations: JSON.stringify(searchResult.citations),
          synthesis: synthesis,
          summary: summary,
          model: searchResult.model
        }
      });

      // Emit results to frontend
      socket.emit(WS_EVENTS.SEARCH.RESULTS, {
        id: savedResult.id,
        query: refinedQuery,
        originalQuery: content !== refinedQuery ? content : undefined,
        answer: searchResult.answer,
        citations: searchResult.citations,
        synthesis: synthesis,
        model: searchResult.model,
        timestamp: savedResult.createdAt.toISOString()
      });

      // Complete activity
      await this.completeActivity(activityId, `Found ${searchResult.citations.length} sources`);
      
      socket.emit(WS_EVENTS.SUBROUTINE.STATUS, {
        id: activityId,
        tool: ACTIVITY_TYPES.SEARCH,
        status: ACTIVITY_STATUS.DONE,
        summary: synthesis.slice(0, 200),
        citationCount: searchResult.citations.length
      });

      return {
        performed: true,
        result: {
          ...searchResult,
          synthesis,
          summary
        },
        savedId: savedResult.id
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[SearchPipeline] Search failed:', errorMessage);
      
      await this.completeActivity(activityId, 'Search failed');
      
      socket.emit(WS_EVENTS.SUBROUTINE.STATUS, {
        id: activityId,
        tool: ACTIVITY_TYPES.SEARCH,
        status: ACTIVITY_STATUS.ERROR,
        summary: 'Search failed'
      });

      return {
        performed: true,
        error: errorMessage
      };
    }
  }

  /**
   * Log activity start
   */
  private async logActivity(tool: string, status: string, summary: string): Promise<number> {
    const activity = await db.toolActivity.create({
      data: {
        tool,
        status,
        inputSummary: summary,
        outputSummary: null,
        metadata: null
      }
    });
    return activity.id;
  }

  /**
   * Complete activity
   */
  private async completeActivity(id: number, summary: string): Promise<void> {
    await db.toolActivity.update({
      where: { id },
      data: {
        status: 'done',
        outputSummary: summary
      }
    });
  }
}

// ========================================
// Factory Function
// ========================================

export function createSearchPipeline(correlationId?: string): SearchPipeline {
  return new SearchPipeline(correlationId);
}

export default SearchPipeline;
