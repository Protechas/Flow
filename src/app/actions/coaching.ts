"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { canViewerSeeUser } from "@/lib/auth/team-scope";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore, logActivityBridge } from "@/lib/data/production-bridge";
import { hasAdminAccess } from "@/lib/auth/access-level";
import { deliverNotification } from "@/lib/notifications/notifications";
import { writeAuditLog } from "@/lib/audit/audit-log";
import {
  acknowledgeCoachingSession,
  createCoachingSession,
  getCoachingSessionById,
  resolveCoachingSession,
} from "@/lib/coaching/sessions";
import type { CoachingCategory, CoachingLevel } from "@/types/flow";

const CATEGORIES = new Set<CoachingCategory>([
  "time_attendance",
  "quality",
  "conduct",
  "performance",
  "other",
]);
const LEVELS = new Set<CoachingLevel>([
  "coaching",
  "verbal_warning",
  "written_warning",
  "final_warning",
]);

const COACHING_PATHS = ["/coaching", "/work/coaching", "/people"];

function revalidateCoaching() {
  for (const path of COACHING_PATHS) revalidatePath(path);
}

/** Coaching is a leadership act — same gate as assigning work. */
function canCoach(role: string): boolean {
  return hasPermission(role, "work:assign");
}

export async function logCoachingSessionAction(input: {
  employeeId: string;
  sessionDate: string;
  category: CoachingCategory;
  level: CoachingLevel;
  summary: string;
  expectation?: string;
  followUpDate?: string;
}) {
  const user = await requireUser();
  if (!canCoach(user.role)) {
    return { ok: false as const, message: "You do not have permission to log coaching sessions" };
  }
  if (!CATEGORIES.has(input.category)) return { ok: false as const, message: "Pick a category" };
  if (!LEVELS.has(input.level)) return { ok: false as const, message: "Pick a level" };
  if (!input.summary.trim()) {
    return { ok: false as const, message: "Write what was discussed — that's the record" };
  }
  if (input.employeeId === user.id) {
    return { ok: false as const, message: "You can't log a coaching session on yourself" };
  }

  try {
    await ensureAppDataLoaded();
    const store = getFlowStore();
    const employee = store.users.find((u) => u.id === input.employeeId);
    if (!employee) return { ok: false as const, message: "Employee not found" };
    if (!hasAdminAccess(user) && !canViewerSeeUser(user, employee.id, store.users, store.teams)) {
      return { ok: false as const, message: "That person is outside your team scope" };
    }

    const session = await createCoachingSession({
      employee_id: input.employeeId,
      coach_id: user.id,
      session_date: input.sessionDate,
      category: input.category,
      level: input.level,
      summary: input.summary,
      expectation: input.expectation,
      follow_up_date: input.followUpDate,
    });

    deliverNotification({
      user_id: employee.id,
      type: "coaching_update",
      title: "Coaching session recorded",
      message: `${user.full_name} logged a coaching conversation. Review and acknowledge it.`,
      related_entity_type: "coaching_session",
      related_entity_id: session.id,
      link: "/work/coaching",
    });
    await writeAuditLog({
      action: "status_changed",
      entityType: "coaching_session",
      entityId: session.id,
      summary: `Coaching session logged for ${employee.full_name} (${input.category}, ${input.level})`,
      metadata: { employee_id: employee.id, category: input.category, level: input.level },
      actorId: user.id,
      actorEmail: user.email,
    });

    revalidateCoaching();
    return { ok: true as const, session };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Could not save the session" };
  }
}

/** Employee confirms the conversation happened — the accountability half. */
export async function acknowledgeCoachingSessionAction(sessionId: string) {
  const user = await requireUser();
  try {
    const session = await getCoachingSessionById(sessionId);
    if (!session) return { ok: false as const, message: "Session not found" };
    if (session.employee_id !== user.id) {
      return { ok: false as const, message: "Only the coached employee can acknowledge" };
    }
    if (session.acknowledged_at) return { ok: true as const };

    await acknowledgeCoachingSession(sessionId);
    await ensureAppDataLoaded();
    deliverNotification({
      user_id: session.coach_id,
      type: "coaching_update",
      title: "Coaching acknowledged",
      message: `${user.full_name} acknowledged the coaching session from ${session.session_date}.`,
      related_entity_type: "coaching_session",
      related_entity_id: sessionId,
      link: "/coaching",
    });
    revalidateCoaching();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Could not acknowledge" };
  }
}

export async function resolveCoachingSessionAction(sessionId: string, note?: string) {
  const user = await requireUser();
  if (!canCoach(user.role)) {
    return { ok: false as const, message: "You do not have permission to resolve coaching sessions" };
  }
  try {
    const session = await getCoachingSessionById(sessionId);
    if (!session) return { ok: false as const, message: "Session not found" };
    if (session.status === "resolved") return { ok: true as const };

    await resolveCoachingSession(sessionId, note);
    await ensureAppDataLoaded();
    logActivityBridge(user.id, "status_change", "Resolved a coaching follow-up");
    await writeAuditLog({
      action: "status_changed",
      entityType: "coaching_session",
      entityId: sessionId,
      summary: `Coaching session resolved${note?.trim() ? ` — ${note.trim().slice(0, 120)}` : ""}`,
      metadata: { employee_id: session.employee_id },
      actorId: user.id,
      actorEmail: user.email,
    });
    revalidateCoaching();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Could not resolve" };
  }
}
