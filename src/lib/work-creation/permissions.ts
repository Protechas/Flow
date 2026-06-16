import { normalizeRole, hasPermission } from "@/lib/auth/permissions";
import type { UserRole } from "@/types/flow";
import type { WorkCreationMode } from "@/lib/work-creation/types";

export function getAllowedCreationModes(role: UserRole | string): WorkCreationMode[] {
  const r = normalizeRole(role);
  if (r === "admin" || r === "manager") return ["board", "project", "task"];
  if (r === "teamlead") return ["project", "task"];
  if (r === "employee" && hasPermission(r, "projects:edit")) return ["task"];
  return [];
}
