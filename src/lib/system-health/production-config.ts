import { isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/supabase/site-url";

export type ProductionConfigCheck = {
  id: string;
  label: string;
  status: "ok" | "warning" | "critical";
  detail: string;
};

export type ProductionConfigReport = {
  generatedAt: string;
  siteUrl: string;
  supabaseConfigured: boolean;
  demoMode: boolean;
  checks: ProductionConfigCheck[];
  issueCount: number;
  criticalCount: number;
};

const PRODUCTION_HOST = "flowproduction.space";

export function buildProductionConfigReport(): ProductionConfigReport {
  const siteUrl = getSiteUrl();
  const demoMode = process.env.NEXT_PUBLIC_FLOW_DEMO_MODE === "true";
  const supabaseConfigured = isSupabaseConfigured();
  const checks: ProductionConfigCheck[] = [];

  if (demoMode) {
    checks.push({
      id: "demo_mode",
      label: "Demo mode",
      status: "critical",
      detail: "NEXT_PUBLIC_FLOW_DEMO_MODE is true — production must use Supabase auth.",
    });
  } else {
    checks.push({
      id: "demo_mode",
      label: "Demo mode",
      status: "ok",
      detail: "Demo mode is off.",
    });
  }

  if (!supabaseConfigured) {
    checks.push({
      id: "supabase",
      label: "Supabase",
      status: "critical",
      detail: "Supabase URL or anon key missing.",
    });
  } else {
    checks.push({
      id: "supabase",
      label: "Supabase",
      status: "ok",
      detail: "Supabase client env vars are set.",
    });
  }

  if (supabaseConfigured && !isAdminConfigured()) {
    checks.push({
      id: "service_role",
      label: "Service role key",
      status: "critical",
      detail:
        "SUPABASE_SERVICE_ROLE_KEY missing — clock-in, wrap-ups, invites, and user delete will not persist.",
    });
  } else if (supabaseConfigured) {
    checks.push({
      id: "service_role",
      label: "Service role key",
      status: "ok",
      detail: "Admin/service role key is configured.",
    });
  }

  const isLocalSite =
    siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1");
  const isProductionSite = siteUrl.includes(PRODUCTION_HOST);

  if (process.env.VERCEL_ENV === "production" && isLocalSite) {
    checks.push({
      id: "site_url",
      label: "Public site URL",
      status: "critical",
      detail: `Production resolves to ${siteUrl}. Set NEXT_PUBLIC_SITE_URL to https://${PRODUCTION_HOST}.`,
    });
  } else if (isProductionSite || !process.env.VERCEL) {
    checks.push({
      id: "site_url",
      label: "Public site URL",
      status: "ok",
      detail: siteUrl,
    });
  } else {
    checks.push({
      id: "site_url",
      label: "Public site URL",
      status: "warning",
      detail: `${siteUrl} — verify this matches your deployment host.`,
    });
  }

  checks.push({
    id: "auth_confirm",
    label: "Auth confirm route",
    status: "ok",
    detail: `Password reset / invite links should target ${siteUrl}/auth/confirm?next=…`,
  });

  checks.push({
    id: "supabase_redirects",
    label: "Supabase redirect URLs (manual)",
    status: "warning",
    detail: `In Supabase → Auth → URL config, allow ${siteUrl}/auth/confirm and ${siteUrl}/auth/callback (with /** wildcards). Site URL should be https://${PRODUCTION_HOST}.`,
  });

  const criticalCount = checks.filter((c) => c.status === "critical").length;

  return {
    generatedAt: new Date().toISOString(),
    siteUrl,
    supabaseConfigured,
    demoMode,
    checks,
    issueCount: checks.filter((c) => c.status !== "ok").length,
    criticalCount,
  };
}
