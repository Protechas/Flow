import { listWorkloadAlertRecords } from "@/lib/workload-alerts/store";
import type { WorkloadAlertType } from "@/types/flow";

export function employeeHasOpenWorkloadRequest(
  employeeId: string,
  types: WorkloadAlertType[] = ["no_assigned_work"]
): boolean {
  return listWorkloadAlertRecords().some(
    (a) =>
      a.employee_id === employeeId &&
      types.includes(a.alert_type) &&
      a.status === "open"
  );
}
