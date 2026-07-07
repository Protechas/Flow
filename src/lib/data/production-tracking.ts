/**
 * Production tracking: shift clock, task timers, submissions, file uploads.
 */
import { computeProductionMetrics, minutesBetween } from "@/lib/production/metrics";
import {
  getFlowStore,
  initFlowStore,
  logActivityBridge,
  activateTaskLiveForecastExternal,
  recordTimerTimeLogExternal,
  refreshTaskLiveForecastExternal,
  updateWorkPackageExternal,
} from "@/lib/data/production-bridge";
import { resolveDepartmentForUser } from "@/lib/departments/resolve";
import { getDepartmentName } from "@/lib/departments/resolve";
import type {
  ProductionReportFilters,
  ProductionReportSummary,
  QaResult,
  QaReviewRecord,
  TaskFileUpload,
  TaskSubmissionRecord,
  TaskSubmissionStatus,
  TaskTimeEntry,
  TaskTimePauseEvent,
  TimeClockEntry,
  TimeClockOutType,
} from "@/types/flow";
import { format, isWithinInterval, parseISO, startOfDay, subDays } from "date-fns";
import { appTodayDate, formatAppCalendarDate, isAppCalendarDay } from "@/lib/datetime/timezone";
import { newPersistedId } from "@/lib/server/persisted-id";

interface ProductionTrackingState {
  timeClockEntries: TimeClockEntry[];
  taskTimeEntries: TaskTimeEntry[];
  taskFileUploads: TaskFileUpload[];
  taskSubmissions: TaskSubmissionRecord[];
  qaReviewRecords: QaReviewRecord[];
  productionInitialized: boolean;
}

// Next.js instantiates this module once per compilation layer (pages vs route
// handlers vs actions). Anchor the store on globalThis so every layer in the
// process shares one state — otherwise demo mode and same-instance reads
// diverge between pages and API routes.
const state: ProductionTrackingState = ((
  globalThis as typeof globalThis & { __flowProductionTracking?: ProductionTrackingState }
).__flowProductionTracking ??= {
  timeClockEntries: [],
  taskTimeEntries: [],
  taskFileUploads: [],
  taskSubmissions: [],
  qaReviewRecords: [],
  productionInitialized: false,
});

export function replaceProductionTrackingStore(data: {
  timeClockEntries: TimeClockEntry[];
  taskTimeEntries: TaskTimeEntry[];
  taskFileUploads: TaskFileUpload[];
  taskSubmissions: TaskSubmissionRecord[];
  qaReviewRecords: QaReviewRecord[];
}) {
  state.timeClockEntries = data.timeClockEntries;
  state.taskTimeEntries = data.taskTimeEntries;
  state.taskFileUploads = data.taskFileUploads;
  state.taskSubmissions = data.taskSubmissions;
  state.qaReviewRecords = data.qaReviewRecords;
  state.productionInitialized = true;
}

function persistClock(entry: TimeClockEntry) {
  void import("@/lib/data/production-tracking-db").then((m) => m.persistTimeClockEntry(entry));
}
function persistTaskTime(entry: TaskTimeEntry) {
  void import("@/lib/data/production-tracking-db").then((m) => m.persistTaskTimeEntry(entry));
}
function persistFile(file: TaskFileUpload) {
  void import("@/lib/data/production-tracking-db").then((m) => m.persistTaskFileUpload(file));
}
function persistSubmission(record: TaskSubmissionRecord) {
  void import("@/lib/data/production-tracking-db").then((m) => m.persistTaskSubmission(record));
}
function persistQaReview(record: QaReviewRecord) {
  void import("@/lib/data/production-tracking-db").then((m) => m.persistQaReviewRecord(record));
}

function uid(prefix: string) {
  return newPersistedId(prefix);
}

function ts() {
  return new Date().toISOString();
}

function todayDate() {
  return appTodayDate();
}

export function initProductionTracking() {
  if (state.productionInitialized) return;
  state.productionInitialized = true;
  initFlowStore();
  // Feed real per-document timings to the forecast calibration engine.
  void import("@/lib/forecast/calibration").then((m) =>
    m.registerSubmissionSampleProvider(() =>
      state.taskSubmissions.map((s) => ({
        user_id: s.user_id,
        average_minutes_per_document: s.average_minutes_per_document,
      }))
    )
  );
}

export function getProductionStore() {
  initProductionTracking();
  return {
    timeClockEntries: state.timeClockEntries,
    taskTimeEntries: state.taskTimeEntries,
    taskFileUploads: state.taskFileUploads,
    taskSubmissions: state.taskSubmissions,
    qaReviewRecords: state.qaReviewRecords,
  };
}

// ——— Time clock ———

export function getActiveClockEntry(userId: string): TimeClockEntry | null {
  initProductionTracking();
  return (
    state.timeClockEntries.find((e) => e.user_id === userId && e.status === "active") ?? null
  );
}

