import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="gb-display text-2xl font-bold tracking-tight text-white">{title}</h1>
        {description ? <p className="mt-1 text-sm text-[var(--gb-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function LoadingState({ message = "Carregando..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-[var(--gb-muted)]">
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
      {message}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-[var(--gb-muted)]">
      {message}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <article className={`gb-card p-5 ${className}`}>{children}</article>;
}

export const inputClass = "gb-input text-sm";

export const selectClass =
  "rounded-xl border border-[var(--gb-border)] bg-[rgba(7,11,22,0.65)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--gb-purple)] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.2)]";

export const btnPrimary =
  "inline-flex items-center justify-center gb-btn-primary px-4 py-2 text-sm disabled:opacity-60";

export const btnSecondary =
  "inline-flex items-center justify-center gb-btn-secondary px-4 py-2 text-sm disabled:opacity-60";

export const btnDanger =
  "inline-flex items-center justify-center rounded-xl border border-rose-500/30 px-4 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-60";
