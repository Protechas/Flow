import { listValidationRuns } from "@/lib/validation-center/runs";
import { listValidationFindings } from "@/lib/validation-center/findings";
import type { ValidationRunView } from "@/lib/validation-center/types";

/**
 * Library Intelligence — the reporting brain of the Audit App (Library Score,
 * Executive Rollup, What Changed, Smart Insights) computed from Flow's run
 * repository instead of the Streamlit tool's local SQLite database.
 */

const MATCH_MISSING = "Missing From OneDrive Export";
const PCS_STATUSES = new Set([
  "Potential Classification/Naming Mismatch",
  "Split File Naming Difference",
]);

export interface ManufacturerScore {
  manufacturer: string;
  runId: string;
  auditDate: string | null;
  expected: number;
  passing: number;
  review: number;
  compliance: number;
  missing: number;
  pcsReview: number;
  /** Compliance delta vs the previous audit of this manufacturer (null = first audit). */
  delta: number | null;
  history: { runId: string; date: string | null; compliance: number; review: number }[];
}

export interface JourneySnapshot {
  expected: number;
  passing: number;
  review: number;
  missing: number;
  compliance: number;
}

/** Where the library started vs where it is now. */
export interface LibraryJourney {
  baselineDate: string | null;
  currentDate: string | null;
  auditsCompleted: number;
  baseline: JourneySnapshot;
  current: JourneySnapshot;
  movers: {
    manufacturer: string;
    firstCompliance: number;
    latestCompliance: number;
    delta: number;
    audits: number;
  }[];
  /** Every completed audit in order — the trend line. */
  trend: { date: string; compliance: number; manufacturer: string }[];
}

export interface LibraryIntelligence {
  totalManufacturers: number;
  totalExpected: number;
  totalPassing: number;
  totalReview: number;
  overallCompliance: number;
  trueMissing: number;
  pcsReview: number;
  scoreboard: ManufacturerScore[];
  insights: string[];
  /** Manufacturers whose latest audit moved vs the previous one, biggest movers first. */
  changed: { manufacturer: string; delta: number; compliance: number }[];
  journey: LibraryJourney;
}

