import { getRoleFieldConfig } from "@/lib/setup/role-fields";
import type { User, UserRole } from "@/types/flow";

export class SetupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SetupValidationError";
  }
}

export function wouldCreateCircularChain(
  userId: string | null,
  supervisorId: string | null,
  users: User[]
): boolean {
  if (!supervisorId) return false;
  if (userId && supervisorId === userId) return true;

  const visited = new Set<string>();
  let current: string | null = supervisorId;

  while (current) {
    if (userId && current === userId) return true;
    if (visited.has(current)) return true;
    visited.add(current);
    const u = users.find((x) => x.id === current);
    current = u?.manager_id ?? null;
  }

  return false;
}

export function validateUserSetupInput(input: {
  role: UserRole;
  department_id?: string | null;
  team_id?: string | null;
  manager_id?: string | null;
  user_id?: string | null;
  users: User[];
}): void {
  const config = getRoleFieldConfig(input.role);

  if (config.requiresDepartment && !input.department_id) {
    throw new SetupValidationError(
      `${input.role} requires a department. Select which department this person belongs to.`
    );
  }

  if (config.requiresTeam && !input.team_id) {
    throw new SetupValidationError(
      "Employees must be assigned to a team before they can receive work."
    );
  }

  if (config.requiresReportsTo && !input.manager_id) {
    throw new SetupValidationError(
      "A direct supervisor is required. Choose who this person reports to."
    );
  }

  if (input.manager_id && wouldCreateCircularChain(input.user_id ?? null, input.manager_id, input.users)) {
    throw new SetupValidationError(
      "This reporting assignment would create a circular chain. Choose a different supervisor."
    );
  }

  if (input.manager_id) {
    const supervisor = input.users.find((u) => u.id === input.manager_id);
    if (!supervisor?.is_active) {
      throw new SetupValidationError("Selected supervisor is not active.");
    }
  }
}

export function validateDepartmentSetupInput(input: {
  name: string;
  senior_manager_id?: string | null;
  manager_ids: string[];
  team_definitions: { name: string; team_lead_id: string; manager_id?: string }[];
}): void {
  if (!input.name.trim()) {
    throw new SetupValidationError("Department name is required.");
  }

  if (!input.senior_manager_id) {
    throw new SetupValidationError(
      "Select a senior manager to lead this department branch."
    );
  }

  if (input.manager_ids.length === 0) {
    throw new SetupValidationError("Add at least one manager for this department.");
  }

  if (input.team_definitions.length === 0) {
    throw new SetupValidationError("Add at least one team with a team lead.");
  }

  for (const team of input.team_definitions) {
    if (!team.name.trim()) {
      throw new SetupValidationError("Every team needs a name.");
    }
    if (!team.team_lead_id) {
      throw new SetupValidationError(`Team "${team.name}" needs a team lead.`);
    }
  }
}
