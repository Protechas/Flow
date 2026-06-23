#!/usr/bin/env node
/**
 * Apply a single SQL migration to remote Supabase.
 * Usage: node --env-file=.env.local scripts/run-migration.mjs 023_org_positions.sql
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns/promises";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const migrationFile = process.argv[2] || "023_org_positions.sql";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

function projectRefFromUrl(s) {
  const m = s?.match(/https:\/\/([^.]+)\.supabase\.co/);
  return m?.[1] ?? null;
}

function dbConnectionCandidates(ref, password) {
  const encoded = encodeURIComponent(password);
  const fromEnv = process.env.SUPABASE_DB_URL?.trim();
  if (fromEnv) return [{ label: "SUPABASE_DB_URL", connectionString: fromEnv }];

  const regions = [
    "us-east-1", "us-east-2", "us-west-1", "us-west-2", "ca-central-1",
    "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-central-2",
    "eu-north-1", "ap-south-1", "ap-southeast-1", "ap-southeast-2",
    "ap-northeast-1", "ap-northeast-2", "sa-east-1",
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
    // hostname fallback
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
    console.log("Connected via SUPABASE_DB_URL");
    return client;
  }

  try {
    const client = await connectDirect(ref, password);
    console.log("Connected via direct (IPv6)");
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
    console.log("Connected via transaction pooler (6543)");
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
      console.log(`Connected via ${candidate.label}`);
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
    : new Error("Could not connect — add Session pooler URI to SUPABASE_DB_URL in .env.local");
}

async function main() {
  if (!url) fail("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!dbPassword) fail("SUPABASE_DB_PASSWORD is not set in .env.local");

  const ref = projectRefFromUrl(url);
  if (!ref) fail("Invalid NEXT_PUBLIC_SUPABASE_URL");

  const path = join(root, "supabase", "migrations", migrationFile);
  const sql = readFileSync(path, "utf8");

  console.log(`Applying ${migrationFile}…`);
  const client = await connectDb(ref, dbPassword);
  try {
    await client.query(sql);
    console.log(`✓ ${migrationFile} applied successfully`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      msg.includes("already exists") ||
      msg.includes("duplicate") ||
      msg.includes("duplicate_object")
    ) {
      console.log(`○ ${migrationFile} already applied (skipped)`);
    } else {
      fail(msg);
    }
  } finally {
    await client.end().catch(() => {});
  }

  const check = await fetch(`${url}/rest/v1/org_positions?select=id&limit=1`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
  });
  console.log(`org_positions API: ${check.status === 200 ? "ok" : `status ${check.status}`}`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
