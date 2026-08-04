import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Copy,
  ExternalLink,
  LogIn,
  MessageSquare,
  Plus,
  Shield,
  Users,
} from "lucide-react";
import type { PlanCode } from "@bot-wpp/shared-types";
import { useAuth } from "../lib/auth";
import { platformApi } from "../lib/api";
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputClass,
  selectClass,
} from "../components/ui/PageHeader";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  billingStatus: string;
  maxAgents: number;
  maxInstances: number;
  maxInstagram: number;
  maxContacts: number;
  portalUrl?: string;
  users?: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    active: boolean;
  }>;
  _count: {
    users: number;
    contacts: number;
    conversations: number;
    instances?: number;
    instagramAccounts?: number;
  };
};

type Overview = {
  metrics: { tenants: number; users: number; conversations: number; suspended: number };
  byPlan: Array<{ plan: string; _count: { _all: number } }>;
};

export function PlatformAdminPage() {
  const { token, user } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{
    portalUrl: string;
    email: string;
    password: string;
  } | null>(null);

  const [form, setForm] = useState({
    companyName: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "admin123",
    planId: "PRO" as PlanCode,
    maxAgents: 10,
    maxWhatsapp: 3,
    maxInstagram: 2,
    maxContacts: 5000,
    billingStatus: "trialing",
  });

  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "agente123",
    role: "AGENT" as "ADMIN" | "SUPERVISOR" | "AGENT",
  });

  const selected = useMemo(
    () => tenants.find((t) => t.id === selectedId) ?? null,
    [tenants, selectedId],
  );

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [ov, list] = await Promise.all([
        platformApi.overview(token) as Promise<Overview>,
        platformApi.listTenants(token) as Promise<TenantRow[]>,
      ]);
      setOverview(ov);
      setTenants(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar Super Admin");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function refreshSelected(id: string) {
    if (!token) return;
    const detail = (await platformApi.getTenant(token, id)) as TenantRow;
    setTenants((prev) => prev.map((t) => (t.id === id ? { ...t, ...detail } : t)));
  }

  async function onCreateCompany(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setCreatedInfo(null);
    try {
      const created = (await platformApi.createTenant(token, form)) as {
        tenant: TenantRow;
        portalUrl: string;
        credentials: { email: string; temporaryPassword: string };
      };
      setCreatedInfo({
        portalUrl: `${window.location.origin}${created.portalUrl}`,
        email: created.credentials.email,
        password: created.credentials.temporaryPassword,
      });
      setForm((f) => ({
        ...f,
        companyName: "",
        adminName: "",
        adminEmail: "",
      }));
      await load();
      setSelectedId(created.tenant.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar empresa");
    } finally {
      setBusy(false);
    }
  }

  async function saveTenant(patch: Record<string, unknown>) {
    if (!token || !selectedId) return;
    setBusy(true);
    try {
      await platformApi.updateTenant(token, selectedId, patch);
      await load();
      await refreshSelected(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar empresa");
    } finally {
      setBusy(false);
    }
  }

  async function enterCompany(tenant: TenantRow) {
    if (!token) return;
    setBusy(true);
    try {
      const link = await platformApi.accessLink(token, tenant.id);
      const url = `${window.location.origin}${link.path}`;
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        // popup blocked — fallback same tab only if needed
        window.location.href = url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao abrir empresa");
    } finally {
      setBusy(false);
    }
  }

  async function addUser(e: FormEvent) {
    e.preventDefault();
    if (!token || !selectedId) return;
    setBusy(true);
    try {
      await platformApi.createUser(token, selectedId, userForm);
      setUserForm({ name: "", email: "", password: "agente123", role: "AGENT" });
      await refreshSelected(selectedId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar usuário");
    } finally {
      setBusy(false);
    }
  }

  async function toggleUser(userId: string, active: boolean) {
    if (!token || !selectedId) return;
    await platformApi.updateUser(token, selectedId, userId, { active });
    await refreshSelected(selectedId);
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text);
  }

  if (user?.role !== "PLATFORM_OWNER") {
    return <ErrorState message="Acesso exclusivo do Super Admin GB Systems." />;
  }
  if (loading) return <LoadingState message="Carregando Super Admin..." />;

  return (
    <div className="gb-animate-in space-y-6">
      <PageHeader
        title="Super Admin GB Systems"
        description="Painel exclusivo: cadastre clientes, planos, limites e entre no portal de cada empresa para ver o chat."
      />

      {error ? <ErrorState message={error} /> : null}

      {overview ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-[var(--gb-cyan)]" />
              <div>
                <p className="text-xs text-[var(--gb-muted)]">Empresas clientes</p>
                <p className="gb-display text-2xl font-bold text-white">{overview.metrics.tenants}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-[var(--gb-violet)]" />
              <div>
                <p className="text-xs text-[var(--gb-muted)]">Usuários</p>
                <p className="gb-display text-2xl font-bold text-white">{overview.metrics.users}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-[var(--gb-magenta)]" />
              <div>
                <p className="text-xs text-[var(--gb-muted)]">Conversas</p>
                <p className="gb-display text-2xl font-bold text-white">{overview.metrics.conversations}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-rose-300" />
              <div>
                <p className="text-xs text-[var(--gb-muted)]">Suspensas</p>
                <p className="gb-display text-2xl font-bold text-white">{overview.metrics.suspended}</p>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-[var(--gb-cyan)]" />
            <h2 className="text-lg font-semibold text-white">Cadastrar novo cliente</h2>
          </div>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={onCreateCompany}>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs text-[var(--gb-muted)]">Nome da empresa</span>
              <input className={inputClass} required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--gb-muted)]">Nome do admin</span>
              <input className={inputClass} required value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--gb-muted)]">E-mail do admin</span>
              <input className={inputClass} type="email" required value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--gb-muted)]">Senha temporária</span>
              <input className={inputClass} required minLength={6} value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--gb-muted)]">Plano</span>
              <select className={selectClass} value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value as PlanCode })}>
                <option value="STARTER">Starter</option>
                <option value="PRO">Professional</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--gb-muted)]">Máx. usuários</span>
              <input className={inputClass} type="number" min={1} value={form.maxAgents} onChange={(e) => setForm({ ...form, maxAgents: Number(e.target.value) })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--gb-muted)]">Máx. WhatsApp</span>
              <input className={inputClass} type="number" min={0} value={form.maxWhatsapp} onChange={(e) => setForm({ ...form, maxWhatsapp: Number(e.target.value) })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--gb-muted)]">Máx. Instagram</span>
              <input className={inputClass} type="number" min={0} value={form.maxInstagram} onChange={(e) => setForm({ ...form, maxInstagram: Number(e.target.value) })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--gb-muted)]">Máx. contatos</span>
              <input className={inputClass} type="number" min={1} value={form.maxContacts} onChange={(e) => setForm({ ...form, maxContacts: Number(e.target.value) })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--gb-muted)]">Status billing</span>
              <select className={selectClass} value={form.billingStatus} onChange={(e) => setForm({ ...form, billingStatus: e.target.value })}>
                <option value="trialing">Trial</option>
                <option value="active">Ativo</option>
                <option value="past_due">Inadimplente</option>
                <option value="suspended">Suspenso</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className={`${btnPrimary} w-full py-2.5`} disabled={busy}>
                {busy ? "Criando..." : "Criar empresa + admin"}
              </button>
            </div>
          </form>

          {createdInfo ? (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              <p className="font-semibold">Cliente criado</p>
              <p className="mt-2 break-all">Portal: {createdInfo.portalUrl}</p>
              <p>Login: {createdInfo.email}</p>
              <p>Senha: {createdInfo.password}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={btnSecondary} onClick={() => copyText(createdInfo.portalUrl)}>
                  <Copy className="mr-1 inline h-3.5 w-3.5" /> Copiar link
                </button>
                <a className={btnSecondary} href={createdInfo.portalUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1 inline h-3.5 w-3.5" /> Abrir portal
                </a>
              </div>
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">Empresas</h2>
          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {tenants.length === 0 ? (
              <p className="text-sm text-[var(--gb-muted)]">Nenhuma empresa cliente ainda.</p>
            ) : (
              tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  type="button"
                  onClick={() => setSelectedId(tenant.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    selectedId === tenant.id
                      ? "border-[var(--gb-purple)] bg-white/10"
                      : "border-[var(--gb-border)] hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white">{tenant.name}</p>
                      <p className="text-xs text-[var(--gb-muted)]">/t/{tenant.slug}</p>
                    </div>
                    <span className="gb-badge border border-[var(--gb-border)] bg-white/5 text-slate-200">
                      {tenant.plan}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[var(--gb-muted)]">
                    {tenant._count.users} users · {tenant._count.conversations} chats · {tenant.billingStatus}
                  </p>
                </button>
              ))
            )}
          </div>
        </Card>
      </div>

      {selected ? (
        <Card>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">{selected.name}</h2>
              <p className="text-sm text-[var(--gb-muted)]">
                Link exclusivo: {window.location.origin}/t/{selected.slug}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnSecondary} onClick={() => copyText(`${window.location.origin}/t/${selected.slug}`)}>
                <Copy className="mr-1 inline h-4 w-4" /> Copiar link
              </button>
              <button type="button" className={btnPrimary} disabled={busy} onClick={() => void enterCompany(selected)}>
                <LogIn className="mr-1 inline h-4 w-4" /> Abrir painel (nova guia)
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-semibold text-white">Plano e limites</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs text-[var(--gb-muted)]">Plano</span>
                  <select
                    className={selectClass}
                    value={selected.plan}
                    onChange={(e) => void saveTenant({ planId: e.target.value })}
                  >
                    <option value="STARTER">Starter</option>
                    <option value="PRO">Professional</option>
                    <option value="ENTERPRISE">Enterprise</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-[var(--gb-muted)]">Billing</span>
                  <select
                    className={selectClass}
                    value={selected.billingStatus}
                    onChange={(e) => void saveTenant({ billingStatus: e.target.value })}
                  >
                    <option value="trialing">Trial</option>
                    <option value="active">Ativo</option>
                    <option value="past_due">Inadimplente</option>
                    <option value="suspended">Suspenso</option>
                    <option value="canceled">Cancelado</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-[var(--gb-muted)]">Usuários</span>
                  <input
                    className={inputClass}
                    type="number"
                    defaultValue={selected.maxAgents}
                    onBlur={(e) => void saveTenant({ maxAgents: Number(e.target.value) })}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-[var(--gb-muted)]">WhatsApp</span>
                  <input
                    className={inputClass}
                    type="number"
                    defaultValue={selected.maxInstances}
                    onBlur={(e) => void saveTenant({ maxWhatsapp: Number(e.target.value) })}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-[var(--gb-muted)]">Instagram</span>
                  <input
                    className={inputClass}
                    type="number"
                    defaultValue={selected.maxInstagram}
                    onBlur={(e) => void saveTenant({ maxInstagram: Number(e.target.value) })}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-[var(--gb-muted)]">Contatos</span>
                  <input
                    className={inputClass}
                    type="number"
                    defaultValue={selected.maxContacts}
                    onBlur={(e) => void saveTenant({ maxContacts: Number(e.target.value) })}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-white">Usuários da empresa</h3>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {(selected.users ?? []).map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--gb-border)] bg-white/5 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-white">{u.name}</p>
                      <p className="text-xs text-[var(--gb-muted)]">{u.email} · {u.role}</p>
                    </div>
                    <button
                      type="button"
                      className={u.active ? btnDanger : btnSecondary}
                      onClick={() => void toggleUser(u.id, !u.active)}
                    >
                      {u.active ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                ))}
              </div>

              <form className="grid gap-2 sm:grid-cols-2" onSubmit={addUser}>
                <input className={inputClass} placeholder="Nome" required value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
                <input className={inputClass} placeholder="E-mail" type="email" required value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
                <input className={inputClass} placeholder="Senha" required minLength={6} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
                <select className={selectClass} value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as typeof userForm.role })}>
                  <option value="AGENT">Atendente</option>
                  <option value="SUPERVISOR">Supervisor</option>
                  <option value="ADMIN">Admin empresa</option>
                </select>
                <button type="submit" className={`${btnSecondary} sm:col-span-2`} disabled={busy}>
                  Adicionar usuário
                </button>
              </form>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
