"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { updateRoiSettings, type RoiSettings } from "@/lib/validation-center/roi";

export async function updateRoiSettingsAction(
  settings: RoiSettings
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:manage_settings")) {
    return { ok: false, message: "You do not have permission to change ROI assumptions." };
  }
  const clean: RoiSettings = {
    labor_rate: sanitize(settings.labor_rate, 0, 500),
    manual_audit_hours: sanitize(settings.manual_audit_hours, 0, 100),
    manual_validation_hours: sanitize(settings.manual_validation_hours, 0, 100),
    manual_scan_hours: sanitize(settings.manual_scan_hours, 0, 100),
    batch_review_minutes_saved: sanitize(settings.batch_review_minutes_saved, 0, 480),
  };
  try {
    await updateRoiSettings(clean, user.id);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Save failed." };
  }
  revalidatePath("/qa-center/library");
  return { ok: true };
}

function sanitize(value: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n * 100) / 100));
}
