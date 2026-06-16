/** Maps server/action error codes to user-facing copy. */
export function formatActionError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);

  const map: Record<string, string> = {
    FORBIDDEN: "You don't have permission to perform this action.",
    "At least one file is required before submission":
      "Upload at least one completed file before submitting for QA.",
    "Task and file are required": "Select a file to upload.",
    "Task not found": "This task could not be found. Refresh and try again.",
    "Already clocked in": "You're already clocked in for this shift.",
    "Not clocked in": "Clock in before performing this action.",
    "Wrap-up required": "Submit your end-of-day wrap-up before clocking out.",
    "ACTIVE_TASK:": "Finish your current active task before starting another.",
  };

  if (msg.startsWith("ACTIVE_TASK:")) {
    return map["ACTIVE_TASK:"];
  }

  return map[msg] ?? (msg.length < 120 ? msg : "Something went wrong. Please try again.");
}
