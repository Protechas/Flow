import type { TeamOperatingModelRecord } from "@/lib/operating-models/types";

/**
 * The definition JSONB persisted for an operating model. Carries the WHOLE
 * model — including fields the Settings form doesn't know about (uploadGate,
 * contentChecksEnabled, wrapUpFields, workspace, and anything added later) —
 * so a save never silently reverts config it didn't render. Record metadata
 * and the team/department bindings are stripped: those live in real columns,
 * and a stale copy inside definition would resurrect a removed binding.
 */
export function modelToDefinition(model: TeamOperatingModelRecord): Record<string, unknown> {
  const definition: Record<string, unknown> = { ...model };
  for (const key of [
    "id",
    "is_active",
    "sort_order",
    "updated_at",
    "updated_by",
    "departmentId",
    "teamId",
  ]) {
    delete definition[key];
  }
  return definition;
}
