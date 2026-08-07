import type { FlowEdge, FlowGraph, FlowNode } from "@bot-wpp/shared-types";

export function parseFlowGraph(nodesJson: unknown): FlowGraph {
  if (!nodesJson || typeof nodesJson !== "object") {
    return { nodes: [], edges: [] };
  }
  const graph = nodesJson as Partial<FlowGraph>;
  return {
    nodes: Array.isArray(graph.nodes) ? (graph.nodes as FlowNode[]) : [],
    edges: Array.isArray(graph.edges) ? (graph.edges as FlowEdge[]) : [],
  };
}

function triggerKeywords(trigger: string): string[] {
  return trigger
    .split("|")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

/** Score: exact > starts-with > contains (only for keywords with 3+ chars). */
function scoreTriggerMatch(normalizedText: string, keyword: string): number {
  if (!keyword) return 0;
  if (normalizedText === keyword) return 100 + keyword.length;
  if (normalizedText.startsWith(`${keyword} `) || normalizedText.startsWith(`${keyword}\n`)) {
    return 80 + keyword.length;
  }
  // Short digits like "1".."5" must be exact/start only — avoid false positives.
  if (keyword.length <= 2) return 0;
  if (normalizedText.includes(keyword)) return 40 + Math.min(keyword.length, 20);
  return 0;
}

export function findMatchingFlow(
  flows: Array<{ id: string; trigger: string; nodes: unknown; active: boolean }>,
  text: string,
): { id: string; trigger: string; nodes: unknown } | null {
  const normalized = text.trim().toLowerCase();
  let best: { id: string; trigger: string; nodes: unknown; score: number } | null = null;

  for (const flow of flows) {
    if (!flow.active) continue;
    const keywords = triggerKeywords(flow.trigger);
    if (keywords.length === 0) continue;

    let flowScore = 0;
    for (const keyword of keywords) {
      flowScore = Math.max(flowScore, scoreTriggerMatch(normalized, keyword));
    }
    if (flowScore > 0 && (!best || flowScore > best.score)) {
      best = { id: flow.id, trigger: flow.trigger, nodes: flow.nodes, score: flowScore };
    }
  }

  return best ? { id: best.id, trigger: best.trigger, nodes: best.nodes } : null;
}

const GREETING_KEYWORDS = new Set([
  "oi",
  "olá",
  "ola",
  "bom dia",
  "boa tarde",
  "boa noite",
  "menu",
  "inicio",
  "início",
  "comecar",
  "começar",
  "start",
  "hello",
  "hi",
  "ajuda",
]);

export function isGreetingTrigger(trigger: string): boolean {
  return triggerKeywords(trigger).some((k) => GREETING_KEYWORDS.has(k));
}

export function getStartNode(graph: FlowGraph): FlowNode | undefined {
  return (
    graph.nodes.find((n) => n.type === "trigger" || n.type === "keyword") ??
    graph.nodes[0]
  );
}

export function getNextNode(
  graph: FlowGraph,
  currentNodeId: string,
  sourceHandle?: string,
): FlowNode | undefined {
  const edge = graph.edges.find(
    (e) => e.source === currentNodeId && (sourceHandle ? e.sourceHandle === sourceHandle : true),
  );
  if (!edge) return undefined;
  return graph.nodes.find((n) => n.id === edge.target);
}

export function evaluateCondition(data: Record<string, unknown>, text: string): boolean {
  const operator = (data.operator as string) ?? "contains";
  const value = String(data.value ?? "").toLowerCase();
  const input = text.toLowerCase();

  switch (operator) {
    case "equals":
      return input === value;
    case "starts_with":
      return input.startsWith(value);
    case "ends_with":
      return input.endsWith(value);
    case "contains":
    default:
      return input.includes(value);
  }
}

type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

type DaySchedule = { open: string; close: string } | null;

export type BusinessSchedule = Partial<Record<DayKey, DaySchedule>>;

const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function parseHm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** Verifica se o instante está dentro do horário comercial no fuso informado. */
export function isWithinBusinessHours(
  schedule: BusinessSchedule | null | undefined,
  timezone = "America/Manaus",
  now = new Date(),
): boolean {
  if (!schedule) return true;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  const weekdayMap: Record<string, DayKey> = {
    Sun: "sun",
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
  };
  const day = weekdayMap[weekday] ?? DAY_KEYS[now.getDay()];
  const slot = schedule[day];
  if (!slot || !slot.open || !slot.close) return false;

  const open = parseHm(slot.open);
  const close = parseHm(slot.close);
  if (open === null || close === null) return false;

  const current = hour * 60 + minute;
  return current >= open && current <= close;
}
