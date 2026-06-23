import { deriveOrganizationalPositionFromRole } from "@/lib/auth/access-level";
import { setUserDepartmentMembership } from "@/lib/data/flow-store";
import { syncHierarchyOnManagerChange } from "@/lib/hierarchy/resolver";
import {
  assignUserToPositionRecord,
  getOrgPositionById,
  getPositionForUser,
  listOrgPositions,
} from "@/lib/positions/store";
import type { OrganizationalPosition, OrgPosition, User, UserRole } from "@/types/flow";

function organizationalRoleFromLevel(level: OrganizationalPosition): UserRole {
  switch (level) {
    case "senior_manager":
      return "senior_manager";
    case "manager":
      return "manager";
    case "team_lead":
      return "teamlead";
    default:
      return "employee";
  }
}

function deptRoleFromLevel(level: OrganizationalPosition): "member" | "lead" | "manager" {
  if (level === "senior_manager" || level === "manager") return "manager";
  if (level === "team_lead") return "lead";
  return "member";
}

export function getSupervisorUserIdFromPosition(
  position: OrgPosition,
  positions: OrgPosition[],
  users: User[]
): string | null {
  if (!position.reports_to_position_id) return null;
  const parent = positions.find((p) => p.id === position.reports_to_position_id);
  if (!parent?.assigned_user_id) return null;
  const supervisor = users.find((u) => u.id === parent.assigned_user_id && u.is_active);
  return supervisor?.id ?? null;
}

export interface PositionDerivedUserFields {
  assigned_position_id: string;
  team_id: string | null;
  manager_id: string | null;
  organizational_position: OrganizationalPosition;
  role: UserRole;
}

export function deriveUserFieldsFromPosition(
  position: OrgPosition,
  positions: OrgPosition[],
  users: User[]
): PositionDerivedUserFields {
  const managerId = getSupervisorUserIdFromPosition(position, positions, users);
  const orgPosition = position.position_level;
  const role = organizationalRoleFromLevel(orgPosition);

  return {
    assigned_position_id: position.id,
    team_id: position.team_id ?? null,
    manager_id: managerId,
    organizational_position: orgPosition,
    role,
  };
}

export function applyPositionAssignmentToStore(
  userId: string,
  positionId: string,
  users: User[],
  updateUserFn: (userId: string, fields: Partial<User>) => User | null
): User | null {
  const position = assignUserToPositionRecord(positionId, userId);
  if (!position) return null;

  const positions = listOrgPositions();
  const derived = deriveUserFieldsFromPosition(position, positions, users);
  const updated = updateUserFn(userId, {
    assigned_position_id: derived.assigned_position_id,
    team_id: derived.team_id,
    manager_id: derived.manager_id,
    organizational_position: derived.organizational_position,
    role: derived.role,
  });

  if (position.department_id) {
    setUserDepartmentMembership(userId, position.department_id, {
      is_primary: true,
      role_in_department: deptRoleFromLevel(position.position_level),
    });
  }

  if (derived.manager_id) {
    syncHierarchyOnManagerChange(userId, derived.manager_id, users, derived.team_id);
  }

  return updated;
}

export function clearPositionAssignmentFromStore(
  userId: string,
  users: User[],
  updateUserFn: (userId: string, fields: Partial<User>) => User | null
): User | null {
  const existing = getPositionForUser(userId);
  if (existing) {
    assignUserToPositionRecord(existing.id, null);
  }

  const user = users.find((u) => u.id === userId);
  return updateUserFn(userId, {
    assigned_position_id: null,
    organizational_position:
      user?.organizational_position ??
      deriveOrganizationalPositionFromRole(user?.role ?? "employee"),
  });
}

export function syncUserFromAssignedPosition(
  userId: string,
  users: User[],
  updateUserFn: (userId: string, fields: Partial<User>) => User | null
): User | null {
  const user = users.find((u) => u.id === userId);
  if (!user?.assigned_position_id) return user ?? null;

  const position = getOrgPositionById(user.assigned_position_id);
  if (!position) return user;

  const positions = listOrgPositions();
  const derived = deriveUserFieldsFromPosition(position, positions, users);
  return updateUserFn(userId, {
    team_id: derived.team_id,
    manager_id: derived.manager_id,
    organizational_position: derived.organizational_position,
    role: derived.role,
  });
}
