import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  getPortfolioTrend,
  getProgramTrend,
  INTELLIGENCE_SNAPSHOTS_KEY,
  recordPortfolioSnapshot,
  recordProgramSnapshot,
  trendDelta,
} from "@/lib/projects/intelligence-snapshots";
import type { PortfolioIntelligenceSummary, ProgramIntelligence } from "@/lib/projects/project-intelligence";

function mockStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    clear: () => map.clear(),
  };
}

function programIntel(overrides: Partial<ProgramIntelligence> = {}): ProgramIntelligence {
  return {
    projectId: "p1",
    healthScore: 72,
    riskTier: "watch",
    capacityLoadPct: 55,
    capacityStatus: "balanced",
    forecastConfidence: 80,
    signals: [],
    primaryInsight: "On track",
    nextAction: { label: "Review tasks", tone: "default" },
    healthBreakdown: [],
    ...overrides,
  };
}

function portfolioSummary(
  overrides: Partial<PortfolioIntelligenceSummary> = {}
): PortfolioIntelligenceSummary {
  return {
    avgHealthScore: 78,
    healthyCount: 3,
    watchCount: 1,
    atRiskCount: 1,
    criticalCount: 0,
    avgCapacityLoadPct: 62,
    attentionPrograms: [],
    departmentBreakdown: [],
    ...overrides,
  };
}

describe("intelligence-snapshots", () => {
  let storage: ReturnType<typeof mockStorage>;

  beforeEach(() => {
    storage = mockStorage();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T10:00:00"));
  });

  it("records one program snapshot per day", () => {
    recordProgramSnapshot(programIntel({ healthScore: 70 }), storage);
    recordProgramSnapshot(programIntel({ healthScore: 75 }), storage);

    const trend = getProgramTrend("p1", 14, storage);
    expect(trend).toHaveLength(1);
    expect(trend[0].healthScore).toBe(75);
  });

  it("records portfolio snapshots separately from programs", () => {
    recordPortfolioSnapshot(portfolioSummary({ avgHealthScore: 81 }), storage);
    recordProgramSnapshot(programIntel(), storage);

    expect(getPortfolioTrend(14, storage)).toHaveLength(1);
    expect(getProgramTrend("p1", 14, storage)).toHaveLength(1);
    expect(storage.getItem(INTELLIGENCE_SNAPSHOTS_KEY)).toContain('"portfolio"');
  });

  it("computes trend delta across points", () => {
    recordProgramSnapshot(programIntel({ healthScore: 60 }), storage);
    vi.setSystemTime(new Date("2026-06-24T10:00:00"));
    recordProgramSnapshot(programIntel({ healthScore: 72 }), storage);

    const trend = getProgramTrend("p1", 14, storage);
    expect(trendDelta(trend.map((p) => ({ healthScore: p.healthScore })))).toBe(12);
  });
});
