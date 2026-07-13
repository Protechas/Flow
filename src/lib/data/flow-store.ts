/**
 * Mutable in-memory store for demo mode.
 * All reporting reads from this store — no hardcoded metrics.
 */
import { appTodayDate } from "@/lib/datetime/timezone";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { PROJECT_TEMPLATES, type ProjectTemplateId } from "@/lib/templates/project-templates";
import { seedMetricsForProject } from "@/lib/metrics/template-metric-defaults";
import type {
  ActivityEvent,
  ActivityEventType,
  Comment,
  Correction,
  DailyWrapUp,
  DailyWrapUpOverride,
  Department,
  DepartmentUser,
  FlowFile,
  ForecastSettings,
  Manufacturer,
  ManufacturerInput,
  Project,
  ProjectInput,
  QaResult,
  QaReview,
  Team,
  TimeLog,
  User,
  WorkPackage,
  WorkPackageInput,
  WorkPriority,
  WorkStatus,
  YearWorkItem,
  YearWorkItemInput,
} from "@/types/flow";
import {
  aggregateProjectForecast,
  calculateProjectPlanningForecast,
} from "@/lib/forecast/engine";
import { applyTaskLiveForecast } from "@/lib/forecast/live";
import { computeAssigneeQueueForecasts } from "@/lib/forecast/assignee-queue";
import { calibrateSettings } from "@/lib/forecast/calibration";
import { resolveProjectStructureDefaults } from "@/lib/departments/structure-defaults";
import { normalizeForecastSettings } from "@/lib/forecast/capacity";
import {
  defaultForecastSettings,
  readGlobalForecastSettings,
  writeGlobalForecastSettings,
} from "@/lib/forecast/settings-persistence";
import {
  buildWorkflowContext,
  dispatchWorkflow,
} from "@/lib/workflow/workflow-engine";
import {
  MOCK_ACTIVITY,
  MOCK_DAILY_WRAP_UPS,
  MOCK_DEPARTMENTS,
  MOCK_DEPARTMENT_USERS,
  MOCK_FILES,
  MOCK_MANUFACTURERS,
  MOCK_PROJECTS,
  MOCK_QA_REVIEWS,
  MOCK_TEAMS,
  MOCK_TIME_LOGS,
  MOCK_USERS,
  MOCK_WORK_PACKAGES,
  DEFAULT_DEPARTMENT_ID,
} from "./mock-data";
import { assignmentUpdates, defaultPackageTitle } from "@/lib/data/work-assign";
import {
  readPersistedWorkPackages,
  readPersistedYearWorkItems,
  writePersistedWorkPackages,
  writePersistedYearWorkItems,
} from "@/lib/data/work-store-persistence";
import { initHierarchyFromStore } from "@/lib/auth/team-scope";
import { resolveDepartmentForProject, resolveDepartmentForUser } from "@/lib/departments/resolve";
import { MOCK_ORG_POSITIONS, syncMockUsersToPositions } from "@/lib/data/mock-positions";
import { seedDemoOrgPositions } from "@/lib/data/org-positions";

function persistTaskStore() {
  if (isSupabaseConfigured()) return;
  writePersistedWorkPackages(workPackages);
  writePersistedYearWorkItems(yearWorkItems);
}

function workflowCtx() {
  return buildWorkflowContext({
    users: activeUsers(),
    projects,
    workPackages,
  });
}

let projects: Project[] = [];
let manufacturers: Manufacturer[] = [];
let yearWorkItems: YearWorkItem[] = [];
let workPackages: WorkPackage[] = [];
let timeLogs: TimeLog[] = [];
let qaReviews: QaReview[] = [];
let corrections: Correction[] = [];
let comments: Comment[] = [];
let files: FlowFile[] = [];
let activity: ActivityEvent[] = [];
let dailyWrapUps: DailyWrapUp[] = [];
let dailyWrapUpOverrides: DailyWrapUpOverride[] = [];
let wrapUpBlockAttempts: { user_id: string; wrap_date: string; blocked_at: string }[] = [];
let departments: Department[] = [];
let teams: Team[] = [];
let departmentUsers: DepartmentUser[] = [];
let forecastSettings: ForecastSettings = readGlobalForecastSettings() ?? defaultForecastSettings();
let storeUsers: User[] = [];
let initialized = false;

export function setStoreUsers(users: User[]): void {
  storeUsers = users;
}

function activeUsers(): User[] {
  return isSupabaseConfigured() ? storeUsers : MOCK_USERS;
}

function initEmptyProductionStore(): void {
  projects = [];
  manufacturers = [];
  yearWorkItems = [];
  workPackages = [];
  timeLogs = [];
  qaReviews = [];
  files = [];
  activity = [];
  corrections = [];
  comments = [];
  departments = [];
  teams = [];
  departmentUsers = [];
  dailyWrapUps = [];
  dailyWrapUpOverrides = [];
  wrapUpBlockAttempts = [];
  storeUsers = [];
  forecastSettings = defaultForecastSettings();
}

