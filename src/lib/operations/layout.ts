export type OpsLayoutMode = "browser" | "table";

export const OPS_LAYOUT_MODES: { id: OpsLayoutMode; label: string; description: string }[] = [
  { id: "browser", label: "Work Browser", description: "Simplified workspace with detail panel" },
  { id: "table", label: "Table View", description: "Full spreadsheet view for power users" },
];

export function opsColCount(compact: boolean, showActions: boolean): number {
  const base = compact ? 9 : 14;
  return showActions ? base : base - 1;
}
