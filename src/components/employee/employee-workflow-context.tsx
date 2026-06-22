"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { computeEmployeeWorkflowState, type EmployeeWorkflowSnapshot } from "@/lib/employee/workflow-state";
import type { EmployeeWorkflowInput } from "@/lib/employee/workflow-state";

const EmployeeWorkflowContext = createContext<EmployeeWorkflowSnapshot | null>(null);

export function EmployeeWorkflowProvider({
  input,
  children,
}: {
  input: EmployeeWorkflowInput;
  children: ReactNode;
}) {
  const snapshot = useMemo(
    () => computeEmployeeWorkflowState(input),
    [
      input.useShiftClock,
      input.workEligibility,
      input.activeClock,
      input.todayClockEntries,
      input.timerTask,
      input.stagedTask,
      input.submittedTask,
      input.activeTaskTimer,
      input.nextTask,
      input.wrapUpStatus,
      input.assignedTaskCount,
      input.taskReadyForSubmission,
      input.pendingWorkRequest,
    ]
  );
  return (
    <EmployeeWorkflowContext.Provider value={snapshot}>{children}</EmployeeWorkflowContext.Provider>
  );
}

export function useEmployeeWorkflow(): EmployeeWorkflowSnapshot {
  const ctx = useContext(EmployeeWorkflowContext);
  if (!ctx) {
    throw new Error("useEmployeeWorkflow must be used within EmployeeWorkflowProvider");
  }
  return ctx;
}

export function useEmployeeWorkflowOptional(): EmployeeWorkflowSnapshot | null {
  return useContext(EmployeeWorkflowContext);
}
