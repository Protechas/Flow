export const ACTIVE_TIMER_KEY = "flow_active_timer";

export interface ActiveTimerState {
  packageId: string;
  startedAt: number;
  pausedAt: number | null;
  accumulatedMs: number;
}

export function readActiveTimer(): ActiveTimerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_TIMER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveTimerState;
  } catch {
    return null;
  }
}

export function writeActiveTimer(state: ActiveTimerState | null) {
  if (typeof window === "undefined") return;
  if (!state) {
    localStorage.removeItem(ACTIVE_TIMER_KEY);
    return;
  }
  localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify(state));
}

export function elapsedMs(state: ActiveTimerState, now = Date.now()): number {
  let total = state.accumulatedMs;
  if (state.pausedAt === null) {
    total += now - state.startedAt;
  }
  return total;
}

export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function msToHours(ms: number): number {
  return Math.round((ms / 3600000) * 100) / 100;
}

export function startTimer(packageId: string): ActiveTimerState {
  const state: ActiveTimerState = {
    packageId,
    startedAt: Date.now(),
    pausedAt: null,
    accumulatedMs: 0,
  };
  writeActiveTimer(state);
  return state;
}

export function pauseTimer(state: ActiveTimerState): ActiveTimerState {
  if (state.pausedAt !== null) return state;
  const next: ActiveTimerState = {
    ...state,
    accumulatedMs: elapsedMs(state),
    pausedAt: Date.now(),
    startedAt: Date.now(),
  };
  writeActiveTimer(next);
  return next;
}

export function resumeTimer(state: ActiveTimerState): ActiveTimerState {
  if (state.pausedAt === null) return state;
  const next: ActiveTimerState = {
    ...state,
    pausedAt: null,
    startedAt: Date.now(),
  };
  writeActiveTimer(next);
  return next;
}

export function clearTimer() {
  writeActiveTimer(null);
}
