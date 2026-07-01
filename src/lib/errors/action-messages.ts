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
    "Already clocked in": "You are already clocked in for this shift.",
    "Not clocked in": "You are not clocked in. Clock in before performing this action.",
    WRAP_UP_REQUIRED: "Submit your end-of-day wrap-up before clocking out.",
    CLOCK_IN_REQUIRED: "You must be clocked in before starting work.",
    ON_BREAK: "You are on a lunch break. Clock back in before resuming work.",
    ACCOUNT_INACTIVE: "Your account is not active. Contact an administrator.",
    "Your account setup is not complete. Ask your manager to assign your department, team, and supervisor in Settings → Users.":
      "Your account setup is not complete. Ask your manager to finish your profile in Settings → Users.",
    "Salary employees are not required to use the shift clock":
      "Your account is set to salary — shift clock is not required. You can start tasks directly.",
    "ACTIVE_TASK:": "Finish your current active task before starting another.",
    "Could not sign in. Please check your email and password.":
      "Could not sign in. Please check your email and password.",
    "Clock-in could not be saved. Please refresh and try again.":
      "Clock-in could not be saved. Please refresh and try again.",
    "Clock-out could not be saved. Please refresh and try again.":
      "Clock-out could not be saved. Please refresh and try again.",
    "Task could not be created. Please try again or contact admin.":
      "Task could not be created. Please try again or contact admin.",
    "Production data could not save. Set SUPABASE_SERVICE_ROLE_KEY in production environment variables.":
      "Your change could not be saved. Contact an administrator — server persistence is not configured.",
    "Daily reports could not save. Set SUPABASE_SERVICE_ROLE_KEY in production environment variables.":
      "Your daily report could not be saved. Contact an administrator.",
  };

  if (msg.includes("PERSIST_ID_INVALID")) {
    return "Your change could not be saved because of invalid record IDs. Contact an administrator.";
  }

  if (msg.startsWith("ACTIVE_TASK:")) {
    return map["ACTIVE_TASK:"];
  }

  if (map[msg]) {
    return map[msg];
  }

  return msg.length < 120 ? msg : "Something went wrong. Please try again.";
}
