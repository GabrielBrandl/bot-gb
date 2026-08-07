const THEME_KEY = "gb-theme";

export type ThemeMode = "dark" | "light";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" ? "light" : "dark";
}

export function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function setTheme(theme: ThemeMode) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = getStoredTheme() === "light" ? "dark" : "light";
  setTheme(next);
  return next;
}

/** Aplica tema salvo antes do React montar (evita flash). */
export function initTheme() {
  applyTheme(getStoredTheme());
}
