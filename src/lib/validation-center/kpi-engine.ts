import { initFlowStore, getFlowStore } from "@/lib/data/flow-store";
import { isOpenFinding, isCriticalFinding } from "@/lib/validation-center/finding-mapper";
import type {
  ValidationCenterKpis,
  ValidationFinding,
  ValidationManufacturerStat,
  ValidationRootCause,
  ValidationRootCauseStat,
  ValidationRunView,
  ValidationTrendPoint,
  ProjectValidationMetrics,
} from "@/lib/validation-center/types";

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function openFindingStatuses(f: ValidationFinding): boolean {
  return isOpenFinding(f);
}

export function buildRootCauseBreakdown(
  findings: ValidationFinding[]
): ValidationRootCauseStat[] {
  const counts = new Map<ValidationRootCause, number>();
  for (const f of findings) {
    counts.set(f.root_cause, (counts.get(f.root_cause) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([root_cause, count]) => ({ root_cause, count }))
    .sort((a, b) => b.count - a.count);
}

export function buildManufacturerAccuracy(
  runs: ValidationRunView[],
  findings: ValidationFinding[]
): ValidationManufacturerStat[] {
  const byMfg = new Map<
    string,
    { compliance: number[]; openFindings: number }
  >();

  for (const run of runs.filter((r) => r.status === "completed" && r.manufacturer)) {
    const mfg = run.manufacturer!.trim();
    const entry = byMfg.get(mfg) ?? { compliance: [], openFindings: 0 };
    if (run.compliance_rate != null) entry.compliance.push(run.compliance_rate);
    byMfg.set(mfg, entry);
  }

  for (const f of findings) {
    if (!f.manufacturer?.trim() || !openFindingStatuses(f)) continue;
    const mfg = f.manufacturer.trim();
    const entry = byMfg.get(mfg) ?? { compliance: [], openFindings: 0 };
    entry.openFindings += 1;
    byMfg.set(mfg, entry);
  }

  return [...byMfg.entries()]
    .map(([manufacturer, data]) => ({
      manufacturer,
      avgCompliance: avg(data.compliance) ?? 0,
      runCount: data.compliance.length,
      openFindings: data.openFindings,
    }))
    .sort((a, b) => b.openFindings - a.openFindings || a.manufacturer.localeCompare(b.manufacturer));
}

export function buildComplianceTrend(runs: ValidationRunView[]): ValidationTrendPoint[] {
  return runs
    .filter((r) => r.status === "completed" && r.compliance_rate != null)
    .sort((a, b) => a.completed_at!.localeCompare(b.completed_at!))
    .map((r) => ({
      date: (r.completed_at ?? r.created_at).slice(0, 10),
      complianceRate: r.compliance_rate!,
      manufacturer: r.manufacturer,
      runId: r.id,
    }));
}

export function computeRevalidationImprovement(runs: ValidationRunView[]): number | null {
  const linked = runs.filter(
    (r) => r.status === "completed" && r.prior_run_id && r.compliance_rate != null
  );
  if (linked.length === 0) return null;

  const deltas: number[] = [];
  for (const followUp of linked) {
    const baseline = runs.find((r) => r.id === followUp.prior_run_id);
    if (baseline?.compliance_rate != null && followUp.compliance_rate != null) {
      deltas.push(followUp.compliance_rate - baseline.compliance_rate);
    }
  }
  return avg(deltas);
}

export function computeValidationCenterKpis(
  runs: ValidationRunView[],
  findings: ValidationFinding[]
): ValidationCenterKpis {
  const completed = runs.filter((r) => r.status === "completed");
  const complianceRates = completed
    .map((r) => r.compliance_rate)
    .filter((v): v is number => v != null);

  const openFindings = findings.filter(openFindingStatuses);
  const criticalOpen = openFindings.filter(isCriticalFinding);
  const resolvedFindings = findings.filter((f) => f.status === "resolved");
  const linked = findings.filter((f) => f.work_item_id);
  const correctionsInProgress = linked.filter(
    (f) => f.status !== "resolved" && f.status !== "dismissed"
  );
  const qaPending = linked.filter((f) => f.qa_status === "pending");

  const passRates = completed
    .map((r) => {
      const expected = r.run_summary.expected_deliverables;
      const passing = r.run_summary.passing_compliance;
      if (expected != null && passing != null && expected > 0) {
        return Math.round((passing / expected) * 1000) / 10;
      }
      return r.compliance_rate;
    })
    .filter((v): v is number => v != null);

  const withPrior = findings.filter((f) => f.prior_finding_id);
  const repeatFindingsRate =
    findings.length > 0 ? Math.round((withPrior.length / findings.length) * 1000) / 10 : null;

  return {
    libraryAccuracyPct: avg(complianceRates),
    auditPassRate: avg(passRates),
    openFindings: openFindings.length,
    criticalFindingsOpen: criticalOpen.length,
    correctionsInProgress: correctionsInProgress.length,
    qaPending: qaPending.length,
    resolvedFindings: resolvedFindings.length,
    repeatFindingsRate,
    revalidationImprovementPct: computeRevalidationImprovement(runs),
    completedRuns: completed.length,
    trendPoints: buildComplianceTrend(completed),
    rootCauseBreakdown: buildRootCauseBreakdown(findings),
    manufacturerAccuracy: buildManufacturerAccuracy(completed, findings),
  };
}

export function getProjectValidationMetrics(
  projectId: string,
  runs: ValidationRunView[],
  findings: ValidationFinding[]
): ProjectValidationMetrics {
  initFlowStore();
  const pkgIds = new Set(
    getFlowStore()
      .workPackages.filter((p) => p.project_id === projectId)
      .map((p) => p.id)
  );

  const projectRuns = runs.filter((r) => r.project_id === projectId);
  const linkedFindings = findings.filter(
    (f) => (f.work_item_id && pkgIds.has(f.work_item_id)) || false
  );

  const runIdsFromFindings = new Set(linkedFindings.map((f) => f.validation_run_id));
  const relatedRuns = runs.filter(
    (r) => r.project_id === projectId || runIdsFromFindings.has(r.id)
  );

  const completedRelated = relatedRuns.filter((r) => r.status === "completed");
  const rates = completedRelated
    .map((r) => r.compliance_rate)
    .filter((v): v is number => v != null);

  const openFindings = linkedFindings.filter(openFindingStatuses);
  const correctionsInProgress = linkedFindings.filter(
    (f) => f.work_item_id && f.status !== "resolved" && f.status !== "dismissed"
  );
  const qaPending = linkedFindings.filter((f) => f.qa_status === "pending");
  const resolvedFindings = linkedFindings.filter((f) => f.status === "resolved");

  const dates = relatedRuns
    .map((r) => r.completed_at ?? r.created_at)
    .sort((a, b) => b.localeCompare(a));

  return {
    projectId,
    linkedRuns: relatedRuns.length,
    lastRunDate: dates[0] ?? null,
    avgCompliance: avg(rates),
    openFindings: openFindings.length,
    correctionsInProgress: correctionsInProgress.length,
    qaPending: qaPending.length,
    resolvedFindings: resolvedFindings.length,
  };
}
