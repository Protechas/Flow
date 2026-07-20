import { PROJECT_TYPE_MODEL_SLUG } from "@/lib/operating-models/presets";
import {
  getGeneralOperatingModel,
  getOperatingModel,
  listOperatingModels,
} from "@/lib/operating-models/store";
import type { OperatingContext, TeamOperatingModel } from "@/lib/operating-models/types";
import type { Project, Team } from "@/types/flow";

export function resolveOperatingModelBySlug(slug: string): TeamOperatingModel {
  return getOperatingModel(slug) ?? getGeneralOperatingModel();
}

export function resolveOperatingModelForTeam(
  teamId?: string | null,
  departmentId?: string | null
): TeamOperatingModel {
  const models = listOperatingModels();

  if (teamId) {
    const byTeam = models.find((m) => m.teamId === teamId);
    if (byTeam) return byTeam;
  }

  if (departmentId) {
    const byDept = models.find((m) => m.departmentId === departmentId && !m.teamId);
    if (byDept) return byDept;
  }

  return getGeneralOperatingModel();
}

export function resolveOperatingModelForProject(
  project: {
    project_type?: string | null;
    team_id?: string | null;
    department_id?: string | null;
  },
  teams: Team[] = []
): TeamOperatingModel {
  if (project.team_id) {
    const model = resolveOperatingModelForTeam(project.team_id, project.department_id);
    if (model.slug !== getGeneralOperatingModel().slug) return model;
  }

  if (project.department_id) {
    const model = resolveOperatingModelForTeam(undefined, project.department_id);
    if (model.slug !== getGeneralOperatingModel().slug) return model;
  }

  const typeSlug = project.project_type
    ? PROJECT_TYPE_MODEL_SLUG[project.project_type]
    : undefined;
  if (typeSlug) {
    return resolveOperatingModelBySlug(typeSlug);
  }

  return getGeneralOperatingModel();
}

/**
 * Whether SI-standard automatic content checks apply to this project's team.
 * Default ON (matches today's behavior); a team's operating model opts out.
 */
export function contentChecksEnabledForProject(
  project: {
    project_type?: string | null;
    team_id?: string | null;
    department_id?: string | null;
  },
  teams: Team[] = []
): boolean {
  return resolveOperatingModelForProject(project, teams).contentChecksEnabled !== false;
}

export function buildOperatingContext(
  opts: {
    teamId?: string | null;
    departmentId?: string | null;
    project?: Pick<Project, "project_type" | "team_id" | "department_id"> | null;
    teams?: Team[];
  }
): OperatingContext {
  const model = opts.project
    ? resolveOperatingModelForProject(opts.project, opts.teams ?? [])
    : resolveOperatingModelForTeam(opts.teamId, opts.departmentId);

  const teamId =
    opts.teamId ??
    opts.project?.team_id ??
    model.teamId ??
    undefined;
  const departmentId =
    opts.departmentId ??
    opts.project?.department_id ??
    model.departmentId ??
    (teamId ? teamsDepartmentId(teamId, opts.teams ?? []) : undefined);

  return { model, teamId, departmentId };
}

function teamsDepartmentId(teamId: string, teams: Team[]): string | undefined {
  return teams.find((t) => t.id === teamId)?.department_id ?? undefined;
}
