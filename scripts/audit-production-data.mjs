#!/usr/bin/env node
/**
 * Scan in-memory / local store patterns for phantom reporting data.
 * Run against Supabase: node --env-file=.env.local scripts/audit-production-data.mjs
 *
 * Read-only — prints findings, does not delete.
 */

import pg from "pg";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const poolerHost = process.env.SUPABASE_DB_POOLER_HOST?.trim() || "aws-1-us-west-2.pooler.supabase.com";

function projectRefFromUrl(s) {
  const m = s?.match(/https:\/\/([^.]+)\.supabase\.co/);
  return m?.[1] ?? null;
}

async function connect(ref, password) {
  const encoded = encodeURIComponent(password);
  const client = new pg.Client({
    connectionString: `postgresql://postgres.${ref}:${encoded}@${poolerHost}:5432/postgres`,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });
  await client.connect();
  return client;
}

function section(title) {
  console.log(`\n## ${title}`);
}

async function main() {
  console.log("Flow production data audit (read-only)\n");

  if (!url || !dbPassword) {
    console.log("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env.local");
    process.exit(1);
  }

  const ref = projectRefFromUrl(url);
  if (!ref) {
    console.error("Invalid Supabase URL");
    process.exit(1);
  }

  const client = await connect(ref, dbPassword);

  try {
    section("Demo / test users");
    const demoUsers = await client.query(
      `SELECT id, email, full_name, role, is_active, last_login_at
       FROM users
       WHERE email ILIKE '%@flow.local' OR email ILIKE '%@example.%' OR email ILIKE 'test%@%'`
    );
    if (demoUsers.rows.length === 0) {
      console.log("✓ No demo-pattern user emails found");
    } else {
      console.log(`⚠ ${demoUsers.rows.length} user(s) with demo/test email patterns:`);
      for (const row of demoUsers.rows) {
        console.log(`  - ${row.email} (${row.full_name}, active=${row.is_active})`);
      }
    }

    section("Daily wrap-ups");
    const wrapUps = await client.query(
      `SELECT w.id, w.wrap_date, u.email, u.full_name, w.created_at
       FROM daily_wrap_ups w
       JOIN users u ON u.id = w.user_id
       ORDER BY w.wrap_date DESC
       LIMIT 50`
    );
    console.log(`Total wrap-ups in DB: ${(await client.query("SELECT count(*)::int AS n FROM daily_wrap_ups")).rows[0].n}`);
    if (wrapUps.rows.length === 0) {
      console.log("✓ No daily_wrap_ups rows stored (app uses in-memory until persistence is wired)");
    } else {
      for (const row of wrapUps.rows) {
        const flag = row.email?.includes("@flow.local") ? " [DEMO EMAIL]" : "";
        console.log(`  - ${row.wrap_date} ${row.full_name} (${row.email})${flag}`);
      }
    }

    const demoWrapUps = await client.query(
      `SELECT count(*)::int AS n FROM daily_wrap_ups w
       JOIN users u ON u.id = w.user_id
       WHERE u.email ILIKE '%@flow.local'`
    );
    if (demoWrapUps.rows[0].n > 0) {
      console.log(`⚠ ${demoWrapUps.rows[0].n} wrap-up(s) tied to @flow.local users — run migration 029 to remove`);
    }

    section("Users who never logged in");
    const neverLoggedIn = await client.query(
      `SELECT email, full_name, role, hire_date
       FROM users
       WHERE is_active = true AND last_login_at IS NULL
       ORDER BY email`
    );
    if (neverLoggedIn.rows.length === 0) {
      console.log("✓ All active users have a last_login_at timestamp");
    } else {
      console.log(`○ ${neverLoggedIn.rows.length} active user(s) with no recorded login (may be invited, not phantom):`);
      for (const row of neverLoggedIn.rows.slice(0, 15)) {
        console.log(`  - ${row.email} (${row.full_name})`);
      }
      if (neverLoggedIn.rows.length > 15) console.log(`  … and ${neverLoggedIn.rows.length - 15} more`);
    }

    section("Duplicate wrap-ups per user/day");
    const dupes = await client.query(
      `SELECT user_id, wrap_date, count(*)::int AS n
       FROM daily_wrap_ups
       GROUP BY user_id, wrap_date
       HAVING count(*) > 1`
    );
    if (dupes.rows.length === 0) {
      console.log("✓ No duplicate wrap-up rows");
    } else {
      console.log(`⚠ ${dupes.rows.length} duplicate user/day combination(s)`);
    }

    section("Application notes");
    console.log("• Phantom daily report rows were generated in-app for all hourly employees.");
    console.log("  Fixed: only employees with clock/task activity appear as Missing.");
    console.log("• Demo mock data loads only when NEXT_PUBLIC_FLOW_DEMO_MODE=true.");
    console.log("• Time clock / wrap-up persistence to Supabase is not yet wired — restart clears session data.");
  } finally {
    await client.end().catch(() => {});
  }

  console.log("\nAudit complete.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
