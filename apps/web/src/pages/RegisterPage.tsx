import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import type { PlanCode, PlanPublic } from "@bot-wpp/shared-types";
import { useAuth } from "../lib/auth";
import { apiRequest } from "../lib/api-base";
import { btnPrimary, inputClass } from "../components/ui/PageHeader";

export function RegisterPage() {
  const { register, user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tenantName, setTenantName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [planId, setPlanId] = useState<PlanCode>((params.get("plan") as PlanCode) || "PRO");
  const [plans, setPlans] = useState<PlanPublic[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiRequest<PlanPublic[]>("/plans")
      .then(setPlans)
      .catch(() => setPlans([]));
  }, []);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register({ tenantName, name, email, password, planId });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao cadastrar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-xl gb-card p-8 gb-animate-in">
        <div className="mb-6 flex items-center gap-3">
          <img src="/brand/gb-systems-logo.png" alt="GB Systems" className="h-12 w-12 rounded-xl object-cover" />
          <div>
            <p className="text-sm font-semibold text-[var(--gb-cyan)]">GB Systems</p>
            <h1 className="gb-display text-2xl font-bold text-white">Criar sua empresa</h1>
          </div>
        </div>
        <p className="text-sm text-[var(--gb-muted)]">
          14 dias de trial. Cadastro cria o tenant, funil CRM e o primeiro administrador.
        </p>

        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-200">Nome da empresa</span>
            <input className={`${inputClass} gb-input`} value={tenantName} onChange={(e) => setTenantName(e.target.value)} required minLength={2} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-200">Seu nome</span>
            <input className={`${inputClass} gb-input`} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-200">E-mail</span>
            <input className={`${inputClass} gb-input`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-200">Senha</span>
            <input className={`${inputClass} gb-input`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-200">Escolha o plano</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(plans.length ? plans : [
                { id: "STARTER", code: "STARTER", name: "Starter", priceMonthly: 97 },
                { id: "PRO", code: "PRO", name: "Professional", priceMonthly: 297 },
                { id: "ENTERPRISE", code: "ENTERPRISE", name: "Enterprise", priceMonthly: 797 },
              ] as PlanPublic[]).map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setPlanId(plan.code)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    planId === plan.code
                      ? "gb-plan-highlight border-transparent bg-white/5"
                      : "border-[var(--gb-border)] hover:border-white/20"
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{plan.name}</p>
                  <p className="mt-1 text-xs text-[var(--gb-muted)]">
                    R$ {Number(plan.priceMonthly).toFixed(0)}/mês
                  </p>
                </button>
              ))}
            </div>
          </fieldset>

          {error ? <p className="text-sm text-[var(--gb-danger)]">{error}</p> : null}

          <button type="submit" disabled={submitting} className={`${btnPrimary} w-full py-2.5`}>
            {submitting ? "Criando..." : "Começar trial grátis"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--gb-muted)]">
          Já tem conta?{" "}
          <Link className="font-semibold text-[var(--gb-cyan)] hover:underline" to="/login">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
