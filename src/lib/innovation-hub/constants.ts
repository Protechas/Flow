import type {
  FeedbackCategory,
  FeedbackPriority,
  FeedbackStatus,
} from "@/types/flow";

export const FEEDBACK_CATEGORY_OPTIONS: { value: FeedbackCategory; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "bug", label: "Bug" },
  { value: "issue", label: "Issue" },
  { value: "feature_request", label: "Feature Request" },
  { value: "question", label: "Question" },
];

export const FEEDBACK_PRIORITY_OPTIONS: { value: FeedbackPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const FEEDBACK_STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "investigating", label: "Investigating" },
  { value: "planned", label: "Planned" },
  { value: "fixed", label: "Fixed" },
  { value: "rejected", label: "Rejected" },
];

export const FEEDBACK_CATEGORY_LABELS = Object.fromEntries(
  FEEDBACK_CATEGORY_OPTIONS.map((o) => [o.value, o.label])
) as Record<FeedbackCategory, string>;

export const FEEDBACK_PRIORITY_LABELS = Object.fromEntries(
  FEEDBACK_PRIORITY_OPTIONS.map((o) => [o.value, o.label])
) as Record<FeedbackPriority, string>;

export const FEEDBACK_STATUS_LABELS = Object.fromEntries(
  FEEDBACK_STATUS_OPTIONS.map((o) => [o.value, o.label])
) as Record<FeedbackStatus, string>;
