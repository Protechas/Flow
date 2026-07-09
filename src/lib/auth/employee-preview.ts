import { cookies } from "next/headers";
import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import type { User } from "@/types/flow";

export const EMPLOYEE_PREVIEW_COOKIE = "flow-employee-preview";

/** Leads and up can flip into the employee shell to see what their team sees. */
export function canUseEmployeePreview(user: User): boolean {
  return getEffectivePermissionRole(user) !== "employee";
}

export async function isEmployeePreviewActive(): Promise<boolean> {
  const store = await cookies();
  return store.get(EMPLOYEE_PREVIEW_COOKIE)?.value === "1";
}

/** Routes the employee shell owns — the only surface the preview unlocks. */
export function isEmployeePreviewRoute(pathname: string): boolean {
  return (
    pathname === "/work" ||
    pathname.startsWith("/work/") ||
    pathname === "/scorecard"
  );
}
