"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { canViewerSeeUser } from "@/lib/auth/team-scope";
import { initFlowStore, getFlowStore } from "@/lib/data/flow-store";
import { getWorkPackages } from "@/lib/data/work-packages";
import { hydrateWorkloadAlertSettings, updateWorkloadAlertSettings, getWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";
import { writeWorkloadAlertSettingsCookie } from "@/lib/workload-alerts/settings-persistence";
import { updateWorkloadAlertStatus } from "@/lib/workload-alerts/store";
import { listWorkloadAlertRecords } from "@/lib/workload-alerts/store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { WorkloadAlertSettings } from "@/types/flow";

const PATHS = [
  "/settings",
  "/settings/workload-alerts",
  "/executive",
  "/operations",
  "/people",
  "/reports",
];

export async function getWorkloadAlertSettingsAction(): Promise<WorkloadAlertSettings> {
  await hydrateWorkloadAlertSettings();
  return getWorkloadAlertSettings();
}

export async function updateWorkloadAlertSettingsAction(input: {
  enabled: boolean;
  work_remaining_threshold_hours: number;
  snooze_duration_hours: number;
  department_ids: string[];
  team_ids: string[];
}) {
  const user = await requirePermission("settings:manage");
  await hydrateWorkloadAlertSettings();

  const settings = updateWorkloadAlertSettings(
    {
      enabled: input.enabled,
      work_remaining_threshold_hours: input.work_remaining_threshold_hours,
      snooze_duration_hours: input.snooze_duration_hours,
      department_ids: input.department_ids,
      team_ids: input.team_ids,
    },
    user.id
  );

  if (!isSupabaseConfigured()) {
    await writeWorkloadAlertSettingsCookie(settings);
  }

  PATHS.forEach((p) => revalidatePath(p));
  return settings;
}

function assertCanManageAlert(alertId: string, userId: string, role: string) {
  initFlowStore();
  const store = getFlowStore();
  const alert = listWorkloadAlertRecords().find((a) => a.id === alertId);
  if (!alert) throw new Error("Alert not found");

  const user = store.users.find((u) => u.id === userId);
  if (!user) throw new Error("User not found");

  if (role === "admin" || role === "super_admin") return alert;
  if (canViewerSeeUser(user, alert.employee_id, store.users, store.teams)) return alert;
  throw new Error("Not authorized");
}

export async function snoozeWorkloadAlertAction(alertId: string) {
  const user = await requireUser();
  if (!["admin", "super_admin", "senior_manager", "manager", "teamlead"].includes(user.role)) {
    throw new Error("Not authorized");
  }
  await hydrateWorkloadAlertSettings();
  const settings = getWorkloadAlertSettings();
  assertCanManageAlert(alertId, user.id, user.role);

  const until = new Date(
    Date.now() + settings.snooze_duration_hours * 60 * 60 * 1000
  ).toISOString();

  updateWorkloadAlertStatus(alertId, "snoozed", { snoozed_until: until });
  PATHS.forEach((p) => revalidatePath(p));
}

export async function dismissWorkloadAlertAction(alertId: string) {
  const user = await requireUser();
  if (!["admin", "super_admin", "senior_manager", "manager", "teamlead"].includes(user.role)) {
    throw new Error("Not authorized");
  }
  assertCanManageAlert(alertId, user.id, user.role);
  const now = new Date().toISOString();
  updateWorkloadAlertStatus(alertId, "dismissed", {
    dismissed_by: user.id,
    dismissed_at: now,
  });
  PATHS.forEach((p) => revalidatePath(p));
}

export async function reviewWorkloadAlertAction(alertId: string) {
  const user = await requireUser();
  if (!["admin", "super_admin", "senior_manager", "manager", "teamlead"].includes(user.role)) {
    throw new Error("Not authorized");
  }
  assertCanManageAlert(alertId, user.id, user.role);
  const now = new Date().toISOString();
  updateWorkloadAlertStatus(alertId, "reviewed", {
    reviewed_by: user.id,
    reviewed_at: now,
  });
  PATHS.forEach((p) => revalidatePath(p));
}
