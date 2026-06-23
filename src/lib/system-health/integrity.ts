import { initFlowStore, getFlowStore, listDepartments, listTeamsStore } from "@/lib/data/flow-store";
import { initProductionTracking } from "@/lib/data/production-tracking";
import { primaryDueDate } from "@/lib/forecast/live";
import { listHelpFlagRecords } from "@/lib/help-flags/store";
import { operationsHref, projectsHref } from "@/lib/navigation/deep-links";
import { diagnoseOrgChartIntegrity } from "@/lib/positions/org-tree";
import { listActiveOrgPositions } from "@/lib/positions/store";
import { listWorkloadAlertRecords } from "@/lib/workload-alerts/store";

export type SystemHealthSeverity = "critical" | "warning" | "info";

export interface SystemHealthIssue {
  id: string;
  category:
    | "relationships"
    | "assignments"
    | "forecast"
    | "alerts"
    | "notifications"
    | "records"
    | "org_chart";
  severity: SystemHealthSeverity;
  title: string;
  detail: string;
  count: number;
  href?: string;
  sampleIds?: string[];
}

export interface SystemHealthReport {
  generatedAt: string;
  issueCount: number;
  criticalCount: number;
  warningCount: number;
  issues: SystemHealthIssue[];
}

const ACTIVE_TASK = new Set([
  "not_started",
  "assigned",
  "working_on_it",
  "waiting",
  "ready_for_qa",
  "in_qa",
  "correction_needed",
  "stuck",
]);

function pushIssue(
  issues: SystemHealthIssue[],
  issue: Omit<SystemHealthIssue, "count"> & { count?: number; sampleIds?: string[] }
) {
  if ((issue.count ?? 0) <= 0) return;
  issues.push({ ...issue, count: issue.count ?? issue.sampleIds?.length ?? 1 });
}

