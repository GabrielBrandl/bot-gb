import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
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
import { LoadingState } from "./components/ui/PageHeader";

const FlowEditorPage = lazy(async () => {
  const mod = await import("./pages/FlowEditorPage");
  return { default: mod.FlowEditorPage };
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-[var(--gb-muted)]">
        Carregando...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/planos" element={<PricingPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="admin" element={<PlatformAdminPage />} />
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
