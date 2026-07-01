#!/usr/bin/env node
/**
 * Verify production Supabase schema matches what the app expects.
 * Run: node --env-file=.env.local scripts/check-migrations.mjs
 */

import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { REQUIRED_COLUMNS, REQUIRED_TABLES } from "./required-schema.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const migrationsDir = join(root, "supabase", "migrations");

function ok(msg) {
  console.log(`✓ ${msg}`);
}
function fail(msg) {
  console.error(`✗ ${msg}`);
}
function warn(msg) {
  console.log(`○ ${msg}`);
}

function projectRefFromUrl(s) {
  const m = s?.match(/https:\/\/([^.]+)\.supabase\.co/);
  return m?.[1] ?? null;
}

async function connectDb(ref, password) {
  const fromEnv = process.env.SUPABASE_DB_URL?.trim();
  if (fromEnv) {
    const client = new pg.Client({
      connectionString: fromEnv,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15_000,
    });
    await client.connect();
    return client;
  }

  const poolerHost =
    process.env.SUPABASE_DB_POOLER_HOST?.trim() || "aws-1-us-west-2.pooler.supabase.com";
  const encoded = encodeURIComponent(password);
  const client = new pg.Client({
    connectionString: `postgresql://postgres.${ref}:${encoded}@${poolerHost}:5432/postgres`,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });
  await client.connect();
  return client;
}

async function main() {
  console.log("Flow migration / schema check\n");

  const demo = process.env.NEXT_PUBLIC_FLOW_DEMO_MODE === "true";
  if (demo) {
    warn("NEXT_PUBLIC_FLOW_DEMO_MODE=true — skipping live DB schema check (demo mode).");
    process.exit(0);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!url || !password) {
    fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env.local");
    process.exit(1);
  }

  const ref = projectRefFromUrl(url);
  if (!ref) {
    fail("Invalid NEXT_PUBLIC_SUPABASE_URL");
    process.exit(1);
  }

  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  ok(`Found ${migrationFiles.length} migration files in supabase/migrations`);
  ok(`Latest migration: ${migrationFiles[migrationFiles.length - 1]}`);

  let client;
  try {
    client = await connectDb(ref, password);
    ok("Connected to Supabase Postgres");
  } catch (e) {
    fail(`DB connect failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  let passed = true;
  try {
    console.log("\nRequired tables");
    for (const table of REQUIRED_TABLES) {
      const r = await client.query("SELECT to_regclass($1) AS v", [`public.${table}`]);
      if (r.rows[0]?.v) ok(table);
      else {
        passed = false;
        fail(`Missing table: ${table}`);
      }
    }

    console.log("\nRequired columns");
    for (const check of REQUIRED_COLUMNS) {
      const r = await client.query(check.sql);
      if (r.rowCount > 0) ok(check.label);
      else {
        passed = false;
        fail(`Missing column/type: ${check.label}`);
      }
    }

    const trigger = await client.query(`
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
    `);
    if (trigger.rowCount > 0) ok("handle_new_user() trigger function exists");
    else {
      passed = false;
      fail("Missing handle_new_user() — run 002_auth_users.sql");
    }
  } finally {
    await client.end().catch(() => {});
  }

  console.log("\n---");
  if (passed) {
    console.log("Schema check passed — production DB matches app expectations.");
    process.exit(0);
  }
  console.log("Schema check FAILED — run npm run migrate:all before deploying.");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
