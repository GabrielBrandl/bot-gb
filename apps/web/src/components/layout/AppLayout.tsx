import { useEffect, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
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
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  Users,
  X,
  BarChart3,
  Shield,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { getStoredTheme, toggleTheme, type ThemeMode } from "../../lib/theme";
import { cn } from "../../lib/utils";

const SIDEBAR_COLLAPSED_KEY = "gb-sidebar-collapsed";

/** Menus do portal do cliente. Super Admin só vê isso ao abrir a empresa em outra guia. */
const tenantNav = [
  { to: "", label: "Início", icon: LayoutDashboard, end: true, roles: ["ADMIN", "SUPERVISOR", "AGENT"] },
  { to: "inbox", label: "Inbox", icon: Inbox, roles: ["ADMIN", "SUPERVISOR", "AGENT"] },
  { to: "kanban", label: "Kanban", icon: Kanban, roles: ["ADMIN", "SUPERVISOR", "AGENT"] },
  { to: "contatos", label: "Contatos", icon: Users, roles: ["ADMIN", "SUPERVISOR", "AGENT"] },
  { to: "automacoes", label: "Automações", icon: GitBranch, roles: ["ADMIN", "SUPERVISOR"] },
  { to: "agente-ia", label: "Agente IA", icon: Bot, roles: ["ADMIN", "SUPERVISOR"] },
  { to: "campanhas", label: "Campanhas", icon: Megaphone, roles: ["ADMIN", "SUPERVISOR"] },
  { to: "pagamentos", label: "Pagamentos", icon: CreditCard, roles: ["ADMIN"] },
  { to: "relatorios", label: "Relatórios", icon: BarChart3, roles: ["ADMIN", "SUPERVISOR"] },
  { to: "configuracoes", label: "Configurações", icon: Settings, roles: ["ADMIN"] },
];

function getStoredCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppLayout() {
  const { user, logout, tabSession } = useAuth();
  const { slug } = useParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => getStoredCollapsed());
  const [theme, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());
  const isOwner = user?.role === "PLATFORM_OWNER";
  const isControlPanel = Boolean(isOwner && !user?.impersonating);
  const inCompanyPortal = Boolean(user?.impersonating || tabSession);
  const base = slug ? `/t/${slug}` : "";

  useEffect(() => {
    const sync = () => setThemeMode(getStoredTheme());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const navItems = tenantNav.filter((item) => {
    if (!user) return false;
    if (isControlPanel) return false;
    if (inCompanyPortal) return true;
    return item.roles.includes(user.role);
  });

  function handleToggleTheme() {
    setThemeMode(toggleTheme());
  }

  function handleToggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className="flex min-h-screen">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "var(--gb-overlay)" }}
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--gb-border)] transition-[width,transform] duration-200 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "w-64 lg:w-[4.5rem]" : "w-64",
        )}
        style={{ background: "var(--gb-sidebar)" }}
      >
        <div
          className={cn(
            "flex items-center border-b border-[var(--gb-border)] py-4",
            collapsed ? "justify-between px-4 lg:justify-center lg:px-2" : "justify-between px-4",
          )}
        >
          <div className={cn("flex items-center gap-3", collapsed && "lg:hidden")}>
            <img
              src="/brand/gb-systems-logo.png"
              alt="GB Systems"
              className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-[var(--gb-border)]"
            />
            <div className="min-w-0">
              <p className="gb-display text-sm font-bold tracking-wide text-[var(--gb-text)]">GB Systems</p>
              <p className="truncate text-[11px] text-[var(--gb-muted)]">
                {isControlPanel ? "Painel Super Admin" : user?.tenantName ?? "Portal da empresa"}
              </p>
            </div>
          </div>

          <div className={cn("flex items-center gap-1", collapsed && "lg:flex-col")}>
            <button
              type="button"
              className="hidden rounded-lg p-1.5 text-[var(--gb-muted)] transition hover:bg-[var(--gb-surface-2)] hover:text-[var(--gb-cyan)] lg:inline-flex"
              onClick={handleToggleCollapse}
              title={collapsed ? "Expandir menu" : "Minimizar menu"}
              aria-label={collapsed ? "Expandir menu" : "Minimizar menu"}
            >
              {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
            <button
              type="button"
              className="rounded-lg p-1 text-[var(--gb-muted)] hover:bg-[var(--gb-surface-2)] lg:hidden"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {collapsed ? (
          <div className="hidden justify-center border-b border-[var(--gb-border)] py-3 lg:flex">
            <img
              src="/brand/gb-systems-logo.png"
              alt="GB Systems"
              className="h-9 w-9 rounded-xl object-cover ring-1 ring-[var(--gb-border)]"
              title="GB Systems"
            />
          </div>
        ) : null}

        <nav className={cn("flex-1 overflow-y-auto py-4", collapsed ? "px-3 lg:px-2" : "px-3")}>
          <ul className="space-y-1">
            {isControlPanel ? (
              <li>
                <NavLink
                  to="/admin"
                  end
                  onClick={() => setMobileOpen(false)}
                  title="Controle de clientes"
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition",
                      collapsed ? "px-3 lg:justify-center lg:px-0" : "px-3",
                      isActive
                        ? "gb-gradient text-white shadow-lg shadow-blue-500/20"
                        : "hover:bg-[var(--gb-surface-2)] hover:text-[var(--gb-text)]",
                    )
                  }
                  style={({ isActive }) => (isActive ? undefined : { color: "var(--gb-nav-text)" })}
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  <span className={cn(collapsed && "lg:hidden")}>Controle de clientes</span>
                </NavLink>
              </li>
            ) : null}

            {navItems.map(({ to, label, icon: Icon, end }) => (
              <li key={to || "home"}>
                <NavLink
                  to={`${base}/${to}`.replace(/\/$/, "") || base || "/"}
                  end={end}
                  onClick={() => setMobileOpen(false)}
                  title={label}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition",
                      collapsed ? "px-3 lg:justify-center lg:px-0" : "px-3",
                      isActive
                        ? "gb-gradient text-white shadow-lg shadow-blue-500/20"
                        : "hover:bg-[var(--gb-surface-2)] hover:text-[var(--gb-text)]",
                    )
                  }
                  style={({ isActive }) => (isActive ? undefined : { color: "var(--gb-nav-text)" })}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={cn(collapsed && "lg:hidden")}>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className={cn("border-t border-[var(--gb-border)] py-4", collapsed ? "px-4 lg:px-2" : "px-4")}>
          <div className={cn("mb-3 truncate", collapsed && "lg:hidden")}>
            <p className="truncate text-sm font-semibold text-[var(--gb-text)]">{user?.name}</p>
            <p className="truncate text-xs text-[var(--gb-muted)]">
              {isControlPanel
                ? "Super Admin"
                : inCompanyPortal
                  ? "Acesso empresa"
                  : user?.role === "AGENT"
                    ? "Atendente"
                    : user?.role === "ADMIN"
                      ? "Admin empresa"
                      : user?.role === "SUPERVISOR"
                        ? "Supervisor"
                        : user?.role}
              {" · "}
              {user?.email}
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleTheme}
            title={theme === "light" ? "Tema escuro" : "Tema claro"}
            className={cn(
              "mb-2 flex w-full items-center gap-2 rounded-xl py-2 text-sm transition hover:bg-[var(--gb-surface-2)]",
              collapsed ? "px-3 lg:justify-center lg:px-0" : "px-3",
            )}
            style={{ color: "var(--gb-nav-text)" }}
          >
            {theme === "light" ? <Moon className="h-4 w-4 shrink-0" /> : <Sun className="h-4 w-4 shrink-0" />}
            <span className={cn(collapsed && "lg:hidden")}>{theme === "light" ? "Tema escuro" : "Tema claro"}</span>
          </button>
          <button
            type="button"
            onClick={logout}
            title="Sair"
            className={cn(
              "flex w-full items-center gap-2 rounded-xl py-2 text-sm transition hover:bg-[var(--gb-surface-2)]",
              collapsed ? "px-3 lg:justify-center lg:px-0" : "px-3",
            )}
            style={{ color: "var(--gb-nav-text)" }}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={cn(collapsed && "lg:hidden")}>Sair</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-[var(--gb-border)] bg-[var(--gb-bg-elevated)]/80 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--gb-cyan)] hover:bg-[var(--gb-surface-2)]"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="text-sm font-bold text-[var(--gb-text)]">
            {isControlPanel ? "Super Admin" : user?.tenantName || "GB Systems"}
          </p>
          <button
            type="button"
            onClick={handleToggleTheme}
            className="ml-auto rounded-lg p-2 text-[var(--gb-muted)] hover:bg-[var(--gb-surface-2)]"
            aria-label="Alternar tema"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </div>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
