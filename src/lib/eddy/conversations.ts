import { randomUUID } from "node:crypto";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Eddy's per-user memory. Isolation is the contract: every function takes the
 * owner's userId and filters by it — a conversation id alone can never read
 * another user's thread. Supabase RLS enforces the same rule below us.
 */

export interface EddyMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  sources: { title: string; heading: string; slug: string }[] | null;
  page_path: string | null;
  created_at: string;
}

export interface EddyConversation {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

let memoryConversations: EddyConversation[] = [];
let memoryMessages: EddyMessage[] = [];

function ts() {
  return new Date().toISOString();
}

async function dbClient() {
  return isAdminConfigured() ? createAdminClient() : await createClient();
}

function mapConversation(row: Record<string, unknown>): EddyConversation {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: row.title != null ? String(row.title) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapMessage(row: Record<string, unknown>): EddyMessage {
  return {
    id: String(row.id),
    conversation_id: String(row.conversation_id),
    user_id: String(row.user_id),
    role: String(row.role) as EddyMessage["role"],
    content: String(row.content),
    sources: Array.isArray(row.sources) ? (row.sources as EddyMessage["sources"]) : null,
    page_path: row.page_path != null ? String(row.page_path) : null,
    created_at: String(row.created_at),
  };
}

/** The user's most recent thread, or a fresh one. Always owner-scoped. */
export async function getOrCreateConversation(userId: string): Promise<EddyConversation> {
  if (!isSupabaseConfigured()) {
    const latest = memoryConversations
      .filter((c) => c.user_id === userId)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    return latest ?? createConversation(userId);
  }
  const supabase = await dbClient();
  const { data, error } = await supabase
    .from("eddy_conversations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapConversation(data) : createConversation(userId);
}

export async function createConversation(userId: string): Promise<EddyConversation> {
  const now = ts();
  const conversation: EddyConversation = {
    id: randomUUID(),
    user_id: userId,
    title: null,
    created_at: now,
    updated_at: now,
  };
  if (!isSupabaseConfigured()) {
    memoryConversations = [conversation, ...memoryConversations];
    return conversation;
  }
  const supabase = await dbClient();
  const { data, error } = await supabase
    .from("eddy_conversations")
    .insert({ id: conversation.id, user_id: userId })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapConversation(data);
}

/** Messages in one thread — only when the thread belongs to userId. */
export async function listMessages(
  conversationId: string,
  userId: string,
  limit = 40
): Promise<EddyMessage[]> {
  if (!isSupabaseConfigured()) {
    return memoryMessages
      .filter((m) => m.conversation_id === conversationId && m.user_id === userId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(-limit);
  }
  const supabase = await dbClient();
  const { data, error } = await supabase
    .from("eddy_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapMessage);
}

export async function appendMessage(input: {
  conversationId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  sources?: EddyMessage["sources"];
  pagePath?: string | null;
}): Promise<EddyMessage> {
  const message: EddyMessage = {
    id: randomUUID(),
    conversation_id: input.conversationId,
    user_id: input.userId,
    role: input.role,
    content: input.content,
    sources: input.sources ?? null,
    page_path: input.pagePath ?? null,
    created_at: ts(),
  };

  if (!isSupabaseConfigured()) {
    // Ownership check mirrors the DB policy: no cross-user appends.
    const owns = memoryConversations.some(
      (c) => c.id === input.conversationId && c.user_id === input.userId
    );
    if (!owns) throw new Error("Conversation not found");
    memoryMessages = [...memoryMessages, message];
    memoryConversations = memoryConversations.map((c) =>
      c.id === input.conversationId
        ? {
            ...c,
            title: c.title ?? (input.role === "user" ? input.content.slice(0, 60) : c.title),
            updated_at: message.created_at,
          }
        : c
    );
    return message;
  }

  const supabase = await dbClient();
  // Verify ownership before writing — a stolen conversation id gets nothing.
  const { data: owned } = await supabase
    .from("eddy_conversations")
    .select("id, title")
    .eq("id", input.conversationId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!owned) throw new Error("Conversation not found");

  const { data, error } = await supabase
    .from("eddy_messages")
    .insert({
      id: message.id,
      conversation_id: message.conversation_id,
      user_id: message.user_id,
      role: message.role,
      content: message.content,
      sources: message.sources,
      page_path: message.page_path,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabase
    .from("eddy_conversations")
    .update({
      updated_at: message.created_at,
      ...(owned.title == null && input.role === "user"
        ? { title: input.content.slice(0, 60) }
        : {}),
    })
    .eq("id", input.conversationId)
    .eq("user_id", input.userId);

  return mapMessage(data);
}
