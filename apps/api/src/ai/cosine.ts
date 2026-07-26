export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function topKSimilar(
  query: number[],
  items: Array<{ id: string; embedding: number[]; content: string }>,
  k: number,
): Array<{ id: string; content: string; score: number }> {
  return items
    .map((item) => ({
      id: item.id,
      content: item.content,
      score: cosineSimilarity(query, item.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
