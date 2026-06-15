import type { QaResult, UserRole, WorkPriority, WorkStatus } from "@/types/flow";

export const APP_NAME = "Flow";

export const NAV_ITEMS = [
  { href: "/executive", label: "Executive", icon: "LayoutDashboard" },
  { href: "/operations", label: "Operations Board", icon: "Kanban" },
  { href: "/projects", label: "Projects", icon: "FolderKanban" },
  { href: "/people", label: "People", icon: "Users" },
  { href: "/project-health", label: "Project Health", icon: "Activity" },
  { href: "/qa-center", label: "QA Center", icon: "ShieldCheck" },
  { href: "/reports", label: "Reports", icon: "BarChart3" },
  { href: "/settings", label: "Settings", icon: "Settings" },
] as const;

export const PROJECT_TYPES = [
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
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "qa", label: "QA" },
  { value: "employee", label: "Employee" },
  { value: "viewer", label: "Viewer" },
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
    color: "bg-slate-500/20 text-slate-300 border border-slate-500/30",
    dot: "bg-slate-400",
  },
  {
    value: "assigned",
    label: "Assigned",
    color: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    dot: "bg-blue-400",
  },
  {
    value: "working_on_it",
    label: "In Progress",
    color: "bg-sky-500/20 text-sky-300 border border-sky-500/30",
    dot: "bg-sky-400",
  },
  {
    value: "waiting",
    label: "Waiting",
    color: "bg-slate-500/15 text-slate-400 border border-slate-500/25",
    dot: "bg-slate-500",
  },
  {
    value: "ready_for_qa",
    label: "Ready For QA",
    color: "bg-violet-500/20 text-violet-300 border border-violet-500/30",
    dot: "bg-violet-400",
  },
  {
    value: "in_qa",
    label: "In QA",
    color: "bg-violet-500/20 text-violet-300 border border-violet-500/30",
    dot: "bg-violet-400",
  },
  {
    value: "correction_needed",
    label: "Correction Required",
    color: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    dot: "bg-amber-400",
  },
  {
    value: "stuck",
    label: "Blocked",
    color: "bg-red-500/20 text-red-300 border border-red-500/30",
    dot: "bg-red-400",
  },
  {
    value: "done",
    label: "Completed",
    color: "bg-green-500/20 text-green-300 border border-green-500/30",
    dot: "bg-green-400",
  },
];

export const WORK_PRIORITIES: { value: WorkPriority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "text-slate-400" },
  { value: "medium", label: "Medium", color: "text-blue-400" },
  { value: "high", label: "High", color: "text-amber-400" },
  { value: "urgent", label: "Urgent", color: "text-red-400" },
];

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