export function clockIn(userId: string): TimeClockEntry {
  initProductionTracking();
  const active = getActiveClockEntry(userId);
  if (active) throw new Error("Already clocked in");

  const entry: TimeClockEntry = {
    id: uid("clk"),
    user_id: userId,
    department_id: resolveDepartmentForUser(userId),
    clock_in_at: ts(),
    clock_out_at: null,
    total_minutes: null,
    clock_out_type: null,
    status: "active",
    edited_by: null,
    edit_reason: null,
    created_at: ts(),
    updated_at: ts(),
  };
  state.timeClockEntries = [entry, ...state.timeClockEntries];
  persistClock(entry);

  const today = todayDate();
  const hadLunchToday = state.timeClockEntries.some(
    (e) =>
      e.user_id === userId &&
      e.id !== entry.id &&
      isAppCalendarDay(e.clock_in_at, today) &&
      e.clock_out_type === "lunch"
  );
  logActivityBridge(
    userId,
    "time_log",
    hadLunchToday ? "Clocked in — returned from lunch" : "Clocked in for shift"
  );
  return entry;
}

export function clockOut(userId: string, outType: TimeClockOutType): TimeClockEntry {
  initProductionTracking();
  finalizeTaskTimersOnShiftEnd(userId, outType);

  const entry = getActiveClockEntry(userId);
  if (!entry) throw new Error("Not clocked in");

  const now = ts();
  const total = minutesBetween(entry.clock_in_at, now);
  const updated: TimeClockEntry = {
    ...entry,
    clock_out_at: now,
    total_minutes: total,
    clock_out_type: outType,
    status: "completed",
    updated_at: now,
  };
  state.timeClockEntries = state.timeClockEntries.map((e) => (e.id === entry.id ? updated : e));
  persistClock(updated);
  const label = outType === "lunch" ? "Clocked out for lunch" : "Clocked out for the day";
  logActivityBridge(userId, "time_log", `${label} — ${total}m`);
  return updated;
}

export function editClockEntry(
  entryId: string,
  editorId: string,
  input: {
    clock_in_at?: string;
    clock_out_at?: string | null;
    clock_out_type?: TimeClockOutType | null;
    edit_reason: string;
  }
) {
  initProductionTracking();
  const idx = state.timeClockEntries.findIndex((e) => e.id === entryId);
  if (idx < 0) throw new Error("Clock entry not found");

  const cur = state.timeClockEntries[idx];
  const clockIn = input.clock_in_at ?? cur.clock_in_at;
  const clockOut = input.clock_out_at !== undefined ? input.clock_out_at : cur.clock_out_at;
  const stillActive = clockOut == null;

  if (clockOut != null && parseISO(clockOut) <= parseISO(clockIn)) {
    throw new Error("Clock out must be after clock in");
  }

  const total = stillActive ? null : minutesBetween(clockIn, clockOut);
  const clockOutType =
    input.clock_out_type !== undefined
      ? input.clock_out_type
      : stillActive
        ? null
        : cur.clock_out_type ?? "out";

  const updated: TimeClockEntry = {
    ...cur,
    clock_in_at: clockIn,
    clock_out_at: clockOut,
    total_minutes: total,
    clock_out_type: clockOutType,
    status: stillActive ? "active" : "edited",
    edited_by: editorId,
    edit_reason: input.edit_reason,
    updated_at: ts(),
  };
  state.timeClockEntries[idx] = updated;
  persistClock(updated);
  return updated;
}

export function createClockEntry(input: {
  userId: string;
  clock_in_at: string;
  clock_out_at?: string | null;
  clock_out_type?: TimeClockOutType | null;
  editorId: string;
  edit_reason: string;
}): TimeClockEntry {
  initProductionTracking();

  const stillActive = input.clock_out_at == null;
  if (stillActive && getActiveClockEntry(input.userId)) {
    throw new Error("Employee already has an active clock punch — edit or close it first");
  }

  if (
    input.clock_out_at != null &&
    parseISO(input.clock_out_at) <= parseISO(input.clock_in_at)
  ) {
    throw new Error("Clock out must be after clock in");
  }

  const entry: TimeClockEntry = {
    id: uid("clk"),
    user_id: input.userId,
    department_id: resolveDepartmentForUser(input.userId),
    clock_in_at: input.clock_in_at,
    clock_out_at: input.clock_out_at ?? null,
    total_minutes:
      input.clock_out_at != null
        ? minutesBetween(input.clock_in_at, input.clock_out_at)
        : null,
    clock_out_type: stillActive ? null : input.clock_out_type ?? "out",
    status: stillActive ? "active" : "edited",
    edited_by: input.editorId,
    edit_reason: input.edit_reason,
    created_at: ts(),
    updated_at: ts(),
  };
  state.timeClockEntries = [entry, ...state.timeClockEntries];
  persistClock(entry);
  logActivityBridge(
    input.userId,
    "time_log",
    stillActive
      ? "Manager added active clock punch"
      : `Manager added clock punch (${entry.total_minutes ?? 0}m)`
  );
  return entry;
}

