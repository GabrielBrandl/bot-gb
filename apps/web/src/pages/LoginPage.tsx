import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { btnPrimary, inputClass } from "../components/ui/PageHeader";

export function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@demo.gbsystems.com.br");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to={user.role === "PLATFORM_OWNER" ? "/admin" : "/"} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await login({ email, password });
      navigate(res.user.role === "PLATFORM_OWNER" ? "/admin" : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 gb-gradient opacity-90" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25) 0%, transparent 35%), radial-gradient(circle at 80% 70%, rgba(14,10,40,0.5) 0%, transparent 40%)",
          }}
        />
        <div className="relative z-10 flex items-center gap-4 text-white">
          <div className="gb-orbit grid h-16 w-16 place-items-center">
            <img src="/brand/gb-systems-logo.png" alt="GB Systems" className="h-14 w-14 rounded-2xl object-cover" />
          </div>
          <div>
            <p className="gb-display text-xl font-bold tracking-tight">GB Systems</p>
            <p className="text-sm text-white/75">Plataforma omnichannel de atendimento</p>
          </div>
        </div>
        <div className="relative z-10 max-w-md text-white gb-animate-in">
          <h2 className="gb-display text-4xl font-bold leading-tight">
            WhatsApp, Instagram e IA em um só painel.
          </h2>
          <p className="mt-4 text-base text-white/80">
            Inbox unificado, automações estilo chatbot, CRM Kanban, campanhas e cobranças — pronto para vender.
          </p>
        </div>
        <p className="relative z-10 text-xs text-white/60">© GB Systems — connectivity & automation</p>
      </section>

      <section className="grid place-items-center px-4 py-10">
        <div className="w-full max-w-md gb-card p-8 gb-animate-in">
          <p className="text-sm font-semibold text-[var(--gb-cyan)]">Acesso à plataforma</p>
          <h1 className="gb-display mt-2 text-2xl font-bold text-white">Entrar</h1>
          <p className="mt-2 text-sm text-[var(--gb-muted)]">
            Use as credenciais da sua empresa para continuar.
          </p>

          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-200">E-mail</span>
              <input
                className={`${inputClass} gb-input`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-200">Senha</span>
              <input
                className={`${inputClass} gb-input`}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>

            {error ? <p className="text-sm text-[var(--gb-danger)]">{error}</p> : null}

            <button type="submit" disabled={submitting} className={`${btnPrimary} w-full py-2.5`}>
              {submitting ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--gb-muted)]">
            Ainda não tem conta?{" "}
            <Link className="font-semibold text-[var(--gb-violet)] hover:underline" to="/register">
              Criar empresa
            </Link>
            {" · "}
            <Link className="font-semibold text-[var(--gb-cyan)] hover:underline" to="/planos">
              Ver planos
            </Link>
          </p>
          <div className="mt-4 rounded-xl border border-[var(--gb-border)] bg-white/5 p-3 text-xs text-[var(--gb-muted)]">
            <p className="font-semibold text-slate-300">Acessos seed</p>
            <p className="mt-1">Demo: admin@demo.gbsystems.com.br / admin123</p>
            <p>Admin GB: admin@gbsystems.com.br / admin123</p>
          </div>
        </div>
      </section>
    </div>
  );
}
