#!/usr/bin/env node
/**
 * Verify local + Vercel production linkage (read-only).
 * Run: npm run verify:production
 */

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const PRODUCTION_DOMAIN = "flowproduction.space";
const EXPECTED_SUPABASE_REF = "juzjxgmwoybhzclguhjd";

function ok(msg) {
  console.log(`✓ ${msg}`);
}
function warn(msg) {
  console.log(`○ ${msg}`);
}
function fail(msg) {
  console.error(`✗ ${msg}`);
}

function readLocalEnv() {
  const path = join(root, ".env.local");
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function vercelOutput(args) {
  const result = spawnSync("npx", ["vercel", ...args], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function main() {
  console.log("Flow production linkage check\n");

  let passed = true;

  const vercelProject = join(root, ".vercel", "project.json");
  if (existsSync(vercelProject)) {
    const link = JSON.parse(readFileSync(vercelProject, "utf8"));
    ok(`Local folder linked to Vercel project "${link.projectName}" (${link.projectId})`);
  } else {
    warn("No .vercel/project.json — run: npx vercel link");
    passed = false;
  }

  try {
    const out = vercelOutput(["project", "ls"]);
    if (out.includes(PRODUCTION_DOMAIN)) {
      ok(`Vercel project lists production URL https://${PRODUCTION_DOMAIN}`);
    } else {
      fail(`Vercel project list does not mention ${PRODUCTION_DOMAIN}`);
      passed = false;
    }
  } catch {
    warn("Could not run `vercel project ls` — log in with: npx vercel login");
  }

  try {
    const out = vercelOutput(["inspect", `https://${PRODUCTION_DOMAIN}`]);
    if (/Ready/i.test(out) && out.includes(PRODUCTION_DOMAIN)) {
      ok("Latest production deployment is Ready and aliases the custom domain");
    } else {
      warn("Production deployment inspect returned unexpected status");
    }
  } catch {
    warn("Could not inspect production deployment (Vercel CLI auth required)");
  }

  try {
    const out = vercelOutput(["env", "ls", "production"]);
    const required = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_SITE_URL",
      "NEXT_PUBLIC_FLOW_DEMO_MODE",
    ];
    for (const key of required) {
      if (out.includes(key)) ok(`Vercel production env: ${key} is set`);
      else {
        fail(`Vercel production env missing: ${key}`);
        passed = false;
      }
    }
  } catch {
    warn("Could not list Vercel production env vars");
  }

  const local = readLocalEnv();
  if (local.NEXT_PUBLIC_SUPABASE_URL?.includes(EXPECTED_SUPABASE_REF)) {
    ok(`Local .env.local points at Supabase project ${EXPECTED_SUPABASE_REF}`);
  } else if (local.NEXT_PUBLIC_SUPABASE_URL) {
    warn("Local Supabase URL differs from production project ref — OK for dev if intentional");
  }

  if (local.NEXT_PUBLIC_SITE_URL === "http://localhost:3000") {
    ok("Local NEXT_PUBLIC_SITE_URL is localhost (correct for dev)");
  } else if (local.NEXT_PUBLIC_SITE_URL?.includes(PRODUCTION_DOMAIN)) {
    warn("Local NEXT_PUBLIC_SITE_URL is production — use http://localhost:3000 for local dev");
  }

  console.log("\nManual checklist (Vercel dashboard + Supabase):");
  console.log(`  • NEXT_PUBLIC_SITE_URL = https://${PRODUCTION_DOMAIN}`);
  console.log(`  • NEXT_PUBLIC_FLOW_DEMO_MODE = false`);
  console.log(`  • Supabase → Auth → URL config → Site URL = https://${PRODUCTION_DOMAIN}`);
  console.log(`  • Redirect URL: https://${PRODUCTION_DOMAIN}/auth/callback`);
  console.log(`  • Redirect URL: https://${PRODUCTION_DOMAIN}/auth/callback/**`);
  console.log(`  • Redirect URL: https://${PRODUCTION_DOMAIN}/auth/confirm`);
  console.log(`  • Redirect URL: https://${PRODUCTION_DOMAIN}/auth/confirm/**`);
  console.log("  • Vercel → Git → connected to https://github.com/Protechas/Flow.git");
  console.log("  • After env changes: redeploy production (git push or npx vercel deploy --prod)");

  console.log("\n---");
  if (passed) {
    console.log("Production linkage looks correct from this machine.");
    process.exit(0);
  }
  console.log("Some linkage checks failed — review items above.");
  process.exit(1);
}

main();