export function deleteClockEntry(entryId: string): TimeClockEntry {
  initProductionTracking();
  const idx = state.timeClockEntries.findIndex((e) => e.id === entryId);
  if (idx < 0) throw new Error("Clock entry not found");
  const [removed] = state.timeClockEntries.splice(idx, 1);
  void import("@/lib/data/production-tracking-db").then((m) =>
    m.deleteTimeClockEntrySync(entryId)
  );
  return removed;
}

export function getClockEntriesForUser(userId: string, days = 14): TimeClockEntry[] {
  initProductionTracking();
  const since = startOfDay(subDays(new Date(), days));
  return state.timeClockEntries
    .filter((e) => e.user_id === userId && parseISO(e.clock_in_at) >= since)
    .sort((a, b) => b.clock_in_at.localeCompare(a.clock_in_at));
}

export function getTodayClockEntries(userId: string): TimeClockEntry[] {
  initProductionTracking();
  const today = todayDate();
  return state.timeClockEntries
    .filter((e) => e.user_id === userId && isAppCalendarDay(e.clock_in_at, today))
    .sort((a, b) => a.clock_in_at.localeCompare(b.clock_in_at));
}

export function getAllClockEntries(filters?: {
  userId?: string;
  userIds?: string[];
  days?: number;
  from?: string;
  to?: string;
}): TimeClockEntry[] {
  initProductionTracking();
  const userSet = filters?.userIds?.length ? new Set(filters.userIds) : null;
  const toDay = filters?.to ?? appTodayDate();
  const fromDay =
    filters?.from ??
    formatAppCalendarDate(
      startOfDay(subDays(parseISO(`${toDay}T12:00:00`), (filters?.days ?? 14) - 1))
    );

  return state.timeClockEntries
    .filter((e) => {
      if (filters?.userId && e.user_id !== filters.userId) return false;
      if (userSet && !userSet.has(e.user_id)) return false;
      const day = formatAppCalendarDate(e.clock_in_at);
      return day >= fromDay && day <= toDay;
    })
    .sort((a, b) => b.clock_in_at.localeCompare(a.clock_in_at));
}

export function getShiftMinutesToday(userId: string): number {
  const active = getActiveClockEntry(userId);
  if (active) return minutesBetween(active.clock_in_at, ts());

  const today = todayDate();
  const completed = state.timeClockEntries.filter(
    (e) =>
      e.user_id === userId &&
      isAppCalendarDay(e.clock_in_at, today) &&
      e.total_minutes != null
  );
  return completed.reduce((s, e) => s + (e.total_minutes ?? 0), 0);
}

export function getTaskMinutesToday(userId: string): number {
  initProductionTracking();
  const today = todayDate();
  let total = 0;
  for (const entry of state.taskTimeEntries) {
    if (entry.user_id !== userId || !isAppCalendarDay(entry.started_at, today)) continue;
    if (entry.status === "active") {
      total += minutesBetween(entry.started_at, ts());
    } else {
      total += entry.total_active_minutes;
    }
  }
  return total;
}

// ——— Task timer ———

export function getActiveTaskTimeEntry(userId: string): TaskTimeEntry | null {
  initProductionTracking();
  return (
    state.taskTimeEntries.find(
      (e) => e.user_id === userId && (e.status === "active" || e.status === "paused")
    ) ?? null
  );
}

function calcActiveMinutes(entry: TaskTimeEntry, now = ts()): number {
  let total = entry.total_active_minutes;
  if (entry.status === "active") {
    const resumeFrom = entry.resumed_at ?? entry.started_at;
    total += minutesBetween(resumeFrom, now);
  }
  return total;
}

export function startTaskTimer(userId: string, taskId: string): TaskTimeEntry {
  initProductionTracking();
  const store = getFlowStore();
  const pkg = store.workPackages.find((p) => p.id === taskId);
  if (!pkg) throw new Error("Task not found");

  const existingActive = getActiveTaskTimeEntry(userId);
  if (existingActive) {
    throw new Error(`ACTIVE_TASK:${existingActive.task_id}`);
  }

  const isCorrection = pkg.status === "correction_needed";
  const entry: TaskTimeEntry = {
    id: uid("tte"),
    user_id: userId,
    task_id: taskId,
    department_id: pkg.department_id ?? store.projects.find((p) => p.id === pkg.project_id)?.department_id ?? resolveDepartmentForUser(userId),
    project_id: pkg.project_id,
    manufacturer_id: pkg.manufacturer_id,
    year_work_item_id: pkg.year_work_item_id,
    started_at: ts(),
    paused_at: null,
    resumed_at: null,
    completed_at: null,
    total_active_minutes: 0,
    pause_events: [],
    status: "active",
    is_correction_session: isCorrection,
    created_at: ts(),
    updated_at: ts(),
  };
  state.taskTimeEntries = [entry, ...state.taskTimeEntries];
  persistTaskTime(entry);
  activateTaskLiveForecastExternal(taskId, entry.started_at);
  logActivityBridge(userId, "time_log", `Started task timer`, taskId);
  return entry;
}

