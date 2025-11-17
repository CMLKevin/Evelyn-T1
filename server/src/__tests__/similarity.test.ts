import { cosineSimilarity, euclideanDistance } from '../utils/similarity.js';

describe('Similarity Functions', () => {
  test('cosine similarity of identical vectors', () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
  });

  test('cosine similarity of orthogonal vectors', () => {
    const v1 = [1, 0];
    const v2 = [0, 1];
    expect(cosineSimilarity(v1, v2)).toBeCloseTo(0.0);
  });

  test('euclidean distance of identical vectors', () => {
    const v = [1, 2, 3];
    expect(euclideanDistance(v, v)).toBeCloseTo(0.0);
  });

  test('euclidean distance calculation', () => {
    const v1 = [0, 0];
    const v2 = [3, 4];
    expect(euclideanDistance(v1, v2)).toBeCloseTo(5.0);
  });
});

