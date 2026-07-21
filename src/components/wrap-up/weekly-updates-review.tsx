"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addWeeklyUpdateCommentAction,
  reassignWeeklyUpdateAction,
} from "@/app/actions/weekly-update";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { wrapUpSectionLabel } from "@/lib/wrap-up/sections";
import type { EmployeeWeeklyUpdate, WeeklyUpdateComment } from "@/types/flow";
import { CalendarRange, CornerUpLeft, MessageSquare } from "lucide-react";

const REACTIONS = ["👍", "✅", "❓", "⚠️", "🎉"];

/** Team weekly updates feed for managers/leadership on Daily Report Review. */
export function WeeklyUpdatesReview({
  updates,
  comments,
  authorNames,
  teamNames,
  canModerate,
  currentUserId,
}: {
  updates: EmployeeWeeklyUpdate[];
  comments: WeeklyUpdateComment[];
  authorNames: Record<string, string>;
  teamNames: Record<string, string>;
  canModerate: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (updates.length === 0) return null;

  const commentsFor = (id: string) => comments.filter((c) => c.update_id === id);

  return (
    <section className="space-y-3 p-4 border-b border-border/60">
      <div className="flex items-center gap-2">
        <CalendarRange className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Team weekly updates</h2>
      </div>
      {updates.map((u) => {
        const thread = commentsFor(u.id);
        const reactions = thread.filter((c) => c.kind === "reaction");
        const notes = thread.filter((c) => c.kind === "comment");
        return (
          <div key={u.id} className="enterprise-panel p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {authorNames[u.user_id] ?? "Employee"} · {teamNames[u.team_id] ?? "Team"}
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  week of {u.week_of}
                  {u.revisions.length > 0 && ` · rev ${u.revisions.length + 1}`}
                </span>
              </p>
              {u.status === "reassigned" && (
                <span className="text-[11px] rounded-sm border border-amber-500/40 text-amber-400 px-2 py-0.5">
                  Reopened for revision
                </span>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(u.sections).map(([id, value]) => (
                <div key={id}>
                  <p className="text-xs text-muted-foreground">{wrapUpSectionLabel(id)}</p>
                  <p className="text-sm whitespace-pre-wrap">{value}</p>
                </div>
              ))}
            </div>

            {(reactions.length > 0 || notes.length > 0) && (
              <div className="space-y-1.5 border-t border-border/40 pt-2">
                {reactions.length > 0 && (
                  <p className="text-sm">
                    {reactions.map((r) => r.emoji).join(" ")}
                  </p>
                )}
                {notes.map((c) => (
                  <p key={c.id} className="text-xs">
                    <span className="font-semibold">{authorNames[c.user_id] ?? "Someone"}:</span>{" "}
                    {c.body}
                  </p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  disabled={pending}
                  className="text-sm rounded-md border border-border/50 px-1.5 py-0.5 hover:bg-muted/40"
                  onClick={() =>
                    startTransition(async () => {
                      setError(null);
                      const res = await addWeeklyUpdateCommentAction({ updateId: u.id, emoji });
                      if (!res.ok) setError(res.message ?? "Could not react.");
                      else router.refresh();
                    })
                  }
                >
                  {emoji}
                </button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setCommentFor(commentFor === u.id ? null : u.id)}
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                Comment
              </Button>
              {canModerate && u.user_id !== currentUserId && u.status !== "reassigned" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    const note = window.prompt("Note for the revision (optional):") ?? "";
                    startTransition(async () => {
                      setError(null);
                      const res = await reassignWeeklyUpdateAction({ updateId: u.id, note });
                      if (!res.ok) setError(res.message ?? "Could not reopen.");
                      else router.refresh();
                    });
                  }}
                >
                  <CornerUpLeft className="h-3.5 w-3.5 mr-1" />
                  Reopen for revision
                </Button>
              )}
            </div>

            {commentFor === u.id && (
              <form
                className="flex items-start gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const body = String(fd.get("body") ?? "");
                  startTransition(async () => {
                    setError(null);
                    const res = await addWeeklyUpdateCommentAction({ updateId: u.id, body });
                    if (!res.ok) setError(res.message ?? "Could not comment.");
                    else {
                      setCommentFor(null);
                      router.refresh();
                    }
                  });
                }}
              >
                <Textarea name="body" rows={2} placeholder="Add a comment…" className="flex-1" />
                <Button type="submit" size="sm" disabled={pending}>
                  Post
                </Button>
              </form>
            )}
          </div>
        );
      })}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
