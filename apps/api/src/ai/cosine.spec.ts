import { cosineSimilarity, topKSimilar } from "./cosine";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns 0 for empty or mismatched lengths", () => {
    expect(cosineSimilarity([], [1])).toBe(0);
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
  });

  it("topKSimilar returns highest scores first", () => {
    const query = [1, 0];
    const items = [
      { id: "a", embedding: [1, 0], content: "a" },
      { id: "b", embedding: [0, 1], content: "b" },
      { id: "c", embedding: [0.9, 0.1], content: "c" },
    ];
    const result = topKSimilar(query, items, 2);
    expect(result[0].id).toBe("a");
    expect(result[1].id).toBe("c");
  });
});
