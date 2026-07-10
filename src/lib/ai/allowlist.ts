/**
 * Field allowlisting — the enforcement primitive for AI security rule #2
 * (docs/AI_SECURITY.md): every AI feature declares exactly which fields it
 * sends to the API. Payloads are built through pickFields so a schema change
 * upstream can never silently start shipping new fields to the model.
 */

export function pickFields<T extends object, K extends keyof T>(
  record: T,
  fields: readonly K[]
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of fields) {
    out[key] = record[key];
  }
  return out;
}

/** Cap free-form text so one oversized record can't blow up a batch prompt. */
export function capText(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}
