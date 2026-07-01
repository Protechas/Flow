#!/usr/bin/env node
/**
 * Guardrails learned from auth/persist bugs.
 * npm run check:action-auth
 */

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const REQUIRED = [
  {
    file: "src/app/actions/notifications.ts",
    label: "runWorkflowChecksAction requires auth",
    re: /export async function runWorkflowChecksAction[\s\S]*?requireUser\(\)/,
  },
  {
    file: "src/app/actions/help-flag-settings.ts",
    label: "getHelpFlagSettingsAction requires settings:manage",
    re: /export async function getHelpFlagSettingsAction[\s\S]*?requirePermission\("settings:manage"\)/,
  },
  {
    file: "src/app/actions/workload-alerts.ts",
    label: "getWorkloadAlertSettingsAction requires settings:manage",
    re: /export async function getWorkloadAlertSettingsAction[\s\S]*?requirePermission\("settings:manage"\)/,
  },
  {
    file: "src/app/actions/work-visibility-settings.ts",
    label: "getWorkVisibilitySettingsAction requires settings:manage",
    re: /export async function getWorkVisibilitySettingsAction[\s\S]*?requirePermission\("settings:manage"\)/,
  },
  {
    file: "src/app/actions/forecast-settings.ts",
    label: "getForecastSettingsAction requires auth",
    re: /export async function getForecastSettingsAction[\s\S]*?requireUser\(\)/,
  },
  {
    file: "src/lib/auth/session.ts",
    label: "no implicit MOCK_USERS fallback in getCurrentUser",
    re: /export async function getCurrentUser[\s\S]*?return getDemoUser\(\)/,
    forbid: /MOCK_USERS\[1\]|DEMO_USER_ID/,
  },
  {
    file: "src/lib/data/app-hydrate.ts",
    label: "help flags + workload alerts hydrate on app load",
    re: /ensureHelpFlagsHydrated[\s\S]*ensureWorkloadAlertsHydrated/,
  },
  {
    file: "src/lib/help-flags/store.ts",
    label: "help flags persist to Supabase",
    re: /schedulePersist\(|persistHelpFlag\(/,
  },
  {
    file: "src/lib/workload-alerts/store.ts",
    label: "workload alerts persist to Supabase",
    re: /schedulePersist\(|persistWorkloadAlert\(/,
  },
  {
    file: "src/app/actions/auth.ts",
    label: "signUpAction checks isSelfSignupAllowed",
    re: /export async function signUpAction[\s\S]*?isSelfSignupAllowed\(\)/,
  },
  {
    file: "src/lib/users/admin-guards.ts",
    label: "last-admin guard helper exists",
    re: /assertCanRemoveOrDeactivateUser/,
  },
  {
    file: "src/lib/users/admin-guards.ts",
    label: "admin demotion guard exists",
    re: /assertCanChangeUserAdminAccess/,
  },
  {
    file: "src/lib/metrics/project-metrics-permissions.ts",
    label: "canViewProjectMetrics is scoped to project",
    re: /export function canViewProjectMetrics\(user: User, project: Project\)/,
  },
  {
    file: "src/app/actions/departments.ts",
    label: "department reads require org structure permission",
    re: /async function requireOrgStructureRead\(\)[\s\S]*?departments:view/,
  },
  {
    file: "src/app/actions/positions.ts",
    label: "listOrgPositionsAction requires users:manage",
    re: /export async function listOrgPositionsAction[\s\S]*?requirePermission\("users:manage"\)/,
  },
  {
    file: "src/app/actions/crud.ts",
    label: "deleteCommentAction checks ownership",
    re: /export async function deleteCommentAction[\s\S]*?comment\.user_id === user\.id/,
  },
  {
    file: "src/lib/work-eligibility/scope.ts",
    label: "work eligibility override scope helper exists",
    re: /assertCanManageEmployeeEligibility/,
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

console.log("Flow action/auth contract check\n");

for (const { file, label, re, forbid } of REQUIRED) {
  const path = join(root, file);
  if (!existsSync(path)) {
    fail(`${file}: missing`);
    continue;
  }
  const text = readFileSync(path, "utf8");
  if (!re.test(text)) fail(`${file}: ${label}`);
  else if (forbid && forbid.test(text)) fail(`${file}: forbidden pattern (${label})`);
  else ok(`${file} — ${label}`);
}

if (failed) process.exit(1);
console.log("\n✓ Action/auth contract check passed");

const authTests = spawnSync(
  "npm",
  [
    "run",
    "test",
    "--",
    "src/lib/auth/session.test.ts",
    "src/lib/users/admin-guards.test.ts",
    "src/lib/metrics/project-metrics-permissions.test.ts",
    "src/lib/auth/signup-policy.test.ts",
    "src/lib/datetime/timezone.test.ts",
    "src/lib/work-eligibility/scope.test.ts",
  ],
  { cwd: root, stdio: "inherit", shell: process.platform === "win32" }
);

if (authTests.status !== 0) {
  fail("Action/auth contract unit tests failed");
  process.exit(1);
}

ok("Action/auth contract unit tests passed");
