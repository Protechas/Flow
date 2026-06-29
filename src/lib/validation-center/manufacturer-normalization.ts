/**
 * Canonical manufacturer names for batch import pairing.
 * Matching uses normalized keys — not exact filenames.
 */

export interface ManufacturerCanonical {
  display: string;
  key: string;
}

const ALIAS_GROUPS: { display: string; aliases: string[] }[] = [
  { display: "RAM", aliases: ["ram", "ram trucks", "ram truck", "ramtrucks"] },
  {
    display: "Mercedes-Benz",
    aliases: ["mercedes", "mercedes benz", "mercedes-benz", "mercedesbenz", "mb"],
  },
  { display: "Volkswagen", aliases: ["vw", "volkswagen", "volkswagon"] },
  { display: "Land Rover", aliases: ["land rover", "landrover", "land-rover"] },
  { display: "GM", aliases: ["gm", "general motors", "general-motors"] },
  { display: "Alfa Romeo", aliases: ["alfa romeo", "alfaromeo", "alfa-romeo"] },
  { display: "Aston Martin", aliases: ["aston martin", "astonmartin"] },
  { display: "Rolls-Royce", aliases: ["rolls royce", "rollsroyce", "rolls-royce"] },
  { display: "Mercury", aliases: ["mercury"] },
  { display: "Mini", aliases: ["mini", "mini cooper"] },
  { display: "Smart", aliases: ["smart", "smart car"] },
];

const ALIAS_TO_DISPLAY = new Map<string, string>();
for (const group of ALIAS_GROUPS) {
  ALIAS_TO_DISPLAY.set(normalizeKey(group.display), group.display);
  for (const alias of group.aliases) {
    ALIAS_TO_DISPLAY.set(normalizeKey(alias), group.display);
  }
}

export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.xlsx?$/i, "")
    .replace(/[_\-./]+/g, " ")
    .replace(/[^a-z0-9\s&]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeManufacturer(raw: string): ManufacturerCanonical {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") {
    return { display: "Unknown", key: "unknown" };
  }

  const key = normalizeKey(trimmed);
  const canonical = ALIAS_TO_DISPLAY.get(key);
  if (canonical) {
    return { display: canonical, key: normalizeKey(canonical) };
  }

  // Partial alias match (e.g. "Ram 1500" -> ram)
  for (const [aliasKey, display] of ALIAS_TO_DISPLAY.entries()) {
    if (key === aliasKey || key.startsWith(`${aliasKey} `) || key.endsWith(` ${aliasKey}`)) {
      return { display, key: normalizeKey(display) };
    }
  }

  const display = toDisplayName(trimmed);
  return { display, key: normalizeKey(display) };
}

function toDisplayName(raw: string): string {
  const cleaned = raw.replace(/[_\-./]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Unknown";
  return cleaned
    .split(" ")
    .map((word) => {
      if (word.length <= 3 && word === word.toUpperCase()) return word;
      if (/^[A-Z0-9&]+$/.test(word) && word.length <= 4) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function manufacturerSimilarity(a: string, b: string): number {
  const ka = normalizeKey(a);
  const kb = normalizeKey(b);
  if (ka === kb) return 1;
  if (ka.startsWith(kb) || kb.startsWith(ka)) return 0.88;
  if (ka.includes(kb) || kb.includes(ka)) return 0.82;

  const ta = new Set(ka.split(" ").filter(Boolean));
  const tb = new Set(kb.split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const t of ta) {
    if (tb.has(t)) overlap += 1;
  }
  return overlap / Math.max(ta.size, tb.size);
}
