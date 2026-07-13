import { randomUUID } from "node:crypto";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  CoachingCategory,
  CoachingLevel,
  CoachingSession,
  CoachingSessionView,
} from "@/types/flow";

/**
 * Coaching records — sensitive accountability data. Supabase-backed with an
 * in-memory fallback for demo mode. Reads are permission-gated in the
 * actions/pages; this module is storage only.
 */

let memorySessions: CoachingSession[] = [];

function ts() {
  return new Date().toISOString();
}

async function dbClient() {
  return isAdminConfigured() ? createAdminClient() : await createClient();
}

function mapRow(row: Record<string, unknown>): CoachingSession {
  return {
    id: String(row.id),
    employee_id: String(row.employee_id),
    coach_id: String(row.coach_id),
    session_date: String(row.session_date),
    category: String(row.category ?? "other") as CoachingCategory,
    level: String(row.level ?? "coaching") as CoachingLevel,
    summary: String(row.summary ?? ""),
    expectation: row.expectation != null ? String(row.expectation) : null,
    follow_up_date: row.follow_up_date != null ? String(row.follow_up_date) : null,
    status: String(row.status ?? "open") as CoachingSession["status"],
    resolved_at: row.resolved_at != null ? String(row.resolved_at) : null,
    resolution_note: row.resolution_note != null ? String(row.resolution_note) : null,
    acknowledged_at: row.acknowledged_at != null ? String(row.acknowledged_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function enrich(sessions: CoachingSession[]): CoachingSessionView[] {
  initFlowStore();
  const users = getFlowStore().users;
  const name = (id: string) => users.find((u) => u.id === id)?.full_name ?? id;
  return sessions.map((s) => ({
    ...s,
    employee_name: name(s.employee_id),
    coach_name: name(s.coach_id),
  }));
}

export async function listCoachingSessions(filters?: {
  employeeId?: string;
  status?: "open" | "resolved";
}): Promise<CoachingSessionView[]> {
  if (!isSupabaseConfigured()) {
    let sessions = [...memorySessions];
    if (filters?.employeeId) sessions = sessions.filter((s) => s.employee_id === filters.employeeId);
    if (filters?.status) sessions = sessions.filter((s) => s.status === filters.status);
    return enrich(sessions.sort((a, b) => b.session_date.localeCompare(a.session_date)));
  }
  const supabase = await dbClient();
  let query = supabase
    .from("coaching_sessions")
    .select("*")
    .order("session_date", { ascending: false })
    .limit(300);
  if (filters?.employeeId) query = query.eq("employee_id", filters.employeeId);
  if (filters?.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return enrich((data ?? []).map(mapRow));
}

export async function getCoachingSessionById(id: string): Promise<CoachingSession | null> {
  if (!isSupabaseConfigured()) {
    return memorySessions.find((s) => s.id === id) ?? null;
  }
  const supabase = await dbClient();
  const { data, error } = await supabase
    .from("coaching_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data) : null;
}

export async function createCoachingSession(input: {
  employee_id: string;
  coach_id: string;
  session_date: string;
  category: CoachingCategory;
  level: CoachingLevel;
  summary: string;
  expectation?: string | null;
  follow_up_date?: string | null;
}): Promise<CoachingSession> {
  const now = ts();
  const session: CoachingSession = {
    id: randomUUID(),
    employee_id: input.employee_id,
    coach_id: input.coach_id,
    session_date: input.session_date,
    category: input.category,
    level: input.level,
    summary: input.summary.trim().slice(0, 4000),
    expectation: input.expectation?.trim().slice(0, 2000) || null,
    follow_up_date: input.follow_up_date || null,
    status: "open",
    resolved_at: null,
    resolution_note: null,
    acknowledged_at: null,
    created_at: now,
    updated_at: now,
  };

  if (!isSupabaseConfigured()) {
    memorySessions = [session, ...memorySessions];
    return session;
  }
  const supabase = await dbClient();
  const { data, error } = await supabase
    .from("coaching_sessions")
    .insert({
      id: session.id,
      employee_id: session.employee_id,
      coach_id: session.coach_id,
      session_date: session.session_date,
      category: session.category,
      level: session.level,
      summary: session.summary,
      expectation: session.expectation,
      follow_up_date: session.follow_up_date,
      status: session.status,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function acknowledgeCoachingSession(id: string): Promise<CoachingSession | null> {
  return patchSession(id, { acknowledged_at: ts() });
}

export async function resolveCoachingSession(
  id: string,
  note?: string | null
): Promise<CoachingSession | null> {
  return patchSession(id, {
    status: "resolved",
    resolved_at: ts(),
    resolution_note: note?.trim().slice(0, 2000) || null,
  });
}

async function patchSession(
  id: string,
  patch: Partial<
    Pick<CoachingSession, "status" | "resolved_at" | "resolution_note" | "acknowledged_at">
  >
): Promise<CoachingSession | null> {
  const now = ts();
  if (!isSupabaseConfigured()) {
    const session = memorySessions.find((s) => s.id === id);
    if (!session) return null;
    const updated = { ...session, ...patch, updated_at: now } as CoachingSession;
    memorySessions = memorySessions.map((s) => (s.id === id ? updated : s));
    return updated;
  }
  const supabase = await dbClient();
  const { data, error } = await supabase
    .from("coaching_sessions")
    .update({ ...patch, updated_at: now })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data) : null;
}
