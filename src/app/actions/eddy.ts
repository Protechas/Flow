"use server";

import type Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/auth/session";
import { AI_MODELS, getAiClient, isAiEnabled } from "@/lib/ai/client";
import { capText } from "@/lib/ai/allowlist";
import { logAiUsage } from "@/lib/ai/usage";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import {
  appendMessage,
  createConversation,
  getOrCreateConversation,
  listMessages,
  type EddyMessage,
} from "@/lib/eddy/conversations";
import { addTodo, listTodos, setTodoStatus } from "@/lib/eddy/todos";
import { buildEddyPageContext } from "@/lib/eddy/page-context";
import { searchDocs } from "@/lib/ask-flow/search";

export interface AskEddyResult {
  ok: boolean;
  conversationId: string | null;
  messages: EddyMessage[];
  contextLabel?: string | null;
  message?: string;
}

const HISTORY_TURNS = 12;

const SYSTEM_PROMPT_BASE =
  "You are Eddy, Flow's built-in assistant. Flow is Protech's operations platform for " +
  "its analyst teams. You are advisory, with ONE hands-on capability: the user's personal " +
  "to-do list, which you manage with your todo tools when they ask (add / list / complete). " +
  "For everything else you never claim to have performed actions, and you never invent " +
  "features or data. Ground answers in the manual excerpts and page context provided; when " +
  "they don't cover the question, say so plainly and suggest asking a lead or filing it in " +
  "the Innovation Hub. Be concise and practical. You are talking to one specific user — " +
  "their conversation history and to-do list are theirs alone.\n" +
  "To-do rules: act only on this user's own list, only when they ask. When they say things " +
  'like "add X to my list" capture a short title plus any useful context they gave. When ' +
  "marking something done, call todo_list first and use the item's real id — never invent " +
  "ids. After a tool call, confirm plainly what changed. The list lives in the My List tab " +
  "of this panel.";

/**
 * Eddy Phase 2 scoped tools — the ONLY writes Eddy can perform, and every one
 * is confined to the asking user's own to-do list (enforced again in
 * lib/eddy/todos by userId and by RLS below that).
 */
const TODO_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "todo_add",
    description:
      "Add an item to the user's personal to-do list. Use when they ask to remember, " +
      "note, or add something to their list.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short imperative title for the item" },
        context: {
          type: "string",
          description: "Optional context worth keeping with it (who/why/where it came from)",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "todo_list",
    description:
      "Read the user's personal to-do list. Use when they ask what's on their list, or " +
      "before completing an item to find its id.",
    input_schema: {
      type: "object",
      properties: {
        include_done: { type: "boolean", description: "Also include completed items" },
      },
    },
  },
  {
    name: "todo_complete",
    description: "Mark one item on the user's to-do list as done, by its id from todo_list.",
    input_schema: {
      type: "object",
      properties: {
        todo_id: { type: "string", description: "The item's id from todo_list" },
      },
      required: ["todo_id"],
    },
  },
];

async function runTodoTool(
  userId: string,
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    if (name === "todo_add") {
      const todo = await addTodo(userId, {
        title: String(input.title ?? ""),
        context: input.context ? String(input.context) : null,
        source: "eddy",
      });
      return JSON.stringify({ ok: true, added: { id: todo.id, title: todo.title } });
    }
    if (name === "todo_list") {
      const todos = await listTodos(userId, { includeDone: Boolean(input.include_done) });
      return JSON.stringify({
        ok: true,
        todos: todos.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          context: t.context,
        })),
      });
    }
    if (name === "todo_complete") {
      const todo = await setTodoStatus(userId, String(input.todo_id ?? ""), "done");
      return JSON.stringify(
        todo ? { ok: true, completed: todo.title } : { ok: false, error: "No such item on the list" }
      );
    }
    return JSON.stringify({ ok: false, error: `Unknown tool ${name}` });
  } catch (e) {
    return JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Tool failed" });
  }
}

/** Latest thread for hydrating the panel on open. Owner-scoped throughout. */
export async function getEddyThreadAction(): Promise<AskEddyResult> {
  const user = await requireUser();
  try {
    const conversation = await getOrCreateConversation(user.id);
    const messages = await listMessages(conversation.id, user.id, HISTORY_TURNS * 2);
    return { ok: true, conversationId: conversation.id, messages };
  } catch (e) {
    return {
      ok: false,
      conversationId: null,
      messages: [],
      message: e instanceof Error ? e.message : "Could not load your Eddy history",
    };
  }
}

