import type { AuditLogEntry } from "@/types/flow";

export function AuditLogView({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground rounded-xl border border-border/60 p-4">
        No audit events yet.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 text-xs text-muted-foreground">
            <th className="text-left py-3 px-4 font-medium">When</th>
            <th className="text-left py-3 px-4 font-medium">Who</th>
            <th className="text-left py-3 px-4 font-medium">Action</th>
            <th className="text-left py-3 px-4 font-medium">Summary</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-border/40">
              <td className="py-2 px-4 text-xs text-muted-foreground whitespace-nowrap">
                {new Date(e.created_at).toLocaleString()}
              </td>
              <td className="py-2 px-4 text-xs">{e.actor_email ?? "System"}</td>
              <td className="py-2 px-4">
                <span className="text-xs capitalize text-primary">
                  {e.action.replace(/_/g, " ")}
                </span>
              </td>
              <td className="py-2 px-4 text-xs">{e.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
