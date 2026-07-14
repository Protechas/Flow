import { revalidatePath } from "next/cache";

const WORK_SURFACE_PATHS = [
  "/operations",
  "/executive",
  "/people",
  "/project-health",
  "/projects",
  "/qa-center",
  "/reports",
  "/work",
  "/performance",
  "/planning",
  "/alert-center",
] as const;

/**
 * Narrow set for a task create/edit inside an existing project: only the
 * surfaces that list tasks. Every extra path here multiplies into client
 * prefetch refetches after the action, so keep this list tight.
 */
export function revalidateTaskSurfaces(projectId?: string | null) {
  revalidatePath("/operations");
  revalidatePath("/work");
  revalidatePath("/projects");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
}

/** Revalidate list pages, nested program routes, and an optional specific program. */
export function revalidateWorkSurfaces(projectId?: string | null) {
  for (const path of WORK_SURFACE_PATHS) {
    revalidatePath(path);
  }
  revalidatePath("/projects", "layout");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
}
