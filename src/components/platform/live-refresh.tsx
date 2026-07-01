"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export interface LiveRefreshProps {
  /** Poll interval in milliseconds. */
  intervalMs?: number;
  /** When false, polling is disabled. */
  enabled?: boolean;
}

/** Soft-refresh the current route on an interval so server data stays current. */
export function LiveRefresh({ intervalMs = 60_000, enabled = true }: LiveRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => router.refresh(), intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, router]);

  return null;
}
