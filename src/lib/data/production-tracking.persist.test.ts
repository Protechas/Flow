import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ isSupabaseConfigured: () => true }));

describe("production tracking persist contract", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("clockIn creates UUID ids when Supabase persistence is enabled", async () => {
    vi.doMock("@/lib/data/production-tracking-db", () => ({
      persistTimeClockEntry: vi.fn(),
    }));
    vi.doMock("@/lib/data/production-bridge", () => ({
    replaceQaReviewsStoreExternal: vi.fn(),
    addQaReviewToStoreExternal: vi.fn(),
      getFlowStore: () => ({ users: [], workPackages: [], projects: [] }),
      initFlowStore: vi.fn(),
      logActivityBridge: vi.fn(),
      activateTaskLiveForecastExternal: vi.fn(),
      refreshTaskLiveForecastExternal: vi.fn(),
      updateWorkPackageExternal: vi.fn(),
    }));
    vi.doMock("@/lib/departments/resolve", () => ({
      resolveDepartmentForUser: () => "15c1b514-678a-40cf-9aef-cd95f5649316",
      getDepartmentName: () => "Information Solutions",
    }));

    const { clockIn, replaceProductionTrackingStore } = await import(
      "@/lib/data/production-tracking"
    );
    const { isPersistedUuid } = await import("@/lib/server/persisted-id");

    replaceProductionTrackingStore({
      timeClockEntries: [],
      taskTimeEntries: [],
      taskFileUploads: [],
      taskSubmissions: [],
      qaReviewRecords: [],
    });

    const entry = clockIn("75cbdc3d-0d5c-4fec-8cba-472e6ef6bff4");
    expect(isPersistedUuid(entry.id)).toBe(true);
  });
});
