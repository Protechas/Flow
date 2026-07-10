"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  acknowledgeRevisionAction,
  getPendingAcknowledgmentsAction,
} from "@/app/actions/company-documents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFlowToast } from "@/components/ui/flow-toast";
import { cn } from "@/lib/utils";
import type { DocumentRevision, RevisionBlockChange } from "@/types/flow";
import { BookOpenCheck, CheckCircle2, Loader2 } from "lucide-react";

/** Re-check at most this often when the tab regains focus. */
const RECHECK_MS = 60_000;

function ChangedBlock({ change }: { change: RevisionBlockChange }) {
  if (change.type === "removed") {
    return (
      <div className="rounded-md border-l-2 border-destructive/60 bg-destructive/5 px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-destructive mb-1">
          Removed
        </p>
        <div
          className="flow-doc-editor text-sm opacity-70 line-through"
          dangerouslySetInnerHTML={{ __html: change.prev_html }}
        />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "rounded-md border-l-2 px-3 py-2",
        change.type === "added"
          ? "border-emerald-500/60 bg-emerald-500/5"
          : "border-amber-400/60 bg-amber-400/5"
      )}
    >
      <p
        className={cn(
          "text-[10px] font-medium uppercase tracking-wide mb-1",
          change.type === "added" ? "text-emerald-500" : "text-amber-500"
        )}
      >
        {change.type === "added" ? "New" : "Changed"}
      </p>
      <div className="flow-doc-editor text-sm" dangerouslySetInnerHTML={{ __html: change.html }} />
    </div>
  );
}

/**
 * The SOP gate: while this user has unaccepted published revisions, Flow is
 * blocked behind a full-screen review of each one. No dismiss, no escape key —
 * reading and accepting is the only way through. Acceptance is recorded.
 */
export function SopAcknowledgmentGate() {
  const { toast } = useFlowToast();
  const [pending, setPending] = useState<DocumentRevision[]>([]);
  const [accepting, startAccept] = useTransition();
  const lastCheck = useRef(0);

  const check = useCallback(async () => {
    lastCheck.current = Date.now();
    const revisions = await getPendingAcknowledgmentsAction().catch(() => []);
    setPending(revisions.sort((a, b) => a.published_at.localeCompare(b.published_at)));
  }, []);

  useEffect(() => {
    void check();
    const onFocus = () => {
      if (Date.now() - lastCheck.current > RECHECK_MS) void check();
    };
    window.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  const current = pending[0];
  if (!current) return null;

  const accept = () =>
    startAccept(async () => {
      const res = await acknowledgeRevisionAction(current.id);
      if (!res.ok) {
        toast({ variant: "error", title: "Could not record acceptance", description: res.message });
        return;
      }
      setPending((prev) => prev.filter((r) => r.id !== current.id));
    });

  const isBaseline = current.changed_blocks.length === 0 && current.revision_number === 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-sm p-4">
      <div className="enterprise-panel w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-primary shrink-0" />
            <h2 className="text-base font-semibold">
              {isBaseline ? "New SOP published" : "SOP updated"} — action required
            </h2>
            {pending.length > 1 && (
              <Badge variant="outline" className="ml-auto text-xs">
                1 of {pending.length}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Read the change below. Flow unlocks when you accept.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <p className="text-sm font-semibold">{current.title}</p>
            <p className="text-xs text-muted-foreground">
              Revision {current.revision_number} ·{" "}
              {new Date(current.published_at).toLocaleString()}
            </p>
          </div>

          <div className="rounded-md bg-secondary/50 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
              What changed
            </p>
            <p className="text-sm whitespace-pre-wrap">{current.change_summary}</p>
          </div>

          {current.changed_blocks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Changed sections</p>
              {current.changed_blocks.map((change, i) => (
                <ChangedBlock key={i} change={change} />
              ))}
            </div>
          )}

          <details open={isBaseline}>
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              {isBaseline ? "Full document" : "Read the full document"}
            </summary>
            <div
              className="flow-doc-editor mt-2 rounded-md border border-border/60 px-4 py-3"
              dangerouslySetInnerHTML={{ __html: current.content_html }}
            />
          </details>
        </div>

        <div className="border-t border-border px-5 py-3.5 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Your acceptance is recorded with a timestamp.
          </p>
          <Button type="button" onClick={accept} disabled={accepting}>
            {accepting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
            )}
            I have read and accept
          </Button>
        </div>
      </div>
    </div>
  );
}
