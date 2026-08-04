import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { tenantBySlug } from "./lib/api";
import { AppLayout } from "./components/layout/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { PricingPage } from "./pages/PricingPage";
import { PlatformAdminPage } from "./pages/PlatformAdminPage";
import { InboxPage } from "./pages/InboxPage";
import { KanbanPage } from "./pages/KanbanPage";
import { ContactsPage } from "./pages/ContactsPage";
import { FlowsPage } from "./pages/FlowsPage";
import { AiAgentsPage } from "./pages/AiAgentsPage";
import { CampaignsPage } from "./pages/CampaignsPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { CompanyAccessPage } from "./pages/CompanyAccessPage";
import { ErrorState, LoadingState } from "./components/ui/PageHeader";

const FlowEditorPage = lazy(async () => {
  const mod = await import("./pages/FlowEditorPage");
  return { default: mod.FlowEditorPage };
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="grid min-h-screen place-items-center text-[var(--gb-muted)]">Carregando...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/** Super Admin no painel de controle só acessa /admin. Em outra guia (empresa) o chat é normal. */
function BlockOwnerFromTenantPortal({ children }: { children: React.ReactNode }) {
  const { user, loading, tabSession } = useAuth();
  if (loading) return null;
  if (user?.role === "PLATFORM_OWNER" && !user.impersonating && !tabSession) {
    return <Navigate to="/admin" replace />;
  }
  return children;
}

function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="grid min-h-screen place-items-center text-[var(--gb-muted)]">Carregando...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "PLATFORM_OWNER") {
    if (user.tenantSlug) return <Navigate to={`/t/${user.tenantSlug}`} replace />;
    return <Navigate to="/login" replace />;
  }
  return children;
}

function TenantGate({ children }: { children: React.ReactNode }) {
  const { slug } = useParams();
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [suspended, setSuspended] = useState(false);

  useEffect(() => {
    if (!slug) return;
    tenantBySlug(slug)
      .then((res) => {
        setValid(res.found);
        setSuspended(Boolean(res.tenant?.suspended));
      })
      .catch(() => setValid(false))
      .finally(() => setChecking(false));
  }, [slug]);

  if (loading || checking) return <LoadingState message="Carregando portal..." />;
  if (!valid) return <ErrorState message="Empresa não encontrada." />;
  if (suspended && user?.role !== "PLATFORM_OWNER") {
    return <ErrorState message="Empresa suspensa. Contate o suporte GB Systems." />;
  }
  if (!user) return <Navigate to={`/t/${slug}/login`} replace />;
  if (user.tenantSlug && user.tenantSlug !== slug && !(user.role === "PLATFORM_OWNER" && user.impersonating)) {
    return <Navigate to={`/t/${user.tenantSlug}`} replace />;
  }
  return children;
}

const portalRoutes = (
  <>
    <Route index element={<DashboardPage />} />
    <Route path="inbox" element={<InboxPage />} />
    <Route path="kanban" element={<KanbanPage />} />
    <Route path="contatos" element={<ContactsPage />} />
    <Route path="automacoes" element={<FlowsPage />} />
    <Route
      path="automacoes/:id"
      element={
        <Suspense fallback={<LoadingState message="Carregando editor..." />}>
          <FlowEditorPage />
        </Suspense>
      }
    />
    <Route path="agente-ia" element={<AiAgentsPage />} />
    <Route path="campanhas" element={<CampaignsPage />} />
    <Route path="pagamentos" element={<PaymentsPage />} />
    <Route path="relatorios" element={<ReportsPage />} />
    <Route path="configuracoes" element={<SettingsPage />} />
  </>
);

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/planos" element={<PricingPage />} />
      <Route path="/t/:slug/login" element={<LoginPage />} />
      <Route path="/t/:slug/acesso" element={<CompanyAccessPage />} />

      <Route
        path="/admin"
        element={
          <RequireSuperAdmin>
            <AppLayout />
          </RequireSuperAdmin>
        }
      >
        <Route index element={<PlatformAdminPage />} />
      </Route>

      <Route
        element={
          <ProtectedRoute>
            <BlockOwnerFromTenantPortal>
              <AppLayout />
            </BlockOwnerFromTenantPortal>
          </ProtectedRoute>
        }
      >
        {portalRoutes}
      </Route>

      <Route
        path="/t/:slug"
        element={
          <TenantGate>
            <BlockOwnerFromTenantPortal>
              <AppLayout />
            </BlockOwnerFromTenantPortal>
          </TenantGate>
        }
      >
        {portalRoutes}
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
