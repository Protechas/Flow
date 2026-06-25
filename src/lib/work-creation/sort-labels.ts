/** Consistent sort for bulk pickers and matrix generation. */

export type LabelSortMode = "alpha" | "numeric";

export function sortLabels(values: string[], mode: LabelSortMode = "alpha"): string[] {
  const copy = [...values];
  if (mode === "numeric") {
    return copy.sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!Number.isNaN(na) && !Number.isNaN(nb) && String(na) === a.trim() && String(nb) === b.trim()) {
        return na - nb;
      }
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
  }
  return copy.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function sortNumbers(values: number[], descending = false): number[] {
  const copy = [...values];
  copy.sort((a, b) => (descending ? b - a : a - b));
  return copy;
}

export function dedupeSortLabels(values: string[], mode: LabelSortMode = "alpha"): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const v of values) {
    const trimmed = v.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }
  return sortLabels(unique, mode);
}
