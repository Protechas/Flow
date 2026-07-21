"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { appTodayDate } from "@/lib/datetime/timezone";
import { upsertManagerWeeklyUpdate } from "@/lib/data/manager-updates-db";
import { hydrateOperatingModels } from "@/lib/operating-models/hydrate";
import { resolveOperatingModelForTeam } from "@/lib/operating-models/resolve";
import {
  canSubmitManagerUpdate,
  isFridayAppDate,
  weekOfFriday,
} from "@/lib/wrap-up/manager-update";
import { sanitizeWrapUpSections } from "@/lib/wrap-up/sections";

export async function submitManagerWeeklyUpdateAction(input: {
  sections: Record<string, string>;
}) {
  try {
    const user = await requireUser();
    await hydrateOperatingModels();
    const model = resolveOperatingModelForTeam(user.team_id);
    if (!canSubmitManagerUpdate(user, model)) {
      return { ok: false as const, message: "Your team doesn't file a weekly manager update." };
    }

    const today = appTodayDate();
    if (!isFridayAppDate(today)) {
      return {
        ok: false as const,
        message: "The weekly manager update opens on Friday.",
      };
    }

    const sections = sanitizeWrapUpSections(input.sections, model.managerUpdate?.fields ?? []);
    if (!sections) {
      return { ok: false as const, message: "Fill in at least one section before submitting." };
    }

    await upsertManagerWeeklyUpdate({
      user_id: user.id,
      team_id: user.team_id as string,
      week_of: weekOfFriday(today),
      sections,
    });

    revalidatePath("/wrap-ups");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Could not save the weekly update.",
    };
  }
}
