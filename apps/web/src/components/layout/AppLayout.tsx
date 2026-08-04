import { useState } from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
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
  Undo2,
} from "lucide-react";
import type { AuthResponse } from "@bot-wpp/shared-types";
import { useAuth } from "../../lib/auth";
import { platformApi } from "../../lib/api";
import { cn } from "../../lib/utils";
import { btnSecondary } from "../ui/PageHeader";

const allNav = [
  { to: "", label: "Início", icon: LayoutDashboard, end: true, roles: ["PLATFORM_OWNER", "ADMIN", "SUPERVISOR", "AGENT"] },
  { to: "inbox", label: "Inbox", icon: Inbox, roles: ["PLATFORM_OWNER", "ADMIN", "SUPERVISOR", "AGENT"] },
  { to: "kanban", label: "Kanban", icon: Kanban, roles: ["PLATFORM_OWNER", "ADMIN", "SUPERVISOR", "AGENT"] },
  { to: "contatos", label: "Contatos", icon: Users, roles: ["PLATFORM_OWNER", "ADMIN", "SUPERVISOR", "AGENT"] },
  { to: "automacoes", label: "Automações", icon: GitBranch, roles: ["PLATFORM_OWNER", "ADMIN", "SUPERVISOR"] },
  { to: "agente-ia", label: "Agente IA", icon: Bot, roles: ["PLATFORM_OWNER", "ADMIN", "SUPERVISOR"] },
  { to: "campanhas", label: "Campanhas", icon: Megaphone, roles: ["PLATFORM_OWNER", "ADMIN", "SUPERVISOR"] },
  { to: "pagamentos", label: "Pagamentos", icon: CreditCard, roles: ["PLATFORM_OWNER", "ADMIN"] },
  { to: "relatorios", label: "Relatórios", icon: BarChart3, roles: ["PLATFORM_OWNER", "ADMIN", "SUPERVISOR"] },
  { to: "configuracoes", label: "Configurações", icon: Settings, roles: ["PLATFORM_OWNER", "ADMIN"] },
];

export function AppLayout() {
  const { user, token, logout, persistAuth } = useAuth();
  const navigate = useNavigate();
  const { slug } = useParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isOwner = user?.role === "PLATFORM_OWNER";
  const base = slug ? `/t/${slug}` : "";

  const navItems = allNav.filter((item) => user && item.roles.includes(user.role));

  async function exitImpersonation() {
    if (!token) return;
    const auth = (await platformApi.stopImpersonation(token)) as AuthResponse;
    persistAuth(auth);
    navigate("/admin");
  }

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
              <p className="truncate text-[11px] text-[var(--gb-muted)]">
                {user?.tenantName ?? "Omnichannel Platform"}
              </p>
            </div>
          </div>
          <button type="button" className="rounded-lg p-1 text-white/80 hover:bg-white/10 lg:hidden" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {isOwner && !user?.impersonating ? (
              <li>
                <NavLink
                  to="/admin"
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                      isActive ? "gb-gradient text-white shadow-lg shadow-blue-500/20" : "text-white/80 hover:bg-white/5 hover:text-white",
                    )
                  }
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  Super Admin
                </NavLink>
              </li>
            ) : null}
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <li key={to || "home"}>
                <NavLink
                  to={`${base}/${to}`.replace(/\/$/, "") || base || "/"}
                  end={end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                      isActive ? "gb-gradient text-white shadow-lg shadow-blue-500/20" : "text-white/80 hover:bg-white/5 hover:text-white",
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
            <p className="truncate text-xs text-[var(--gb-muted)]">
              {user?.role === "AGENT" ? "Atendente" : user?.role === "ADMIN" ? "Admin empresa" : user?.role === "SUPERVISOR" ? "Supervisor" : "Super Admin"}
              {" · "}
              {user?.email}
            </p>
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
        {user?.impersonating ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-sm text-amber-100">
            <p>
              Modo Super Admin em <strong>{user.tenantName}</strong> (/t/{user.tenantSlug})
            </p>
            <button type="button" className={btnSecondary} onClick={() => void exitImpersonation()}>
              <Undo2 className="mr-1 inline h-4 w-4" /> Voltar ao painel
            </button>
          </div>
        ) : null}

        <div className="flex items-center gap-3 border-b border-[var(--gb-border)] bg-[var(--gb-bg-elevated)]/80 px-4 py-3 backdrop-blur lg:hidden">
          <button type="button" className="rounded-lg p-2 text-[var(--gb-cyan)] hover:bg-white/5" onClick={() => setMobileOpen(true)}>
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
