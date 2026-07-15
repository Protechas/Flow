import { getAiClient, AI_MODELS } from "@/lib/ai/client";
import { capText } from "@/lib/ai/allowlist";
import { logAiUsage } from "@/lib/ai/usage";

/**
 * Eddy reads an SI document against the team's QA standards (distilled from
 * the protected "Eddy — QA Standards" SOPs: SI Content SOP 07-2022 and SI
 * Library Component SOP 06-2026). Advisory only — flags direct a human
 * reviewer's attention; nothing here fails a document or a person.
 *
 * ALLOWLIST (AI security rule #2): the ONLY data sent to the API is the file
 * name, the claimed vehicle/component label, the extracted document text, and
 * a short structural note. No user or task records.
 */

const CONTENT_CHAR_CAP = 24_000;
const MAX_FINDINGS = 10;

export interface EddyContentFinding {
  severity: "high" | "medium" | "low";
  issue: string;
  quote?: string;
}

export interface EddyContentReview {
  verdict: "looks_right" | "issues_found" | "cannot_assess";
  summary: string;
  findings: EddyContentFinding[];
}

const SYSTEM_PROMPT =
  "You are Eddy, the QA assistant for a Service Information (SI) team that saves OEM vehicle " +
  "repair/calibration documents for ADAS and safety systems. You are reviewing ONE saved SI " +
  "document. The file label claims a specific Year, Make, Model, and Component/System — your " +
  "job is to judge whether the CONTENT actually supports that claim and reads complete per the " +
  "team's SOP standards:\n" +
  "- The content must be about the claimed vehicle (model names, model-year lines) and the " +
  "claimed system (e.g. FRS = front radar sensor, WSC = windshield camera, ACC = adaptive " +
  "cruise, AEB = auto emergency braking, BUC = backup camera, SVC = surround view, PDS = " +
  "parking distance sensors, RRS = rear radar, NV = night vision, APA = advanced park assist, " +
  "BSW/RCTW = blind spot/rear cross traffic, LKA = lane keep assist).\n" +
  "- A complete document has: system description, relevant removal & installation (R&I) " +
  "procedures, the calibration procedure with required targets/tools and setup measurements, " +
  "and any post-installation/repair-verification steps.\n" +
  "- Pre-qualifications stated by the OEM (fuel level, cargo/passenger area, ride height, " +
  "wheel alignment, bumper removal) should be present when applicable, and conditions of " +
  "calibration (WHEN to calibrate — after collision, glass R&I, alignment, DTCs) should appear.\n" +
  "- Variant-numbered systems map to hardware per the team's SOP — a document about that " +
  "HARDWARE is the CORRECT content for the variant: ACC 1/AEB 1 = front radar/lidar only; " +
  "ACC 2/AEB 2 = front radar AND windshield (forward recognition) camera; ACC 3/AEB 3 = " +
  "windshield camera only; BSW/RCTW 1 = rear-bumper radar; BSW/RCTW 2 = taillight radar; " +
  "BSW/RCTW 3 = backup camera; LKA 1 = windshield camera; LKA 2 = backup camera. So e.g. a " +
  "front/forward-recognition-camera procedure under an (LKA 1) label is a MATCH, not a " +
  "mismatch. Ideally the doc also includes OEM justification for the variant choice — its " +
  "absence is LOW severity, never high.\n" +
  "- Files split as '-Part-N' are ONE slice of a larger document by design (the team splits " +
  "at a size cap). When the file name has a Part number or the text is marked partial, do " +
  "NOT flag truncation or missing sections — other parts carry them. Judge only what this " +
  "slice claims to be.\n" +
  "Judge ONLY from the provided text. Wrong-vehicle prose, a different system than claimed " +
  "(per the hardware mappings above), or contradictory content are HIGH severity. Missing " +
  "supporting sections are MEDIUM for complete single-file documents only. Style is never a " +
  "finding. If the text is too thin to judge, verdict is cannot_assess. Respond with ONLY a " +
  "JSON object, no markdown fences:\n" +
  "{\n" +
  '  "verdict": "looks_right" | "issues_found" | "cannot_assess",\n' +
  '  "summary": "1-2 sentences: does the content support the label, and what stands out",\n' +
  '  "findings": [ { "severity": "high"|"medium"|"low", "issue": "plain English", "quote": "short anchor excerpt" } ]\n' +
  "}\n" +
  `At most ${MAX_FINDINGS} findings, ordered high first. Empty findings is valid for a clean document.`;

function extractJson(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model response");
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

export async function eddyReviewContent(input: {
  fileName: string;
  claim: string;
  text: string;
  structuralNote?: string;
  userId?: string | null;
}): Promise<EddyContentReview> {
  const client = await getAiClient();
  if (!client) throw new Error("AI is not configured");

  const userContent =
    `File name: ${capText(input.fileName, 200)}\n` +
    `Label claims: ${capText(input.claim, 200)}\n` +
    (input.structuralNote ? `Structural notes: ${capText(input.structuralNote, 500)}\n` : "") +
    `\n--- EXTRACTED DOCUMENT TEXT (may be partial) ---\n` +
    capText(input.text, CONTENT_CHAR_CAP);

  const response = await client.messages.create({
    model: AI_MODELS.fast,
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  await logAiUsage({
    feature: "content_review",
    model: AI_MODELS.fast,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    userId: input.userId ?? null,
  });

  const textOut = response.content
    .filter((b) => b.type === "text")
    .map((b) => ("text" in b ? b.text : ""))
    .join("");
  const parsed = extractJson(textOut);

  const verdicts = new Set(["looks_right", "issues_found", "cannot_assess"]);
  const severities = new Set(["high", "medium", "low"]);
  const findings: EddyContentFinding[] = Array.isArray(parsed.findings)
    ? (parsed.findings as Record<string, unknown>[])
        .slice(0, MAX_FINDINGS)
        .map((f) => ({
          severity: severities.has(String(f.severity)) ? (String(f.severity) as EddyContentFinding["severity"]) : "low",
          issue: String(f.issue ?? "").slice(0, 500),
          quote: f.quote ? String(f.quote).slice(0, 300) : undefined,
        }))
        .filter((f) => f.issue)
    : [];

  return {
    verdict: verdicts.has(String(parsed.verdict))
      ? (String(parsed.verdict) as EddyContentReview["verdict"])
      : findings.length > 0
        ? "issues_found"
        : "looks_right",
    summary: String(parsed.summary ?? "").slice(0, 600),
    findings,
  };
}
