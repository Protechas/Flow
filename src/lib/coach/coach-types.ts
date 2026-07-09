/** Client-safe types + labels for the workspace coach. */

export type CoachPersona = "professional" | "encouraging" | "drill_sergeant" | "smartass";

export const COACH_PERSONAS: { value: CoachPersona; label: string; description: string }[] = [
  { value: "professional", label: "Professional", description: "Straight to the point" },
  { value: "encouraging", label: "Encouraging", description: "Your biggest fan" },
  { value: "drill_sergeant", label: "Drill sergeant", description: "No excuses" },
  { value: "smartass", label: "Smart-ass", description: "Sarcasm included, free of charge" },
];

export type CoachNudgeType = "no_timer" | "batch_ready" | "wrap_up_due" | "qa_return";

export interface CoachNudge {
  type: CoachNudgeType;
  message: string;
  /** Optional link that resolves the nudge (e.g. the task page). */
  href: string | null;
  actionLabel: string | null;
}