export function pauseTaskTimer(userId: string): TaskTimeEntry {
  initProductionTracking();
  const entry = getActiveTaskTimeEntry(userId);
  if (!entry || entry.status !== "active") throw new Error("No active task timer");

  const now = ts();
  const resumeFrom = entry.resumed_at ?? entry.started_at;
  const added = minutesBetween(resumeFrom, now);
  const pauseEvent: TaskTimePauseEvent = { paused_at: now, resumed_at: null };

  const updated: TaskTimeEntry = {
    ...entry,
    status: "paused",
    paused_at: now,
    total_active_minutes: entry.total_active_minutes + added,
    pause_events: [...entry.pause_events, pauseEvent],
    updated_at: now,
  };
  state.taskTimeEntries = state.taskTimeEntries.map((e) => (e.id === entry.id ? updated : e));
  persistTaskTime(updated);
  return updated;
}

export function resumeTaskTimer(userId: string): TaskTimeEntry {
  initProductionTracking();
  const entry = getActiveTaskTimeEntry(userId);
  if (!entry || entry.status !== "paused") throw new Error("No paused task timer");

  const now = ts();
  const pauseEvents = entry.pause_events.map((p, i) =>
    i === entry.pause_events.length - 1 && !p.resumed_at ? { ...p, resumed_at: now } : p
  );

  const updated: TaskTimeEntry = {
    ...entry,
    status: "active",
    paused_at: null,
    resumed_at: now,
    pause_events: pauseEvents,
    updated_at: now,
  };
  state.taskTimeEntries = state.taskTimeEntries.map((e) => (e.id === entry.id ? updated : e));
  persistTaskTime(updated);
  return updated;
}

export function stopTaskTimer(userId: string): TaskTimeEntry {
  initProductionTracking();
  const entry = getActiveTaskTimeEntry(userId);
  if (!entry) throw new Error("No active task timer");

  const now = ts();
  let total = entry.total_active_minutes;
  if (entry.status === "active") {
    const resumeFrom = entry.resumed_at ?? entry.started_at;
    total += minutesBetween(resumeFrom, now);
  }

  const updated: TaskTimeEntry = {
    ...entry,
    status: "completed",
    completed_at: now,
    total_active_minutes: total,
    updated_at: now,
  };
  state.taskTimeEntries = state.taskTimeEntries.map((e) => (e.id === entry.id ? updated : e));
  persistTaskTime(updated);
  // Mirror the session into time_logs so actual_hours, people profiles, and
  // scorecards see timer work — time_logs is the canonical hours source.
  if (total > 0) {
    recordTimerTimeLogExternal({
      id: entry.id,
      work_package_id: entry.task_id,
      user_id: entry.user_id,
      hours: Math.round((total / 60) * 100) / 100,
      log_date: formatAppCalendarDate(now),
    });
  }
  refreshTaskLiveForecastExternal(entry.task_id, getTotalTaskMinutes(entry.task_id));
  return updated;
}

/** Pause or stop task timers when shift ends — prevents phantom work time. */
export function finalizeTaskTimersOnShiftEnd(userId: string, outType: TimeClockOutType): void {
  initProductionTracking();
  const entry = getActiveTaskTimeEntry(userId);
  if (!entry) return;
  try {
    if (outType === "lunch" && entry.status === "active") {
      pauseTaskTimer(userId);
      logActivityBridge(userId, "time_log", "Task timer paused — clocked out for lunch", entry.task_id);
    } else {
      stopTaskTimer(userId);
      logActivityBridge(userId, "time_log", "Task timer stopped — shift ended", entry.task_id);
    }
  } catch {
    // Timer may have been finalized concurrently
  }
}

export function forceStopTaskTimer(userId: string): TaskTimeEntry | null {
  initProductionTracking();
  const entry = getActiveTaskTimeEntry(userId);
  if (!entry) return null;
  return stopTaskTimer(userId);
}

export function getTaskTimeEntriesForTask(taskId: string): TaskTimeEntry[] {
  initProductionTracking();
  return state.taskTimeEntries.filter((e) => e.task_id === taskId);
}

export function getTotalTaskMinutes(taskId: string): number {
  const entries = getTaskTimeEntriesForTask(taskId);
  const active = entries.find((e) => e.status === "active" || e.status === "paused");
  if (active) return calcActiveMinutes(active);
  return entries.reduce((s, e) => s + e.total_active_minutes, 0);
}

// ——— File uploads ———

export function uploadTaskFile(input: {
  id?: string;
  task_id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path?: string | null;
  file_data_base64?: string;
}): TaskFileUpload {
  initProductionTracking();
  const store = getFlowStore();
  const pkg = store.workPackages.find((p) => p.id === input.task_id);
  if (!pkg) throw new Error("Task not found");

  const fileId = input.id ?? uid("tfu");
  const upload: TaskFileUpload = {
    id: fileId,
    task_id: input.task_id,
    project_id: pkg.project_id,
    department_id: pkg.department_id ?? store.projects.find((p) => p.id === pkg.project_id)?.department_id ?? resolveDepartmentForUser(input.user_id),
    user_id: input.user_id,
    file_name: input.file_name,
    file_type: input.file_type,
    file_size: input.file_size,
    file_url_or_path: `/api/files/${fileId}`,
    storage_path: input.storage_path ?? null,
    ...(input.file_data_base64 ? { file_data_base64: input.file_data_base64 } : {}),
    uploaded_at: ts(),
    created_at: ts(),
  };
  state.taskFileUploads = [upload, ...state.taskFileUploads];
  persistFile(upload);

  const count = state.taskFileUploads.filter((f) => f.task_id === input.task_id).length;
  updateWorkPackageExternal(input.task_id, { file_count: count });
  refreshTaskLiveForecastExternal(input.task_id, getTotalTaskMinutes(input.task_id));
  logActivityBridge(input.user_id, "file_upload", `Uploaded ${input.file_name}`, input.task_id);
  return upload;
}

