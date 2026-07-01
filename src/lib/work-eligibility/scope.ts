import { teamLeadCanViewPerson } from "@/lib/auth/team-scope";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import type { User } from "@/types/flow";

/** Managers may only grant or inspect eligibility for people in their hierarchy scope. */
export function assertCanManageEmployeeEligibility(manager: User, employeeId: string): void {
  initFlowStore();
  const store = getFlowStore();
  if (!teamLeadCanViewPerson(manager, employeeId, store.users, store.teams)) {
    throw new Error("FORBIDDEN");
  }
}
