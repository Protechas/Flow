import { hasPermission } from "@/lib/auth/permissions";
import { getVisibleUserIds, isHierarchyOrgWide } from "@/lib/hierarchy/resolver";
import { getDepartmentName, getUserPrimaryDepartmentId } from "@/lib/departments/resolve";
import { getFlowStore, getDailyWrapUpById, initFlowStore } from "@/lib/data/flow-store";
import {
  getActiveClockEntry,
  getClockEntriesForUser,
  getShiftMinutesToday,
} from "@/lib/data/production-tracking";
import { getWrapUpComplianceStatus } from "@/lib/wrap-up/compliance";
import { requiresShiftClock } from "@/lib/users/pay-type";
import type {
  DailyWrapUp,
  User,
  WrapUpClockOutStatus,
  WrapUpComplianceStatus,
  WrapUpReviewDashboardStats,
  WrapUpReviewDetail,
  WrapUpReviewFilters,
  WrapUpReviewRow,
  WorkPackage,
} from "@/types/flow";
import { format, isWithinInterval, parseISO, subDays } from "date-fns";

function previewText(text: string | null | undefined, max = 80): string | null {
  if (!text?.trim()) return null;
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function getClockEntriesForDate(userId: string, wrapDate: string) {
  return getClockEntriesForUser(userId, 30).filter((e) => e.clock_in_at.startsWith(wrapDate));
}

function getClockOutStatus(userId: string, wrapDate: string): {
  status: WrapUpClockOutStatus;
  clockOutAt: string | null;
} {
  const dayEntries = getClockEntriesForDate(userId, wrapDate);
  const endOfDayOut = dayEntries
    .filter((e) => e.clock_out_type === "out" && e.clock_out_at)
    .sort((a, b) => b.clock_out_at!.localeCompare(a.clock_out_at!))[0];

  if (endOfDayOut) {
    return { status: "clocked_out", clockOutAt: endOfDayOut.clock_out_at };
  }
  const isToday = wrapDate === format(new Date(), "yyyy-MM-dd");
  if (isToday && getActiveClockEntry(userId)) {
    return { status: "on_shift", clockOutAt: null };
  }
  return { status: "not_clocked", clockOutAt: null };
}

/** Employees whose wrap-ups the viewer may access. */
export function getWrapUpVisibleUserIds(viewer: User): string[] | null {
  initFlowStore();
  const store = getFlowStore();

  if (isHierarchyOrgWide(viewer)) {
    return null;
  }

  return getVisibleUserIds(viewer, store.users, store.teams);
}

export function canViewWrapUp(viewer: User, wrapUp: DailyWrapUp): boolean {
  if (viewer.id === wrapUp.user_id && hasPermission(viewer.role, "people:view_own")) {
    return true;
  }
  const visible = getWrapUpVisibleUserIds(viewer);
  if (visible === null) return hasPermission(viewer.role, "work:view_all") || hasPermission(viewer.role, "people:view_team");
  return visible.includes(wrapUp.user_id);
}

function buildRowFromWrapUp(wrapUp: DailyWrapUp): WrapUpReviewRow {
  initFlowStore();
  const store = getFlowStore();
  const user = store.users.find((u) => u.id === wrapUp.user_id);
  const team = user?.team_id ? store.teams.find((t) => t.id === user.team_id) : null;
  const deptId = wrapUp.department_id ?? getUserPrimaryDepartmentId(wrapUp.user_id);
  const { status: clockOutStatus, clockOutAt } = getClockOutStatus(wrapUp.user_id, wrapUp.wrap_date);
  const wrapUpStatus = getWrapUpComplianceStatus(wrapUp.user_id, wrapUp.wrap_date);
  const reviewer = wrapUp.reviewed_by
    ? store.users.find((u) => u.id === wrapUp.reviewed_by)
    : null;

  return {
    id: wrapUp.id,
    userId: wrapUp.user_id,
    employeeName: user?.full_name ?? wrapUp.user_id,
    departmentId: deptId,
    departmentName: getDepartmentName(deptId),
    teamId: user?.team_id ?? null,
    teamName: team?.name ?? null,
    wrapDate: wrapUp.wrap_date,
    submittedAt: wrapUp.created_at,
    clockOutStatus,
    clockOutAt,
    wrapUpStatus,
    blockersPreview: previewText(wrapUp.blockers),
    notesPreview: previewText(wrapUp.completed_summary),
    hasBlockers: !!(wrapUp.blockers?.trim() || wrapUp.needs_support),
    needsSupport: wrapUp.needs_support,
    reviewed: !!wrapUp.reviewed_at,
    reviewedByName: reviewer?.full_name ?? null,
    reviewedAt: wrapUp.reviewed_at,
    followUpNeeded: wrapUp.follow_up_needed,
  };
}

function buildMissingRow(user: User, wrapDate: string): WrapUpReviewRow {
  initFlowStore();
  const store = getFlowStore();
  const team = user.team_id ? store.teams.find((t) => t.id === user.team_id) : null;
  const deptId = getUserPrimaryDepartmentId(user.id);
  const { status: clockOutStatus, clockOutAt } = getClockOutStatus(user.id, wrapDate);
  const wrapUpStatus = getWrapUpComplianceStatus(user.id, wrapDate);

  return {
    id: `missing-${user.id}-${wrapDate}`,
    userId: user.id,
    employeeName: user.full_name,
    departmentId: deptId,
    departmentName: getDepartmentName(deptId),
    teamId: user.team_id ?? null,
    teamName: team?.name ?? null,
    wrapDate,
    submittedAt: null,
    clockOutStatus,
    clockOutAt,
    wrapUpStatus,
    blockersPreview: null,
    notesPreview: null,
    hasBlockers: false,
    needsSupport: false,
    reviewed: false,
    reviewedByName: null,
    reviewedAt: null,
    followUpNeeded: false,
  };
}

export function buildWrapUpReviewRows(
  viewer: User,
  filters: WrapUpReviewFilters = {}
): WrapUpReviewRow[] {
  initFlowStore();
  const store = getFlowStore();
  const visibleIds = getWrapUpVisibleUserIds(viewer);
  const start = filters.startDate ? parseISO(filters.startDate) : subDays(new Date(), 14);
  const end = filters.endDate ? parseISO(filters.endDate) : new Date();

  let wrapUps = store.dailyWrapUps.filter((w) => {
    const d = parseISO(w.wrap_date);
    if (!isWithinInterval(d, { start, end })) return false;
    if (visibleIds && !visibleIds.includes(w.user_id)) return false;
    return true;
  });

  const rows: WrapUpReviewRow[] = wrapUps.map(buildRowFromWrapUp);

  if (!filters.status || filters.status === "all" || filters.status === "missing") {
    const employees = store.users.filter((u) => {
      if (!u.is_active || u.role !== "employee") return false;
      if (!requiresShiftClock(u)) return false;
      if (visibleIds && !visibleIds.includes(u.id)) return false;
      if (filters.userId && u.id !== filters.userId) return false;
      if (filters.teamId && u.team_id !== filters.teamId) return false;
      if (filters.departmentId && getUserPrimaryDepartmentId(u.id) !== filters.departmentId) return false;
      return true;
    });

    for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) {
      const dateStr = format(d, "yyyy-MM-dd");
      for (const emp of employees) {
        const status = getWrapUpComplianceStatus(emp.id, dateStr);
        if (status === "missing" && (!filters.status || filters.status === "all" || filters.status === "missing")) {
          if (!rows.some((r) => r.userId === emp.id && r.wrapDate === dateStr)) {
            rows.push(buildMissingRow(emp, dateStr));
          }
        }
      }
    }
  }

  return rows
    .filter((r) => {
      if (filters.userId && r.userId !== filters.userId) return false;
      if (filters.departmentId && r.departmentId !== filters.departmentId) return false;
      if (filters.teamId && r.teamId !== filters.teamId) return false;
      if (filters.status && filters.status !== "all" && r.wrapUpStatus !== filters.status) return false;
      if (filters.reviewed === "reviewed" && !r.reviewed) return false;
      if (filters.reviewed === "unreviewed" && (r.reviewed || r.wrapUpStatus !== "submitted")) return false;
      if (filters.followUpNeeded && !r.followUpNeeded) return false;
      return true;
    })
    .sort((a, b) => {
      const dateCmp = b.wrapDate.localeCompare(a.wrapDate);
      if (dateCmp !== 0) return dateCmp;
      return a.employeeName.localeCompare(b.employeeName);
    });
}

