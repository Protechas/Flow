import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import {
  getActiveClockEntry,
  getActiveTaskTimeEntry,
  getTaskFilesForPendingSession,
  getTodayClockEntries,
  initProductionTracking,
} from "@/lib/data/production-tracking";
import { listWorkPackages } from "@/lib/data/work-packages";
import { appTodayDate } from "@/lib/datetime/timezone";
import type { User } from "@/types/flow";
import type { CoachNudge, CoachNudgeType, CoachPersona } from "@/lib/coach/coach-types";

const NO_TIMER_AFTER_MINUTES = 30;
const BATCH_READY_AT_FILES = 5;
const WRAP_UP_DUE_AFTER_MINUTES = 390; // ~6.5h on the clock

type CopyInput = { minutes?: number; files?: number; task?: string };

const COPY: Record<CoachNudgeType, Record<CoachPersona, (i: CopyInput) => string>> = {
  no_timer: {
    professional: ({ minutes }) =>
      `You've been clocked in ${minutes} minutes without a task timer running. Start one so your work counts.`,
    encouraging: ({ minutes }) =>
      `You're ${minutes} minutes into your shift with no timer running — start one and let's make those minutes count! 💪`,
    drill_sergeant: ({ minutes }) =>
      `${minutes} MINUTES on the clock and NO TIMER RUNNING. The work doesn't log itself. MOVE.`,
    smartass: ({ minutes }) =>
      `Clocked in ${minutes} minutes with no timer running. Bold strategy — auditing vibes instead of documents?`,
  },
  batch_ready: {
    professional: ({ files, task }) =>
      `${files} files uploaded on "${task}" since your last submission. Send a batch so QA keeps pace with you.`,
    encouraging: ({ files, task }) =>
      `${files} fresh files on "${task}" ready to go — send that batch in, you're on a roll!`,
    drill_sergeant: ({ files, task }) =>
      `${files} files sitting on "${task}" collecting dust. SEND THE BATCH. NOW.`,
    smartass: ({ files, task }) =>
      `${files} files piled up on "${task}" since your last submission. They're not going to review themselves, champ.`,
  },
  wrap_up_due: {
    professional: () => `Long day on the clock — submit your daily report before you head out.`,
    encouraging: () => `Almost done for the day — knock out your daily report and finish strong! 🌟`,
    drill_sergeant: () =>
      `You think the day ends without a daily report? WRONG. Write it. That's an order.`,
    smartass: () =>
      `Ah yes, the classic "forgot the daily report" move. Groundbreaking. The form is right there.`,
  },
  qa_return: {
    professional: ({ task }) =>
      `QA returned "${task}" with corrections. Address them while the context is fresh.`,
    encouraging: ({ task }) =>
      `QA sent "${task}" back with a few notes — quick fixes and you're golden!`,
    drill_sergeant: ({ task }) =>
      `QA bounced "${task}" back. Corrections don't fix themselves, soldier. GET ON IT.`,
    smartass: ({ task }) =>
      `"${task}" came back from QA. Turns out "close enough" wasn't. Corrections await.`,
  },
};

export function resolveCoachPersona(user: User): CoachPersona {
  const p = (user as { coach_persona?: string | null }).coach_persona;
  return p === "encouraging" || p === "drill_sergeant" || p === "smartass" || p === "professional"
    ? p
    : "professional";
}

/** Rule-based workspace nudges. Store must be hydrated before calling. */
export function computeCoachNudges(user: User): CoachNudge[] {
  initFlowStore();
  initProductionTracking();
  const persona = resolveCoachPersona(user);
  const nudges: CoachNudge[] = [];

  const activeClock = getActiveClockEntry(user.id);
  const activeTimer = getActiveTaskTimeEntry(user.id);
  const myTasks = listWorkPackages({ assignedTo: user.id });
  const workingTask =
    myTasks.find((t) => t.status === "working_on_it") ??
    myTasks.find((t) => t.status === "assigned");

  // 1. Clocked in, no timer, work available.
  if (activeClock && !activeTimer && workingTask) {
    const minutes = Math.floor(
      (Date.now() - new Date(activeClock.clock_in_at).getTime()) / 60_000
    );
    if (minutes >= NO_TIMER_AFTER_MINUTES) {
      nudges.push({
        type: "no_timer",
        message: COPY.no_timer[persona]({ minutes }),
        href: `/work/${workingTask.id}`,
        actionLabel: "Open task",
      });
    }
  }

  // 2. A healthy pile of unsubmitted files → suggest a batch.
  for (const task of myTasks) {
    if (task.status !== "working_on_it") continue;
    const files = getTaskFilesForPendingSession(task.id).length;
    if (files >= BATCH_READY_AT_FILES) {
      nudges.push({
        type: "batch_ready",
        message: COPY.batch_ready[persona]({ files, task: task.title }),
        href: `/work/${task.id}`,
        actionLabel: "Send a batch",
      });
      break; // one batch nudge is plenty
    }
  }

  // 3. Long shift, no daily report yet.
  if (activeClock) {
    const today = appTodayDate();
    const clockedMinutes = getTodayClockEntries(user.id).reduce((sum, e) => {
      const start = new Date(e.clock_in_at).getTime();
      const end = e.clock_out_at ? new Date(e.clock_out_at).getTime() : Date.now();
      return sum + Math.max(0, (end - start) / 60_000);
    }, 0);
    const hasWrapUp = getFlowStore().dailyWrapUps.some(
      (w) => w.user_id === user.id && w.wrap_date === today
    );
    if (clockedMinutes >= WRAP_UP_DUE_AFTER_MINUTES && !hasWrapUp) {
      nudges.push({
        type: "wrap_up_due",
        message: COPY.wrap_up_due[persona]({}),
        href: null,
        actionLabel: null,
      });
    }
  }

  // 4. QA returned something.
  const returned = myTasks.find((t) => t.status === "correction_needed");
  if (returned) {
    nudges.push({
      type: "qa_return",
      message: COPY.qa_return[persona]({ task: returned.title }),
      href: `/work/${returned.id}`,
      actionLabel: "Fix corrections",
    });
  }

  return nudges;
}
