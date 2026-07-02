"use server";

import { appTodayDate } from "@/lib/datetime/timezone";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { requireUser } from "@/lib/auth/session";
import { hasAnyPermission } from "@/lib/auth/permissions";
import type {
  PortfolioIntelligenceSummary,
  ProgramIntelligence,
  ProgramRiskTier,
} from "@/lib/projects/project-intelligence";
import { format, subDays } from "date-fns";

function isUnavailable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return (error.message ?? "").includes("does not exist");
}

async function requireIntelligenceAccess() {
  const user = await requireUser();
  if (
    !hasAnyPermission(user.role, [
      "reports:view_all",
      "reports:view_team",
      "reports:view_qa",
    ])
  ) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export async function recordProgramSnapshotAction(intel: ProgramIntelligence): Promise<void> {
  await requireIntelligenceAccess();
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  const date = appTodayDate();

  await supabase
    .from("project_intelligence_snapshots")
    .delete()
    .eq("snapshot_date", date)
    .eq("scope", "program")
    .eq("project_id", intel.projectId);

  const { error } = await supabase.from("project_intelligence_snapshots").insert({
    snapshot_date: date,
    scope: "program",
    project_id: intel.projectId,
    health_score: intel.healthScore,
    capacity_load_pct: intel.capacityLoadPct,
    risk_tier: intel.riskTier,
  });
  if (error && !isUnavailable(error)) throw new Error(error.message);
}

export async function recordPortfolioSnapshotAction(
  summary: PortfolioIntelligenceSummary
): Promise<void> {
  await requireIntelligenceAccess();
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  const date = appTodayDate();

  await supabase
    .from("project_intelligence_snapshots")
    .delete()
    .eq("snapshot_date", date)
    .eq("scope", "portfolio")
    .is("project_id", null);

  const { error } = await supabase.from("project_intelligence_snapshots").insert({
    snapshot_date: date,
    scope: "portfolio",
    project_id: null,
    avg_health_score: summary.avgHealthScore,
    avg_capacity_load_pct: summary.avgCapacityLoadPct,
    at_risk_count: summary.atRiskCount + summary.criticalCount,
  });
  if (error && !isUnavailable(error)) throw new Error(error.message);
}

export async function getProgramTrendAction(
  projectId: string,
  days = 14
): Promise<
  {
    date: string;
    label: string;
    healthScore: number;
    capacityLoadPct: number;
    riskTier: ProgramRiskTier;
  }[]
> {
  await requireIntelligenceAccess();
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const cutoff = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
  const { data, error } = await supabase
    .from("project_intelligence_snapshots")
    .select("snapshot_date, health_score, capacity_load_pct, risk_tier")
    .eq("scope", "program")
    .eq("project_id", projectId)
    .gte("snapshot_date", cutoff)
    .order("snapshot_date", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    date: String(row.snapshot_date),
    label: format(new Date(`${row.snapshot_date}T12:00:00`), "MMM d"),
    healthScore: Number(row.health_score ?? 0),
    capacityLoadPct: Number(row.capacity_load_pct ?? 0),
    riskTier: (row.risk_tier as ProgramRiskTier) ?? "watch",
  }));
}

export async function getPortfolioTrendAction(days = 14) {
  await requireIntelligenceAccess();
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const cutoff = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
  const { data, error } = await supabase
    .from("project_intelligence_snapshots")
    .select("snapshot_date, avg_health_score, avg_capacity_load_pct, at_risk_count")
    .eq("scope", "portfolio")
    .is("project_id", null)
    .gte("snapshot_date", cutoff)
    .order("snapshot_date", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    date: String(row.snapshot_date),
    label: format(new Date(`${row.snapshot_date}T12:00:00`), "MMM d"),
    avgHealthScore: Number(row.avg_health_score ?? 0),
    avgCapacityLoadPct: Number(row.avg_capacity_load_pct ?? 0),
    atRiskCount: Number(row.at_risk_count ?? 0),
  }));
}
