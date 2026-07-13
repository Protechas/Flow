"use client";

import { EmployeeWorkspaceView } from "@/components/employee/employee-workspace-view";
import type { EmployeeDashboard } from "@/lib/employee/dashboard";
import type {
  HelpFlagView,
  PayType,
  SideSession,
  TimeClockEntry,
  WrapUpComplianceStatus,
} from "@/types/flow";
import type { WorkEligibility } from "@/lib/work-eligibility";

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
  workEligibility: WorkEligibility;
  visibilityToday: {
    clockedMinutes: number;
    recordedTaskMinutes: number;
    unassignedMinutes: number;
    taskTrackingCompliancePct: number | null;
  };
  pendingWorkRequest?: boolean;
  sideSession?: SideSession | null;
  sideSessionMinutes?: number;
}) {
  return (
    <EmployeeWorkspaceView
      {...props}
      taskReadyForSubmission={props.dashboard.taskReadyForSubmission}
    />
  );
}
