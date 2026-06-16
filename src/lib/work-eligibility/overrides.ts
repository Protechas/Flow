export interface WorkEligibilityOverride {
  id: string;
  employee_id: string;
  granted_by: string;
  reason: string;
  created_at: string;
  expires_at: string;
}

let overrides: WorkEligibilityOverride[] = [];

function uid() {
  return `weo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function grantWorkEligibilityOverride(input: {
  employeeId: string;
  grantedBy: string;
  reason: string;
  durationMinutes?: number;
}): WorkEligibilityOverride {
  const now = Date.now();
  const durationMs = (input.durationMinutes ?? 60) * 60 * 1000;
  const record: WorkEligibilityOverride = {
    id: uid(),
    employee_id: input.employeeId,
    granted_by: input.grantedBy,
    reason: input.reason.trim(),
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + durationMs).toISOString(),
  };
  overrides = [record, ...overrides.filter((o) => o.employee_id !== input.employeeId)];
  return record;
}

export function hasActiveWorkEligibilityOverride(userId: string): boolean {
  const now = Date.now();
  return overrides.some(
    (o) => o.employee_id === userId && new Date(o.expires_at).getTime() > now
  );
}

export function getActiveWorkEligibilityOverride(userId: string): WorkEligibilityOverride | null {
  const now = Date.now();
  return (
    overrides.find(
      (o) => o.employee_id === userId && new Date(o.expires_at).getTime() > now
    ) ?? null
  );
}

export function listWorkEligibilityOverrides(employeeId?: string) {
  return employeeId ? overrides.filter((o) => o.employee_id === employeeId) : [...overrides];
}
