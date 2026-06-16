"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { isEmployeeRole } from "@/lib/auth/permissions";
import { canViewerSeeUser } from "@/lib/auth/team-scope";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getWorkPackages } from "@/lib/data/work-packages";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import {
  acknowledgeHelpFlag,
  dismissHelpFlag,
  getHelpFlagView,
  listEmployeeHelpFlags,
  listHelpFlagsForViewer,
  markHelpFlagInProgress,
  raiseHelpFlag,
  resolveHelpFlag,
} from "@/lib/help-flags/engine";
import { getHelpFlagById } from "@/lib/help-flags/store";
import type { HelpFlagReason } from "@/types/flow";

const PATHS = [
  "/work",
  "/operations",
  "/executive",
  "/people",
  "/reports",
  "/wrap-ups",
];

function revalidateAll() {
  PATHS.forEach((p) => revalidatePath(p));
}

function assertCanRespond(flagId: string, userId: string, role: string) {
  initFlowStore();
  const store = getFlowStore();
  const flag = getHelpFlagById(flagId);
  if (!flag) throw new Error("Help request not found");

  const user = store.users.find((u) => u.id === userId);
  if (!user) throw new Error("User not found");

  const employee = store.users.find((u) => u.id === flag.employee_id);
  if (!employee) throw new Error("Employee not found");

  if (role === "admin" || role === "super_admin") return { flag, user, employee };
  if (canViewerSeeUser(user, flag.employee_id, store.users, store.teams)) {
    return { flag, user, employee };
  }
  throw new Error("Not authorized");
}

function requireEmployeeUser() {
  return requireUser().then((user) => {
    if (!isEmployeeRole(user.role)) throw new Error("FORBIDDEN");
    return user;
  });
}

export async function raiseHelpFlagAction(input: {
  reason: HelpFlagReason;
  notes?: string;
  taskId?: string;
  source: "task" | "dashboard" | "timer" | "wrap_up";
  wrapUpId?: string;
}) {
  const user = await requireEmployeeUser();
  await hydrateHelpFlagSettings();
  initFlowStore();
  const store = getFlowStore();

  const task = input.taskId
    ? store.workPackages.find((p) => p.id === input.taskId && p.assigned_to === user.id)
    : null;

  if (input.taskId && !task) {
    return { ok: false as const, error: "Task not found or not assigned to you." };
  }

  const record = raiseHelpFlag({
    employee: user,
    reason: input.reason,
    notes: input.notes,
    source: input.source,
    task: task ?? null,
    wrapUpId: input.wrapUpId ?? null,
  });

  revalidateAll();
  return { ok: true as const, id: record.id };
}

export async function acknowledgeHelpFlagAction(flagId: string, note?: string) {
  const user = await requireUser();
  if (!["admin", "manager", "teamlead"].includes(user.role)) {
    throw new Error("Not authorized");
  }
  assertCanRespond(flagId, user.id, user.role);
  acknowledgeHelpFlag(flagId, user, note);
  revalidateAll();
}

export async function markHelpFlagInProgressAction(flagId: string, note?: string) {
  const user = await requireUser();
  if (!["admin", "manager", "teamlead"].includes(user.role)) {
    throw new Error("Not authorized");
  }
  assertCanRespond(flagId, user.id, user.role);
  markHelpFlagInProgress(flagId, user, note);
  revalidateAll();
}

export async function resolveHelpFlagAction(
  flagId: string,
  resolutionNotes?: string
) {
  const user = await requireUser();
  if (!["admin", "manager", "teamlead"].includes(user.role)) {
    throw new Error("Not authorized");
  }
  assertCanRespond(flagId, user.id, user.role);
  resolveHelpFlag(flagId, user, resolutionNotes);
  revalidateAll();
}

export async function dismissHelpFlagAction(flagId: string, reason?: string) {
  const user = await requireUser();
  if (!["admin", "manager", "teamlead"].includes(user.role)) {
    throw new Error("Not authorized");
  }
  assertCanRespond(flagId, user.id, user.role);
  dismissHelpFlag(flagId, user, reason);
  revalidateAll();
}

export async function getMyHelpFlagsAction() {
  const user = await requireUser();
  await hydrateHelpFlagSettings();
  initFlowStore();
  const store = getFlowStore();
  const packages = await getWorkPackages();
  return listEmployeeHelpFlags(user.id, packages, store.users);
}

export async function getHelpFlagsForViewerAction() {
  const user = await requireUser();
  if (!["admin", "manager", "teamlead"].includes(user.role)) {
    return [];
  }
  await hydrateHelpFlagSettings();
  initFlowStore();
  const store = getFlowStore();
  const packages = await getWorkPackages();
  return listHelpFlagsForViewer(user, packages, store.users);
}
