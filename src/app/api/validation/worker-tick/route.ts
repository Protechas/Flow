import { hostname } from "node:os";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Heartbeat endpoint for the audit worker (`npm run audit-worker`).
 *
 * A machine with the Python validation engine installed posts here on a
 * timer; each tick re-hydrates job state from Supabase and schedules any
 * pending or stale runs on THIS server. Production enqueues jobs but has no
 * Python, so the worker machine is what actually executes audits.
 */
export async function POST(request: Request) {
  const secret = process.env.VALIDATION_WORKER_SECRET;
  if (!secret || request.headers.get("x-worker-secret") !== secret) {
    return new NextResponse(null, { status: 404 });
  }

  const [{ invalidateValidationHydration }, { ensurePendingJobsRunning }, { getValidationMemoryState }] =
    await Promise.all([
      import("@/lib/validation-center/validation-center-db"),
      import("@/lib/validation-center/validation-job-runner"),
      import("@/lib/validation-center/store"),
    ]);

  // Force a fresh read — jobs may have been enqueued from production since
  // the last tick, and job processing continues async after we respond.
  invalidateValidationHydration();
  await ensurePendingJobsRunning();

  const jobs = getValidationMemoryState().memoryJobs;
  const counts = {
    pending: jobs.filter((j) => j.status === "pending").length,
    processing: jobs.filter((j) => j.status === "processing").length,
    completed: jobs.filter((j) => j.status === "completed").length,
    failed: jobs.filter((j) => j.status === "failed").length,
  };

  const { createAdminClient, isAdminConfigured } = await import("@/lib/supabase/admin");
  if (isAdminConfigured()) {
    await createAdminClient()
      .from("validation_settings")
      .upsert(
        {
          engine_id: "audit_worker",
          settings: { last_seen_at: new Date().toISOString(), host: hostname() },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "engine_id" }
      );
  }

  return NextResponse.json({ ok: true, ...counts });
}
