import { writeAuditLog } from "@/lib/audit/audit-log";
import {
  deriveOrganizationalPositionFromRole,
  deriveSystemAccessLevelFromRole,
  hydrateUserAccessFields,
  syncLegacyRoleFromAccessFields,
} from "@/lib/auth/access-level";
import { normalizeRole } from "@/lib/auth/permissions";
import { formatFullName, normalizeUser } from "@/lib/users/format";
import { getAllUsers, updateUser, initFlowStore, getFlowStore, setStoreUsers } from "@/lib/data/flow-store";
import { syncHierarchyOnManagerChange } from "@/lib/hierarchy/resolver";
import { MOCK_TEAMS } from "@/lib/data/mock-data";
import { listTeamsStore } from "@/lib/data/flow-store";
import { ensureDepartmentsLoaded } from "@/lib/data/departments-db";
import { isHydrationFresh, markHydrated } from "@/lib/data/hydration-cache";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { EmploymentStatus, OrganizationalPosition, SystemAccessLevel, Team, User, UserRole } from "@/types/flow";

function mapDbUser(row: Record<string, unknown>): User {
  return hydrateUserAccessFields({
    ...normalizeUser(row),
    role: normalizeRole(String(row.role)),
  });
}

export async function listTeams(): Promise<Team[]> {
  return listTeamsStore();
}

