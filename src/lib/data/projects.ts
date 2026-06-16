import {
  getFlowStore,
  initFlowStore,
  createProject,
  updateProject,
  deleteProject,
  createManufacturer,
  updateManufacturer,
  deleteManufacturer,
  createYearWorkItem,
  bulkCreateYears,
  updateYearWorkItem,
  deleteYearWorkItem,
} from "@/lib/data/flow-store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import { normalizeRole } from "@/lib/auth/permissions";
import type { Manufacturer, Project, YearWorkItem } from "@/types/flow";
import { isActiveProject } from "@/lib/data/entity-filters";
import { getWorkPackages } from "./work-packages";
import { projectRollup } from "@/lib/hierarchy/rollups";

export async function getProjects(): Promise<Project[]> {
  if (!isSupabaseConfigured()) {
    initFlowStore();
    return getFlowStore().projects;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function getProjectById(id: string) {
  const projects = await getProjects();
  return projects.find((p) => p.id === id) ?? null;
}

export async function getManufacturers(
  projectId?: string,
  includeArchived = true
): Promise<Manufacturer[]> {
  if (!isSupabaseConfigured()) {
    initFlowStore();
    let mfrs = getFlowStore().manufacturers;
    if (!includeArchived) mfrs = mfrs.filter((m) => !m.is_archived);
    return projectId ? mfrs.filter((m) => m.project_id === projectId) : mfrs;
  }
  const supabase = await createClient();
  let query = supabase.from("manufacturers").select("*").order("name");
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Manufacturer[];
}

export async function getYearWorkItems(manufacturerId?: string): Promise<YearWorkItem[]> {
  initFlowStore();
  const items = getFlowStore().yearWorkItems;
  return manufacturerId ? items.filter((y) => y.manufacturer_id === manufacturerId) : items;
}

export async function getUsers() {
  if (!isSupabaseConfigured()) return getFlowStore().users;
  const supabase = await createClient();
  const { data, error } = await supabase.from("users").select("*").order("full_name");
  if (error) throw error;
  return data ?? [];
}

export async function getAnalysts() {
  const users = await getUsers();
  return users.filter((u) => normalizeRole(u.role) === "employee");
}

export async function getManagers() {
  const users = await getUsers();
  return users.filter((u) => ["admin", "manager", "teamlead"].includes(u.role) && u.is_active);
}

export async function getProjectsWithStats(includeArchived = true) {
  initFlowStore();
  const store = getFlowStore();
  const packages = await getWorkPackages();
  const list = includeArchived
    ? store.projects
    : store.projects.filter(isActiveProject);

  return list.map((p) => {
    const projectItems = packages.filter((i) => i.project_id === p.id);
    const rollup = projectRollup(p, projectItems, store.manufacturers, store.qaReviews, store.yearWorkItems.filter((y) => y.project_id === p.id));
    return {
      ...p,
      manufacturerCount: rollup.manufacturerCount,
      yearCount: rollup.yearCount,
      workItemCount: rollup.totalPackages,
      completedCount: rollup.completedPackages,
      activeCount: rollup.totalPackages - rollup.completedPackages,
      completedPct: rollup.completedPct,
    };
  });
}

export {
  createProject,
  updateProject,
  deleteProject,
  archiveProject,
  unarchiveProject,
  createManufacturer,
  updateManufacturer,
  deleteManufacturer,
  archiveManufacturer,
  unarchiveManufacturer,
  createYearWorkItem,
  bulkCreateYears,
  updateYearWorkItem,
  deleteYearWorkItem,
} from "@/lib/data/flow-store";
