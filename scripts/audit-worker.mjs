#!/usr/bin/env node
/**
 * ProTech Audit Worker — runs the Flow validation engine on this machine.
 *
 * Audits enqueued from flowproduction.space cannot execute on Vercel (no
 * Python). This script starts a local Flow server and ticks it on a timer;
 * each tick picks up pending audit jobs from Supabase, runs the Python
 * engine locally, and writes results back — so runs started on the live
 * site complete automatically while this window stays open.
 *
 * Usage (from flow/):
 *   npm run build          # once, after every code update
 *   npm run audit-worker   # leave running
 *
 * Requires: .env.local with Supabase keys + VALIDATION_WORKER_SECRET,
 * Python 3 with packages/protech-validation-engine importable.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.AUDIT_WORKER_PORT ?? 3210);
const TICK_MS = Number(process.env.AUDIT_WORKER_TICK_MS ?? 20_000);
const secret = process.env.VALIDATION_WORKER_SECRET;

function log(msg) {
  console.log(`[audit-worker ${new Date().toLocaleTimeString()}] ${msg}`);
}

if (!secret) {
  console.error(
    "VALIDATION_WORKER_SECRET is not set. Add it to flow/.env.local and run via: npm run audit-worker"
  );
  process.exit(1);
}
if (!existsSync(join(root, ".next"))) {
  console.error("No production build found. Run `npm run build` first.");
  process.exit(1);
}

log(`starting local Flow server on port ${PORT}…`);
const server = spawn("npx", ["next", "start", "--hostname", "127.0.0.1", "--port", String(PORT)], {
  cwd: root,
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
  shell: process.platform === "win32",
});
server.stdout.on("data", (d) => {
  const line = d.toString().trim();
  if (line.includes("Ready") || line.includes("Error")) log(`server: ${line}`);
});
server.stderr.on("data", (d) => log(`server: ${d.toString().trim()}`));
server.on("exit", (code) => {
  log(`server exited (${code ?? "signal"}) — worker stopping`);
  process.exit(code ?? 1);
});

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/login`, { redirect: "manual" });
      if (res.status < 500) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

let lastCounts = "";
async function tick() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/validation/worker-tick`, {
      method: "POST",
      headers: { "x-worker-secret": secret },
    });
    if (!res.ok) {
      log(`tick failed: HTTP ${res.status}`);
      return;
    }
    const body = await res.json();
    const summary = `pending ${body.pending} · processing ${body.processing} · completed ${body.completed} · failed ${body.failed}`;
    if (summary !== lastCounts) {
      log(summary);
      lastCounts = summary;
    }
  } catch (e) {
    log(`tick error: ${e instanceof Error ? e.message : e}`);
  }
}

const up = await waitForServer();
if (!up) {
  console.error("Local server never became ready — check the build and try again.");
  server.kill();
  process.exit(1);
}
log("server ready — audit worker online. Leave this window open.");
await tick();
const interval = setInterval(tick, TICK_MS);

process.on("SIGINT", () => {
  log("shutting down…");
  clearInterval(interval);
  server.kill();
  process.exit(0);
});
