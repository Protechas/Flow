import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/datetime/timezone", () => ({
  appTodayDate: () => "2026-06-30",
  formatAppCalendarDate: (iso: string) => iso.slice(0, 10),
}));

import {
  filterClockEntriesByDateRange,
  normalizeClockRecordDateRange,
  parseClockRecordDateRange,
} from "@/lib/time-clock/record-filters";
import type { TimeClockEntry } from "@/types/flow";

const entries: TimeClockEntry[] = [
  {
    id: "e1",
    user_id: "u1",
    department_id: null,
    clock_in_at: "2026-06-30T08:00:00.000Z",
    clock_out_at: null,
    total_minutes: null,
    clock_out_type: null,
    status: "active",
    edited_by: null,
    edit_reason: null,
    created_at: "",
    updated_at: "",
  },
  {
    id: "e2",
    user_id: "u1",
    department_id: null,
    clock_in_at: "2026-06-15T08:00:00.000Z",
    clock_out_at: "2026-06-15T17:00:00.000Z",
    total_minutes: 540,
    clock_out_type: "out",
    status: "completed",
    edited_by: null,
    edit_reason: null,
    created_at: "",
    updated_at: "",
  },
];

describe("clock record date filters", () => {
  it("parses from/to search params", () => {
    expect(parseClockRecordDateRange({ from: "2026-06-01", to: "2026-06-30" })).toEqual({
      from: "2026-06-01",
      to: "2026-06-30",
    });
  });

  it("filters entries by inclusive date range", () => {
    const filtered = filterClockEntriesByDateRange(entries, {
      from: "2026-06-30",
      to: "2026-06-30",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("e1");
  });

  it("swaps inverted ranges", () => {
    expect(normalizeClockRecordDateRange({ from: "2026-06-30", to: "2026-06-01" })).toEqual({
      from: "2026-06-01",
      to: "2026-06-30",
    });
  });
});
