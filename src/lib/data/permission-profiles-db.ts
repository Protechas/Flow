import type {
  PermissionTemplateId,
  FeatureVisibility,
} from "@/lib/auth/feature-registry";
import type { UserPermissionOverrides } from "@/lib/auth/feature-access";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";

const memoryProfiles = new Map<string, UserPermissionOverrides>();

function isPermissionTableUnavailable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "42703") return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("schema cache");
}

function ts() {
  return new Date().toISOString();
}

function isValidTemplateId(value: string): value is PermissionTemplateId {
  return [
    "employee",
    "manager",
    "team_lead",
    "senior_manager",
    "admin",
    "super_admin",
  ].includes(value);
}

function mapProfileRow(
  profileRow: Record<string, unknown> | null,
  moduleRows: Record<string, unknown>[]
): UserPermissionOverrides | null {
  if (!profileRow) return null;

  const modules: UserPermissionOverrides["modules"] = {};
  for (const row of moduleRows) {
    const moduleId = String(row.module_id);
    const visibility = String(row.visibility) as FeatureVisibility;
    const permissions =
      row.permissions && typeof row.permissions === "object" && !Array.isArray(row.permissions)
        ? (row.permissions as Record<string, boolean>)
        : {};

    modules[moduleId] = {
      visibility: visibility === "hidden" ? "hidden" : "visible",
      permissions,
    };
  }

  const templateId = String(profileRow.template_id);
  return {
    userId: String(profileRow.user_id),
    templateId: isValidTemplateId(templateId) ? templateId : "employee",
    isCustomized: Boolean(profileRow.is_customized),
    modules,
  };
}

export async function getUserPermissionOverrides(
  userId: string
): Promise<UserPermissionOverrides | null> {
  if (!isSupabaseConfigured()) {
    return memoryProfiles.get(userId) ?? null;
  }

  const supabase = await createClient();
  const [{ data: profile, error: profileError }, { data: modules, error: modulesError }] =
    await Promise.all([
      supabase.from("user_permission_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_permission_modules").select("*").eq("user_id", userId),
    ]);

  if (profileError) {
    if (isPermissionTableUnavailable(profileError)) return null;
    throw new Error(profileError.message);
  }
  if (modulesError) {
    if (isPermissionTableUnavailable(modulesError)) return null;
    throw new Error(modulesError.message);
  }

  return mapProfileRow(
    profile as Record<string, unknown> | null,
    (modules ?? []) as Record<string, unknown>[]
  );
}

export async function listCustomizedPermissionProfiles(): Promise<UserPermissionOverrides[]> {
  if (!isSupabaseConfigured()) {
    return [...memoryProfiles.values()].filter((p) => p.isCustomized);
  }

  const supabase = await createClient();
  const { data: profiles, error } = await supabase
    .from("user_permission_profiles")
    .select("*")
    .eq("is_customized", true);
  if (error) {
    if (isPermissionTableUnavailable(error)) return [];
    throw new Error(error.message);
  }
  if (!profiles?.length) return [];

  const userIds = profiles.map((p) => String(p.user_id));
  const { data: modules, error: modError } = await supabase
    .from("user_permission_modules")
    .select("*")
    .in("user_id", userIds);
  if (modError) {
    if (isPermissionTableUnavailable(modError)) return [];
    throw new Error(modError.message);
  }

  const modulesByUser = new Map<string, Record<string, unknown>[]>();
  for (const row of modules ?? []) {
    const uid = String(row.user_id);
    const list = modulesByUser.get(uid) ?? [];
    list.push(row as Record<string, unknown>);
    modulesByUser.set(uid, list);
  }

  return profiles
    .map((p) =>
      mapProfileRow(p as Record<string, unknown>, modulesByUser.get(String(p.user_id)) ?? [])
    )
    .filter((p): p is UserPermissionOverrides => p != null);
}

export async function saveUserPermissionOverrides(
  overrides: UserPermissionOverrides
): Promise<UserPermissionOverrides> {
  const payload = {
    ...overrides,
    isCustomized: true,
  };

  if (!isSupabaseConfigured()) {
    memoryProfiles.set(payload.userId, payload);
    return payload;
  }

  const supabase = await createClient();
  const now = ts();

  const { error: profileError } = await supabase.from("user_permission_profiles").upsert({
    user_id: payload.userId,
    template_id: payload.templateId,
    is_customized: true,
    updated_at: now,
  });
  if (profileError) {
    if (isPermissionTableUnavailable(profileError)) {
      throw new Error(
        "Permission tables are not migrated yet. Apply migration 044_enterprise_permissions.sql in Supabase."
      );
    }
    throw new Error(profileError.message);
  }

  const moduleRows = Object.entries(payload.modules).map(([moduleId, module]) => ({
    user_id: payload.userId,
    module_id: moduleId,
    visibility: module.visibility ?? "visible",
    permissions: module.permissions ?? {},
    updated_at: now,
  }));

  if (moduleRows.length > 0) {
    const { error: modulesError } = await supabase
      .from("user_permission_modules")
      .upsert(moduleRows, { onConflict: "user_id,module_id" });
    if (modulesError) {
      if (isPermissionTableUnavailable(modulesError)) {
        throw new Error(
          "Permission tables are not migrated yet. Apply migration 044_enterprise_permissions.sql in Supabase."
        );
      }
      throw new Error(modulesError.message);
    }
  }

  return payload;
}

export async function resetUserPermissionOverrides(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    memoryProfiles.delete(userId);
    return;
  }

  const supabase = await createClient();
  const [{ error: modError }, { error: profileError }] = await Promise.all([
    supabase.from("user_permission_modules").delete().eq("user_id", userId),
    supabase.from("user_permission_profiles").delete().eq("user_id", userId),
  ]);
  if (modError && !isPermissionTableUnavailable(modError)) throw new Error(modError.message);
  if (profileError && !isPermissionTableUnavailable(profileError)) {
    throw new Error(profileError.message);
  }
}

export async function copyUserPermissionOverrides(
  sourceUserId: string,
  targetUserId: string
): Promise<UserPermissionOverrides | null> {
  const source = await getUserPermissionOverrides(sourceUserId);
  if (!source) return null;

  const copied: UserPermissionOverrides = {
    userId: targetUserId,
    templateId: source.templateId,
    isCustomized: true,
    modules: structuredClone(source.modules),
  };
  return saveUserPermissionOverrides(copied);
}

export async function applyTemplateToUser(
  userId: string,
  templateId: PermissionTemplateId
): Promise<UserPermissionOverrides> {
  const payload: UserPermissionOverrides = {
    userId,
    templateId,
    isCustomized: true,
    modules: {},
  };
  return saveUserPermissionOverrides(payload);
}
