import { randomUUID } from "node:crypto";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Personal to-do list — Eddy Phase 2's first scoped tool. Same isolation
 * contract as eddy conversations: every function takes the owner's userId and
 * filters by it; RLS enforces the same rule below the app. Eddy's tool calls
 * route through here too, so he can only ever touch the asking user's list.
 */

export interface UserTodo {
  id: string;
  user_id: string;
  title: string;
  context: string | null;
  status: "open" | "done";
  sort_order: number;
  source: "manual" | "eddy";
  created_at: string;
  completed_at: string | null;
  updated_at: string;
}

let memoryTodos: UserTodo[] = [];

function ts() {
  return new Date().toISOString();
}

async function dbClient() {
  return isAdminConfigured() ? createAdminClient() : await createClient();
}

function mapRow(row: Record<string, unknown>): UserTodo {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: String(row.title),
    context: row.context != null ? String(row.context) : null,
    status: row.status === "done" ? "done" : "open",
    sort_order: Number(row.sort_order ?? 0),
    source: row.source === "eddy" ? "eddy" : "manual",
    created_at: String(row.created_at),
    completed_at: row.completed_at != null ? String(row.completed_at) : null,
    updated_at: String(row.updated_at),
  };
}

function sortTodos(list: UserTodo[]): UserTodo[] {
  return [...list].sort(
    (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)
  );
}

export async function listTodos(
  userId: string,
  opts: { includeDone?: boolean } = {}
): Promise<UserTodo[]> {
  if (!isSupabaseConfigured()) {
    return sortTodos(
      memoryTodos.filter(
        (t) => t.user_id === userId && (opts.includeDone || t.status === "open")
      )
    );
  }
  const supabase = await dbClient();
  let query = supabase.from("user_todos").select("*").eq("user_id", userId);
  if (!opts.includeDone) query = query.eq("status", "open");
  const { data, error } = await query.order("sort_order").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function addTodo(
  userId: string,
  input: { title: string; context?: string | null; source?: "manual" | "eddy" }
): Promise<UserTodo> {
  const title = input.title.trim().slice(0, 300);
  if (!title) throw new Error("A to-do needs a title");
  const open = await listTodos(userId);
  const todo: UserTodo = {
    id: randomUUID(),
    user_id: userId,
    title,
    context: input.context?.trim().slice(0, 1000) || null,
    status: "open",
    sort_order: (open[open.length - 1]?.sort_order ?? 0) + 1,
    source: input.source ?? "manual",
    created_at: ts(),
    completed_at: null,
    updated_at: ts(),
  };
  if (!isSupabaseConfigured()) {
    memoryTodos = [...memoryTodos, todo];
    return todo;
  }
  const supabase = await dbClient();
  const { data, error } = await supabase
    .from("user_todos")
    .insert({
      id: todo.id,
      user_id: todo.user_id,
      title: todo.title,
      context: todo.context,
      status: todo.status,
      sort_order: todo.sort_order,
      source: todo.source,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function setTodoStatus(
  userId: string,
  todoId: string,
  status: "open" | "done"
): Promise<UserTodo | null> {
  const completed_at = status === "done" ? ts() : null;
  if (!isSupabaseConfigured()) {
    let updated: UserTodo | null = null;
    memoryTodos = memoryTodos.map((t) => {
      if (t.id !== todoId || t.user_id !== userId) return t;
      updated = { ...t, status, completed_at, updated_at: ts() };
      return updated;
    });
    return updated;
  }
  const supabase = await dbClient();
  const { data, error } = await supabase
    .from("user_todos")
    .update({ status, completed_at, updated_at: ts() })
    .eq("id", todoId)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function deleteTodo(userId: string, todoId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    memoryTodos = memoryTodos.filter((t) => !(t.id === todoId && t.user_id === userId));
    return;
  }
  const supabase = await dbClient();
  const { error } = await supabase
    .from("user_todos")
    .delete()
    .eq("id", todoId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Move an open item one slot up or down (swap sort_order with its neighbor). */
export async function moveTodo(
  userId: string,
  todoId: string,
  direction: "up" | "down"
): Promise<void> {
  const open = await listTodos(userId);
  const index = open.findIndex((t) => t.id === todoId);
  if (index === -1) return;
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= open.length) return;
  const a = open[index];
  const b = open[swapWith];
  // Ensure distinct orders even if legacy rows share one.
  const orderA = b.sort_order === a.sort_order ? a.sort_order + (direction === "up" ? -1 : 1) : b.sort_order;
  const orderB = a.sort_order;

  if (!isSupabaseConfigured()) {
    memoryTodos = memoryTodos.map((t) =>
      t.id === a.id
        ? { ...t, sort_order: orderA, updated_at: ts() }
        : t.id === b.id
          ? { ...t, sort_order: orderB, updated_at: ts() }
          : t
    );
    return;
  }
  const supabase = await dbClient();
  await supabase
    .from("user_todos")
    .update({ sort_order: orderA, updated_at: ts() })
    .eq("id", a.id)
    .eq("user_id", userId);
  await supabase
    .from("user_todos")
    .update({ sort_order: orderB, updated_at: ts() })
    .eq("id", b.id)
    .eq("user_id", userId);
}

/** Test seam. */
export function replaceTodoMemoryState(todos: UserTodo[]): void {
  memoryTodos = todos;
}
