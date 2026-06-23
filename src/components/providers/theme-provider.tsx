"use client";

import {
  applyThemeToDocument,
  DEFAULT_THEME,
  isThemePreference,
  THEME_COOKIE_NAME,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme/constants";
import { useServerInsertedHTML } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedScheme: "light" | "dark";
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (isThemePreference(stored)) return stored;
  return DEFAULT_THEME;
}

function persistPreference(preference: ThemePreference) {
  localStorage.setItem(THEME_STORAGE_KEY, preference);
  document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(preference)};path=/;max-age=31536000;SameSite=Lax`;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Inject blocking theme script during SSR only — avoids React 19 client script warning.
  useServerInsertedHTML(() => (
    <script
      id="flow-theme-init"
      dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
    />
  ));

  const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_THEME);
  const [resolvedScheme, setResolvedScheme] = useState<"light" | "dark">("dark");

  const syncTheme = useCallback((pref: ThemePreference) => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyThemeToDocument(pref, prefersDark);
    setResolvedScheme(pref === "light" ? "light" : pref === "executive-dark" ? "dark" : prefersDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    const pref = readStoredPreference();
    setPreferenceState(pref);
    syncTheme(pref);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      const current = readStoredPreference();
      if (current === "system") syncTheme("system");
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, [syncTheme]);

  const setPreference = useCallback(
    (pref: ThemePreference) => {
      setPreferenceState(pref);
      persistPreference(pref);
      syncTheme(pref);
    },
    [syncTheme]
  );

  const value = useMemo(
    () => ({ preference, resolvedScheme, setPreference }),
    [preference, resolvedScheme, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
