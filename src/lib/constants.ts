import type { QaResult, UserRole, WorkPriority, WorkStatus, PayType } from "@/types/flow";

export const APP_NAME = "Flow";

export const PROJECT_TYPES = [
  { value: "board", label: "Operations Board" },
  { value: "special_functions", label: "Special Functions" },
  { value: "adas", label: "ADAS" },
  { value: "si_corrections", label: "SI Corrections" },
  { value: "research", label: "Research" },
  { value: "custom", label: "Custom" },
];

export const PROJECT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "senior_manager", label: "Senior Manager" },
  { value: "manager", label: "Manager" },
  { value: "teamlead", label: "Team Lead" },
  { value: "employee", label: "Employee" },
  { value: "viewer", label: "Viewer" },
];

export const PAY_TYPES: { value: PayType; label: string; description: string }[] = [
  {
    value: "hourly",
    label: "Hourly",
    description: "Shift clock required — track punches and shift time",
  },
  {
    value: "salary",
    label: "Salary",
    description: "Exempt from shift clock — productivity tracked via tasks",
  },
];

export const WORK_STATUSES: {
  value: WorkStatus;
  label: string;
  color: string;
  dot: string;
}[] = [
  {
    value: "not_started",
    label: "Not Started",
    color: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
    dot: "bg-slate-400",
  },
  {
    value: "assigned",
    label: "Assigned",
    color: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    dot: "bg-blue-400",
  },
  {
    value: "working_on_it",
    label: "In Progress",
    color: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
    dot: "bg-sky-400",
  },
  {
    value: "waiting",
    label: "Waiting",
    color: "bg-slate-500/8 text-slate-500 border border-slate-500/15",
    dot: "bg-slate-500",
  },
  {
    value: "ready_for_qa",
    label: "Submitted for Review",
    color: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
    dot: "bg-indigo-400",
  },
  {
    value: "in_qa",
    label: "In QA",
    color: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
    dot: "bg-indigo-400",
  },
  {
    value: "correction_needed",
    label: "Needs Correction",
    color: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    dot: "bg-amber-400",
  },
  {
    value: "stuck",
    label: "Blocked",
    color: "bg-red-500/10 text-red-400 border border-red-500/20",
    dot: "bg-red-400",
  },
  {
    value: "done",
    label: "Approved",
    color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    dot: "bg-emerald-400",
  },
];

export const WORK_PRIORITIES: { value: WorkPriority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "text-slate-400" },
  { value: "medium", label: "Medium", color: "text-slate-300" },
  { value: "high", label: "High", color: "text-amber-400" },
  { value: "urgent", label: "Urgent", color: "text-red-400" },
];

export type EmployeeClockStatus = "on_shift" | "on_lunch" | "off_shift";

export const CLOCK_STATUS_STYLES: Record<
  EmployeeClockStatus,
  { label: string; color: string; dot: string }
> = {
  on_shift: {
    label: "Clocked In",
    color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  on_lunch: {
    label: "On Lunch",
    color: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    dot: "bg-amber-400",
  },
  off_shift: {
    label: "Clocked Out",
    color: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
    dot: "bg-slate-500",
  },
};

export const QA_RESULTS: { value: QaResult; label: string }[] = [
  { value: "pass", label: "Pass" },
  { value: "minor_correction", label: "Minor Correction" },
  { value: "major_correction", label: "Major Correction" },
  { value: "rejected", label: "Rejected" },
];

export const ERROR_CATEGORIES = [
  "Data accuracy",
  "Formatting",
  "Missing information",
  "Calculation error",
  "Compliance",
  "Other",
];

export function statusLabel(status: WorkStatus): string {
  return WORK_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function statusColor(status: WorkStatus): string {
  return WORK_STATUSES.find((s) => s.value === status)?.color ?? "bg-muted text-muted-foreground";
}

export function statusDotColor(status: WorkStatus): string {
  return WORK_STATUSES.find((s) => s.value === status)?.dot ?? "bg-muted-foreground";
}

export function priorityLabel(priority: WorkPriority): string {
  return WORK_PRIORITIES.find((p) => p.value === priority)?.label ?? priority;
}

export const QA_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "passed", label: "Passed" },
  { value: "minor_correction", label: "Minor correction" },
  { value: "major_correction", label: "Major correction" },
  { value: "rejected", label: "Rejected" },
] as const;

export function qaStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Pending",
    passed: "Passed",
    minor_correction: "Minor",
    major_correction: "Major",
    rejected: "Rejected",
  };
  return map[status] ?? status;
}

export function roleLabel(role: UserRole | string): string {
  const normalized = role === "qa" ? "teamlead" : role;
  return USER_ROLES.find((r) => r.value === normalized)?.label ?? String(role);
}

export function payTypeLabelConstant(payType: PayType | null | undefined): string {
  return PAY_TYPES.find((p) => p.value === payType)?.label ?? "Hourly";
}
