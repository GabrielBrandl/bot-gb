import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { btnPrimary, inputClass } from "../components/ui/PageHeader";

export function RegisterPage() {
  const { register, user, loading } = useAuth();
  const navigate = useNavigate();
  const [tenantName, setTenantName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await register({ tenantName, name, email, password });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao cadastrar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--abs-bg)] px-4 py-10">
      <div className="w-full max-w-md abs-card p-8">
        <p className="text-sm font-semibold text-[var(--abs-blue)]">ABS Resolve</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--abs-blue-dark)]">Criar sua empresa</h1>
        <p className="mt-2 text-sm text-[var(--abs-muted)]">
          Cadastro cria o tenant e o primeiro administrador.
        </p>

        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[var(--abs-blue-dark)]">Nome da empresa</span>
            <input className={inputClass} value={tenantName} onChange={(e) => setTenantName(e.target.value)} required minLength={2} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[var(--abs-blue-dark)]">Seu nome</span>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[var(--abs-blue-dark)]">E-mail</span>
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[var(--abs-blue-dark)]">Senha</span>
            <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button type="submit" disabled={submitting} className={`${btnPrimary} w-full py-2.5`}>
            {submitting ? "Criando..." : "Criar conta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--abs-muted)]">
          Já tem conta?{" "}
          <Link className="font-semibold text-[var(--abs-blue)] hover:underline" to="/login">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
