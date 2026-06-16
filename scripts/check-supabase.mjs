#!/usr/bin/env node
/**
 * Quick check that Supabase env vars are set for production auth.
 * Run: node scripts/check-supabase.mjs
 */

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const recommended = ["SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SITE_URL"];

const demo = process.env.NEXT_PUBLIC_FLOW_DEMO_MODE;

console.log("Flow Supabase environment check\n");

if (demo === "true") {
  console.log("⚠  NEXT_PUBLIC_FLOW_DEMO_MODE=true — app uses demo auth, not Supabase.");
  console.log("   Set NEXT_PUBLIC_FLOW_DEMO_MODE=false in .env.local to enable Supabase.\n");
}

let ok = true;
for (const key of required) {
  const val = process.env[key];
  const set = val && !val.includes("your-") && val.length > 10;
  console.log(`${set ? "✓" : "✗"} ${key}${set ? "" : " (missing or placeholder)"}`);
  if (!set && demo !== "true") ok = false;
}

for (const key of recommended) {
  const val = process.env[key];
  const set = val && !val.includes("your-") && val.length > 5;
  console.log(`${set ? "✓" : "○"} ${key}${set ? "" : " (optional but needed for user invites)"}`);
}

console.log(ok || demo === "true" ? "\nReady to test: npm run dev → /login" : "\nFix .env.local then restart the dev server.");
process.exit(ok || demo === "true" ? 0 : 1);
