import type { OperatingModelWrapUpField } from "@/lib/operating-models/types";

const MAX_SECTION_CHARS = 4000;

/** Display label for a stored section id ("next_action" → "Next action"). */
export function wrapUpSectionLabel(id: string): string {
  const words = id.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Keep only answers for fields the team's operating model actually defines,
 * trimmed and size-capped — the wrap-up action is a public endpoint, so
 * arbitrary keys/payloads must not reach the database.
 */
export function sanitizeWrapUpSections(
  raw: Record<string, string> | undefined,
  fields: OperatingModelWrapUpField[]
): Record<string, string> | null {
  if (!raw || !fields.length) return null;
  const out: Record<string, string> = {};
  for (const field of fields) {
    const value = raw[field.id];
    if (typeof value !== "string") continue;
    const trimmed = value.trim().slice(0, MAX_SECTION_CHARS);
    if (trimmed) out[field.id] = trimmed;
  }
  return Object.keys(out).length ? out : null;
}
