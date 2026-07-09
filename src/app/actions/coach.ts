"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getFlowStore, initFlowStore, setStoreUsers } from "@/lib/data/flow-store";
import type { CoachPersona } from "@/lib/coach/coach-types";

const PERSONAS: CoachPersona[] = ["professional", "encouraging", "drill_sergeant", "smartass"];

/** Employees set the attitude of their own coach — self-service, own row only. */
export async function setCoachPersonaAction(persona: CoachPersona) {
  const user = await requireUser();
  if (!PERSONAS.includes(persona)) {
    return { ok: false as const, message: "Unknown persona." };
  }
  if (isSupabaseConfigured() && isAdminConfigured()) {
    const admin = createAdminClient();
    const { error } = await admin
      .from("users")
      .update({ coach_persona: persona, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) return { ok: false as const, message: error.message };
  }
  // Patch the hydrated store so the very next render reflects the new attitude.
  initFlowStore();
  const users = getFlowStore().users;
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx >= 0) {
    const next = [...users];
    next[idx] = { ...next[idx], coach_persona: persona };
    setStoreUsers(next);
  }
  revalidatePath("/work");
  return { ok: true as const };
}
