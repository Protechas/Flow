import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import {
  getClockEntriesForUser,
  getProductionStore,
  initProductionTracking,
} from "@/lib/data/production-tracking";
import { listFeedbackSubmissions } from "@/lib/innovation-hub/feedback";
import { getAppTimeZone } from "@/lib/datetime/timezone";
import { BADGE_DEFINITIONS, type BadgeState } from "@/lib/badges/badge-types";

const EARLY_BIRD_CUTOFF_MINUTES = 7 * 60 + 30; // 7:30 AM local

function appClockMinutes(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: getAppTimeZone(),
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function isWeekday(dateStr: string): boolean {
  const day = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Longest current run of consecutive weekdays with a daily report, ending at
 * the most recent weekday (today doesn't break the streak if not filed yet). */
function reportStreak(wrapDates: Set<string>, today: string): number {
  let cursor = wrapDates.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    if (!isWeekday(cursor)) {
      cursor = shiftDate(cursor, -1);
      continue;
    }
    if (!wrapDates.has(cursor)) break;
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

/** Compute every badge's earned/progress state for one employee. */
export async function computeBadges(userId: string): Promise<BadgeState[]> {
  initFlowStore();
  initProductionTracking();
  const production = getProductionStore();
  const store = getFlowStore();

  const uploads = production.taskFileUploads.filter((f) => f.user_id === userId).length;
  const submissions = production.taskSubmissions.filter((s) => s.user_id === userId);
  const batches = submissions.filter((s) => s.submission_type === "batch").length;

  const myTaskIds = new Set(submissions.map((s) => s.task_id));
  const qaPasses = production.qaReviewRecords.filter(
    (r) => myTaskIds.has(r.task_id) && r.status === "pass"
  ).length;

  const clockEntries = getClockEntriesForUser(userId, 90);
  const earlyDays = new Set(
    clockEntries
      .filter((e) => appClockMinutes(e.clock_in_at) < EARLY_BIRD_CUTOFF_MINUTES)
      .map((e) => e.clock_in_at.slice(0, 10))
  ).size;

  const today = new Date().toISOString().slice(0, 10);
  const cutoff30 = shiftDate(today, -30);
  const recentClock = clockEntries.filter((e) => e.clock_in_at.slice(0, 10) >= cutoff30);
  const cleanDays = new Set(recentClock.map((e) => e.clock_in_at.slice(0, 10))).size;
  const hasCorrections = recentClock.some((e) => e.edited_by && e.edited_by !== userId);

  const wrapDates = new Set(
    store.dailyWrapUps.filter((w) => w.user_id === userId).map((w) => w.wrap_date)
  );
  const streak = reportStreak(wrapDates, today);

  const minutesByDay = new Map<string, number>();
  for (const entry of production.taskTimeEntries) {
    if (entry.user_id !== userId || entry.status !== "completed") continue;
    const day = entry.started_at.slice(0, 10);
    minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + entry.total_active_minutes);
  }
  const bestDayMinutes = Math.max(0, ...minutesByDay.values());

  let ideas = 0;
  try {
    ideas = (await listFeedbackSubmissions()).filter((f) => f.user_id === userId).length;
  } catch {
    // feedback unavailable — badge stays locked
  }

  const stats: Record<string, { progress: number; target: number }> = {
    first_upload: { progress: Math.min(uploads, 1), target: 1 },
    files_100: { progress: Math.min(uploads, 100), target: 100 },
    files_500: { progress: Math.min(uploads, 500), target: 500 },
    files_1000: { progress: Math.min(uploads, 1000), target: 1000 },
    batch_10: { progress: Math.min(batches, 10), target: 10 },
    qa_pass_1: { progress: Math.min(qaPasses, 1), target: 1 },
    qa_pass_5: { progress: Math.min(qaPasses, 5), target: 5 },
    early_bird: { progress: Math.min(earlyDays, 5), target: 5 },
    report_streak_5: { progress: Math.min(streak, 5), target: 5 },
    clean_month: { progress: hasCorrections ? 0 : Math.min(cleanDays, 20), target: 20 },
    marathon: { progress: Math.min(bestDayMinutes, 480), target: 480 },
    idea_1: { progress: Math.min(ideas, 1), target: 1 },
  };

  return BADGE_DEFINITIONS.map((def) => {
    const s = stats[def.id] ?? { progress: 0, target: 1 };
    return { ...def, earned: s.progress >= s.target, progress: s.progress, target: s.target };
  });
}
