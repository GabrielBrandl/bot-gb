import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { tenantBySlug } from "../lib/api";
import { btnPrimary, inputClass } from "../components/ui/PageHeader";

export function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const { slug } = useParams();
  const [email, setEmail] = useState(
    slug ? "admin@demo.gbsystems.com.br" : "admin@gbsystems.com.br",
  );
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [tenantSuspended, setTenantSuspended] = useState(false);

  useEffect(() => {
    if (!slug) return;
    tenantBySlug(slug)
      .then((res) => {
        if (res.found && res.tenant) {
          setTenantName(res.tenant.name);
          setTenantSuspended(Boolean(res.tenant.suspended));
        } else {
          setError("Empresa não encontrada");
        }
      })
      .catch(() => setError("Empresa não encontrada"));
  }, [slug]);

  if (!loading && user) {
    if (user.role === "PLATFORM_OWNER" && !user.impersonating) {
      return <Navigate to="/admin" replace />;
    }
    if (user.impersonating && user.tenantSlug) {
      return <Navigate to={`/t/${user.tenantSlug}/inbox`} replace />;
    }
    if (slug) return <Navigate to={`/t/${slug}/inbox`} replace />;
    if (user.tenantSlug) return <Navigate to={`/t/${user.tenantSlug}`} replace />;
    return <Navigate to="/login" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await login({ email, password, tenantSlug: slug });
      if (res.user.role === "PLATFORM_OWNER" && !res.user.impersonating) {
        navigate("/admin");
      } else if (slug) {
        navigate(`/t/${slug}/inbox`);
      } else if (res.user.tenantSlug) {
        navigate(`/t/${res.user.tenantSlug}`);
      } else {
        navigate("/login");
      }
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
        <div className="relative z-10 flex items-center gap-4 text-white">
          <img src="/brand/gb-systems-logo.png" alt="GB Systems" className="h-14 w-14 rounded-2xl object-cover" />
          <div>
            <p className="gb-display text-xl font-bold tracking-tight">GB Systems</p>
            <p className="text-sm text-white/75">
              {tenantName ? `Portal · ${tenantName}` : "Plataforma omnichannel de atendimento"}
            </p>
          </div>
        </div>
        <div className="relative z-10 max-w-md text-white">
          <h2 className="gb-display text-4xl font-bold leading-tight">
            {slug ? "Acesse o chat da sua empresa." : "Super Admin e portais por empresa."}
          </h2>
          <p className="mt-4 text-base text-white/80">
            Cada cliente tem um link exclusivo `/t/sua-empresa` com inbox WhatsApp + Instagram.
          </p>
        </div>
        <p className="relative z-10 text-xs text-white/60">© GB Systems</p>
      </section>

      <section className="grid place-items-center px-4 py-10">
        <div className="w-full max-w-md gb-card p-8">
          <p className="text-sm font-semibold text-[var(--gb-cyan)]">
            {slug ? "Acesso da empresa" : "Acesso GB Systems"}
          </p>
          <h1 className="gb-display mt-2 text-2xl font-bold text-white">Entrar</h1>
          {tenantName ? (
            <p className="mt-2 text-sm text-[var(--gb-muted)]">Empresa: {tenantName}</p>
          ) : (
            <p className="mt-2 text-sm text-[var(--gb-muted)]">Use suas credenciais para continuar.</p>
          )}

          {tenantSuspended ? (
            <p className="mt-4 text-sm text-rose-300">Empresa suspensa. Contate o suporte.</p>
          ) : (
            <form className="mt-8 space-y-4" onSubmit={onSubmit}>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-200">E-mail</span>
                <input className={`${inputClass} gb-input`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-200">Senha</span>
                <input className={`${inputClass} gb-input`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </label>
              {error ? <p className="text-sm text-[var(--gb-danger)]">{error}</p> : null}
              <button type="submit" disabled={submitting} className={`${btnPrimary} w-full py-2.5`}>
                {submitting ? "Entrando..." : "Entrar"}
              </button>
            </form>
          )}

          {!slug ? (
            <div className="mt-4 rounded-xl border border-[var(--gb-border)] bg-white/5 p-3 text-xs text-[var(--gb-muted)]">
              <p className="font-semibold text-slate-300">Acessos</p>
              <p className="mt-1">Super Admin: admin@gbsystems.com.br / admin123</p>
              <p>Demo empresa: admin@demo.gbsystems.com.br / admin123</p>
              <p className="mt-1">Portal demo: /t/demo-gb</p>
            </div>
          ) : null}

          <p className="mt-6 text-center text-sm text-[var(--gb-muted)]">
            <Link className="font-semibold text-[var(--gb-cyan)] hover:underline" to="/planos">
              Ver planos
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
