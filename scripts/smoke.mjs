#!/usr/bin/env node
/**
 * Fast critical workflow gate — run before deploy.
 * npm run smoke
 * npm run smoke -- --full   (includes migration check when Supabase env is set)
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const full = process.argv.includes("--full");

function readEnvFile(name) {
  const path = join(root, name);
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const e2eEnv = {
  ...readEnvFile(".env.e2e"),
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
};

function run(label, command, args, env = {}) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    console.error(`\n✗ ${label} failed`);
    process.exit(result.status ?? 1);
  }
  console.log(`✓ ${label}`);
}

console.log("Flow smoke gate\n");

run("Unit tests", "npm", ["run", "test"]);

run("Lint", "npm", ["run", "lint"]);

run("Persist contract", "npm", ["run", "check:persist"]);

run("Action/auth contract", "npm", ["run", "check:action-auth"]);

run("Structure defaults", "npm", ["run", "check:structure-defaults"]);

run("Production config", "node", ["scripts/check-production-config.mjs"], {
  NEXT_PUBLIC_FLOW_DEMO_MODE: process.env.NEXT_PUBLIC_FLOW_DEMO_MODE ?? "true",
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000",
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder",
});

run("Production build", "npm", ["run", "build"], e2eEnv);

if (full && process.env.SUPABASE_DB_PASSWORD) {
  run("Migration / schema check", "node", ["scripts/check-migrations.mjs"]);
} else if (full) {
  console.log("\n○ Skipping migration check — SUPABASE_DB_PASSWORD not set");
}

run("Install Playwright chromium", "npx", ["playwright", "install", "chromium"]);

run("E2E smoke tests", "npm", ["run", "test:e2e"], {
  CI: "true",
  PW_USE_START: "true",
  ...e2eEnv,
});

console.log("\n✓ All smoke checks passed");
