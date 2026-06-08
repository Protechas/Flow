"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type ActiveTimerState,
  clearTimer,
  elapsedMs,
  formatElapsed,
  msToHours,
  pauseTimer,
  readActiveTimer,
  resumeTimer,
  startTimer,
  writeActiveTimer,
} from "@/lib/employee/timer";

export function useTaskTimer(packageId: string, autostart?: boolean) {
  const [timer, setTimer] = useState<ActiveTimerState | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const stored = readActiveTimer();
    if (stored?.packageId === packageId) {
      setTimer(stored);
    } else if (autostart) {
      const next = startTimer(packageId);
      setTimer(next);
    }
  }, [packageId, autostart]);

  useEffect(() => {
    if (!timer || timer.pausedAt !== null) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const display = timer ? formatElapsed(elapsedMs(timer)) : "00:00:00";
  const running = timer !== null && timer.pausedAt === null;

  const handleStart = useCallback(() => {
    const next = startTimer(packageId);
    setTimer(next);
  }, [packageId]);

  const handlePause = useCallback(() => {
    if (!timer) return null;
    const next = pauseTimer(timer);
    setTimer(next);
    return msToHours(elapsedMs(next));
  }, [timer]);

  const handleResume = useCallback(() => {
    if (!timer) {
      handleStart();
      return;
    }
    const next = resumeTimer(timer);
    setTimer(next);
  }, [timer, handleStart]);

  const handleStop = useCallback(() => {
    if (!timer) return 0;
    const hours = msToHours(elapsedMs(timer));
    clearTimer();
    setTimer(null);
    return hours;
  }, [timer]);

  const switchPackage = useCallback((newId: string) => {
    const next = startTimer(newId);
    setTimer(next);
    return next;
  }, []);

  return {
    display,
    running,
    paused: timer !== null && timer.pausedAt !== null,
    hasTimer: timer !== null,
    handleStart,
    handlePause,
    handleResume,
    handleStop,
    switchPackage,
    setTimer: (s: ActiveTimerState | null) => {
      writeActiveTimer(s);
      setTimer(s);
    },
    tick,
  };
}