export function getTaskFiles(taskId: string): TaskFileUpload[] {
  initProductionTracking();
  return state.taskFileUploads.filter((f) => f.task_id === taskId);
}

export function getTaskFileById(fileId: string): TaskFileUpload | null {
  initProductionTracking();
  return state.taskFileUploads.find((f) => f.id === fileId) ?? null;
}

/** ISO timestamp after which the current work session counts (last submission, if any). */
export function getPendingSessionSince(taskId: string): string | null {
  return getLatestSubmission(taskId)?.submitted_at ?? null;
}

/** Files uploaded for the current pending session — excludes prior submissions. */
export function getTaskFilesForPendingSession(taskId: string): TaskFileUpload[] {
  initProductionTracking();
  const since = getPendingSessionSince(taskId);
  const files = state.taskFileUploads.filter((f) => f.task_id === taskId);
  if (!since) return files;
  return files.filter((f) => f.uploaded_at > since);
}

/** Task minutes for the current pending session (active timer or entries after last submission). */
export function getPendingSessionTaskMinutes(taskId: string, userId: string): number {
  initProductionTracking();
  const active = getActiveTaskTimeEntry(userId);
  if (active?.task_id === taskId) return calcActiveMinutes(active);

  const since = getPendingSessionSince(taskId);
  const entries = getTaskTimeEntriesForTask(taskId).filter(
    (e) => !since || e.started_at > since
  );
  return entries.reduce((s, e) => {
    if (e.status === "active" || e.status === "paused") return s + calcActiveMinutes(e);
    return s + e.total_active_minutes;
  }, 0);
}

/** Files in the current pending session — used for live metrics and submission. */
export function getTaskFileCount(taskId: string): number {
  initProductionTracking();
  const sessionFiles = getTaskFilesForPendingSession(taskId);
  const prodNames = new Set(sessionFiles.map((f) => f.file_name.toLowerCase()));
  const store = getFlowStore();
  const since = getPendingSessionSince(taskId);
  const legacyOnly = store.files.filter((f) => {
    if (f.work_package_id !== taskId) return false;
    if (prodNames.has(f.file_name.toLowerCase())) return false;
    if (since && f.created_at <= since) return false;
    return true;
  });
  return sessionFiles.length + legacyOnly.length;
}

/** All files ever attached to a task (including prior submissions). */
export function getTotalTaskFileCount(taskId: string): number {
  initProductionTracking();
  const productionFiles = state.taskFileUploads.filter((f) => f.task_id === taskId);
  const prodNames = new Set(productionFiles.map((f) => f.file_name.toLowerCase()));
  const store = getFlowStore();
  const legacyOnly = store.files.filter(
    (f) => f.work_package_id === taskId && !prodNames.has(f.file_name.toLowerCase())
  );
  return productionFiles.length + legacyOnly.length;
}

export function getAllTaskFileUploads(): TaskFileUpload[] {
  initProductionTracking();
  return [...state.taskFileUploads];
}

// ——— Submissions ———

export function submitTaskForReview(input: {
  task_id: string;
  user_id: string;
  notes?: string;
  manager_override?: boolean;
}): TaskSubmissionRecord {
  initProductionTracking();
  const store = getFlowStore();
  const pkg = store.workPackages.find((p) => p.id === input.task_id);
  if (!pkg) throw new Error("Task not found");

  // Gate on files across the whole task, not just this session — an analyst
  // who already sent everything in review batches can still complete the task.
  const fileCount = getTaskFileCount(input.task_id);
  if (getTotalTaskFileCount(input.task_id) < 1 && !input.manager_override) {
    throw new Error("At least one file is required before submission");
  }

  const active = getActiveTaskTimeEntry(input.user_id);
  if (active?.task_id === input.task_id) {
    stopTaskTimer(input.user_id);
  }

  const totalMinutes = getPendingSessionTaskMinutes(input.task_id, input.user_id);
  const metrics = computeProductionMetrics(totalMinutes, fileCount);

  const priorSubmissions = state.taskSubmissions.filter((s) => s.task_id === input.task_id);
  const originalMinutes = priorSubmissions[0]?.original_task_minutes ?? totalMinutes;
  const correctionMinutes = pkg.status === "correction_needed"
    ? totalMinutes - (priorSubmissions[priorSubmissions.length - 1]?.total_task_minutes ?? 0)
    : 0;

  const record: TaskSubmissionRecord = {
    id: uid("sub"),
    task_id: input.task_id,
    project_id: pkg.project_id,
    user_id: input.user_id,
    submitted_at: ts(),
    uploaded_file_count: fileCount,
    total_task_minutes: metrics.totalTaskMinutes,
    average_minutes_per_document: metrics.averageMinutesPerDocument,
    documents_per_hour: metrics.documentsPerHour,
    original_task_minutes: Math.max(0, originalMinutes),
    correction_task_minutes: Math.max(0, correctionMinutes),
    status: "submitted",
    submission_type: "final",
    file_ids: getTaskFiles(input.task_id).map((f) => f.id),
    notes: input.notes ?? null,
    created_at: ts(),
    updated_at: ts(),
  };
  state.taskSubmissions = [record, ...state.taskSubmissions];
  persistSubmission(record);

  updateWorkPackageExternal(input.task_id, {
    status: "ready_for_qa",
    qa_status: "pending",
  });
  logActivityBridge(input.user_id, "submit_qa", `Submitted for review (${fileCount} files)`, input.task_id);
  return record;
}

