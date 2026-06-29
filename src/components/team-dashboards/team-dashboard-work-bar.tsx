"use client";

import Link from "next/link";
import { FilterToolbar } from "@/components/platform";
import { Button } from "@/components/ui/button";
import { CreateBoardWizard } from "@/components/work-creation/create-board-wizard";
import { CreateTaskComposer } from "@/components/work-creation/create-task-composer";
import { ManagerWorkSetup } from "@/components/work-creation/manager-work-setup";
import { ProjectSetupWizard } from "@/components/projects/project-setup-wizard";
import type { OperatingContext } from "@/lib/operating-models/types";
import type { CreationScopeOverride } from "@/lib/work-creation/client-defaults";
import {
  getAllowedCreationModes,
  usesManagerWorkHub,
} from "@/lib/work-creation/permissions";
import type {
  Department,
  ForecastSettings,
  Manufacturer,
  Project,
  Team,
  User,
  YearWorkItem,
} from "@/types/flow";
import { Kanban } from "lucide-react";

export function TeamDashboardWorkBar({
  user,
  departments,
  teams,
  projects,
  manufacturers,
  yearItems,
  analysts,
  forecastSettings,
  managers,
  creationScope,
  operatingContext,
  defaultProjectId,
}: {
  user: User;
  departments: Department[];
  teams: Team[];
  projects: Project[];
  manufacturers: Manufacturer[];
  yearItems: YearWorkItem[];
  analysts: User[];
  forecastSettings: ForecastSettings;
  managers: User[];
  creationScope?: CreationScopeOverride;
  operatingContext?: OperatingContext;
  defaultProjectId?: string;
}) {
  const allowedModes = getAllowedCreationModes(user.role);
  const managerWorkHub = usesManagerWorkHub(user.role);

  if (allowedModes.length === 0) return null;

  return (
    <FilterToolbar>
      {allowedModes.includes("project") && (
        <ProjectSetupWizard
          user={user}
          departments={departments}
          teams={teams}
          managers={managers}
        />
      )}
      {managerWorkHub && (
        <ManagerWorkSetup
          user={user}
          departments={departments}
          teams={teams}
          projects={projects}
          manufacturers={manufacturers}
          yearItems={yearItems}
          analysts={analysts}
          forecastSettings={forecastSettings}
          defaultProjectId={defaultProjectId}
          creationScope={creationScope}
          operatingContext={operatingContext}
        />
      )}
      {!managerWorkHub && allowedModes.includes("task") && (
        <CreateTaskComposer
          user={user}
          projects={projects}
          manufacturers={manufacturers}
          yearItems={yearItems}
          analysts={analysts}
          forecastSettings={forecastSettings}
          defaultProjectId={defaultProjectId}
          operatingContext={operatingContext}
        />
      )}
      {!managerWorkHub && allowedModes.includes("board") && (
        <CreateBoardWizard
          user={user}
          departments={departments}
          teams={teams}
          analysts={analysts}
          creationScope={creationScope}
        />
      )}
      <Button
        variant="outline"
        size="sm"
        render={<Link href="/operations" />}
      >
        <Kanban className="h-3.5 w-3.5" />
        Operations
      </Button>
    </FilterToolbar>
  );
}
