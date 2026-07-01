import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/supabase/site-url";

export type RuntimeHealthCheck = {
  id: string;
  label: string;
  status: "ok" | "warning" | "critical" | "skipped";
  detail: string;
};

export type RuntimeHealthReport = {
  generatedAt: string;
  supabaseConfigured: boolean;
  checks: RuntimeHealthCheck[];
  criticalCount: number;
  issueCount: number;
};

const SPOT_CHECK_TABLES = [
  "users",
  "time_clock_entries",
  "task_time_entries",
  "daily_wrap_ups",
  "work_items",
  "projects",
  "audit_log",
  "task_submission_records",
];

function pushCheck(checks: RuntimeHealthCheck[], check: RuntimeHealthCheck) {
  checks.push(check);
}

function finalize(checks: RuntimeHealthCheck[]): RuntimeHealthReport {
  const criticalCount = checks.filter((c) => c.status === "critical").length;
  return {
    generatedAt: new Date().toISOString(),
    supabaseConfigured: isSupabaseConfigured(),
    checks,
    criticalCount,
    issueCount: checks.filter((c) => c.status === "critical" || c.status === "warning").length,
  };
}

export async function buildRuntimeHealthReport(): Promise<RuntimeHealthReport> {
  const checks: RuntimeHealthCheck[] = [];
  const siteUrl = getSiteUrl();

  if (!isSupabaseConfigured()) {
    pushCheck(checks, {
      id: "supabase_mode",
      label: "Supabase runtime",
      status: "skipped",
      detail: "Demo mode or Supabase env not configured — live DB checks skipped.",
    });
    return finalize(checks);
  }

  pushCheck(checks, {
    id: "supabase_mode",
    label: "Supabase runtime",
    status: "ok",
    detail: "Production auth and persistence mode active.",
  });

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      cache: "no-store",
    });
    pushCheck(checks, {
      id: "auth_health",
      label: "Auth service",
      status: res.ok ? "ok" : "critical",
      detail: res.ok ? "Supabase Auth is reachable." : `Auth health returned HTTP ${res.status}.`,
    });
  } catch (e) {
    pushCheck(checks, {
      id: "auth_health",
      label: "Auth service",
      status: "critical",
      detail: e instanceof Error ? e.message : "Auth health check failed",
    });
  }

  if (!isAdminConfigured()) {
    pushCheck(checks, {
      id: "service_role",
      label: "Service role",
      status: "critical",
      detail: "SUPABASE_SERVICE_ROLE_KEY missing — invites, clock-in, and wrap-ups will not persist.",
    });
    return finalize(checks);
  }

  pushCheck(checks, {
    id: "service_role",
    label: "Service role",
    status: "ok",
    detail: "Admin client configured for server writes.",
  });

  const admin = createAdminClient();

  for (const table of SPOT_CHECK_TABLES) {
    const { error } = await admin.from(table).select("id", { count: "exact", head: true });
    if (error) {
      pushCheck(checks, {
        id: `table_${table}`,
        label: `Table: ${table}`,
        status: error.message.includes("does not exist") ? "critical" : "warning",
        detail: error.message.includes("does not exist")
          ? `Missing table ${table} — run migrations.`
          : error.message,
      });
    }
  }

  const { count: activeUsers, error: usersErr } = await admin
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  if (!usersErr) {
    pushCheck(checks, {
      id: "active_users",
      label: "Active users",
      status: "ok",
      detail: `${activeUsers ?? 0} active profiles in public.users.`,
    });
  }

  const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const authIds = new Set((authList?.users ?? []).map((u) => u.id));
  const { data: profiles } = await admin.from("users").select("id");
  const profileIds = new Set((profiles ?? []).map((p) => p.id));
  const missingProfiles = [...authIds].filter((id) => !profileIds.has(id));
  if (missingProfiles.length > 0) {
    pushCheck(checks, {
      id: "auth_missing_profile",
      label: "Auth users without Flow profile",
      status: "critical",
      detail: `${missingProfiles.length} Supabase auth account(s) have no public.users row.`,
    });
  } else if (authIds.size > 0) {
    pushCheck(checks, {
      id: "auth_missing_profile",
      label: "Auth users without Flow profile",
      status: "ok",
      detail: "All auth accounts have matching profiles.",
    });
  }

  const { count: openClocks } = await admin
    .from("time_clock_entries")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  if ((openClocks ?? 0) > 0) {
    pushCheck(checks, {
      id: "open_clock_entries",
      label: "Open clock entries",
      status: "warning",
      detail: `${openClocks} active clock entries in database (may be in-progress shifts).`,
    });
  }

  pushCheck(checks, {
    id: "invite_redirect",
    label: "Invite / reset redirect",
    status: "ok",
    detail: `Email links should use ${siteUrl}/auth/confirm?next=…`,
  });

  return finalize(checks);
}
