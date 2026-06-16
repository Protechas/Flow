"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface FlowToastContextValue {
  toast: (opts: Omit<Toast, "id">) => void;
}

const FlowToastContext = createContext<FlowToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: "border-success/30 bg-success/10 text-success" },
  error: { icon: AlertTriangle, className: "border-danger/30 bg-danger/10 text-danger" },
  warning: { icon: AlertTriangle, className: "border-warning/30 bg-warning/10 text-warning" },
  info: { icon: Info, className: "border-info/30 bg-info/10 text-info" },
};

export function FlowToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (opts: Omit<Toast, "id">) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev.slice(-4), { ...opts, id }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <FlowToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => {
          const style = VARIANT_STYLES[t.variant];
          const Icon = style.icon;
          return (
            <div
              key={t.id}
              className={cn(
                "pointer-events-auto animate-slide-in-right rounded-md border px-4 py-3 shadow-lg shadow-black/15",
                style.className
              )}
            >
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{t.title}</p>
                  {t.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </FlowToastContext.Provider>
  );
}

export function useFlowToast() {
  const ctx = useContext(FlowToastContext);
  if (!ctx) {
    throw new Error("useFlowToast must be used within FlowToastProvider");
  }
  return ctx;
}
