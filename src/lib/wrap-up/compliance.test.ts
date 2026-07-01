import { describe, expect, it, beforeEach } from "vitest";
import { initFlowStore, replaceWrapUpStore } from "@/lib/data/flow-store";
import { initProductionTracking } from "@/lib/data/production-tracking";
import {
  canClockOutForDay,
  getWrapUpComplianceStatus,
} from "@/lib/wrap-up/compliance";

describe("wrap-up compliance", () => {
  beforeEach(() => {
    initFlowStore();
    initProductionTracking();
    replaceWrapUpStore({ dailyWrapUps: [], dailyWrapUpOverrides: [] });
  });

  it("returns missing when no wrap-up exists", () => {
    expect(getWrapUpComplianceStatus("user-michael", "2026-06-23")).toBe("missing");
    expect(canClockOutForDay("user-michael", "2026-06-23")).toBe(false);
  });

  it("returns submitted when wrap-up exists", () => {
    replaceWrapUpStore({
      dailyWrapUps: [
        {
          id: "wrap-1",
          user_id: "user-michael",
          department_id: "dept-service-info",
          wrap_date: "2026-06-23",
          completed_summary: "Done",
          blockers: null,
          needs_support: false,
          needs_support_note: null,
          clocked_minutes: 480,
          recorded_task_minutes: 420,
          unassigned_minutes: 60,
          task_tracking_compliance_pct: 88,
          activity_documentation_category: null,
          activity_documentation_note: null,
          created_at: new Date().toISOString(),
          reviewed_at: null,
          reviewed_by: null,
          internal_notes: null,
          follow_up_needed: false,
          follow_up_notes: null,
        },
      ],
      dailyWrapUpOverrides: [],
    });
    expect(getWrapUpComplianceStatus("user-michael", "2026-06-23")).toBe("submitted");
    expect(canClockOutForDay("user-michael", "2026-06-23")).toBe(true);
  });

  it("returns overridden when manager override exists", () => {
    replaceWrapUpStore({
      dailyWrapUps: [],
      dailyWrapUpOverrides: [
        {
          id: "ov-1",
          user_id: "user-michael",
          wrap_date: "2026-06-23",
          reason: "Left early",
          overridden_by: "user-manager",
          overridden_at: new Date().toISOString(),
        },
      ],
    });
    expect(getWrapUpComplianceStatus("user-michael", "2026-06-23")).toBe("overridden");
    expect(canClockOutForDay("user-michael", "2026-06-23")).toBe(true);
  });
});
