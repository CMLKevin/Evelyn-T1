import { getOpenRouterConfig, validateOpenRouterConfig, getSanitizedKeyInfo } from '../config/openrouterConfig.js';
import type { GrokTool, GrokToolChoice, GrokReasoningConfig, GrokAgentResponse, GrokAgentMessage } from './grokAgentTools.js';
import { supportsGrokAgentTools, getResponseContent, extractCitations, formatCitationsMarkdown } from './grokAgentTools.js';

validateOpenRouterConfig();

const config = getOpenRouterConfig();

const MODEL_CHAT = config.models.chat;
const MODEL_THINK_SIMPLE = config.models.thinkSimple;
const MODEL_THINK_COMPLEX = config.models.thinkComplex;
const MODEL_AGENT = config.models.agent;
const EMBEDDING_MODEL = config.models.embedding;

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface VisionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
      detail?: 'low' | 'high' | 'auto';
    };
  }>;
}

interface StreamChunk {
  choices?: Array<{
    delta?: {
      content?: string;
    };
    finish_reason?: string;
  }>;
}

interface EmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  id: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
    cost: number;
  };
}

interface CompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Grok Agent Tools request options
interface AgentToolsOptions {
  tools?: GrokTool[];
  tool_choice?: GrokToolChoice;
  reasoning?: GrokReasoningConfig;
  includeCitations?: boolean;
}

interface ProviderPreferences {
  order?: string[];
  require_parameters?: boolean;
  data_collection?: 'allow' | 'deny';
  quantizations?: string[];
}

export interface OpenRouterErrorPayload {
  error?: {
    message?: string;
    code?: number | string;
    type?: string;
  };
  [key: string]: any;
}

export interface OpenRouterErrorInfo {
  status: number;
  code?: number | string;
  message: string;
  rawBody?: string;
  endpoint: 'chat' | 'embeddings' | 'vision';
  model?: string;
  requestId?: string | null;
}

export interface OpenRouterDiagnosticsStatus {
  configured: boolean;
  apiKeyPresent: boolean;
  apiKeyPrefix?: string;
  baseUrl: string;
  models: {
    chat: string;
    thinkSimple: string;
    thinkComplex: string;
    agent: string;
    embedding: string;
  };
  lastError?: OpenRouterErrorInfo;
  advice?: string;
}

// Baseten FP4 provider configuration for Kimi K2
const BASETEN_FP4_PROVIDER: ProviderPreferences = {
  order: ['Baseten'],
  require_parameters: true,
  data_collection: 'deny',
  quantizations: ['fp4'],
};

// DeepInfra FP4 provider configuration
const DEEPINFRA_FP4_PROVIDER: ProviderPreferences = {
  order: ['DeepInfra'],
  require_parameters: true,
  data_collection: 'deny',
  quantizations: ['fp4'],
};

// Moonshot AI provider configuration
const MOONSHOT_PROVIDER: ProviderPreferences = {
  order: ['moonshotai'],
  require_parameters: true,
  data_collection: 'deny',
};

// xAI/Grok provider configuration (no special routing needed)
const XAI_PROVIDER: ProviderPreferences = {
  data_collection: 'deny',
};

// Models that support reasoning tokens
const REASONING_MODELS = [
  'x-ai/grok-4.1',
  'x-ai/grok-4.1-fast',
  'x-ai/grok-4.1:free',
  'x-ai/grok-4.1-fast:free',
  'x-ai/grok-3',
  'x-ai/grok-3-fast',
];

/**
 * Check if a model supports reasoning and return the reasoning config
 */
function getReasoningConfig(model: string): { effort: string; exclude: boolean } | null {
  const normalizedModel = model.toLowerCase();
  if (REASONING_MODELS.some(m => normalizedModel.includes(m.toLowerCase()))) {
    return {
      effort: 'medium',  // Use medium effort for balanced performance
      exclude: true,     // Don't include reasoning in response (cleaner output)
    };
  }
  return null;
}

