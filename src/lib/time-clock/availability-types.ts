import type { EmployeeClockStatus } from "@/lib/constants";
import type { PayType, WrapUpComplianceStatus } from "@/types/flow";

export type TeamMemberAvailability = {
  userId: string;
  name: string;
  payType: PayType;
  requiresShiftClock: boolean;
  wrapUpStatus?: WrapUpComplianceStatus;
  status: EmployeeClockStatus | "exempt";
  statusLabel: string;
  since: string | null;
  shiftMinutesToday: number;
  taskMinutesToday: number;
  lastPunchAt: string | null;
  activeTaskTitle: string | null;
};

export function summarizeTeamAvailability(members: TeamMemberAvailability[]) {
  const hourly = members.filter((m) => m.requiresShiftClock);
  const salary = members.filter((m) => !m.requiresShiftClock);
  const totalMinutes = members.reduce(
    (s, m) => s + (m.requiresShiftClock ? m.shiftMinutesToday : m.taskMinutesToday),
    0
  );
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const totalHoursLabel = hours > 0 ? `${hours}h ${mins}m` : mins > 0 ? `${mins}m` : "0m";

  return {
    total: members.length,
    hourlyCount: hourly.length,
    salaryCount: salary.length,
    onShift: hourly.filter((m) => m.status === "on_shift").length,
    onLunch: hourly.filter((m) => m.status === "on_lunch").length,
    offShift: hourly.filter((m) => m.status === "off_shift").length,
    onTask: salary.filter((m) => m.status === "on_shift").length,
    totalMinutesToday: totalMinutes,
    totalHoursLabel,
  };
}
