import { useEffect, useState } from "react";
import { Building2, MessageSquare, Users } from "lucide-react";
import { useAuth } from "../lib/auth";
import { apiRequest } from "../lib/api-base";
import { Card, ErrorState, LoadingState, PageHeader, btnSecondary, selectClass } from "../components/ui/PageHeader";

interface Overview {
  metrics: { tenants: number; users: number; conversations: number };
  byPlan: Array<{ plan: string; _count: { _all: number } }>;
  plans: Array<{ id: string; name: string; priceMonthly: number }>;
  recentTenants: Array<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    billingStatus: string;
    createdAt: string;
    _count: { users: number; conversations: number; contacts: number };
  }>;
}

export function PlatformAdminPage() {
  const { token, user } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const overview = await apiRequest<Overview>("/platform/overview", {}, token);
      setData(overview);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar admin");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function changePlan(tenantId: string, planId: string) {
    if (!token) return;
    await apiRequest(`/platform/tenants/${tenantId}/plan`, {
      method: "PATCH",
      body: JSON.stringify({ planId }),
    }, token);
    await load();
  }

  async function changeBilling(tenantId: string, billingStatus: string) {
    if (!token) return;
    await apiRequest(`/platform/tenants/${tenantId}/billing`, {
      method: "PATCH",
      body: JSON.stringify({ billingStatus }),
    }, token);
    await load();
  }

  if (user?.role !== "PLATFORM_OWNER") {
    return <ErrorState message="Acesso restrito ao owner da GB Systems." />;
  }

  if (loading) return <LoadingState message="Carregando painel admin..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <div className="gb-animate-in space-y-6">
      <PageHeader
        title="Painel Admin GB Systems"
        description="Gerencie tenants, planos e saúde da plataforma omnichannel."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-[var(--gb-cyan)]" />
            <div>
              <p className="text-xs text-[var(--gb-muted)]">Empresas</p>
              <p className="gb-display text-2xl font-bold text-white">{data.metrics.tenants}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-[var(--gb-violet)]" />
            <div>
              <p className="text-xs text-[var(--gb-muted)]">Usuários</p>
              <p className="gb-display text-2xl font-bold text-white">{data.metrics.users}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-[var(--gb-magenta)]" />
            <div>
              <p className="text-xs text-[var(--gb-muted)]">Conversas</p>
              <p className="gb-display text-2xl font-bold text-white">{data.metrics.conversations}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-white">Distribuição por plano</h2>
        <div className="flex flex-wrap gap-3">
          {data.byPlan.map((row) => (
            <span key={row.plan} className="gb-badge border border-[var(--gb-border)] bg-white/5 text-slate-200">
              {row.plan}: {row._count._all}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-white">Tenants recentes</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-[var(--gb-muted)]">
              <tr>
                <th className="pb-3 font-medium">Empresa</th>
                <th className="pb-3 font-medium">Plano</th>
                <th className="pb-3 font-medium">Billing</th>
                <th className="pb-3 font-medium">Uso</th>
                <th className="pb-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.recentTenants.map((tenant) => (
                <tr key={tenant.id} className="border-t border-[var(--gb-border)]">
                  <td className="py-3">
                    <p className="font-medium text-white">{tenant.name}</p>
                    <p className="text-xs text-[var(--gb-muted)]">{tenant.slug}</p>
                  </td>
                  <td className="py-3">
                    <select
                      className={`${selectClass} gb-input`}
                      value={tenant.plan}
                      onChange={(e) => void changePlan(tenant.id, e.target.value)}
                    >
                      <option value="STARTER">Starter</option>
                      <option value="PRO">Professional</option>
                      <option value="ENTERPRISE">Enterprise</option>
                    </select>
                  </td>
                  <td className="py-3">
                    <select
                      className={`${selectClass} gb-input`}
                      value={tenant.billingStatus}
                      onChange={(e) => void changeBilling(tenant.id, e.target.value)}
                    >
                      <option value="trialing">Trial</option>
                      <option value="active">Ativo</option>
                      <option value="past_due">Inadimplente</option>
                      <option value="suspended">Suspenso</option>
                      <option value="canceled">Cancelado</option>
                    </select>
                  </td>
                  <td className="py-3 text-[var(--gb-muted)]">
                    {tenant._count.users} users · {tenant._count.contacts} contatos · {tenant._count.conversations} chats
                  </td>
                  <td className="py-3">
                    <button type="button" className={btnSecondary} onClick={() => void load()}>
                      Atualizar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
