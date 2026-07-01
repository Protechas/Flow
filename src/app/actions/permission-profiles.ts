"use server";

import { revalidatePath } from "next/cache";
import { requirePagePermission } from "@/lib/auth/guard";
import type { PermissionTemplateId, FeatureVisibility } from "@/lib/auth/feature-registry";
import {
  computeTemplateAccess,
  resolveUserFeatureAccess,
  listPermissionTemplates,
  roleToPermissionTemplate,
} from "@/lib/auth/feature-access";
import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import {
  applyTemplateToUser,
  copyUserPermissionOverrides,
  getUserPermissionOverrides,
  resetUserPermissionOverrides,
  saveUserPermissionOverrides,
} from "@/lib/data/permission-profiles-db";
import { listUsers } from "@/lib/data/users";
import { FEATURE_MODULE_REGISTRY } from "@/lib/auth/feature-registry";

function revalidatePermissionPages() {
  revalidatePath("/settings/permissions");
  revalidatePath("/system-health");
  revalidatePath("/", "layout");
}

export async function listPermissionManagementDataAction() {
  await requirePagePermission("users:manage");
  const users = await listUsers();
  const templates = listPermissionTemplates();
  return {
    users: users
      .filter((u) => u.is_active)
      .map((u) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: getEffectivePermissionRole(u),
        templateId: roleToPermissionTemplate(getEffectivePermissionRole(u)),
      })),
    templates,
    modules: FEATURE_MODULE_REGISTRY.map((m) => ({
      id: m.id,
      label: m.label,
      group: m.group,
      permissions: m.permissions.map((p) => ({ key: p.key, label: p.label })),
    })),
  };
}

export async function getUserPermissionSnapshotAction(userId: string) {
  await requirePagePermission("users:manage");
  const users = await listUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return { ok: false as const, message: "User not found." };

  const overrides = await getUserPermissionOverrides(userId);
  const snapshot = resolveUserFeatureAccess(user, overrides);
  return { ok: true as const, snapshot, overrides };
}

export async function getTemplateSnapshotAction(templateId: PermissionTemplateId) {
  await requirePagePermission("users:manage");
  return {
    ok: true as const,
    templateId,
    modules: computeTemplateAccess(templateId),
  };
}

export async function updateUserModuleVisibilityAction(
  userId: string,
  moduleId: string,
  visibility: FeatureVisibility
) {
  await requirePagePermission("users:manage");
  const users = await listUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return { ok: false as const, message: "User not found." };

  const existing = (await getUserPermissionOverrides(userId)) ?? {
    userId,
    templateId: roleToPermissionTemplate(getEffectivePermissionRole(user)),
    isCustomized: false,
    modules: {},
  };

  existing.modules[moduleId] = {
    ...existing.modules[moduleId],
    visibility,
    permissions: existing.modules[moduleId]?.permissions ?? {},
  };

  try {
    await saveUserPermissionOverrides(existing);
  } catch (err) {
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : "Could not save permission profile.",
    };
  }
  revalidatePermissionPages();
  return { ok: true as const };
}

export async function updateUserModulePermissionAction(
  userId: string,
  moduleId: string,
  permissionKey: string,
  enabled: boolean
) {
  await requirePagePermission("users:manage");
  const users = await listUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return { ok: false as const, message: "User not found." };

  const existing = (await getUserPermissionOverrides(userId)) ?? {
    userId,
    templateId: roleToPermissionTemplate(getEffectivePermissionRole(user)),
    isCustomized: false,
    modules: {},
  };

  const effectiveSnapshot = resolveUserFeatureAccess(user, existing);
  const currentVisibility =
    existing.modules[moduleId]?.visibility ??
    effectiveSnapshot.modules.find((m) => m.moduleId === moduleId)?.visibility ??
    "visible";

  const moduleState = existing.modules[moduleId] ?? {};
  existing.modules[moduleId] = {
    ...moduleState,
    visibility: currentVisibility,
    permissions: {
      ...moduleState.permissions,
      [permissionKey]: enabled,
    },
  };

  try {
    await saveUserPermissionOverrides(existing);
  } catch (err) {
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : "Could not save permission profile.",
    };
  }
  revalidatePermissionPages();
  return { ok: true as const };
}

export async function resetUserPermissionsAction(userId: string) {
  await requirePagePermission("users:manage");
  await resetUserPermissionOverrides(userId);
  revalidatePermissionPages();
  return { ok: true as const };
}

export async function copyUserPermissionsAction(sourceUserId: string, targetUserId: string) {
  await requirePagePermission("users:manage");
  if (sourceUserId === targetUserId) {
    return { ok: false as const, message: "Source and target must differ." };
  }
  const copied = await copyUserPermissionOverrides(sourceUserId, targetUserId);
  if (!copied) {
    return {
      ok: false as const,
      message: "Source user has no customized profile. Apply a template or customize first.",
    };
  }
  revalidatePermissionPages();
  return { ok: true as const };
}

export async function applyPermissionTemplateAction(
  userId: string,
  templateId: PermissionTemplateId
) {
  await requirePagePermission("users:manage");
  await applyTemplateToUser(userId, templateId);
  revalidatePermissionPages();
  return { ok: true as const };
}

export async function cloneTemplateToUserAction(userId: string, templateId: PermissionTemplateId) {
  await requirePagePermission("users:manage");
  const modules = computeTemplateAccess(templateId);
  const moduleOverrides: Record<string, { visibility: FeatureVisibility; permissions: Record<string, boolean> }> =
    {};
  for (const m of modules) {
    moduleOverrides[m.moduleId] = {
      visibility: m.visibility,
      permissions: { ...m.permissions },
    };
  }
  await saveUserPermissionOverrides({
    userId,
    templateId,
    isCustomized: true,
    modules: moduleOverrides,
  });
  revalidatePermissionPages();
  return { ok: true as const };
}
