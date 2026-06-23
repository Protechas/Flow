#!/usr/bin/env node
/**
 * Create or confirm a user via Supabase Admin API (no signup confirmation email).
 * Usage:
 *   node --env-file=.env.local scripts/provision-user-admin.mjs \
 *     --email mark.klingenhofer@protechas.com \
 *     --first Mark --last Klingenhofer \
 *     --password 'TempPass123!'
 */
import { createClient } from "@supabase/supabase-js";

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (arg("--email") || "").trim().toLowerCase();
const first = (arg("--first") || "").trim();
const last = (arg("--last") || "").trim();
const password = arg("--password");

if (!url || !service) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!email || !password) {
  console.error("Usage: --email user@company.com --password 'Secret123!' [--first Name] [--last Name]");
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const fullName = [first, last].filter(Boolean).join(" ") || email.split("@")[0];

const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);

if (existing) {
  console.log("User already exists in auth:", existing.id);
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    email_confirm: true,
    user_metadata: {
      ...existing.user_metadata,
      first_name: first || existing.user_metadata?.first_name,
      last_name: last || existing.user_metadata?.last_name,
      full_name: fullName,
    },
  });
  if (error) {
    console.error("Update failed:", error.message);
    process.exit(1);
  }
  console.log("Confirmed existing user. They can sign in or reset password.");
  process.exit(0);
}

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: {
    first_name: first || email.split("@")[0],
    last_name: last || null,
    full_name: fullName,
    signup_type: "admin",
    role: "employee",
  },
});

if (error) {
  console.error("Create failed:", error.message);
  process.exit(1);
}

console.log("Created user:", data.user?.id, email);
console.log("They can sign in immediately at /login with the password you set.");
