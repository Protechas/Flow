#!/usr/bin/env node
/**
 * Apply every SQL file in supabase/migrations (sorted).
 * Usage: node --env-file=.env.local scripts/run-all-migrations.mjs
 */

import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "supabase", "migrations");
const runner = join(__dirname, "run-migration-files.mjs");

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const result = spawnSync(process.execPath, [runner, ...files], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
