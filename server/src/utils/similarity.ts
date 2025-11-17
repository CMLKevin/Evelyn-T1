export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimension');
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimension');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

// Maximal Marginal Relevance for diverse retrieval
export function mmr<T>(
  candidates: Array<{ item: T; score: number; embedding: number[] }>,
  queryEmbedding: number[],
  k: number,
  lambda: number = 0.7
): T[] {
  const selected: Array<{ item: T; embedding: number[] }> = [];
  const remaining = [...candidates];

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const relevance = cosineSimilarity(queryEmbedding, candidate.embedding);

      let maxSimilarity = 0;
      for (const sel of selected) {
        const sim = cosineSimilarity(candidate.embedding, sel.embedding);
        maxSimilarity = Math.max(maxSimilarity, sim);
      }

      const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      const item = remaining.splice(bestIdx, 1)[0];
      selected.push(item);
    } else {
      break;
    }
  }

  return selected.map(s => s.item);
}

