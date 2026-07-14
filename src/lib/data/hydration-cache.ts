/**
 * Cross-request freshness gate for the flow-store hydrators.
 *
 * The in-memory store survives between requests on a warm server, and every
 * write in the app updates the store AND persists to Supabase — so re-fetching
 * every table on every request buys nothing but latency and egress. Hydrators
 * skip the network while their last successful fetch is younger than the TTL.
 *
 * Staleness contract: data written by ANOTHER server instance can lag by up to
 * the TTL. Live surfaces (request tickets, time clock, notifications) query
 * Supabase directly and never pass through this gate.
 */
const DEFAULT_TTL_MS = 45_000;

/** Set FLOW_HYDRATION_TTL_MS=0 to disable the gate entirely. */
export const HYDRATION_TTL_MS = (() => {
  const raw = Number(process.env.FLOW_HYDRATION_TTL_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_TTL_MS;
})();

const hydratedAt = new Map<string, number>();

export function isHydrationFresh(key: string): boolean {
  if (HYDRATION_TTL_MS <= 0) return false;
  const at = hydratedAt.get(key);
  return at !== undefined && Date.now() - at < HYDRATION_TTL_MS;
}

/** Call only after a fully successful fetch — never after a fallback or skip. */
export function markHydrated(key: string): void {
  hydratedAt.set(key, Date.now());
}

/** Drop freshness for one key (or all keys) so the next read refetches. */
export function invalidateHydration(key?: string): void {
  if (key) hydratedAt.delete(key);
  else hydratedAt.clear();
}
