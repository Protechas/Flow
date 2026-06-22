"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Project, User, WorkPackage } from "@/types/flow";

export interface OperationsPlanningContextValue {
  viewer: User;
  workPackages: WorkPackage[];
  projects: Project[];
  teams: { id: string; department_id: string }[];
  departments: { id: string; name: string }[];
}

const OperationsPlanningContext = createContext<OperationsPlanningContextValue | null>(null);

export function OperationsPlanningProvider({
  value,
  children,
}: {
  value: OperationsPlanningContextValue;
  children: ReactNode;
}) {
  return (
    <OperationsPlanningContext.Provider value={value}>{children}</OperationsPlanningContext.Provider>
  );
}

export function useOperationsPlanning(): OperationsPlanningContextValue | null {
  return useContext(OperationsPlanningContext);
}
