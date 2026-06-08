import type { Manufacturer, Project, WorkPackage } from "@/types/flow";

export function isActiveProject(project: Project): boolean {
  return project.status !== "archived";
}

export function isActiveManufacturer(mfr: Manufacturer): boolean {
  return !mfr.is_archived;
}

export function filterActiveProjects<T extends Project>(projects: T[]): T[] {
  return projects.filter(isActiveProject);
}

export function filterActiveManufacturers<T extends Manufacturer>(mfrs: T[]): T[] {
  return mfrs.filter(isActiveManufacturer);
}

export function filterActiveWorkPackages(
  packages: WorkPackage[],
  projects: Project[],
  manufacturers: Manufacturer[]
): WorkPackage[] {
  const activeProjectIds = new Set(projects.filter(isActiveProject).map((p) => p.id));
  const activeMfrIds = new Set(
    manufacturers.filter(isActiveManufacturer).map((m) => m.id)
  );
  return packages.filter(
    (p) => activeProjectIds.has(p.project_id) && activeMfrIds.has(p.manufacturer_id)
  );
}
