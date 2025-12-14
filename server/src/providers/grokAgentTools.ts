/**
 * Grok Agent Tools API Types and Utilities
 * 
 * Supports xAI's Grok 4.1 server-side agentic capabilities:
 * - web_search: Real-time web browsing
 * - x_search: X/Twitter post searching
 * - code_execution: Secure Python REPL execution
 * - collections_search: Document retrieval with citations
 * - mcp: External tool servers via Modular Compute Protocol
 * 
 * These tools run entirely on xAI's infrastructure - Grok decides when
 * to invoke them (often in parallel), so you don't manage execution.
 */

// ========================================
// Tool Types
// ========================================

export type GrokToolType = 
  | 'web_search' 
  | 'x_search' 
  | 'code_execution' 
  | 'collections_search' 
  | 'mcp'
  | 'function';

export interface GrokWebSearchTool {
  type: 'web_search';
}

export interface GrokXSearchTool {
  type: 'x_search';
}

export interface GrokCodeExecutionTool {
  type: 'code_execution';
}

export interface GrokCollectionsSearchTool {
  type: 'collections_search';
  collection_ids?: string[];
}

export interface GrokMCPTool {
  type: 'mcp';
  server_url?: string;
}

export interface GrokFunctionTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description?: string;
        enum?: string[];
      }>;
      required?: string[];
    };
  };
}

export type GrokTool = 
  | GrokWebSearchTool 
  | GrokXSearchTool 
  | GrokCodeExecutionTool 
  | GrokCollectionsSearchTool 
  | GrokMCPTool
  | GrokFunctionTool;

// ========================================
// Tool Choice
// ========================================

export type GrokToolChoice = 
  | 'auto'      // Let Grok decide when to use tools
  | 'none'      // Disable tool usage
  | 'required'  // Force tool usage
  | { type: 'function'; function: { name: string } };  // Force specific function

// ========================================
// Reasoning Configuration
// ========================================

export interface GrokReasoningConfig {
  enabled: boolean;
  /** Maximum tokens for reasoning (optional) */
  max_tokens?: number;
}

// ========================================
// Response Types
// ========================================

export interface GrokToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface GrokReasoningDetails {
  steps: Array<{
    type: string;
    content: string;
  }>;
}

export interface GrokCitation {
  url: string;
  title?: string;
  snippet?: string;
}

export interface GrokAgentMessage {
  role: 'assistant';
  content: string | null;
  tool_calls?: GrokToolCall[];
  reasoning_details?: GrokReasoningDetails;
  citations?: GrokCitation[];
}

export interface GrokAgentResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: GrokAgentMessage;
    finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    reasoning_tokens?: number;
  };
}

// ========================================
// Request Options
// ========================================

export interface GrokAgentOptions {
  /** Enable specific agent tools */
  tools?: GrokTool[];
  /** How Grok should choose tools */
  tool_choice?: GrokToolChoice;
  /** Enable reasoning traces */
  reasoning?: GrokReasoningConfig;
  /** Temperature (0-2) */
  temperature?: number;
  /** Max output tokens */
  max_tokens?: number;
  /** Enable streaming */
  stream?: boolean;
}

// ========================================
// Preset Configurations
// ========================================

/** All agent tools enabled - maximum capability */
export const GROK_TOOLS_ALL: GrokTool[] = [
  { type: 'web_search' },
  { type: 'x_search' },
  { type: 'code_execution' },
  { type: 'collections_search' },
];

/** Web search only - for research tasks */
export const GROK_TOOLS_RESEARCH: GrokTool[] = [
  { type: 'web_search' },
  { type: 'x_search' },
];

/** Code execution only - for coding/math tasks */
export const GROK_TOOLS_CODE: GrokTool[] = [
  { type: 'code_execution' },
];

/** Web + Code - common combination */
export const GROK_TOOLS_WEB_CODE: GrokTool[] = [
  { type: 'web_search' },
  { type: 'code_execution' },
];

// ========================================
// Helper Functions
// ========================================

/**
 * Check if a model supports Grok agent tools
 */
export function supportsGrokAgentTools(model: string): boolean {
  const grokModels = [
    'x-ai/grok-4-1-fast',
    'x-ai/grok-4-1-fast:free',
    'x-ai/grok-4.1-fast',
    'x-ai/grok-4.1-fast:free',
    'x-ai/grok-4',
    'x-ai/grok-4:free',
  ];
  return grokModels.some(m => model.toLowerCase().includes(m.toLowerCase().replace('x-ai/', '')));
}

/**
 * Create a custom function tool definition
 */
export function createFunctionTool(
  name: string,
  description: string,
  parameters: Record<string, { type: string; description?: string; enum?: string[] }>,
  required?: string[]
): GrokFunctionTool {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties: parameters,
        required,
      },
    },
  };
}

/**
 * Parse tool call arguments safely
 */
export function parseToolArguments<T = Record<string, unknown>>(toolCall: GrokToolCall): T | null {
  try {
    return JSON.parse(toolCall.function.arguments) as T;
  } catch {
    console.error(`[GrokTools] Failed to parse tool arguments for ${toolCall.function.name}`);
    return null;
  }
}

/**
 * Extract citations from agent response
 */
export function extractCitations(response: GrokAgentResponse): GrokCitation[] {
  const citations: GrokCitation[] = [];
  for (const choice of response.choices) {
    if (choice.message.citations) {
      citations.push(...choice.message.citations);
    }
  }
  return citations;
}

/**
 * Extract reasoning steps from agent response
 */
export function extractReasoningSteps(response: GrokAgentResponse): string[] {
  const steps: string[] = [];
  for (const choice of response.choices) {
    if (choice.message.reasoning_details?.steps) {
      for (const step of choice.message.reasoning_details.steps) {
        steps.push(step.content);
      }
    }
  }
  return steps;
}

/**
 * Check if response contains tool calls that need handling
 */
export function hasToolCalls(response: GrokAgentResponse): boolean {
  return response.choices.some(
    choice => choice.finish_reason === 'tool_calls' || 
              (choice.message.tool_calls && choice.message.tool_calls.length > 0)
  );
}

/**
 * Get the primary content from agent response
 */
export function getResponseContent(response: GrokAgentResponse): string {
  return response.choices[0]?.message?.content || '';
}

/**
 * Format citations as markdown
 */
export function formatCitationsMarkdown(citations: GrokCitation[]): string {
  if (citations.length === 0) return '';
  
  let md = '\n\n---\n**Sources:**\n';
  citations.forEach((cite, i) => {
    md += `${i + 1}. [${cite.title || cite.url}](${cite.url})`;
    if (cite.snippet) {
      md += ` - ${cite.snippet}`;
    }
    md += '\n';
  });
  return md;
}
