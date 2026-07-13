import { describe, expect, it } from "vitest";
import { getTeamAvailability } from "@/lib/time-clock/get-team-availability";
import { clockIn, clockOut } from "@/lib/data/production-tracking";
import type { User } from "@/types/flow";

// Mirrors production reality: leads are role=admin + position=team_lead + salary,
// not the legacy teamlead role — and they signal in/out voluntarily.
const lead: User = {
  id: "test-lead-tara",
  email: "tara.test@protech.test",
  first_name: "Tara",
  last_name: "Test",
  full_name: "Tara Test",
  role: "admin",
  organizational_position: "team_lead",
  system_access_level: "admin",
  pay_type: "salary",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("lead availability (voluntary clock for non-roster salaried leads)", () => {
  it("includes non-roster leads when rosterOnly=false and tracks in/out", () => {
    // Default roster filter would drop her entirely
    expect(getTeamAvailability([lead]).length).toBe(0);

    // No clock signal yet → exempt fallback
    let [status] = getTeamAvailability([lead], { rosterOnly: false });
    expect(status).toBeDefined();
    expect(status.status).toBe("exempt");
    expect(status.statusLabel).toBe("Available");

    // Clocks in → shows as on shift with a since time
    clockIn(lead.id);
    [status] = getTeamAvailability([lead], { rosterOnly: false });
    expect(status.status).toBe("on_shift");
    expect(status.since).toBeTruthy();

    // Clocks out → shows as out, not "Available"
    clockOut(lead.id, "out");
    [status] = getTeamAvailability([lead], { rosterOnly: false });
    expect(status.status).toBe("off_shift");
    expect(status.statusLabel).toBe("Out");
  });
});