function uid(prefix: string) {
  if (isSupabaseConfigured()) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function ts() {
  return new Date().toISOString();
}

function logActivity(
  userId: string,
  type: ActivityEventType,
  summary: string,
  workPackageId?: string
) {
  activity = [
    { id: uid("act"), user_id: userId, work_package_id: workPackageId, type, summary, created_at: ts() },
    ...activity,
  ];
}

/** Exported for production-tracking module */
export function logActivityBridge(
  userId: string,
  type: ActivityEventType,
  summary: string,
  workPackageId?: string
) {
  initFlowStore();
  logActivity(userId, type, summary, workPackageId);
}

function syncPackageHours(packageId: string) {
  const hours = timeLogs
    .filter((t) => t.work_package_id === packageId)
    .reduce((s, t) => s + Number(t.hours), 0);
  const idx = workPackages.findIndex((p) => p.id === packageId);
  if (idx >= 0) workPackages[idx] = { ...workPackages[idx], actual_hours: hours, updated_at: ts() };
}

function syncPackageFileCount(packageId: string) {
  const count = files.filter((f) => f.work_package_id === packageId).length;
  const idx = workPackages.findIndex((p) => p.id === packageId);
  if (idx >= 0) workPackages[idx] = { ...workPackages[idx], file_count: count, updated_at: ts() };
}

export function rebuildAllRollups() {
  for (const y of yearWorkItems) syncYearFromPackages(y.id);
  for (const p of workPackages) {
    syncPackageHours(p.id);
    syncPackageFileCount(p.id);
  }
}

function syncYearFromPackages(yearId: string) {
  const yIdx = yearWorkItems.findIndex((y) => y.id === yearId);
  if (yIdx < 0) return;
  const pkgs = workPackages.filter((p) => p.year_work_item_id === yearId);
  const yHours = pkgs.reduce((s, p) => s + Number(p.actual_hours), 0);
  const yFiles = pkgs.reduce((s, p) => s + p.file_count, 0);
  const yEst = pkgs.reduce((s, p) => s + Number(p.estimated_hours), 0) || yearWorkItems[yIdx].estimated_hours;
  yearWorkItems[yIdx] = {
    ...yearWorkItems[yIdx],
    actual_hours: yHours,
    file_count: yFiles,
    estimated_hours: yEst,
    updated_at: ts(),
  };
}

export function initFlowStore() {
  if (initialized) return;
  initialized = true;

  if (isSupabaseConfigured()) {
    initEmptyProductionStore();
    return;
  }

  projects = MOCK_PROJECTS.map((p) => ({
    ...p,
    project_type: p.id.includes("adas") ? "adas" : p.id.includes("si") ? "si_corrections" : "special_functions",
    priority: "medium" as WorkPriority,
    due_date: p.end_date ?? null,
    project_owner_id: p.created_by ?? "user-manager",
  }));

  manufacturers = MOCK_MANUFACTURERS.map((m) => ({
    ...m,
    assigned_to: null,
    status: "not_started" as WorkStatus,
    priority: "medium" as WorkPriority,
    due_date: null,
    is_archived: false as boolean,
  }));

  const yearMap = new Map<string, YearWorkItem>();
  for (const pkg of MOCK_WORK_PACKAGES) {
    const key = `${pkg.manufacturer_id}-${pkg.year}`;
    if (!yearMap.has(key)) {
      yearMap.set(key, {
        id: `yr-${pkg.manufacturer_id}-${pkg.year}`,
        project_id: pkg.project_id,
        manufacturer_id: pkg.manufacturer_id,
        year: pkg.year,
        assigned_to: pkg.assigned_to ?? null,
        status: pkg.status,
        priority: pkg.priority,
        due_date: pkg.due_date ?? null,
        estimated_hours: pkg.estimated_hours,
        actual_hours: 0,
        file_count: 0,
        notes: null,
        created_at: ts(),
        updated_at: ts(),
      });
    }
  }
  yearWorkItems = [...yearMap.values()];

  workPackages = MOCK_WORK_PACKAGES.map((pkg) => ({
    ...pkg,
    year_work_item_id: `yr-${pkg.manufacturer_id}-${pkg.year}`,
  }));

  const savedPackages = readPersistedWorkPackages();
  const savedYears = readPersistedYearWorkItems();
  if (savedPackages?.length) workPackages = savedPackages;
  if (savedYears?.length) yearWorkItems = savedYears;

  timeLogs = [...MOCK_TIME_LOGS];
  qaReviews = [...MOCK_QA_REVIEWS];
  files = [...MOCK_FILES];
  activity = [...MOCK_ACTIVITY];
  corrections = [];
  departments = [...MOCK_DEPARTMENTS];
  teams = [...MOCK_TEAMS];
  departmentUsers = [...MOCK_DEPARTMENT_USERS];
  dailyWrapUps = [...MOCK_DAILY_WRAP_UPS];

  for (const y of yearWorkItems) syncYearFromPackages(y.id);
  for (const p of workPackages) {
    syncPackageHours(p.id);
    syncPackageFileCount(p.id);
  }
  const persisted = readGlobalForecastSettings();
  if (!persisted) {
    forecastSettings = defaultForecastSettings();
    writeGlobalForecastSettings(forecastSettings);
  } else {
    forecastSettings = persisted;
  }
  recalculateAllForecasts();
  persistTaskStore();
  initHierarchyFromStore(MOCK_USERS);
  seedDemoOrgPositions(MOCK_ORG_POSITIONS);
  syncMockUsersToPositions(MOCK_USERS);
}

export function applyForecastSettingsSnapshot(snapshot: ForecastSettings): ForecastSettings {
  initFlowStore();
  forecastSettings = normalizeForecastSettings({ ...forecastSettings, ...snapshot });
  writeGlobalForecastSettings(forecastSettings);
  recalculateAllForecasts();
  return forecastSettings;
}

export function getForecastSettings(): ForecastSettings {
  initFlowStore();
  return forecastSettings;
}

export function updateForecastSettings(
  updates: Partial<
    Pick<
      ForecastSettings,
      "minutes_per_document" | "productive_day_percent" | "productive_hours_per_day" | "working_days"
    >
  >,
  userId: string
): ForecastSettings {
  initFlowStore();
  forecastSettings = normalizeForecastSettings({
    ...forecastSettings,
    ...updates,
    updated_at: ts(),
    updated_by: userId,
  });
  writeGlobalForecastSettings(forecastSettings);
  recalculateAllForecasts();
  return forecastSettings;
}

function buildForecastFields(
  pkg: WorkPackage,
  taskActiveMinutes?: number,
  now?: Date
): Partial<WorkPackage> {
  return applyTaskLiveForecast(pkg, {
    // Learned minutes-per-document from this assignee's (or the team's)
    // actual submission history; explicit task estimates still win.
    settings: calibrateSettings(forecastSettings, pkg.assigned_to),
    taskActiveMinutes,
    now: now ?? new Date(),
  });
}

export function refreshTaskLiveForecast(
  taskId: string,
  taskActiveMinutes?: number
): WorkPackage | null {
  initFlowStore();
  const idx = workPackages.findIndex((p) => p.id === taskId);
  if (idx < 0) return null;
  const assignee = workPackages[idx].assigned_to;
  if (assignee) {
    recalculateAssigneeForecast(assignee, {
      activeTaskId: taskId,
      taskMinutesById: { [taskId]: taskActiveMinutes ?? 0 },
    });
    return workPackages.find((p) => p.id === taskId) ?? null;
  }
  const updated = {
    ...workPackages[idx],
    ...buildForecastFields(workPackages[idx], taskActiveMinutes),
    updated_at: ts(),
  };
  workPackages[idx] = updated;
  recalculateProjectForecast(updated.project_id);
  return updated;
}

export function activateTaskLiveForecast(
  taskId: string,
  startedAtIso: string
): WorkPackage | null {
  initFlowStore();
  const idx = workPackages.findIndex((p) => p.id === taskId);
  if (idx < 0) return null;
  const pkg = workPackages[idx];
  const startDate = startedAtIso.split("T")[0];
  const base: WorkPackage = {
    ...pkg,
    status: "working_on_it",
    started_at: pkg.started_at ?? startedAtIso,
    forecast_start_date: pkg.forecast_start_date ?? startDate,
    forecast_mode: "active",
    current_documents_completed: pkg.current_documents_completed ?? pkg.file_count ?? 0,
  };
  if (!base.assigned_at && base.assigned_to) {
    base.assigned_at = base.created_at;
  }
  const updated = {
    ...base,
    updated_at: ts(),
  };
  workPackages[idx] = updated;
  if (base.assigned_to) {
    recalculateAssigneeForecast(base.assigned_to, {
      activeTaskId: taskId,
      taskMinutesById: { [taskId]: 0 },
    });
    syncYearFromPackages(updated.year_work_item_id);
    return workPackages.find((p) => p.id === taskId) ?? null;
  }
  workPackages[idx] = {
    ...updated,
    ...buildForecastFields(base, 0),
  };
  syncYearFromPackages(updated.year_work_item_id);
  recalculateProjectForecast(updated.project_id);
  return workPackages[idx];
}

export function recalculateProjectForecast(projectId: string) {
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx < 0) return;
  const pkgs = workPackages.filter((p) => p.project_id === projectId);
  const project = projects[idx];
  const rollup = aggregateProjectForecast(
    pkgs,
    project.manual_project_due_date,
    project.due_date
  );

  if (rollup.estimated_total_documents != null) {
    projects[idx] = {
      ...project,
      estimated_total_documents: rollup.estimated_total_documents,
      estimated_total_hours: rollup.estimated_total_hours,
      estimated_total_work_days: rollup.estimated_total_work_days,
      suggested_project_due_date: rollup.suggested_project_due_date,
      planning_project_due_date: rollup.planning_project_due_date,
      active_project_due_date: rollup.active_project_due_date,
      project_due_date_status: rollup.project_due_date_status,
      forecast_confidence: rollup.forecast_confidence,
      updated_at: ts(),
    };
    return;
  }

  if (project.estimated_total_documents && project.estimated_total_documents > 0) {
    const refreshed = calculateProjectPlanningForecast(
      {
        estimated_total_documents: project.estimated_total_documents,
        complexity_level: project.planning_complexity_level,
        start_date: project.start_date,
        manual_project_due_date: project.manual_project_due_date,
        due_date: project.due_date,
      },
      { settings: forecastSettings }
    );
    projects[idx] = {
      ...project,
      estimated_total_hours: refreshed.estimated_total_hours,
      estimated_total_work_days: refreshed.estimated_total_work_days,
      suggested_project_due_date: refreshed.suggested_project_due_date,
      planning_project_due_date: refreshed.planning_project_due_date,
      active_project_due_date: refreshed.active_project_due_date,
      project_due_date_status: refreshed.project_due_date_status,
      forecast_confidence: refreshed.forecast_confidence,
      due_date: refreshed.due_date ?? project.due_date,
      updated_at: ts(),
    };
    return;
  }

  projects[idx] = {
    ...project,
    estimated_total_documents: rollup.estimated_total_documents,
    estimated_total_hours: rollup.estimated_total_hours,
    estimated_total_work_days: rollup.estimated_total_work_days,
    suggested_project_due_date: rollup.suggested_project_due_date,
    planning_project_due_date: rollup.planning_project_due_date,
    active_project_due_date: rollup.active_project_due_date,
    project_due_date_status: rollup.project_due_date_status,
    forecast_confidence: rollup.forecast_confidence,
    updated_at: ts(),
  };
}

