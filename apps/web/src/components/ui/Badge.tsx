import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

const variants = {
  default: "bg-[var(--abs-gray)] text-[var(--abs-blue-dark)]",
  open: "bg-blue-100 text-[var(--abs-blue)]",
  pending: "bg-amber-100 text-amber-700",
  closed: "bg-slate-100 text-slate-600",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-[var(--abs-yellow)]/30 text-[var(--abs-blue-dark)]",
  danger: "bg-red-100 text-red-700",
  info: "bg-sky-100 text-sky-700",
} as const;

interface BadgeProps {
  children: ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function statusBadgeVariant(status: string): keyof typeof variants {
  switch (status) {
    case "open":
      return "open";
    case "pending":
      return "pending";
    case "closed":
      return "closed";
    case "connected":
    case "paid":
    case "completed":
      return "success";
    case "connecting":
    case "running":
    case "scheduled":
      return "warning";
    case "disconnected":
    case "cancelled":
    case "failed":
    case "expired":
      return "danger";
    default:
      return "default";
  }
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: "Aberta",
    pending: "Pendente",
    closed: "Fechada",
    connected: "Conectado",
    connecting: "Conectando",
    disconnected: "Desconectado",
    draft: "Rascunho",
    scheduled: "Agendada",
    running: "Em execução",
    completed: "Concluída",
    cancelled: "Cancelada",
    pending_payment: "Pendente",
    paid: "Pago",
    expired: "Expirado",
    PIX: "Pix",
    BOLETO: "Boleto",
    CREDIT_CARD: "Cartão",
  };
  return labels[status] ?? status;
}
