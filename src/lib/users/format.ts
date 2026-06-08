import type { User } from "@/types/flow";

export function formatFullName(firstName: string, lastName?: string | null): string {
  return [firstName.trim(), lastName?.trim()].filter(Boolean).join(" ");
}

export function normalizeUser(row: Record<string, unknown>): User {
  const first = String(row.first_name ?? "").trim();
  const last = String(row.last_name ?? "").trim();
  const legacyFull = String(row.full_name ?? "").trim();
  const firstPart = first || (legacyFull ? legacyFull.split(" ")[0] : "");
  const lastPart =
    last || (legacyFull.includes(" ") ? legacyFull.split(" ").slice(1).join(" ") : "");
  const full_name = firstPart || legacyFull ? formatFullName(firstPart, lastPart) : legacyFull;

  return {
    id: String(row.id),
    email: String(row.email),
    first_name: first || full_name.split(" ")[0] || "",
    last_name: last || full_name.split(" ").slice(1).join(" ") || "",
    full_name,
    role: row.role as User["role"],
    team_id: (row.team_id as string | null) ?? null,
    manager_id: (row.manager_id as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    hire_date: (row.hire_date as string | null) ?? null,
    last_login_at: (row.last_login_at as string | null) ?? null,
    is_active: row.is_active !== false,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function userDisplayInitials(user: Pick<User, "first_name" | "last_name" | "full_name">): string {
  if (user.first_name) {
    return [user.first_name[0], user.last_name?.[0]].filter(Boolean).join("").toUpperCase();
  }
  return user.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
