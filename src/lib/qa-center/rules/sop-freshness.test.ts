import { describe, expect, it } from "vitest";
import { evaluateSopFreshness } from "@/lib/qa-center/rules/sop-freshness";

describe("evaluateSopFreshness", () => {
  it("is not stale when there are no SOPs", () => {
    const r = evaluateSopFreshness({
      latestSopUpdatedAt: null,
      latestRuleUpdatedAt: "2026-07-01T00:00:00Z",
    });
    expect(r.stale).toBe(false);
    expect(r.message).toBeNull();
  });

  it("flags stale when the SOP is newer than the rules", () => {
    const r = evaluateSopFreshness({
      latestSopUpdatedAt: "2026-07-20T00:00:00Z",
      latestRuleUpdatedAt: "2026-07-10T00:00:00Z",
      latestSopTitle: "SI Content SOP",
    });
    expect(r.stale).toBe(true);
    expect(r.message).toContain("SI Content SOP");
  });

  it("is not stale when the rules are newer than the SOP", () => {
    const r = evaluateSopFreshness({
      latestSopUpdatedAt: "2026-07-10T00:00:00Z",
      latestRuleUpdatedAt: "2026-07-20T00:00:00Z",
    });
    expect(r.stale).toBe(false);
  });

  it("flags stale when SOPs exist but rules have never been reviewed", () => {
    const r = evaluateSopFreshness({
      latestSopUpdatedAt: "2026-07-10T00:00:00Z",
      latestRuleUpdatedAt: null,
    });
    expect(r.stale).toBe(true);
  });

  it("falls back to a generic title when none is given", () => {
    const r = evaluateSopFreshness({
      latestSopUpdatedAt: "2026-07-20T00:00:00Z",
      latestRuleUpdatedAt: "2026-07-10T00:00:00Z",
    });
    expect(r.message).toContain("An SI SOP");
  });
});
