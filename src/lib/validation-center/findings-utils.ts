import { isOpenFinding, isCriticalFinding } from "@/lib/validation-center/finding-mapper";
import type {
  ValidationFinding,
  ValidationFindingFilters,
} from "@/lib/validation-center/types";

function matchesQuery(finding: ValidationFinding, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const parts = [
    finding.title,
    finding.manufacturer ?? "",
    finding.suggested_correction,
    finding.match_status ?? "",
    JSON.stringify(finding.affected_record_ref),
  ];
  return parts.join(" ").toLowerCase().includes(needle);
}

export function filterFindings(
  findings: ValidationFinding[],
  filters: ValidationFindingFilters = {}
): ValidationFinding[] {
  return findings.filter((f) => {
    if (filters.validation_run_id && f.validation_run_id !== filters.validation_run_id) {
      return false;
    }
    if (filters.engine_id && f.engine_id !== filters.engine_id) return false;
    if (filters.severity && filters.severity !== "all" && f.severity !== filters.severity) {
      return false;
    }
    if (filters.status && filters.status !== "all" && f.status !== filters.status) return false;
    if (filters.root_cause && filters.root_cause !== "all" && f.root_cause !== filters.root_cause) {
      return false;
    }
    if (
      filters.manufacturer &&
      (f.manufacturer ?? "").toLowerCase() !== filters.manufacturer.toLowerCase()
    ) {
      return false;
    }
    if (filters.q && !matchesQuery(f, filters.q)) return false;
    return true;
  });
}

export function getValidationFindingStats(findings: ValidationFinding[]) {
  const open = findings.filter(isOpenFinding);
  const criticalOpen = open.filter(isCriticalFinding);
  return {
    total: findings.length,
    open: open.length,
    criticalOpen: criticalOpen.length,
    bySeverity: {
      critical: findings.filter((f) => f.severity === "critical").length,
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
      info: findings.filter((f) => f.severity === "info").length,
    },
    byRootCause: findings.reduce<Record<string, number>>((acc, f) => {
      acc[f.root_cause] = (acc[f.root_cause] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

export function listManufacturersFromFindings(findings: ValidationFinding[]): string[] {
  const set = new Set<string>();
  for (const f of findings) {
    if (f.manufacturer?.trim()) set.add(f.manufacturer.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function isFindingEligibleForTask(finding: ValidationFinding): boolean {
  if (finding.work_item_id) return false;
  return finding.status !== "dismissed" && finding.status !== "resolved";
}