function summaryNumber(run: ValidationRunView, key: string): number {
  const value = (run.run_summary as unknown as Record<string, unknown> | null)?.[key];
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getLibraryIntelligence(): Promise<LibraryIntelligence> {
  const [runs, findings] = [await listValidationRuns(), await listValidationFindings()];

  const audits = runs
    .filter(
      (r) => r.engine_id === "si_library_audit" && r.status === "completed" && r.manufacturer
    )
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));

  const findingCounts = new Map<string, { missing: number; pcs: number }>();
  for (const f of findings) {
    const entry = findingCounts.get(f.validation_run_id) ?? { missing: 0, pcs: 0 };
    if (f.match_status === MATCH_MISSING) entry.missing += 1;
    else if (f.match_status && PCS_STATUSES.has(f.match_status)) entry.pcs += 1;
    findingCounts.set(f.validation_run_id, entry);
  }

  const byManufacturer = new Map<string, ValidationRunView[]>();
  for (const run of audits) {
    const list = byManufacturer.get(run.manufacturer!) ?? [];
    list.push(run);
    byManufacturer.set(run.manufacturer!, list);
  }

  const scoreboard: ManufacturerScore[] = [];
  for (const [manufacturer, history] of byManufacturer) {
    const latest = history[0];
    const previous = history[1];
    const counts = findingCounts.get(latest.id) ?? { missing: 0, pcs: 0 };
    const compliance = latest.compliance_rate ?? summaryNumber(latest, "compliance_rate");
    const prevCompliance = previous
      ? (previous.compliance_rate ?? summaryNumber(previous, "compliance_rate"))
      : null;
    scoreboard.push({
      manufacturer,
      runId: latest.id,
      auditDate: latest.completed_at ?? null,
      expected: summaryNumber(latest, "expected_deliverables"),
      passing: summaryNumber(latest, "passing_compliance"),
      review: summaryNumber(latest, "needs_review"),
      compliance,
      missing: counts.missing,
      pcsReview: counts.pcs,
      delta:
        prevCompliance != null ? Math.round((compliance - prevCompliance) * 10) / 10 : null,
      history: history.map((r) => ({
        runId: r.id,
        date: r.completed_at ?? null,
        compliance: r.compliance_rate ?? 0,
        review: summaryNumber(r, "needs_review"),
      })),
    });
  }
  scoreboard.sort((a, b) => a.manufacturer.localeCompare(b.manufacturer));

  const totalExpected = scoreboard.reduce((s, r) => s + r.expected, 0);
  const totalPassing = scoreboard.reduce((s, r) => s + r.passing, 0);
  const totalReview = scoreboard.reduce((s, r) => s + r.review, 0);
  const trueMissing = scoreboard.reduce((s, r) => s + r.missing, 0);
  const pcsReview = scoreboard.reduce((s, r) => s + r.pcsReview, 0);
  const overallCompliance = totalExpected
    ? Math.round((totalPassing / totalExpected) * 1000) / 10
    : 0;

  // Smart insights — ported from smart_insights.insights_from_repository.
  const insights: string[] = [];
  if (scoreboard.length > 0) {
    if (totalReview > 0) {
      const top = [...scoreboard].sort((a, b) => b.review - a.review)[0];
      const share = Math.round((top.review / totalReview) * 1000) / 10;
      insights.push(`${top.manufacturer} contributes ${share}% of library review workload.`);
    }
    const topMissing = [...scoreboard].sort((a, b) => b.missing - a.missing)[0];
    if (topMissing.missing > 0) {
      insights.push(
        `${topMissing.manufacturer} has the highest missing file count (${topMissing.missing}).`
      );
    }
    const avg =
      Math.round(
        (scoreboard.reduce((s, r) => s + r.compliance, 0) / scoreboard.length) * 10
      ) / 10;
    insights.push(`Overall library compliance across latest audits is ${avg}%.`);
    const movers = scoreboard.filter((r) => r.delta != null && Math.abs(r.delta) >= 1);
    for (const mover of [...movers]
      .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))
      .slice(0, 2)) {
      insights.push(
        mover.delta! > 0
          ? `${mover.manufacturer} compliance increased ${mover.delta}% since its previous audit.`
          : `${mover.manufacturer} compliance decreased ${Math.abs(mover.delta!)}% since its previous audit.`
      );
    }
  } else {
    insights.push("Run manufacturer audits to populate library intelligence.");
  }

  const changed = scoreboard
    .filter((r) => r.delta != null && r.delta !== 0)
    .map((r) => ({ manufacturer: r.manufacturer, delta: r.delta!, compliance: r.compliance }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // ——— Journey: each manufacturer's FIRST audit forms the baseline, the
  // latest forms "now". With one audit each, baseline == now — the journey
  // starts here and the gap grows as re-audits land.
  const emptySnapshot = (): JourneySnapshot => ({
    expected: 0,
    passing: 0,
    review: 0,
    missing: 0,
    compliance: 0,
  });
  const baseline = emptySnapshot();
  const current = emptySnapshot();
  const movers: LibraryJourney["movers"] = [];
  for (const [manufacturer, history] of byManufacturer) {
    const latest = history[0];
    const first = history[history.length - 1];
    const firstCounts = findingCounts.get(first.id) ?? { missing: 0, pcs: 0 };
    const latestCounts = findingCounts.get(latest.id) ?? { missing: 0, pcs: 0 };
    baseline.expected += summaryNumber(first, "expected_deliverables");
    baseline.passing += summaryNumber(first, "passing_compliance");
    baseline.review += summaryNumber(first, "needs_review");
    baseline.missing += firstCounts.missing;
    current.expected += summaryNumber(latest, "expected_deliverables");
    current.passing += summaryNumber(latest, "passing_compliance");
    current.review += summaryNumber(latest, "needs_review");
    current.missing += latestCounts.missing;
    if (history.length > 1) {
      const firstCompliance = first.compliance_rate ?? summaryNumber(first, "compliance_rate");
      const latestCompliance =
        latest.compliance_rate ?? summaryNumber(latest, "compliance_rate");
      movers.push({
        manufacturer,
        firstCompliance,
        latestCompliance,
        delta: Math.round((latestCompliance - firstCompliance) * 10) / 10,
        audits: history.length,
      });
    }
  }
  baseline.compliance = baseline.expected
    ? Math.round((baseline.passing / baseline.expected) * 1000) / 10
    : 0;
  current.compliance = current.expected
    ? Math.round((current.passing / current.expected) * 1000) / 10
    : 0;
  movers.sort((a, b) => b.delta - a.delta);

  const chronological = [...audits].sort((a, b) =>
    (a.completed_at ?? "").localeCompare(b.completed_at ?? "")
  );
  const journey: LibraryJourney = {
    baselineDate: chronological[0]?.completed_at ?? null,
    currentDate: chronological[chronological.length - 1]?.completed_at ?? null,
    auditsCompleted: audits.length,
    baseline,
    current,
    movers,
    trend: chronological
      .filter((r) => r.completed_at)
      .map((r) => ({
        date: r.completed_at!,
        compliance: r.compliance_rate ?? summaryNumber(r, "compliance_rate"),
        manufacturer: r.manufacturer ?? "",
      })),
  };

  return {
    totalManufacturers: scoreboard.length,
    totalExpected,
    totalPassing,
    totalReview,
    overallCompliance,
    trueMissing,
    pcsReview,
    scoreboard,
    insights,
    changed,
    journey,
  };
}
