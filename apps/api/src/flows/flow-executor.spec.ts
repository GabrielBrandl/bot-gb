import { findMatchingFlow } from "./flow-utils";

describe("FlowExecutor keyword match", () => {
  const flows = [
    { id: "1", trigger: "oi", nodes: {}, active: true },
    { id: "2", trigger: "preço", nodes: {}, active: true },
    { id: "3", trigger: "inativo", nodes: {}, active: false },
  ];

  it("matches exact keyword", () => {
    expect(findMatchingFlow(flows, "oi")?.id).toBe("1");
  });

  it("matches keyword at start", () => {
    expect(findMatchingFlow(flows, "oi tudo bem")?.id).toBe("1");
  });

  it("matches keyword contained in text", () => {
    expect(findMatchingFlow(flows, "qual o preço?")?.id).toBe("2");
  });

  it("skips inactive flows", () => {
    expect(findMatchingFlow(flows, "inativo")).toBeNull();
  });

  it("returns null when no match", () => {
    expect(findMatchingFlow(flows, "xyz")).toBeNull();
  });
});
