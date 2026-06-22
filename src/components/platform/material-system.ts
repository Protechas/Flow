/**
 * Flow material system — layered surface class names and radius tokens.
 * Visual only; pairs with Executive Dark tokens in globals.css.
 */
export const FLOW_MATERIAL = {
  /** Layer 2 — workspace containers */
  workspace: "flow-material-workspace",
  /** Layer 3 — cards and panels */
  card: "flow-material-card",
  /** Restrained glass — headers, filters, KPI zones */
  glassBar: "flow-glass-bar",
  /** KPI section with glass + ambient glow */
  kpiGlassZone: "flow-kpi-glass-zone",
  /** Layer 5 — drawers and modals */
  glassDrawer: "flow-glass-drawer",
  /** Ambient command-center lighting wrapper */
  ambientCommand: "flow-ambient-command",
  /** Interactive elevation on hover */
  interactive: "flow-layer-4-interactive",
  /** Selected / focused state */
  focus: "flow-layer-5-focus",
} as const;

/** Border radius tokens (see globals.css) */
export const FLOW_RADIUS = {
  control: "var(--flow-radius-control)", // ~11px buttons/inputs
  card: "var(--flow-radius-card)", // ~15px cards
  panel: "var(--flow-radius-panel)", // ~17px panels/workspaces
  drawer: "var(--flow-radius-drawer)", // ~20px drawers/modals
} as const;

export type MaterialAccent = "healthy" | "warning" | "critical" | "compliance";

export function materialAccentProps(accent?: MaterialAccent) {
  return accent ? { "data-accent": accent } : {};
}
