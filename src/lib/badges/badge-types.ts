/** Client-safe badge definitions for the morale system.
 * Families escalate bronze → silver → gold → platinum. */

export type BadgeTier = "bronze" | "silver" | "gold" | "platinum";

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  /** lucide icon name rendered by the panel */
  icon:
    | "file"
    | "files"
    | "trophy"
    | "flame"
    | "sunrise"
    | "check"
    | "sparkles"
    | "timer"
    | "lightbulb"
    | "rocket"
    | "shield"
    | "zap";
  tier: BadgeTier;
}

export interface BadgeState extends BadgeDefinition {
  earned: boolean;
  /** progress toward the target for locked badges (e.g. 62/100) */
  progress: number;
  target: number;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // ——— Document uploads ———
  { id: "first_upload", name: "First Steps", description: "Upload your first document", icon: "file", tier: "bronze" },
  { id: "files_100", name: "Century Club", description: "Upload 100 documents", icon: "files", tier: "bronze" },
  { id: "files_500", name: "Heavy Lifter", description: "Upload 500 documents", icon: "rocket", tier: "silver" },
  { id: "files_1000", name: "The Machine", description: "Upload 1,000 documents", icon: "zap", tier: "gold" },
  { id: "files_2500", name: "Library Legend", description: "Upload 2,500 documents", icon: "zap", tier: "platinum" },

  // ——— Single-day volume ———
  { id: "big_day", name: "Big Day", description: "Upload 60 documents in a single day", icon: "rocket", tier: "silver" },
  { id: "century_day", name: "Century Day", description: "Upload 100 documents in a single day", icon: "rocket", tier: "gold" },

  // ——— Batches to QA ———
  { id: "batch_1", name: "First Batch", description: "Send your first batch to QA", icon: "check", tier: "bronze" },
  { id: "batch_10", name: "Batch Boss", description: "Send 10 batches to QA", icon: "check", tier: "silver" },
  { id: "batch_50", name: "Batch Overlord", description: "Send 50 batches to QA", icon: "check", tier: "gold" },

  // ——— QA passes (your work approved) ———
  { id: "qa_pass_1", name: "First Pass", description: "Get a submission through QA", icon: "sparkles", tier: "bronze" },
  { id: "qa_pass_5", name: "QA Darling", description: "Pass QA review 5 times", icon: "trophy", tier: "silver" },
  { id: "qa_pass_25", name: "Flawless", description: "Pass QA review 25 times", icon: "trophy", tier: "gold" },

  // ——— Reviews performed (leads & reviewers) ———
  { id: "review_1", name: "Gatekeeper", description: "Complete your first QA review", icon: "shield", tier: "bronze" },
  { id: "review_25", name: "Quality Guardian", description: "Complete 25 QA reviews", icon: "shield", tier: "silver" },
  { id: "review_100", name: "The Wall", description: "Complete 100 QA reviews", icon: "shield", tier: "gold" },

  // ——— Clock discipline ———
  { id: "early_bird", name: "Early Bird", description: "Clock in before 7:30 AM on 5 days", icon: "sunrise", tier: "silver" },
  { id: "dawn_patrol", name: "Dawn Patrol", description: "Clock in before 7:30 AM on 20 days", icon: "sunrise", tier: "gold" },
  { id: "clean_month", name: "Timekeeper", description: "20 clock days with zero manager corrections", icon: "shield", tier: "gold" },
  { id: "swiss_watch", name: "Swiss Watch", description: "45 clock days with zero manager corrections", icon: "timer", tier: "platinum" },

  // ——— Daily reports ———
  { id: "report_streak_5", name: "Paper Trail", description: "Submit your daily report 5 workdays in a row", icon: "flame", tier: "silver" },
  { id: "report_streak_20", name: "Iron Streak", description: "Submit your daily report 20 workdays in a row", icon: "flame", tier: "gold" },

  // ——— Task time ———
  { id: "marathon", name: "Marathon", description: "Log 8+ hours of task time in a single day", icon: "timer", tier: "silver" },
  { id: "marathon_5", name: "Ultra", description: "Log 8+ hour task days 5 times", icon: "timer", tier: "gold" },

  // ——— Ideas ———
  { id: "idea_1", name: "Bright Idea", description: "Submit an idea to the Innovation Hub", icon: "lightbulb", tier: "bronze" },
  { id: "idea_5", name: "Idea Machine", description: "Submit 5 ideas to the Innovation Hub", icon: "lightbulb", tier: "silver" },
];
