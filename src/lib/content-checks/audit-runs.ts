import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Content Audit run log — aggregates only, never document contents. The
 * browser does the checking (Tools rule); this is just the scoreboard so
 * library health has a trend instead of vanishing with the tab.
 */

export interface AuditRunModel {
  label: string;
  missing: string[];
  docs: number;
  flagged: number;
}

export interface ContentAuditRun {
  id: string;
  run_by: string | null;
  run_at: string;
  docs_checked: number;
  passed: number;
  flagged: number;
  unreadable: number;
  fail_counts: Record<string, number>;
  models: AuditRunModel[];
  is_spot_check: boolean;
}

let memoryRuns: ContentAuditRun[] = [];

function mapRow(row: Record<string, unknown>): ContentAuditRun {
  return {
    id: String(row.id),
    run_by: row.run_by != null ? String(row.run_by) : null,
    run_at: String(row.run_at),
    docs_checked: Number(row.docs_checked ?? 0),
    passed: Number(row.passed ?? 0),
    flagged: Number(row.flagged ?? 0),
    unreadable: Number(row.unreadable ?? 0),
    fail_counts: (row.fail_counts ?? {}) as Record<string, number>,
    models: (row.models ?? []) as AuditRunModel[],
    is_spot_check: Boolean(row.is_spot_check),
  };
}

export async function insertAuditRun(
  run: Omit<ContentAuditRun, "id" | "run_at">
): Promise<void> {
  if (!isSupabaseConfigured() || !isAdminConfigured()) {
    memoryRuns = [
      { ...run, id: crypto.randomUUID(), run_at: new Date().toISOString() },
      ...memoryRuns,
    ].slice(0, 200);
    return;
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("content_audit_runs").insert({
    run_by: run.run_by,
    docs_checked: run.docs_checked,
    passed: run.passed,
    flagged: run.flagged,
    unreadable: run.unreadable,
    fail_counts: run.fail_counts,
    models: run.models,
    is_spot_check: run.is_spot_check,
  });
  if (error) throw new Error(error.message);
}

export async function listAuditRuns(limit = 100): Promise<ContentAuditRun[]> {
  if (!isSupabaseConfigured() || !isAdminConfigured()) {
    return memoryRuns.slice(0, limit);
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("content_audit_runs")
    .select("*")
    .order("run_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map(mapRow);
}

export interface AuditHistorySummary {
  runs: { run_at: string; docs: number; flagRatePct: number; isSpotCheck: boolean }[];
  topViolations: { code: string; count: number }[];
  /** Latest audit per model that still shows missing components. */
  openGaps: { label: string; missing: string[]; lastAudited: string }[];
  totalDocsChecked: number;
}

/** Roll the raw run log into what the history panel shows. */
export function summarizeAuditHistory(runs: ContentAuditRun[]): AuditHistorySummary {
  const violations = new Map<string, number>();
  const latestByModel = new Map<string, { missing: string[]; run_at: string }>();
  let totalDocs = 0;

  // runs arrive newest-first; keep the first (latest) sighting of each model.
  for (const run of runs) {
    totalDocs += run.docs_checked;
    for (const [code, count] of Object.entries(run.fail_counts)) {
      violations.set(code, (violations.get(code) ?? 0) + count);
    }
    for (const model of run.models) {
      if (!latestByModel.has(model.label.toLowerCase())) {
        latestByModel.set(model.label.toLowerCase(), {
          missing: model.missing,
          run_at: run.run_at,
        });
      }
    }
  }

  const modelLabels = new Map<string, string>();
  for (const run of runs) {
    for (const m of run.models) {
      if (!modelLabels.has(m.label.toLowerCase())) modelLabels.set(m.label.toLowerCase(), m.label);
    }
  }

  return {
    runs: [...runs]
      .reverse()
      .map((r) => ({
        run_at: r.run_at,
        docs: r.docs_checked,
        flagRatePct:
          r.docs_checked > 0 ? Math.round((r.flagged / r.docs_checked) * 100) : 0,
        isSpotCheck: r.is_spot_check,
      })),
    topViolations: [...violations.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    openGaps: [...latestByModel.entries()]
      .filter(([, v]) => v.missing.length > 0)
      .map(([key, v]) => ({
        label: modelLabels.get(key) ?? key,
        missing: v.missing,
        lastAudited: v.run_at,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    totalDocsChecked: totalDocs,
  };
}
