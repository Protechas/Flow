import { writeAuditLog } from "@/lib/audit/audit-log";
import { getFlowStore } from "@/lib/data/flow-store";
import { sweepStaleProductionEntries } from "@/lib/data/production-tracking";
import { resolveLeadersForEmployee } from "@/lib/hierarchy/resolver-core";
import { deliverNotification } from "@/lib/notifications/notifications";

/**
 * Close forgotten clock entries and runaway timers, then tell the people who
 * need to know. Runs lazily from the server write path — the first action
 * anyone takes in the morning sweeps yesterday's forgotten punches, the same
 * pattern the workload-alert sync uses. Idempotent: a swept entry is
 * completed, so it never matches again, and notifications dedupe within 24h.
 */
export function runStaleTimeSweep(): void {
  const { closedClockEntries, stoppedTimers } = sweepStaleProductionEntries();
  if (!closedClockEntries.length && !stoppedTimers.length) return;

  const users = getFlowStore().users;

  for (const entry of closedClockEntries) {
    const employee = users.find((u) => u.id === entry.user_id);
    const name = employee?.full_name ?? "An employee";

    deliverNotification({
      user_id: entry.user_id,
      type: "time_auto_clock_out",
      title: "You were clocked out automatically",
      message:
        "Your shift passed 12 hours without a punch, so Flow closed it at the 12-hour mark. If your real hours differ, tell your lead so the entry can be corrected.",
      related_entity_type: "time_clock_entry",
      related_entity_id: entry.id,
      link: "/work",
    });

    if (employee) {
      for (const leader of resolveLeadersForEmployee(employee, users, {
        includeSeniorManager: true,
        includeAdminFallback: true,
      })) {
        deliverNotification({
          user_id: leader.id,
          type: "time_auto_clock_out",
          title: `${name} was auto clocked out`,
          message: `Shift passed 12h without a punch — closed at the 12-hour cap. Verify the hours in Time Clock and edit the entry if needed.`,
          related_entity_type: "time_clock_entry",
          related_entity_id: entry.id,
          link: "/time-clock",
        });
      }
    }

    void writeAuditLog({
      action: "status_changed",
      entityType: "time_clock_entry",
      entityId: entry.id,
      summary: `Auto clock-out: ${name} — shift passed 12h without a punch, closed at cap`,
      metadata: { user_id: entry.user_id, clock_in_at: entry.clock_in_at },
    });
  }

  for (const timer of stoppedTimers) {
    deliverNotification({
      user_id: timer.user_id,
      type: "time_auto_clock_out",
      title: "A task timer was stopped automatically",
      message:
        "A timer ran past 12 hours without activity, so Flow stopped it and capped the recorded time. Restart the timer when you pick the task back up.",
      related_entity_type: "task",
      related_entity_id: timer.task_id,
      link: "/work",
    });
  }
}
