"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitManagerWeeklyUpdateAction } from "@/app/actions/manager-update";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { wrapUpSectionLabel } from "@/lib/wrap-up/sections";
import type { ManagerWeeklyUpdate } from "@/types/flow";
import { CalendarCheck2, CheckCircle2, Lock } from "lucide-react";

export interface ManagerUpdateField {
  id: string;
  label: string;
  placeholder?: string;
}

/**
 * The weekly manager update ("Friday section") — form for the filing manager,
 * read-only feed for leadership. Rendered on the Daily Report Review page.
 */
export function ManagerUpdatePanel({
  fields,
  existing,
  isFriday,
  weekOf,
  recent,
  authorNames,
  teamNames,
}: {
  /** Fields for the viewer's own form; empty = viewer doesn't file one. */
  fields: ManagerUpdateField[];
  /** The viewer's already-submitted update for the current week, if any. */
  existing: ManagerWeeklyUpdate | null;
  isFriday: boolean;
  weekOf: string;
  /** Submitted updates visible to this viewer (excluding their own current). */
  recent: ManagerWeeklyUpdate[];
  authorNames: Record<string, string>;
  teamNames: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const canFile = fields.length > 0;
  if (!canFile && recent.length === 0) return null;

  return (
    <section className="space-y-4 p-4 border-b border-border/60">
      <div className="flex items-center gap-2">
        <CalendarCheck2 className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Weekly manager update</h2>
        <span className="text-xs text-muted-foreground">week of {weekOf}</span>
      </div>

      {canFile && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const sections: Record<string, string> = {};
            for (const f of fields) {
              const v = fd.get(`mgr_${f.id}`);
              if (typeof v === "string" && v.trim()) sections[f.id] = v;
            }
            startTransition(async () => {
              setError(null);
              const res = await submitManagerWeeklyUpdateAction({ sections });
              if (!res.ok) {
                setError(res.message ?? "Could not save the weekly update.");
                return;
              }
              setSaved(true);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.id} className="space-y-1.5">
                <Label htmlFor={`mgr_${f.id}`} className="text-xs">
                  {f.label}
                </Label>
                <Textarea
                  id={`mgr_${f.id}`}
                  name={`mgr_${f.id}`}
                  rows={2}
                  placeholder={f.placeholder}
                  defaultValue={existing?.sections[f.id] ?? ""}
                />
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {(saved || existing) && !error && (
            <p className="text-xs text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Submitted for this week — you can revise it until the week ends.
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending || !isFriday}>
              {pending ? "Saving…" : existing ? "Update submission" : "Submit weekly update"}
            </Button>
            {!isFriday && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Submissions open Friday — you can draft your answers now.
              </p>
            )}
          </div>
        </form>
      )}

      {recent.length > 0 && (
        <div className="space-y-3">
          <p className="enterprise-label">Submitted updates</p>
          {recent.map((u) => (
            <div key={u.id} className="enterprise-panel p-4 space-y-2">
              <p className="text-sm font-semibold">
                {authorNames[u.user_id] ?? "Manager"} · {teamNames[u.team_id] ?? "Team"}
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  week of {u.week_of}
                </span>
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(u.sections).map(([id, value]) => (
                  <div key={id}>
                    <p className="text-xs text-muted-foreground">{wrapUpSectionLabel(id)}</p>
                    <p className="text-sm whitespace-pre-wrap">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
