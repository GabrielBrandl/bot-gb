import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Megaphone,
  MessageSquare,
  Users,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { reportsApi, tenantsApi } from "../lib/api";
import type { ReportsOverview, Tenant } from "../lib/types";
import { Card, ErrorState, LoadingState, PageHeader } from "../components/ui/PageHeader";

export function DashboardPage() {
  const { user, token } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [reports, setReports] = useState<ReportsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      tenantsApi.me(token).catch(() => null),
      reportsApi.overview(token).catch(() => null),
    ])
      .then(([t, r]) => {
        setTenant(t);
        setReports(r);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar dados");
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingState />;

  const volume = reports
    ? [
        {
          label: "Mensagens recebidas (entrada)",
          value: reports.messagesInbound ?? 0,
          icon: ArrowDownLeft,
          tone: "border-l-[var(--abs-blue)]",
        },
        {
          label: "Mensagens enviadas (saída)",
          value: reports.messagesOutbound ?? 0,
          icon: ArrowUpRight,
          tone: "border-l-[var(--abs-yellow)]",
        },
      ]
    : [];

  const stats = reports
    ? [
        { label: "Conversas abertas", value: reports.conversationsOpen ?? 0, icon: MessageSquare, to: "/inbox" },
        { label: "Contatos", value: reports.contactsTotal ?? 0, icon: Users, to: "/contatos" },
        { label: "Campanhas ativas", value: reports.campaignsActive ?? 0, icon: Megaphone, to: "/campanhas" },
        { label: "Pagamentos pendentes", value: reports.paymentsPending ?? 0, icon: CreditCard, to: "/pagamentos" },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="Início"
        description={`Bem-vindo, ${user?.name ?? "usuário"}. Visão geral da operação ABS Resolve.`}
      />

      {error ? (
        <div className="mb-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      {volume.length > 0 ? (
        <section className="mb-6 grid gap-4 sm:grid-cols-2">
          {volume.map(({ label, value, icon: Icon, tone }) => (
            <Card key={label} className={`border-l-4 ${tone}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-[var(--abs-muted)]">{label}</p>
                  <p className="mt-1 text-3xl font-semibold text-[var(--abs-blue-dark)]">{value}</p>
                </div>
                <Icon className="h-5 w-5 text-[var(--abs-blue)]/70" />
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      {stats.length > 0 ? (
        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, to }) => (
            <Link key={label} to={to} className="group">
              <Card className="transition hover:border-[var(--abs-blue)]/30">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-[var(--abs-muted)]">{label}</p>
                    <p className="mt-1 text-3xl font-semibold text-[var(--abs-blue-dark)]">{value}</p>
                  </div>
                  <Icon className="h-5 w-5 text-[var(--abs-blue)]/60 transition group-hover:text-[var(--abs-blue)]" />
                </div>
              </Card>
            </Link>
          ))}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-medium text-[var(--abs-blue-dark)]">Usuário</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--abs-muted)]">Nome</dt>
              <dd>{user?.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--abs-muted)]">E-mail</dt>
              <dd>{user?.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--abs-muted)]">Papel</dt>
              <dd>{user?.role}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="text-lg font-medium text-[var(--abs-blue-dark)]">Empresa</h2>
          {tenant ? (
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--abs-muted)]">Nome</dt>
                <dd>{tenant.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--abs-muted)]">Plano</dt>
                <dd>{tenant.plan ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--abs-muted)]">Slug</dt>
                <dd>{tenant.slug}</dd>
              </div>
              {reports ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--abs-muted)]">Mensagens hoje</dt>
                  <dd>{reports.messagesToday ?? 0}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-[var(--abs-muted)]">Dados da empresa indisponíveis.</p>
          )}
        </Card>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-medium text-[var(--abs-muted)]">Acesso rápido</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { to: "/inbox", label: "Abrir Inbox" },
            { to: "/kanban", label: "Ver Kanban" },
            { to: "/automacoes", label: "Automações" },
            { to: "/pagamentos", label: "Pagamentos" },
            { to: "/configuracoes", label: "Configurações" },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="rounded-lg border border-[var(--abs-gray)] px-4 py-2 text-sm text-slate-600 transition hover:border-[var(--abs-yellow)] hover:text-[var(--abs-blue)]"
            >
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
