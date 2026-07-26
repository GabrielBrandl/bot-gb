import { useEffect, useState } from "react";
import {
  MessageSquare,
  Users,
  Megaphone,
  CreditCard,
  CheckCircle,
  Clock,
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

  const metrics = reports
    ? [
        {
          label: "Conversas abertas",
          value: reports.conversationsOpen,
          icon: MessageSquare,
          color: "text-[var(--abs-blue)]",
        },
        {
          label: "Conversas pendentes",
          value: reports.conversationsPending,
          icon: Clock,
          color: "text-amber-400",
        },
        {
          label: "Conversas fechadas",
          value: reports.conversationsClosed,
          icon: CheckCircle,
          color: "text-[var(--abs-muted)]",
        },
        {
          label: "Mensagens hoje",
          value: reports.messagesToday,
          icon: MessageSquare,
          color: "text-sky-400",
        },
        {
          label: "Total de contatos",
          value: reports.contactsTotal,
          icon: Users,
          color: "text-[var(--abs-blue)]",
        },
        {
          label: "Campanhas ativas",
          value: reports.campaignsActive,
          icon: Megaphone,
          color: "text-amber-400",
        },
        {
          label: "Pagamentos pendentes",
          value: reports.paymentsPending,
          icon: CreditCard,
          color: "text-amber-400",
        },
        {
          label: "Pagamentos recebidos",
          value: reports.paymentsPaid,
          icon: CreditCard,
          color: "text-[var(--abs-blue)]",
        },
      ]
    : [];

  return (
    <div>
      <PageHeader title="Relatórios" description="Métricas e visão geral da operação." />

      {error ? (
        <ErrorState message={error} />
      ) : reports ? (
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
