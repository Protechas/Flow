"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import { getDefaultRoute } from "@/lib/auth/permissions";
import {
  canUseEmployeePreview,
  EMPLOYEE_PREVIEW_COOKIE,
} from "@/lib/auth/employee-preview";

/** Leads/managers flip into the employee shell (their own identity, the
 * employee UI). Session-scoped cookie — closing the browser exits too. */
export async function enterEmployeePreviewAction() {
  const user = await requireUser();
  if (!canUseEmployeePreview(user)) redirect("/work");
  const store = await cookies();
  store.set(EMPLOYEE_PREVIEW_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect("/work");
}

export async function exitEmployeePreviewAction() {
  const user = await requireUser();
  const store = await cookies();
  store.delete(EMPLOYEE_PREVIEW_COOKIE);
  redirect(getDefaultRoute(getEffectivePermissionRole(user)));
}
