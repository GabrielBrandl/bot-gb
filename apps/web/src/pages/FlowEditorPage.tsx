import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ReactFlow,
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

function CustomNode({ data, type }: NodeProps) {
  const meta = NODE_TYPES_LIST.find((n) => n.type === type);
  return (
    <div className={`min-w-[160px] rounded-lg border-2 bg-white px-3 py-2 ${meta?.color ?? "border-slate-600"}`}>
      <Handle type="target" position={Position.Top} className="!bg-[var(--abs-yellow)]" />
      <p className="text-xs font-medium text-[var(--abs-blue)]">{meta?.label ?? type}</p>
      <p className="mt-1 text-sm text-[var(--abs-blue-dark)]">{(data.label as string) ?? ""}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--abs-yellow)]" />
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

export function FlowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedType, setSelectedType] = useState<string>("send_text");
  const [nodeLabel, setNodeLabel] = useState("");

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const data = await flowsApi.get(token, id);
      setFlow(data);
      setNodes(data.graph.nodes as Node[]);
      setEdges(data.graph.edges as Edge[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar fluxo");
    } finally {
      setLoading(false);
    }
  }, [token, id, setNodes, setEdges]);

  useEffect(() => {
    load();
  }, [load]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  function addNode() {
    const newNode: Node = {
      id: `${selectedType}-${Date.now()}`,
      type: selectedType,
      position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 },
      data: { label: nodeLabel || NODE_TYPES_LIST.find((n) => n.type === selectedType)?.label },
    };
    setNodes((nds) => [...nds, newNode]);
    setNodeLabel("");
  }

  async function handleSave() {
    if (!token || !id) return;
    setSaving(true);
    try {
      await flowsApi.update(token, id, {
        graph: { nodes: nodes as Flow["graph"]["nodes"], edges: edges as Flow["graph"]["edges"] },
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
          <button type="button" className={btnSecondary} onClick={toggleActive}>
            {flow.isActive ? "Desativar" : "Ativar"}
          </button>
          <button type="button" className={btnPrimary} onClick={handleSave} disabled={saving}>
            <Save className="mr-1.5 inline h-4 w-4" />
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {error ? <div className="mb-3"><ErrorState message={error} /></div> : null}

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

      <div className="min-h-0 flex-1 rounded-xl border border-[var(--abs-gray)] bg-white">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          colorMode="dark"
        >
          <Background />
          <Controls />
          <MiniMap nodeColor="#22c55e" maskColor="rgba(15,23,42,0.8)" />
        </ReactFlow>
      </div>
    </div>
  );
}
