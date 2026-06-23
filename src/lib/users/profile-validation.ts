import { wouldCreateCircularChain } from "@/lib/setup/validation";
import type { EmploymentStatus, Team, User } from "@/types/flow";

export class UserProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserProfileValidationError";
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmailFormat(email: string): void {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    throw new UserProfileValidationError("Email is required.");
  }
  if (!EMAIL_RE.test(trimmed)) {
    throw new UserProfileValidationError("Enter a valid email address.");
  }
}

export function validateUniqueEmail(
  email: string,
  userId: string,
  users: User[]
): void {
  const normalized = email.trim().toLowerCase();
  const duplicate = users.find(
    (u) => u.id !== userId && u.email.trim().toLowerCase() === normalized
  );
  if (duplicate) {
    throw new UserProfileValidationError(
      `Another user already uses ${normalized}.`
    );
  }
}

export function validateTeamDepartment(
  teamId: string | null | undefined,
  departmentId: string | null | undefined,
  teams: Team[]
): void {
  if (!teamId || !departmentId) return;
  const team = teams.find((t) => t.id === teamId);
  if (team?.department_id && team.department_id !== departmentId) {
    throw new UserProfileValidationError(
      "Selected team does not belong to the chosen department."
    );
  }
}

export function validateUserProfileInput(input: {
  userId: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  manager_id?: string | null;
  department_id?: string | null;
  team_id?: string | null;
  users: User[];
  teams: Team[];
}): void {
  if (!input.first_name.trim()) {
    throw new UserProfileValidationError("First name is required.");
  }
  if (!input.last_name.trim()) {
    throw new UserProfileValidationError("Last name is required.");
  }
  if (!input.full_name.trim()) {
    throw new UserProfileValidationError("Display name is required.");
  }

  validateEmailFormat(input.email);
  validateUniqueEmail(input.email, input.userId, input.users);
  validateTeamDepartment(input.team_id, input.department_id, input.teams);

  if (input.manager_id && wouldCreateCircularChain(input.userId, input.manager_id, input.users)) {
    throw new UserProfileValidationError(
      "This supervisor would create a circular reporting chain."
    );
  }

  if (input.manager_id) {
    const supervisor = input.users.find((u) => u.id === input.manager_id);
    if (!supervisor?.is_active) {
      throw new UserProfileValidationError("Selected supervisor is not active.");
    }
  }
}

export const EMPLOYMENT_STATUS_OPTIONS: {
  value: EmploymentStatus;
  label: string;
}[] = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On leave" },
  { value: "terminated", label: "Terminated" },
];

export function employmentStatusLabel(status: EmploymentStatus | null | undefined): string {
  return EMPLOYMENT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "Active";
}
