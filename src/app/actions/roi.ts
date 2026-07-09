"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import {
  getRoiSettings,
  updateRoiSettings,
  type RoiSettings,
} from "@/lib/validation-center/roi";

const LIMITS: Record<keyof RoiSettings, [number, number]> = {
  labor_rate: [0, 500],
  manual_audit_hours: [0, 100],
  manual_validation_hours: [0, 100],
  manual_scan_hours: [0, 100],
  batch_review_minutes_saved: [0, 480],
  monday_seat_cost: [0, 500],
  timesheet_minutes_per_day: [0, 240],
  wrapup_minutes_saved: [0, 240],
  clock_correction_minutes: [0, 240],
  submission_routing_minutes: [0, 240],
};

export async function updateRoiSettingsAction(
  settings: Partial<RoiSettings>
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:manage_settings")) {
    return { ok: false, message: "You do not have permission to change ROI assumptions." };
  }
  // Merge over current values so a dialog editing a subset of fields
  // never zeroes the rest.
  const clean = await getRoiSettings();
  for (const key of Object.keys(LIMITS) as (keyof RoiSettings)[]) {
    const n = Number(settings[key]);
    if (!Number.isFinite(n)) continue;
    const [min, max] = LIMITS[key];
    clean[key] = Math.min(max, Math.max(min, Math.round(n * 100) / 100));
  }
  try {
    await updateRoiSettings(clean, user.id);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Save failed." };
  }
  revalidatePath("/qa-center/library");
  revalidatePath("/roi");
  return { ok: true };
}
