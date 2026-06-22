import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export type StartQueueTaskResult =
  | { ok: true; taskId: string }
  | { ok: false; code?: string; message?: string; activeTaskId?: string };

export function taskWorkspaceHref(taskId: string, opts?: { autostart?: boolean }) {
  return opts?.autostart ? `/work/${taskId}?autostart=1` : `/work/${taskId}`;
}

export function navigateToTaskWorkspace(
  router: AppRouterInstance,
  taskId: string,
  opts?: { autostart?: boolean }
) {
  router.push(taskWorkspaceHref(taskId, opts));
}
