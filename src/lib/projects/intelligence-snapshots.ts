import type {
  PortfolioIntelligenceSummary,
  ProgramIntelligence,
  ProgramRiskTier,
} from "@/lib/projects/project-intelligence";
import { format, subDays } from "date-fns";

export const INTELLIGENCE_SNAPSHOTS_VERSION = "v1";
export const INTELLIGENCE_SNAPSHOTS_KEY = `flow.intelligence-snapshots.${INTELLIGENCE_SNAPSHOTS_VERSION}`;
export const MAX_SNAPSHOT_HISTORY = 30;

export interface ProgramTrendPoint {
  date: string;
  label: string;
  healthScore: number;
  capacityLoadPct: number;
  riskTier: ProgramRiskTier;
}

export interface PortfolioTrendPoint {
  date: string;
  label: string;
  avgHealthScore: number;
  avgCapacityLoadPct: number;
  atRiskCount: number;
}

type SnapshotStore = {
  portfolio: PortfolioTrendPoint[];
  programs: Record<string, ProgramTrendPoint[]>;
};

function todayKey(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function chartLabel(date: string): string {
  return format(new Date(`${date}T12:00:00`), "MMM d");
}

function readStore(storage: Pick<Storage, "getItem"> | null): SnapshotStore {
  if (!storage) return { portfolio: [], programs: {} };
  try {
    const raw = storage.getItem(INTELLIGENCE_SNAPSHOTS_KEY);
    if (!raw) return { portfolio: [], programs: {} };
    const parsed = JSON.parse(raw) as SnapshotStore;
    return {
      portfolio: Array.isArray(parsed.portfolio) ? parsed.portfolio : [],
      programs: parsed.programs && typeof parsed.programs === "object" ? parsed.programs : {},
    };
  } catch {
    return { portfolio: [], programs: {} };
  }
}

function writeStore(
  storage: Pick<Storage, "setItem">,
  store: SnapshotStore
): void {
  storage.setItem(INTELLIGENCE_SNAPSHOTS_KEY, JSON.stringify(store));
}

function upsertPoint<T extends { date: string }>(
  series: T[],
  point: T,
  max = MAX_SNAPSHOT_HISTORY
): T[] {
  const withoutToday = series.filter((p) => p.date !== point.date);
  return [...withoutToday, point].slice(-max);
}

export function recordProgramSnapshot(
  intel: ProgramIntelligence,
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage !== "undefined"
    ? localStorage
    : null
): ProgramTrendPoint | null {
  if (!storage) return null;
  const store = readStore(storage);
  const date = todayKey();
  const point: ProgramTrendPoint = {
    date,
    label: chartLabel(date),
    healthScore: intel.healthScore,
    capacityLoadPct: intel.capacityLoadPct,
    riskTier: intel.riskTier,
  };
  store.programs[intel.projectId] = upsertPoint(store.programs[intel.projectId] ?? [], point);
  writeStore(storage, store);
  return point;
}

export function recordPortfolioSnapshot(
  summary: PortfolioIntelligenceSummary,
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage !== "undefined"
    ? localStorage
    : null
): PortfolioTrendPoint | null {
  if (!storage) return null;
  const store = readStore(storage);
  const date = todayKey();
  const point: PortfolioTrendPoint = {
    date,
    label: chartLabel(date),
    avgHealthScore: summary.avgHealthScore,
    avgCapacityLoadPct: summary.avgCapacityLoadPct,
    atRiskCount: summary.atRiskCount + summary.criticalCount,
  };
  store.portfolio = upsertPoint(store.portfolio, point);
  writeStore(storage, store);
  return point;
}

export function getProgramTrend(
  projectId: string,
  days = 14,
  storage: Pick<Storage, "getItem"> | null = typeof localStorage !== "undefined"
    ? localStorage
    : null
): ProgramTrendPoint[] {
  const store = readStore(storage);
  const cutoff = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
  return (store.programs[projectId] ?? []).filter((p) => p.date >= cutoff);
}

export function getPortfolioTrend(
  days = 14,
  storage: Pick<Storage, "getItem"> | null = typeof localStorage !== "undefined"
    ? localStorage
    : null
): PortfolioTrendPoint[] {
  const store = readStore(storage);
  const cutoff = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
  return store.portfolio.filter((p) => p.date >= cutoff);
}

export function trendDelta(
  points: { healthScore?: number; avgHealthScore?: number }[]
): number | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const start = first.healthScore ?? first.avgHealthScore ?? 0;
  const end = last.healthScore ?? last.avgHealthScore ?? 0;
  return end - start;
}
