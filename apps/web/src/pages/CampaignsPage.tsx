import { FormEvent, useEffect, useState } from "react";
import { Megaphone, Play } from "lucide-react";
import { useAuth } from "../lib/auth";
import { campaignsApi, tagsApi } from "../lib/api";
import type { Campaign, Tag } from "../lib/types";
import { Badge, statusBadgeVariant, statusLabel } from "../components/ui/Badge";
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

export function CampaignsPage() {
  const { token } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [tagId, setTagId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [c, t] = await Promise.all([campaignsApi.list(token), tagsApi.list(token)]);
      setCampaigns(c);
      setTags(t);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar campanhas");
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
      await campaignsApi.create(token, {
        name,
        message,
        tagId: tagId || undefined,
      });
      setName("");
      setMessage("");
      setTagId("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar campanha");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStart(id: string) {
    if (!token) return;
    setStartingId(id);
    try {
      await campaignsApi.start(token, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar campanha");
    } finally {
      setStartingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Campanhas"
        description="Disparos em massa para segmentos de contatos."
        actions={
          <button type="button" className={btnPrimary} onClick={() => setShowForm(!showForm)}>
            <Megaphone className="mr-1.5 inline h-4 w-4" />
            Nova campanha
          </button>
        }
      />

      {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}

      {showForm ? (
        <Card className="mb-6">
          <form onSubmit={handleCreate} className="grid gap-4">
            <label className="space-y-1">
              <span className="text-sm text-[var(--abs-muted)]">Nome da campanha</span>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-[var(--abs-muted)]">Mensagem</span>
              <textarea
                className={`${inputClass} min-h-[100px] resize-y`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-[var(--abs-muted)]">Filtrar por tag (opcional)</span>
              <select className={selectClass} value={tagId} onChange={(e) => setTagId(e.target.value)}>
                <option value="">Todos os contatos</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button type="submit" className={btnPrimary} disabled={submitting}>
                {submitting ? "Criando..." : "Criar campanha"}
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
      ) : campaigns.length === 0 ? (
        <EmptyState message="Nenhuma campanha criada." />
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-[var(--abs-blue-dark)]">{campaign.name}</h3>
                  <Badge variant={statusBadgeVariant(campaign.status)}>
                    {statusLabel(campaign.status)}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-[var(--abs-muted)]">{campaign.message}</p>
                {campaign.tag ? (
                  <p className="mt-1 text-xs text-[var(--abs-muted)]">Tag: {campaign.tag.name}</p>
                ) : null}
                {campaign.sentCount !== undefined ? (
                  <p className="mt-1 text-xs text-[var(--abs-muted)]">
                    Enviados: {campaign.sentCount}/{campaign.totalCount ?? "?"}
                  </p>
                ) : null}
              </div>
              {(campaign.status === "draft" || campaign.status === "scheduled") && (
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => handleStart(campaign.id)}
                  disabled={startingId === campaign.id}
                >
                  <Play className="mr-1.5 inline h-4 w-4" />
                  {startingId === campaign.id ? "Iniciando..." : "Iniciar campanha"}
                </button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
