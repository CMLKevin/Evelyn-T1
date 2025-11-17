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
    console.log('[Embeddings] Cache hit');
    return cached;
  }

  console.log(`[Embeddings] Generating embedding for text (${truncatedText.length} chars)...`);
  try {
    const embedding = await openRouterClient.embed(truncatedText);
    
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Invalid embedding response: empty or not an array');
    }
    
    console.log(`[Embeddings] Embedding generated, dimension: ${embedding.length}`);
    embeddingCache.set(truncatedText, embedding);
    return embedding;
  } catch (error) {
    console.error('[Embeddings] Error generating embedding:', error);
    console.error('[Embeddings] Embedding service unavailable - system will continue without embeddings');
    // Return null to signal embedding failure rather than throwing
    // This allows the system to continue functioning without embeddings
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
      console.warn(`[Embeddings] Skipping empty text at index ${idx}`);
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
      console.error('[Embeddings] Batch embedding error:', error);
      throw error;
    }
  }

  return results;
}

export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}
