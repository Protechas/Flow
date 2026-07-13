"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelRequestTicketAction } from "@/app/actions/request-tickets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFlowToast } from "@/components/ui/flow-toast";
import { cn } from "@/lib/utils";
import type { RequestTicketStatus, RequestTicketView } from "@/types/flow";
import { X } from "lucide-react";

const STATUS_META: Record<RequestTicketStatus, { label: string; className: string }> = {
  open: { label: "Waiting", className: "border-amber-500/30 text-amber-500" },
  claimed: { label: "In progress", className: "border-sky-500/30 text-sky-500" },
  done: { label: "Done", className: "border-emerald-500/30 text-emerald-500" },
  canceled: { label: "Canceled", className: "border-border text-muted-foreground" },
};

/** The requester's side: everything you've asked for and where it stands. */
export function MyRequestsList({ tickets }: { tickets: RequestTicketView[] }) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();

  if (tickets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You haven&apos;t submitted any requests yet.
      </p>
    );
  }

  const cancel = (id: string) =>
    startTransition(async () => {
      const res = await cancelRequestTicketAction(id);
      if (!res.ok) toast({ variant: "error", title: res.message ?? "Could not cancel" });
      router.refresh();
    });

  return (
    <div className="space-y-1.5">
      {tickets.map((t) => {
        const meta = STATUS_META[t.status];
        return (
          <div
            key={t.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/50 bg-muted/10 px-3 py-2"
          >
            <Badge variant="outline" className={cn("shrink-0", meta.className)}>
              {meta.label}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{t.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {t.status === "claimed" && t.claimed_by_name
                  ? `${t.claimed_by_name} is on it`
                  : t.status === "done" && t.claimed_by_name
                    ? `Done by ${t.claimed_by_name}`
                    : new Date(t.created_at).toLocaleString()}
              </p>
            </div>
            {(t.status === "open" || t.status === "claimed") && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={pending}
                onClick={() => cancel(t.id)}
                title="Cancel this request"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
