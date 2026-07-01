#!/usr/bin/env node
/**
 * One-shot remote Supabase setup for Flow.
 * Requires in .env.local:
 *   SUPABASE_DB_PASSWORD          — Database password (Settings → Database)
 *   SUPABASE_SERVICE_ROLE_KEY     — Secret key sb_secret_... (Settings → API)
 *   FLOW_ADMIN_EMAIL              — Your admin login email
 *   FLOW_ADMIN_PASSWORD           — Your admin login password
 *
 * Run: npm run setup:supabase
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns/promises";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const adminEmail = process.env.FLOW_ADMIN_EMAIL;
const adminPassword = process.env.FLOW_ADMIN_PASSWORD;
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

function dbConnectionCandidates(ref, password) {
  const encoded = encodeURIComponent(password);
  const fromEnv = process.env.SUPABASE_DB_URL?.trim();
  if (fromEnv) return [{ label: "SUPABASE_DB_URL", connectionString: fromEnv }];

  const poolerHost = process.env.SUPABASE_DB_POOLER_HOST?.trim();
  if (poolerHost) {
    return [
      {
        label: poolerHost,
        connectionString: `postgresql://postgres.${ref}:${encoded}@${poolerHost}:5432/postgres`,
      },
    ];
  }

  const regions = [
    "us-east-1",
    "us-east-2",
    "us-west-1",
    "us-west-2",
    "ca-central-1",
    "eu-west-1",
    "eu-west-2",
    "eu-west-3",
    "eu-central-1",
    "eu-central-2",
    "eu-north-1",
    "ap-south-1",
    "ap-southeast-1",
    "ap-southeast-2",
    "ap-northeast-1",
    "ap-northeast-2",
    "sa-east-1",
    "me-south-1",
    "af-south-1",
  ];
  const poolerPrefixes = ["aws-0", "aws-1"];

  const poolerCandidates = [];
  for (const prefix of poolerPrefixes) {
    for (const region of regions) {
      poolerCandidates.push({
        label: `${prefix}-${region}`,
        connectionString: `postgresql://postgres.${ref}:${encoded}@${prefix}-${region}.pooler.supabase.com:5432/postgres`,
      });
    }
  }

  return [
    ...poolerCandidates,
    {
      label: "direct",
      connectionString: `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`,
    },
  ];
}

async function connectDirect(ref, password) {
  const host = `db.${ref}.supabase.co`;
  const encoded = encodeURIComponent(password);

  let address;
  try {
    const addresses = await dns.resolve6(host);
    address = addresses[0];
  } catch {
    // Fall through to hostname connection (IPv4 networks with A record).
  }

  const connectionString = address
    ? `postgresql://postgres:${encoded}@[${address}]:5432/postgres`
    : `postgresql://postgres:${encoded}@${host}:5432/postgres`;

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false, servername: host },
    connectionTimeoutMillis: 15_000,
  });
  await client.connect();
  return client;
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
    console.log("  Connected via SUPABASE_DB_URL");
    return client;
  }

  try {
    const client = await connectDirect(ref, password);
    console.log("  Connected via direct (IPv6)");
    return client;
  } catch (directError) {
    const directMsg = directError instanceof Error ? directError.message : String(directError);
    console.log(`  × direct: ${directMsg}`);
  }

  const transactionPooler = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@db.${ref}.supabase.co:6543/postgres`;
  try {
    const client = new pg.Client({
      connectionString: transactionPooler,
      ssl: { rejectUnauthorized: false, servername: `db.${ref}.supabase.co` },
      connectionTimeoutMillis: 12_000,
    });
    await client.connect();
    console.log("  Connected via transaction pooler (6543)");
    return client;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  × transaction pooler: ${msg}`);
  }

  const candidates = dbConnectionCandidates(ref, password).filter((c) => c.label !== "direct");
  let lastError;

  for (const candidate of candidates) {
    const client = new pg.Client({
      connectionString: candidate.connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 12_000,
    });

    try {
      await client.connect();
      console.log(`  Connected via ${candidate.label}`);
      return client;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  × ${candidate.label}: ${msg}`);
      lastError = e;
      await client.end().catch(() => {});
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not connect — paste Session pooler URI into SUPABASE_DB_URL in .env.local");
}

async function checkTables() {
  const tables = ["users", "departments", "daily_wrap_ups", "forecast_settings", "help_flags", "org_positions"];
  for (const t of tables) {
    const r = await fetch(`${url}/rest/v1/${t}?select=id&limit=1`, {
      headers: { apikey: publishable, Authorization: `Bearer ${publishable}` },
    });
    console.log(`  ${t}: ${r.status === 200 ? "ok" : "missing"}`);
  }
}

async function runMigrations(client) {
  const dir = join(root, "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    process.stdout.write(`  Applying ${file}… `);
    try {
      await client.query(sql);
      console.log("ok");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes("already exists") ||
        msg.includes("duplicate") ||
        msg.includes("duplicate_object") ||
        msg.includes("already a member of enum")
      ) {
        console.log("skipped (already applied)");
      } else {
        console.log("error");
        throw e;
      }
    }
  }
}

async function createAdmin() {
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const adminProfile = {
    role: "admin",
    is_active: true,
    organizational_position: "manager",
    system_access_level: "admin",
  };

  const { data: authList } = await admin.auth.admin.listUsers();
  const authUser = authList?.users?.find((u) => u.email?.toLowerCase() === adminEmail.toLowerCase());

  if (!authUser) {
    const { data, error } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: adminEmail.split("@")[0],
        role: "admin",
      },
    });
    if (error) fail(`Create admin user failed: ${error.message}`);
    ok(`Created auth user ${adminEmail}`);
    const userId = data.user?.id;
    if (userId) {
      const { error: upErr } = await admin.from("users").update(adminProfile).eq("id", userId);
      if (upErr) fail(`Set admin role failed: ${upErr.message}`);
    }
  } else {
    const { error: pwErr } = await admin.auth.admin.updateUserById(authUser.id, {
      password: adminPassword,
      email_confirm: true,
    });
    if (pwErr) console.warn(`  Note: could not reset password: ${pwErr.message}`);
    const { error: upErr } = await admin.from("users").update(adminProfile).eq("id", authUser.id);
    if (upErr) fail(`Set admin role failed: ${upErr.message}`);
    ok(`Admin access preserved for ${adminEmail} (Manager + Admin)`);
  }
}

async function main() {
  console.log("Flow Supabase setup\n");

  if (!url || !publishable) {
    fail("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in .env.local");
  }

  const ref = projectRefFromUrl(url);
  if (!ref) fail("Invalid NEXT_PUBLIC_SUPABASE_URL");

  const health = await fetch(`${url}/auth/v1/health`, {
    headers: { apikey: publishable },
  });
  if (!health.ok) fail("Cannot reach Supabase auth — check URL and key");
  ok("Supabase auth reachable");

  console.log("\nTable check (before migrations):");
  await checkTables();

  if (dbPassword) {
    console.log("\nRunning migrations…");
    let client;
    try {
      client = await connectDb(ref, dbPassword);
      await runMigrations(client);
      ok("Migrations complete");
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    } finally {
      await client?.end().catch(() => {});
    }
  } else {
    console.log("\n○ Skipping migrations — set SUPABASE_DB_PASSWORD in .env.local");
  }

  console.log("\nTable check (after migrations):");
  await checkTables();

  if (serviceKey && adminEmail && adminPassword) {
    console.log("\nCreating admin user…");
    await createAdmin();
  } else {
    console.log("\n○ Skipping admin user — set in .env.local:");
    console.log("    SUPABASE_SERVICE_ROLE_KEY=sb_secret_...");
    console.log("    FLOW_ADMIN_EMAIL=you@company.com");
    console.log("    FLOW_ADMIN_PASSWORD=your-password");
  }

  console.log("\n--- Manual step (Supabase dashboard) ---");
  console.log("Authentication → URL configuration");
  console.log(`  Site URL: ${siteUrl}  (must NOT be localhost in production)`);
  console.log("  Redirect URLs — add:");
  console.log(`    ${siteUrl}/auth/callback`);
  console.log(`    ${siteUrl}/auth/callback/**`);
  console.log(`    ${siteUrl}/auth/confirm`);
  console.log(`    ${siteUrl}/auth/confirm/**`);
  console.log("\nThen: npm run dev → /login\n");
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
