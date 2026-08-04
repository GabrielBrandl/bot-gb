import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Bot,
  CreditCard,
  GitBranch,
  Inbox,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Megaphone,
  Settings,
  Users,
  X,
  BarChart3,
  Shield,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { cn } from "../../lib/utils";

const navItems = [
  { to: "/", label: "Início", icon: LayoutDashboard, end: true },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/kanban", label: "Kanban", icon: Kanban },
  { to: "/contatos", label: "Contatos", icon: Users },
  { to: "/automacoes", label: "Automações", icon: GitBranch },
  { to: "/agente-ia", label: "Agente IA", icon: Bot },
  { to: "/campanhas", label: "Campanhas", icon: Megaphone },
  { to: "/pagamentos", label: "Pagamentos", icon: CreditCard },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isOwner = user?.role === "PLATFORM_OWNER";

  return (
    <div className="flex min-h-screen">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--gb-border)] transition-transform lg:static lg:translate-x-0",
          "bg-[linear-gradient(180deg,#0d1424_0%,#070b16_100%)]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--gb-border)] px-4 py-4">
          <div className="flex items-center gap-3">
            <img
              src="/brand/gb-systems-logo.png"
              alt="GB Systems"
              className="h-11 w-11 rounded-xl object-cover ring-1 ring-white/10"
            />
            <div>
              <p className="gb-display text-sm font-bold tracking-wide text-white">GB Systems</p>
              <p className="text-[11px] text-[var(--gb-muted)]">Omnichannel Platform</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-white/80 hover:bg-white/10 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {isOwner ? (
              <li>
                <NavLink
                  to="/admin"
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                      isActive
                        ? "gb-gradient text-white shadow-lg shadow-blue-500/20"
                        : "text-white/80 hover:bg-white/5 hover:text-white",
                    )
                  }
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  Painel Admin
                </NavLink>
              </li>
            ) : null}
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                      isActive
                        ? "gb-gradient text-white shadow-lg shadow-blue-500/20"
                        : "text-white/80 hover:bg-white/5 hover:text-white",
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-[var(--gb-border)] px-4 py-4">
          <div className="mb-3 truncate">
            <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
            <p className="truncate text-xs text-[var(--gb-muted)]">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-[var(--gb-border)] bg-[var(--gb-bg-elevated)]/80 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--gb-cyan)] hover:bg-white/5"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="text-sm font-bold text-white">GB Systems</p>
        </div>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
