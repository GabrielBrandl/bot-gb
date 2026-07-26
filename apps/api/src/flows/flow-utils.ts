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

export function findMatchingFlow(
  flows: Array<{ id: string; trigger: string; nodes: unknown; active: boolean }>,
  text: string,
): { id: string; trigger: string; nodes: unknown } | null {
  const normalized = text.trim().toLowerCase();
  for (const flow of flows) {
    if (!flow.active) continue;
    const trigger = flow.trigger.trim().toLowerCase();
    if (!trigger) continue;
    if (normalized === trigger || normalized.startsWith(`${trigger} `) || normalized.includes(trigger)) {
      return flow;
    }
  }
  return null;
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
