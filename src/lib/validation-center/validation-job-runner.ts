import { isValidationDbEnabled } from "@/lib/validation-center/validation-persistence";

const activeJobs = new Set<string>();
const pendingQueue: string[] = [];
const MAX_CONCURRENT_JOBS = 2;
export const VALIDATION_JOB_TIMEOUT_MS = 35 * 60 * 1000;

function isStaleProcessing(startedAt: string | null | undefined): boolean {
  if (!startedAt) return true;
  return Date.now() - new Date(startedAt).getTime() > VALIDATION_JOB_TIMEOUT_MS;
}

export function scheduleValidationJob(runId: string): void {
  if (activeJobs.has(runId) || pendingQueue.includes(runId)) return;
  if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
    pendingQueue.push(runId);
    return;
  }
  void runValidationJobAsync(runId);
}

function drainValidationJobQueue(): void {
  while (pendingQueue.length > 0 && activeJobs.size < MAX_CONCURRENT_JOBS) {
    const next = pendingQueue.shift();
    if (next && !activeJobs.has(next)) void runValidationJobAsync(next);
  }
}

async function runValidationJobAsync(runId: string): Promise<void> {
  if (activeJobs.has(runId)) return;
  activeJobs.add(runId);
  try {
    const { processValidationJob } = await import("@/lib/validation-center/runs");
    await processValidationJob(runId);
    if (isValidationDbEnabled()) {
      const { invalidateValidationHydration } = await import(
        "@/lib/validation-center/validation-center-db"
      );
      invalidateValidationHydration();
    }
  } catch (err) {
    console.error("[validation] job failed", runId, err);
  } finally {
    activeJobs.delete(runId);
    drainValidationJobQueue();
  }
}

export async function ensurePendingJobsRunning(runId?: string): Promise<void> {
  const { getValidationMemoryState } = await import("@/lib/validation-center/store");
  const { hydrateValidationCenterFromDb, invalidateValidationHydration } = await import(
    "@/lib/validation-center/validation-center-db"
  );

  invalidateValidationHydration();
  await hydrateValidationCenterFromDb();

  const jobs = getValidationMemoryState().memoryJobs;
  for (const job of jobs) {
    if (runId && job.run_id !== runId) continue;
    const shouldRun =
      job.status === "pending" ||
      (job.status === "processing" && isStaleProcessing(job.started_at));
    if (shouldRun) scheduleValidationJob(job.run_id);
  }
}
