import type {
  ProjectMetricDefinition,
  ProjectMetricDefinitionInput,
  ProjectMetricValue,
} from "@/types/flow";
import { newPersistedId } from "@/lib/server/persisted-id";

const DEFINITIONS_KEY = "__flow_project_metric_definitions__";
const VALUES_KEY = "__flow_project_metric_values__";

function globalScope(): Record<string, unknown> {
  return globalThis as typeof globalThis & Record<string, unknown>;
}

function uid(prefix: string) {
  return newPersistedId(prefix);
}

function readDefinitions(): ProjectMetricDefinition[] {
  const value = globalScope()[DEFINITIONS_KEY];
  return Array.isArray(value) ? (value as ProjectMetricDefinition[]) : [];
}

function writeDefinitions(definitions: ProjectMetricDefinition[]) {
  globalScope()[DEFINITIONS_KEY] = definitions;
}

function readValues(): ProjectMetricValue[] {
  const value = globalScope()[VALUES_KEY];
  return Array.isArray(value) ? (value as ProjectMetricValue[]) : [];
}

function writeValues(values: ProjectMetricValue[]) {
  globalScope()[VALUES_KEY] = values;
}

export function replaceProjectMetricStore(
  definitions: ProjectMetricDefinition[],
  values: ProjectMetricValue[] = []
) {
  writeDefinitions(definitions);
  writeValues(values);
}

export function listProjectMetricDefinitions(projectId?: string): ProjectMetricDefinition[] {
  const list = readDefinitions();
  if (!projectId) return [...list];
  return list
    .filter((d) => d.project_id === projectId && !d.is_archived)
    .sort((a, b) => a.sort_order - b.sort_order || a.metric_name.localeCompare(b.metric_name));
}

export function getProjectMetricDefinition(id: string): ProjectMetricDefinition | null {
  return readDefinitions().find((d) => d.id === id) ?? null;
}

export function createProjectMetricDefinition(
  projectId: string,
  input: ProjectMetricDefinitionInput
): ProjectMetricDefinition {
  const definitions = readDefinitions();
  const maxOrder = definitions
    .filter((d) => d.project_id === projectId)
    .reduce((m, d) => Math.max(m, d.sort_order), -1);

  const record: ProjectMetricDefinition = {
    id: uid("pmd"),
    project_id: projectId,
    metric_name: input.metric_name.trim(),
    metric_description: input.metric_description?.trim() || null,
    metric_type: input.metric_type,
    target_value: input.target_value ?? null,
    current_value: input.current_value ?? null,
    display_style: input.display_style ?? "metric_card",
    sort_order: input.sort_order ?? maxOrder + 1,
    is_required: input.is_required ?? false,
    is_formula: input.is_formula ?? false,
    formula_definition: input.formula_definition ?? null,
    is_archived: false,
    created_at: new Date().toISOString(),
  };

  definitions.push(record);
  writeDefinitions(definitions);
  return record;
}

export function updateProjectMetricDefinitionRecord(
  id: string,
  input: Partial<ProjectMetricDefinitionInput> & { is_archived?: boolean; sort_order?: number }
): ProjectMetricDefinition | null {
  const definitions = readDefinitions();
  const idx = definitions.findIndex((d) => d.id === id);
  if (idx < 0) return null;

  const current = definitions[idx];
  const updated: ProjectMetricDefinition = {
    ...current,
    metric_name: input.metric_name?.trim() ?? current.metric_name,
    metric_description:
      input.metric_description !== undefined
        ? input.metric_description?.trim() || null
        : current.metric_description,
    metric_type: input.metric_type ?? current.metric_type,
    target_value: input.target_value !== undefined ? input.target_value : current.target_value,
    current_value: input.current_value !== undefined ? input.current_value : current.current_value,
    display_style: input.display_style ?? current.display_style,
    sort_order: input.sort_order ?? current.sort_order,
    is_required: input.is_required ?? current.is_required,
    is_formula: input.is_formula ?? current.is_formula,
    formula_definition:
      input.formula_definition !== undefined ? input.formula_definition : current.formula_definition,
    is_archived: input.is_archived ?? current.is_archived,
  };

  definitions[idx] = updated;
  writeDefinitions(definitions);
  return updated;
}

export function archiveProjectMetricDefinition(id: string): ProjectMetricDefinition | null {
  return updateProjectMetricDefinitionRecord(id, { is_archived: true });
}

export function reorderProjectMetricDefinitions(
  projectId: string,
  orderedIds: string[]
): ProjectMetricDefinition[] {
  const definitions = readDefinitions();
  orderedIds.forEach((id, index) => {
    const idx = definitions.findIndex((d) => d.id === id && d.project_id === projectId);
    if (idx >= 0) definitions[idx] = { ...definitions[idx], sort_order: index };
  });
  writeDefinitions(definitions);
  return listProjectMetricDefinitions(projectId);
}

export function recordProjectMetricValue(
  definitionId: string,
  value: string,
  updatedBy: string | null
): ProjectMetricValue {
  const definitions = readDefinitions();
  const defIdx = definitions.findIndex((d) => d.id === definitionId);
  if (defIdx < 0) throw new Error("Metric definition not found");

  const previous = definitions[defIdx].current_value ?? null;
  definitions[defIdx] = { ...definitions[defIdx], current_value: value };
  writeDefinitions(definitions);

  const values = readValues();
  const entry: ProjectMetricValue = {
    id: uid("pmv"),
    metric_definition_id: definitionId,
    current_value: value,
    previous_value: previous,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  };
  values.unshift(entry);
  if (values.length > 5000) values.length = 5000;
  writeValues(values);
  return entry;
}

export function listProjectMetricValues(definitionId: string, limit = 50): ProjectMetricValue[] {
  return readValues()
    .filter((v) => v.metric_definition_id === definitionId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, limit);
}

export function listAllProjectMetricDefinitions(): ProjectMetricDefinition[] {
  return readDefinitions().filter((d) => !d.is_archived);
}

export function seedProjectMetricDefinitions(
  projectId: string,
  inputs: ProjectMetricDefinitionInput[]
): ProjectMetricDefinition[] {
  return inputs.map((input, index) =>
    createProjectMetricDefinition(projectId, { ...input, sort_order: input.sort_order ?? index })
  );
}
