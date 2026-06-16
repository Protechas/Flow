import type { TimeClockEntry, TimeClockOutType } from "@/types/flow";

export const CLOCK_OUT_LABELS: Record<TimeClockOutType, string> = {
  lunch: "Lunch",
  out: "Out",
};

export function clockOutTypeLabel(type: TimeClockOutType | null | undefined): string {
  if (!type) return "—";
  return CLOCK_OUT_LABELS[type];
}

export function getEmployeeClockStatus(
  activeEntry: TimeClockEntry | null,
  todayEntries: TimeClockEntry[]
): "on_shift" | "on_lunch" | "off_shift" {
  if (activeEntry) return "on_shift";

  const completedToday = todayEntries
    .filter((e) => e.status !== "active" && e.clock_out_at)
    .sort((a, b) => b.clock_out_at!.localeCompare(a.clock_out_at!));

  const last = completedToday[0];
  if (last?.clock_out_type === "lunch") return "on_lunch";

  return "off_shift";
}

export function clockStatusLabel(
  activeEntry: TimeClockEntry | null,
  todayEntries: TimeClockEntry[]
): string {
  const status = getEmployeeClockStatus(activeEntry, todayEntries);
  switch (status) {
    case "on_shift":
      return "Clocked in";
    case "on_lunch":
      return "On lunch break";
    default:
      return "Not clocked in";
  }
}
