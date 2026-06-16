import { writeAuditLog } from "@/lib/audit/audit-log";
import { normalizeRole } from "@/lib/auth/permissions";
import { formatFullName, normalizeUser } from "@/lib/users/format";
import { getAllUsers, updateUser, initFlowStore, getFlowStore } from "@/lib/data/flow-store";
import { syncHierarchyOnManagerChange } from "@/lib/hierarchy/resolver";
import { MOCK_TEAMS } from "@/lib/data/mock-data";
import { listTeamsStore } from "@/lib/data/flow-store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Team, User, UserRole } from "@/types/flow";

function mapDbUser(row: Record<string, unknown>): User {
  return { ...normalizeUser(row), role: normalizeRole(String(row.role)) };
}

export async function listTeams(): Promise<Team[]> {
  return listTeamsStore();
}

export async function listUsers(): Promise<User[]> {
  if (!isSupabaseConfigured()) {
    return getAllUsers().map((u) => ({ ...u, role: normalizeRole(u.role) }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("users").select("*").order("first_name");
  if (error) throw error;
  return (data ?? []).map((row) => mapDbUser(row as Record<string, unknown>));
}

export async function getUserById(userId: string): Promise<User | null> {
  const users = await listUsers();
  return users.find((u) => u.id === userId) ?? null;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<
    Pick<User, "first_name" | "last_name" | "role" | "team_id" | "manager_id" | "hire_date" | "is_active" | "avatar_url" | "pay_type" | "branch_view_access">
  >
): Promise<User | null> {
  const full_name =
    updates.first_name !== undefined || updates.last_name !== undefined
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
  return data ? mapDbUser(data as Record<string, unknown>) : null;
}

export async function updateUserRole(userId: string, role: UserRole): Promise<User | null> {
  const user = await updateUserProfile(userId, { role });
  if (user) {
    await writeAuditLog({
      action: "role_changed",
      entityType: "user",
      entityId: userId,
      summary: `Role changed to ${role} for ${user.full_name}`,
      metadata: { role },
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
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUserId)
    .maybeSingle();

  if (error) throw error;
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
