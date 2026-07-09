import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import {
  getClockEntriesForUser,
  getProductionStore,
  initProductionTracking,
} from "@/lib/data/production-tracking";
import { listFeedbackSubmissions } from "@/lib/innovation-hub/feedback";
import { effectiveDocuments } from "@/lib/files/effective-docs";
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
  let ideas = 0;
  try {
    ideas = (await listFeedbackSubmissions()).filter((f) => f.user_id === userId).length;
  } catch {
    // feedback unavailable — badge stays locked
  }
  return computeBadgesWithIdeas(userId, ideas);
}

/** Batch variant: one feedback fetch for the whole roster. */
export async function computeBadgesForUsers(
  userIds: string[]
): Promise<Record<string, BadgeState[]>> {
  const ideasByUser = new Map<string, number>();
  try {
    for (const f of await listFeedbackSubmissions()) {
      ideasByUser.set(f.user_id, (ideasByUser.get(f.user_id) ?? 0) + 1);
    }
  } catch {
    // feedback unavailable — idea badges stay locked
  }
  const result: Record<string, BadgeState[]> = {};
  for (const id of userIds) {
    result[id] = computeBadgesWithIdeas(id, ideasByUser.get(id) ?? 0);
  }
  return result;
}

function computeBadgesWithIdeas(userId: string, ideas: number): BadgeState[] {
  initFlowStore();
  initProductionTracking();
  const production = getProductionStore();
  const store = getFlowStore();

  // Effective documents only — split parts and duplicate re-uploads never
  // earn badges.
  const myUploads = effectiveDocuments(
    production.taskFileUploads.filter((f) => f.user_id === userId)
  );
  const uploads = myUploads.length;
  const uploadsByDay = new Map<string, number>();
  for (const f of myUploads) {
    const day = f.uploaded_at.slice(0, 10);
    uploadsByDay.set(day, (uploadsByDay.get(day) ?? 0) + 1);
  }
  const bestUploadDay = Math.max(0, ...uploadsByDay.values());

  const submissions = production.taskSubmissions.filter((s) => s.user_id === userId);
  const batches = submissions.filter((s) => s.submission_type === "batch").length;

  const myTaskIds = new Set(submissions.map((s) => s.task_id));
  const qaPasses = production.qaReviewRecords.filter(
    (r) => myTaskIds.has(r.task_id) && r.status === "pass"
  ).length;
  const reviewsDone = production.qaReviewRecords.filter((r) => r.reviewer_id === userId).length;

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
  // Platinum window: the full 90-day fetch.
  const cleanDays90 = new Set(clockEntries.map((e) => e.clock_in_at.slice(0, 10))).size;
  const hasCorrections90 = clockEntries.some((e) => e.edited_by && e.edited_by !== userId);

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
  const marathonDays = [...minutesByDay.values()].filter((m) => m >= 480).length;

  const capped = (value: number, target: number) => ({
    progress: Math.min(value, target),
    target,
  });

  const stats: Record<string, { progress: number; target: number }> = {
    first_upload: capped(uploads, 1),
    files_100: capped(uploads, 100),
    files_500: capped(uploads, 500),
    files_1000: capped(uploads, 1000),
    files_2500: capped(uploads, 2500),
    big_day: capped(bestUploadDay, 60),
    century_day: capped(bestUploadDay, 100),
    batch_1: capped(batches, 1),
    batch_10: capped(batches, 10),
    batch_50: capped(batches, 50),
    qa_pass_1: capped(qaPasses, 1),
    qa_pass_5: capped(qaPasses, 5),
    qa_pass_25: capped(qaPasses, 25),
    review_1: capped(reviewsDone, 1),
    review_25: capped(reviewsDone, 25),
    review_100: capped(reviewsDone, 100),
    early_bird: capped(earlyDays, 5),
    dawn_patrol: capped(earlyDays, 20),
    clean_month: capped(hasCorrections ? 0 : cleanDays, 20),
    swiss_watch: capped(hasCorrections90 ? 0 : cleanDays90, 45),
    report_streak_5: capped(streak, 5),
    report_streak_20: capped(streak, 20),
    marathon: capped(bestDayMinutes, 480),
    marathon_5: capped(marathonDays, 5),
    idea_1: capped(ideas, 1),
    idea_5: capped(ideas, 5),
  };

  return BADGE_DEFINITIONS.map((def) => {
    const s = stats[def.id] ?? { progress: 0, target: 1 };
    return { ...def, earned: s.progress >= s.target, progress: s.progress, target: s.target };
  });
}
