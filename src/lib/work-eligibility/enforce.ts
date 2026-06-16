import { hasPermission } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit/audit-log";
import type { User } from "@/types/flow";
import { recordBlockedWorkAttempt } from "./audit";
import { getWorkEligibility } from "./evaluate";
import type { WorkEligibilityAction } from "./types";
import { WORK_ELIGIBILITY_ERROR, type WorkEligibilityErrorCode } from "./types";

export class WorkEligibilityError extends Error {
  code: WorkEligibilityErrorCode;

  constructor(code: WorkEligibilityErrorCode, message: string) {
    super(message);
    this.name = "WorkEligibilityError";
    this.code = code;
  }
}

function errorCodeForBlock(eligibility: ReturnType<typeof getWorkEligibility>): WorkEligibilityErrorCode {
  if (!eligibility.accountActive) return WORK_ELIGIBILITY_ERROR.ACCOUNT_INACTIVE;
  if (eligibility.status === "needs_setup") return WORK_ELIGIBILITY_ERROR.SETUP_INCOMPLETE;
  if (eligibility.onApprovedBreak) return WORK_ELIGIBILITY_ERROR.ON_BREAK;
  return WORK_ELIGIBILITY_ERROR.CLOCK_IN_REQUIRED;
}

function messageForBlock(eligibility: ReturnType<typeof getWorkEligibility>, action: WorkEligibilityAction): string {
  if (!eligibility.accountActive) {
    return "Your account is not active. Contact an administrator.";
  }
  if (eligibility.status === "needs_setup") {
    return "Your account setup is not complete. Please contact your manager or administrator.";
  }
  if (eligibility.onApprovedBreak) {
    return "You are on a lunch break. Clock back in before resuming work.";
  }
  switch (action) {
    case "upload_file":
      return "You must be clocked in before uploading task files.";
    case "submit_task":
    case "submit_qa":
    case "submit_production":
      return "You must be clocked in before submitting work.";
    case "start_timer":
    case "resume_timer":
      return "You must be clocked in before starting a task timer.";
    case "start_task":
    case "resume_task":
    default:
      return "You must be clocked in before starting work.";
  }
}

export interface AssertWorkEligibleOptions {
  managerOverride?: boolean;
  overrideReason?: string;
  taskId?: string;
}

export async function assertWorkEligible(
  user: User,
  action: WorkEligibilityAction,
  options?: AssertWorkEligibleOptions
): Promise<void> {
  if (
    options?.managerOverride &&
    hasPermission(user.role, "work:assign")
  ) {
    await writeAuditLog({
      action: "workflow_alert",
      entityType: "work_eligibility",
      entityId: user.id,
      summary: `Manager override: ${action}`,
      metadata: {
        event: "work_eligibility_override",
        action,
        reason: options.overrideReason ?? "Manager authorized",
        task_id: options.taskId ?? null,
      },
      actorId: user.id,
      actorEmail: user.email,
    });
    return;
  }

  const eligibility = getWorkEligibility(user);
  if (eligibility.eligible) return;

  const reason = messageForBlock(eligibility, action);
  await recordBlockedWorkAttempt(user, action, reason, options?.taskId);
  throw new WorkEligibilityError(errorCodeForBlock(eligibility), reason);
}

/** Returns structured result for actions that prefer not to throw. */
export async function checkWorkEligible(
  user: User,
  action: WorkEligibilityAction,
  options?: AssertWorkEligibleOptions
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  try {
    await assertWorkEligible(user, action, options);
    return { ok: true };
  } catch (e) {
    if (e instanceof WorkEligibilityError) {
      return { ok: false, code: e.code, message: e.message };
    }
    throw e;
  }
}
