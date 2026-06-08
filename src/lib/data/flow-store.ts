/**
 * Mutable in-memory store for demo mode.
 * All reporting reads from this store — no hardcoded metrics.
 */
import { PROJECT_TEMPLATES, type ProjectTemplateId } from "@/lib/templates/project-templates";
import type {
  ActivityEvent,
  ActivityEventType,
  Comment,
  Correction,
  DailyWrapUp,
  FlowFile,
  Manufacturer,
  ManufacturerInput,
  Project,
  ProjectInput,
  QaResult,
  QaReview,
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
  buildWorkflowContext,
  dispatchWorkflow,
} from "@/lib/workflow/workflow-engine";
import {
  MOCK_ACTIVITY,
  MOCK_FILES,
  MOCK_MANUFACTURERS,
  MOCK_PROJECTS,
  MOCK_QA_REVIEWS,
  MOCK_TIME_LOGS,
  MOCK_USERS,
  MOCK_WORK_PACKAGES,
} from "./mock-data";

function workflowCtx() {
  return buildWorkflowContext({
    users: MOCK_USERS,
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
let initialized = false;

function uid(prefix: string) {
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

  timeLogs = [...MOCK_TIME_LOGS];
  qaReviews = [...MOCK_QA_REVIEWS];
  files = [...MOCK_FILES];
  activity = [...MOCK_ACTIVITY];
  corrections = [];

  for (const y of yearWorkItems) syncYearFromPackages(y.id);
  for (const p of workPackages) {
    syncPackageHours(p.id);
    syncPackageFileCount(p.id);
  }
}

export function getFlowStore() {
  initFlowStore();
  return {
    users: MOCK_USERS,
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
export function createProject(input: ProjectInput, templateId?: ProjectTemplateId): Project {
  initFlowStore();
  const project: Project = {
    id: uid("proj"),
    name: input.name,
    description: input.description ?? null,
    project_type: input.project_type,
    team_id: "team-1",
    status: input.status,
    priority: input.priority,
    start_date: input.start_date ?? null,
    due_date: input.due_date ?? null,
    end_date: null,
    project_owner_id: input.project_owner_id ?? null,
    created_by: input.project_owner_id ?? null,
    created_at: ts(),
    updated_at: ts(),
  };
  projects = [project, ...projects];
  logActivity(input.project_owner_id ?? "user-manager", "status_change", `Created project ${project.name}`);

  if (templateId && templateId !== "custom") {
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

export function updateProject(id: string, updates: Partial<Project>) {
  const idx = projects.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  projects[idx] = { ...projects[idx], ...updates, updated_at: ts() };
  logActivity(
    projects[idx].project_owner_id ?? "user-manager",
    "status_change",
    `Updated project ${projects[idx].name}`,
  );
  rebuildAllRollups();
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
    workPackages = workPackages.map((p) =>
      p.year_work_item_id === id
        ? { ...p, assigned_to: updates.assigned_to, updated_at: ts() }
        : p
    );
    rebuildAllRollups();
  } else {
    rebuildAllRollups();
  }
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
  const pkg: WorkPackage = {
    id: uid("wp"),
    ...input,
    notes: input.notes ?? null,
    description: input.description ?? null,
    assigned_to: input.assigned_to ?? null,
    due_date: input.due_date ?? null,
    start_date: input.start_date ?? null,
    completed_date: null,
    actual_hours: 0,
    file_count: 0,
    qa_status: "pending",
    correction_count: 0,
    created_at: ts(),
    updated_at: ts(),
  };
  workPackages = [pkg, ...workPackages];
  syncYearFromPackages(pkg.year_work_item_id);
  logActivity(pkg.assigned_to ?? "user-manager", "status_change", `Created task ${pkg.title}`, pkg.id);
  if (pkg.assigned_to) {
    dispatchWorkflow(
      { type: "assignment", pkgId: pkg.id, prevAssignee: null, actorId: pkg.assigned_to },
      workflowCtx()
    );
  }
  return pkg;
}

export function updateWorkPackage(id: string, updates: Partial<WorkPackage>) {
  const idx = workPackages.findIndex((w) => w.id === id);
  if (idx < 0) return null;
  const prev = workPackages[idx];
  const updated = { ...prev, ...updates, updated_at: ts() };
  if (updates.status === "done" && !updated.completed_date) {
    updated.completed_date = new Date().toISOString().split("T")[0];
  }
  if (updates.status === "ready_for_qa") updated.qa_status = "pending";
  workPackages[idx] = updated;
  syncYearFromPackages(updated.year_work_item_id);

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
  if (pkg) syncYearFromPackages(pkg.year_work_item_id);
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
export function createTimeLog(input: {
  work_package_id: string;
  user_id: string;
  hours: number;
  log_date: string;
  notes?: string;
}) {
  const log: TimeLog = { id: uid("tl"), ...input, notes: input.notes ?? null, created_at: ts() };
  timeLogs = [log, ...timeLogs];
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

export function deleteTimeLog(id: string) {
  const log = timeLogs.find((t) => t.id === id);
  timeLogs = timeLogs.filter((t) => t.id !== id);
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
      completed_date: result === "pass" ? new Date().toISOString().split("T")[0] : null,
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
  return [...MOCK_USERS];
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
  completed_summary?: string | null;
  blockers?: string | null;
  needs_support?: boolean;
  needs_support_note?: string | null;
}): DailyWrapUp {
  initFlowStore();
  const existing = dailyWrapUps.findIndex(
    (w) => w.user_id === input.user_id && w.wrap_date === input.wrap_date
  );
  const entry: DailyWrapUp = {
    id: uid("wrap"),
    user_id: input.user_id,
    wrap_date: input.wrap_date,
    completed_summary: input.completed_summary ?? null,
    blockers: input.blockers ?? null,
    needs_support: input.needs_support ?? false,
    needs_support_note: input.needs_support_note ?? null,
    created_at: ts(),
  };
  if (existing >= 0) {
    dailyWrapUps[existing] = entry;
  } else {
    dailyWrapUps = [entry, ...dailyWrapUps];
  }
  return entry;
}

export function getDailyWrapUp(userId: string, wrapDate: string): DailyWrapUp | null {
  initFlowStore();
  return dailyWrapUps.find((w) => w.user_id === userId && w.wrap_date === wrapDate) ?? null;
}
