import { FormEvent, useEffect, useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { useAuth } from "../lib/auth";
import { contactsApi, paymentsApi } from "../lib/api";
import type { Contact, Payment } from "../lib/types";
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

type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";

export function PaymentsPage() {
  const { token } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [contactId, setContactId] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [billingType, setBillingType] = useState<BillingType>("PIX");
  const [sendViaWhatsApp, setSendViaWhatsApp] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [p, c] = await Promise.all([paymentsApi.list(token), contactsApi.list(token)]);
      setPayments(p);
      setContacts(c);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar pagamentos");
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
      await paymentsApi.create(token, {
        contactId: contactId || undefined,
        phone: phone || undefined,
        amount: parseFloat(amount),
        description: description || undefined,
        billingType,
        sendViaWhatsApp,
      });
      setContactId("");
      setPhone("");
      setAmount("");
      setDescription("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar cobrança");
    } finally {
      setSubmitting(false);
    }
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  return (
    <div>
      <PageHeader
        title="Pagamentos ASAAS"
        description="Gere Pix, boleto ou link de cartão e envie no WhatsApp."
        actions={
          <button type="button" className={btnPrimary} onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-1.5 inline h-4 w-4" />
            Nova cobrança
          </button>
        }
      />

      {error ? (
        <div className="mb-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      {showForm ? (
        <Card className="mb-6">
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm text-[var(--abs-muted)]">Contato</span>
              <select
                className={selectClass}
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
              >
                <option value="">Selecionar contato</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.phone}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm text-[var(--abs-muted)]">Telefone (se sem contato)</span>
              <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-[var(--abs-muted)]">Valor (R$)</span>
              <input
                className={inputClass}
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-[var(--abs-muted)]">Forma de pagamento</span>
              <select
                className={selectClass}
                value={billingType}
                onChange={(e) => setBillingType(e.target.value as BillingType)}
              >
                <option value="PIX">Pix</option>
                <option value="BOLETO">Boleto</option>
                <option value="CREDIT_CARD">Cartão</option>
                <option value="UNDEFINED">Cliente escolhe no link</option>
              </select>
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm text-[var(--abs-muted)]">Descrição</span>
              <input
                className={inputClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Serviço hidráulico — visita técnica"
              />
            </label>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={sendViaWhatsApp}
                onChange={(e) => setSendViaWhatsApp(e.target.checked)}
              />
              <span className="text-sm text-[var(--abs-blue-dark)]">
                Enviar link/boleto automaticamente no WhatsApp do contato
              </span>
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" className={btnPrimary} disabled={submitting}>
                {submitting ? "Gerando..." : "Gerar cobrança"}
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
      ) : payments.length === 0 ? (
        <EmptyState message="Nenhuma cobrança registrada. Configure ASAAS_API_KEY no .env para produção." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--abs-gray)] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--abs-gray)] bg-[var(--abs-bg)] text-left text-[var(--abs-muted)]">
                <th className="px-4 py-3 font-medium">Contato</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Link</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-[var(--abs-gray)]/60 hover:bg-[var(--abs-bg)]">
                  <td className="px-4 py-3 text-[var(--abs-blue-dark)]">
                    {payment.contact?.name ?? payment.phone}
                  </td>
                  <td className="px-4 py-3">
                    <Badge>{statusLabel((payment as Payment & { billingType?: string }).billingType ?? "UNDEFINED")}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatCurrency(payment.amount)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusBadgeVariant(payment.status)}>
                      {statusLabel(payment.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {payment.link ? (
                      <a
                        href={payment.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-[var(--abs-blue)] hover:underline"
                      >
                        Abrir <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