/**
 * Submit the files uploaded since the last submission as a reviewable batch.
 * The task stays workable and the timer keeps running — only a "final" submit
 * moves the package to ready_for_qa.
 */
export function submitBatchForReview(input: {
  task_id: string;
  user_id: string;
  notes?: string;
}): TaskSubmissionRecord {
  initProductionTracking();
  const store = getFlowStore();
  const pkg = store.workPackages.find((p) => p.id === input.task_id);
  if (!pkg) throw new Error("Task not found");

  const batchFiles = getTaskFilesForPendingSession(input.task_id);
  if (batchFiles.length < 1) {
    throw new Error("Upload at least one new file since your last submission to send a batch");
  }

  const totalMinutes = getPendingSessionTaskMinutes(input.task_id, input.user_id);
  const metrics = computeProductionMetrics(totalMinutes, batchFiles.length);
  const priorSubmissions = state.taskSubmissions.filter((s) => s.task_id === input.task_id);
  const originalMinutes = priorSubmissions[0]?.original_task_minutes ?? totalMinutes;

  const record: TaskSubmissionRecord = {
    id: uid("sub"),
    task_id: input.task_id,
    project_id: pkg.project_id,
    user_id: input.user_id,
    submitted_at: ts(),
    uploaded_file_count: batchFiles.length,
    total_task_minutes: metrics.totalTaskMinutes,
    average_minutes_per_document: metrics.averageMinutesPerDocument,
    documents_per_hour: metrics.documentsPerHour,
    original_task_minutes: Math.max(0, originalMinutes),
    correction_task_minutes: 0,
    status: "submitted",
    submission_type: "batch",
    file_ids: batchFiles.map((f) => f.id),
    notes: input.notes ?? null,
    created_at: ts(),
    updated_at: ts(),
  };
  state.taskSubmissions = [record, ...state.taskSubmissions];
  persistSubmission(record);
  logActivityBridge(
    input.user_id,
    "submit_qa",
    `Submitted a batch for review (${batchFiles.length} files)`,
    input.task_id
  );
  return record;
}

/** Batch submissions still waiting on a reviewer, newest first. */
export function listOpenBatchSubmissions(taskIds?: string[]): TaskSubmissionRecord[] {
  initProductionTracking();
  const scoped = taskIds ? new Set(taskIds) : null;
  return state.taskSubmissions
    .filter(
      (s) =>
        s.submission_type === "batch" &&
        s.status === "submitted" &&
        (!scoped || scoped.has(s.task_id))
    )
    .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
}

/** Record a reviewer decision on a batch submission; corrections flag the task without locking it. */
export function resolveBatchSubmission(
  submissionId: string,
  decision: "approved" | "correction_requested",
  notes?: string
): TaskSubmissionRecord {
  initProductionTracking();
  const existing = state.taskSubmissions.find((s) => s.id === submissionId);
  if (!existing) throw new Error("Submission not found");
  if (existing.submission_type !== "batch") throw new Error("Not a batch submission");
  if (existing.status !== "submitted") throw new Error("Batch has already been reviewed");

  const updated: TaskSubmissionRecord = {
    ...existing,
    status: decision,
    notes: notes?.trim() ? notes.trim() : existing.notes,
    updated_at: ts(),
  };
  state.taskSubmissions = state.taskSubmissions.map((s) => (s.id === submissionId ? updated : s));
  persistSubmission(updated);

  if (decision === "correction_requested") {
    updateWorkPackageExternal(existing.task_id, { status: "correction_needed" });
  } else {
    // An approved batch clears an earlier batch-review correction flag — the
    // analyst addressed it and the reviewer signed off on the fresh files.
    const pkgNow = getFlowStore().workPackages.find((p) => p.id === existing.task_id);
    if (pkgNow?.status === "correction_needed") {
      updateWorkPackageExternal(existing.task_id, { status: "working_on_it" });
    }
  }
  return updated;
}

