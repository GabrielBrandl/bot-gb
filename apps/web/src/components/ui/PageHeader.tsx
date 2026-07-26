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
        <h1 className="text-2xl font-bold tracking-tight text-[var(--abs-blue-dark)]">{title}</h1>
        {description ? <p className="mt-1 text-sm text-[var(--abs-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function LoadingState({ message = "Carregando..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-[var(--abs-muted)]">
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-[var(--abs-muted)]">
      {message}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <article className={`abs-card p-5 ${className}`}>{children}</article>
  );
}

export const inputClass = "abs-input text-sm";

export const selectClass =
  "rounded-xl border border-[var(--abs-gray)] bg-white px-3 py-2 text-sm text-[var(--abs-text)] outline-none focus:border-[var(--abs-blue)] focus:shadow-[0_0_0_3px_rgb(0_51_181_/_0.15)]";

export const btnPrimary =
  "inline-flex items-center justify-center abs-btn-primary px-4 py-2 text-sm disabled:opacity-60";

export const btnSecondary =
  "inline-flex items-center justify-center rounded-xl border border-[var(--abs-gray)] bg-white px-4 py-2 text-sm font-medium text-[var(--abs-blue)] transition hover:bg-[var(--abs-bg)] disabled:opacity-60";

export const btnDanger =
  "inline-flex items-center justify-center rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60";
