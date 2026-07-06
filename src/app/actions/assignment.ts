"use server";

import { requirePermission } from "@/lib/auth/session";
import { suggestAssignees, type AssigneeSuggestion } from "@/lib/operations/assignment-suggest";

/** Ranked "best fit" assignees for a task — capacity, familiarity, QA quality. */
export async function suggestAssigneesAction(
  taskId: string
): Promise<AssigneeSuggestion[]> {
  await requirePermission("work:assign");
  return suggestAssignees(taskId);
}
