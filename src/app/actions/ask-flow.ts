"use server";

import { requireUser } from "@/lib/auth/session";
import { AI_MODELS, getAiClient } from "@/lib/ai/client";
import { logAiUsage } from "@/lib/ai/usage";
import { searchDocs, type DocSection } from "@/lib/ask-flow/search";

export interface AskFlowSource {
  title: string;
  heading: string;
  slug: string;
  excerpt: string;
}

export interface AskFlowResult {
  ok: boolean;
  /** Synthesized answer when the Claude API is configured; null otherwise. */
  answer: string | null;
  sources: AskFlowSource[];
  message?: string;
}

function toSources(sections: DocSection[]): AskFlowSource[] {
  return sections.map((s) => ({
    title: s.docTitle,
    heading: s.heading,
    slug: s.docSlug,
    excerpt: s.content.replace(/^#+\s*.*\n/, "").trim().slice(0, 320),
  }));
}

async function synthesizeAnswer(
  question: string,
  sections: DocSection[],
  userId: string
): Promise<string | null> {
  const client = await getAiClient();
  if (!client) return null;
  try {
    const context = sections
      .map((s) => `## ${s.docTitle} — ${s.heading}\n${s.content}`)
      .join("\n\n---\n\n");
    // Grounded Q&A over manual excerpts is a simple task — fast tier is plenty.
    const response = await client.messages.create({
      model: AI_MODELS.fast,
      max_tokens: 1024,
      system:
        "You are Eddy, Flow's built-in assistant, answering through the Ask Flow help panel " +
        "in Flow, Protech's operations platform. " +
        "Answer the user's question using ONLY the provided manual excerpts. Be concise and " +
        "practical — tell them exactly where to click and what happens. If the excerpts don't " +
        "cover the question, say so and suggest asking their lead or filing it in the " +
        "Innovation Hub. Never invent features.",
      messages: [
        {
          role: "user",
          content: `Manual excerpts:\n\n${context}\n\nQuestion: ${question}`,
        },
      ],
    });
    await logAiUsage({
      feature: "ask_flow",
      model: AI_MODELS.fast,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      userId,
    });
    const text = response.content.find((b) => b.type === "text");
    return text && "text" in text ? text.text : null;
  } catch (e) {
    console.error("[ask-flow] synthesis failed", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function askFlowAction(question: string): Promise<AskFlowResult> {
  const user = await requireUser();
  const q = question.trim();
  if (q.length < 3) {
    return { ok: false, answer: null, sources: [], message: "Ask a full question." };
  }
  const sections = await searchDocs(q);
  if (sections.length === 0) {
    return {
      ok: true,
      answer: null,
      sources: [],
      message:
        "Nothing in the manual matches that. Try different words, or ask your lead — and if it should be documented, drop it in the Innovation Hub.",
    };
  }
  const answer = await synthesizeAnswer(q, sections, user.id);
  return { ok: true, answer, sources: toSources(sections) };
}
