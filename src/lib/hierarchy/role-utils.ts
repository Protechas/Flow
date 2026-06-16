import type { UserRole } from "@/types/flow";

/** Visual authority tier for org chart cards (higher = more senior). */
export function hierarchyLevelForRole(role: UserRole): number {
  switch (role) {
    case "super_admin":
    case "admin":
      return 5;
    case "senior_manager":
      return 4;
    case "manager":
      return 3;
    case "teamlead":
      return 2;
    default:
      return 1;
  }
}

export const ROLE_DISPLAY_LABELS: Partial<Record<UserRole, string>> = {
  super_admin: "Super Admin",
  admin: "Admin",
  senior_manager: "Senior Manager",
  manager: "Manager",
  teamlead: "Team Lead",
  employee: "Employee",
  viewer: "Viewer",
};
