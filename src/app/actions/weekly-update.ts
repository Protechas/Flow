"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { appCurrentHour, appDayOfWeek, appTodayDate } from "@/lib/datetime/timezone";
import {
  addWeeklyUpdateComment,
  getWeeklyUpdate,
  getWeeklyUpdateById,
  markWeeklyUpdateReassigned,
  upsertWeeklyUpdate,
} from "@/lib/data/weekly-updates-db";
import { hydrateOperatingModels } from "@/lib/operating-models/hydrate";
import { resolveOperatingModelForTeam } from "@/lib/operating-models/resolve";
import { weekOfFriday } from "@/lib/wrap-up/manager-update";
import { sanitizeWrapUpSections } from "@/lib/wrap-up/sections";
import {
  teamWeeklyUpdatesEnabled,
  weeklyUpdateWindowState,
} from "@/lib/wrap-up/weekly-update";

const ALLOWED_REACTIONS = new Set(["👍", "✅", "❓", "⚠️", "🎉"]);

function canModerate(role: string): boolean {
  return hasPermission(role, "work:view_all") || hasPermission(role, "people:view_team");
}

export async function submitWeeklyUpdateAction(input: { sections: Record<string, string> }) {
  try {
    const user = await requireUser();
    await hydrateOperatingModels();
    const model = resolveOperatingModelForTeam(user.team_id);
    if (!user.team_id || !teamWeeklyUpdatesEnabled(model)) {
      return { ok: false as const, message: "Your team doesn't file weekly updates." };
    }
    const config = model.weeklyUpdates!;
    const weekOf = weekOfFriday(appTodayDate());
    const existing = await getWeeklyUpdate(user.id, weekOf);

    const window = weeklyUpdateWindowState(config, appDayOfWeek(), appCurrentHour());
    const reopened = existing?.status === "reassigned";
    if (window === "before_open" && !reopened) {
      return { ok: false as const, message: "Weekly updates open Thursday at 5:00 PM." };
    }
    if (window === "closed" && !reopened) {
      return {
        ok: false as const,
        message:
          "The submission window closed Friday at 3:00 PM. Ask your manager to reopen it if you need to revise.",
      };
    }

    const sections = sanitizeWrapUpSections(input.sections, config.fields);
    if (!sections) {
      return { ok: false as const, message: "Fill in at least one section before submitting." };
    }

    await upsertWeeklyUpdate({
      user_id: user.id,
      team_id: user.team_id,
      week_of: weekOf,
      sections,
    });
    revalidatePath("/work");
    revalidatePath("/wrap-ups");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Could not save your weekly update.",
    };
  }
}

export async function reassignWeeklyUpdateAction(input: { updateId: string; note?: string }) {
  try {
    const user = await requireUser();
    if (!canModerate(user.role)) {
      return { ok: false as const, message: "Only managers can reopen a weekly update." };
    }
    await markWeeklyUpdateReassigned(input.updateId, user.id, input.note?.trim() || null);
    revalidatePath("/wrap-ups");
    revalidatePath("/work");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Could not reopen the update.",
    };
  }
}

export async function addWeeklyUpdateCommentAction(input: {
  updateId: string;
  body?: string;
  emoji?: string;
}) {
  try {
    const user = await requireUser();
    const isReaction = !!input.emoji;
    if (isReaction && !ALLOWED_REACTIONS.has(input.emoji!)) {
      return { ok: false as const, message: "Unsupported reaction." };
    }
    const body = input.body?.trim();
    if (!isReaction && !body) {
      return { ok: false as const, message: "Write a comment first." };
    }
    // Authors can discuss their own update; managers/leadership can always.
    if (!canModerate(user.role)) {
      const target = await getWeeklyUpdateById(input.updateId);
      if (!target || target.user_id !== user.id) {
        return { ok: false as const, message: "You can only comment on your own update." };
      }
    }
    await addWeeklyUpdateComment({
      update_id: input.updateId,
      user_id: user.id,
      kind: isReaction ? "reaction" : "comment",
      body: isReaction ? undefined : body,
      emoji: isReaction ? input.emoji : undefined,
    });
    revalidatePath("/wrap-ups");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Could not save the comment.",
    };
  }
}
