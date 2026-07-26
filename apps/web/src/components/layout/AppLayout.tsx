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
  Wrench,
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

  return (
    <div className="flex min-h-screen bg-[var(--abs-bg)]">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[var(--abs-blue-dark)]/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col text-white transition-transform lg:static lg:translate-x-0",
          "abs-gradient shadow-xl shadow-[var(--abs-blue-dark)]/20",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--abs-yellow)] text-[var(--abs-blue-dark)]">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-wide">ABS Resolve</p>
              <p className="text-xs text-white/70">Atendimento WhatsApp</p>
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
                        ? "bg-[var(--abs-yellow)] text-[var(--abs-blue-dark)] shadow-sm"
                        : "text-white/85 hover:bg-white/10 hover:text-white",
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

        <div className="border-t border-white/10 px-4 py-4">
          <div className="mb-3 truncate">
            <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
            <p className="truncate text-xs text-white/65">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-[var(--abs-gray)] bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--abs-blue)] hover:bg-[var(--abs-bg)]"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="text-sm font-bold text-[var(--abs-blue-dark)]">ABS Resolve</p>
        </div>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
