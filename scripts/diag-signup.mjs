#!/usr/bin/env node
import pg from "pg";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ref = url?.match(/https:\/\/([^.]+)/)?.[1];
const enc = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD ?? "");
const cs =
  process.env.SUPABASE_DB_URL?.trim() ||
  `postgresql://postgres.${ref}:${enc}@aws-1-us-west-2.pooler.supabase.com:5432/postgres`;

const testEmail = "diag-signup-test@protechas.com";

async function main() {
  const client = new pg.Client({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const fn = await client.query(
    "SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user'"
  );
  const src = fn.rows[0]?.prosrc ?? "";
  console.log("handle_new_user has signup_type:", src.includes("signup_type"));
  console.log("handle_new_user version snippet:", src.slice(0, 120).replace(/\s+/g, " "));

  const markUsers = await client.query(
    "SELECT id, email, role, is_active FROM public.users WHERE lower(email) = $1",
    ["mark.klingenhofer@protechas.com"]
  );
  console.log("mark in public.users:", markUsers.rows);

  const markAuth = await client.query(
    "SELECT id, email, created_at FROM auth.users WHERE lower(email) = $1",
    ["mark.klingenhofer@protechas.com"]
  );
  console.log("mark in auth.users:", markAuth.rows);

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  console.log("NEXT_PUBLIC_SITE_URL:", siteUrl);
  console.log("emailRedirectTo:", `${siteUrl}/auth/callback?next=/work`);

  const settings = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: anon },
  }).then((r) => r.json());
  console.log("disable_signup:", settings.disable_signup);
  console.log("mailer_autoconfirm:", settings.mailer_autoconfirm);

  // Test signup via auth API
  const signupRes = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: anon,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: testEmail,
      password: "TestSignup123!",
      data: {
        first_name: "Diag",
        last_name: "Test",
        full_name: "Diag Test",
        signup_type: "self",
        role: "employee",
      },
    }),
  });
  const signupBody = await signupRes.json();
  console.log("\nTest signup status:", signupRes.status);
  console.log("Test signup response:", JSON.stringify(signupBody, null, 2));

  if (signupBody.user?.id) {
    await client.query("DELETE FROM auth.users WHERE id = $1", [signupBody.user.id]);
    console.log("Cleaned up test auth user");
  }

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
