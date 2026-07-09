"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getFlowStore, initFlowStore, setStoreUsers } from "@/lib/data/flow-store";
import { computeBadges } from "@/lib/badges/badges";
import { COSMETIC_ACCENTS, COSMETIC_FRAMES } from "@/lib/badges/cosmetic-types";

/** Apply cosmetics to your own account. Unlocks are re-checked server-side
 * against the live badge state — no client is trusted about what's earned. */
export async function setCosmeticsAction(input: {
  frame: string | null;
  title: string | null;
  accent: string | null;
}) {
  const user = await requireUser();
  const badges = await computeBadges(user.id);
  const earnedCount = badges.filter((b) => b.earned).length;
  const earnedNames = new Set(badges.filter((b) => b.earned).map((b) => b.name));

  if (input.frame) {
    const frame = COSMETIC_FRAMES.find((f) => f.id === input.frame);
    if (!frame) return { ok: false as const, message: "Unknown frame." };
    if (earnedCount < frame.unlockCount) {
      return { ok: false as const, message: `${frame.label} unlocks at ${frame.unlockCount} badges.` };
    }
  }
  if (input.accent) {
    const accent = COSMETIC_ACCENTS.find((a) => a.id === input.accent);
    if (!accent) return { ok: false as const, message: "Unknown accent." };
    if (earnedCount < accent.unlockCount) {
      return { ok: false as const, message: `${accent.label} unlocks at ${accent.unlockCount} badges.` };
    }
  }
  if (input.title && !earnedNames.has(input.title)) {
    return { ok: false as const, message: "Earn that badge first." };
  }

  const patch = {
    avatar_frame: input.frame,
    flair_title: input.title,
    accent_color: input.accent,
  };

  if (isSupabaseConfigured() && isAdminConfigured()) {
    const admin = createAdminClient();
    const { error } = await admin
      .from("users")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) return { ok: false as const, message: error.message };
  }

  initFlowStore();
  const users = getFlowStore().users;
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx >= 0) {
    const next = [...users];
    next[idx] = { ...next[idx], ...patch };
    setStoreUsers(next);
  }
  revalidatePath("/work");
  return { ok: true as const };
}
