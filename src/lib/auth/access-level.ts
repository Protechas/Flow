import { hasPermission, normalizeRole } from "@/lib/auth/permissions";
import type {
  OrganizationalPosition,
  SystemAccessLevel,
  User,
  UserRole,
} from "@/types/flow";

export function deriveOrganizationalPositionFromRole(role: UserRole | string): OrganizationalPosition {
  switch (normalizeRole(role)) {
    case "teamlead":
      return "team_lead";
    case "manager":
      return "manager";
    case "senior_manager":
      return "senior_manager";
    case "admin":
      return "manager";
    case "super_admin":
      return "senior_manager";
    default:
      return "employee";
  }
}

export function deriveSystemAccessLevelFromRole(role: UserRole | string): SystemAccessLevel {
  switch (normalizeRole(role)) {
    case "super_admin":
      return "super_admin";
    case "admin":
      return "admin";
    default:
      return "standard";
  }
}

export function getOrganizationalPosition(
  user: Pick<User, "role" | "organizational_position">
): OrganizationalPosition {
  if (user.organizational_position) return user.organizational_position;
  return deriveOrganizationalPositionFromRole(user.role);
}

export function getSystemAccessLevel(
  user: Pick<User, "role" | "system_access_level">
): SystemAccessLevel {
  if (user.system_access_level) return user.system_access_level;
  return deriveSystemAccessLevelFromRole(user.role);
}

export function organizationalPositionToUserRole(position: OrganizationalPosition): UserRole {
  switch (position) {
    case "team_lead":
      return "teamlead";
    case "manager":
      return "manager";
    case "senior_manager":
      return "senior_manager";
    default:
      return "employee";
  }
}

export function systemAccessLevelToUserRole(access: SystemAccessLevel): UserRole | null {
  if (access === "super_admin") return "super_admin";
  if (access === "admin") return "admin";
  return null;
}

/** Permission role for existing ROLE_PERMISSIONS checks */
export function getEffectivePermissionRole(
  user: Pick<User, "role" | "organizational_position" | "system_access_level">
): UserRole {
  const accessRole = systemAccessLevelToUserRole(getSystemAccessLevel(user));
  if (accessRole) return accessRole;

  if (normalizeRole(user.role) === "viewer") return "viewer";

  return organizationalPositionToUserRole(getOrganizationalPosition(user));
}

/** Hierarchy / dashboard scope — ignores elevated system access */
export function getOrganizationalScopeRole(
  user: Pick<User, "role" | "organizational_position">
): UserRole {
  if (normalizeRole(user.role) === "viewer") return "viewer";
  return organizationalPositionToUserRole(getOrganizationalPosition(user));
}

export function syncLegacyRoleFromAccessFields(
  position: OrganizationalPosition,
  access: SystemAccessLevel
): UserRole {
  const accessRole = systemAccessLevelToUserRole(access);
  if (accessRole) return accessRole;
  return organizationalPositionToUserRole(position);
}

export function hasAdminAccess(
  user: Pick<User, "role" | "organizational_position" | "system_access_level">
): boolean {
  const access = getSystemAccessLevel(user);
  return access === "admin" || access === "super_admin";
}

export function hasSuperAdminAccess(
  user: Pick<User, "role" | "organizational_position" | "system_access_level">
): boolean {
  return getSystemAccessLevel(user) === "super_admin";
}

export function canManageUsers(
  user: Pick<User, "role" | "organizational_position" | "system_access_level">
): boolean {
  return hasPermission(getEffectivePermissionRole(user), "users:manage");
}

export function canViewGlobalSettings(
  user: Pick<User, "role" | "organizational_position" | "system_access_level">
): boolean {
  return hasPermission(getEffectivePermissionRole(user), "settings:manage");
}

export function hydrateUserAccessFields(user: User): User {
  return {
    ...user,
    organizational_position: getOrganizationalPosition(user),
    system_access_level: getSystemAccessLevel(user),
    role: normalizeRole(user.role),
  };
}