export async function listUsers(): Promise<User[]> {
  if (!isSupabaseConfigured()) {
    return getAllUsers().map((u) => hydrateUserAccessFields({ ...u, role: normalizeRole(u.role) }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("users").select("*").order("first_name").order("last_name").order("id");
  if (error) throw error;
  return (data ?? []).map((row) => mapDbUser(row as Record<string, unknown>));
}

/** Load real users into the in-memory store for Supabase deployments. */
export async function hydrateAppStore(options?: { force?: boolean }): Promise<User[]> {
  initFlowStore();
  if (!isSupabaseConfigured()) {
    return getAllUsers();
  }
  if (!options?.force && isHydrationFresh("users")) {
    return getAllUsers();
  }
  // Users and department structure are independent fetches; hierarchy init
  // needs both in the store, so it runs after the pair resolves.
  const [users] = await Promise.all([listUsers(), ensureDepartmentsLoaded()]);
  setStoreUsers(users);
  const { initHierarchyFromStore } = await import("@/lib/auth/team-scope");
  initHierarchyFromStore(users);
  markHydrated("users");
  return users;
}

export async function getUserById(userId: string): Promise<User | null> {
  const users = await listUsers();
  return users.find((u) => u.id === userId) ?? null;
}

async function revokeUserSessions(userId: string): Promise<void> {
  if (!isSupabaseConfigured() || !isAdminConfigured()) return;
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.signOut(userId, "global");
  if (error) console.error("[users] session revoke failed", error.message);
}

async function patchStoreUser(updated: User): Promise<void> {
  initFlowStore();
  const store = getFlowStore();
  const idx = store.users.findIndex((u) => u.id === updated.id);
  if (idx < 0) return;
  const next = [...store.users];
  next[idx] = updated;
  setStoreUsers(next);
}

async function onUserDeactivated(userId: string): Promise<void> {
  await revokeUserSessions(userId);
  if (!isSupabaseConfigured()) {
    const { getDemoUserId, clearDemoSession } = await import("@/lib/auth/demo-session");
    if ((await getDemoUserId()) === userId) await clearDemoSession();
  }
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<
    Pick<
      User,
      | "first_name"
      | "last_name"
      | "full_name"
      | "role"
      | "organizational_position"
      | "system_access_level"
      | "team_id"
      | "manager_id"
      | "assigned_position_id"
      | "hire_date"
      | "is_active"
      | "avatar_url"
      | "pay_type"
      | "branch_view_access"
      | "phone"
      | "job_title"
      | "employment_status"
    >
  >
): Promise<User | null> {
  const full_name =
    updates.full_name !== undefined
      ? updates.full_name.trim()
      : updates.first_name !== undefined || updates.last_name !== undefined
        ? formatFullName(
            updates.first_name ?? "",
            updates.last_name ?? ""
          )
        : undefined;

  const payload = {
    ...updates,
    ...(full_name ? { full_name } : {}),
    updated_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    const updated = updateUser(userId, payload);
    if (updated && updates.is_active === false) await onUserDeactivated(userId);
    if (updated && updates.manager_id !== undefined) {
      initFlowStore();
      syncHierarchyOnManagerChange(
        userId,
        updates.manager_id,
        getFlowStore().users,
        updates.team_id ?? updated.team_id
      );
    }
    return updated;
  }

  const client = isAdminConfigured() ? createAdminClient() : await createClient();
  const { data, error } = await client
    .from("users")
    .update(payload)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  const updated = data ? mapDbUser(data as Record<string, unknown>) : null;
  if (updated) {
    await patchStoreUser(updated);
    if (updates.is_active === false) await onUserDeactivated(userId);
  }
  if (updated && updates.manager_id !== undefined) {
    initFlowStore();
    syncHierarchyOnManagerChange(
      userId,
      updates.manager_id,
      getFlowStore().users,
      updates.team_id ?? updated.team_id
    );
  }
  return updated;
}

export async function updateUserRole(
  userId: string,
  role: UserRole,
  options?: { reason?: string; changedBy?: { id: string; email: string } }
): Promise<User | null> {
  const before = await getUserById(userId);
  const user = await updateUserProfile(userId, {
    role,
    organizational_position: deriveOrganizationalPositionFromRole(role),
    system_access_level: deriveSystemAccessLevelFromRole(role),
  });
  if (user && before) {
    await writeAuditLog({
      action: "role_changed",
      entityType: "user",
      entityId: userId,
      summary: `Role changed from ${before.role} to ${role} for ${user.full_name}`,
      metadata: {
        previous_role: before.role,
        new_role: role,
        reason: options?.reason ?? null,
      },
      actorId: options?.changedBy?.id,
      actorEmail: options?.changedBy?.email,
    });
  }
  return user;
}

export async function updateUserAccessLevels(
  userId: string,
  organizationalPosition: OrganizationalPosition,
  systemAccessLevel: SystemAccessLevel,
  options?: { reason?: string; changedBy?: { id: string; email: string } }
): Promise<User | null> {
  const before = await getUserById(userId);
  const syncedRole = syncLegacyRoleFromAccessFields(organizationalPosition, systemAccessLevel);
  const user = await updateUserProfile(userId, {
    organizational_position: organizationalPosition,
    system_access_level: systemAccessLevel,
    role: syncedRole,
  });
  if (user && before) {
    await writeAuditLog({
      action: "role_changed",
      entityType: "user",
      entityId: userId,
      summary: `Access updated for ${user.full_name}: ${organizationalPosition} / ${systemAccessLevel}`,
      metadata: {
        previous_role: before.role,
        new_role: syncedRole,
        organizational_position: organizationalPosition,
        system_access_level: systemAccessLevel,
        reason: options?.reason ?? null,
      },
      actorId: options?.changedBy?.id,
      actorEmail: options?.changedBy?.email,
    });
  }
  return user;
}

export async function setUserActive(userId: string, isActive: boolean): Promise<User | null> {
  const user = await updateUserProfile(userId, { is_active: isActive });
  if (user) {
    await writeAuditLog({
      action: isActive ? "user_reactivated" : "user_disabled",
      entityType: "user",
      entityId: userId,
      summary: `${user.full_name} ${isActive ? "reactivated" : "disabled"}`,
    });
  }
  return user;
}

export async function recordLastLogin(userId: string): Promise<void> {
  const ts = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    updateUser(userId, { last_login_at: ts });
    return;
  }
  const client = isAdminConfigured() ? createAdminClient() : await createClient();
  await client.from("users").update({ last_login_at: ts }).eq("id", userId);
}

export async function getUserProfileByAuthId(authUserId: string): Promise<User | null> {
  if (!isSupabaseConfigured()) {
    return getAllUsers().find((u) => u.id === authUserId) ?? null;
  }

  const supabase = await createClient();
  return getUserProfileByAuthIdWithClient(supabase, authUserId);
}

/** Prefer this right after sign-in so the session stays on the same Supabase client. */
export async function getUserProfileByAuthIdWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authUserId: string
): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUserId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Could not load your profile");
  }
  if (!data) return null;
  return mapDbUser(data as Record<string, unknown>);
}

