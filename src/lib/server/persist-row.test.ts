import { describe, expect, it, vi } from "vitest";
import { assertPersistRow, normalizePersistRowUuids } from "./persist-row";

vi.mock("@/lib/supabase/client", () => ({ isSupabaseConfigured: () => true }));

describe("persist-row", () => {
  it("rejects clock rows with demo string ids before Supabase upsert", () => {
    expect(() =>
      assertPersistRow(
        "time_clock_entries",
        {
          id: "clk-1782838525506-abc12",
          user_id: "75cbdc3d-0d5c-4fec-8cba-472e6ef6bff4",
        },
        ["id", "user_id"]
      )
    ).toThrow(/PERSIST_ID_INVALID.*time_clock_entries\.id/);
  });

  it("accepts valid UUID clock rows", () => {
    expect(() =>
      assertPersistRow(
        "time_clock_entries",
        {
          id: "75cbdc3d-0d5c-4fec-8cba-472e6ef6bff4",
          user_id: "0f64009f-ae84-4ea1-bd76-d73266757daa",
          department_id: "15c1b514-678a-40cf-9aef-cd95f5649316",
        },
        ["id", "user_id"],
        ["department_id"]
      )
    ).not.toThrow();
  });

  it("strips mock department ids from optional FK columns", () => {
    const row = normalizePersistRowUuids(
      {
        id: "75cbdc3d-0d5c-4fec-8cba-472e6ef6bff4",
        department_id: "dept-service-info",
      },
      ["department_id"]
    );
    expect(row.department_id).toBeNull();
  });
});
