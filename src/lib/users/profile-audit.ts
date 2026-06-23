import { writeAuditLog } from "@/lib/audit/audit-log";
import type { AuditAction } from "@/types/flow";

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

export async function auditUserFieldChanges(params: {
  userId: string;
  userLabel: string;
  actorId: string;
  actorEmail: string;
  changes: Array<{
    field: string;
    previous: unknown;
    next: unknown;
    action?: AuditAction;
  }>;
}): Promise<void> {
  const meaningful = params.changes.filter(
    (c) => formatAuditValue(c.previous) !== formatAuditValue(c.next)
  );
  if (!meaningful.length) return;

  for (const change of meaningful) {
    await writeAuditLog({
      action: change.action ?? "user_profile_updated",
      entityType: "user",
      entityId: params.userId,
      summary: `${params.userLabel}: ${change.field} changed from ${formatAuditValue(change.previous)} to ${formatAuditValue(change.next)}`,
      metadata: {
        user_changed: params.userId,
        changed_by: params.actorId,
        field_changed: change.field,
        previous_value: change.previous ?? null,
        new_value: change.next ?? null,
        timestamp: new Date().toISOString(),
      },
      actorId: params.actorId,
      actorEmail: params.actorEmail,
    });
  }
}
