"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  claimRequestTicketAction,
  completeRequestTicketAction,
  convertRequestTicketToTaskAction,
  releaseRequestTicketAction,
} from "@/app/actions/request-tickets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFlowToast } from "@/components/ui/flow-toast";
import { TicketFiles } from "@/components/requests/ticket-files";
import { cn } from "@/lib/utils";
import type { RequestTicketFileView, RequestTicketView } from "@/types/flow";
import { CheckCircle2, Hand, ListTodo, Loader2, Undo2 } from "lucide-react";

function ageLabel(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "border-red-500/40 text-red-500",
  normal: "border-border text-muted-foreground",
  low: "border-border text-muted-foreground/70",
};

/**
 * The team's live queue: open requests anyone can claim (first click wins),
 * plus the ones you have claimed with Done / Release. Claimed-by-others rows
 * disappear unless showClaimedByOthers (manager view).
 */
export function RequestQueue({
  tickets,
  currentUserId,
  showClaimedByOthers = false,
  convertProjects,
  filesByTicket = {},
}: {
  tickets: RequestTicketView[];
  currentUserId: string;
  showClaimedByOthers?: boolean;
  /** When provided (leads/managers), claimed tickets gain "Make it a task". */
  convertProjects?: { id: string; name: string }[];
  filesByTicket?: Record<string, RequestTicketFileView[]>;
}) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();
  const [convertTarget, setConvertTarget] = useState<RequestTicketView | null>(null);
  const [convertProjectId, setConvertProjectId] = useState("");
  /** Two-step Done when nothing is attached — the deliverable should ride the ticket. */
  const [confirmNoFileId, setConfirmNoFileId] = useState<string | null>(null);

  const open = tickets.filter((t) => t.status === "open");
  const mine = tickets.filter((t) => t.status === "claimed" && t.claimed_by === currentUserId);
  const others = showClaimedByOthers
    ? tickets.filter((t) => t.status === "claimed" && t.claimed_by !== currentUserId)
    : [];

  const act = (fn: () => Promise<{ ok: boolean; message?: string }>, doneMsg?: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast({ variant: "error", title: res.message ?? "That didn't work" });
      } else if (doneMsg) {
        toast({ variant: "success", title: doneMsg });
      }
      router.refresh();
    });

  const convert = () => {
    const target = convertTarget;
    if (!target || !convertProjectId) return;
    setConvertTarget(null);
    startTransition(async () => {
      const res = await convertRequestTicketToTaskAction({
        ticketId: target.id,
        projectId: convertProjectId,
      });
      if (!res.ok) {
        toast({ variant: "error", title: "Could not create task", description: res.message });
      } else {
        toast({ variant: "success", title: "Task created", description: "The request is now a tracked Flow task." });
      }
      router.refresh();
    });
  };

  if (open.length === 0 && mine.length === 0 && others.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No open requests — the queue is clear.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {mine.length > 0 && (
        <div className="space-y-1.5">
          <p className="flow-section-title">Yours — in progress</p>
          {mine.map((t) => (
            <TicketRow
              key={t.id}
              ticket={t}
              meta={
                t.claimed_at
                  ? `On it for ${ageLabel(t.claimed_at).replace(" ago", "")}${t.paused_task_id ? " · your task timer is paused" : ""}`
                  : undefined
              }
              attachments={
                <TicketFiles
                  ticketId={t.id}
                  files={filesByTicket[t.id] ?? []}
                  canUpload
                  currentUserId={currentUserId}
                />
              }
            >
              {convertProjects && convertProjects.length > 0 && !t.linked_task_id && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setConvertProjectId(convertProjects[0].id);
                    setConvertTarget(t);
                  }}
                >
                  <ListTodo className="mr-1.5 h-4 w-4" />
                  Make it a task
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => act(() => releaseRequestTicketAction(t.id))}
                title="Put it back in the queue for someone else"
              >
                <Undo2 className="mr-1.5 h-4 w-4" />
                Release
              </Button>
              <Button
                size="sm"
                variant={confirmNoFileId === t.id ? "outline" : "default"}
                className={confirmNoFileId === t.id ? "border-amber-500/50 text-amber-500" : ""}
                disabled={pending}
                onClick={() => {
                  const hasFiles = (filesByTicket[t.id] ?? []).length > 0;
                  if (!hasFiles && confirmNoFileId !== t.id) {
                    setConfirmNoFileId(t.id);
                    return;
                  }
                  setConfirmNoFileId(null);
                  act(() => completeRequestTicketAction(t.id), "Marked done — the requester was notified");
                }}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                {confirmNoFileId === t.id ? "No file attached — complete anyway?" : "Done"}
              </Button>
            </TicketRow>
          ))}
        </div>
      )}

      {open.length > 0 && (
        <div className="space-y-1.5">
          <p className="flow-section-title">Open — first claim wins</p>
          {open.map((t) => (
            <TicketRow
              key={t.id}
              ticket={t}
              attachments={
                (filesByTicket[t.id] ?? []).length > 0 ? (
                  <TicketFiles
                    ticketId={t.id}
                    files={filesByTicket[t.id] ?? []}
                    canUpload={false}
                    currentUserId={currentUserId}
                  />
                ) : undefined
              }
            >
              <Button
                size="sm"
                disabled={pending}
                onClick={() => act(() => claimRequestTicketAction(t.id), "It's yours")}
              >
                {pending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Hand className="mr-1.5 h-4 w-4" />
                )}
                Claim
              </Button>
            </TicketRow>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-1.5">
          <p className="flow-section-title">In progress — claimed</p>
          {others.map((t) => (
            <TicketRow key={t.id} ticket={t}>
              <span className="text-xs text-muted-foreground">
                {t.claimed_by_name} · since {t.claimed_at ? ageLabel(t.claimed_at) : "—"}
              </span>
            </TicketRow>
          ))}
        </div>
      )}

      <Dialog open={convertTarget !== null} onOpenChange={(o) => !o && setConvertTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Make it a Flow task</DialogTitle>
            <DialogDescription>
              Creates a real tracked task (timer, QA, forecasting) under the &quot;Team
              Requests&quot; workstream of the project you pick, assigned to whoever claimed it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="convert-project">Project</Label>
            <Select value={convertProjectId} onValueChange={(v) => v && setConvertProjectId(v)}>
              <SelectTrigger id="convert-project" className="w-full bg-card text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(convertProjects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConvertTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={convert} disabled={!convertProjectId}>
              Create task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TicketRow({
  ticket,
  meta,
  attachments,
  children,
}: {
  ticket: RequestTicketView;
  /** Extra line under the title, e.g. the running ticket time. */
  meta?: string;
  /** File chips + drop zone, rendered full-width under the row. */
  attachments?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border/50 bg-muted/10 px-3 py-2 space-y-2",
        ticket.priority === "urgent" && "border-red-500/30 bg-red-500/5"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge variant="outline" className={cn("shrink-0 capitalize", PRIORITY_STYLES[ticket.priority])}>
          {ticket.priority}
        </Badge>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{ticket.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {ticket.requested_by_name} · {ageLabel(ticket.created_at)}
            {ticket.details ? ` — ${ticket.details}` : ""}
          </p>
          {meta && <p className="text-[11px] text-primary/80 truncate">{meta}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">{children}</div>
      </div>
      {attachments}
    </div>
  );
}
