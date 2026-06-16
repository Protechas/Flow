export type ThemePreference = "executive-dark" | "light" | "system";

export const THEME_STORAGE_KEY = "flow-theme-preference";
export const THEME_COOKIE_NAME = "flow-theme-preference";
export const DEFAULT_THEME: ThemePreference = "executive-dark";

export const THEME_OPTIONS: {
  id: ThemePreference;
  label: string;
  description: string;
}[] = [
  {
    id: "executive-dark",
    label: "Executive Dark",
    description: "Premium command-center palette — default",
  },
  {
    id: "light",
    label: "Light",
    description: "Clean enterprise light mode",
  },
  {
    id: "system",
    label: "System",
    description: "Match your device appearance",
  },
];

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === "executive-dark" || value === "light" || value === "system";
}

export function resolveColorScheme(preference: ThemePreference, prefersDark: boolean): "light" | "dark" {
  if (preference === "executive-dark") return "dark";
  if (preference === "light") return "light";
  return prefersDark ? "dark" : "light";
}

export function applyThemeToDocument(preference: ThemePreference, prefersDark = false) {
  const scheme = resolveColorScheme(preference, prefersDark);
  const root = document.documentElement;
  root.classList.toggle("dark", scheme === "dark");
  root.dataset.theme = preference === "executive-dark" ? "executive-dark" : scheme;
  root.style.colorScheme = scheme;
}

/** Inline script — runs before paint to avoid theme flash. */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var c=${JSON.stringify(THEME_COOKIE_NAME)};var d=${JSON.stringify(DEFAULT_THEME)};var p=localStorage.getItem(k);if(!p){var m=document.cookie.match(new RegExp('(?:^|; )'+c+'=([^;]*)'));p=m?decodeURIComponent(m[1]):d;}if(p!=='executive-dark'&&p!=='light'&&p!=='system')p=d;var dark=p==='executive-dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',dark);r.dataset.theme=p==='executive-dark'?'executive-dark':(dark?'dark':'light');r.style.colorScheme=dark?'dark':'light';}catch(e){document.documentElement.classList.add('dark');document.documentElement.dataset.theme='executive-dark';}})();`;
