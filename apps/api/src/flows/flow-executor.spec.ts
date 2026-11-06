import {
  findMatchingFlow,
  isGreetingText,
  isGreetingTrigger,
  isPhoneListRequest,
  isThanksMessage,
  isWithinBusinessHours,
  isWithinGreetingCooldown,
  parseSatisfactionScore,
  GREETING_COOLDOWN_MS,
} from "./flow-utils";

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

  it("detects greeting texts", () => {
    expect(isGreetingText("oi")).toBe(true);
    expect(isGreetingText("bom dia")).toBe(true);
    expect(isGreetingText("2")).toBe(false);
    expect(isGreetingText("email")).toBe(false);
  });
});

describe("greeting cooldown", () => {
  it("is within 12h cooldown", () => {
    const now = new Date("2026-08-08T15:00:00.000Z");
    const prior = new Date("2026-08-08T10:00:00.000Z");
    expect(isWithinGreetingCooldown(prior, now)).toBe(true);
  });

  it("allows greeting after 12h", () => {
    const now = new Date("2026-08-08T15:00:00.000Z");
    const prior = new Date("2026-08-07T14:00:00.000Z");
    expect(isWithinGreetingCooldown(prior, now, GREETING_COOLDOWN_MS)).toBe(false);
  });

  it("allows first contact without prior activity", () => {
    expect(isWithinGreetingCooldown(null)).toBe(false);
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

describe("TI Esbam shortcuts", () => {
  it("recognizes ramais, ramis and contato", () => {
    expect(isPhoneListRequest("ramis")).toBe(true);
    expect(isPhoneListRequest("quero o contato")).toBe(true);
    expect(isPhoneListRequest("1")).toBe(false);
  });

  it("recognizes thanks", () => {
    expect(isThanksMessage("Obrigada!")).toBe(true);
    expect(isThanksMessage("muito obrigado")).toBe(true);
    expect(isThanksMessage("ainda preciso de ajuda")).toBe(false);
  });

  it("parses a score from 1 to 5", () => {
    expect(parseSatisfactionScore("5")).toBe(5);
    expect(parseSatisfactionScore("nota 3")).toBe(3);
    expect(parseSatisfactionScore("6")).toBeNull();
  });
});