class OpenRouterClient {
  private baseUrl: string;
  private apiKey: string;
  private referer: string;
  private title: string;
  private lastError?: OpenRouterErrorInfo;

  constructor() {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.referer = config.referer;
    this.title = config.title;
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': this.referer,
      'X-Title': this.title,
    };
  }

  private parseError(
    status: number,
    body: string,
    endpoint: 'chat' | 'embeddings' | 'vision',
    model?: string,
  ): OpenRouterErrorInfo {
    let message = `HTTP ${status}`;
    let code: number | string | undefined;
    let requestId: string | null = null;

    if (body) {
      try {
        const parsed = JSON.parse(body) as OpenRouterErrorPayload;
        if (parsed?.error) {
          message = parsed.error.message || message;
          code = parsed.error.code;
        } else if (typeof (parsed as any).message === 'string') {
          message = (parsed as any).message;
        }
        if (typeof (parsed as any).request_id === 'string') {
          requestId = (parsed as any).request_id;
        }
      } catch {
        message = body.slice(0, 2000);
      }
    }

    if (status === 401 && !/user not found/i.test(message)) {
      message = `${message} (User not found or API key not recognized by OpenRouter)`;
    }

    return {
      status,
      code,
      message,
      rawBody: body,
      endpoint,
      model,
      requestId,
    };
  }

  getDiagnostics(): OpenRouterDiagnosticsStatus {
    const currentConfig = getOpenRouterConfig();
    const apiKeyPresent = !!currentConfig.apiKey;
    const configured = apiKeyPresent && !!currentConfig.baseUrl;

    let advice: string | undefined;
    if (!apiKeyPresent) {
      advice =
        'OPENROUTER_API_KEY is missing. Set it in server/.env using a key from https://openrouter.ai/keys.';
    } else if (this.lastError?.status === 401) {
      advice =
        'OpenRouter returned 401 ("User not found"). Verify that OPENROUTER_API_KEY is correct, not revoked, and belongs to an active OpenRouter account.';
    }

    return {
      configured,
      apiKeyPresent,
      apiKeyPrefix: getSanitizedKeyInfo(currentConfig.apiKey),
      baseUrl: currentConfig.baseUrl,
      models: currentConfig.models,
      lastError: this.lastError,
      advice,
    };
  }

  async *streamChat(
    messages: Message[],
    model?: string,
    provider?: ProviderPreferences,
    timeoutMs: number = 60000,
  ): AsyncGenerator<string> {
    const selectedModel = model || MODEL_CHAT;
    console.log(`[OpenRouter] Starting stream chat with model: ${selectedModel} (timeout: ${timeoutMs}ms)`);
    if (provider) {
      console.log(`[OpenRouter] Using provider preferences:`, provider);
    }
    console.log(
      `[OpenRouter] Messages: ${messages.length}, total tokens ~${messages.reduce(
        (sum, m) => sum + m.content.length / 4,
        0,
      )}`,
    );

    // Setup abort controller for timeout
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let lastActivityTime = Date.now();
    let accumulatedContent = '';

    // Helper to reset activity timer
    const resetActivityTimer = () => {
      lastActivityTime = Date.now();
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.warn(`[OpenRouter] Stream timeout after ${timeoutMs}ms of inactivity`);
        controller.abort();
      }, timeoutMs);
    };

    try {
      const requestBody: any = {
        model: selectedModel,
        messages,
        stream: true,
        temperature: 0.75,
        max_tokens: 8192, // Doubled from 4096 for longer responses
      };

      if (provider) {
        requestBody.provider = provider;
      }

      // Add reasoning config for supported models (Grok, etc.)
      const reasoningConfig = getReasoningConfig(selectedModel);
      if (reasoningConfig) {
        requestBody.reasoning = reasoningConfig;
        console.log(`[OpenRouter] Reasoning enabled: effort=${reasoningConfig.effort}`);
      }

      // Start the activity timer
      resetActivityTimer();

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (timeoutId) clearTimeout(timeoutId);
        const errorBody = await response.text();
        const info = this.parseError(response.status, errorBody, 'chat', selectedModel);
        this.lastError = info;
        const keyInfo = getSanitizedKeyInfo(this.apiKey);
        console.error(
          `[OpenRouter] Stream chat error ${info.status} (code=${info.code ?? 'n/a'}) model=${selectedModel} message=${info.message} key=${keyInfo} base=${this.baseUrl}`,
        );
        if (info.status === 401) {
          throw new Error(
            `OpenRouter chat auth error 401 (${info.message}) – check your OPENROUTER_API_KEY and OpenRouter account; this usually means the key is invalid or the user is not recognized by OpenRouter.`,
          );
        }
        throw new Error(`OpenRouter chat error ${info.status}: ${info.message}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let tokenCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Reset timeout on activity
        resetActivityTimer();

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              if (timeoutId) clearTimeout(timeoutId);
              console.log(
                `[OpenRouter] Stream complete, generated ${tokenCount} tokens`,
              );
              return;
            }

            try {
              const parsed: StreamChunk = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                tokenCount++;
                accumulatedContent += content;
                yield content;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      if (timeoutId) clearTimeout(timeoutId);
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);

      // Handle timeout with partial response recovery
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
        const elapsed = Date.now() - lastActivityTime;
        console.error(`[OpenRouter] Stream timeout after ${elapsed}ms of inactivity. Accumulated ${accumulatedContent.length} chars.`);

        // If we have substantial content, don't throw - just end the stream
        if (accumulatedContent.length > 100) {
          console.log('[OpenRouter] Partial response recovered, ending stream gracefully');
          return;
        }

        throw new Error(
          `OpenRouter stream timeout: No response received for ${timeoutMs}ms. ` +
          `The model may be overloaded or the request too complex. ` +
          `Try again or use a simpler request.`
        );
      }

      console.error('[OpenRouter] Stream chat error:', error);
      throw error;
    }
  }

  async complete(
    messages: Message[],
    model: string = MODEL_CHAT,
    provider?: ProviderPreferences,
    temperature: number = 0.7,
  ): Promise<string> {
    console.log(`[OpenRouter] Completion request with model: ${model}, temperature: ${temperature}`);
    if (provider) {
      console.log(`[OpenRouter] Using provider preferences:`, provider);
    }

    const requestBody: any = {
      model,
      messages,
      stream: false,
      temperature,
      max_tokens: 8192, // Doubled from 4096 for longer responses
    };

    if (provider) {
      requestBody.provider = provider;
    }

    // Add reasoning config for supported models (Grok, etc.)
    const reasoningConfig = getReasoningConfig(model);
    if (reasoningConfig) {
      requestBody.reasoning = reasoningConfig;
      console.log(`[OpenRouter] Reasoning enabled: effort=${reasoningConfig.effort}`);
    }

    // Add timeout to prevent hanging requests (60 seconds for completion)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        const info = this.parseError(response.status, errorBody, 'chat', model);
        this.lastError = info;
        const keyInfo = getSanitizedKeyInfo(this.apiKey);
        console.error(
          `[OpenRouter] Completion error ${info.status} (code=${info.code ?? 'n/a'}) model=${model} message=${info.message} key=${keyInfo} base=${this.baseUrl}`,
        );
        if (info.status === 401) {
          throw new Error(
            `OpenRouter chat auth error 401 (${info.message}) – check your OPENROUTER_API_KEY and OpenRouter account; this usually means the key is invalid or the user is not recognized by OpenRouter.`,
          );
        }
        throw new Error(`OpenRouter chat error ${info.status}: ${info.message}`);
      }

      const data = (await response.json()) as CompletionResponse;
      return data.choices[0].message.content;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('terminated')) {
          throw new Error(
            'OpenRouter request timeout: The request took too long or the connection was closed. This may be due to network issues or the API being temporarily unavailable.',
          );
        }
        throw error;
      }
      throw error as Error;
    }
  }

  /**
   * Complete with automatic fallback on rate limiting (403/429)
   * Uses moonshotai/kimi-k2-thinking as fallback model
   */
  async completeWithFallback(
    messages: Message[],
    model: string = MODEL_CHAT,
    provider?: ProviderPreferences,
    temperature: number = 0.7,
    fallbackModel: string = 'moonshotai/kimi-k2-thinking',
  ): Promise<string> {
    try {
      return await this.complete(messages, model, provider, temperature);
    } catch (error) {
      const isRateLimited = error instanceof Error && (
        error.message.includes('403') || 
        error.message.includes('429') || 
        error.message.includes('rate') ||
        error.message.includes('quota')
      );
      
      if (isRateLimited) {
        console.warn(`[OpenRouter] Rate limited on ${model}, falling back to ${fallbackModel}...`);
        // Retry with fallback model (no provider preferences to maximize compatibility)
        return await this.complete(messages, fallbackModel, undefined, temperature);
      }
      
      throw error;
    }
  }

  async simpleThought(prompt: string, model?: string): Promise<string> {
    const selectedModel = model || MODEL_THINK_SIMPLE;
    const provider = this.getProviderForModel(selectedModel);
    console.log(
      `[OpenRouter] Simple thought with model: ${selectedModel}`,
    );
    return this.complete(
      [{ role: 'user', content: prompt }],
      selectedModel,
      provider,
    );
  }

  async complexThought(prompt: string): Promise<string> {
    const provider = this.getProviderForModel(MODEL_THINK_COMPLEX);
    console.log(
      `[OpenRouter] Complex thought with model: ${MODEL_THINK_COMPLEX}`,
    );
    return this.complete(
      [{ role: 'user', content: prompt }],
      MODEL_THINK_COMPLEX,
      provider,
    );
  }

  /**
   * Get appropriate provider preferences for a model
   * Grok/xAI models don't need special provider routing
   */
  private getProviderForModel(model: string): ProviderPreferences | undefined {
    // xAI/Grok models route directly through xAI
    if (model.includes('grok') || model.includes('x-ai')) {
      return XAI_PROVIDER;
    }
    // Kimi/Moonshot models
    if (model.includes('kimi') || model.includes('moonshot')) {
      return BASETEN_FP4_PROVIDER;
    }
    // Default: no special provider
    return undefined;
  }

  async embed(text: string): Promise<number[]> {
    try {
      // Add timeout to prevent hanging on slow/failing API responses
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: text,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        const info = this.parseError(
          response.status,
          errorBody,
          'embeddings',
          EMBEDDING_MODEL,
        );
        this.lastError = info;
        const keyInfo = getSanitizedKeyInfo(this.apiKey);
        console.error(
          `[OpenRouter] Embedding error ${info.status} (code=${info.code ?? 'n/a'}) model=${EMBEDDING_MODEL} message=${info.message} key=${keyInfo} base=${this.baseUrl}`,
        );
        if (info.status === 401) {
          throw new Error(
            `OpenRouter embedding auth error 401 (${info.message}) – your OPENROUTER_API_KEY is likely invalid or not associated with an active OpenRouter account.`,
          );
        }
        throw new Error(`OpenRouter embedding error ${info.status}: ${info.message}`);
      }

      const data = (await response.json()) as EmbeddingResponse;

      if (!data || data.object !== 'list') {
        console.error(
          `[OpenRouter] Invalid embedding response object:`,
          JSON.stringify(data),
        );
        throw new Error(
          'OpenRouter returned invalid embedding response: object is not "list"',
        );
      }

      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        console.error(
          `[OpenRouter] Invalid embedding response data:`,
          JSON.stringify(data),
        );
        throw new Error(
          'OpenRouter returned invalid embedding response: missing or empty data array',
        );
      }

      const firstEmbedding = data.data[0];
      if (!firstEmbedding || firstEmbedding.object !== 'embedding') {
        console.error(
          `[OpenRouter] Invalid embedding data object:`,
          JSON.stringify(firstEmbedding),
        );
        throw new Error(
          'OpenRouter returned invalid embedding data: object is not "embedding"',
        );
      }

      if (!firstEmbedding.embedding || !Array.isArray(firstEmbedding.embedding)) {
        console.error(
          `[OpenRouter] Invalid embedding format:`,
          JSON.stringify(firstEmbedding),
        );
        throw new Error(
          'OpenRouter returned invalid embedding format: embedding is not an array',
        );
      };
      return firstEmbedding.embedding;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[OpenRouter] Embedding request timeout (10s) - API too slow');
        throw new Error('OpenRouter embedding timeout: API response took longer than 10 seconds');
      }
      console.error('[OpenRouter] Embedding request failed:', error);
      throw error;
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    console.log(
      `[OpenRouter] Batch embedding request for ${texts.length} texts with model: ${EMBEDDING_MODEL}`,
    );
    try {
      // Add timeout to prevent hanging on slow/failing API responses
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for batch
      
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: texts,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        const info = this.parseError(
          response.status,
          errorBody,
          'embeddings',
          EMBEDDING_MODEL,
        );
        this.lastError = info;
        const keyInfo = getSanitizedKeyInfo(this.apiKey);
        console.error(
          `[OpenRouter] Batch embedding error ${info.status} (code=${info.code ?? 'n/a'}) model=${EMBEDDING_MODEL} message=${info.message} key=${keyInfo} base=${this.baseUrl}`,
        );
        if (info.status === 401) {
          throw new Error(
            `OpenRouter embedding auth error 401 (${info.message}) – your OPENROUTER_API_KEY is likely invalid or not associated with an active OpenRouter account.`,
          );
        }
        throw new Error(`OpenRouter embedding error ${info.status}: ${info.message}`);
      }

      const data = (await response.json()) as EmbeddingResponse;

      if (!data || data.object !== 'list') {
        console.error(
          `[OpenRouter] Invalid batch embedding response object:`,
          JSON.stringify(data),
        );
        throw new Error(
          'OpenRouter returned invalid batch embedding response: object is not "list"',
        );
      }

      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        console.error(
          `[OpenRouter] Invalid batch embedding response data:`,
          JSON.stringify(data),
        );
        throw new Error(
          'OpenRouter returned invalid batch embedding response: missing or empty data array',
        );
      }

      if (data.data.length !== texts.length) {
        console.warn(
          `[OpenRouter] Batch embedding count mismatch: expected ${texts.length}, got ${data.data.length}`,
        );
      }

      const embeddings: number[][] = [];
      for (let i = 0; i < data.data.length; i++) {
        const embeddingData = data.data[i];

        if (!embeddingData || embeddingData.object !== 'embedding') {
          console.error(
            `[OpenRouter] Invalid embedding data object at index ${i}:`,
            JSON.stringify(embeddingData),
          );
          throw new Error(
            `OpenRouter returned invalid embedding data at index ${i}: object is not "embedding"`,
          );
        }

        if (!embeddingData.embedding || !Array.isArray(embeddingData.embedding)) {
          console.error(
            `[OpenRouter] Invalid embedding format at index ${i}:`,
            JSON.stringify(embeddingData),
          );
          throw new Error(
            `OpenRouter returned invalid embedding format at index ${i}: embedding is not an array`,
          );
        }

        embeddings.push(embeddingData.embedding);
      }

      console.log(
        `[OpenRouter] Batch embeddings received: ${embeddings.length} embeddings, tokens: ${
          data.usage?.prompt_tokens ?? 'unknown'
        }`,
      );
      return embeddings;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[OpenRouter] Batch embedding request timeout (15s) - API too slow');
        throw new Error('OpenRouter batch embedding timeout: API response took longer than 15 seconds');
      }
      console.error('[OpenRouter] Batch embedding request failed:', error);
      throw error;
    }
  }

  async completeWithModel(
    messages: Message[],
    model: string,
    provider?: ProviderPreferences,
  ): Promise<string> {
    return this.complete(messages, model, provider);
  }

  /**
   * Complete with Grok Agent Tools enabled
   * Supports: web_search, x_search, code_execution, collections_search, mcp
   */
  async completeWithAgentTools(
    messages: Message[],
    agentOptions: AgentToolsOptions = {},
    model?: string,
    provider?: ProviderPreferences,
    temperature: number = 0.7,
  ): Promise<{ content: string; citations?: string; raw: GrokAgentResponse }> {
    const selectedModel = model || 'x-ai/grok-4.1-fast:free';
    
    if (!supportsGrokAgentTools(selectedModel)) {
      console.warn(`[OpenRouter] Model ${selectedModel} may not support Grok agent tools`);
    }
    
    console.log(`[OpenRouter] Agent tools request with model: ${selectedModel}`);
    console.log(`[OpenRouter] Tools enabled:`, agentOptions.tools?.map(t => t.type) || 'none');
    if (agentOptions.reasoning?.enabled) {
      console.log(`[OpenRouter] Reasoning traces enabled`);
    }

    const requestBody: any = {
      model: selectedModel,
      messages,
      stream: false,
      temperature,
      max_tokens: agentOptions.reasoning?.max_tokens || 8192,
    };

    // Add agent tools configuration
    if (agentOptions.tools && agentOptions.tools.length > 0) {
      requestBody.tools = agentOptions.tools;
      requestBody.tool_choice = agentOptions.tool_choice || 'auto';
    }

    // Add reasoning configuration
    if (agentOptions.reasoning) {
      requestBody.reasoning = agentOptions.reasoning;
    }

    if (provider) {
      requestBody.provider = provider;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout for agent tasks

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        const info = this.parseError(response.status, errorBody, 'chat', selectedModel);
        this.lastError = info;
        console.error(`[OpenRouter] Agent tools error ${info.status}: ${info.message}`);
        throw new Error(`OpenRouter agent tools error ${info.status}: ${info.message}`);
      }

      const data = (await response.json()) as GrokAgentResponse;
      const content = getResponseContent(data);
      const citations = extractCitations(data);
      
      console.log(`[OpenRouter] Agent response received, tokens: ${data.usage?.total_tokens || 'unknown'}`);
      if (citations.length > 0) {
        console.log(`[OpenRouter] Citations found: ${citations.length}`);
      }

      return {
        content: agentOptions.includeCitations && citations.length > 0 
          ? content + formatCitationsMarkdown(citations)
          : content,
        citations: citations.length > 0 ? formatCitationsMarkdown(citations) : undefined,
        raw: data,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('OpenRouter agent tools request timeout (120s)');
      }
      throw error;
    }
  }

  /**
   * Stream completion with Grok Agent Tools enabled
   */
  async *streamWithAgentTools(
    messages: Message[],
    agentOptions: AgentToolsOptions = {},
    model?: string,
    provider?: ProviderPreferences,
  ): AsyncGenerator<string> {
    const selectedModel = model || 'x-ai/grok-4.1-fast:free';
    
    console.log(`[OpenRouter] Agent tools stream with model: ${selectedModel}`);
    console.log(`[OpenRouter] Tools:`, agentOptions.tools?.map(t => t.type) || 'none');

    const requestBody: any = {
      model: selectedModel,
      messages,
      stream: true,
      temperature: 0.75,
      max_tokens: 8192,
    };

    if (agentOptions.tools && agentOptions.tools.length > 0) {
      requestBody.tools = agentOptions.tools;
      requestBody.tool_choice = agentOptions.tool_choice || 'auto';
    }

    if (agentOptions.reasoning) {
      requestBody.reasoning = agentOptions.reasoning;
    }

    if (provider) {
      requestBody.provider = provider;
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        const info = this.parseError(response.status, errorBody, 'chat', selectedModel);
        this.lastError = info;
        throw new Error(`OpenRouter agent stream error ${info.status}: ${info.message}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let tokenCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              console.log(`[OpenRouter] Agent stream complete, ${tokenCount} tokens`);
              return;
            }

            try {
              const parsed: StreamChunk = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                tokenCount++;
                yield content;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('[OpenRouter] Agent stream error:', error);
      throw error;
    }
  }

  /**
   * Web search using Grok's native web_search tool
   */
  async webSearch(query: string, includeCitations: boolean = true): Promise<string> {
    console.log(`[OpenRouter] Web search: "${query.slice(0, 50)}..."`);
    
    const result = await this.completeWithAgentTools(
      [{ role: 'user', content: query }],
      {
        tools: [{ type: 'web_search' }],
        tool_choice: 'auto',
        includeCitations,
      }
    );
    
    return result.content;
  }

  /**
   * X/Twitter search using Grok's native x_search tool
   */
  async xSearch(query: string, includeCitations: boolean = true): Promise<string> {
    console.log(`[OpenRouter] X search: "${query.slice(0, 50)}..."`);
    
    const result = await this.completeWithAgentTools(
      [{ role: 'user', content: query }],
      {
        tools: [{ type: 'x_search' }],
        tool_choice: 'auto',
        includeCitations,
      }
    );
    
    return result.content;
  }

  /**
   * Execute Python code using Grok's native code_execution tool
   */
  async executeCode(task: string): Promise<string> {
    console.log(`[OpenRouter] Code execution: "${task.slice(0, 50)}..."`);
    
    const result = await this.completeWithAgentTools(
      [{ role: 'user', content: task }],
      {
        tools: [{ type: 'code_execution' }],
        tool_choice: 'auto',
      }
    );
    
    return result.content;
  }

  /**
   * Research task using all available Grok tools
   */
  async research(
    query: string,
    options: { reasoning?: boolean; includeCitations?: boolean } = {}
  ): Promise<string> {
    console.log(`[OpenRouter] Research task: "${query.slice(0, 50)}..."`);
    
    const result = await this.completeWithAgentTools(
      [{ role: 'user', content: query }],
      {
        tools: [
          { type: 'web_search' },
          { type: 'x_search' },
          { type: 'code_execution' },
        ],
        tool_choice: 'auto',
        reasoning: options.reasoning ? { enabled: true } : undefined,
        includeCitations: options.includeCitations ?? true,
      }
    );
    
    return result.content;
  }

  async completeVision(
    messages: VisionMessage[],
    model?: string,
  ): Promise<string> {
    const selectedModel = model || MODEL_AGENT;
    console.log(`[OpenRouter] Vision completion with model: ${selectedModel}`);
    console.log(`[OpenRouter] Messages: ${messages.length}`);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: selectedModel,
        messages,
        stream: false,
        temperature: 0.7,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const info = this.parseError(response.status, errorBody, 'vision', selectedModel);
      this.lastError = info;
      const keyInfo = getSanitizedKeyInfo(this.apiKey);
      console.error(
        `[OpenRouter] Vision completion error ${info.status} (code=${info.code ?? 'n/a'}) model=${selectedModel} message=${info.message} key=${keyInfo} base=${this.baseUrl}`,
      );
      if (info.status === 401) {
        throw new Error(
          `OpenRouter vision auth error 401 (${info.message}) – check your OPENROUTER_API_KEY and OpenRouter account; this usually means the key is invalid or the user is not recognized by OpenRouter.`,
        );
      }
      throw new Error(`OpenRouter vision error ${info.status}: ${info.message}`);
    }

    const data = (await response.json()) as CompletionResponse;
    return data.choices[0].message.content;
  }
}

export const openRouterClient = new OpenRouterClient();

// Export provider configurations for external use
export { BASETEN_FP4_PROVIDER, DEEPINFRA_FP4_PROVIDER, MOONSHOT_PROVIDER, XAI_PROVIDER };

// Export types for external use
export type { ProviderPreferences, Message, VisionMessage, AgentToolsOptions };

// Re-export Grok Agent Tools types and utilities
export * from './grokAgentTools.js';