function resolveActiveTaskIdForForecast(userId: string): string | null {
  try {
    // Lazy import avoids flow-store ↔ production-tracking cycle at module load.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pt = require("./production-tracking") as typeof import("./production-tracking");
    pt.initProductionTracking();
    const active = pt.getActiveTaskTimeEntry(userId);
    if (active?.task_id) return active.task_id;
  } catch {
    /* production tracking unavailable */
  }

  const inProgress = workPackages.filter(
    (p) =>
      p.assigned_to === userId &&
      p.status === "working_on_it" &&
      p.forecast_mode === "active" &&
      !!p.started_at
  );
  if (inProgress.length === 1) return inProgress[0].id;
  return null;
}

function buildTaskMinutesForActive(
  userId: string,
  activeTaskId: string | null
): Record<string, number> | undefined {
  if (!activeTaskId) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pt = require("./production-tracking") as typeof import("./production-tracking");
    pt.initProductionTracking();
    return { [activeTaskId]: pt.getTotalTaskMinutes(activeTaskId) };
  } catch {
    return undefined;
  }
}

export function recalculateAssigneeForecast(
  userId: string,
  options?: {
    activeTaskId?: string | null;
    taskMinutesById?: Record<string, number>;
    now?: Date;
  }
) {
  initFlowStore();
  const activeTaskId =
    options?.activeTaskId !== undefined
      ? options.activeTaskId
      : resolveActiveTaskIdForForecast(userId);
  const taskMinutesById =
    options?.taskMinutesById ?? buildTaskMinutesForActive(userId, activeTaskId);

  const forecasts = computeAssigneeQueueForecasts({
    assigneeId: userId,
    packages: workPackages,
    settings: calibrateSettings(forecastSettings, userId),
    activeTaskId,
    taskMinutesById,
    now: options?.now,
  });

  const projectIds = new Set<string>();
  for (let i = 0; i < workPackages.length; i++) {
    const fields = forecasts.get(workPackages[i].id);
    if (!fields) continue;
    workPackages[i] = { ...workPackages[i], ...fields, updated_at: ts() };
    projectIds.add(workPackages[i].project_id);
  }
  for (const pid of projectIds) {
    recalculateProjectForecast(pid);
  }
}

function recalculateUnassignedForecasts(now?: Date) {
  workPackages = workPackages.map((pkg) =>
    pkg.assigned_to ? pkg : applyForecastToPackage(pkg, undefined, now)
  );
}

/** Recalculate assignee queues, unassigned tasks, and project rollups using live timer data. */
export function refreshAllLiveForecasts(options?: { now?: Date }): void {
  const now = options?.now ?? new Date();
  initFlowStore();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pt = require("./production-tracking") as typeof import("./production-tracking");
    pt.initProductionTracking();
  } catch {
    /* production tracking unavailable */
  }

  const assignees = new Set<string>();
  for (const pkg of workPackages) {
    if (pkg.assigned_to) assignees.add(pkg.assigned_to);
  }
  for (const uid of assignees) {
    recalculateAssigneeForecast(uid, { now });
  }
  recalculateUnassignedForecasts(now);
  for (const p of projects) {
    recalculateProjectForecast(p.id);
  }
  persistTaskStore();
}

function recalculateAllForecasts() {
  refreshAllLiveForecasts();
}

function applyForecastToPackage(
  pkg: WorkPackage,
  taskActiveMinutes?: number,
  now?: Date
): WorkPackage {
  const fields = buildForecastFields(pkg, taskActiveMinutes, now);
  return { ...pkg, ...fields };
}

export function getFlowStore() {
  initFlowStore();
  return {
    users: activeUsers(),
    projects,
    manufacturers,
    yearWorkItems,
    workPackages,
    timeLogs,
    qaReviews,
    corrections,
    comments,
    files,
    activity,
    dailyWrapUps,
    dailyWrapUpOverrides,
    wrapUpBlockAttempts,
    departments,
    teams,
    departmentUsers,
    forecastSettings,
  };
}

export function enrichPackages(items: WorkPackage[]): WorkPackage[] {
  const store = getFlowStore();
  return items.map((item) => ({
    ...item,
    project: store.projects.find((p) => p.id === item.project_id),
    manufacturer: store.manufacturers.find((m) => m.id === item.manufacturer_id),
    assignee: store.users.find((u) => u.id === item.assigned_to),
  }));
}

// ——— Projects ———
function applyProjectPlanning(input: ProjectInput): Partial<Project> {
  const planning = calculateProjectPlanningForecast(
    {
      estimated_total_documents: input.estimated_total_documents,
      complexity_level: input.planning_complexity_level,
      start_date: input.start_date,
      manual_project_due_date: input.manual_project_due_date ?? input.due_date,
      due_date: input.due_date,
    },
    { settings: forecastSettings }
  );
  return {
    estimated_total_documents: planning.estimated_total_documents,
    estimated_total_hours: planning.estimated_total_hours,
    estimated_total_work_days: planning.estimated_total_work_days,
    suggested_project_due_date: planning.suggested_project_due_date,
    planning_project_due_date: planning.planning_project_due_date,
    active_project_due_date: planning.active_project_due_date,
    manual_project_due_date: planning.manual_project_due_date,
    project_due_date_status: planning.project_due_date_status,
    forecast_confidence: planning.forecast_confidence,
    planning_complexity_level: input.estimated_total_documents
      ? (input.planning_complexity_level ?? "standard")
      : null,
    due_date: planning.due_date,
  };
}

