import { FormEvent, useEffect, useState } from "react";
import { Plus, QrCode, RefreshCw, Trash2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { tenantsApi, usersApi, whatsappApi } from "../lib/api";
import type { TeamUser, Tenant, WhatsappInstance } from "../lib/types";
import { Badge, statusBadgeVariant, statusLabel } from "../components/ui/Badge";
import {
  btnPrimary,
  btnDanger,
  btnSecondary,
  Card,
  ErrorState,
  inputClass,
  LoadingState,
  PageHeader,
} from "../components/ui/PageHeader";

type Tab = "whatsapp" | "equipe" | "marca" | "plano";

export function SettingsPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>("whatsapp");
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [instances, setInstances] = useState<WhatsappInstance[]>([]);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WhatsApp
  const [instanceName, setInstanceName] = useState("");
  const [qrData, setQrData] = useState<{ base64?: string; code?: string } | null>(null);
  const [qrInstanceId, setQrInstanceId] = useState<string | null>(null);

  // Marca
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0033B5");
  const [savingBrand, setSavingBrand] = useState(false);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [t, i, u] = await Promise.all([
        tenantsApi.me(token).catch(() => null),
        whatsappApi.listInstances(token).catch(() => []),
        usersApi.list(token).catch(() => []),
      ]);
      setTenant(t);
      setInstances(i);
      setUsers(u);
      if (t) {
        setLogoUrl(t.logoUrl ?? "");
        setPrimaryColor(t.primaryColor ?? t.brandColor ?? "#0033B5");
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function handleCreateInstance(e: FormEvent) {
    e.preventDefault();
    if (!token || !instanceName.trim()) return;
    try {
      await whatsappApi.createInstance(token, instanceName.trim());
      setInstanceName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar instância");
    }
  }

  async function handleShowQr(id: string) {
    if (!token) return;
    try {
      const qr = await whatsappApi.getQr(token, id);
      setQrData(qr);
      setQrInstanceId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao obter QR Code");
    }
  }

  async function handleRefresh(id: string) {
    if (!token) return;
    try {
      await whatsappApi.refresh(token, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar instância");
    }
  }

  async function handleDelete(id: string) {
    if (!token || !confirm("Remover esta instância?")) return;
    try {
      await whatsappApi.delete(token, id);
      if (qrInstanceId === id) {
        setQrData(null);
        setQrInstanceId(null);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover instância");
    }
  }

  async function handleSaveBrand(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSavingBrand(true);
    try {
      const updated = await tenantsApi.update(token, { logoUrl, primaryColor });
      setTenant(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar marca");
    } finally {
      setSavingBrand(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "whatsapp", label: "WhatsApp" },
    { id: "equipe", label: "Equipe" },
    { id: "marca", label: "Marca" },
    { id: "plano", label: "Plano" },
  ];

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Configurações" description="Gerencie instâncias, equipe e preferências." />

      {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}

      <div className="mb-6 flex flex-wrap gap-2 border-b border-[var(--abs-gray)] pb-4">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              tab === id
                ? "bg-[var(--abs-yellow)]/25 text-[var(--abs-blue)]"
                : "text-[var(--abs-muted)] hover:bg-[var(--abs-bg)] hover:text-[var(--abs-blue-dark)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "whatsapp" && (
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-medium text-[var(--abs-blue-dark)]">Instâncias WhatsApp</h2>
            <form onSubmit={handleCreateInstance} className="mb-4 flex flex-wrap gap-2">
              <input
                className={`${inputClass} max-w-xs`}
                placeholder="Nome da instância"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
              />
              <button type="submit" className={btnPrimary}>
                <Plus className="mr-1.5 inline h-4 w-4" />
                Criar instância
              </button>
            </form>
            <p className="mb-4 text-xs text-[var(--abs-muted)]">
              Modo demo: use &quot;Simular mensagem&quot; na Inbox sem conectar WhatsApp real.
            </p>
            {instances.length === 0 ? (
              <p className="text-sm text-[var(--abs-muted)]">Nenhuma instância configurada.</p>
            ) : (
              <div className="space-y-3">
                {instances.map((inst) => (
                  <div
                    key={inst.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--abs-gray)] bg-white/50 p-4"
                  >
                    <div>
                      <p className="font-medium text-[var(--abs-blue-dark)]">{inst.name}</p>
                      {inst.phone ? <p className="text-xs text-[var(--abs-muted)]">{inst.phone}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusBadgeVariant(inst.status)}>
                        {statusLabel(inst.status)}
                      </Badge>
                      <button type="button" className={btnSecondary} onClick={() => handleShowQr(inst.id)}>
                        <QrCode className="h-4 w-4" />
                      </button>
                      <button type="button" className={btnSecondary} onClick={() => handleRefresh(inst.id)}>
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button type="button" className={btnDanger} onClick={() => handleDelete(inst.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {qrData ? (
            <Card>
              <h3 className="mb-4 font-medium text-[var(--abs-blue-dark)]">QR Code — escaneie no WhatsApp</h3>
              {qrData.base64 ? (
                <img
                  src={qrData.base64.startsWith("data:") ? qrData.base64 : `data:image/png;base64,${qrData.base64}`}
                  alt="QR Code WhatsApp"
                  className="mx-auto max-w-[280px] rounded-lg"
                />
              ) : qrData.code ? (
                <pre className="overflow-x-auto rounded-lg bg-white p-4 text-xs text-slate-600">
                  {qrData.code}
                </pre>
              ) : (
                <p className="text-sm text-[var(--abs-muted)]">QR Code indisponível.</p>
              )}
              <button
                type="button"
                className={`${btnSecondary} mt-4`}
                onClick={() => {
                  setQrData(null);
                  setQrInstanceId(null);
                }}
              >
                Fechar
              </button>
            </Card>
          ) : null}
        </div>
      )}

      {tab === "equipe" && (
        <Card>
          <h2 className="mb-4 text-lg font-medium text-[var(--abs-blue-dark)]">Usuários da equipe</h2>
          {users.length === 0 ? (
            <p className="text-sm text-[var(--abs-muted)]">Nenhum usuário encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--abs-gray)] text-left text-[var(--abs-muted)]">
                    <th className="pb-3 font-medium">Nome</th>
                    <th className="pb-3 font-medium">E-mail</th>
                    <th className="pb-3 font-medium">Papel</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-[var(--abs-gray)]/50">
                      <td className="py-3 text-[var(--abs-blue-dark)]">{u.name}</td>
                      <td className="py-3 text-slate-600">{u.email}</td>
                      <td className="py-3 text-[var(--abs-muted)]">{u.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "marca" && (
        <Card>
          <h2 className="mb-4 text-lg font-medium text-[var(--abs-blue-dark)]">Identidade visual</h2>
          <form onSubmit={handleSaveBrand} className="grid max-w-md gap-4">
            <label className="space-y-1">
              <span className="text-sm text-[var(--abs-muted)]">URL do logo</span>
              <input className={inputClass} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-[var(--abs-muted)]">Cor da marca</span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-[var(--abs-gray)] bg-transparent"
                />
                <input className={inputClass} value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
              </div>
            </label>
            {logoUrl ? (
              <div>
                <span className="text-sm text-[var(--abs-muted)]">Prévia</span>
                <img src={logoUrl} alt="Logo" className="mt-2 h-16 object-contain" />
              </div>
            ) : null}
            <button type="submit" className={`${btnPrimary} w-fit`} disabled={savingBrand}>
              {savingBrand ? "Salvando..." : "Salvar marca"}
            </button>
          </form>
        </Card>
      )}

      {tab === "plano" && (
        <Card>
          <h2 className="mb-4 text-lg font-medium text-[var(--abs-blue-dark)]">Plano atual</h2>
          {tenant ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-[var(--abs-muted)]">Plano</p>
                <p className="text-xl font-semibold text-[var(--abs-blue)]">{tenant.plan ?? "Free"}</p>
              </div>
              {tenant.planLimits ? (
                <div>
                  <p className="mb-2 text-sm text-[var(--abs-muted)]">Limites</p>
                  <dl className="space-y-2">
                    {Object.entries(tenant.planLimits).map(([key, value]) => (
                      <div key={key} className="flex justify-between rounded-lg bg-white px-4 py-2 text-sm">
                        <dt className="text-[var(--abs-muted)]">{key}</dt>
                        <dd className="text-[var(--abs-blue-dark)]">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : (
                <p className="text-sm text-[var(--abs-muted)]">Limites do plano não disponíveis.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--abs-muted)]">Dados do tenant indisponíveis.</p>
          )}
        </Card>
      )}
    </div>
  );
}
