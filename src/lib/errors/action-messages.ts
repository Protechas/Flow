/** Maps server/action error codes to user-facing copy. */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const record = error as { message?: string; hint?: string; code?: string };
    if (record.message) {
      if (record.code === "PGRST205" && record.message.includes("org_positions")) {
        return "Org positions are not set up in the database yet. Run migration 023_org_positions.sql on Supabase, or retry — positions will work in-memory for this session.";
      }
      return record.hint ? `${record.message} (${record.hint})` : record.message;
    }
  }
  return "Something went wrong. Please try again.";
}

export function formatActionError(error: unknown): string {
  const msg = extractErrorMessage(error);

  const map: Record<string, string> = {
    FORBIDDEN: "You don't have permission to perform this action.",
    "At least one file is required before submission":
      "Upload at least one completed file before submitting for QA.",
    "Task and file are required": "Select a file to upload.",
    "Task not found": "This task could not be found. Refresh and try again.",
    "Already clocked in": "You're already clocked in for this shift.",
    "Not clocked in": "Clock in before performing this action.",
    WRAP_UP_REQUIRED: "Submit your end-of-day wrap-up before clocking out.",
    CLOCK_IN_REQUIRED: "You must be clocked in before starting work.",
    ON_BREAK: "You are on a lunch break. Clock back in before resuming work.",
    ACCOUNT_INACTIVE: "Your account is not active. Contact an administrator.",
    "ACTIVE_TASK:": "Finish your current active task before starting another.",
  };

  if (msg.startsWith("ACTIVE_TASK:")) {
    return map["ACTIVE_TASK:"];
  }

  if (map[msg]) {
    return map[msg];
  }

  return msg.length < 120 ? msg : "Something went wrong. Please try again.";
}
