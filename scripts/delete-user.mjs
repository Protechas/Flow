#!/usr/bin/env node
/**
 * Delete a Supabase auth + Flow profile user by email.
 * Usage: node scripts/delete-user.mjs user@company.com
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/delete-user.mjs user@company.com");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function optionalTableError(error) {
  return error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "42703";
}

async function detach(userId) {
  const ops = [
    admin.from("org_positions").update({ assigned_user_id: null, status: "vacant" }).eq("assigned_user_id", userId),
    admin.from("users").update({ manager_id: null }).eq("manager_id", userId),
    admin.from("users").update({ assigned_position_id: null }).eq("id", userId),
    admin.from("teams").update({ manager_id: null }).eq("manager_id", userId),
    admin.from("teams").update({ team_lead_user_id: null }).eq("team_lead_user_id", userId),
    admin.from("departments").update({ lead_user_id: null }).eq("lead_user_id", userId),
    admin.from("projects").update({ project_owner_id: null }).eq("project_owner_id", userId),
    admin.from("work_items").update({ assigned_to: null }).eq("assigned_to", userId),
    admin.from("year_work_items").update({ assigned_to: null }).eq("assigned_to", userId),
    admin.from("time_clock_entries").update({ edited_by: null }).eq("edited_by", userId),
    admin.from("department_users").delete().eq("user_id", userId),
    admin.from("user_hierarchy").delete().or(`user_id.eq.${userId},parent_user_id.eq.${userId}`),
    admin.from("qa_review_records").delete().eq("reviewer_id", userId),
  ];
  for (const op of ops) {
    const { error } = await op;
    if (error && !optionalTableError(error)) throw new Error(error.message);
  }
}

async function main() {
  const { data: profile, error: findError } = await admin
    .from("users")
    .select("id, email, full_name")
    .eq("email", email)
    .maybeSingle();

  if (findError) throw findError;

  let userId = profile?.id;
  if (!userId) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUser = list?.users?.find((u) => u.email?.toLowerCase() === email);
    userId = authUser?.id;
    if (!userId) {
      console.log(`No user found for ${email}`);
      return;
    }
    console.log(`Found auth-only user ${userId}`);
  } else {
    console.log(`Deleting ${profile.full_name} (${profile.email})`);
  }

  await detach(userId);
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) throw deleteError;

  console.log(`Deleted ${email}. You can invite or create the account again.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
