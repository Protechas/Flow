import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import {
  FEATURE_MODULE_REGISTRY,
  getFeatureModule,
  getFeatureModuleForPathname,
  getNavItemModuleId,
  type FeatureModuleDefinition,
  type FeatureVisibility,
  type PermissionTemplateId,
  PERMISSION_TEMPLATE_LABELS,
} from "@/lib/auth/feature-registry";
import {
  getNavItemsForRole,
  hasAnyPermission,
  normalizeRole,
  type NavItemId,
  type Permission,
} from "@/lib/auth/permissions";
import type { User, UserRole } from "@/types/flow";

export interface ModuleAccessState {
  moduleId: string;
  label: string;
  group: FeatureModuleDefinition["group"];
  navItemId?: NavItemId;
  href?: string;
  visibility: FeatureVisibility;
  permissions: Record<string, boolean>;
}

export interface UserFeatureAccessSnapshot {
  userId: string;
  templateId: PermissionTemplateId;
  templateLabel: string;
  isCustomized: boolean;
  modules: ModuleAccessState[];
}

export interface UserPermissionOverrides {
  userId: string;
  templateId: PermissionTemplateId;
  isCustomized: boolean;
  modules: Record<
    string,
    {
      visibility?: FeatureVisibility;
      permissions?: Partial<Record<string, boolean>>;
    }
  >;
}

const TEMPLATE_TO_ROLE: Record<PermissionTemplateId, UserRole> = {
  employee: "employee",
  manager: "manager",
  team_lead: "teamlead",
  senior_manager: "senior_manager",
  admin: "admin",
  super_admin: "super_admin",
};

export function roleToPermissionTemplate(role: UserRole | string): PermissionTemplateId {
  switch (normalizeRole(role)) {
    case "super_admin":
      return "super_admin";
    case "admin":
      return "admin";
    case "senior_manager":
      return "senior_manager";
    case "manager":
      return "manager";
    case "teamlead":
      return "team_lead";
    case "viewer":
      return "employee";
    default:
      return "employee";
  }
}

function legacyPermissionEnabled(role: UserRole, legacyPermissions: Permission[]): boolean {
  return hasAnyPermission(role, legacyPermissions);
}

function defaultVisibilityForModule(role: UserRole, module: FeatureModuleDefinition): FeatureVisibility {
  const navItems = getNavItemsForRole(role);
  if (module.navItemId && navItems.some((item) => item.id === module.navItemId)) {
    return "visible";
  }
  if (module.href && navItems.some((item) => item.href === module.href)) {
    return "visible";
  }
  const viewPerm = module.permissions.find((p) => p.key === "view") ?? module.permissions[0];
  if (viewPerm && legacyPermissionEnabled(role, viewPerm.legacyPermissions)) {
    return "visible";
  }
  return "hidden";
}

function defaultPermissionsForModule(
  role: UserRole,
  module: FeatureModuleDefinition
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const perm of module.permissions) {
    out[perm.key] = legacyPermissionEnabled(role, perm.legacyPermissions);
  }
  return out;
}

/** Compute effective access for a role from existing RBAC — matches current production behavior. */
export function computeRoleAccess(role: UserRole | string): ModuleAccessState[] {
  const r = normalizeRole(role);
  return FEATURE_MODULE_REGISTRY.map((module) => ({
    moduleId: module.id,
    label: module.label,
    group: module.group,
    navItemId: module.navItemId,
    href: module.href,
    visibility: defaultVisibilityForModule(r, module),
    permissions: defaultPermissionsForModule(r, module),
  }));
}

/** Role template snapshot (Employee, Manager, etc.) */
export function computeTemplateAccess(templateId: PermissionTemplateId): ModuleAccessState[] {
  return computeRoleAccess(TEMPLATE_TO_ROLE[templateId]);
}

function applyOverrides(
  base: ModuleAccessState[],
  overrides?: UserPermissionOverrides["modules"]
): ModuleAccessState[] {
  if (!overrides || Object.keys(overrides).length === 0) return base;

  return base.map((module) => {
    const override = overrides[module.moduleId];
    if (!override) return module;

    const permissions = { ...module.permissions };
    if (override.permissions) {
      for (const [key, value] of Object.entries(override.permissions)) {
        if (typeof value === "boolean") permissions[key] = value;
      }
    }

    return {
      ...module,
      visibility: override.visibility ?? module.visibility,
      permissions,
    };
  });
}

