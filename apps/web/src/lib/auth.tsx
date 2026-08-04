import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthResponse, AuthUser, LoginRequest, RegisterRequest } from "@bot-wpp/shared-types";
import { apiRequest } from "./api";

const STORAGE_KEY = "gb-systems-auth";
const TAB_FLAG = "gb-systems-tab-session";

interface StoredAuth {
  accessToken: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  /** true when this browser tab is a company portal opened from Super Admin */
  tabSession: boolean;
  login: (payload: LoginRequest) => Promise<AuthResponse>;
  register: (payload: RegisterRequest) => Promise<AuthResponse>;
  persistAuth: (data: AuthResponse, options?: { tabSession?: boolean }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isCompanyAccessPath() {
  return typeof window !== "undefined" && /\/t\/[^/]+\/acesso\/?$/.test(window.location.pathname);
}

function readStoredAuth(): { data: StoredAuth; tabSession: boolean } | null {
  const tabRaw = sessionStorage.getItem(STORAGE_KEY);
  if (tabRaw) {
    try {
      return { data: JSON.parse(tabRaw) as StoredAuth, tabSession: true };
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  // Nova guia do Super Admin: não herdar a sessão do localStorage nesta aba.
  if (isCompanyAccessPath()) {
    return null;
  }

  const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("bot-wpp-auth");
  if (!raw) return null;
  try {
    return { data: JSON.parse(raw) as StoredAuth, tabSession: false };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tabSession, setTabSession] = useState(false);
  const [loading, setLoading] = useState(true);
  const authEpoch = useRef(0);

  const persistAuth = useCallback((data: AuthResponse, options?: { tabSession?: boolean }) => {
    authEpoch.current += 1;
    const useTab = Boolean(options?.tabSession || sessionStorage.getItem(TAB_FLAG));
    const payload = JSON.stringify(data);
    if (useTab) {
      sessionStorage.setItem(TAB_FLAG, "1");
      sessionStorage.setItem(STORAGE_KEY, payload);
      setTabSession(true);
    } else {
      localStorage.setItem(STORAGE_KEY, payload);
      localStorage.removeItem("bot-wpp-auth");
      setTabSession(false);
    }
    setToken(data.accessToken);
    setUser(data.user);
    setLoading(false);
  }, []);

  useEffect(() => {
    const stored = readStoredAuth();
    if (!stored) {
      setLoading(false);
      return;
    }

    const epoch = ++authEpoch.current;
    setToken(stored.data.accessToken);
    setUser(stored.data.user);
    setTabSession(stored.tabSession);

    apiRequest<AuthUser>("/auth/me", {}, stored.data.accessToken)
      .then((me) => {
        if (epoch !== authEpoch.current) return;
        setUser(me);
        const next = JSON.stringify({ accessToken: stored.data.accessToken, user: me });
        if (stored.tabSession) {
          sessionStorage.setItem(STORAGE_KEY, next);
        } else {
          localStorage.setItem(STORAGE_KEY, next);
        }
      })
      .catch(() => {
        if (epoch !== authEpoch.current) return;
        if (stored.tabSession) {
          sessionStorage.removeItem(STORAGE_KEY);
          sessionStorage.removeItem(TAB_FLAG);
        } else {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem("bot-wpp-auth");
        }
        setToken(null);
        setUser(null);
        setTabSession(false);
      })
      .finally(() => {
        if (epoch === authEpoch.current) setLoading(false);
      });
  }, []);

  const login = useCallback(
    async (payload: LoginRequest) => {
      const data = await apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      persistAuth(data, { tabSession: false });
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(TAB_FLAG);
      return data;
    },
    [persistAuth],
  );

  const register = useCallback(
    async (payload: RegisterRequest) => {
      const data = await apiRequest<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      persistAuth(data, { tabSession: false });
      return data;
    },
    [persistAuth],
  );

  const logout = useCallback(() => {
    if (sessionStorage.getItem(TAB_FLAG) || sessionStorage.getItem(STORAGE_KEY)) {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(TAB_FLAG);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("bot-wpp-auth");
    }
    setToken(null);
    setUser(null);
    setTabSession(false);
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, tabSession, login, register, persistAuth, logout }),
    [user, token, loading, tabSession, login, register, persistAuth, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
