import { randomUUID } from "node:crypto";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  RequestTicket,
  RequestTicketPriority,
  RequestTicketView,
} from "@/types/flow";

/**
 * Request tickets: submitted by anyone, claimed first-come by the team,
 * tracked to done. Supabase-backed with an in-memory fallback for demo mode.
 * Claiming is race-safe: the DB update only lands if the row is still open.
 */

let memoryTickets: RequestTicket[] = [];

function ts() {
  return new Date().toISOString();
}

async function dbClient() {
  return isAdminConfigured() ? createAdminClient() : await createClient();
}

function mapRow(row: Record<string, unknown>): RequestTicket {
  return {
    id: String(row.id),
    title: String(row.title),
    details: row.details != null ? String(row.details) : null,
    priority: String(row.priority ?? "normal") as RequestTicket["priority"],
    requested_by: String(row.requested_by),
    status: String(row.status ?? "open") as RequestTicket["status"],
    claimed_by: row.claimed_by != null ? String(row.claimed_by) : null,
    claimed_at: row.claimed_at != null ? String(row.claimed_at) : null,
    completed_at: row.completed_at != null ? String(row.completed_at) : null,
    linked_task_id: row.linked_task_id != null ? String(row.linked_task_id) : null,
    paused_task_id: row.paused_task_id != null ? String(row.paused_task_id) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function enrich(tickets: RequestTicket[]): RequestTicketView[] {
  initFlowStore();
  const users = getFlowStore().users;
  const name = (id: string | null) =>
    id ? users.find((u) => u.id === id)?.full_name ?? id : null;
  return tickets.map((t) => ({
    ...t,
    requested_by_name: name(t.requested_by) ?? t.requested_by,
    claimed_by_name: name(t.claimed_by),
  }));
}

/** Open + claimed tickets — what the team's queue shows. */
export async function listActiveTickets(): Promise<RequestTicketView[]> {
  if (!isSupabaseConfigured()) {
    return enrich(
      memoryTickets
        .filter((t) => t.status === "open" || t.status === "claimed")
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
    );
  }
  const supabase = await dbClient();
  const { data, error } = await supabase
    .from("request_tickets")
    .select("*")
    .in("status", ["open", "claimed"])
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return enrich((data ?? []).map(mapRow));
}

/** Everything a requester has asked for, newest first. */
export async function listTicketsForRequester(userId: string): Promise<RequestTicketView[]> {
  if (!isSupabaseConfigured()) {
    return enrich(
      memoryTickets
        .filter((t) => t.requested_by === userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    );
  }
  const supabase = await dbClient();
  const { data, error } = await supabase
    .from("request_tickets")
    .select("*")
    .eq("requested_by", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return enrich((data ?? []).map(mapRow));
}

/** Full recent history for the manager view, newest first. */
export async function listRecentTickets(limit = 200): Promise<RequestTicketView[]> {
  if (!isSupabaseConfigured()) {
    return enrich(
      [...memoryTickets].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit)
    );
  }
  const supabase = await dbClient();
  const { data, error } = await supabase
    .from("request_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return enrich((data ?? []).map(mapRow));
}

export async function getTicketById(id: string): Promise<RequestTicket | null> {
  if (!isSupabaseConfigured()) {
    return memoryTickets.find((t) => t.id === id) ?? null;
  }
  const supabase = await dbClient();
  const { data, error } = await supabase
    .from("request_tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data) : null;
}

export async function createTicket(input: {
  title: string;
  details?: string | null;
  priority: RequestTicketPriority;
  requested_by: string;
}): Promise<RequestTicket> {
  const now = ts();
  const ticket: RequestTicket = {
    id: randomUUID(),
    title: input.title.trim().slice(0, 200),
    details: input.details?.trim().slice(0, 2000) || null,
    priority: input.priority,
    requested_by: input.requested_by,
    status: "open",
    claimed_by: null,
    claimed_at: null,
    completed_at: null,
    linked_task_id: null,
    paused_task_id: null,
    created_at: now,
    updated_at: now,
  };

  if (!isSupabaseConfigured()) {
    memoryTickets = [ticket, ...memoryTickets];
    return ticket;
  }
  const supabase = await dbClient();
  const { data, error } = await supabase
    .from("request_tickets")
    .insert({
      id: ticket.id,
      title: ticket.title,
      details: ticket.details,
      priority: ticket.priority,
      requested_by: ticket.requested_by,
      status: ticket.status,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

/**
 * First claim wins. Returns null when someone else already grabbed it —
 * the conditional update only lands while the row is still open.
 */
export async function claimTicket(id: string, userId: string): Promise<RequestTicket | null> {
  const now = ts();
  if (!isSupabaseConfigured()) {
    const ticket = memoryTickets.find((t) => t.id === id);
    if (!ticket || ticket.status !== "open") return null;
    const updated: RequestTicket = {
      ...ticket,
      status: "claimed",
      claimed_by: userId,
      claimed_at: now,
      updated_at: now,
    };
    memoryTickets = memoryTickets.map((t) => (t.id === id ? updated : t));
    return updated;
  }
  const supabase = await dbClient();
  const { data, error } = await supabase
    .from("request_tickets")
    .update({ status: "claimed", claimed_by: userId, claimed_at: now, updated_at: now })
    .eq("id", id)
    .eq("status", "open")
    .select("*");
  if (error) throw new Error(error.message);
  return data && data.length > 0 ? mapRow(data[0]) : null;
}

/** Record which task timer the claim paused, so closing the ticket resumes it. */
export async function setTicketPausedTask(
  id: string,
  taskId: string | null
): Promise<RequestTicket | null> {
  return updateTicket(id, { paused_task_id: taskId });
}

/** Put a claimed ticket back in the open queue. */
export async function releaseTicket(id: string): Promise<RequestTicket | null> {
  return updateTicket(id, {
    status: "open",
    claimed_by: null,
    claimed_at: null,
    paused_task_id: null,
  });
}

export async function completeTicket(id: string): Promise<RequestTicket | null> {
  return updateTicket(id, { status: "done", completed_at: ts(), paused_task_id: null });
}

export async function cancelTicket(id: string): Promise<RequestTicket | null> {
  return updateTicket(id, { status: "canceled" });
}

export async function linkTicketTask(id: string, taskId: string): Promise<RequestTicket | null> {
  return updateTicket(id, { linked_task_id: taskId });
}

async function updateTicket(
  id: string,
  patch: Partial<
    Pick<
      RequestTicket,
      | "status"
      | "claimed_by"
      | "claimed_at"
      | "completed_at"
      | "linked_task_id"
      | "paused_task_id"
    >
  >
): Promise<RequestTicket | null> {
  const now = ts();
  if (!isSupabaseConfigured()) {
    const ticket = memoryTickets.find((t) => t.id === id);
    if (!ticket) return null;
    const updated = { ...ticket, ...patch, updated_at: now } as RequestTicket;
    memoryTickets = memoryTickets.map((t) => (t.id === id ? updated : t));
    return updated;
  }
  const supabase = await dbClient();
  const { data, error } = await supabase
    .from("request_tickets")
    .update({ ...patch, updated_at: now })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data) : null;
}
