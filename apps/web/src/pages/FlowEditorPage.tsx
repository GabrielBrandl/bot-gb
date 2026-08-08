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
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Save, X } from "lucide-react";
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
  { type: "trigger", label: "Gatilho", color: "border-[var(--gb-cyan)]" },
  { type: "send_text", label: "Enviar texto", color: "border-sky-500" },
  { type: "condition", label: "Condição", color: "border-amber-500" },
  { type: "collect_variable", label: "Coletar variável", color: "border-violet-500" },
  { type: "transfer_human", label: "Transferir humano", color: "border-orange-500" },
  { type: "ai_reply", label: "Resposta IA", color: "border-teal-500" },
  { type: "payment_link", label: "Link pagamento", color: "border-yellow-500" },
] as const;

type FlowNodeData = {
  label?: string;
  text?: string;
  message?: string;
  keyword?: string;
  field?: string;
  variable?: string;
  agentId?: string;
  amount?: number | string;
  description?: string;
  [key: string]: unknown;
};

function previewText(data: FlowNodeData | undefined): string {
  if (!data) return "";
  const raw = String(data.text ?? data.message ?? data.keyword ?? data.field ?? data.agentId ?? "");
  const compact = raw.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  return compact.length > 80 ? `${compact.slice(0, 80)}…` : compact;
}

function CustomNode({ data, type, selected }: NodeProps<Node<FlowNodeData>>) {
  const meta = NODE_TYPES_LIST.find((n) => n.type === type);
  const label = typeof data?.label === "string" ? data.label : "";
  const preview = previewText(data);
  return (
    <div
      className={`min-w-[180px] max-w-[260px] rounded-lg border-2 bg-white px-3 py-2 shadow-sm ${
        meta?.color ?? "border-slate-600"
      } ${selected ? "ring-2 ring-[var(--gb-cyan)] ring-offset-2" : ""}`}
    >
      <Handle type="target" position={Position.Top} style={{ background: "#64748b" }} />
      <p className="text-xs font-medium text-sky-700">{meta?.label ?? type ?? "Nó"}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{label || "Sem título"}</p>
      {preview ? (
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[11px] leading-snug text-slate-500">{preview}</p>
      ) : (
        <p className="mt-1 text-[11px] italic text-slate-400">Sem conteúdo — clique para editar</p>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: "#64748b" }} />
    </div>
  );
}

const nodeTypes = {
  trigger: CustomNode,
  send_text: CustomNode,
  message: CustomNode,
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
    const data = (typeof n.data === "object" && n.data ? { ...n.data } : {}) as FlowNodeData;
    if (typeof data.label !== "string" || !data.label.trim()) {
      data.label = NODE_TYPES_LIST.find((t) => t.type === type)?.label ?? type;
    }
    return {
      id: typeof n.id === "string" && n.id ? n.id : `node-${index}`,
      type,
      position: {
        x: typeof n.position?.x === "number" ? n.position.x : 80 + index * 40,
        y: typeof n.position?.y === "number" ? n.position.y : 80 + index * 40,
      },
      data,
    };
  });
}

