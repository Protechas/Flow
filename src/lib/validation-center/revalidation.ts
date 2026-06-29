import type {
  ValidationFinding,
  ValidationRunComparison,
  ValidationRunView,
} from "@/lib/validation-center/types";

export function findingMatchKey(finding: ValidationFinding): string {
  const ref = finding.affected_record_ref;
  const refKeys = Object.keys(ref)
    .sort()
    .map((k) => `${k}:${String(ref[k])}`)
    .join("|");
  return [
    finding.manufacturer ?? "",
    finding.title.trim().toLowerCase(),
    finding.match_status ?? "",
    refKeys,
  ].join("::");
}

export function compareValidationRuns(
  baselineId: string,
  followUpId: string,
  runs: ValidationRunView[],
  findings: ValidationFinding[]
): ValidationRunComparison | null {
  const baseline = runs.find((r) => r.id === baselineId);
  const followUp = runs.find((r) => r.id === followUpId);
  if (!baseline || !followUp) return null;

  const baselineFindings = findings.filter((f) => f.validation_run_id === baselineId);
  const followUpFindings = findings.filter((f) => f.validation_run_id === followUpId);

  const baselineByKey = new Map<string, ValidationFinding>();
  for (const f of baselineFindings) {
    baselineByKey.set(findingMatchKey(f), f);
  }

  const followUpByKey = new Map<string, ValidationFinding>();
  for (const f of followUpFindings) {
    followUpByKey.set(findingMatchKey(f), f);
  }

  const resolved: ValidationFinding[] = [];
  const stillOpen: ValidationFinding[] = [];
  const newIssues: ValidationFinding[] = [];

  for (const [key, baseFinding] of baselineByKey) {
    const followFinding = followUpByKey.get(key);
    if (!followFinding) {
      resolved.push(baseFinding);
      continue;
    }
    const baseOpen = !["resolved", "dismissed"].includes(baseFinding.status);
    const followOpen = !["resolved", "dismissed"].includes(followFinding.status);
    if (baseOpen && followOpen) stillOpen.push(followFinding);
    else if (baseOpen && !followOpen) resolved.push(baseFinding);
  }

  for (const [key, followFinding] of followUpByKey) {
    if (!baselineByKey.has(key)) {
      if (!["resolved", "dismissed"].includes(followFinding.status)) {
        newIssues.push(followFinding);
      }
    }
  }

  const complianceDelta =
    baseline.compliance_rate != null && followUp.compliance_rate != null
      ? Math.round((followUp.compliance_rate - baseline.compliance_rate) * 10) / 10
      : null;

  const improvementPct =
    baseline.compliance_rate != null &&
    followUp.compliance_rate != null &&
    baseline.compliance_rate > 0
      ? Math.round(
          ((followUp.compliance_rate - baseline.compliance_rate) / baseline.compliance_rate) *
            1000
        ) / 10
      : complianceDelta;

  return {
    baseline,
    followUp,
    complianceDelta,
    improvementPct,
    baselineFindingsCount: baselineFindings.length,
    followUpFindingsCount: followUpFindings.length,
    resolvedCount: resolved.length,
    stillOpenCount: stillOpen.length,
    newIssuesCount: newIssues.length,
    resolved,
    stillOpen,
    newIssues,
  };
}

export function listComparableRunPairs(runs: ValidationRunView[]): {
  baselineId: string;
  followUpId: string;
  manufacturer: string | null;
  improvementPct: number | null;
}[] {
  const completed = runs.filter((r) => r.status === "completed");
  const pairs: {
    baselineId: string;
    followUpId: string;
    manufacturer: string | null;
    improvementPct: number | null;
  }[] = [];

  for (const followUp of completed) {
    if (!followUp.prior_run_id) continue;
    const baseline = completed.find((r) => r.id === followUp.prior_run_id);
    if (!baseline) continue;
    const improvementPct =
      baseline.compliance_rate != null &&
      followUp.compliance_rate != null &&
      baseline.compliance_rate > 0
        ? Math.round(
            ((followUp.compliance_rate - baseline.compliance_rate) / baseline.compliance_rate) *
              1000
          ) / 10
        : null;
    pairs.push({
      baselineId: baseline.id,
      followUpId: followUp.id,
      manufacturer: followUp.manufacturer ?? baseline.manufacturer,
      improvementPct,
    });
  }

  return pairs.sort((a, b) => b.followUpId.localeCompare(a.followUpId));
}

export function suggestPriorRun(
  run: ValidationRunView,
  runs: ValidationRunView[]
): ValidationRunView | null {
  if (!run.manufacturer) return null;
  const mfg = run.manufacturer.trim().toLowerCase();
  const candidates = runs
    .filter(
      (r) =>
        r.id !== run.id &&
        r.status === "completed" &&
        r.manufacturer?.trim().toLowerCase() === mfg &&
        r.created_at < run.created_at
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return candidates[0] ?? null;
}
