import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import {
  getActiveClockEntry,
  getActiveTaskTimeEntry,
} from "@/lib/data/production-tracking";
import { deliverNotification } from "@/lib/notifications/notifications";
import { resolveLeadersForEmployee } from "@/lib/hierarchy/resolver";
import { requiresShiftClock } from "@/lib/users/pay-type";
import type { User } from "@/types/flow";

/** Alert managers when an active task timer exists without a shift clock-in. */
export function syncWorkEligibilityMismatchAlert(user: User) {
  if (!requiresShiftClock(user) || !user.is_active) return;

  const timer = getActiveTaskTimeEntry(user.id);
  const clock = getActiveClockEntry(user.id);
  if (!timer || clock) return;

  initFlowStore();
  const users = getFlowStore().users;
  const leaders = resolveLeadersForEmployee(user, users, {
    includeSeniorManager: true,
    includeAdminFallback: true,
  });

  for (const leader of leaders) {
    deliverNotification(
      {
        user_id: leader.id,
        type: "work_eligibility_alert",
        title: "Task timer without clock-in",
        message: `${user.full_name} has an active task timer but is not clocked in.`,
        related_entity_type: "user",
        related_entity_id: user.id,
        link: "/people",
      },
      6
    );
  }
}