export async function createUserRecord(
  user: Omit<User, "created_at" | "updated_at"> & { id: string }
): Promise<User> {
  const now = new Date().toISOString();
  const record: User = {
    ...user,
    full_name: formatFullName(user.first_name, user.last_name),
    created_at: now,
    updated_at: now,
  };

  if (!isSupabaseConfigured()) {
    const { getAllUsers: _g, updateUser: _u } = await import("@/lib/data/flow-store");
    const existing = getAllUsers();
    const idx = existing.findIndex((u) => u.id === record.id);
    if (idx >= 0) {
      return updateUser(record.id, record) ?? record;
    }
    const { MOCK_USERS } = await import("@/lib/data/mock-data");
    MOCK_USERS.push(record);
    return record;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from("users").upsert(record).select().single();
  if (error) throw error;
  return mapDbUser(data as Record<string, unknown>);
}

function isOptionalTableError(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "42703") return true;
  return Boolean(error.message?.includes("does not exist"));
}

/** Clear FK references that would block auth user deletion. */
async function detachUserReferences(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<void> {
  const ops: Array<PromiseLike<{ error: { code?: string; message?: string } | null }>> = [
    admin.from("org_positions").update({ assigned_user_id: null, status: "vacant" }).eq("assigned_user_id", userId),
    admin.from("users").update({ manager_id: null }).eq("manager_id", userId),
    admin.from("users").update({ assigned_position_id: null }).eq("id", userId),
    admin.from("teams").update({ manager_id: null }).eq("manager_id", userId),
    admin.from("teams").update({ team_lead_user_id: null }).eq("team_lead_user_id", userId),
    admin.from("departments").update({ lead_user_id: null }).eq("lead_user_id", userId),
    admin.from("projects").update({ project_owner_id: null }).eq("project_owner_id", userId),
    admin.from("work_items").update({ assigned_to: null }).eq("assigned_to", userId),
    admin.from("year_work_items").update({ assigned_to: null }).eq("assigned_to", userId),
    admin.from("time_clock_entries").update({ edited_by: null }).eq("edited_by", userId),
    admin.from("department_users").delete().eq("user_id", userId),
    admin.from("user_hierarchy").delete().or(`user_id.eq.${userId},parent_user_id.eq.${userId}`),
    admin.from("qa_review_records").delete().eq("reviewer_id", userId),
  ];

  for (const op of ops) {
    const { error } = await op;
    if (error && !isOptionalTableError(error)) {
      throw new Error(error.message || "Could not detach user references");
    }
  }
}

export async function deleteUserAccount(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    initFlowStore();
    const { MOCK_USERS } = await import("@/lib/data/mock-data");
    const idx = MOCK_USERS.findIndex((u) => u.id === userId);
    if (idx < 0) throw new Error("User not found");
    MOCK_USERS.splice(idx, 1);
    setStoreUsers(getAllUsers());
    return;
  }

  if (!isAdminConfigured()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY required to delete users");
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("id, email")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile) {
    const { error: authOnlyError } = await admin.auth.admin.deleteUser(userId);
    if (authOnlyError && authOnlyError.message !== "User not found") {
      throw new Error(authOnlyError.message);
    }
    return;
  }

  await detachUserReferences(admin, userId);

  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) throw new Error(authError.message);
}