export function createProject(input: ProjectInput, templateId?: ProjectTemplateId): Project {
  initFlowStore();
  const structure = resolveProjectStructureDefaults({
    department_id: input.department_id,
    team_id: input.team_id,
    departments,
    teams,
  });
  const planningFields = applyProjectPlanning(input);
  const project: Project = {
    id: uid("proj"),
    name: input.name,
    description: input.description ?? null,
    project_type: input.project_type,
    structure_mode: input.structure_mode ?? null,
    department_id: structure.department_id,
    team_id: structure.team_id,
    is_cross_department: input.is_cross_department ?? false,
    status: input.status,
    priority: input.priority,
    start_date: input.start_date ?? null,
    due_date: planningFields.due_date ?? input.due_date ?? null,
    end_date: null,
    project_owner_id: input.project_owner_id ?? null,
    created_by: input.created_by ?? input.project_owner_id ?? null,
    ...planningFields,
    created_at: ts(),
    updated_at: ts(),
  };
  projects = [project, ...projects];
  logActivity(input.project_owner_id ?? "user-manager", "status_change", `Created project ${project.name}`);
  persistTaskStore();

  if (templateId && templateId !== "custom") {
    seedMetricsForProject(project.id, templateId);
    const tpl = PROJECT_TEMPLATES.find((t) => t.id === templateId);
    if (tpl?.manufacturers && tpl.years) {
      for (const mfrName of tpl.manufacturers) {
        const mfr = createManufacturer({
          project_id: project.id,
          name: mfrName,
          assigned_to: null,
          status: "not_started",
          priority: "medium",
          due_date: null,
          notes: null,
        });
        bulkCreateYears(mfr.id, project.id, tpl.years);
      }
    }
  }
  return project;
}

export function updateProject(id: string, updates: Partial<Project> & Partial<ProjectInput>) {
  const idx = projects.findIndex((p) => p.id === id);
  if (idx < 0) return null;

  const prev = projects[idx];
  const merged = { ...prev, ...updates };
  const planningTouched =
    updates.estimated_total_documents !== undefined ||
    updates.planning_complexity_level !== undefined ||
    updates.start_date !== undefined ||
    updates.manual_project_due_date !== undefined ||
    updates.due_date !== undefined;

  let next: Project = { ...merged, updated_at: ts() };

  if (planningTouched) {
    const planning = applyProjectPlanning({
      name: next.name,
      description: next.description,
      project_type: next.project_type,
      status: next.status,
      priority: next.priority,
      start_date: next.start_date,
      due_date: next.due_date,
      manual_project_due_date: next.manual_project_due_date ?? next.due_date,
      project_owner_id: next.project_owner_id,
      estimated_total_documents: next.estimated_total_documents,
      planning_complexity_level: next.planning_complexity_level,
    });
    next = { ...next, ...planning };
  }

  projects[idx] = next;
  logActivity(
    projects[idx].project_owner_id ?? "user-manager",
    "status_change",
    `Updated project ${projects[idx].name}`,
  );

  if (planningTouched) {
    recalculateProjectForecast(id);
  } else {
    rebuildAllRollups();
  }
  return projects[idx];
}

export function archiveProject(id: string) {
  return updateProject(id, { status: "archived" });
}

export function unarchiveProject(id: string) {
  return updateProject(id, { status: "active" });
}

export function deleteProject(id: string) {
  manufacturers = manufacturers.filter((m) => m.project_id !== id);
  yearWorkItems = yearWorkItems.filter((y) => y.project_id !== id);
  const pkgIds = workPackages.filter((p) => p.project_id === id).map((p) => p.id);
  workPackages = workPackages.filter((p) => p.project_id !== id);
  timeLogs = timeLogs.filter((t) => !pkgIds.includes(t.work_package_id));
  qaReviews = qaReviews.filter((r) => !pkgIds.includes(r.work_package_id));
  corrections = corrections.filter((c) => !pkgIds.includes(c.work_package_id));
  comments = comments.filter((c) => !pkgIds.includes(c.work_package_id));
  files = files.filter((f) => !f.work_package_id || !pkgIds.includes(f.work_package_id));
  projects = projects.filter((p) => p.id !== id);
  rebuildAllRollups();
  return true;
}

// ——— Manufacturers ———
export function createManufacturer(input: ManufacturerInput): Manufacturer {
  initFlowStore();
  const mfr: Manufacturer = {
    id: uid("mfr"),
    project_id: input.project_id,
    name: input.name,
    code: input.name.slice(0, 3).toUpperCase(),
    assigned_to: input.assigned_to ?? null,
    status: input.status,
    priority: input.priority,
    due_date: input.due_date ?? null,
    notes: input.notes ?? null,
    is_archived: false,
    created_at: ts(),
    updated_at: ts(),
  };
  manufacturers = [mfr, ...manufacturers];
  logActivity(input.assigned_to ?? "user-manager", "assignment", `Added manufacturer ${mfr.name}`);
  rebuildAllRollups();
  return mfr;
}

export function updateManufacturer(id: string, updates: Partial<Manufacturer>) {
  const idx = manufacturers.findIndex((m) => m.id === id);
  if (idx < 0) return null;
  manufacturers[idx] = { ...manufacturers[idx], ...updates, updated_at: ts() };
  logActivity(
    manufacturers[idx].assigned_to ?? "user-manager",
    "assignment",
    `Updated manufacturer ${manufacturers[idx].name}`,
  );
  rebuildAllRollups();
  return manufacturers[idx];
}

export function archiveManufacturer(id: string) {
  return updateManufacturer(id, { is_archived: true });
}

export function unarchiveManufacturer(id: string) {
  return updateManufacturer(id, { is_archived: false });
}

export function deleteManufacturer(id: string) {
  yearWorkItems = yearWorkItems.filter((y) => y.manufacturer_id !== id);
  const pkgIds = workPackages.filter((p) => p.manufacturer_id === id).map((p) => p.id);
  workPackages = workPackages.filter((p) => p.manufacturer_id !== id);
  timeLogs = timeLogs.filter((t) => !pkgIds.includes(t.work_package_id));
  qaReviews = qaReviews.filter((r) => !pkgIds.includes(r.work_package_id));
  corrections = corrections.filter((c) => !pkgIds.includes(c.work_package_id));
  comments = comments.filter((c) => !pkgIds.includes(c.work_package_id));
  files = files.filter((f) => !f.work_package_id || !pkgIds.includes(f.work_package_id));
  manufacturers = manufacturers.filter((m) => m.id !== id);
  return true;
}

// ——— Year work items ———
export function createYearWorkItem(input: YearWorkItemInput): YearWorkItem {
  initFlowStore();
  const existing = yearWorkItems.find(
    (y) => y.manufacturer_id === input.manufacturer_id && y.year === input.year
  );
  if (existing) return existing;

  const item: YearWorkItem = {
    id: uid("yr"),
    project_id: input.project_id,
    manufacturer_id: input.manufacturer_id,
    year: input.year,
    assigned_to: input.assigned_to ?? null,
    status: input.status,
    priority: input.priority,
    due_date: input.due_date ?? null,
    estimated_hours: input.estimated_hours ?? 8,
    actual_hours: 0,
    file_count: 0,
    notes: input.notes ?? null,
    created_at: ts(),
    updated_at: ts(),
  };
  yearWorkItems = [item, ...yearWorkItems];
  rebuildAllRollups();
  persistTaskStore();
  return item;
}

export function bulkCreateYears(
  manufacturerId: string,
  projectId: string,
  years: number[],
  defaults?: Partial<YearWorkItemInput>
) {
  return years.map((year) =>
    createYearWorkItem({
      manufacturer_id: manufacturerId,
      project_id: projectId,
      year,
      assigned_to: defaults?.assigned_to ?? null,
      status: defaults?.status ?? "not_started",
      priority: defaults?.priority ?? "medium",
      due_date: defaults?.due_date ?? null,
      estimated_hours: defaults?.estimated_hours ?? 8,
      notes: defaults?.notes ?? null,
    })
  );
}

