#!/usr/bin/env node
/**
 * Guard against demo structure ids in production create paths.
 * npm run check:structure-defaults
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const REQUIRED = [
  {
    file: "src/lib/departments/structure-defaults.ts",
    label: "structure defaults helper exists",
    re: /resolveProjectStructureDefaults/,
  },
  {
    file: "src/lib/data/flow-store.ts",
    label: "createProject uses structure defaults",
    re: /resolveProjectStructureDefaults/,
    forbid: /team_id:\s*teamId|input\.team_id \?\? "team-1"/,
  },
  {
    file: "src/lib/system-health/repair-plans.ts",
    label: "system health repair plans exist",
    re: /planClearMissingOrgParents/,
  },
  {
    file: "src/app/actions/system-health-repair.ts",
    label: "system health repair action exists",
    re: /runSystemHealthRepairAction/,
  },
];

let failed = false;

for (const { file, label, re, forbid } of REQUIRED) {
  const path = join(root, file);
  const text = readFileSync(path, "utf8");
  if (!re.test(text)) {
    console.error(`✗ ${file}: ${label}`);
    failed = true;
  } else if (forbid && forbid.test(text)) {
    console.error(`✗ ${file}: forbidden demo fallback (${label})`);
    failed = true;
  } else {
    console.log(`✓ ${file} — ${label}`);
  }
}

if (failed) process.exit(1);
console.log("\n✓ Structure defaults check passed");

const tests = await import("node:child_process").then(({ spawnSync }) =>
  spawnSync("npm", ["run", "test", "--", "src/lib/system-health/structure-defaults.test.ts"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  })
);

if (tests.status !== 0) process.exit(1);
