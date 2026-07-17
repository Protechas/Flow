"use client";

import { useState, useTransition } from "react";
import { clockInAction, clockOutAction } from "@/app/actions/clock";
import { Button } from "@/components/ui/button";
import { useFlowToast } from "@/components/ui/flow-toast";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

/**
 * One-click in/out signal for team leads. Writes a normal time-clock entry,
 * which is what the header "Leads" availability widget reads — so pressing
 * this is how a lead shows the team whether they're in.
 */
export function LeadClockToggle({ initialClockedIn }: { initialClockedIn: boolean }) {
  const [clockedIn, setClockedIn] = useState(initialClockedIn);
  const [pending, startTransition] = useTransition();
  const { toast } = useFlowToast();

  const toggle = () =>
    startTransition(async () => {
      try {
        if (clockedIn) {
          const res = await clockOutAction("out");
          if (res && !res.ok) {
            toast({ variant: "error", title: "Could not clock out", description: res.message });
            return;
          }
          setClockedIn(false);
        } else {
          await clockInAction();
          setClockedIn(true);
        }
      } catch (e) {
        toast({
          variant: "error",
          title: clockedIn ? "Could not clock out" : "Could not clock in",
          description: e instanceof Error ? e.message : "Try again",
        });
      }
    });

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={toggle}
      className="h-8 gap-1.5 text-xs"
      title={
        clockedIn
          ? "You're showing as in — click to go out"
          : "You're showing as out — click to go in"
      }
    >
      {pending ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
      ) : (
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            clockedIn ? "bg-emerald-500" : "bg-muted-foreground/40"
          )}
        />
      )}
      {clockedIn ? "I'm in" : "I'm out"}
    </Button>
  );
}
