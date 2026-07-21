import "server-only";

import {
  findUploadGateViolations,
  type UploadGateViolation,
} from "@/lib/time-clock/upload-gate";
import { appTodayDate, isAppCalendarDay } from "@/lib/datetime/timezone";
import {
  getTodayTaskFileUploads,
  getTodayTimedMinutesByTask,
} from "@/lib/data/production-tracking";
import { getFlowStore } from "@/lib/data/flow-store";
import { resolveUploadGateForProject } from "@/lib/operating-models/resolve";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { ResolvedUploadGate } from "@/lib/operating-models/types";
import type { Project, WorkPackage } from "@/types/flow";

/**
 * Clock-out gate check with FRESH database reads. The in-memory store on a
 * serverless instance can lag an upload made seconds earlier through a
 * different instance — a gate that blocks someone's clock-out must never fail
 * on cache staleness (July 16: Michael Johnson uploaded his file and stayed
 * blocked). Gate behavior (on/off, minutes threshold) comes from each task's
 * team operating model, so teams tune their own clock-out rules.
 */

/** Resolve a task's gate config via its project's team operating model. */
function gateResolver(
  projectsById: Map<string, Pick<Project, "project_type" | "team_id" | "department_id">>
) {
  const teams = getFlowStore().teams;
  const cache = new Map<string, ResolvedUploadGate>();
  return (task: WorkPackage): ResolvedUploadGate => {
    const key = task.project_id ?? "__none__";
    const cached = cache.get(key);
    if (cached) return cached;
    const project = projectsById.get(task.project_id);
    const gate = resolveUploadGateForProject(project ?? {}, teams);
    cache.set(key, gate);
    return gate;
  };
}

export async function listUploadGateViolationsFresh(
  userId: string
): Promise<UploadGateViolation[]> {
  if (!isSupabaseConfigured()) {
    // Demo mode: single process, the store IS the source of truth.
    const store = getFlowStore();
    const projectsById = new Map(store.projects.map((p) => [p.id, p]));
    return findUploadGateViolations({
      userId,
      timedMinutesByTask: getTodayTimedMinutesByTask(userId),
      tasks: store.workPackages,
      uploadsToday: getTodayTaskFileUploads(),
      resolveGate: gateResolver(projectsById),
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
        .select("task_id, user_id, started_at, ended_at, total_active_minutes")
        .eq("user_id", userId)
        .gte("started_at", since),
      client
        .from("task_file_uploads")
        .select("task_id, user_id, uploaded_at")
        .eq("user_id", userId)
        .gte("uploaded_at", since),
    ]);

    const timedMinutesByTask: Record<string, number> = {};
    for (const e of entriesRes.data ?? []) {
      if (!isAppCalendarDay(e.started_at, today)) continue;
      // Banked minutes if the entry is closed; live elapsed if still running.
      const minutes =
        e.ended_at == null
          ? (Date.now() - new Date(e.started_at).getTime()) / 60000
          : Number(e.total_active_minutes ?? 0);
      timedMinutesByTask[e.task_id] = (timedMinutesByTask[e.task_id] ?? 0) + minutes;
    }
    const timedTaskIds = Object.keys(timedMinutesByTask);
    if (timedTaskIds.length === 0) return [];

    const { data: taskRows } = await client
      .from("work_items")
      .select("id, title, status, qa_required, files_required, notes, project_id")
      .in("id", timedTaskIds);

    const projectIds = [
      ...new Set(
        (taskRows ?? []).map((t) => t.project_id).filter((id): id is string => Boolean(id))
      ),
    ];
    const projectsById = new Map<
      string,
      Pick<Project, "project_type" | "team_id" | "department_id">
    >();
    if (projectIds.length) {
      const { data: projectRows } = await client
        .from("projects")
        .select("id, project_type, team_id, department_id")
        .in("id", projectIds);
      for (const p of projectRows ?? []) {
        projectsById.set(p.id, p as Pick<Project, "project_type" | "team_id" | "department_id">);
      }
    }

    return findUploadGateViolations({
      userId,
      timedMinutesByTask,
      tasks: (taskRows ?? []) as WorkPackage[],
      uploadsToday: (uploadsRes.data ?? []).filter((u) =>
        isAppCalendarDay(u.uploaded_at, today)
      ),
      resolveGate: gateResolver(projectsById),
    });
  } catch (e) {
    // The gate is an accountability rail, not a trap: if the fresh check itself
    // fails, let the clock-out through rather than strand someone.
    console.error(
      "[upload-gate] fresh check failed, allowing clock-out:",
      e instanceof Error ? e.message : e
    );
    return [];
  }
}