function normalizeEdges(raw: unknown): Edge[] {
  if (!Array.isArray(raw)) return [];
  const edges: Edge[] = [];
  raw.forEach((item, index) => {
    const e = (item ?? {}) as Partial<Edge>;
    if (!e.source || !e.target) return;
    edges.push({
      id: typeof e.id === "string" && e.id ? e.id : `edge-${e.source}-${e.target}-${index}`,
      source: String(e.source),
      target: String(e.target),
      ...(e.sourceHandle != null ? { sourceHandle: String(e.sourceHandle) } : {}),
      ...(e.targetHandle != null ? { targetHandle: String(e.targetHandle) } : {}),
    });
  });
  return edges;
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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const data = await flowsApi.get(token, id);
      setFlow(data);
      const graph = data.graph ?? { nodes: [], edges: [] };
      setNodes(normalizeNodes(graph.nodes));
      setEdges(normalizeEdges(graph.edges));
      setSelectedNodeId(null);
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

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const first = params.nodes[0];
    setSelectedNodeId(first?.id ?? null);
  }, []);

  const updateSelectedData = useCallback(
    (patch: Partial<FlowNodeData>) => {
      if (!selectedNodeId) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNodeId
            ? { ...n, data: { ...(n.data ?? {}), ...patch } }
            : n,
        ),
      );
    },
    [selectedNodeId, setNodes],
  );

  const defaultEdgeOptions = useMemo(() => ({ animated: false }), []);

  function addNode() {
    const meta = NODE_TYPES_LIST.find((n) => n.type === selectedType);
    const newId = `${selectedType}-${Date.now()}`;
    const newNode: Node<FlowNodeData> = {
      id: newId,
      type: selectedType,
      position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 },
      data: {
        label: nodeLabel.trim() || meta?.label || selectedType,
        text: selectedType === "send_text" || selectedType === "message" ? "" : undefined,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(newId);
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

  const selectedMeta = NODE_TYPES_LIST.find((n) => n.type === selectedNode?.type);
  const messageValue = String(selectedNode?.data?.text ?? selectedNode?.data?.message ?? "");

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/automacoes" className="text-[var(--gb-muted)] hover:text-[var(--gb-cyan)]">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white">{flow.name}</h1>
            <p className="text-sm text-[var(--gb-muted)]">{flow.description ?? "Editor de fluxo"}</p>
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

      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-[var(--gb-border)] bg-[var(--gb-surface)] p-3">
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

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-h-[420px] min-w-0 flex-1 rounded-xl border border-[var(--gb-border)] bg-[#f8fafc]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} color="#cbd5e1" />
            <Controls />
            <MiniMap nodeColor="#0ea5e9" maskColor="rgba(15,23,42,0.35)" />
          </ReactFlow>
        </div>

        <aside className="flex w-full max-w-md flex-col rounded-xl border border-[var(--gb-border)] bg-[var(--gb-surface)] p-4 lg:w-[380px]">
          {selectedNode ? (
            <>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--gb-muted)]">
                    {selectedMeta?.label ?? selectedNode.type}
                  </p>
                  <h2 className="text-lg font-semibold text-white">Editar nó</h2>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1 text-[var(--gb-muted)] hover:bg-white/10 hover:text-white"
                  onClick={() => setSelectedNodeId(null)}
                  aria-label="Fechar painel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <label className="mb-1 text-xs text-[var(--gb-muted)]">Título / rótulo</label>
              <input
                className={`${inputClass} mb-3`}
                value={String(selectedNode.data?.label ?? "")}
                onChange={(e) => updateSelectedData({ label: e.target.value })}
              />

              {(selectedNode.type === "send_text" ||
                selectedNode.type === "message" ||
                selectedNode.type === "trigger") && (
                <>
                  <label className="mb-1 text-xs text-[var(--gb-muted)]">
                    {selectedNode.type === "trigger" ? "Palavras-chave (opcional)" : "Mensagem enviada"}
                  </label>
                  {selectedNode.type === "trigger" ? (
                    <input
                      className={`${inputClass} mb-3`}
                      placeholder="oi|olá|menu"
                      value={String(selectedNode.data?.keyword ?? "")}
                      onChange={(e) => updateSelectedData({ keyword: e.target.value })}
                    />
                  ) : (
                    <textarea
                      className={`${inputClass} mb-3 min-h-[220px] resize-y font-sans text-sm`}
                      placeholder="Digite o texto completo que o bot envia neste passo…"
                      value={messageValue}
                      onChange={(e) =>
                        updateSelectedData({ text: e.target.value, message: e.target.value })
                      }
                    />
                  )}
                </>
              )}

              {selectedNode.type === "collect_variable" ? (
                <>
                  <label className="mb-1 text-xs text-[var(--gb-muted)]">Nome da variável</label>
                  <input
                    className={`${inputClass} mb-3`}
                    value={String(selectedNode.data?.field ?? selectedNode.data?.variable ?? "")}
                    onChange={(e) => updateSelectedData({ field: e.target.value, variable: e.target.value })}
                  />
                </>
              ) : null}

              {selectedNode.type === "ai_reply" ? (
                <>
                  <label className="mb-1 text-xs text-[var(--gb-muted)]">ID do agente de IA</label>
                  <input
                    className={`${inputClass} mb-3`}
                    value={String(selectedNode.data?.agentId ?? "")}
                    onChange={(e) => updateSelectedData({ agentId: e.target.value })}
                    placeholder="seed-ai-agent-…"
                  />
                  <p className="mb-3 text-xs text-[var(--gb-muted)]">
                    Deixe o agente ativo em Agente IA. Sem chave configurada no servidor, a IA não responde no WhatsApp.
                  </p>
                </>
              ) : null}

              {selectedNode.type === "payment_link" ? (
                <>
                  <label className="mb-1 text-xs text-[var(--gb-muted)]">Valor</label>
                  <input
                    className={`${inputClass} mb-3`}
                    type="number"
                    value={String(selectedNode.data?.amount ?? "")}
                    onChange={(e) => updateSelectedData({ amount: e.target.value })}
                  />
                  <label className="mb-1 text-xs text-[var(--gb-muted)]">Descrição</label>
                  <input
                    className={`${inputClass} mb-3`}
                    value={String(selectedNode.data?.description ?? "")}
                    onChange={(e) => updateSelectedData({ description: e.target.value })}
                  />
                </>
              ) : null}

              {selectedNode.type === "transfer_human" ? (
                <p className="text-sm text-[var(--gb-muted)]">
                  Este nó coloca a conversa na fila humana (status pendente, sem atendente).
                </p>
              ) : null}

              {selectedNode.type === "condition" ? (
                <p className="text-sm text-[var(--gb-muted)]">
                  Condições usam os campos em data do nó (edição avançada via texto da mensagem/variável no backend).
                </p>
              ) : null}

              <div className="mt-auto space-y-2 border-t border-[var(--gb-border)] pt-3">
                <button type="button" className={btnPrimary} onClick={() => void handleSave()} disabled={saving}>
                  Salvar alterações do fluxo
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
                    setEdges((eds) =>
                      eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId),
                    );
                    setSelectedNodeId(null);
                  }}
                >
                  Remover nó
                </button>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col justify-center text-sm text-[var(--gb-muted)]">
              <p className="mb-2 font-medium text-white">Painel do nó</p>
              <p>Clique em um bloco do fluxo para ver e editar a mensagem completa, variáveis ou agente de IA.</p>
            </div>
          )}
        </aside>
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