export function updateYearWorkItem(id: string, updates: Partial<YearWorkItem>) {
  const idx = yearWorkItems.findIndex((y) => y.id === id);
  if (idx < 0) return null;
  yearWorkItems[idx] = { ...yearWorkItems[idx], ...updates, updated_at: ts() };
  if (updates.status) {
    const pkgIds = workPackages.filter((p) => p.year_work_item_id === id).map((p) => p.id);
    for (const pkgId of pkgIds) {
      updateWorkPackage(pkgId, { status: updates.status! });
    }
  } else if (updates.assigned_to !== undefined) {
    const year = yearWorkItems[idx];
    let pkgIds = workPackages
      .filter((p) => p.year_work_item_id === id)
      .map((p) => p.id);

    if (pkgIds.length === 0 && updates.assigned_to) {
      const mfr = manufacturers.find((m) => m.id === year.manufacturer_id);
      const project = projects.find((p) => p.id === year.project_id);
      const created = createWorkPackage({
        project_id: year.project_id,
        manufacturer_id: year.manufacturer_id,
        year_work_item_id: year.id,
        year: year.year,
        title: defaultPackageTitle(year, mfr?.name),
        assigned_to: updates.assigned_to,
        status: "assigned",
        priority: year.priority,
        due_date: year.due_date,
        estimated_hours: year.estimated_hours,
        department_id: project ? resolveDepartmentForProject(project) : DEFAULT_DEPARTMENT_ID,
      });
      pkgIds = [created.id];
    } else {
      for (const pkgId of pkgIds) {
        const pkg = workPackages.find((p) => p.id === pkgId);
        if (!pkg) continue;
        updateWorkPackage(pkgId, assignmentUpdates(updates.assigned_to, pkg.status));
      }
    }
    rebuildAllRollups();
  } else {
    rebuildAllRollups();
  }
  persistTaskStore();
  return yearWorkItems[idx];
}

export function deleteYearWorkItem(id: string) {
  const pkgIds = workPackages.filter((p) => p.year_work_item_id === id).map((p) => p.id);
  workPackages = workPackages.filter((p) => p.year_work_item_id !== id);
  timeLogs = timeLogs.filter((t) => !pkgIds.includes(t.work_package_id));
  qaReviews = qaReviews.filter((r) => !pkgIds.includes(r.work_package_id));
  corrections = corrections.filter((c) => !pkgIds.includes(c.work_package_id));
  comments = comments.filter((c) => !pkgIds.includes(c.work_package_id));
  files = files.filter((f) => !f.work_package_id || !pkgIds.includes(f.work_package_id));
  yearWorkItems = yearWorkItems.filter((y) => y.id !== id);
  return true;
}

// ——— Work packages ———
export function createWorkPackage(input: WorkPackageInput): WorkPackage {
  initFlowStore();
  const project = projects.find((p) => p.id === input.project_id);
  const pkg: WorkPackage = {
    id: uid("wp"),
    ...input,
    department_id: input.department_id ?? (project ? resolveDepartmentForProject(project) : DEFAULT_DEPARTMENT_ID),
    notes: input.notes ?? null,
    description: input.description ?? null,
    assigned_to: input.assigned_to ?? null,
    due_date: input.manual_due_date ?? input.due_date ?? null,
    manual_due_date: input.manual_due_date ?? input.due_date ?? null,
    start_date: input.start_date ?? appTodayDate(),
    estimated_document_count: input.estimated_document_count ?? null,
    complexity_level: input.complexity_level ?? "standard",
    completed_date: null,
    actual_hours: 0,
    file_count: 0,
    qa_status: "pending",
    correction_count: 0,
    qa_required: input.qa_required ?? true,
    files_required: input.files_required ?? false,
    forecast_mode: "planning",
    assigned_at: input.assigned_to ? ts() : null,
    started_at: null,
    planning_due_date: null,
    active_due_date: null,
    forecast_start_date: null,
    completed_at: null,
    current_documents_completed: 0,
    estimated_remaining_documents: input.estimated_document_count ?? null,
    current_production_rate: null,
    forecast_last_updated: null,
    live_forecast_status: null,
    forecast_variance_days: null,
    created_at: ts(),
    updated_at: ts(),
  };
  // Append, don't prepend: store order is build order (matches the DB fetch,
  // which sorts created_at ascending so edits never reshuffle default views).
  workPackages = [...workPackages, pkg];
  let forecasted = pkg;
  if (pkg.assigned_to) {
    recalculateAssigneeForecast(pkg.assigned_to);
    forecasted = workPackages.find((p) => p.id === pkg.id) ?? pkg;
  } else {
    forecasted = applyForecastToPackage(pkg);
    workPackages = workPackages.map((p) => (p.id === pkg.id ? forecasted : p));
  }
  syncYearFromPackages(forecasted.year_work_item_id);
  recalculateProjectForecast(forecasted.project_id);
  logActivity(forecasted.assigned_to ?? "user-manager", "status_change", `Created task ${forecasted.title}`, forecasted.id);
  if (forecasted.assigned_to) {
    dispatchWorkflow(
      { type: "assignment", pkgId: forecasted.id, prevAssignee: null, actorId: forecasted.assigned_to },
      workflowCtx()
    );
  }

  persistTaskStore();
  return forecasted;
}

function mergeAssignmentUpdates(
  prev: WorkPackage,
  updates: Partial<WorkPackage>
): Partial<WorkPackage> {
  if (updates.assigned_to === undefined || updates.status !== undefined) return updates;
  return { ...updates, ...assignmentUpdates(updates.assigned_to, prev.status) };
}

export function updateWorkPackage(id: string, updates: Partial<WorkPackage>) {
  const idx = workPackages.findIndex((w) => w.id === id);
  if (idx < 0) return null;
  const prev = workPackages[idx];
  updates = mergeAssignmentUpdates(prev, updates);
  let updated = { ...prev, ...updates, updated_at: ts() };
  if (updates.due_date !== undefined && updates.manual_due_date === undefined) {
    updated.manual_due_date = updates.due_date;
  }
  if (updates.assigned_to !== undefined && updates.assigned_to !== prev.assigned_to) {
    updated.assigned_at = updates.assigned_to ? ts() : null;
    if (updates.assigned_to && updated.forecast_mode !== "active") {
      updated.forecast_mode = "planning";
    }
  }
  if (updates.file_count !== undefined && updates.file_count !== prev.file_count) {
    updated.current_documents_completed = updates.file_count;
  }
  if (updates.status === "done") {
    if (!updated.completed_date) {
      updated.completed_date = appTodayDate();
    }
    if (!updated.completed_at) {
      updated.completed_at = ts();
    }
  }
  if (updates.status === "ready_for_qa") updated.qa_status = "pending";

  const forecastFields = [
    "estimated_document_count",
    "complexity_level",
    "estimated_minutes_per_document",
    "start_date",
    "manual_due_date",
    "due_date",
    "assigned_to",
    "assigned_at",
    "started_at",
    "forecast_mode",
    "forecast_start_date",
    "current_documents_completed",
    "file_count",
    "status",
  ] as const;
  const needsForecast = forecastFields.some((k) => updates[k] !== undefined);
  workPackages[idx] = updated;
  if (needsForecast) {
    const assignees = new Set<string>();
    if (prev.assigned_to) assignees.add(prev.assigned_to);
    if (updated.assigned_to) assignees.add(updated.assigned_to);
    if (assignees.size > 0) {
      for (const uid of assignees) recalculateAssigneeForecast(uid);
      updated = workPackages[idx];
    } else {
      updated = applyForecastToPackage(updated);
      workPackages[idx] = updated;
    }
  }
  syncYearFromPackages(updated.year_work_item_id);
  if (needsForecast || updates.status !== undefined) {
    recalculateProjectForecast(updated.project_id);
  }

  const actor = updated.assigned_to ?? prev.assigned_to ?? "user-manager";
  if (updates.status && updates.status !== prev.status) {
    if (updates.status === "ready_for_qa") {
      logActivity(actor, "submit_qa", `Submitted to QA — ${updated.title}`, id);
    } else if (updates.status === "done") {
      logActivity(actor, "task_complete", `Completed — ${updated.title}`, id);
    } else if (updates.status === "working_on_it") {
      logActivity(actor, "status_change", `Started work — ${updated.title}`, id);
    } else if (updates.status === "correction_needed") {
      logActivity(actor, "correction_received", `QA returned — ${updated.title}`, id);
    } else {
      logActivity(actor, "status_change", `Status → ${updates.status} — ${updated.title}`, id);
    }
  } else if (updates.assigned_to !== undefined && updates.assigned_to !== prev.assigned_to) {
    logActivity(updates.assigned_to ?? actor, "assignment", `Assigned — ${updated.title}`, id);
  } else {
    logActivity(actor, "status_change", `Updated — ${updated.title}`, id);
  }

  const ctx = workflowCtx();
  if (updates.status && updates.status !== prev.status) {
    dispatchWorkflow(
      { type: "status_change", pkgId: id, prevStatus: prev.status, actorId: actor },
      ctx
    );
  }
  if (updates.assigned_to !== undefined && updates.assigned_to !== prev.assigned_to) {
    dispatchWorkflow(
      { type: "assignment", pkgId: id, prevAssignee: prev.assigned_to, actorId: actor },
      ctx
    );
  }

  persistTaskStore();
  return updated;
}

