import "server-only";

import {
  findUploadGateViolations,
  type UploadGateViolation,
} from "@/lib/time-clock/upload-gate";
import { appTodayDate, isAppCalendarDay } from "@/lib/datetime/timezone";
import {
  getTodayTaskFileUploads,
  getTodayTimedTaskIds,
} from "@/lib/data/production-tracking";
import { getFlowStore } from "@/lib/data/flow-store";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { WorkPackage } from "@/types/flow";

/**
 * Clock-out gate check with FRESH database reads. The in-memory store on a
 * serverless instance can lag an upload made seconds earlier through a
 * different instance — a gate that blocks someone's clock-out must never
 * fail on cache staleness (July 16: Michael Johnson uploaded his file and
 * stayed blocked).
 */
export async function listUploadGateViolationsFresh(
  userId: string
): Promise<UploadGateViolation[]> {
  if (!isSupabaseConfigured()) {
    // Demo mode: single process, the store IS the source of truth.
    return findUploadGateViolations({
      userId,
      timedTaskIds: getTodayTimedTaskIds(userId),
      tasks: getFlowStore().workPackages,
      uploadsToday: getTodayTaskFileUploads(),
    });
  }

  try {
    const client = isAdminConfigured() ? createAdminClient() : await createClient();
    const today = appTodayDate();
    // 36h window comfortably covers any timezone offset; exact day filter below.
    const since = new Date(Date.now() - 36 * 3600_000).toISOString();

    const [entriesRes, uploadsRes] = await Promise.all([
      client
        .from("task_time_entries")
        .select("task_id, user_id, started_at")
        .eq("user_id", userId)
        .gte("started_at", since),
      client
        .from("task_file_uploads")
        .select("task_id, user_id, uploaded_at")
        .eq("user_id", userId)
        .gte("uploaded_at", since),
    ]);

    const timedTaskIds = [
      ...new Set(
        (entriesRes.data ?? [])
          .filter((e) => isAppCalendarDay(e.started_at, today))
          .map((e) => e.task_id)
      ),
    ];
    if (timedTaskIds.length === 0) return [];

    const { data: taskRows } = await client
      .from("work_items")
      .select("id, title, status, qa_required, files_required, notes")
      .in("id", timedTaskIds);

    return findUploadGateViolations({
      userId,
      timedTaskIds,
      tasks: (taskRows ?? []) as WorkPackage[],
      uploadsToday: (uploadsRes.data ?? []).filter((u) =>
        isAppCalendarDay(u.uploaded_at, today)
      ),
    });
  } catch (e) {
    // The gate is an accountability rail, not a trap: if the fresh check
    // itself fails, let the clock-out through rather than strand someone.
    console.error(
      "[upload-gate] fresh check failed, allowing clock-out:",
      e instanceof Error ? e.message : e
    );
    return [];
  }
}