export function resolveFeatureAccessForRole(
  role: UserRole | string,
  overrides?: UserPermissionOverrides["modules"]
): UserFeatureAccessSnapshot {
  const r = normalizeRole(role);
  const templateId = roleToPermissionTemplate(r);
  const base = computeRoleAccess(r);
  const modules = applyOverrides(base, overrides);

  return {
    userId: "",
    templateId,
    templateLabel: PERMISSION_TEMPLATE_LABELS[templateId],
    isCustomized: Boolean(overrides && Object.keys(overrides).length > 0),
    modules,
  };
}

export function resolveUserFeatureAccess(
  user: Pick<User, "id" | "role" | "organizational_position" | "system_access_level">,
  overrides?: UserPermissionOverrides | null
): UserFeatureAccessSnapshot {
  const role = getEffectivePermissionRole(user);
  const templateId = overrides?.templateId ?? roleToPermissionTemplate(role);
  const baseRole = overrides?.templateId ? TEMPLATE_TO_ROLE[overrides.templateId] : role;
  const base = computeRoleAccess(baseRole);
  const modules = applyOverrides(base, overrides?.modules);

  return {
    userId: user.id,
    templateId,
    templateLabel: PERMISSION_TEMPLATE_LABELS[templateId],
    isCustomized: overrides?.isCustomized ?? false,
    modules,
  };
}

export function getHiddenNavItemIds(snapshot: UserFeatureAccessSnapshot): NavItemId[] {
  const hidden: NavItemId[] = [];
  for (const module of snapshot.modules) {
    if (module.visibility === "hidden" && module.navItemId) {
      hidden.push(module.navItemId);
    }
  }
  return hidden;
}

export function isModuleVisible(snapshot: UserFeatureAccessSnapshot, moduleId: string): boolean {
  const module = snapshot.modules.find((m) => m.moduleId === moduleId);
  return module?.visibility === "visible";
}

/** True when pathname is allowed by enterprise module visibility (unmapped paths pass). */
export function canAccessPathWithFeatureAccess(
  snapshot: UserFeatureAccessSnapshot,
  pathname: string
): boolean {
  const module = getFeatureModuleForPathname(pathname);
  if (!module) return true;
  return isModuleVisible(snapshot, module.id);
}

export function getHiddenEmployeeNavHrefs(snapshot: UserFeatureAccessSnapshot): string[] {
  const mappings: { moduleId: string; href: string }[] = [
    { moduleId: "employee-workspace", href: "/work" },
    { moduleId: "scorecard", href: "/scorecard" },
    { moduleId: "files", href: "/work/files" },
  ];
  return mappings
    .filter(({ moduleId }) => !isModuleVisible(snapshot, moduleId))
    .map(({ href }) => href);
}

/** Feature permission check with legacy fallback when no custom override exists. */
export function hasFeaturePermission(
  user: Pick<User, "role" | "organizational_position" | "system_access_level">,
  moduleId: string,
  permissionKey: string,
  overrides?: UserPermissionOverrides | null
): boolean {
  const role = getEffectivePermissionRole(user);
  const moduleDef = getFeatureModule(moduleId);
  if (!moduleDef) return false;

  const permDef = moduleDef.permissions.find((p) => p.key === permissionKey);
  if (!permDef) return false;

  const overrideValue = overrides?.modules?.[moduleId]?.permissions?.[permissionKey];
  if (typeof overrideValue === "boolean") return overrideValue;

  return legacyPermissionEnabled(role, permDef.legacyPermissions);
}

/** Nav item hidden by enterprise visibility layer. */
export function isNavItemHidden(snapshot: UserFeatureAccessSnapshot, navItemId: NavItemId): boolean {
  const moduleId = getNavItemModuleId(navItemId);
  if (!moduleId) return false;
  return !isModuleVisible(snapshot, moduleId);
}

export function listPermissionTemplates(): {
  id: PermissionTemplateId;
  label: string;
  modules: ModuleAccessState[];
}[] {
  return (Object.keys(PERMISSION_TEMPLATE_LABELS) as PermissionTemplateId[]).map((id) => ({
    id,
    label: PERMISSION_TEMPLATE_LABELS[id],
    modules: computeTemplateAccess(id),
  }));
}
