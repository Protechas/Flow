"use client";

import { useState, useTransition } from "react";
import { getLeadAvailabilityAction } from "@/app/actions/clock";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TeamMemberAvailability } from "@/lib/time-clock/get-team-availability";
import { Loader2, UsersRound } from "lucide-react";

function statusDot(status: TeamMemberAvailability["status"]): string {
  switch (status) {
    case "on_shift":
    case "exempt":
      return "bg-emerald-500";
    case "on_lunch":
      return "bg-amber-400";
    default:
      return "bg-muted-foreground/40";
  }
}

/**
 * Compact banner widget: clock status of every team lead at a glance.
 * Costs nothing on page load — availability is fetched when opened.
 */
export function LeadAvailability() {
  const [leads, setLeads] = useState<TeamMemberAvailability[] | null>(null);
  const [loading, startLoad] = useTransition();

  const refresh = () =>
    startLoad(async () => {
      const result = await getLeadAvailabilityAction().catch(() => []);
      setLeads(result);
    });

  const available = leads?.filter((l) => l.status === "on_shift" || l.status === "exempt");

  return (
    <DropdownMenu onOpenChange={(open) => open && refresh()}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="hidden h-8 gap-1.5 text-xs sm:inline-flex"
            title="Lead availability"
          />
        }
      >
        <UsersRound className="h-3.5 w-3.5" />
        Leads
        {leads && (
          <span className="text-[10px] text-muted-foreground">
            {available?.length}/{leads.length}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-2">
        <p className="px-1 pb-2 text-xs font-medium text-muted-foreground">
          Lead availability
        </p>
        {loading && !leads ? (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : !leads || leads.length === 0 ? (
          <p className="px-1 pb-1 text-xs text-muted-foreground">No team leads found.</p>
        ) : (
          <div className="space-y-1">
            {leads.map((lead) => (
              <div
                key={lead.userId}
                className="flex items-start gap-2.5 rounded-md px-1.5 py-1.5"
              >
                <span
                  className={cn(
                    "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                    statusDot(lead.status)
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{lead.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {lead.statusLabel}
                    {lead.since ? ` · since ${lead.since}` : ""}
                  </p>
                  {lead.activeTaskTitle && (
                    <p className="text-[11px] text-muted-foreground/80 truncate">
                      On: {lead.activeTaskTitle}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
