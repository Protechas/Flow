import { FEATURE_MODULE_REGISTRY, getAllFeatureModuleIds } from "@/lib/auth/feature-registry";
import {
  computeTemplateAccess,
  resolveUserFeatureAccess,
  roleToPermissionTemplate,
} from "@/lib/auth/feature-access";
import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import { normalizeRole } from "@/lib/auth/permissions";
import { listCustomizedPermissionProfiles } from "@/lib/data/permission-profiles-db";
import { initFlowStore, getFlowStore } from "@/lib/data/flow-store";
import type { SystemHealthIssue } from "@/lib/system-health/integrity";

export interface PermissionDiagnosticsReport {
  generatedAt: string;
  customizedProfileCount: number;
  usersWithoutProfile: number;
  issueCount: number;
  criticalCount: number;
  warningCount: number;
  issues: SystemHealthIssue[];
  migrationStatus: {
    phase: string;
    profilesStored: number;
    fallbackActive: boolean;
  };
}

function pushIssue(
  issues: SystemHealthIssue[],
  issue: Omit<SystemHealthIssue, "count"> & { count?: number; sampleIds?: string[] }
) {
  if ((issue.count ?? 0) <= 0) return;
  issues.push({ ...issue, count: issue.count ?? issue.sampleIds?.length ?? 1 });
}

export async function buildPermissionDiagnosticsReport(): Promise<PermissionDiagnosticsReport> {
  initFlowStore();
  const users = getFlowStore().users.filter((u) => u.is_active);
  const knownModuleIds = new Set(getAllFeatureModuleIds());
  const customized = await listCustomizedPermissionProfiles();
  const customizedIds = new Set(customized.map((p) => p.userId));

  const issues: SystemHealthIssue[] = [];

  const usersWithoutProfile = users.filter((u) => !customizedIds.has(u.id)).length;
  pushIssue(issues, {
    id: "permission-fallback-users",
    category: "records",
    severity: "info",
    title: "Users on role-based defaults",
    detail:
      "No custom permission profile — existing ROLE_PERMISSIONS apply (expected for Phase 1 backward compatibility).",
    count: usersWithoutProfile,
    href: "/settings/permissions",
  });

  const invalidModules: { userId: string; moduleId: string }[] = [];
  const duplicateModules: { userId: string; moduleId: string }[] = [];
  const seenKeys = new Map<string, Set<string>>();

  for (const profile of customized) {
    const seen = seenKeys.get(profile.userId) ?? new Set<string>();
    for (const moduleId of Object.keys(profile.modules)) {
      if (!knownModuleIds.has(moduleId)) {
        invalidModules.push({ userId: profile.userId, moduleId });
      }
      if (seen.has(moduleId)) {
        duplicateModules.push({ userId: profile.userId, moduleId });
      }
      seen.add(moduleId);
    }
    seenKeys.set(profile.userId, seen);
  }

  pushIssue(issues, {
    id: "permission-unknown-modules",
    category: "records",
    severity: "warning",
    title: "Unknown module IDs in permission profiles",
    detail: "Module IDs not registered in FEATURE_MODULE_REGISTRY — may be stale after upgrades.",
    count: invalidModules.length,
    href: "/settings/permissions",
    sampleIds: invalidModules.slice(0, 5).map((r) => `${r.userId}:${r.moduleId}`),
  });

  pushIssue(issues, {
    id: "permission-duplicate-modules",
    category: "records",
    severity: "critical",
    title: "Duplicate module entries in permission profiles",
    detail: "Same module appears more than once for a user — data integrity issue.",
    count: duplicateModules.length,
    href: "/settings/permissions",
    sampleIds: duplicateModules.slice(0, 5).map((r) => `${r.userId}:${r.moduleId}`),
  });

  const conflicts: string[] = [];
  for (const profile of customized) {
    const user = users.find((u) => u.id === profile.userId);
    if (!user) {
      conflicts.push(profile.userId);
      continue;
    }
    const role = getEffectivePermissionRole(user);
    const expectedTemplate = roleToPermissionTemplate(role);
    if (profile.templateId !== expectedTemplate && Object.keys(profile.modules).length === 0) {
      conflicts.push(profile.userId);
    }
  }

  pushIssue(issues, {
    id: "permission-template-conflicts",
    category: "records",
    severity: "info",
    title: "Custom templates differing from role default",
    detail: "User has a customized template assignment — verify intentional overrides.",
    count: conflicts.length,
    href: "/settings/permissions",
    sampleIds: conflicts.slice(0, 5),
  });

  const missingRegistryModules = FEATURE_MODULE_REGISTRY.filter(
    (m) => !m.permissions.length
  );
  pushIssue(issues, {
    id: "permission-empty-module-definitions",
    category: "records",
    severity: "warning",
    title: "Modules with no permission definitions",
    detail: "Registry modules should expose at least one permission toggle.",
    count: missingRegistryModules.length,
    href: "/settings/permissions",
    sampleIds: missingRegistryModules.map((m) => m.id),
  });

  for (const templateId of [
    "employee",
    "manager",
    "team_lead",
    "senior_manager",
    "admin",
    "super_admin",
  ] as const) {
    const modules = computeTemplateAccess(templateId);
    if (modules.length === 0) {
      pushIssue(issues, {
        id: `permission-empty-template-${templateId}`,
        category: "records",
        severity: "critical",
        title: `Empty permission template: ${templateId}`,
        detail: "Role template produced no modules — check FEATURE_MODULE_REGISTRY.",
        count: 1,
      });
    }
  }

  const inactiveProfileUsers = customized.filter(
    (p) => !users.some((u) => u.id === p.userId)
  );
  pushIssue(issues, {
    id: "permission-inactive-user-profiles",
    category: "records",
    severity: "warning",
    title: "Permission profiles for inactive or missing users",
    detail: "Orphaned permission records should be cleaned up.",
    count: inactiveProfileUsers.length,
    href: "/settings/permissions",
    sampleIds: inactiveProfileUsers.slice(0, 5).map((p) => p.userId),
  });

  for (const user of users.slice(0, 50)) {
    try {
      resolveUserFeatureAccess(user, customized.find((p) => p.userId === user.id) ?? null);
    } catch {
      pushIssue(issues, {
        id: "permission-resolve-failure",
        category: "records",
        severity: "critical",
        title: "Permission resolution failures",
        detail: `Could not resolve feature access for user ${user.full_name}.`,
        count: 1,
        sampleIds: [user.id],
      });
      break;
    }
  }

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return {
    generatedAt: new Date().toISOString(),
    customizedProfileCount: customized.length,
    usersWithoutProfile: usersWithoutProfile,
    issueCount: issues.length,
    criticalCount,
    warningCount,
    issues,
    migrationStatus: {
      phase: "Phase 1 — role fallback active",
      profilesStored: customized.length,
      fallbackActive: true,
    },
  };
}
