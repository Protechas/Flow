#!/usr/bin/env node
/**
 * Apply specific Supabase migration files.
 * Usage: node --env-file=.env.local scripts/run-migration-files.mjs 026_user_profile_fields.sql 027_project_custom_metrics.sql
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const migrationsDir = join(root, "supabase", "migrations");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const files = process.argv.slice(2);

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
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

  const poolerHost = process.env.SUPABASE_DB_POOLER_HOST?.trim();
  const encoded = encodeURIComponent(password);
  if (poolerHost) {
    const client = new pg.Client({
      connectionString: `postgresql://postgres.${ref}:${encoded}@${poolerHost}:5432/postgres`,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15_000,
    });
    await client.connect();
    return client;
  }

  fail("Set SUPABASE_DB_PASSWORD and SUPABASE_DB_POOLER_HOST (or SUPABASE_DB_URL) in .env.local");
}

function isAlreadyAppliedError(msg) {
  return (
    msg.includes("already exists") ||
    msg.includes("duplicate") ||
    msg.includes("duplicate_object") ||
    msg.includes("already a member of enum")
  );
}

async function main() {
  if (!files.length) {
    fail("Pass migration filenames, e.g. 026_user_profile_fields.sql 027_project_custom_metrics.sql");
  }
  if (!url || !dbPassword) {
    fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD required in .env.local");
  }

  const ref = projectRefFromUrl(url);
  if (!ref) fail("Invalid NEXT_PUBLIC_SUPABASE_URL");

  const client = await connectDb(ref, dbPassword);
  try {
    for (const file of files) {
      const path = join(migrationsDir, file);
      const sql = readFileSync(path, "utf8");
      process.stdout.write(`Applying ${file}… `);
      try {
        await client.query(sql);
        console.log("ok");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (isAlreadyAppliedError(msg)) {
          console.log("skipped (already applied)");
        } else {
          console.log("error");
          throw e;
        }
      }
    }
    console.log("\n✓ Migrations complete");
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
