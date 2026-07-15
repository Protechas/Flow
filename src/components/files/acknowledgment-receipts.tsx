import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CircleDashed } from "lucide-react";
import type { AcknowledgmentStatus } from "@/lib/files/document-revisions";

/** Who has accepted the current SOP revision — visible wherever managers read
 * the document, not just in the editor. */
export function AcknowledgmentReceipts({ status }: { status: AcknowledgmentStatus }) {
  return (
    <div className="enterprise-panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">Revision {status.revision.revision_number}</p>
        <Badge
          variant="outline"
          className={status.pending.length === 0 ? "text-emerald-500 border-emerald-500/30" : ""}
        >
          {status.acknowledged.length}/{status.acknowledged.length + status.pending.length}{" "}
          accepted
        </Badge>
        <span className="text-xs text-muted-foreground">
          Published {new Date(status.revision.published_at).toLocaleString()} ·{" "}
          {status.revision.change_summary}
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Accepted</p>
          {status.acknowledged.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nobody yet.</p>
          ) : (
            <ul className="space-y-1">
              {status.acknowledged.map((a) => (
                <li key={a.userId} className="flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  {a.name}
                  <span className="text-muted-foreground">
                    · {new Date(a.at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Still pending</p>
          {status.pending.length === 0 ? (
            <p className="text-xs text-emerald-500">Everyone has accepted.</p>
          ) : (
            <ul className="space-y-1">
              {status.pending.map((p) => (
                <li key={p.userId} className="flex items-center gap-1.5 text-xs">
                  <CircleDashed className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  {p.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
