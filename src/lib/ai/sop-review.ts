import { getAiClient, AI_MODELS } from "@/lib/ai/client";
import { pickFields, capText } from "@/lib/ai/allowlist";
import { logAiUsage } from "@/lib/ai/usage";
import type { AiSopReviewFinding, AiSopReviewResult } from "@/lib/ai/types";
import type { CompanyDocument } from "@/types/flow";

/**
 * ALLOWLIST (AI security rule #2): the ONLY document fields ever sent to the
 * Claude API, plus the document text itself. Adding a field here is a reviewed
 * decision — see docs/AI_SECURITY.md.
 */
const REVIEW_DOC_FIELDS = ["title", "category", "description"] as const;

/** Keeps even a long SOP comfortably inside one request. */
const CONTENT_CHAR_CAP = 80_000;

const MAX_FINDINGS = 20;

const FINDING_KINDS = [
  "clarity",
  "contradiction",
  "stale_reference",
  "missing_step",
  "inconsistency",
  "other",
] as const;

const SEVERITIES = ["high", "medium", "low"] as const;

const SYSTEM_PROMPT =
  "You are Eddy, Flow's built-in assistant, reviewing a company document (usually an SOP — " +
  "a standard operating procedure for a Service Information analyst team). Employees are " +
  "required to read and follow published SOPs exactly, so problems in the text become " +
  "problems on the floor. Review the document the way a careful new employee would read it: " +
  "flag steps a reader could misunderstand or perform two different ways (clarity), places " +
  "where the document disagrees with itself (contradiction), references that look outdated — " +
  "old tool names, dead paths, dates or versions that no longer make sense (stale_reference), " +
  "obvious gaps where a step must exist but is not written down (missing_step), and " +
  "terminology or formatting that shifts meaning midway (inconsistency). Do NOT rewrite the " +
  "document, do not flag matters of writing style or tone, and do not invent facts about the " +
  "company. Your findings are advisory: an editor reviews each one and decides. " +
  "Respond with ONLY a JSON object, no markdown fences, matching exactly:\n" +
  "{\n" +
  '  "summary": "2-3 sentence overall read: is this document ready, and what is the theme of the issues",\n' +
  '  "findings": [\n' +
  "    {\n" +
  `      "kind": one of ${JSON.stringify(FINDING_KINDS)},\n` +
  `      "severity": one of ${JSON.stringify(SEVERITIES)},\n` +
  '      "quote": "short verbatim excerpt from the document that anchors the issue",\n' +
  '      "issue": "what is wrong, in plain English",\n' +
  '      "suggestion": "the concrete fix the editor should consider"\n' +
  "    }\n" +
  "  ]\n" +
  "}\n" +
  `Rules: at most ${MAX_FINDINGS} findings; order by severity (high first); an empty ` +
  "findings array is a valid answer for a clean document.";

/** Flatten the editor HTML to reviewable plain text, keeping heading structure visible. */
export function documentHtmlToText(html: string): string {
  return html
    .replace(/<(h[1-6])[^>]*>/gi, "\n\n[$1] ")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|tr|table|ul|ol|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractJson(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model response");
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

function toFinding(raw: Record<string, unknown>): AiSopReviewFinding | null {
  const issue = String(raw.issue ?? "").trim();
  if (!issue) return null;
  const kind = String(raw.kind ?? "");
  const severity = String(raw.severity ?? "");
  return {
    kind: (FINDING_KINDS as readonly string[]).includes(kind)
      ? (kind as AiSopReviewFinding["kind"])
      : "other",
    severity: (SEVERITIES as readonly string[]).includes(severity)
      ? (severity as AiSopReviewFinding["severity"])
      : "medium",
    quote: capText(String(raw.quote ?? ""), 300),
    issue: capText(issue, 600),
    suggestion: capText(String(raw.suggestion ?? ""), 600),
  };
}

/**
 * One advisory review pass over a document's saved Flow content. Not persisted —
 * the result goes straight back to the editor who asked. Called from a user
 * action only — never from page load or jobs.
 */
export async function runSopReview(
  doc: CompanyDocument,
  contentHtml: string,
  userId: string
): Promise<AiSopReviewResult> {
  const client = await getAiClient();
  if (!client) throw new Error("AI is not configured");

  const text = documentHtmlToText(contentHtml);
  if (!text) throw new Error("The document has no content to review yet");
  const truncated = text.length > CONTENT_CHAR_CAP;

  const docContext = {
    ...pickFields(doc, REVIEW_DOC_FIELDS),
    description: capText(doc.description ?? "", 400),
  };

  const response = await client.messages.create({
    model: AI_MODELS.standard,
    max_tokens: 6000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          `Document metadata:\n${JSON.stringify(docContext)}\n\n` +
          `Document text${truncated ? " (truncated)" : ""}:\n${capText(text, CONTENT_CHAR_CAP)}`,
      },
    ],
  });

  await logAiUsage({
    feature: "sop_review",
    model: AI_MODELS.standard,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    userId,
    runRef: doc.id,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const parsed = extractJson(textBlock && "text" in textBlock ? textBlock.text : "");
  const findings = (Array.isArray(parsed.findings) ? parsed.findings : [])
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map(toFinding)
    .filter((f): f is AiSopReviewFinding => f !== null)
    .slice(0, MAX_FINDINGS);

  return {
    document_id: doc.id,
    model: AI_MODELS.standard,
    summary: capText(String(parsed.summary ?? ""), 1000),
    findings,
    truncated,
    reviewed_at: new Date().toISOString(),
  };
}
