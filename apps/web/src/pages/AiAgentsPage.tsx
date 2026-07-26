import { FormEvent, useEffect, useState } from "react";
import { Bot, Plus, Send } from "lucide-react";
import { useAuth } from "../lib/auth";
import { aiApi } from "../lib/api";
import type { AiAgent } from "../lib/types";
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
  selectClass,
} from "../components/ui/PageHeader";

const PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google Gemini" },
  { value: "local", label: "Local / Ollama" },
];

export function AiAgentsPage() {
  const { token } = useAuth();
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [persona, setPersona] = useState("");
  const [provider, setProvider] = useState("openai");
  const [submitting, setSubmitting] = useState(false);

  // Document upload
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Test ask
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const selected = agents.find((a) => a.id === selectedId) ?? null;

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await aiApi.listAgents(token);
      setAgents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar agentes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      const agent = await aiApi.createAgent(token, { name, persona, provider });
      setName("");
      setPersona("");
      setShowForm(false);
      await load();
      setSelectedId(agent.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar agente");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadDoc(e: FormEvent) {
    e.preventDefault();
    if (!token || !selectedId || !docTitle.trim() || !docContent.trim()) return;
    setUploadingDoc(true);
    try {
      await aiApi.addDocument(token, selectedId, docTitle.trim(), docContent.trim());
      setDocTitle("");
      setDocContent("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar documento");
    } finally {
      setUploadingDoc(false);
    }
  }

  async function handleAsk(e: FormEvent) {
    e.preventDefault();
    if (!token || !selectedId || !question.trim()) return;
    setAsking(true);
    setAnswer(null);
    try {
      const result = await aiApi.ask(token, selectedId, question.trim());
      setAnswer(result.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao testar agente");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Agente IA"
        description="Configure assistentes virtuais com base de conhecimento."
        actions={
          <button type="button" className={btnPrimary} onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-1.5 inline h-4 w-4" />
            Novo agente
          </button>
        }
      />

      {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}

      {showForm ? (
        <Card className="mb-6">
          <form onSubmit={handleCreate} className="grid gap-4">
            <label className="space-y-1">
              <span className="text-sm text-[var(--abs-muted)]">Nome</span>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-[var(--abs-muted)]">Persona / instruções</span>
              <textarea
                className={`${inputClass} min-h-[100px] resize-y`}
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                placeholder="Você é um assistente de vendas amigável..."
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-[var(--abs-muted)]">Provedor</span>
              <select className={selectClass} value={provider} onChange={(e) => setProvider(e.target.value)}>
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button type="submit" className={btnPrimary} disabled={submitting}>
                {submitting ? "Criando..." : "Criar agente"}
              </button>
              <button type="button" className={btnSecondary} onClick={() => setShowForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-1">
          {loading ? (
            <LoadingState />
          ) : agents.length === 0 ? (
            <EmptyState message="Nenhum agente criado." />
          ) : (
            agents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => setSelectedId(agent.id)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  selectedId === agent.id
                    ? "border-[var(--abs-yellow)] bg-[var(--abs-yellow)]/20"
                    : "border-[var(--abs-gray)] bg-white hover:border-[var(--abs-gray)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-[var(--abs-blue)]" />
                  <span className="font-medium text-[var(--abs-blue-dark)]">{agent.name}</span>
                  <Badge variant={agent.isActive ? "open" : "default"}>
                    {agent.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-[var(--abs-muted)]">{agent.provider}</p>
              </button>
            ))
          )}
        </div>

        {selected ? (
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <h2 className="text-lg font-medium text-[var(--abs-blue-dark)]">{selected.name}</h2>
              <p className="mt-2 text-sm text-[var(--abs-muted)]">{selected.persona}</p>
            </Card>

            <Card>
              <h3 className="mb-3 font-medium text-[var(--abs-blue-dark)]">Base de conhecimento</h3>
              <form onSubmit={handleUploadDoc} className="space-y-3">
                <input
                  className={inputClass}
                  placeholder="Título do documento"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                />
                <textarea
                  className={`${inputClass} min-h-[120px] resize-y font-mono text-xs`}
                  placeholder="Cole aqui o conteúdo do documento..."
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                />
                <button type="submit" className={btnSecondary} disabled={uploadingDoc}>
                  {uploadingDoc ? "Enviando..." : "Adicionar documento"}
                </button>
              </form>
              {selected.documents?.length ? (
                <ul className="mt-4 space-y-2">
                  {selected.documents.map((doc) => (
                    <li key={doc.id} className="rounded-lg bg-white px-3 py-2 text-sm text-slate-600">
                      {doc.title}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>

            <Card>
              <h3 className="mb-3 font-medium text-[var(--abs-blue-dark)]">Testar agente</h3>
              <form onSubmit={handleAsk} className="flex gap-2">
                <input
                  className={inputClass}
                  placeholder="Faça uma pergunta..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <button type="submit" className={btnPrimary} disabled={asking}>
                  <Send className="h-4 w-4" />
                </button>
              </form>
              {answer ? (
                <div className="mt-4 rounded-lg bg-white p-4 text-sm text-[var(--abs-blue-dark)]">{answer}</div>
              ) : null}
            </Card>
          </div>
        ) : (
          !loading && agents.length > 0 && (
            <div className="lg:col-span-2">
              <EmptyState message="Selecione um agente para configurar." />
            </div>
          )
        )}
      </div>
    </div>
  );
}
