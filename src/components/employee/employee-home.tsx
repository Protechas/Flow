"use client";

import { EmployeeWorkspaceView } from "@/components/employee/employee-workspace-view";
import type { EmployeeDashboard } from "@/lib/employee/dashboard";
import type { HelpFlagView, PayType, TimeClockEntry, WrapUpComplianceStatus } from "@/types/flow";

/** Focused employee home — delegates to the workspace command center. */
export function EmployeeHome(props: {
  dashboard: EmployeeDashboard;
  userName: string;
  payType: PayType;
  activeClock: TimeClockEntry | null;
  todayClockEntries: TimeClockEntry[];
  taskMinutesToday: number;
  wrapUpStatus: WrapUpComplianceStatus;
  helpFlags?: HelpFlagView[];
}) {
  return <EmployeeWorkspaceView {...props} />;
}
