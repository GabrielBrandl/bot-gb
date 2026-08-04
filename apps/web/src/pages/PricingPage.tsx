import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import type { PlanPublic } from "@bot-wpp/shared-types";
import { apiRequest } from "../lib/api-base";
import { btnPrimary, btnSecondary } from "../components/ui/PageHeader";

export function PricingPage() {
  const [plans, setPlans] = useState<PlanPublic[]>([]);
  const [yearly, setYearly] = useState(false);

  useEffect(() => {
    apiRequest<PlanPublic[]>("/plans").then(setPlans).catch(() => setPlans([]));
  }, []);

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <Link to="/login" className="flex items-center gap-3">
            <img src="/brand/gb-systems-logo.png" alt="GB Systems" className="h-12 w-12 rounded-xl object-cover" />
            <div>
              <p className="gb-display text-lg font-bold text-white">GB Systems</p>
              <p className="text-xs text-[var(--gb-muted)]">Omnichannel Platform</p>
            </div>
          </Link>
          <div className="flex gap-2">
            <Link to="/login" className={btnSecondary}>Entrar</Link>
            <Link to="/register?plan=PRO" className={btnPrimary}>Começar agora</Link>
          </div>
        </header>

        <div className="mb-10 text-center gb-animate-in">
          <p className="inline-flex items-center gap-2 rounded-full border border-[var(--gb-border)] bg-white/5 px-3 py-1 text-xs font-semibold text-[var(--gb-violet)]">
            <Sparkles className="h-3.5 w-3.5" /> Planos comerciais
          </p>
          <h1 className="gb-display mt-4 text-4xl font-bold text-white md:text-5xl">
            Do primeiro atendimento à escala omnichannel
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-[var(--gb-muted)]">
            WhatsApp + Instagram, automações, IA, CRM e cobranças. Escolha o plano ideal e comece com 14 dias de trial.
          </p>
          <div className="mt-6 inline-flex rounded-xl border border-[var(--gb-border)] bg-[var(--gb-surface)] p-1">
            <button type="button" className={`rounded-lg px-4 py-2 text-sm ${!yearly ? "gb-gradient text-white" : "text-[var(--gb-muted)]"}`} onClick={() => setYearly(false)}>Mensal</button>
            <button type="button" className={`rounded-lg px-4 py-2 text-sm ${yearly ? "gb-gradient text-white" : "text-[var(--gb-muted)]"}`} onClick={() => setYearly(true)}>Anual (−17%)</button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => {
            const price = yearly ? Number(plan.priceYearly) / 12 : Number(plan.priceMonthly);
            return (
              <article
                key={plan.id}
                className={`gb-card flex flex-col p-6 ${plan.highlight ? "gb-plan-highlight relative" : ""}`}
              >
                {plan.highlight ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gb-gradient px-3 py-1 text-xs font-bold text-white">
                    Mais popular
                  </span>
                ) : null}
                <h2 className="gb-display text-xl font-bold text-white">{plan.name}</h2>
                <p className="mt-2 text-sm text-[var(--gb-muted)]">{plan.description}</p>
                <p className="mt-6">
                  <span className="gb-display text-4xl font-bold text-white">R$ {price.toFixed(0)}</span>
                  <span className="text-sm text-[var(--gb-muted)]">/mês</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2">
                  {(plan.features as string[]).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gb-cyan)]" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  to={`/register?plan=${plan.code}`}
                  className={`${plan.highlight ? btnPrimary : btnSecondary} mt-8 w-full py-2.5 text-center`}
                >
                  Assinar {plan.name}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
