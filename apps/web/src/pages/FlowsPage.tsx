import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, GitBranch } from "lucide-react";
import { useAuth } from "../lib/auth";
import { flowsApi } from "../lib/api";
import type { Flow } from "../lib/types";
import { Badge } from "../components/ui/Badge";
import {
  btnPrimary,
  btnSecondary,
  Card,
  EmptyState,
  ErrorState,
  inputClass,
  LoadingState,
  PageHeader,
} from "../components/ui/PageHeader";

export function FlowsPage() {
  const { token } = useAuth();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await flowsApi.list(token);
      setFlows(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar automações");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !name.trim()) return;
    setSubmitting(true);
    try {
      const flow = await flowsApi.create(token, {
        name: name.trim(),
        description: description.trim() || undefined,
        graph: {
          nodes: [
            {
              id: "trigger-1",
              type: "trigger",
              data: { label: "Nova mensagem" },
              position: { x: 250, y: 50 },
            },
          ],
          edges: [],
        },
      });
      setName("");
      setDescription("");
      setShowForm(false);
      await load();
      window.location.href = `/automacoes/${flow.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar automação");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Automações"
        description="Fluxos visuais para automatizar atendimento."
        actions={
          <button type="button" className={btnPrimary} onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-1.5 inline h-4 w-4" />
            Nova automação
          </button>
        }
      />

      {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}

      {showForm ? (
        <Card className="mb-6">
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm text-[var(--abs-muted)]">Nome</span>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-[var(--abs-muted)]">Descrição</span>
              <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" className={btnPrimary} disabled={submitting}>
                {submitting ? "Criando..." : "Criar e editar"}
              </button>
              <button type="button" className={btnSecondary} onClick={() => setShowForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {loading ? (
        <LoadingState />
      ) : flows.length === 0 ? (
        <EmptyState message="Nenhuma automação criada." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <Link key={flow.id} to={`/automacoes/${flow.id}`}>
              <Card className="transition hover:border-[var(--abs-blue)]/30">
                <div className="flex items-start justify-between">
                  <GitBranch className="h-5 w-5 text-[var(--abs-blue)]" />
                  <Badge variant={flow.isActive ? "open" : "default"}>
                    {flow.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <h3 className="mt-3 font-medium text-[var(--abs-blue-dark)]">{flow.name}</h3>
                {flow.description ? (
                  <p className="mt-1 text-sm text-[var(--abs-muted)]">{flow.description}</p>
                ) : null}
                <p className="mt-3 text-xs text-[var(--abs-muted)]">
                  {flow.graph.nodes.length} nós · {flow.graph.edges.length} conexões
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
