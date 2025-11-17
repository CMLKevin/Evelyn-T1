import dotenv from 'dotenv';

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE = process.env.OPENROUTER_BASE || 'https://openrouter.ai/api/v1';
const MODEL_CHAT = process.env.MODEL_CHAT || 'moonshotai/kimi-k2-0905';
const MODEL_THINK_SIMPLE = process.env.MODEL_THINK_SIMPLE || 'moonshotai/kimi-k2-0905';
const MODEL_THINK_COMPLEX = process.env.MODEL_THINK_COMPLEX || 'moonshotai/kimi-k2-0905';
const MODEL_AGENT = process.env.MODEL_AGENT || 'z-ai/glm-4.5v';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'qwen/qwen3-embedding-8b';

if (!OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY environment variable is required');
}

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

interface ProviderPreferences {
  order?: string[];
  require_parameters?: boolean;
  data_collection?: 'allow' | 'deny';
  quantizations?: string[];
}

// Baseten FP4 provider configuration for Kimi K2
const BASETEN_FP4_PROVIDER: ProviderPreferences = {
  order: ['Baseten'],
  require_parameters: true,
  data_collection: 'deny',
  quantizations: ['fp4']
};

// DeepInfra FP4 provider configuration
const DEEPINFRA_FP4_PROVIDER: ProviderPreferences = {
  order: ['DeepInfra'],
  require_parameters: true,
  data_collection: 'deny',
  quantizations: ['fp4']
};

// Moonshot AI provider configuration
const MOONSHOT_PROVIDER: ProviderPreferences = {
  order: ['moonshotai'],
  require_parameters: true,
  data_collection: 'deny'
};

class OpenRouterClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = OPENROUTER_BASE;
    this.apiKey = OPENROUTER_API_KEY!; // Non-null assertion safe due to check at line 13-15
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://evelyn-chat.local',
      'X-Title': 'Evelyn Agentic AI'
    };
  }

  async *streamChat(messages: Message[], model?: string, provider?: ProviderPreferences): AsyncGenerator<string> {
    const selectedModel = model || MODEL_CHAT;
    console.log(`[OpenRouter] Starting stream chat with model: ${selectedModel}`);
    if (provider) {
      console.log(`[OpenRouter] Using provider preferences:`, provider);
    }
    console.log(`[OpenRouter] Messages: ${messages.length}, total tokens ~${messages.reduce((sum, m) => sum + m.content.length / 4, 0)}`);
    
    try {
      const requestBody: any = {
        model: selectedModel,
        messages,
        stream: true,
        temperature: 0.75,
        max_tokens: 8192  // Doubled from 4096 for longer responses
      };

      if (provider) {
        requestBody.provider = provider;
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[OpenRouter] Stream error ${response.status}:`, error);
        throw new Error(`OpenRouter error: ${response.status} ${error}`);
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
              console.log(`[OpenRouter] Stream complete, generated ${tokenCount} tokens`);
              return;
            }
            
            try {
              const parsed: StreamChunk = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                tokenCount++;
                yield content;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('[OpenRouter] Stream chat error:', error);
      throw error;
    }
  }

  async complete(messages: Message[], model: string = MODEL_CHAT, provider?: ProviderPreferences): Promise<string> {
    console.log(`[OpenRouter] Completion request with model: ${model}`);
    if (provider) {
      console.log(`[OpenRouter] Using provider preferences:`, provider);
    }

    const requestBody: any = {
      model,
      messages,
      stream: false,
      temperature: 0.7,
      max_tokens: 8192  // Doubled from 4096 for longer responses
    };

    if (provider) {
      requestBody.provider = provider;
    }

    // Add timeout to prevent hanging requests (60 seconds for completion)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter error: ${response.status} ${error}`);
      }

      const data = await response.json() as CompletionResponse;
      return data.choices[0].message.content;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Handle abort/timeout errors
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('terminated')) {
          throw new Error(`OpenRouter request timeout: The request took too long or the connection was closed. This may be due to network issues or the API being temporarily unavailable.`);
        }
        // Re-throw other errors as-is
        throw error;
      }
      throw error;
    }
  }

  async simpleThought(prompt: string): Promise<string> {
    console.log(`[OpenRouter] Simple thought with model: ${MODEL_THINK_SIMPLE} via Baseten FP4`);
    return this.complete([{ role: 'user', content: prompt }], MODEL_THINK_SIMPLE, BASETEN_FP4_PROVIDER);
  }

  async complexThought(prompt: string): Promise<string> {
    console.log(`[OpenRouter] Complex thought with model: ${MODEL_THINK_COMPLEX} via Baseten FP4`);
    return this.complete([{ role: 'user', content: prompt }], MODEL_THINK_COMPLEX, BASETEN_FP4_PROVIDER);
  }

  async embed(text: string): Promise<number[]> {
    console.log(`[OpenRouter] Embedding request for model: ${EMBEDDING_MODEL}`);
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: text
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[OpenRouter] Embedding error ${response.status}:`, error);
        
        // Try to parse OpenRouter error format
        try {
          const errorData = JSON.parse(error);
          if (errorData.error) {
            throw new Error(`OpenRouter embedding error: ${errorData.error.message || errorData.error}`);
          }
        } catch {
          // If not JSON, use raw error
        }
        
        throw new Error(`OpenRouter embedding error: ${response.status} ${error}`);
      }

      const data = await response.json() as EmbeddingResponse;
      
      // Validate response structure according to OpenRouter spec
      if (!data || data.object !== 'list') {
        console.error(`[OpenRouter] Invalid embedding response object:`, JSON.stringify(data));
        throw new Error('OpenRouter returned invalid embedding response: object is not "list"');
      }
      
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        console.error(`[OpenRouter] Invalid embedding response data:`, JSON.stringify(data));
        throw new Error('OpenRouter returned invalid embedding response: missing or empty data array');
      }
      
      const firstEmbedding = data.data[0];
      if (!firstEmbedding || firstEmbedding.object !== 'embedding') {
        console.error(`[OpenRouter] Invalid embedding data object:`, JSON.stringify(firstEmbedding));
        throw new Error('OpenRouter returned invalid embedding data: object is not "embedding"');
      }
      
      if (!firstEmbedding.embedding || !Array.isArray(firstEmbedding.embedding)) {
        console.error(`[OpenRouter] Invalid embedding format:`, JSON.stringify(firstEmbedding));
        throw new Error('OpenRouter returned invalid embedding format: embedding is not an array');
      }
      
      console.log(`[OpenRouter] Embedding received, dimension: ${firstEmbedding.embedding.length}, tokens: ${data.usage?.prompt_tokens || 'unknown'}`);
      return firstEmbedding.embedding;
    } catch (error) {
      console.error('[OpenRouter] Embedding request failed:', error);
      throw error;
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    console.log(`[OpenRouter] Batch embedding request for ${texts.length} texts`);
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: texts
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[OpenRouter] Batch embedding error ${response.status}:`, error);
        
        // Try to parse OpenRouter error format
        try {
          const errorData = JSON.parse(error);
          if (errorData.error) {
            throw new Error(`OpenRouter embedding error: ${errorData.error.message || errorData.error}`);
          }
        } catch {
          // If not JSON, use raw error
        }
        
        throw new Error(`OpenRouter embedding error: ${response.status} ${error}`);
      }

      const data = await response.json() as EmbeddingResponse;
      
      // Validate response structure according to OpenRouter spec
      if (!data || data.object !== 'list') {
        console.error(`[OpenRouter] Invalid batch embedding response object:`, JSON.stringify(data));
        throw new Error('OpenRouter returned invalid batch embedding response: object is not "list"');
      }
      
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        console.error(`[OpenRouter] Invalid batch embedding response data:`, JSON.stringify(data));
        throw new Error('OpenRouter returned invalid batch embedding response: missing or empty data array');
      }
      
      if (data.data.length !== texts.length) {
        console.warn(`[OpenRouter] Batch embedding count mismatch: expected ${texts.length}, got ${data.data.length}`);
      }
      
      // Validate each embedding and extract them
      const embeddings: number[][] = [];
      for (let i = 0; i < data.data.length; i++) {
        const embeddingData = data.data[i];
        
        if (!embeddingData || embeddingData.object !== 'embedding') {
          console.error(`[OpenRouter] Invalid embedding data object at index ${i}:`, JSON.stringify(embeddingData));
          throw new Error(`OpenRouter returned invalid embedding data at index ${i}: object is not "embedding"`);
        }
        
        if (!embeddingData.embedding || !Array.isArray(embeddingData.embedding)) {
          console.error(`[OpenRouter] Invalid embedding format at index ${i}:`, JSON.stringify(embeddingData));
          throw new Error(`OpenRouter returned invalid embedding format at index ${i}: embedding is not an array`);
        }
        
        embeddings.push(embeddingData.embedding);
      }
      
      console.log(`[OpenRouter] Batch embeddings received: ${embeddings.length} embeddings, tokens: ${data.usage?.prompt_tokens || 'unknown'}`);
      return embeddings;
    } catch (error) {
      console.error('[OpenRouter] Batch embedding request failed:', error);
      throw error;
    }
  }

  async completeWithModel(messages: Message[], model: string, provider?: ProviderPreferences): Promise<string> {
    return this.complete(messages, model, provider);
  }

  async completeVision(messages: VisionMessage[], model: string = MODEL_AGENT): Promise<string> {
    console.log(`[OpenRouter] Vision completion with model: ${model}`);
    console.log(`[OpenRouter] Messages: ${messages.length}`);
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        temperature: 0.7,
        max_tokens: 8192
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter vision error: ${response.status} ${error}`);
    }

    const data = await response.json() as CompletionResponse;
    return data.choices[0].message.content;
  }
}

export const openRouterClient = new OpenRouterClient();

// Export provider configurations for external use
export { BASETEN_FP4_PROVIDER, DEEPINFRA_FP4_PROVIDER, MOONSHOT_PROVIDER };

// Export types for external use
export type { ProviderPreferences, Message, VisionMessage };