export function buildSystemHealthReport(): SystemHealthReport {
  initFlowStore();
  initProductionTracking();
  const store = getFlowStore();
  const users = store.users.filter((u) => u.is_active);
  const userIds = new Set(users.map((u) => u.id));
  const projectIds = new Set(store.projects.map((p) => p.id));
  const packages = store.workPackages;
  const teams = listTeamsStore();
  const departments = listDepartments();
  const deptIds = new Set(departments.map((d) => d.id));
  const teamIds = new Set(teams.map((t) => t.id));

  const issues: SystemHealthIssue[] = [];

  const employeesNoTeam = users.filter(
    (u) => u.role === "employee" && u.is_active && !u.team_id
  );
  pushIssue(issues, {
    id: "users-no-team",
    category: "assignments",
    severity: "warning",
    title: "Active employees without a team",
    detail: "Employees should belong to a team for capacity and assignment routing.",
    count: employeesNoTeam.length,
    href: "/settings/users",
    sampleIds: employeesNoTeam.slice(0, 5).map((u) => u.id),
  });

  const usersNoManager = users.filter(
    (u) =>
      u.is_active &&
      ["employee", "teamlead"].includes(u.role) &&
      !u.manager_id
  );
  pushIssue(issues, {
    id: "users-no-manager",
    category: "relationships",
    severity: "warning",
    title: "Users without a manager",
    detail: "Manager relationships power escalation, alerts, and org visibility.",
    count: usersNoManager.length,
    href: "/org-chart",
    sampleIds: usersNoManager.slice(0, 5).map((u) => u.id),
  });

  const invalidManagers = users.filter(
    (u) => u.manager_id && !userIds.has(u.manager_id)
  );
  pushIssue(issues, {
    id: "users-invalid-manager",
    category: "relationships",
    severity: "critical",
    title: "Users linked to missing managers",
    detail: "Manager IDs reference users that no longer exist.",
    count: invalidManagers.length,
    href: "/settings/users",
    sampleIds: invalidManagers.slice(0, 5).map((u) => u.id),
  });

  const tasksNoProject = packages.filter((p) => !p.project_id || !projectIds.has(p.project_id));
  pushIssue(issues, {
    id: "tasks-no-project",
    category: "relationships",
    severity: "critical",
    title: "Tasks without a valid project",
    detail: "Work packages must belong to an active project hierarchy.",
    count: tasksNoProject.length,
    href: operationsHref(),
    sampleIds: tasksNoProject.slice(0, 5).map((p) => p.id),
  });

  const tasksBadAssignee = packages.filter(
    (p) => p.assigned_to && !userIds.has(p.assigned_to)
  );
  pushIssue(issues, {
    id: "tasks-invalid-assignee",
    category: "assignments",
    severity: "critical",
    title: "Tasks assigned to missing users",
    detail: "Assignee IDs reference inactive or deleted users.",
    count: tasksBadAssignee.length,
    href: operationsHref(),
    sampleIds: tasksBadAssignee.slice(0, 5).map((p) => p.id),
  });

  const activeUnassigned = packages.filter(
    (p) => ACTIVE_TASK.has(p.status) && !p.assigned_to
  );
  pushIssue(issues, {
    id: "active-tasks-unassigned",
    category: "assignments",
    severity: "warning",
    title: "Active tasks without an assignee",
    detail: "Open work should have an owner for tracking and alerts.",
    count: activeUnassigned.length,
    href: operationsHref({ view: "all" }),
    sampleIds: activeUnassigned.slice(0, 5).map((p) => p.id),
  });

  const activeNoDue = packages.filter(
    (p) =>
      ACTIVE_TASK.has(p.status) &&
      p.assigned_to &&
      !primaryDueDate(p) &&
      !p.due_date &&
      !p.manual_due_date
  );
  pushIssue(issues, {
    id: "tasks-missing-due-date",
    category: "forecast",
    severity: "warning",
    title: "Active tasks missing forecast or due date",
    detail: "Forecasting and planning require a due date or document estimate.",
    count: activeNoDue.length,
    href: "/planning#calendar",
    sampleIds: activeNoDue.slice(0, 5).map((p) => p.id),
  });

  const activeNoForecast = packages.filter(
    (p) =>
      ACTIVE_TASK.has(p.status) &&
      p.assigned_to &&
      (p.due_date_status === "no_forecast" || !p.estimated_document_count)
  );
  pushIssue(issues, {
    id: "tasks-weak-forecast",
    category: "forecast",
    severity: "info",
    title: "Active tasks with incomplete forecast inputs",
    detail: "Document count or forecast status is missing — completion dates may be unreliable.",
    count: activeNoForecast.length,
    href: "/settings/forecasting",
    sampleIds: activeNoForecast.slice(0, 5).map((p) => p.id),
  });

  const projectsNoPackages = store.projects.filter(
    (p) =>
      p.status === "active" &&
      !packages.some((pkg) => pkg.project_id === p.id)
  );
  pushIssue(issues, {
    id: "projects-no-tasks",
    category: "records",
    severity: "info",
    title: "Active projects with no work packages",
    detail: "Projects exist but have no linked tasks.",
    count: projectsNoPackages.length,
    href: projectsHref(),
    sampleIds: projectsNoPackages.slice(0, 5).map((p) => p.id),
  });

  const teamsBadDept = teams.filter((t) => t.department_id && !deptIds.has(t.department_id));
  pushIssue(issues, {
    id: "teams-invalid-department",
    category: "relationships",
    severity: "warning",
    title: "Teams linked to missing departments",
    detail: "Department routing and capacity may be incorrect.",
    count: teamsBadDept.length,
    href: "/settings/departments",
    sampleIds: teamsBadDept.slice(0, 5).map((t) => t.id),
  });

  const usersBadTeam = users.filter((u) => u.team_id && !teamIds.has(u.team_id));
  pushIssue(issues, {
    id: "users-invalid-team",
    category: "relationships",
    severity: "warning",
    title: "Users linked to missing teams",
    detail: "Team membership references a team that no longer exists.",
    count: usersBadTeam.length,
    href: "/settings/users",
    sampleIds: usersBadTeam.slice(0, 5).map((u) => u.id),
  });

  const workloadAlerts = listWorkloadAlertRecords();
  const helpFlags = listHelpFlagRecords();

  const workloadOrphans = workloadAlerts.filter(
    (a) => a.employee_id && !userIds.has(a.employee_id)
  );
  pushIssue(issues, {
    id: "alerts-orphan-employee",
    category: "alerts",
    severity: "critical",
    title: "Workload alerts referencing missing employees",
    detail: "Alert records point to users that no longer exist.",
    count: workloadOrphans.length,
    href: "/alert-center#workload-alerts",
    sampleIds: workloadOrphans.slice(0, 5).map((a) => a.id),
  });

  const helpOrphans = helpFlags.filter(
    (f) => f.employee_id && !userIds.has(f.employee_id)
  );
  pushIssue(issues, {
    id: "help-flags-orphan-employee",
    category: "alerts",
    severity: "critical",
    title: "Help flags referencing missing employees",
    detail: "Escalation records point to users that no longer exist.",
    count: helpOrphans.length,
    href: "/alert-center#help-flags",
    sampleIds: helpOrphans.slice(0, 5).map((f) => f.id),
  });

  const openWorkloadNoHref = workloadAlerts.filter(
    (a) =>
      a.status === "open" &&
      a.current_task_id &&
      !packages.some((p) => p.id === a.current_task_id)
  );
  pushIssue(issues, {
    id: "alerts-orphan-task",
    category: "alerts",
    severity: "warning",
    title: "Open workload alerts referencing missing tasks",
    detail: "Alert task links may be broken in the UI.",
    count: openWorkloadNoHref.length,
    href: "/alert-center#workload-alerts",
    sampleIds: openWorkloadNoHref.slice(0, 5).map((a) => a.id),
  });

  const wrapUpsOrphan = store.dailyWrapUps.filter((w) => !userIds.has(w.user_id));
  pushIssue(issues, {
    id: "wrapups-orphan-user",
    category: "records",
    severity: "warning",
    title: "Daily reports linked to missing users",
    detail: "Wrap-up records reference users that no longer exist.",
    count: wrapUpsOrphan.length,
    href: "/wrap-ups",
    sampleIds: wrapUpsOrphan.slice(0, 5).map((w) => w.id),
  });

  const orgPositions = listActiveOrgPositions();
  if (orgPositions.length > 0) {
    const orgIntegrity = diagnoseOrgChartIntegrity(orgPositions, users);

    const orphans = orgIntegrity.issues.filter((i) => i.code === "orphan_position");
    pushIssue(issues, {
      id: "org-orphan-positions",
      category: "org_chart",
      severity: "warning",
      title: "Orphan org positions",
      detail: "Positions reference missing parents or departments.",
      count: orphans.length,
      href: "/org-chart",
      sampleIds: orphans.slice(0, 5).map((i) => i.positionId).filter(Boolean) as string[],
    });

    const dupUsers = orgIntegrity.issues.filter(
      (i) => i.code === "duplicate_seat_user" || i.code === "user_multiple_seats"
    );
    pushIssue(issues, {
      id: "org-duplicate-seat-users",
      category: "org_chart",
      severity: "critical",
      title: "Duplicate seat assignments",
      detail: "One or more users are assigned to multiple org seats.",
      count: dupUsers.length,
      href: "/org-chart",
      sampleIds: dupUsers.slice(0, 5).map((i) => i.userId).filter(Boolean) as string[],
    });

    const missingParents = orgIntegrity.issues.filter((i) => i.code === "missing_parent");
    pushIssue(issues, {
      id: "org-missing-parent",
      category: "org_chart",
      severity: "critical",
      title: "Positions with missing parent",
      detail: "Reporting chain is broken — parent position records are missing.",
      count: missingParents.length,
      href: "/org-chart",
      sampleIds: missingParents.slice(0, 5).map((i) => i.positionId).filter(Boolean) as string[],
    });

    const seatAssigned = new Set(
      orgPositions.filter((p) => p.assigned_user_id).map((p) => p.assigned_user_id as string)
    );
    const usersWithoutSeats = users.filter(
      (u) => u.is_active && !u.assigned_position_id && !seatAssigned.has(u.id)
    );
    pushIssue(issues, {
      id: "org-users-without-seats",
      category: "org_chart",
      severity: "info",
      title: "Active users without org seats",
      detail: "Users exist but are not linked to a position seat.",
      count: usersWithoutSeats.length,
      href: "/org-chart",
      sampleIds: usersWithoutSeats.slice(0, 5).map((u) => u.id),
    });

    const vacantManagers = orgPositions.filter(
      (p) =>
        p.status !== "inactive" &&
        !p.assigned_user_id &&
        (p.position_level === "manager" || p.position_level === "team_lead")
    );
    pushIssue(issues, {
      id: "org-vacant-leadership-seats",
      category: "org_chart",
      severity: "info",
      title: "Vacant manager or team lead seats",
      detail: "Leadership seats exist but have no assigned user.",
      count: vacantManagers.length,
      href: "/org-chart",
      sampleIds: vacantManagers.slice(0, 5).map((p) => p.id),
    });

    const circular = orgIntegrity.issues.filter((i) => i.code === "circular_hierarchy");
    pushIssue(issues, {
      id: "org-circular-hierarchy",
      category: "org_chart",
      severity: "critical",
      title: "Circular org hierarchy",
      detail: "Position reporting chain loops back on itself.",
      count: circular.length,
      href: "/org-chart",
      sampleIds: circular.slice(0, 5).map((i) => i.positionId).filter(Boolean) as string[],
    });
  }

  const severityRank: Record<SystemHealthSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  issues.sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] ||
      b.count - a.count ||
      a.title.localeCompare(b.title)
  );

  return {
    generatedAt: new Date().toISOString(),
    issueCount: issues.length,
    criticalCount: issues.filter((i) => i.severity === "critical").length,
    warningCount: issues.filter((i) => i.severity === "warning").length,
    issues,
  };
}

export function describeHealthIssueSample(
  issueId: string,
  sampleId: string,
  store?: ReturnType<typeof getFlowStore>
): string {
  const s = store ?? getFlowStore();
  if (issueId.startsWith("tasks") || issueId.includes("task")) {
    const pkg = s.workPackages.find((p) => p.id === sampleId);
    return pkg?.title ?? sampleId;
  }
  if (issueId.includes("project")) {
    const proj = s.projects.find((p) => p.id === sampleId);
    return proj?.name ?? sampleId;
  }
  const user = s.users.find((u) => u.id === sampleId);
  return user?.full_name ?? sampleId;
}
