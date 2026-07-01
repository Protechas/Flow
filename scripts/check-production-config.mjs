#!/usr/bin/env node
/**
 * Validate environment variables required for production stability.
 * Run: node scripts/check-production-config.mjs
 * With Supabase: node --env-file=.env.local scripts/check-production-config.mjs
 */

const PRODUCTION_HOST = "flowproduction.space";

const REQUIRED_ALWAYS = [
  "NEXT_PUBLIC_SITE_URL",
];

const REQUIRED_PRODUCTION = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

function ok(msg) {
  console.log(`✓ ${msg}`);
}
function fail(msg) {
  console.error(`✗ ${msg}`);
}
function warn(msg) {
  console.log(`○ ${msg}`);
}

function isSet(key) {
  const val = process.env[key];
  return Boolean(val && !val.includes("your-") && val.length > 8);
}

function main() {
  console.log("Flow production config check\n");

  const demo = process.env.NEXT_PUBLIC_FLOW_DEMO_MODE === "true";
  const vercelProd = process.env.VERCEL_ENV === "production";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  let passed = true;

  if (demo) {
    warn("NEXT_PUBLIC_FLOW_DEMO_MODE=true — OK for local dev/CI, not for production.");
    if (vercelProd) {
      fail("Production deployment must not use demo mode.");
      passed = false;
    }
  } else {
    ok("Demo mode is off");
    for (const key of REQUIRED_PRODUCTION) {
      if (isSet(key)) ok(`${key} is set`);
      else {
        fail(`${key} missing or placeholder`);
        passed = false;
      }
    }
  }

  for (const key of REQUIRED_ALWAYS) {
    if (isSet(key) || siteUrl.length > 5) ok(`${key}=${siteUrl || process.env[key]}`);
    else {
      fail(`${key} missing`);
      passed = false;
    }
  }

  if (vercelProd && siteUrl.includes("localhost")) {
    fail(`Production NEXT_PUBLIC_SITE_URL is localhost: ${siteUrl}`);
    passed = false;
  } else if (siteUrl.includes(PRODUCTION_HOST)) {
    ok(`Site URL targets production host (${PRODUCTION_HOST})`);
  }

  if (!demo) {
    const confirm = `${siteUrl.replace(/\/$/, "")}/auth/confirm`;
    const callback = `${siteUrl.replace(/\/$/, "")}/auth/callback`;
    ok(`Invite/reset links should use ${confirm}?next=…`);
    warn(`Verify Supabase Auth redirect URLs include ${callback} and ${confirm} (with /** wildcards)`);
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith("eyJ")) {
    warn("Never expose SUPABASE_SERVICE_ROLE_KEY to client bundles — server-only.");
  }

  const tz = process.env.NEXT_PUBLIC_FLOW_TIMEZONE ?? process.env.FLOW_TIMEZONE;
  if (tz) ok(`Organization timezone: ${tz}`);
  else if (vercelProd && !demo) {
    warn("NEXT_PUBLIC_FLOW_TIMEZONE not set — app defaults to America/Chicago for shift clocks.");
  }

  console.log("\n---");
  if (passed) {
    console.log("Production config check passed.");
    process.exit(0);
  }
  console.log("Production config check failed.");
  process.exit(1);
}

main();
