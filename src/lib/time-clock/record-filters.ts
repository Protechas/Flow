import { appTodayDate, formatAppCalendarDate } from "@/lib/datetime/timezone";
import type { TimeClockEntry } from "@/types/flow";
import { format, parseISO, subDays } from "date-fns";

export interface ClockRecordDateRange {
  from: string;
  to: string;
}

export const MAX_CLOCK_RECORD_RANGE_DAYS = 90;

export function defaultClockRecordDateRange(): ClockRecordDateRange {
  const to = appTodayDate();
  const from = format(subDays(parseISO(`${to}T12:00:00`), 13), "yyyy-MM-dd");
  return { from, to };
}

export function clockRecordRangeForPreset(days: number): ClockRecordDateRange {
  const to = appTodayDate();
  const from = format(subDays(parseISO(`${to}T12:00:00`), Math.max(days - 1, 0)), "yyyy-MM-dd");
  return { from, to };
}

export function parseClockRecordDateRange(params: {
  from?: string;
  to?: string;
}): ClockRecordDateRange {
  const defaults = defaultClockRecordDateRange();
  const from = params.from?.trim() || defaults.from;
  const to = params.to?.trim() || defaults.to;
  return normalizeClockRecordDateRange({ from, to });
}

export function normalizeClockRecordDateRange(range: ClockRecordDateRange): ClockRecordDateRange {
  let { from, to } = range;
  if (from > to) [from, to] = [to, from];

  const today = appTodayDate();
  if (to > today) to = today;

  const maxFrom = format(
    subDays(parseISO(`${to}T12:00:00`), MAX_CLOCK_RECORD_RANGE_DAYS - 1),
    "yyyy-MM-dd"
  );
  if (from < maxFrom) from = maxFrom;

  return { from, to };
}

export function buildTimeClockRecordsHref(
  pathname: string,
  range: ClockRecordDateRange,
  employeeId?: string
): string {
  const defaults = defaultClockRecordDateRange();
  const params = new URLSearchParams();
  if (employeeId) params.set("employee", employeeId);
  if (range.from !== defaults.from) params.set("from", range.from);
  if (range.to !== defaults.to) params.set("to", range.to);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function isDefaultClockRecordDateRange(range: ClockRecordDateRange): boolean {
  const defaults = defaultClockRecordDateRange();
  return range.from === defaults.from && range.to === defaults.to;
}

export function filterClockEntriesByDateRange(
  entries: TimeClockEntry[],
  range: ClockRecordDateRange
): TimeClockEntry[] {
  const { from, to } = normalizeClockRecordDateRange(range);
  return entries.filter((entry) => {
    const day = formatAppCalendarDate(entry.clock_in_at);
    return day >= from && day <= to;
  });
}

export function filterClockEntriesByEmployee(
  entries: TimeClockEntry[],
  userId: string
): TimeClockEntry[] {
  if (userId === "all") return entries;
  return entries.filter((e) => e.user_id === userId);
}
