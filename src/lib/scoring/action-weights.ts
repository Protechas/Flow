import type { ActivityEvent, ActivityEventType } from "@/types/flow";

/** Base points per activity type — drives engagement & activity score */
export const ACTION_BASE_POINTS: Record<ActivityEventType, number> = {
  status_change: 4,
  assignment: 6,
  time_log: 8,
  qa_review: 12,
  comment: 3,
  file_upload: 5,
  submit_qa: 18,
  task_complete: 22,
  correction_received: 0,
  correction_resolved: 14,
};

export const ACTION_LABELS: Record<ActivityEventType, string> = {
  status_change: "Status updates",
  assignment: "Assignments",
  time_log: "Time logged",
  qa_review: "QA reviews",
  comment: "Comments",
  file_upload: "Files uploaded",
  submit_qa: "Submitted to QA",
  task_complete: "Tasks completed",
  correction_received: "QA returns",
  correction_resolved: "Corrections resolved",
};

const WEEKLY_ACTIVITY_TARGET_POINTS = 120;

export function getActionPoints(event: ActivityEvent, hoursFromLog?: number): number {
  let pts = ACTION_BASE_POINTS[event.type] ?? 2;
  if (event.type === "time_log" && hoursFromLog) {
    pts += Math.round(hoursFromLog * 3);
  }
  if (event.summary.toLowerCase().includes("urgent")) {
    pts += 2;
  }
  return pts;
}

export function activityScoreFromPoints(points: number, target = WEEKLY_ACTIVITY_TARGET_POINTS): number {
  return Math.min(100, Math.round((points / target) * 100));
}
