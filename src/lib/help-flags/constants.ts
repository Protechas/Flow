import type { HelpFlagReason } from "@/types/flow";

export const HELP_FLAG_REASON_LABELS: Record<HelpFlagReason, string> = {
  need_clarification: "Need clarification",
  stuck_on_task: "Stuck on task",
  missing_information: "Missing information",
  system_issue: "System issue",
  need_qa_guidance: "Need QA guidance",
  workload_concern: "Workload concern",
  other: "Other",
};
