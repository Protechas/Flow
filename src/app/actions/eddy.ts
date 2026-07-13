"use server";

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
  "Service Information analyst teams. You are advisory only: you explain, summarize, and " +
  "suggest — you never claim to have performed actions, and you never invent features or " +
  "data. Ground answers in the manual excerpts and page context provided; when they don't " +
  "cover the question, say so plainly and suggest asking a lead or filing it in the " +
  "Innovation Hub. Be concise and practical. You are talking to one specific user — their " +
  "conversation history is theirs alone.";

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

    const turns = [...history, { role: "user" as const, content: question }]
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: capText(m.content, 4000) }));

    const client = await getAiClient();
    const response = await client!.messages.create({
      model: AI_MODELS.fast,
      max_tokens: 1024,
      system,
      messages: turns,
    });

    await logAiUsage({
      feature: "ask_eddy",
      model: AI_MODELS.fast,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      userId: user.id,
    });

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