export function getWrapUpReviewDetail(
  wrapUpId: string,
  viewer: User
): WrapUpReviewDetail | null {
  initFlowStore();
  const wrapUp = getDailyWrapUpById(wrapUpId);
  if (!wrapUp || !canViewWrapUp(viewer, wrapUp)) return null;

  const store = getFlowStore();
  const user = store.users.find((u) => u.id === wrapUp.user_id);
  const team = user?.team_id ? store.teams.find((t) => t.id === user.team_id) : null;
  const reviewer = wrapUp.reviewed_by
    ? store.users.find((u) => u.id === wrapUp.reviewed_by)
    : null;
  const { status: clockOutStatus, clockOutAt } = getClockOutStatus(wrapUp.user_id, wrapUp.wrap_date);

  const tasksCompleted: WorkPackage[] = store.workPackages.filter(
    (p) =>
      p.assigned_to === wrapUp.user_id &&
      p.completed_date === wrapUp.wrap_date &&
      p.status === "done"
  );

  const clockEntries = getClockEntriesForDate(wrapUp.user_id, wrapUp.wrap_date);

  return {
    wrapUp,
    employeeName: user?.full_name ?? wrapUp.user_id,
    departmentName: getDepartmentName(wrapUp.department_id ?? getUserPrimaryDepartmentId(wrapUp.user_id)),
    teamName: team?.name ?? null,
    reviewedByName: reviewer?.full_name ?? null,
    wrapUpStatus: getWrapUpComplianceStatus(wrapUp.user_id, wrapUp.wrap_date),
    clockOutStatus,
    clockOutAt,
    shiftMinutesToday:
      wrapUp.wrap_date === format(new Date(), "yyyy-MM-dd")
        ? getShiftMinutesToday(wrapUp.user_id)
        : clockEntries.reduce((s, e) => s + (e.total_minutes ?? 0), 0),
    clockEntries,
    tasksCompleted,
  };
}

export function getWrapUpDashboardStats(viewer: User): WrapUpReviewDashboardStats {
  const today = format(new Date(), "yyyy-MM-dd");
  const rows = buildWrapUpReviewRows(viewer, {
    startDate: today,
    endDate: today,
  });

  const submitted = rows.filter((r) => r.wrapUpStatus === "submitted");
  const missing = rows.filter((r) => r.wrapUpStatus === "missing");

  const allRecent = buildWrapUpReviewRows(viewer, {
    startDate: format(subDays(new Date(), 7), "yyyy-MM-dd"),
    endDate: today,
  });

  return {
    submittedToday: submitted.length,
    missingToday: missing.length,
    unreviewed: allRecent.filter((r) => r.wrapUpStatus === "submitted" && !r.reviewed).length,
    withBlockers: allRecent.filter((r) => r.hasBlockers && r.wrapUpStatus === "submitted").length,
    followUpsNeeded: allRecent.filter((r) => r.followUpNeeded).length,
  };
}

