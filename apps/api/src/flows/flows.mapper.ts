import { parseFlowGraph } from "./flow-utils";

type FlowRow = {
  id: string;
  tenantId: string;
  name: string;
  trigger: string;
  nodes: unknown;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function toFlowResponse(flow: FlowRow) {
  const graph = parseFlowGraph(flow.nodes);
  return {
    id: flow.id,
    tenantId: flow.tenantId,
    name: flow.name,
    trigger: flow.trigger,
    description: flow.trigger,
    nodes: graph,
    graph,
    active: flow.active,
    isActive: flow.active,
    createdAt: flow.createdAt,
    updatedAt: flow.updatedAt,
  };
}

export function extractTriggerFromGraph(graph: { nodes?: Array<{ type?: string; data?: Record<string, unknown> }> }): string {
  const triggerNode = graph.nodes?.find((n) => n.type === "trigger" || n.type === "keyword");
  const keyword = triggerNode?.data?.keyword;
  if (typeof keyword === "string" && keyword.trim()) {
    return keyword.trim();
  }
  return ".*";
}
