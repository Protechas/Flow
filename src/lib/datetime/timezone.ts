/**
 * Organization timezone for shift clocks, wrap-ups, and "today" boundaries.
 * Production runs on UTC (Vercel); always format and bucket dates in app TZ.
 *
 * Set NEXT_PUBLIC_FLOW_TIMEZONE (e.g. America/Chicago) in production.
 */
const DEFAULT_TIME_ZONE = "America/Chicago";

export function getAppTimeZone(): string {
  return (
    process.env.NEXT_PUBLIC_FLOW_TIMEZONE ??
    process.env.FLOW_TIMEZONE ??
    DEFAULT_TIME_ZONE
  );
}

/** yyyy-MM-dd in the organization timezone. */
export function appTodayDate(now = new Date()): string {
  return formatAppCalendarDate(now);
}

/** yyyy-MM-dd for an instant in the organization timezone. */
export function formatAppCalendarDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: getAppTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function isAppCalendarDay(iso: string, day = appTodayDate()): boolean {
  return formatAppCalendarDate(iso) === day;
}

/** Day of week (0=Sun … 6=Sat) in the organization timezone. */
export function appDayOfWeek(now = new Date()): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: getAppTimeZone(),
    weekday: "short",
  }).format(now);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

/** Current hour (0–23) in the organization timezone. */
export function appCurrentHour(now = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: getAppTimeZone(),
    hour: "numeric",
    hour12: false,
  }).format(now);
  return Number(hour) % 24;
}

/** Time-of-day greeting in the organization timezone. */
export function appGreeting(now = new Date()): string {
  const hour = appCurrentHour(now);
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function formatAppTime(
  iso: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: getAppTimeZone(),
    hour: "numeric",
    minute: "2-digit",
    ...options,
  }).format(new Date(iso));
}

export function formatAppDateTime(
  iso: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: getAppTimeZone(),
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...options,
  }).format(new Date(iso));
}

export function formatAppDateTimeFull(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: getAppTimeZone(),
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** Value for `<input type="datetime-local" />` in organization timezone. */
export function toAppDatetimeLocalValue(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: getAppTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Parse datetime-local input as organization local time → UTC ISO. */
export function appDatetimeLocalToIso(local: string): string {
  const tz = getAppTimeZone();
  const asUtc = new Date(`${local}:00Z`);
  const utcParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(asUtc);
  const appParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(asUtc);

  const read = (parts: Intl.DateTimeFormatPart[]) => ({
    y: Number(parts.find((p) => p.type === "year")?.value),
    mo: Number(parts.find((p) => p.type === "month")?.value),
    d: Number(parts.find((p) => p.type === "day")?.value),
    h: Number(parts.find((p) => p.type === "hour")?.value),
    mi: Number(parts.find((p) => p.type === "minute")?.value),
    s: Number(parts.find((p) => p.type === "second")?.value),
  });

  const u = read(utcParts);
  const a = read(appParts);
  const utcMs = Date.UTC(u.y, u.mo - 1, u.d, u.h, u.mi, u.s);
  const appMs = Date.UTC(a.y, a.mo - 1, a.d, a.h, a.mi, a.s);
  const offsetMs = appMs - utcMs;
  const [date, time] = local.split("T");
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi, 0) - offsetMs).toISOString();
}
