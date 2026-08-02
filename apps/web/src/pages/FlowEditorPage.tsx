import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Connection,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Save } from "lucide-react";
import { useAuth } from "../lib/auth";
import { flowsApi } from "../lib/api";
import type { Flow } from "../lib/types";
import {
  btnPrimary,
  btnSecondary,
  ErrorState,
  inputClass,
  LoadingState,
  selectClass,
} from "../components/ui/PageHeader";

const NODE_TYPES_LIST = [
  { type: "trigger", label: "Gatilho", color: "border-[var(--abs-blue)]" },
  { type: "send_text", label: "Enviar texto", color: "border-sky-500" },
  { type: "condition", label: "Condição", color: "border-amber-500" },
  { type: "collect_variable", label: "Coletar variável", color: "border-violet-500" },
  { type: "transfer_human", label: "Transferir humano", color: "border-orange-500" },
  { type: "ai_reply", label: "Resposta IA", color: "border-teal-500" },
  { type: "payment_link", label: "Link pagamento", color: "border-[var(--abs-yellow)]" },
] as const;

type FlowNodeData = {
  label?: string;
  [key: string]: unknown;
};

function CustomNode({ data, type }: NodeProps<Node<FlowNodeData>>) {
  const meta = NODE_TYPES_LIST.find((n) => n.type === type);
  const label = typeof data?.label === "string" ? data.label : "";
  return (
    <div
      className={`min-w-[160px] rounded-lg border-2 bg-white px-3 py-2 shadow-sm ${
        meta?.color ?? "border-slate-600"
      }`}
    >
      <Handle type="target" position={Position.Top} style={{ background: "var(--abs-yellow)" }} />
      <p className="text-xs font-medium text-[var(--abs-blue)]">{meta?.label ?? type ?? "Nó"}</p>
      <p className="mt-1 text-sm text-[var(--abs-blue-dark)]">{label}</p>
      <Handle type="source" position={Position.Bottom} style={{ background: "var(--abs-yellow)" }} />
    </div>
  );
}

const nodeTypes = {
  trigger: CustomNode,
  send_text: CustomNode,
  condition: CustomNode,
  collect_variable: CustomNode,
  transfer_human: CustomNode,
  ai_reply: CustomNode,
  payment_link: CustomNode,
};

function normalizeNodes(raw: unknown): Node<FlowNodeData>[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const n = (item ?? {}) as Partial<Node<FlowNodeData>> & { id?: string };
    const type = typeof n.type === "string" && n.type ? n.type : "send_text";
    return {
      id: typeof n.id === "string" && n.id ? n.id : `node-${index}`,
      type,
      position: {
        x: typeof n.position?.x === "number" ? n.position.x : 80 + index * 40,
        y: typeof n.position?.y === "number" ? n.position.y : 80 + index * 40,
      },
      data: {
        ...(typeof n.data === "object" && n.data ? n.data : {}),
        label:
          typeof (n.data as FlowNodeData | undefined)?.label === "string"
            ? (n.data as FlowNodeData).label
            : NODE_TYPES_LIST.find((t) => t.type === type)?.label ?? type,
      },
    };
  });
}

function normalizeEdges(raw: unknown): Edge[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      const e = (item ?? {}) as Partial<Edge>;
      if (!e.source || !e.target) return null;
      return {
        id: typeof e.id === "string" && e.id ? e.id : `edge-${e.source}-${e.target}-${index}`,
        source: String(e.source),
        target: String(e.target),
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
      } satisfies Edge;
    })
    .filter((e): e is Edge => e !== null);
}

class FlowEditorErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message || "Erro ao renderizar o editor" };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="space-y-3">
          <ErrorState message={`Editor de fluxo: ${this.state.error}`} />
          <Link to="/automacoes" className={btnSecondary}>
            Voltar para automações
          </Link>
        </div>
      );
    }
    return this.props.children;
  }
}

function FlowEditorCanvas() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedType, setSelectedType] = useState<string>("send_text");
  const [nodeLabel, setNodeLabel] = useState("");

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const data = await flowsApi.get(token, id);
      setFlow(data);
      const graph = data.graph ?? { nodes: [], edges: [] };
      setNodes(normalizeNodes(graph.nodes));
      setEdges(normalizeEdges(graph.edges));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar fluxo");
      setFlow(null);
    } finally {
      setLoading(false);
    }
  }, [token, id, setNodes, setEdges]);

  useEffect(() => {
    void load();
  }, [load]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  const defaultEdgeOptions = useMemo(() => ({ animated: false }), []);

  function addNode() {
    const meta = NODE_TYPES_LIST.find((n) => n.type === selectedType);
    const newNode: Node<FlowNodeData> = {
      id: `${selectedType}-${Date.now()}`,
      type: selectedType,
      position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 },
      data: { label: nodeLabel.trim() || meta?.label || selectedType },
    };
    setNodes((nds) => [...nds, newNode]);
    setNodeLabel("");
  }

  async function handleSave() {
    if (!token || !id) return;
    setSaving(true);
    try {
      await flowsApi.update(token, id, {
        graph: {
          nodes: nodes.map((n) => ({
            id: n.id,
            type: n.type ?? "send_text",
            position: n.position,
            data: (n.data ?? {}) as Record<string, unknown>,
          })),
          edges: edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle ?? undefined,
          })),
        },
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar fluxo");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!token || !id || !flow) return;
    try {
      const updated = await flowsApi.update(token, id, { isActive: !flow.isActive });
      setFlow(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar status");
    }
  }

  if (loading) return <LoadingState />;
  if (!flow) return <ErrorState message={error ?? "Fluxo não encontrado"} />;

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/automacoes" className="text-[var(--abs-muted)] hover:text-[var(--abs-blue)]">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-[var(--abs-blue-dark)]">{flow.name}</h1>
            <p className="text-sm text-[var(--abs-muted)]">{flow.description ?? "Editor de fluxo"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={btnSecondary} onClick={() => void toggleActive()}>
            {flow.isActive ? "Desativar" : "Ativar"}
          </button>
          <button type="button" className={btnPrimary} onClick={() => void handleSave()} disabled={saving}>
            <Save className="mr-1.5 inline h-4 w-4" />
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-3">
          <ErrorState message={error} />
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-[var(--abs-gray)] bg-white p-3">
        <select className={selectClass} value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
          {NODE_TYPES_LIST.map((n) => (
            <option key={n.type} value={n.type}>
              {n.label}
            </option>
          ))}
        </select>
        <input
          className={`${inputClass} max-w-xs`}
          placeholder="Rótulo do nó"
          value={nodeLabel}
          onChange={(e) => setNodeLabel(e.target.value)}
        />
        <button type="button" className={btnSecondary} onClick={addNode}>
          Adicionar nó
        </button>
      </div>

      <div className="min-h-[420px] flex-1 rounded-xl border border-[var(--abs-gray)] bg-[#f8fafc]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} color="#cbd5e1" />
          <Controls />
          <MiniMap nodeColor="#0033b5" maskColor="rgba(15,23,42,0.35)" />
        </ReactFlow>
      </div>
    </div>
  );
}

export function FlowEditorPage() {
  return (
    <FlowEditorErrorBoundary>
      <ReactFlowProvider>
        <FlowEditorCanvas />
      </ReactFlowProvider>
    </FlowEditorErrorBoundary>
  );
}
