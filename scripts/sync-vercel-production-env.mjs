#!/usr/bin/env node
/**
 * Sync production env vars on Vercel from .env.local (non-localhost values only).
 * Run: node scripts/sync-vercel-production-env.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const PRODUCTION_SITE = "https://flowproduction.space";

function readEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    out[key] = value;
  }
  return out;
}

function setVercelEnv(name, value) {
  spawnSync("npx", ["vercel", "env", "rm", name, "production", "-y"], {
    cwd: root,
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  const result = spawnSync("npx", ["vercel", "env", "add", name, "production"], {
    cwd: root,
    input: value,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(`Failed to set ${name}:`, result.stderr || result.stdout);
    return false;
  }
  console.log(`✓ ${name}`);
  return true;
}

const local = readEnv(join(root, ".env.local"));
const values = {
  NEXT_PUBLIC_SUPABASE_URL: local.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: local.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: local.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SITE_URL: PRODUCTION_SITE,
  NEXT_PUBLIC_FLOW_DEMO_MODE: "false",
  NEXT_PUBLIC_FLOW_TIMEZONE: local.NEXT_PUBLIC_FLOW_TIMEZONE ?? local.FLOW_TIMEZONE ?? "America/Chicago",
};

let ok = true;
for (const [key, value] of Object.entries(values)) {
  if (!value) {
    console.error(`✗ Missing ${key} in .env.local`);
    ok = false;
    continue;
  }
  if (!setVercelEnv(key, value)) ok = false;
}

process.exit(ok ? 0 : 1);
