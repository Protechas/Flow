"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setCoachPersonaAction } from "@/app/actions/coach";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useFlowToast } from "@/components/ui/flow-toast";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { COACH_PERSONAS, type CoachNudge, type CoachPersona } from "@/lib/coach/coach-types";
import { cn } from "@/lib/utils";
import { ArrowRight, Megaphone, X } from "lucide-react";

export function CoachPanel({
  nudges,
  persona: initialPersona,
}: {
  nudges: CoachNudge[];
  persona: CoachPersona;
}) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [, startTransition] = useTransition();
  const [persona, setPersona] = useState<CoachPersona>(initialPersona);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const visible = nudges.filter((n) => !dismissed.includes(n.type));

  function changePersona(value: CoachPersona) {
    setPersona(value);
    startTransition(async () => {
      const res = await setCoachPersonaAction(value);
      if (!res.ok) {
        toast({ variant: "error", title: "Could not save", description: res.message });
        return;
      }
      const label = COACH_PERSONAS.find((p) => p.value === value)?.label ?? value;
      toast({ variant: "success", title: `Coach set to ${label}` });
      router.refresh();
    });
  }

  return (
    <section className="enterprise-panel p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Megaphone className="h-3.5 w-3.5 text-primary" />
          Coach
          <InfoTooltip helpKey="coachPanel" />
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Attitude
          </span>
          <Select value={persona} onValueChange={(v) => v && changePersona(v as CoachPersona)}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <span>{COACH_PERSONAS.find((p) => p.value === persona)?.label ?? persona}</span>
            </SelectTrigger>
            <SelectContent>
              {COACH_PERSONAS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  <span className="flex flex-col">
                    <span>{p.label}</span>
                    <span className="text-[10px] text-muted-foreground">{p.description}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">All caught up. The coach approves.</p>
      ) : (
        <ul className="space-y-1.5">
          {visible.map((nudge) => (
            <li
              key={nudge.type}
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-md border px-3 py-2",
                "border-primary/20 bg-primary/5"
              )}
            >
              <p className="min-w-48 flex-1 text-sm">{nudge.message}</p>
              {nudge.href && nudge.actionLabel && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  render={<Link href={nudge.href} prefetch={false} />}
                >
                  {nudge.actionLabel}
                  <ArrowRight className="h-3 w-3" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                aria-label="Dismiss nudge"
                className="h-6 w-6"
                onClick={() => setDismissed((d) => [...d, nudge.type])}
              >
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