export async function newEddyChatAction(): Promise<AskEddyResult> {
  const user = await requireUser();
  const conversation = await createConversation(user.id);
  return { ok: true, conversationId: conversation.id, messages: [] };
}

/** One turn of conversation. Explicit user action — the only spend point. */
export async function askEddyAction(input: {
  message: string;
  pathname?: string | null;
}): Promise<AskEddyResult> {
  const user = await requireUser();
  const question = input.message.trim();
  if (question.length < 2) {
    return { ok: false, conversationId: null, messages: [], message: "Ask a full question." };
  }

  try {
    await ensureAppDataLoaded();
    const conversation = await getOrCreateConversation(user.id);
    const history = await listMessages(conversation.id, user.id, HISTORY_TURNS * 2);

    await appendMessage({
      conversationId: conversation.id,
      userId: user.id,
      role: "user",
      content: capText(question, 4000),
      pagePath: input.pathname ?? null,
    });

    if (!isAiEnabled()) {
      const note =
        "AI isn't configured on this environment yet, so I can't answer — but your message is saved.";
      await appendMessage({
        conversationId: conversation.id,
        userId: user.id,
        role: "assistant",
        content: note,
      });
      const messages = await listMessages(conversation.id, user.id, HISTORY_TURNS * 2);
      return { ok: true, conversationId: conversation.id, messages };
    }

    // Grounding: manual excerpts + an allowlisted summary of the page they're on.
    const sections = await searchDocs(question);
    const docContext = sections
      .slice(0, 4)
      .map((s) => `## ${s.docTitle} — ${s.heading}\n${capText(s.content, 1500)}`)
      .join("\n\n---\n\n");
    const pageContext = buildEddyPageContext(user, input.pathname ?? null);

    const system =
      SYSTEM_PROMPT_BASE +
      `\n\nThe user's name is ${user.full_name.split(" ")[0]}.` +
      (pageContext
        ? `\n\nThe user is currently looking at: ${pageContext.label}. Live summary of what their page shows (already authorized for them):\n${pageContext.data}`
        : "") +
      (docContext ? `\n\nManual excerpts that may be relevant:\n${docContext}` : "");

    const turns: Anthropic.Messages.MessageParam[] = [
      ...history,
      { role: "user" as const, content: question },
    ]
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: capText(m.content, 4000) }));

    const client = await getAiClient();
    let response = await client!.messages.create({
      model: AI_MODELS.fast,
      max_tokens: 1024,
      system,
      messages: turns,
      tools: TODO_TOOLS,
    });
    await logAiUsage({
      feature: "ask_eddy",
      model: AI_MODELS.fast,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      userId: user.id,
    });

    // Tool loop: Eddy may read/update the user's OWN to-do list mid-answer.
    // Bounded so a confused model can never spin.
    let toolRounds = 0;
    while (response.stop_reason === "tool_use" && toolRounds < 4) {
      toolRounds += 1;
      const results: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: await runTodoTool(
            user.id,
            block.name,
            (block.input ?? {}) as Record<string, unknown>
          ),
        });
      }
      turns.push({ role: "assistant", content: response.content });
      turns.push({ role: "user", content: results });
      response = await client!.messages.create({
        model: AI_MODELS.fast,
        max_tokens: 1024,
        system,
        messages: turns,
        tools: TODO_TOOLS,
      });
      await logAiUsage({
        feature: "ask_eddy",
        model: AI_MODELS.fast,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        userId: user.id,
      });
    }

    const text = response.content.find((b) => b.type === "text");
    const answer = text && "text" in text ? text.text : "I couldn't come up with an answer.";
    await appendMessage({
      conversationId: conversation.id,
      userId: user.id,
      role: "assistant",
      content: answer,
      sources: sections.slice(0, 4).map((s) => ({
        title: s.docTitle,
        heading: s.heading,
        slug: s.docSlug,
      })),
      pagePath: input.pathname ?? null,
    });

    const messages = await listMessages(conversation.id, user.id, HISTORY_TURNS * 2);
    return {
      ok: true,
      conversationId: conversation.id,
      messages,
      contextLabel: pageContext?.label ?? null,
    };
  } catch (e) {
    console.error("[ask-eddy] failed", e instanceof Error ? e.message : e);
    return {
      ok: false,
      conversationId: null,
      messages: [],
      message: e instanceof Error ? e.message : "Eddy hit a snag — try again",
    };
  }
}