export function getLatestSubmission(taskId: string): TaskSubmissionRecord | null {
  initProductionTracking();
  return (
    state.taskSubmissions
      .filter((s) => s.task_id === taskId)
      .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0] ?? null
  );
}

export function getSubmissionsForTask(taskId: string): TaskSubmissionRecord[] {
  initProductionTracking();
  return state.taskSubmissions
    .filter((s) => s.task_id === taskId)
    .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
}

// ——— QA integration ———

export function recordProductionQaReview(input: {
  task_id: string;
  submission_id: string | null;
  reviewer_id: string;
  result: QaResult;
  notes?: string;
  error_category?: string;
}): QaReviewRecord {
  initProductionTracking();
  const correctionRequired = input.result !== "pass";
  const record: QaReviewRecord = {
    id: uid("qrr"),
    task_id: input.task_id,
    submission_id: input.submission_id,
    reviewer_id: input.reviewer_id,
    reviewed_at: ts(),
    status: input.result,
    notes: input.notes ?? null,
    correction_required: correctionRequired,
    correction_reason: correctionRequired
      ? input.notes ?? input.error_category ?? "Corrections required"
      : null,
    created_at: ts(),
  };
  state.qaReviewRecords = [record, ...state.qaReviewRecords];
  persistQaReview(record);

  if (input.submission_id) {
    const statusMap: Record<QaResult, TaskSubmissionStatus> = {
      pass: "approved",
      minor_correction: "correction_requested",
      major_correction: "correction_requested",
      rejected: "rejected",
    };
    state.taskSubmissions = state.taskSubmissions.map((s) => {
      if (s.id !== input.submission_id) return s;
      const updated = { ...s, status: statusMap[input.result], updated_at: ts() };
      persistSubmission(updated);
      return updated;
    });
  }

  return record;
}

export function getQaReviewRecordsForTask(taskId: string): QaReviewRecord[] {
  initProductionTracking();
  return state.qaReviewRecords.filter((r) => r.task_id === taskId);
}

// ——— Reporting ———

