"use client";

import { LiveRefresh, type LiveRefreshProps } from "@/components/platform/live-refresh";

/** Planning calendar live refresh — 2 minute default interval. */
export function PlanningLiveRefresh(props: Omit<LiveRefreshProps, "intervalMs"> & { intervalMs?: number }) {
  return <LiveRefresh intervalMs={props.intervalMs ?? 120_000} enabled={props.enabled} />;
}
