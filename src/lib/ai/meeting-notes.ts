/**
 * Meeting Notes v1 — Eddy digests a pasted meeting transcript into a summary,
 * decisions, and action items. Action items only become tasks through the
 * approval dialog (AI proposes, a lead disposes — AI security rule #3).
 *
 * Standard model tier: transcripts run long and faithful extraction is
 * drafting work, not lookup.
 */

import { AI_MODELS, getAiClient } from "@/lib/ai/client";
import { capText } from "@/lib/ai/allowlist";
import { logAiUsage } from "@/lib/ai/usage";
import type { WorkPriority } from "@/types/flow";

export const TRANSCRIPT_CHAR_CAP = 80000;
const MAX_ACTION_ITEMS = 20;
const MAX_DECISIONS = 12;

export interface MeetingActionItem {
  title: string;
  detail?: string;
  /** Person's name as spoken in the meeting — matched to the roster client-side. */
  suggestedAssignee?: string;
  due?: string;
  priority: WorkPriority;
}

export interface EddyMeetingDigest {
  summary: string;
  decisions: string[];
  actionItems: MeetingActionItem[];
}

const SYSTEM_PROMPT =
  "You are Eddy, assistant for an operations team. You are digesting ONE meeting transcript " +
  "into notes the team will keep and act on. Be faithful to what was actually said — never " +
  "invent decisions, owners, or dates that aren't in the transcript.\n" +
  "- summary: 3-6 sentences a manager could read instead of the meeting.\n" +
  "- decisions: things that were DECIDED (not discussed-and-parked). Empty array is valid.\n" +
  "- actionItems: concrete follow-ups someone committed to or was asked to do. For each: a " +
  "short imperative title; optional detail with context from the transcript; " +
  "suggestedAssignee ONLY when the transcript names who owns it (use their name as spoken); " +
  "due ONLY when a real date/deadline was stated, as YYYY-MM-DD resolved against the meeting " +
  "date; priority low|medium|high|urgent from how the speakers treated it (default medium).\n" +
  "Respond with ONLY a JSON object, no markdown fences:\n" +
  "{\n" +
  '  "summary": "...",\n' +
  '  "decisions": ["..."],\n' +
  '  "actionItems": [ { "title": "...", "detail": "...", "suggestedAssignee": "...", "due": "YYYY-MM-DD", "priority": "medium" } ]\n' +
  "}";

const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

function extractJson(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model response");
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

/** Pure + exported for tests: coerce the model's JSON into a safe digest. */
export function parseMeetingDigest(raw: Record<string, unknown>): EddyMeetingDigest {
  const decisions = Array.isArray(raw.decisions)
    ? raw.decisions.slice(0, MAX_DECISIONS).map((d) => String(d).slice(0, 400)).filter(Boolean)
    : [];
  const actionItems: MeetingActionItem[] = Array.isArray(raw.actionItems)
    ? (raw.actionItems as Record<string, unknown>[])
        .slice(0, MAX_ACTION_ITEMS)
        .map((a) => ({
          title: String(a.title ?? "").slice(0, 200),
          detail: a.detail ? String(a.detail).slice(0, 800) : undefined,
          suggestedAssignee: a.suggestedAssignee
            ? String(a.suggestedAssignee).slice(0, 80)
            : undefined,
          due:
            typeof a.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.due)
              ? a.due
              : undefined,
          priority: PRIORITIES.has(String(a.priority))
            ? (String(a.priority) as WorkPriority)
            : "medium",
        }))
        .filter((a) => a.title)
    : [];
  return {
    summary: String(raw.summary ?? "").slice(0, 2000),
    decisions,
    actionItems,
  };
}

export async function eddyMeetingDigest(input: {
  transcript: string;
  meetingTitle?: string | null;
  meetingDate?: string | null;
  userId?: string | null;
}): Promise<EddyMeetingDigest> {
  const client = await getAiClient();
  if (!client) throw new Error("AI is not configured");

  const userContent =
    `Meeting: ${capText(input.meetingTitle?.trim() || "Team meeting", 160)}\n` +
    `Meeting date: ${input.meetingDate || new Date().toISOString().slice(0, 10)}\n` +
    `\n--- TRANSCRIPT (may be pasted from Teams, formatting is messy) ---\n` +
    capText(input.transcript, TRANSCRIPT_CHAR_CAP);

  const response = await client.messages.create({
    model: AI_MODELS.standard,
    max_tokens: 2500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  await logAiUsage({
    feature: "meeting_notes",
    model: AI_MODELS.standard,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    userId: input.userId ?? null,
  });

  const textOut = response.content
    .filter((b) => b.type === "text")
    .map((b) => ("text" in b ? b.text : ""))
    .join("");
  return parseMeetingDigest(extractJson(textOut));
}