export function getProductionReport(filters: ProductionReportFilters = {}): ProductionReportSummary {
  initProductionTracking();
  const store = getFlowStore();
  const enriched = store.workPackages;

  const start = filters.startDate ? parseISO(filters.startDate) : startOfDay(subDays(new Date(), 30));
  const end = filters.endDate ? parseISO(filters.endDate) : new Date();

  let subs = state.taskSubmissions.filter((s) =>
    isWithinInterval(parseISO(s.submitted_at), { start, end })
  );

  if (filters.userId) subs = subs.filter((s) => s.user_id === filters.userId);
  if (filters.userIds?.length) {
    const ids = new Set(filters.userIds);
    subs = subs.filter((s) => ids.has(s.user_id));
  }
  if (filters.projectId) subs = subs.filter((s) => s.project_id === filters.projectId);
  if (filters.status) subs = subs.filter((s) => s.status === filters.status);

  if (filters.departmentId) {
    subs = subs.filter((s) => {
      const pkg = enriched.find((p) => p.id === s.task_id);
      const deptId =
        pkg?.department_id ??
        store.projects.find((p) => p.id === s.project_id)?.department_id;
      return deptId === filters.departmentId;
    });
  }

  const rows: ProductionReportSummary["rows"] = subs.map((s) => {
    const pkg = enriched.find((p) => p.id === s.task_id);
    const mfr = store.manufacturers.find((m) => m.id === pkg?.manufacturer_id);
    const project = store.projects.find((p) => p.id === s.project_id);
    const user = store.users.find((u) => u.id === s.user_id);
    if (filters.manufacturerId && pkg?.manufacturer_id !== filters.manufacturerId) {
      return null;
    }
    return {
      taskId: s.task_id,
      taskTitle: pkg?.title ?? s.task_id,
      projectName: project?.name ?? "—",
      manufacturerName: mfr?.name ?? "—",
      employeeName: user?.full_name ?? "—",
      employeeId: s.user_id,
      submittedAt: s.submitted_at,
      totalTaskMinutes: s.total_task_minutes,
      fileCount: s.uploaded_file_count,
      averageMinutesPerDocument: s.average_minutes_per_document,
      documentsPerHour: s.documents_per_hour,
      status: s.status,
      awaitingQa: s.status === "submitted" || s.status === "in_review",
    };
  }).filter(Boolean) as ProductionReportSummary["rows"];

  const totalFiles = rows.reduce((s, r) => s + r.fileCount, 0);
  const totalMinutes = rows.reduce((s, r) => s + r.totalTaskMinutes, 0);

  const byEmployeeMap = new Map<string, { submissions: number; totalMinutes: number; fileCount: number; docsPerHour: number[] }>();
  for (const r of rows) {
    const cur = byEmployeeMap.get(r.employeeId) ?? { submissions: 0, totalMinutes: 0, fileCount: 0, docsPerHour: [] };
    cur.submissions += 1;
    cur.totalMinutes += r.totalTaskMinutes;
    cur.fileCount += r.fileCount;
    cur.docsPerHour.push(r.documentsPerHour);
    byEmployeeMap.set(r.employeeId, cur);
  }

  const byProjectMap = new Map<string, { name: string; submissions: number; totalMinutes: number; fileCount: number }>();
  for (const r of rows) {
    const pkg = enriched.find((p) => p.id === r.taskId);
    if (!pkg) continue;
    const project = store.projects.find((p) => p.id === pkg.project_id);
    const cur = byProjectMap.get(pkg.project_id) ?? {
      name: project?.name ?? pkg.project_id,
      submissions: 0,
      totalMinutes: 0,
      fileCount: 0,
    };
    cur.submissions += 1;
    cur.totalMinutes += r.totalTaskMinutes;
    cur.fileCount += r.fileCount;
    byProjectMap.set(pkg.project_id, cur);
  }

  const byManufacturerMap = new Map<string, { name: string; submissions: number; totalMinutes: number; fileCount: number }>();
  for (const r of rows) {
    const pkg = enriched.find((p) => p.id === r.taskId);
    if (!pkg) continue;
    const mfr = store.manufacturers.find((m) => m.id === pkg.manufacturer_id);
    const cur = byManufacturerMap.get(pkg.manufacturer_id) ?? {
      name: mfr?.name ?? pkg.manufacturer_id,
      submissions: 0,
      totalMinutes: 0,
      fileCount: 0,
    };
    cur.submissions += 1;
    cur.totalMinutes += r.totalTaskMinutes;
    cur.fileCount += r.fileCount;
    byManufacturerMap.set(pkg.manufacturer_id, cur);
  }

  const byDepartmentMap = new Map<string, { name: string; submissions: number; totalMinutes: number; fileCount: number; hoursWorked: number }>();
  for (const r of rows) {
    const pkg = enriched.find((p) => p.id === r.taskId);
    if (!pkg) continue;
    const deptId =
      pkg.department_id ??
      store.projects.find((p) => p.id === pkg.project_id)?.department_id ??
      "unknown";
    const cur = byDepartmentMap.get(deptId) ?? {
      name: getDepartmentName(deptId),
      submissions: 0,
      totalMinutes: 0,
      fileCount: 0,
      hoursWorked: 0,
    };
    cur.submissions += 1;
    cur.totalMinutes += r.totalTaskMinutes;
    cur.fileCount += r.fileCount;
    cur.hoursWorked = Math.round((cur.totalMinutes / 60) * 10) / 10;
    byDepartmentMap.set(deptId, cur);
  }

  const trendMap = new Map<string, { submissions: number; totalMinutes: number; docsPerHour: number[] }>();
  for (const s of subs) {
    const day = s.submitted_at.slice(0, 10);
    const cur = trendMap.get(day) ?? { submissions: 0, totalMinutes: 0, docsPerHour: [] };
    cur.submissions += 1;
    cur.totalMinutes += s.total_task_minutes;
    cur.docsPerHour.push(s.documents_per_hour);
    trendMap.set(day, cur);
  }

  return {
    totalSubmissions: rows.length,
    awaitingQa: rows.filter((r) => r.awaitingQa).length,
    avgMinutesPerDocument:
      totalFiles > 0 ? Math.round((totalMinutes / totalFiles) * 100) / 100 : 0,
    avgDocumentsPerHour:
      totalMinutes > 0
        ? Math.round((totalFiles / (totalMinutes / 60)) * 100) / 100
        : 0,
    totalTaskHours: Math.round((totalMinutes / 60) * 10) / 10,
    rows,
    byEmployee: [...byEmployeeMap.entries()].map(([userId, v]) => ({
      userId,
      name: store.users.find((u) => u.id === userId)?.full_name ?? userId,
      submissions: v.submissions,
      totalMinutes: v.totalMinutes,
      fileCount: v.fileCount,
      docsPerHour:
        v.docsPerHour.length > 0
          ? Math.round((v.docsPerHour.reduce((a, b) => a + b, 0) / v.docsPerHour.length) * 100) / 100
          : 0,
    })),
    byDepartment: [...byDepartmentMap.entries()].map(([departmentId, v]) => ({
      departmentId,
      name: v.name,
      submissions: v.submissions,
      totalMinutes: v.totalMinutes,
      fileCount: v.fileCount,
      hoursWorked: v.hoursWorked,
    })),
    byProject: [...byProjectMap.entries()].map(([projectId, v]) => ({
      projectId,
      ...v,
    })),
    byManufacturer: [...byManufacturerMap.entries()].map(([manufacturerId, v]) => ({
      manufacturerId,
      ...v,
    })),
    trends: [...trendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        submissions: v.submissions,
        totalMinutes: v.totalMinutes,
        avgDocsPerHour:
          v.docsPerHour.length > 0
            ? Math.round((v.docsPerHour.reduce((a, b) => a + b, 0) / v.docsPerHour.length) * 100) / 100
            : 0,
      })),
  };
}

export function getDocumentsUploadedToday(userId: string): number {
  initProductionTracking();
  const today = todayDate();
  return state.taskFileUploads.filter(
    (f) => f.user_id === userId && isAppCalendarDay(f.uploaded_at, today)
  ).length;
}
