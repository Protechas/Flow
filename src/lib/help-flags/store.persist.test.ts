import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/data/help-flags-db", () => ({ persistHelpFlags: vi.fn() }));

describe("help flags persist contract", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("createHelpFlagRecord uses UUID ids when Supabase persistence is enabled", async () => {
    const { createHelpFlagRecord, replaceHelpFlagStore } = await import(
      "@/lib/help-flags/store"
    );
    const { isPersistedUuid } = await import("@/lib/server/persisted-id");

    replaceHelpFlagStore([]);

    const record = createHelpFlagRecord({
      employee_id: "75cbdc3d-0d5c-4fec-8cba-472e6ef6bff4",
      reason: "stuck_on_task",
      status: "open",
      severity: "warning",
      source: "task",
    });

    expect(isPersistedUuid(record.id)).toBe(true);
  });
});
