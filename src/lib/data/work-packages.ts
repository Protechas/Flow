import { filterActiveWorkPackages } from "@/lib/data/entity-filters";
import { buildOperationsTree } from "@/lib/hierarchy/build-tree";
import {
  enrichPackages,
  getFlowStore,
  initFlowStore,
  createWorkPackage,
  updateWorkPackage,
  deleteWorkPackage,
} from "@/lib/data/flow-store";
import type { OperationsTree, WorkPackage, WorkPackageInput } from "@/types/flow";

export type WorkPackageFilters = {
  status?: string;
  assignedTo?: string;
  projectId?: string;
};

/** Single read path for tasks — managers and employees use the same store. */
export function listWorkPackages(filters?: WorkPackageFilters): WorkPackage[] {
  initFlowStore();
  const store = getFlowStore();
  let items = filterActiveWorkPackages(
    store.workPackages,
    store.projects,
    store.manufacturers
  );
  if (filters?.status) items = items.filter((i) => i.status === filters.status);
  if (filters?.assignedTo) items = items.filter((i) => i.assigned_to === filters.assignedTo);
  if (filters?.projectId) items = items.filter((i) => i.project_id === filters.projectId);
  return enrichPackages(items);
}

export async function getWorkPackages(filters?: WorkPackageFilters): Promise<WorkPackage[]> {
  return listWorkPackages(filters);
}

export async function getOperationsTree(filters?: {
  assignedTo?: string;
}): Promise<OperationsTree> {
  initFlowStore();
  const store = getFlowStore();
  let packages = filterActiveWorkPackages(
    store.workPackages,
    store.projects,
    store.manufacturers
  );
  if (filters?.assignedTo) {
    packages = packages.filter((p) => p.assigned_to === filters.assignedTo);
  }
  const activeProjects = store.projects.filter((p) => p.status !== "archived");
  const activeMfrs = store.manufacturers.filter((m) => !m.is_archived);
  return buildOperationsTree(
    activeProjects,
    activeMfrs,
    store.yearWorkItems,
    enrichPackages(packages),
    store.qaReviews,
    store.activity
  );
}

export async function getWorkPackageById(id: string) {
  return listWorkPackages().find((i) => i.id === id) ?? null;
}

export {
  createWorkPackage,
  updateWorkPackage,
  deleteWorkPackage,
};

export const getWorkItems = getWorkPackages;
export const createWorkItem = createWorkPackage;
export const updateWorkItem = updateWorkPackage;
export const deleteWorkItem = deleteWorkPackage;
