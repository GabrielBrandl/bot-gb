import { FormEvent, useEffect, useState } from "react";
import { Plus, QrCode, RefreshCw, Trash2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { tenantsApi, usersApi, whatsappApi, instagramApi, plansApi } from "../lib/api";
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

type Tab = "whatsapp" | "instagram" | "equipe" | "marca" | "plano";

export function SettingsPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>("whatsapp");
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [instances, setInstances] = useState<WhatsappInstance[]>([]);
  const [igAccounts, setIgAccounts] = useState<Array<{ id: string; name: string; igUsername?: string | null; status: string }>>([]);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [igName, setIgName] = useState("");

  // WhatsApp
  const [instanceName, setInstanceName] = useState("");
  const [qrData, setQrData] = useState<{
    base64?: string | null;
    code?: string | null;
    pairingCode?: string | null;
    message?: string;
  } | null>(null);
  const [qrInstanceId, setQrInstanceId] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Marca
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2F6BFF");
  const [savingBrand, setSavingBrand] = useState(false);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [t, i, u, ig] = await Promise.all([
        tenantsApi.me(token).catch(() => null),
        whatsappApi.listInstances(token).catch(() => []),
        usersApi.list(token).catch(() => []),
        instagramApi.listAccounts(token).catch(() => []),
      ]);
      setTenant(t);
      setInstances(i);
      setUsers(u);
      setIgAccounts(ig);
      if (t) {
        setLogoUrl(t.logoUrl ?? "/brand/gb-systems-logo.png");
        setPrimaryColor(t.primaryColor ?? t.brandColor ?? "#2F6BFF");
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
      setError(null);
      setQrLoading(true);
      const created = await whatsappApi.createInstance(token, instanceName.trim());
      setInstanceName("");
      setQrInstanceId(created.id);
      const immediateQr = (created as WhatsappInstance & {
        qr?: { base64?: string | null; code?: string | null; pairingCode?: string | null };
      }).qr;
      if (immediateQr?.base64 || immediateQr?.code || immediateQr?.pairingCode) {
        setQrData(immediateQr);
      }
      await load();
      await handleShowQr(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar instância");
      setQrLoading(false);
    }
  }

  async function handleShowQr(id: string) {
    if (!token) return;
    setQrLoading(true);
    setQrInstanceId(id);
    setError(null);
    try {
      let qr = await whatsappApi.getQr(token, id);
      // One extra client-side retry — Evolution can lag a second after create/connect.
      if (!qr.base64 && !qr.code && !qr.pairingCode && !qr.message?.includes("demo")) {
        await new Promise((r) => setTimeout(r, 1200));
        qr = await whatsappApi.getQr(token, id);
      }
      setQrData(qr);
      if (!qr.base64 && !qr.code && !qr.pairingCode && qr.message) {
        setError(qr.message);
      }
    } catch (err) {
      setQrData(null);
      setError(err instanceof Error ? err.message : "Erro ao obter QR Code");
    } finally {
      setQrLoading(false);
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
    { id: "instagram", label: "Instagram" },
    { id: "equipe", label: "Equipe" },
    { id: "marca", label: "Marca" },
    { id: "plano", label: "Plano" },
  ];

  async function handleCreateIg(e: FormEvent) {
    e.preventDefault();
    if (!token || !igName.trim()) return;
    try {
      const created = await instagramApi.createAccount(token, igName.trim());
      await instagramApi.connect(token, created.id);
      setIgName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar Instagram");
    }
  }

  async function handleDeleteIg(id: string) {
    if (!token || !confirm("Remover conta Instagram?")) return;
    await instagramApi.remove(token, id);
    await load();
  }

  async function handleSubscribe(planId: string) {
    if (!token) return;
    try {
      await plansApi.subscribe(token, planId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar plano");
    }
  }

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
            <h2 className="mb-2 text-lg font-medium text-white">Instâncias WhatsApp</h2>
            <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-[var(--gb-muted)]">
              <li>Crie uma nova instância (não use a demo para QR real).</li>
              <li>Clique no ícone de QR e escaneie com o WhatsApp do celular.</li>
              <li>Aguarde o status mudar para Conectado; use Atualizar se necessário.</li>
            </ol>
            <form onSubmit={handleCreateInstance} className="mb-4 flex flex-wrap gap-2">
              <input
                className={`${inputClass} max-w-xs`}
                placeholder="Nome da instância (ex: GB Principal)"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                required
              />
              <button type="submit" className={btnPrimary} disabled={qrLoading}>
                <Plus className="mr-1.5 inline h-4 w-4" />
                {qrLoading ? "Gerando QR..." : "Criar e gerar QR"}
              </button>
            </form>
            <p className="mb-4 text-xs text-[var(--abs-muted)]">
              A instância &quot;demo&quot; já vem conectada para testes internos. Para WhatsApp real, crie outra
              instância com Evolution API no ar (Docker local ou EasyPanel).
            </p>
            {instances.length === 0 ? (
              <p className="text-sm text-[var(--abs-muted)]">Nenhuma instância configurada.</p>
            ) : (
              <div className="space-y-3">
                {instances.map((inst) => {
                  const isDemo = String(inst.evolutionInstanceId || "").startsWith("demo-");
                  return (
                    <div
                      key={inst.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--abs-gray)] bg-white/50 p-4"
                    >
                      <div>
                        <p className="font-medium text-[var(--abs-blue-dark)]">
                          {inst.name}
                          {isDemo ? (
                            <span className="ml-2 text-xs font-normal text-[var(--abs-muted)]">(demo)</span>
                          ) : null}
                        </p>
                        {inst.phone ? <p className="text-xs text-[var(--abs-muted)]">{inst.phone}</p> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusBadgeVariant(inst.status)}>
                          {statusLabel(inst.status)}
                        </Badge>
                        <button
                          type="button"
                          className={btnSecondary}
                          title="Mostrar QR Code"
                          onClick={() => handleShowQr(inst.id)}
                        >
                          <QrCode className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className={btnSecondary}
                          title="Atualizar status"
                          onClick={() => handleRefresh(inst.id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className={btnDanger}
                          title="Remover"
                          onClick={() => handleDelete(inst.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {qrLoading ? (
            <Card>
              <p className="text-sm text-[var(--abs-muted)]">
                Gerando QR Code via Evolution API… isso pode levar alguns segundos.
              </p>
            </Card>
          ) : null}

          {qrData ? (
            <Card>
              <h3 className="mb-2 font-medium text-[var(--abs-blue-dark)]">QR Code — escaneie no WhatsApp</h3>
              <p className="mb-4 text-sm text-[var(--abs-muted)]">
                No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho.
              </p>
              {qrData.base64 ? (
                <img
                  src={qrData.base64.startsWith("data:") ? qrData.base64 : `data:image/png;base64,${qrData.base64}`}
                  alt="QR Code WhatsApp"
                  className="mx-auto max-w-[280px] rounded-lg border border-[var(--abs-gray)] bg-white p-3"
                />
              ) : null}
              {qrData.pairingCode ? (
                <p className="mt-3 text-center text-sm text-[var(--abs-blue-dark)]">
                  Código de pareamento: <span className="font-mono font-semibold">{qrData.pairingCode}</span>
                </p>
              ) : null}
              {!qrData.base64 && qrData.code ? (
                <pre className="mt-3 overflow-x-auto rounded-lg bg-white p-4 text-xs text-slate-600">
                  {qrData.code}
                </pre>
              ) : null}
              {!qrData.base64 && !qrData.code && !qrData.pairingCode ? (
                <p className="text-sm text-[var(--abs-muted)]">
                  {qrData.message ??
                    "QR Code indisponível. Confirme que o container evolution-api está no ar e tente Atualizar QR."}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {qrInstanceId ? (
                  <button type="button" className={btnSecondary} onClick={() => handleShowQr(qrInstanceId)}>
                    <RefreshCw className="mr-1.5 inline h-4 w-4" />
                    Atualizar QR
                  </button>
                ) : null}
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    setQrData(null);
                    setQrInstanceId(null);
                  }}
                >
                  Fechar
                </button>
              </div>
            </Card>
          ) : null}
        </div>
      )}

      {tab === "instagram" && (
        <div className="space-y-6">
          <Card>
            <h2 className="mb-2 text-lg font-medium text-white">Contas Instagram</h2>
            <p className="mb-4 text-sm text-[var(--gb-muted)]">
              Conecte Instagram Business via Meta Graph API (DM oficial). Em modo demo, crie a conta e use
              &quot;Simular IG&quot; no Inbox. Configure META_APP_ID / META_APP_SECRET / META_WEBHOOK_VERIFY_TOKEN no .env para produção.
            </p>
            <form onSubmit={handleCreateIg} className="mb-4 flex flex-wrap gap-2">
              <input
                className={`${inputClass} max-w-xs`}
                placeholder="Nome da conta (ex: @suaempresa)"
                value={igName}
                onChange={(e) => setIgName(e.target.value)}
                required
              />
              <button type="submit" className={btnPrimary}>
                <Plus className="mr-1.5 inline h-4 w-4" />
                Conectar Instagram
              </button>
            </form>
            {igAccounts.length === 0 ? (
              <p className="text-sm text-[var(--gb-muted)]">Nenhuma conta Instagram.</p>
            ) : (
              <div className="space-y-3">
                {igAccounts.map((acc) => (
                  <div key={acc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--gb-border)] bg-white/5 p-4">
                    <div>
                      <p className="font-medium text-white">{acc.name}</p>
                      <p className="text-xs text-[var(--gb-muted)]">@{acc.igUsername ?? "instagram"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusBadgeVariant(acc.status)}>{statusLabel(acc.status)}</Badge>
                      <button type="button" className={btnDanger} onClick={() => void handleDeleteIg(acc.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "equipe" && (
        <Card>
          <h2 className="mb-4 text-lg font-medium text-white">Usuários da equipe</h2>
          <form
            className="mb-6 grid gap-2 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!token) return;
              const fd = new FormData(e.currentTarget);
              try {
                await usersApi.create(token, {
                  name: String(fd.get("name") || ""),
                  email: String(fd.get("email") || ""),
                  password: String(fd.get("password") || ""),
                  role: String(fd.get("role") || "AGENT") as "ADMIN" | "SUPERVISOR" | "AGENT",
                });
                e.currentTarget.reset();
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Erro ao criar usuário");
              }
            }}
          >
            <input className={inputClass} name="name" placeholder="Nome" required />
            <input className={inputClass} name="email" type="email" placeholder="E-mail" required />
            <input className={inputClass} name="password" placeholder="Senha" required minLength={6} />
            <select className={inputClass} name="role" defaultValue="AGENT">
              <option value="AGENT">Atendente</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="ADMIN">Admin empresa</option>
            </select>
            <button type="submit" className={`${btnPrimary} sm:col-span-2`}>Adicionar usuário</button>
          </form>
          {users.length === 0 ? (
            <p className="text-sm text-[var(--gb-muted)]">Nenhum usuário encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--gb-border)] text-left text-[var(--gb-muted)]">
                    <th className="pb-3 font-medium">Nome</th>
                    <th className="pb-3 font-medium">E-mail</th>
                    <th className="pb-3 font-medium">Papel</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-[var(--gb-border)]">
                      <td className="py-3 text-white">{u.name}</td>
                      <td className="py-3 text-[var(--gb-muted)]">{u.email}</td>
                      <td className="py-3 text-[var(--gb-muted)]">{u.role}</td>
                      <td className="py-3 text-[var(--gb-muted)]">{u.active === false ? "Inativo" : "Ativo"}</td>
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
          <h2 className="mb-4 text-lg font-medium text-white">Plano atual</h2>
          {tenant ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-[var(--gb-muted)]">Plano</p>
                <p className="text-xl font-semibold text-[var(--gb-cyan)]">{tenant.plan ?? "STARTER"}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["STARTER", "PRO", "ENTERPRISE"] as const).map((planId) => (
                  <button
                    key={planId}
                    type="button"
                    className={tenant.plan === planId ? btnPrimary : btnSecondary}
                    onClick={() => void handleSubscribe(planId)}
                  >
                    {planId === "STARTER" ? "Starter" : planId === "PRO" ? "Professional" : "Enterprise"}
                  </button>
                ))}
              </div>
              <dl className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-white/5 px-4 py-2 text-sm">
                  <dt className="text-[var(--gb-muted)]">Agentes</dt>
                  <dd className="text-white">{tenant.maxAgents ?? "—"}</dd>
                </div>
                <div className="rounded-lg bg-white/5 px-4 py-2 text-sm">
                  <dt className="text-[var(--gb-muted)]">WhatsApp</dt>
                  <dd className="text-white">{tenant.maxInstances ?? "—"}</dd>
                </div>
              </dl>
              <a href="/planos" className="inline-flex text-sm font-semibold text-[var(--gb-violet)] hover:underline">
                Ver comparação completa de planos →
              </a>
            </div>
          ) : (
            <p className="text-sm text-[var(--gb-muted)]">Dados do tenant indisponíveis.</p>
          )}
        </Card>
      )}
    </div>
  );
}
