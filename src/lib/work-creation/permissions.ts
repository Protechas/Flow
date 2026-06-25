import { normalizeRole, hasPermission } from "@/lib/auth/permissions";
import type { UserRole } from "@/types/flow";
import type { WorkCreationMode } from "@/lib/work-creation/types";

export function getAllowedCreationModes(role: UserRole | string): WorkCreationMode[] {
  const r = normalizeRole(role);
  const modes: WorkCreationMode[] = [];

  if (
    hasPermission(r, "projects:create") ||
    r === "teamlead" ||
    r === "manager" ||
    r === "admin" ||
    r === "super_admin" ||
    r === "senior_manager"
  ) {
    modes.push("board");
  }
  if (hasPermission(r, "projects:create")) {
    modes.push("project");
  }
  if (hasPermission(r, "projects:create") || r === "teamlead") {
    modes.push("task");
  } else if (r === "employee" && hasPermission(r, "projects:edit")) {
    modes.push("task");
  }

  return modes;
}

/** Unified New Work hub when user can create both boards and tasks. */
export function usesManagerWorkHub(role: UserRole | string): boolean {
  const modes = getAllowedCreationModes(role);
  return modes.includes("board") && modes.includes("task");
}
