import {
  initFlowStore,
  listDepartmentUsers,
  listTeamsStore,
} from "@/lib/data/flow-store";
import type { User } from "@/types/flow";
import { getAccountSetupSummary, type AccountSetupSummary } from "./account";

export function loadAccountSetupSummary(user: User): AccountSetupSummary {
  initFlowStore();
  return getAccountSetupSummary(
    user,
    listDepartmentUsers(),
    listTeamsStore()
  );
}

export function employeeNeedsSetup(user: User): boolean {
  const summary = loadAccountSetupSummary(user);
  return summary.setupStatus === "needs_setup";
}
