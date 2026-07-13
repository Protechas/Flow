"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setRequestRoutingAction } from "@/app/actions/request-tickets";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useFlowToast } from "@/components/ui/flow-toast";
import { Loader2, Route } from "lucide-react";

/**
 * Owner control over who receives tickets. Checked teams get the queue and
 * the notifications; nothing checked falls back to the derived rule
 * (departments that own active projects).
 */
export function RequestRoutingPanel({
  teams,
  selectedTeamIds,
}: {
  teams: { id: string; name: string }[];
  selectedTeamIds: string[];
}) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedTeamIds));
  const [pending, startTransition] = useTransition();

  const dirty =
    selected.size !== selectedTeamIds.length ||
    selectedTeamIds.some((id) => !selected.has(id));

  const save = () =>
    startTransition(async () => {
      const res = await setRequestRoutingAction([...selected]);
      if (!res.ok) {
        toast({ variant: "error", title: "Could not save routing", description: res.message });
        return;
      }
      toast({
        variant: "success",
        title: "Routing saved",
        description:
          res.teamIds.length > 0
            ? "Only the checked teams receive new requests now."
            : "Back to the default: departments with production work receive.",
      });
      router.refresh();
    });

  return (
    <details className="enterprise-panel">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium select-none inline-flex items-center gap-2 w-full">
        <Route className="h-4 w-4 text-muted-foreground" />
        Routing — who receives requests
        <span className="text-xs text-muted-foreground font-normal">
          {selectedTeamIds.length > 0
            ? `${selectedTeamIds.length} team${selectedTeamIds.length === 1 ? "" : "s"} selected`
            : "default (production departments)"}
        </span>
      </summary>
      <div className="border-t border-border/50 px-4 py-3 space-y-3">
        <p className="text-xs text-muted-foreground">
          Check the team(s) whose members see the queue and get notified. Leave everything
          unchecked to fall back to the default rule.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {teams.map((team) => (
            <label key={team.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.has(team.id)}
                onCheckedChange={(checked) => {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (checked) next.add(team.id);
                    else next.delete(team.id);
                    return next;
                  });
                }}
              />
              {team.name}
            </label>
          ))}
        </div>
        <Button size="sm" onClick={save} disabled={pending || !dirty}>
          {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Save routing
        </Button>
      </div>
    </details>
  );
}
