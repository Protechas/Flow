#!/usr/bin/env node
/**
 * Guard against demo/mock ids reaching Supabase persist paths.
 * npm run check:persist
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "src", "lib");

const BAD_PATTERNS = [
  {
    label: "prefixed demo id in *-db.ts persist (use newPersistedId)",
    re: /id:\s*`\$\{prefix\}-\$\{Date\.now\(\)\}/,
    files: [{ dir: "data", name: "production-tracking-db.ts" }, { dir: "data", name: "wrap-ups-db.ts" }],
  },
  {
    label: "prefixed demo id in alert stores (use newPersistedId)",
    re: /`\$\{prefix\}-\$\{Date\.now\(\)\}|`hf-\$\{Date|`wla-\$\{Date/,
    files: [
      { dir: "help-flags", name: "store.ts" },
      { dir: "workload-alerts", name: "store.ts" },
    ],
  },
  {
    label: "prefixed demo id in project metrics store (use newPersistedId)",
    re: /`\$\{prefix\}-\$\{Date\.now\(\)\}|`pmd-\$\{Date|`pmv-\$\{Date/,
    files: [{ dir: "metrics", name: "project-metrics-store.ts" }],
  },
];

let failed = false;

function fail(msg) {
  console.error(`✗ ${msg}`);
  failed = true;
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

console.log("Flow persist contract check\n");

for (const { label, re, files } of BAD_PATTERNS) {
  for (const file of files) {
    const path = join(src, file.dir, file.name);
    const text = readFileSync(path, "utf8");
    if (re.test(text)) fail(`${file.name}: ${label}`);
    else ok(`${file.name} — no banned id pattern`);
  }
}

const persistTests = spawnSync(
  "npm",
  [
    "run",
    "test",
    "--",
    "src/lib/server/persisted-id.test.ts",
    "src/lib/server/persist-row.test.ts",
    "src/lib/data/production-tracking.persist.test.ts",
    "src/lib/help-flags/store.persist.test.ts",
  ],
  { cwd: root, stdio: "inherit", shell: process.platform === "win32" }
);

if (persistTests.status !== 0) {
  fail("Persist contract unit tests failed");
  process.exit(1);
}

ok("Persist contract unit tests passed");

if (failed) process.exit(1);
console.log("\n✓ Persist contract check passed");