export function deleteWorkPackage(id: string) {
  const pkg = workPackages.find((p) => p.id === id);
  workPackages = workPackages.filter((w) => w.id !== id);
  timeLogs = timeLogs.filter((t) => t.work_package_id !== id);
  qaReviews = qaReviews.filter((r) => r.work_package_id !== id);
  corrections = corrections.filter((c) => c.work_package_id !== id);
  comments = comments.filter((c) => c.work_package_id !== id);
  files = files.filter((f) => f.work_package_id !== id);
  if (pkg) {
    syncYearFromPackages(pkg.year_work_item_id);
    recalculateProjectForecast(pkg.project_id);
  }
  persistTaskStore();
  return true;
}

export function duplicateWorkPackage(id: string): WorkPackage | null {
  initFlowStore();
  const src = workPackages.find((p) => p.id === id);
  if (!src) return null;
  return createWorkPackage({
    project_id: src.project_id,
    manufacturer_id: src.manufacturer_id,
    year_work_item_id: src.year_work_item_id,
    year: src.year,
    title: `${src.title} (copy)`,
    description: src.description,
    assigned_to: src.assigned_to,
    status: "not_started",
    priority: src.priority,
    due_date: src.due_date,
    estimated_hours: src.estimated_hours,
    notes: src.notes,
  });
}

// ——— Time logs ———
function persistTimeLog(log: TimeLog) {
  void import("@/lib/data/time-logs-db").then((m) => m.persistTimeLogSync(log));
}

export function replaceTimeLogsStore(list: TimeLog[]): void {
  timeLogs = list;
}

export function createTimeLog(input: {
  work_package_id: string;
  user_id: string;
  hours: number;
  log_date: string;
  notes?: string;
}) {
  const log: TimeLog = { id: uid("tl"), ...input, notes: input.notes ?? null, created_at: ts() };
  timeLogs = [log, ...timeLogs];
  persistTimeLog(log);
  syncPackageHours(input.work_package_id);
  const pkg = workPackages.find((p) => p.id === input.work_package_id);
  if (pkg) syncYearFromPackages(pkg.year_work_item_id);
  logActivity(input.user_id, "time_log", `Logged ${input.hours}h`, input.work_package_id);
  if (pkg) {
    dispatchWorkflow(
      { type: "task_pause", pkgId: input.work_package_id, actorId: input.user_id, hours: input.hours },
      workflowCtx()
    );
  }
  return log;
}

/**
 * Record a completed task-timer session as a time log. Id equals the task
 * time entry id, so re-recording the same session upserts instead of
 * duplicating. No activity/workflow dispatch — the timer already logged those.
 */
export function recordTimerTimeLog(input: {
  id: string;
  work_package_id: string;
  user_id: string;
  hours: number;
  log_date: string;
}): TimeLog {
  const log: TimeLog = {
    ...input,
    notes: "Task timer",
    created_at: ts(),
  };
  timeLogs = [log, ...timeLogs.filter((t) => t.id !== log.id)];
  persistTimeLog(log);
  syncPackageHours(input.work_package_id);
  const pkg = workPackages.find((p) => p.id === input.work_package_id);
  if (pkg) syncYearFromPackages(pkg.year_work_item_id);
  return log;
}

export function deleteTimeLog(id: string) {
  const log = timeLogs.find((t) => t.id === id);
  timeLogs = timeLogs.filter((t) => t.id !== id);
  void import("@/lib/data/time-logs-db").then((m) => m.deleteTimeLogSync(id));
  if (log) {
    syncPackageHours(log.work_package_id);
    const pkg = workPackages.find((p) => p.id === log.work_package_id);
    if (pkg) syncYearFromPackages(pkg.year_work_item_id);
  }
  return true;
}

// ——— Comments ———
export function createComment(workPackageId: string, userId: string, body: string) {
  const c: Comment = {
    id: uid("cmt"),
    work_package_id: workPackageId,
    user_id: userId,
    body,
    created_at: ts(),
    updated_at: ts(),
  };
  comments = [c, ...comments];
  logActivity(userId, "comment", body.slice(0, 80), workPackageId);
  const pkg = workPackages.find((p) => p.id === workPackageId);
  if (pkg) {
    dispatchWorkflow(
      { type: "comment", pkgId: workPackageId, authorId: userId, body },
      workflowCtx()
    );
  }
  return c;
}

export function deleteComment(id: string) {
  comments = comments.filter((c) => c.id !== id);
  return true;
}

// ——— Files ———
export function createFile(input: {
  work_package_id: string;
  uploaded_by: string;
  file_name: string;
}) {
  const f: FlowFile = {
    id: uid("file"),
    work_package_id: input.work_package_id,
    project_id: null,
    uploaded_by: input.uploaded_by,
    file_name: input.file_name,
    file_path: `/uploads/${input.work_package_id}/${input.file_name}`,
    file_size: 1024 * 128,
    mime_type: "application/octet-stream",
    created_at: ts(),
  };
  files = [f, ...files];
  syncPackageFileCount(input.work_package_id);
  const pkg = workPackages.find((p) => p.id === input.work_package_id);
  if (pkg) syncYearFromPackages(pkg.year_work_item_id);
  logActivity(input.uploaded_by, "file_upload", `Uploaded ${input.file_name}`, input.work_package_id);
  if (pkg) {
    dispatchWorkflow(
      { type: "file_upload", pkgId: input.work_package_id, uploaderId: input.uploaded_by },
      workflowCtx()
    );
  }
  return f;
}

export function deleteFile(id: string) {
  const f = files.find((x) => x.id === id);
  files = files.filter((x) => x.id !== id);
  if (f?.work_package_id) {
    syncPackageFileCount(f.work_package_id);
    const pkg = workPackages.find((p) => p.id === f.work_package_id);
    if (pkg) syncYearFromPackages(pkg.year_work_item_id);
  }
  return true;
}

