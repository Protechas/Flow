import type { OrganizationalPosition } from "@/types/flow";

/** Visual authority tier for org chart cards (higher = more senior). */
export function hierarchyLevelForPosition(position: OrganizationalPosition): number {
  switch (position) {
    case "senior_manager":
      return 4;
    case "manager":
      return 3;
    case "team_lead":
      return 2;
    default:
      return 1;
  }
}

/** @deprecated Use hierarchyLevelForPosition for org chart display */
export function hierarchyLevelForRole(role: import("@/types/flow").UserRole): number {
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

export const POSITION_DISPLAY_LABELS: Record<OrganizationalPosition, string> = {
  employee: "Employee",
  team_lead: "Team Lead",
  manager: "Manager",
  senior_manager: "Senior Manager",
};

export const ROLE_DISPLAY_LABELS: Partial<Record<import("@/types/flow").UserRole, string>> = {
  super_admin: "Super Admin",
  admin: "Admin",
  senior_manager: "Senior Manager",
  manager: "Manager",
  teamlead: "Team Lead",
  employee: "Employee",
  viewer: "Viewer",
};
