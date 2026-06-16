#!/usr/bin/env node
/** Reset admin password from FLOW_ADMIN_EMAIL / FLOW_ADMIN_PASSWORD in .env.local */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.FLOW_ADMIN_EMAIL;
const password = process.env.FLOW_ADMIN_PASSWORD;

if (!url || !serviceKey || !email || !password) {
  console.error("Missing env: URL, service key, FLOW_ADMIN_EMAIL, FLOW_ADMIN_PASSWORD");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: authList, error: listErr } = await admin.auth.admin.listUsers();
if (listErr) {
  console.error("List users failed:", listErr.message);
  process.exit(1);
}

const user = authList.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No auth user found for ${email}`);
  process.exit(1);
}

const { error } = await admin.auth.admin.updateUserById(user.id, {
  password,
  email_confirm: true,
});
if (error) {
  console.error("Password reset failed:", error.message);
  process.exit(1);
}

const { error: roleErr } = await admin.from("users").update({ role: "admin", is_active: true }).eq("id", user.id);
if (roleErr) {
  console.error("Role update failed:", roleErr.message);
  process.exit(1);
}

console.log(`Password updated for ${email} (${password.length} characters)`);