// ——— QA & corrections ———
export function submitQaReview(
  workPackageId: string,
  reviewerId: string,
  analystId: string,
  result: QaResult,
  notes?: string,
  errorCategory?: string
) {
  const review: QaReview = {
    id: uid("qa"),
    work_package_id: workPackageId,
    reviewer_id: reviewerId,
    analyst_id: analystId,
    result,
    error_category: errorCategory ?? null,
    notes: notes ?? null,
    reviewed_at: ts(),
    created_at: ts(),
  };
  qaReviews = [review, ...qaReviews];

  const qaStatusMap: Record<QaResult, WorkPackage["qa_status"]> = {
    pass: "passed",
    minor_correction: "minor_correction",
    major_correction: "major_correction",
    rejected: "rejected",
  };

  const item = workPackages.find((w) => w.id === workPackageId);
  if (item) {
    const correctionCount =
      result !== "pass" ? item.correction_count + 1 : item.correction_count;
    updateWorkPackage(workPackageId, {
      status: result === "pass" ? "done" : "correction_needed",
      qa_status: qaStatusMap[result],
      correction_count: correctionCount,
      completed_date: result === "pass" ? appTodayDate() : null,
    });
    if (result !== "pass") {
      const corr = createCorrection({
        work_package_id: workPackageId,
        qa_review_id: review.id,
        assigned_to: analystId,
        description: notes ?? `${result} from QA review`,
      });
      dispatchWorkflow(
        { type: "correction", correctionId: corr.id, pkgId: workPackageId },
        workflowCtx(),
        { corrections }
      );
    }
    dispatchWorkflow(
      { type: "qa_review", pkgId: workPackageId, result, reviewerId },
      workflowCtx()
    );
  }
  logActivity(reviewerId, "qa_review", `QA ${result} on package`, workPackageId);
  return review;
}

export function createCorrection(input: {
  work_package_id: string;
  qa_review_id?: string;
  assigned_to: string;
  description: string;
}) {
  const c: Correction = {
    id: uid("corr"),
    work_package_id: input.work_package_id,
    qa_review_id: input.qa_review_id ?? null,
    assigned_to: input.assigned_to,
    description: input.description,
    resolved: false,
    resolved_at: null,
    created_at: ts(),
  };
  corrections = [c, ...corrections];
  logActivity(
    input.assigned_to,
    "correction_received",
    `Correction assigned — ${input.description.slice(0, 60)}`,
    input.work_package_id
  );
  return c;
}

export function applyStuckStatus(packageIds: string[]) {
  for (const id of packageIds) {
    updateWorkPackage(id, { status: "stuck" });
  }
}

export function updateUser(id: string, updates: Partial<import("@/types/flow").User>) {
  if (isSupabaseConfigured()) return null;
  const idx = MOCK_USERS.findIndex((u) => u.id === id);
  if (idx < 0) return null;
  const cur = MOCK_USERS[idx];
  const first = updates.first_name ?? cur.first_name;
  const last = updates.last_name ?? cur.last_name;
  const full_name =
    updates.full_name ??
    (updates.first_name !== undefined || updates.last_name !== undefined
      ? [first, last].filter(Boolean).join(" ")
      : cur.full_name);
  const updated = { ...cur, ...updates, full_name, updated_at: ts() };
  MOCK_USERS[idx] = updated;
  return updated;
}

export function getAllUsers() {
  initFlowStore();
  return [...activeUsers()];
}

export function resolveCorrection(id: string) {
  const idx = corrections.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  corrections[idx] = {
    ...corrections[idx],
    resolved: true,
    resolved_at: ts(),
  };
  logActivity(
    corrections[idx].assigned_to,
    "correction_resolved",
    "Resolved QA correction",
    corrections[idx].work_package_id
  );
  const pkg = workPackages.find((p) => p.id === corrections[idx].work_package_id);
  if (pkg) {
    dispatchWorkflow(
      {
        type: "correction_resolved",
        correctionId: corrections[idx].id,
        pkgId: corrections[idx].work_package_id,
      },
      workflowCtx(),
      { corrections }
    );
  }
  return corrections[idx];
}

export function deleteCorrection(id: string) {
  corrections = corrections.filter((c) => c.id !== id);
  return true;
}

export function createDailyWrapUp(input: {
  user_id: string;
  wrap_date: string;
  department_id?: string | null;
  completed_summary?: string | null;
  blockers?: string | null;
  needs_support?: boolean;
  needs_support_note?: string | null;
  clocked_minutes?: number | null;
  recorded_task_minutes?: number | null;
  unassigned_minutes?: number | null;
  task_tracking_compliance_pct?: number | null;
  activity_documentation_category?: import("@/types/flow").ActivityDocumentationCategory | null;
  activity_documentation_note?: string | null;
}): DailyWrapUp {
  initFlowStore();
  const existing = dailyWrapUps.findIndex(
    (w) => w.user_id === input.user_id && w.wrap_date === input.wrap_date
  );
  const entry: DailyWrapUp = {
    id: uid("wrap"),
    user_id: input.user_id,
    department_id: input.department_id ?? resolveDepartmentForUser(input.user_id),
    wrap_date: input.wrap_date,
    completed_summary: input.completed_summary ?? null,
    blockers: input.blockers ?? null,
    needs_support: input.needs_support ?? false,
    needs_support_note: input.needs_support_note ?? null,
    clocked_minutes: input.clocked_minutes ?? null,
    recorded_task_minutes: input.recorded_task_minutes ?? null,
    unassigned_minutes: input.unassigned_minutes ?? null,
    task_tracking_compliance_pct: input.task_tracking_compliance_pct ?? null,
    activity_documentation_category: input.activity_documentation_category ?? null,
    activity_documentation_note: input.activity_documentation_note ?? null,
    created_at: ts(),
    reviewed_at: null,
    reviewed_by: null,
    internal_notes: null,
    follow_up_needed: false,
    follow_up_notes: null,
  };
  if (existing >= 0) {
    dailyWrapUps[existing] = entry;
  } else {
    dailyWrapUps = [entry, ...dailyWrapUps];
  }
  void import("@/lib/data/wrap-ups-db").then((m) => m.persistDailyWrapUp(entry));
  return entry;
}

export function getDailyWrapUp(userId: string, wrapDate: string): DailyWrapUp | null {
  initFlowStore();
  return dailyWrapUps.find((w) => w.user_id === userId && w.wrap_date === wrapDate) ?? null;
}

export function getDailyWrapUpById(id: string): DailyWrapUp | null {
  initFlowStore();
  return dailyWrapUps.find((w) => w.id === id) ?? null;
}

export function updateDailyWrapUpReview(
  id: string,
  updates: Partial<
    Pick<
      DailyWrapUp,
      | "reviewed_at"
      | "reviewed_by"
      | "internal_notes"
      | "follow_up_needed"
      | "follow_up_notes"
    >
  >
): DailyWrapUp | null {
  initFlowStore();
  const idx = dailyWrapUps.findIndex((w) => w.id === id);
  if (idx < 0) return null;
  dailyWrapUps[idx] = { ...dailyWrapUps[idx], ...updates };
  const saved = dailyWrapUps[idx];
  void import("@/lib/data/wrap-ups-db").then((m) => m.persistDailyWrapUp(saved));
  return saved;
}

