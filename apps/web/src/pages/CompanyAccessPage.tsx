import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { apiRequest } from "../lib/api-base";
import type { AuthResponse } from "@bot-wpp/shared-types";
import { ErrorState, LoadingState } from "../components/ui/PageHeader";

/** Troca o código one-time do Super Admin pela sessão da empresa nesta aba. */
export function CompanyAccessPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { persistAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    if (!code) {
      setError("Link inválido. Abra novamente pelo Super Admin.");
      return;
    }

    apiRequest<AuthResponse>("/platform/access/exchange", {
      method: "POST",
      body: JSON.stringify({ code }),
    })
      .then((auth) => {
        persistAuth(auth, { tabSession: true });
        navigate(`/t/${slug || auth.user.tenantSlug}/inbox`, { replace: true });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Não foi possível abrir a empresa");
      });
  }, [params, persistAuth, navigate, slug]);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="max-w-md space-y-3">
          <ErrorState message={error} />
          <p className="text-center text-sm text-[var(--gb-muted)]">
            Volte ao Super Admin e clique em &quot;Entrar na empresa&quot; de novo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center">
      <LoadingState message="Abrindo painel da empresa..." />
    </div>
  );
}
