#!/usr/bin/env node
/**
 * Health check for remote Supabase schema + API exposure.
 * Run: node --env-file=.env.local scripts/verify-supabase.mjs
 */

import dns from "node:dns/promises";
import pg from "pg";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

const REST_TABLES = [
  "users",
  "teams",
  "departments",
  "department_users",
  "projects",
  "work_items",
  "daily_wrap_ups",
  "forecast_settings",
  "help_flags",
  "workload_alerts",
  "org_positions",
  "company_documents",
  "feedback_submissions",
];

const DB_CHECKS = [
  { label: "org_positions table", sql: "SELECT to_regclass('public.org_positions') AS v" },
  {
    label: "users.assigned_position_id",
    sql: `SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='users' AND column_name='assigned_position_id'`,
  },
  {
    label: "users.organizational_position",
    sql: `SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='users' AND column_name='organizational_position'`,
  },
  {
    label: "org_position_status enum",
    sql: `SELECT 1 FROM pg_type WHERE typname='org_position_status'`,
  },
  {
    label: "organizational_position enum",
    sql: `SELECT 1 FROM pg_type WHERE typname='organizational_position'`,
  },
];

function fail(msg) {
  console.error(`✗ ${msg}`);
  return false;
}

function ok(msg) {
  console.log(`✓ ${msg}`);
  return true;
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
      connectionTimeoutMillis: 12_000,
    });
    await client.connect();
    return { client, via: "SUPABASE_DB_URL" };
  }

  const encoded = encodeURIComponent(password);
  const regions = [
    "us-east-1", "us-east-2", "us-west-1", "us-west-2", "ca-central-1",
    "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-central-2",
    "eu-north-1", "ap-south-1", "ap-southeast-1", "ap-southeast-2",
    "ap-northeast-1", "ap-northeast-2", "sa-east-1",
  ];
  const prefixes = ["aws-0", "aws-1"];

  for (const prefix of prefixes) {
    for (const region of regions) {
      const connectionString = `postgresql://postgres.${ref}:${encoded}@${prefix}-${region}.pooler.supabase.com:5432/postgres`;
      const client = new pg.Client({
        connectionString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 8_000,
      });
      try {
        await client.connect();
        return { client, via: `${prefix}-${region}` };
      } catch {
        await client.end().catch(() => {});
      }
    }
  }

  const host = `db.${ref}.supabase.co`;
  let address;
  try {
    address = (await dns.resolve6(host))[0];
  } catch {
    // ignore
  }
  const connectionString = address
    ? `postgresql://postgres:${encoded}@[${address}]:5432/postgres`
    : `postgresql://postgres:${encoded}@${host}:5432/postgres`;
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false, servername: host },
    connectionTimeoutMillis: 12_000,
  });
  await client.connect();
  return { client, via: "direct" };
}

async function checkRest() {
  console.log("\nREST API (PostgREST)");
  let allOk = true;
  for (const table of REST_TABLES) {
    const r = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    });
    const status = r.status;
    if (status === 200) ok(`${table}: reachable`);
    else {
      allOk = false;
      fail(`${table}: HTTP ${status}`);
    }
  }
  return allOk;
}

async function checkDb(ref) {
  if (!dbPassword) {
    warn("Skipping DB schema checks — SUPABASE_DB_PASSWORD not set");
    return true;
  }

  console.log("\nDatabase schema");
  let client;
  let via = "";
  try {
    ({ client, via } = await connectDb(ref, dbPassword));
    ok(`Connected via ${via}`);
  } catch (e) {
    fail(`DB connect failed: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }

  let allOk = true;
  try {
    for (const check of DB_CHECKS) {
      const r = await client.query(check.sql);
      const pass = check.sql.includes("information_schema") || check.sql.includes("pg_type")
        ? r.rowCount > 0
        : Boolean(r.rows[0]?.v);
      if (pass) ok(check.label);
      else {
        allOk = false;
        fail(check.label);
      }
    }

    const counts = await client.query(`
      SELECT
        (SELECT count(*)::int FROM org_positions) AS positions,
        (SELECT count(*)::int FROM users WHERE assigned_position_id IS NOT NULL) AS users_with_seat,
        (SELECT count(*)::int FROM users WHERE is_active) AS active_users
    `);
    const row = counts.rows[0];
    console.log(`\nData snapshot`);
    ok(`org_positions rows: ${row.positions}`);
    ok(`users with assigned seat: ${row.users_with_seat}`);
    ok(`active users: ${row.active_users}`);

    const rls = await client.query(`
      SELECT c.relname, c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'org_positions'
    `);
    if (rls.rows[0]) {
      if (rls.rows[0].relrowsecurity) {
        const policies = await client.query(`
          SELECT count(*)::int AS n
          FROM pg_policies
          WHERE schemaname = 'public' AND tablename = 'org_positions'
        `);
        const n = policies.rows[0]?.n ?? 0;
        if (n >= 4) ok(`org_positions RLS enabled (${n} policies)`);
        else warn(`org_positions RLS enabled but only ${n} policies — run 024_org_positions_rls.sql`);
      } else {
        ok("org_positions RLS disabled (run 024_org_positions_rls.sql for production hardening)");
      }
    }
  } finally {
    await client.end().catch(() => {});
  }
  return allOk;
}

async function checkAuth() {
  console.log("\nAuth");
  const r = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anon } });
  if (r.ok) ok("Auth service healthy");
  else return fail(`Auth health HTTP ${r.status}`);
  if (service) ok("Service role key configured");
  else warn("SUPABASE_SERVICE_ROLE_KEY missing — invites/admin writes may fail");
  return true;
}

async function main() {
  console.log("Flow Supabase verification\n");
  if (!url || !anon) {
    fail("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY required");
    process.exit(1);
  }

  const ref = projectRefFromUrl(url);
  if (!ref) {
    fail("Invalid NEXT_PUBLIC_SUPABASE_URL");
    process.exit(1);
  }
  ok(`Project ref: ${ref}`);

  const results = await Promise.all([
    checkAuth(),
    checkRest(),
    checkDb(ref),
  ]);

  console.log("\n---");
  if (results.every(Boolean)) {
    console.log("All checks passed.");
    process.exit(0);
  }
  console.log("Some checks failed — review output above.");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