export function getWrapUpOverride(userId: string, wrapDate: string): DailyWrapUpOverride | null {
  initFlowStore();
  return (
    dailyWrapUpOverrides.find((o) => o.user_id === userId && o.wrap_date === wrapDate) ?? null
  );
}

export function createWrapUpOverride(input: {
  user_id: string;
  wrap_date: string;
  reason: string;
  overridden_by: string;
}): DailyWrapUpOverride {
  initFlowStore();
  const existing = dailyWrapUpOverrides.findIndex(
    (o) => o.user_id === input.user_id && o.wrap_date === input.wrap_date
  );
  const entry: DailyWrapUpOverride = {
    id: uid("wrap-override"),
    user_id: input.user_id,
    wrap_date: input.wrap_date,
    reason: input.reason,
    overridden_by: input.overridden_by,
    overridden_at: ts(),
  };
  if (existing >= 0) {
    dailyWrapUpOverrides[existing] = entry;
  } else {
    dailyWrapUpOverrides = [entry, ...dailyWrapUpOverrides];
  }
  void import("@/lib/data/wrap-ups-db").then((m) => m.persistWrapUpOverride(entry));
  return entry;
}

export function recordWrapUpBlockAttempt(userId: string, wrapDate: string): void {
  initFlowStore();
  wrapUpBlockAttempts = [
    { user_id: userId, wrap_date: wrapDate, blocked_at: ts() },
    ...wrapUpBlockAttempts.filter(
      (b) => !(b.user_id === userId && b.wrap_date === wrapDate)
    ),
  ];
}

export function getWrapUpBlockAttempt(
  userId: string,
  wrapDate: string
): { blocked_at: string } | null {
  initFlowStore();
  return (
    wrapUpBlockAttempts.find((b) => b.user_id === userId && b.wrap_date === wrapDate) ?? null
  );
}

export function replaceWrapUpStore(data: {
  dailyWrapUps: DailyWrapUp[];
  dailyWrapUpOverrides: DailyWrapUpOverride[];
}): void {
  dailyWrapUps = data.dailyWrapUps;
  dailyWrapUpOverrides = data.dailyWrapUpOverrides;
}

// ——— Departments ———

export function replaceDepartmentStructureStore(
  depts: Department[],
  teamsList: Team[],
  deptUsers: DepartmentUser[]
): void {
  departments = depts;
  teams = teamsList;
  departmentUsers = deptUsers;
}

export function replaceProjectsStructureStore(
  projectList: Project[],
  manufacturerList: Manufacturer[]
): void {
  projects = projectList;
  manufacturers = manufacturerList;
}

export function replaceWorkStructureStore(
  yearList: YearWorkItem[],
  packageList: WorkPackage[]
): void {
  yearWorkItems = yearList;
  workPackages = packageList;
}

export function listProjectsStore(): Project[] {
  initFlowStore();
  return [...projects];
}

export function listManufacturersStore(): Manufacturer[] {
  initFlowStore();
  return [...manufacturers];
}

export function listDepartments(): Department[] {
  initFlowStore();
  return [...departments];
}

export function listTeamsStore(): Team[] {
  initFlowStore();
  return [...teams];
}

export function listDepartmentUsers(): DepartmentUser[] {
  initFlowStore();
  return [...departmentUsers];
}

export function createTeam(input: {
  name: string;
  description?: string | null;
  department_id?: string | null;
  manager_id?: string | null;
  team_lead_user_id?: string | null;
  is_production?: boolean;
}): Team {
  initFlowStore();
  const team: Team = {
    id: uid("team"),
    name: input.name,
    description: input.description ?? null,
    is_production: input.is_production ?? true,
    department_id: input.department_id ?? null,
    manager_id: input.manager_id ?? null,
    team_lead_user_id: input.team_lead_user_id ?? null,
    created_at: ts(),
    updated_at: ts(),
  };
  teams = [team, ...teams];
  return team;
}

export function updateTeam(
  id: string,
  updates: Partial<
    Pick<Team, "name" | "description" | "department_id" | "manager_id" | "team_lead_user_id" | "is_production">
  >
): Team | null {
  initFlowStore();
  const idx = teams.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  teams[idx] = { ...teams[idx], ...updates, updated_at: ts() };
  return teams[idx];
}

export function createDepartment(input: {
  name: string;
  description?: string | null;
  lead_user_id?: string | null;
}): Department {
  initFlowStore();
  const dept: Department = {
    id: uid("dept"),
    name: input.name,
    description: input.description ?? null,
    lead_user_id: input.lead_user_id ?? null,
    status: "active",
    created_at: ts(),
    updated_at: ts(),
  };
  departments = [dept, ...departments];
  return dept;
}

export function updateDepartment(
  id: string,
  updates: Partial<Pick<Department, "name" | "description" | "lead_user_id" | "status">>
): Department | null {
  initFlowStore();
  const idx = departments.findIndex((d) => d.id === id);
  if (idx < 0) return null;
  departments[idx] = { ...departments[idx], ...updates, updated_at: ts() };
  return departments[idx];
}

export function setUserDepartmentMembership(
  userId: string,
  departmentId: string,
  opts: { is_primary?: boolean; role_in_department?: DepartmentUser["role_in_department"] } = {}
): DepartmentUser {
  initFlowStore();
  if (opts.is_primary) {
    departmentUsers = departmentUsers.map((du) =>
      du.user_id === userId ? { ...du, is_primary: du.department_id === departmentId } : du
    );
  }
  const existing = departmentUsers.findIndex(
    (du) => du.user_id === userId && du.department_id === departmentId
  );
  const entry: DepartmentUser = {
    id: existing >= 0 ? departmentUsers[existing].id : uid("du"),
    department_id: departmentId,
    user_id: userId,
    role_in_department: opts.role_in_department ?? "member",
    is_primary: opts.is_primary ?? (existing >= 0 ? departmentUsers[existing].is_primary : false),
    created_at: existing >= 0 ? departmentUsers[existing].created_at : ts(),
    updated_at: ts(),
  };
  if (existing >= 0) {
    departmentUsers[existing] = entry;
  } else {
    departmentUsers = [entry, ...departmentUsers];
  }
  return entry;
}

export function removeUserDepartmentMembership(userId: string, departmentId: string): boolean {
  initFlowStore();
  const before = departmentUsers.length;
  departmentUsers = departmentUsers.filter(
    (du) => !(du.user_id === userId && du.department_id === departmentId)
  );
  return departmentUsers.length < before;
}

export function deleteTeam(id: string): boolean {
  initFlowStore();
  const idx = teams.findIndex((t) => t.id === id);
  if (idx < 0) return false;
  teams = teams.filter((t) => t.id !== id);
  for (const user of activeUsers()) {
    if (user.team_id === id) {
      updateUser(user.id, { team_id: null });
    }
  }
  return true;
}

export function deleteDepartment(id: string): boolean {
  initFlowStore();
  const idx = departments.findIndex((d) => d.id === id);
  if (idx < 0) return false;

  const teamIds = teams.filter((t) => t.department_id === id).map((t) => t.id);
  teams = teams.filter((t) => t.department_id !== id);
  departmentUsers = departmentUsers.filter((du) => du.department_id !== id);
  departments = departments.filter((d) => d.id !== id);

  for (const user of activeUsers()) {
    if (user.team_id && teamIds.includes(user.team_id)) {
      updateUser(user.id, { team_id: null });
    }
  }
  return true;
}

export function countProjectsForDepartment(departmentId: string): number {
  initFlowStore();
  return projects.filter((p) => p.department_id === departmentId && p.status !== "archived").length;
}
