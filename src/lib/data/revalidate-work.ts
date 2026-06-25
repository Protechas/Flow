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
