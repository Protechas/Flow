import { describe, expect, it } from "vitest";
import { summarizeAuditHistory, type ContentAuditRun } from "./audit-runs";

function run(overrides: Partial<ContentAuditRun>): ContentAuditRun {
  return {
    id: crypto.randomUUID(),
    run_by: "u1",
    run_at: "2026-07-15T12:00:00.000Z",
    docs_checked: 10,
    passed: 8,
    flagged: 2,
    unreadable: 0,
    fail_counts: {},
    models: [],
    is_spot_check: false,
    has_details: false,
    ...overrides,
  };
}

describe("summarizeAuditHistory", () => {
  it("keeps the LATEST audit of each model for open gaps", () => {
    // newest-first input, like listAuditRuns returns
    const summary = summarizeAuditHistory([
      run({
        run_at: "2026-07-16T12:00:00.000Z",
        models: [{ label: "2022 Chevrolet Silverado 1500", missing: [], docs: 8, flagged: 0 }],
      }),
      run({
        run_at: "2026-07-15T12:00:00.000Z",
        models: [
          { label: "2022 Chevrolet Silverado 1500", missing: ["NV"], docs: 6, flagged: 1 },
          { label: "2025 Lexus RC300", missing: ["SVC", "RRS"], docs: 4, flagged: 0 },
        ],
      }),
    ]);
    // Silverado's gap was closed by the newer run; Lexus still open.
    expect(summary.openGaps).toHaveLength(1);
    expect(summary.openGaps[0].label).toBe("2025 Lexus RC300");
    expect(summary.openGaps[0].missing).toEqual(["SVC", "RRS"]);
  });

  it("aggregates violation counts and orders the trend oldest-first", () => {
    const summary = summarizeAuditHistory([
      run({ run_at: "2026-07-16T12:00:00.000Z", fail_counts: { oversize: 1 } }),
      run({
        run_at: "2026-07-15T12:00:00.000Z",
        fail_counts: { naming_grammar: 3, oversize: 2 },
        docs_checked: 4,
        flagged: 2,
        is_spot_check: true,
      }),
    ]);
    expect(summary.topViolations[0]).toEqual({ code: "oversize", count: 3 });
    expect(summary.runs[0].run_at).toBe("2026-07-15T12:00:00.000Z");
    expect(summary.runs[0].isSpotCheck).toBe(true);
    expect(summary.runs[0].flagRatePct).toBe(50);
    expect(summary.totalDocsChecked).toBe(14);
  });
});
