import type { CoachingCategory, CoachingLevel } from "@/types/flow";

/** Client-safe label maps for coaching records. */
export const COACHING_CATEGORY_LABELS: Record<CoachingCategory, string> = {
  time_attendance: "Time & attendance",
  quality: "Work quality",
  conduct: "Conduct",
  performance: "Performance",
  other: "Other",
};

export const COACHING_LEVEL_LABELS: Record<CoachingLevel, string> = {
  coaching: "Coaching",
  verbal_warning: "Verbal warning",
  written_warning: "Written warning",
  final_warning: "Final warning",
};
