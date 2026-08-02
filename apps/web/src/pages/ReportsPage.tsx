import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  Clock,
  CreditCard,
  Megaphone,
  MessageSquare,
  Users,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { reportsApi } from "../lib/api";
import type { ReportsOverview } from "../lib/types";
import { Card, ErrorState, LoadingState, PageHeader } from "../components/ui/PageHeader";

export function ReportsPage() {
  const { token } = useAuth();
  const [reports, setReports] = useState<ReportsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    reportsApi
      .overview(token)
      .then(setReports)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar relatórios");
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingState />;

  const volume = reports
    ? [
        {
          label: "Entradas (recebidas)",
          value: reports.messagesInbound ?? 0,
          icon: ArrowDownLeft,
          color: "text-[var(--abs-blue)]",
        },
        {
          label: "Saídas (enviadas)",
          value: reports.messagesOutbound ?? 0,
          icon: ArrowUpRight,
          color: "text-[var(--abs-yellow)]",
        },
      ]
    : [];

  const metrics = reports
    ? [
        {
          label: "Conversas abertas",
          value: reports.conversationsOpen ?? 0,
          icon: MessageSquare,
          color: "text-[var(--abs-blue)]",
        },
        {
          label: "Conversas pendentes",
          value: reports.conversationsPending ?? 0,
          icon: Clock,
          color: "text-amber-500",
        },
        {
          label: "Conversas fechadas",
          value: reports.conversationsClosed ?? 0,
          icon: CheckCircle,
          color: "text-[var(--abs-muted)]",
        },
        {
          label: "Mensagens hoje",
          value: reports.messagesToday ?? 0,
          icon: MessageSquare,
          color: "text-sky-500",
        },
        {
          label: "Total de contatos",
          value: reports.contactsTotal ?? 0,
          icon: Users,
          color: "text-[var(--abs-blue)]",
        },
        {
          label: "Campanhas ativas",
          value: reports.campaignsActive ?? 0,
          icon: Megaphone,
          color: "text-amber-500",
        },
        {
          label: "Pagamentos pendentes",
          value: reports.paymentsPending ?? 0,
          icon: CreditCard,
          color: "text-amber-500",
        },
        {
          label: "Pagamentos recebidos",
          value: reports.paymentsPaid ?? 0,
          icon: CreditCard,
          color: "text-[var(--abs-blue)]",
        },
      ]
    : [];

  return (
    <div>
      <PageHeader title="Relatórios" description="Entradas, saídas e visão geral da operação ABS Resolve." />

      {error ? (
        <ErrorState message={error} />
      ) : reports ? (
        <>
          <section className="mb-6 grid gap-4 sm:grid-cols-2">
            {volume.map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="border-l-4 border-l-[var(--abs-blue)]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-[var(--abs-muted)]">{label}</p>
                    <p className="mt-1 text-3xl font-semibold text-[var(--abs-blue-dark)]">{value}</p>
                  </div>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
              </Card>
            ))}
          </section>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-[var(--abs-muted)]">{label}</p>
                    <p className="mt-1 text-3xl font-semibold text-[var(--abs-blue-dark)]">{value}</p>
                  </div>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
              </Card>
            ))}
          </section>
        </>
      ) : (
        <Card>
          <p className="text-sm text-[var(--abs-muted)]">
            Dados de relatório indisponíveis no momento. Verifique se o endpoint está ativo.
          </p>
        </Card>
      )}
    </div>
  );
}
