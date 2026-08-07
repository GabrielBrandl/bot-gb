import { findMatchingFlow, isGreetingTrigger, isWithinBusinessHours } from "./flow-utils";

describe("FlowExecutor keyword match", () => {
  const flows = [
    { id: "1", trigger: "oi", nodes: {}, active: true },
    { id: "2", trigger: "preço", nodes: {}, active: true },
    { id: "3", trigger: "inativo", nodes: {}, active: false },
    { id: "4", trigger: "oi|olá|ola|menu", nodes: {}, active: true },
    { id: "5", trigger: "1|portal|portal do aluno", nodes: {}, active: true },
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

  it("supports pipe-separated keywords", () => {
    expect(findMatchingFlow(flows, "olá")?.id).toBe("4");
    expect(findMatchingFlow(flows, "menu")?.id).toBe("4");
  });

  it("prefers exact option numbers over greetings", () => {
    expect(findMatchingFlow(flows, "1")?.id).toBe("5");
    expect(findMatchingFlow(flows, "portal")?.id).toBe("5");
  });
});

describe("greeting trigger helper", () => {
  it("detects greeting triggers", () => {
    expect(isGreetingTrigger("oi|olá|menu")).toBe(true);
    expect(isGreetingTrigger("1|portal")).toBe(false);
  });
});

describe("business hours", () => {
  const schedule = {
    mon: { open: "07:30", close: "21:50" },
    tue: { open: "07:30", close: "21:50" },
    wed: { open: "07:30", close: "21:50" },
    thu: { open: "07:30", close: "21:50" },
    fri: { open: "07:30", close: "21:50" },
    sat: { open: "08:00", close: "11:50" },
    sun: null,
  };

  it("is open on weekday morning in Manaus", () => {
    // 2026-08-06 was a Thursday; 10:00 Manaus = 14:00 UTC
    const when = new Date("2026-08-06T14:00:00.000Z");
    expect(isWithinBusinessHours(schedule, "America/Manaus", when)).toBe(true);
  });

  it("is closed on Sunday", () => {
    const when = new Date("2026-08-09T14:00:00.000Z");
    expect(isWithinBusinessHours(schedule, "America/Manaus", when)).toBe(false);
  });
});
