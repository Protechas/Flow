#!/usr/bin/env node
/**
 * Apply self-signup migration and enable email signups on hosted Supabase.
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_DB_PASSWORD
 *   SUPABASE_SERVICE_ROLE_KEY (optional, for auth config check)
 *
 * Optional:
 *   SUPABASE_ACCESS_TOKEN — personal access token from supabase.com/dashboard/account/tokens
 *   SUPABASE_DB_POOLER_HOST
 *   NEXT_PUBLIC_SITE_URL
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

function projectRefFromUrl(s) {
  const m = s?.match(/https:\/\/([^.]+)\.supabase\.co/);
  return m?.[1] ?? null;
}

async function connectDb(ref, password) {
  const encoded = encodeURIComponent(password);
  const poolerHost =
    process.env.SUPABASE_DB_POOLER_HOST?.trim() || `aws-1-us-west-2.pooler.supabase.com`;
  const connectionString = `postgresql://postgres.${ref}:${encoded}@${poolerHost}:5432/postgres`;

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });
  await client.connect();
  return client;
}

async function applyMigration022(client) {
  const sql = readFileSync(
    join(root, "supabase", "migrations", "022_self_signup_employee_only.sql"),
    "utf8"
  );
  process.stdout.write("  Applying 022_self_signup_employee_only.sql… ");
  try {
    await client.query(sql);
    console.log("ok");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("already exists") || msg.includes("duplicate")) {
      console.log("skipped (already applied)");
    } else {
      throw e;
    }
  }
}

async function enableAuthSignups(ref) {
  if (!accessToken) {
    console.log("\n○ Skipping auth dashboard config — set SUPABASE_ACCESS_TOKEN in .env.local");
    console.log("  Create one at: https://supabase.com/dashboard/account/tokens");
    return false;
  }

  const callback = `${siteUrl}/auth/callback`;
  const signupRedirect = `${siteUrl}/auth/callback?next=/work`;

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      disable_signup: false,
      external_email_enabled: true,
      site_url: siteUrl,
      uri_allow_list: [callback, signupRedirect, `${siteUrl}/auth/reset-password`].join(","),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    fail(`Auth config update failed (${res.status}): ${body}`);
  }

  ok("Email signups enabled via Supabase Management API");
  ok(`Site URL: ${siteUrl}`);
  ok(`Redirect URLs include ${callback}`);
  return true;
}

async function verifySignupAllowed() {
  const res = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: publishable },
  });
  if (!res.ok) {
    console.log(`\n○ Could not read auth settings (${res.status})`);
    return;
  }
  const data = await res.json();
  const disabled = data?.disable_signup === true;
  if (disabled) {
    console.log("\n⚠ Signups still disabled on project — enable in Supabase dashboard:");
    console.log("  Authentication → Providers → Email → Enable sign ups");
  } else {
    ok("Auth settings report signups allowed");
  }
}

async function main() {
  if (!url || !publishable) fail("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!dbPassword) fail("Set SUPABASE_DB_PASSWORD in .env.local");

  const ref = projectRefFromUrl(url);
  if (!ref) fail("Invalid NEXT_PUBLIC_SUPABASE_URL");

  console.log("Flow — enable employee self-signup\n");

  let client;
  try {
    client = await connectDb(ref, dbPassword);
    ok("Connected to database");
    await applyMigration022(client);
  } finally {
    await client?.end().catch(() => {});
  }

  await enableAuthSignups(ref);
  await verifySignupAllowed();

  console.log("\nDone. Employees can use /auth/signup on the live app.\n");
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
