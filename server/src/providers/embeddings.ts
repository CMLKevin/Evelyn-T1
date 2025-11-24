import { openRouterClient } from './openrouter.js';

// LRU cache for embeddings
class EmbeddingCache {
  private cache: Map<string, { embedding: number[]; timestamp: number }>;
  private maxSize: number;

  constructor(maxSize = 500) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(text: string): number[] | undefined {
    const entry = this.cache.get(text);
    if (entry) {
      // Move to end (most recent)
      this.cache.delete(text);
      this.cache.set(text, entry);
      return entry.embedding;
    }
    return undefined;
  }

  set(text: string, embedding: number[]): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(text, { embedding, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

const embeddingCache = new EmbeddingCache();

export async function embed(text: string): Promise<number[]> {
  // Validate input
  if (!text || text.trim().length === 0) {
    throw new Error('Cannot embed empty text');
  }
  
  // Truncate very long texts (OpenRouter has limits)
  const maxLength = 8000; // Conservative limit for embedding models
  const truncatedText = text.length > maxLength ? text.slice(0, maxLength) : text;
  
  if (text.length > maxLength) {
    console.warn(`[Embeddings] Text truncated from ${text.length} to ${maxLength} chars`);
  }
  
  const cached = embeddingCache.get(truncatedText);
  if (cached) {
    return cached;
  }
  try {
    const embedding = await openRouterClient.embed(truncatedText);
    
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Invalid embedding response: empty or not an array');
    }
    
    embeddingCache.set(truncatedText, embedding);
    return embedding;
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message || '';
      if (message.includes('OpenRouter embedding auth error 401') || message.includes('OpenRouter chat auth error 401') || /401/.test(message)) {
        console.error('[Embeddings] OpenRouter authentication/authorization error (likely invalid or unknown OPENROUTER_API_KEY):', message);
        console.error('[Embeddings] Tip: Check your OPENROUTER_API_KEY in server/.env and visit /api/diagnostics/openrouter for more details.');
      } else {
        console.error('[Embeddings] Provider error generating embedding:', message);
      }
    } else {
      console.error('[Embeddings] Unknown error generating embedding:', error);
    }
    console.error('[Embeddings] Embedding service unavailable - system will continue without embeddings');
    throw error;
  }
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!Array.isArray(texts) || texts.length === 0) {
    console.warn('[Embeddings] Empty or invalid texts array for batch embedding');
    return [];
  }
  
  const results: number[][] = [];
  const toEmbed: string[] = [];
  const indices: number[] = [];

  texts.forEach((text, idx) => {
    // Skip empty texts
    if (!text || text.trim().length === 0) {
      return;
    }
    
    const cached = embeddingCache.get(text);
    if (cached) {
      results[idx] = cached;
    } else {
      toEmbed.push(text);
      indices.push(idx);
    }
  });

  if (toEmbed.length > 0) {
    try {
    const embeddings = await openRouterClient.embedBatch(toEmbed);
      
      if (!Array.isArray(embeddings) || embeddings.length !== toEmbed.length) {
        throw new Error(`Expected ${toEmbed.length} embeddings, got ${embeddings?.length || 0}`);
      }
      
    embeddings.forEach((emb, i) => {
      const idx = indices[i];
      results[idx] = emb;
      embeddingCache.set(toEmbed[i], emb);
    });
    } catch (error) {
      if (error instanceof Error) {
        const message = error.message || '';
        if (message.includes('OpenRouter embedding auth error 401') || message.includes('OpenRouter chat auth error 401') || /401/.test(message)) {
          console.error('[Embeddings] OpenRouter authentication/authorization error during batch embedding (likely invalid or unknown OPENROUTER_API_KEY):', message);
          console.error('[Embeddings] Tip: Check your OPENROUTER_API_KEY in server/.env and visit /api/diagnostics/openrouter for more details.');
        } else {
          console.error('[Embeddings] Provider error during batch embedding:', message);
        }
      } else {
        console.error('[Embeddings] Unknown error during batch embedding:', error);
      }
      throw error;
    }
  }

  return results;
}

export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}
