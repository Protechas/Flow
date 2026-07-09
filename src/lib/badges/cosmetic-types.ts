/** Client-safe cosmetic unlock definitions. Unlocks are gated by how many
 * badges the employee has earned; titles are gated by the specific badge. */

export interface CosmeticFrame {
  id: string;
  label: string;
  /** badges required to unlock */
  unlockCount: number;
  /** classes applied to the avatar/initials box */
  className: string;
}

export interface CosmeticAccent {
  id: string;
  label: string;
  unlockCount: number;
  /** hex value written into --primary for the employee's own view */
  value: string;
}

export const COSMETIC_FRAMES: CosmeticFrame[] = [
  {
    id: "bronze_ring",
    label: "Bronze ring",
    unlockCount: 2,
    className: "ring-2 ring-amber-600/80",
  },
  {
    id: "silver_ring",
    label: "Silver ring",
    unlockCount: 5,
    className: "ring-2 ring-slate-300/90",
  },
  {
    id: "gold_ring",
    label: "Gold ring",
    unlockCount: 8,
    className: "ring-2 ring-yellow-400",
  },
  {
    id: "nebula_glow",
    label: "Nebula glow",
    unlockCount: 11,
    className: "ring-2 ring-primary shadow-[0_0_12px] shadow-primary/70",
  },
];

export const COSMETIC_ACCENTS: CosmeticAccent[] = [
  { id: "teal", label: "Teal", unlockCount: 3, value: "#14b8a6" },
  { id: "amber", label: "Amber", unlockCount: 5, value: "#f59e0b" },
  { id: "rose", label: "Rose", unlockCount: 7, value: "#f43f5e" },
  { id: "emerald", label: "Emerald", unlockCount: 9, value: "#10b981" },
];

export function frameClassName(frameId: string | null | undefined): string | null {
  return COSMETIC_FRAMES.find((f) => f.id === frameId)?.className ?? null;
}

export function accentValue(accentId: string | null | undefined): string | null {
  return COSMETIC_ACCENTS.find((a) => a.id === accentId)?.value ?? null;
}
