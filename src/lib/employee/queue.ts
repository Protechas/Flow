import { compareTaskPriority } from "@/lib/employee/task-utils";
import { primaryDueDate } from "@/lib/forecast/live";
import { completedInRange } from "@/lib/scoring/flow-score";
import type { TaskTimeEntry, WorkPackage } from "@/types/flow";
import { format, isSameDay, isToday, isTomorrow, parseISO, startOfDay } from "date-fns";

export type EmployeeQueueBlockReason =
  | "waiting_on_prior_task"
  | "waiting_on_approval"
  | "waiting_on_materials"
  | "missing_info"
  | "not_scheduled";

export const QUEUE_BLOCK_LABELS: Record<EmployeeQueueBlockReason, string> = {
  waiting_on_prior_task: "Waiting on prior task",
  waiting_on_approval: "Waiting on approval",
  waiting_on_materials: "Waiting on materials",
  missing_info: "Missing info",
  not_scheduled: "Not scheduled yet",
};

export interface EmployeeQueueBlockedItem {
  task: WorkPackage;
  reason: EmployeeQueueBlockReason;
  label: string;
}

export interface EmployeeMyQueue {
  current: WorkPackage | null;
  upNext: WorkPackage[];
  blocked: EmployeeQueueBlockedItem[];
  completedToday: WorkPackage[];
  hasAnyTasks: boolean;
}

const STARTABLE_STATUSES = new Set(["assigned", "not_started", "correction_needed"]);

/** Priority → due date → assigned date → created date */
export function compareQueueOrder(a: WorkPackage, b: WorkPackage): number {
  const byPriority = compareTaskPriority(a, b);
  if (byPriority !== 0) return byPriority;
  if (a.assigned_at && b.assigned_at) {
    const assigned = a.assigned_at.localeCompare(b.assigned_at);
    if (assigned !== 0) return assigned;
  } else if (a.assigned_at) {
    return -1;
  } else if (b.assigned_at) {
    return 1;
  }
  return a.created_at.localeCompare(b.created_at);
}

function inferBlockReason(task: WorkPackage): EmployeeQueueBlockedItem | null {
  if (task.status === "ready_for_qa" || task.status === "in_qa") {
    return {
      task,
      reason: "waiting_on_approval",
      label: QUEUE_BLOCK_LABELS.waiting_on_approval,
    };
  }

  if (task.status === "waiting") {
    const notes = (task.notes ?? "").toLowerCase();
    const reason: EmployeeQueueBlockReason = notes.includes("material")
      ? "waiting_on_materials"
      : "waiting_on_approval";
    return { task, reason, label: QUEUE_BLOCK_LABELS[reason] };
  }

  if (task.status === "stuck") {
    return {
      task,
      reason: "missing_info",
      label: task.notes?.trim() || QUEUE_BLOCK_LABELS.missing_info,
    };
  }

  if (task.status === "not_started" && !task.start_date && !task.due_date) {
    return {
      task,
      reason: "not_scheduled",
      label: QUEUE_BLOCK_LABELS.not_scheduled,
    };
  }

  return null;
}

function completedTodayTasks(packages: WorkPackage[]): WorkPackage[] {
  const today = startOfDay(new Date());
  return packages
    .filter(
      (t) =>
        t.status === "done" &&
        t.completed_date &&
        isSameDay(parseISO(t.completed_date), today)
    )
    .sort((a, b) => (b.completed_date ?? "").localeCompare(a.completed_date ?? ""));
}

export function formatQueueTaskLocation(task: WorkPackage): string {
  const parts = [task.project?.name, task.manufacturer?.name, task.year ? String(task.year) : null].filter(
    Boolean
  );
  return parts.join(" · ") || "—";
}

export function formatQueueDueLabel(task: WorkPackage): string | null {
  const due = primaryDueDate(task) ?? task.due_date;
  if (!due) return null;
  try {
    const d = parseISO(due.length > 10 ? due : `${due}T12:00:00`);
    const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (due.includes("T")) {
      const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      return `${date} · ${time}`;
    }
    return date;
  } catch {
    return due;
  }
}

export function formatQueueDueFriendly(task: WorkPackage): string {
  const due = primaryDueDate(task) ?? task.due_date;
  if (!due) return "No due date";
  try {
    const d = parseISO(due.length > 10 ? due : `${due}T12:00:00`);
    if (isToday(d)) return "Due today";
    if (isTomorrow(d)) return "Due tomorrow";
    const days = Math.round(
      (startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / 86400000
    );
    if (days < 0) return "Overdue";
    if (days <= 7) return `Due ${format(d, "EEEE")}`;
    return `Due ${format(d, "MMM d")}`;
  } catch {
    return due;
  }
}

export function taskProgressPercent(task: WorkPackage): number | null {
  const total = task.estimated_document_count ?? 0;
  if (total <= 0) return null;
  const done = task.current_documents_completed ?? 0;
  return Math.min(100, Math.round((done / total) * 100));
}

export function buildEmployeeMyQueue(input: {
  packages: WorkPackage[];
  currentTask: WorkPackage | null;
  activeTaskTimer: TaskTimeEntry | null;
}): EmployeeMyQueue {
  const { packages, activeTaskTimer } = input;
  const current =
    input.currentTask ??
    (activeTaskTimer
      ? packages.find((p) => p.id === activeTaskTimer.task_id) ?? null
      : null);

  const currentId = current?.id ?? null;
  const blocked: EmployeeQueueBlockedItem[] = [];
  const upNext: WorkPackage[] = [];
  // A second in-progress task must stay visible — it's not "current", not
  // startable, and not blocked, so without this bucket it vanished entirely.
  const alsoInProgress: WorkPackage[] = [];

  for (const task of packages) {
    if (task.status === "done") continue;
    if (currentId && task.id === currentId) continue;

    if (task.status === "working_on_it") {
      alsoInProgress.push(task);
      continue;
    }

    const block = inferBlockReason(task);
    if (block) {
      blocked.push(block);
      continue;
    }

    if (STARTABLE_STATUSES.has(task.status)) {
      upNext.push(task);
    }
  }

  blocked.sort((a, b) => compareQueueOrder(a.task, b.task));
  alsoInProgress.sort(compareQueueOrder);
  upNext.sort(compareQueueOrder);
  // In-progress work leads the queue — you resume before you start fresh.
  upNext.unshift(...alsoInProgress);

  const completedToday = completedTodayTasks(packages);

  return {
    current,
    upNext,
    blocked,
    completedToday,
    hasAnyTasks: packages.length > 0,
  };
}
