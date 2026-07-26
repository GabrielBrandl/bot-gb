import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Wrench } from "lucide-react";
import { useAuth } from "../lib/auth";
import { btnPrimary, inputClass } from "../components/ui/PageHeader";

export function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@absresolve.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({ email, password });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden abs-gradient lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #FFD633 0%, transparent 35%), radial-gradient(circle at 80% 70%, #FFFFFF 0%, transparent 30%)",
          }}
        />
        <div className="relative z-10 flex items-center gap-3 text-white">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--abs-yellow)] text-[var(--abs-blue-dark)]">
            <Wrench className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-extrabold tracking-tight">ABS Resolve Já</p>
            <p className="text-sm text-white/75">Serviços residenciais com atendimento inteligente</p>
          </div>
        </div>
        <div className="relative z-10 max-w-md text-white">
          <h2 className="text-4xl font-extrabold leading-tight">
            WhatsApp, CRM e automação em um só painel.
          </h2>
          <p className="mt-4 text-base text-white/80">
            Conecte números via QR Code, treine a IA com sua base de conhecimento e cobre com Pix, boleto ou cartão via ASAAS.
          </p>
        </div>
        <p className="relative z-10 text-xs text-white/60">© ABS Resolve — confiança + solução</p>
      </section>

      <section className="grid place-items-center bg-[var(--abs-bg)] px-4 py-10">
        <div className="w-full max-w-md abs-card p-8">
          <p className="text-sm font-semibold text-[var(--abs-blue)]">Acesso à plataforma</p>
          <h1 className="mt-2 text-2xl font-bold text-[var(--abs-blue-dark)]">Entrar</h1>
          <p className="mt-2 text-sm text-[var(--abs-muted)]">
            Use suas credenciais da empresa para continuar.
          </p>

          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--abs-blue-dark)]">E-mail</span>
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--abs-blue-dark)]">Senha</span>
              <input
                className={inputClass}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <button type="submit" disabled={submitting} className={`${btnPrimary} w-full py-2.5`}>
              {submitting ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--abs-muted)]">
            Ainda não tem conta?{" "}
            <Link className="font-semibold text-[var(--abs-blue)] hover:underline" to="/register">
              Criar empresa
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
