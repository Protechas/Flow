import { getProductionStore } from "@/lib/data/production-tracking";
import { getWorkPackages } from "@/lib/data/work-packages";
import { isAppCalendarDay } from "@/lib/datetime/timezone";

export interface WrapUpDraft {
  /** Pre-composed "what I completed today" text built from tracked activity. */
  summary: string;
  hasActivity: boolean;
}

function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded}m`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Build a wrap-up draft from what Flow already tracked today: task timers,
 * file uploads, and QA submissions. The employee reviews and edits instead of
 * reconstructing their day from memory.
 */
export async function buildWrapUpDraft(userId: string): Promise<WrapUpDraft> {
  const store = getProductionStore();
  const packages = await getWorkPackages();
  const titleFor = (taskId: string) =>
    packages.find((p) => p.id === taskId)?.title ?? "an untitled task";

  const minutesByTask = new Map<string, number>();
  for (const entry of store.taskTimeEntries) {
    if (entry.user_id !== userId) continue;
    if (!isAppCalendarDay(entry.started_at)) continue;
    minutesByTask.set(
      entry.task_id,
      (minutesByTask.get(entry.task_id) ?? 0) + entry.total_active_minutes
    );
  }

  const submittedTaskIds = new Set(
    store.taskSubmissions
      .filter((s) => s.user_id === userId && isAppCalendarDay(s.submitted_at))
      .map((s) => s.task_id)
  );

  const uploadsToday = store.taskFileUploads.filter(
    (f) => f.user_id === userId && isAppCalendarDay(f.uploaded_at)
  ).length;

  const lines: string[] = [];
  const byTimeDesc = [...minutesByTask.entries()].sort((a, b) => b[1] - a[1]);
  for (const [taskId, minutes] of byTimeDesc) {
    if (minutes < 1) continue;
    const submitted = submittedTaskIds.has(taskId) ? " — submitted to QA" : "";
    lines.push(`• ${titleFor(taskId)} (${formatMinutes(minutes)})${submitted}`);
    submittedTaskIds.delete(taskId);
  }
  // Submissions without timer activity today (e.g. resubmits) still count.
  for (const taskId of submittedTaskIds) {
    lines.push(`• ${titleFor(taskId)} — submitted to QA`);
  }
  if (uploadsToday > 0) {
    lines.push(`• Uploaded ${uploadsToday} file${uploadsToday === 1 ? "" : "s"}`);
  }

  return { summary: lines.join("\n"), hasActivity: lines.length > 0 };
}
