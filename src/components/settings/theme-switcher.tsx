"use client";

import { THEME_OPTIONS } from "@/lib/theme/constants";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";
import { Check, Monitor, Moon, Sun } from "lucide-react";

const ICONS = {
  "executive-dark": Moon,
  light: Sun,
  system: Monitor,
} as const;

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme();

  if (compact) {
    return (
      <div className="flex items-center rounded-md border border-border bg-card p-0.5 gap-0.5">
        {THEME_OPTIONS.map((opt) => {
          const Icon = ICONS[opt.id];
          const active = preference === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              title={opt.label}
              onClick={() => setPreference(opt.id)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-sm transition-colors flow-focus-ring",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="sr-only">{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {THEME_OPTIONS.map((opt) => {
        const Icon = ICONS[opt.id];
        const active = preference === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setPreference(opt.id)}
            className={cn(
              "flex w-full items-start gap-3 rounded-md border px-3 py-3 text-left transition-colors flow-focus-ring",
              active
                ? "border-primary/40 bg-primary/5"
                : "border-border bg-card hover:bg-accent/40"
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border",
                active
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-muted text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{opt.label}</p>
                {active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </div>
              <p className="flow-helper mt-0.5">{opt.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
