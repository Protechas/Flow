/** Client-safe badge definitions for the morale system. */

export type BadgeTier = "bronze" | "silver" | "gold";

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
  {
    id: "first_upload",
    name: "First Steps",
    description: "Upload your first document",
    icon: "file",
    tier: "bronze",
  },
  {
    id: "files_100",
    name: "Century Club",
    description: "Upload 100 documents",
    icon: "files",
    tier: "bronze",
  },
  {
    id: "files_500",
    name: "Heavy Lifter",
    description: "Upload 500 documents",
    icon: "rocket",
    tier: "silver",
  },
  {
    id: "files_1000",
    name: "The Machine",
    description: "Upload 1,000 documents",
    icon: "zap",
    tier: "gold",
  },
  {
    id: "batch_10",
    name: "Batch Boss",
    description: "Send 10 batches to QA",
    icon: "check",
    tier: "silver",
  },
  {
    id: "qa_pass_1",
    name: "First Pass",
    description: "Get a submission through QA",
    icon: "sparkles",
    tier: "bronze",
  },
  {
    id: "qa_pass_5",
    name: "QA Darling",
    description: "Pass QA review 5 times",
    icon: "trophy",
    tier: "silver",
  },
  {
    id: "early_bird",
    name: "Early Bird",
    description: "Clock in before 7:30 AM on 5 days",
    icon: "sunrise",
    tier: "silver",
  },
  {
    id: "report_streak_5",
    name: "Paper Trail",
    description: "Submit your daily report 5 workdays in a row",
    icon: "flame",
    tier: "silver",
  },
  {
    id: "clean_month",
    name: "Timekeeper",
    description: "30 days of punches with zero manager corrections",
    icon: "shield",
    tier: "gold",
  },
  {
    id: "marathon",
    name: "Marathon",
    description: "Log 8+ hours of task time in a single day",
    icon: "timer",
    tier: "silver",
  },
  {
    id: "idea_1",
    name: "Bright Idea",
    description: "Submit an idea to the Innovation Hub",
    icon: "lightbulb",
    tier: "bronze",
  },
];
