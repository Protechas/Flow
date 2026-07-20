import { describe, expect, it } from "vitest";
import {
  canAccessPathWithFeatureAccess,
  computeTemplateAccess,
  resolveFeatureAccessForRole,
  resolveUserFeatureAccess,
  roleToPermissionTemplate,
} from "@/lib/auth/feature-access";
import { FEATURE_MODULE_REGISTRY, getFeatureModuleForPathname } from "@/lib/auth/feature-registry";
import {
  canAccessRoute,
  getNavItemsForRole,
  hasPermission,
  type UserRole,
} from "@/lib/auth/permissions";

const ROLES: UserRole[] = [
  "employee",
  "teamlead",
  "manager",
  "senior_manager",
  "admin",
  "super_admin",
  "viewer",
];

describe("feature-access backward compatibility", () => {
  it("registers all major modules with at least one permission", () => {
    expect(FEATURE_MODULE_REGISTRY.length).toBeGreaterThan(15);
    for (const mod of FEATURE_MODULE_REGISTRY) {
      expect(mod.permissions.length).toBeGreaterThan(0);
    }
  });

  it("role templates preserve legacy permission outcomes when no overrides", () => {
    for (const role of ROLES) {
      const snapshot = resolveFeatureAccessForRole(role);
      for (const mod of snapshot.modules) {
        const def = FEATURE_MODULE_REGISTRY.find((m) => m.id === mod.moduleId);
        if (!def) continue;
        for (const perm of def.permissions) {
          const legacy = perm.legacyPermissions.some((p) => hasPermission(role, p));
          expect(mod.permissions[perm.key]).toBe(legacy);
        }
      }
    }
  });

  it("default visibility includes all sidebar modules for each role", () => {
    for (const role of ROLES) {
      const navItems = getNavItemsForRole(role);
      const snapshot = resolveFeatureAccessForRole(role);
      for (const item of navItems) {
        const mod = snapshot.modules.find((m) => m.navItemId === item.id);
        if (mod) {
          expect(mod.visibility).toBe("visible");
        }
      }
    }
  });

  it("maps roles to permission templates", () => {
    expect(roleToPermissionTemplate("teamlead")).toBe("team_lead");
    expect(roleToPermissionTemplate("super_admin")).toBe("super_admin");
    expect(roleToPermissionTemplate("viewer")).toBe("employee");
  });

  it("admin template includes user management permissions", () => {
    const admin = computeTemplateAccess("admin");
    const users = admin.find((m) => m.moduleId === "user-management");
    expect(users?.visibility).toBe("visible");
    expect(users?.permissions.manage).toBe(true);
  });

  it("blocks direct URLs when module visibility is hidden", () => {
    const base = resolveFeatureAccessForRole("manager");
    const snapshot = {
      ...base,
      isCustomized: true,
      modules: base.modules.map((m) =>
        m.moduleId === "qa-center" ? { ...m, visibility: "hidden" as const } : m
      ),
    };
    expect(canAccessPathWithFeatureAccess(snapshot, "/qa-center")).toBe(false);
    expect(canAccessPathWithFeatureAccess(snapshot, "/qa-center/upload")).toBe(false);
    expect(canAccessPathWithFeatureAccess(snapshot, "/validation/runs")).toBe(false);
    expect(canAccessPathWithFeatureAccess(snapshot, "/projects")).toBe(true);
  });

  it("maps legacy validation paths to QA Center module", () => {
    expect(getFeatureModuleForPathname("/validation/findings")?.id).toBe("qa-center");
    expect(getFeatureModuleForPathname("/settings/permissions")?.id).toBe("permission-management");
  });

  it("legacy route permissions still govern uncustomized users", () => {
    expect(canAccessRoute("admin", "/settings/permissions")).toBe(true);
    expect(canAccessRoute("employee", "/settings/permissions")).toBe(false);
    expect(canAccessRoute("manager", "/projects")).toBe(true);
  });

  it("permission-only overrides preserve module visibility", () => {
    const user = {
      id: "u1",
      role: "manager" as const,
      organizational_position: null,
      system_access_level: null,
    };
    const base = resolveUserFeatureAccess(user, null);
    const qaModule = base.modules.find((m) => m.moduleId === "qa-center");
    expect(qaModule?.visibility).toBeDefined();

    const overrides = {
      userId: "u1",
      templateId: roleToPermissionTemplate("manager"),
      isCustomized: true,
      modules: {
        "qa-center": {
          visibility: qaModule?.visibility,
          permissions: { upload_audit: false },
        },
      },
    };
    const customized = resolveUserFeatureAccess(user, overrides);
    const customizedQa = customized.modules.find((m) => m.moduleId === "qa-center");
    expect(customizedQa?.visibility).toBe(qaModule?.visibility);
    expect(customizedQa?.permissions.upload_audit).toBe(false);
  });
});
