"use client";

import { useMemo, useState, useTransition } from "react";
import { updateInnovationHubFeedbackAction } from "@/app/actions/innovation-hub-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useFlowToast } from "@/components/ui/flow-toast";
import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_CATEGORY_OPTIONS,
  FEEDBACK_PRIORITY_LABELS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUS_OPTIONS,
} from "@/lib/innovation-hub/constants";
import { cn } from "@/lib/utils";
import type {
  FeedbackCategory,
  FeedbackPriority,
  FeedbackStatus,
  FeedbackSubmissionView,
  User,
} from "@/types/flow";
import { format } from "date-fns";
import { ExternalLink, Loader2 } from "lucide-react";

function statusVariant(status: FeedbackStatus) {
  switch (status) {
    case "new":
      return "default";
    case "investigating":
      return "secondary";
    case "planned":
      return "outline";
    case "fixed":
      return "default";
    case "rejected":
      return "destructive";
    default:
      return "outline";
  }
}

function priorityClass(priority: FeedbackPriority) {
  switch (priority) {
    case "high":
      return "text-destructive border-destructive/40";
    case "medium":
      return "text-warning border-warning/40";
    default:
      return "text-muted-foreground";
  }
}

export function InnovationHubAdminPanel({
  initialItems,
  assignableUsers,
}: {
  initialItems: FeedbackSubmissionView[];
  assignableUsers: User[];
}) {
  const { toast } = useFlowToast();
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<FeedbackSubmissionView | null>(null);
  const [pending, startTransition] = useTransition();

  const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<FeedbackPriority | "all">("all");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");
  const [userFilter, setUserFilter] = useState("");

  const [editStatus, setEditStatus] = useState<FeedbackStatus>("new");
  const [editAssignedTo, setEditAssignedTo] = useState<string>("none");
  const [editNotes, setEditNotes] = useState("");

  const filtered = useMemo(() => {
    const q = userFilter.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (q) {
        const hay = `${item.user_name} ${item.user_email ?? ""} ${item.title}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, categoryFilter, priorityFilter, statusFilter, userFilter]);

  const openDetail = (item: FeedbackSubmissionView) => {
    setSelected(item);
    setEditStatus(item.status);
    setEditAssignedTo(item.assigned_to ?? "none");
    setEditNotes(item.resolution_notes ?? "");
  };

  const saveDetail = () => {
    if (!selected) return;
    startTransition(async () => {
      const res = await updateInnovationHubFeedbackAction({
        id: selected.id,
        status: editStatus,
        assigned_to: editAssignedTo === "none" ? null : editAssignedTo,
        resolution_notes: editNotes.trim() || null,
      });
      if (!res.ok) {
        toast({ variant: "error", title: "Update failed", description: res.message });
        return;
      }
      const assigned_to = editAssignedTo === "none" ? null : editAssignedTo;
      const assigned_to_name =
        assigned_to
          ? assignableUsers.find((u) => u.id === assigned_to)?.full_name ?? assigned_to
          : null;
      const updated: FeedbackSubmissionView = {
        ...selected,
        status: editStatus,
        assigned_to,
        assigned_to_name,
        resolution_notes: editNotes.trim() || null,
        updated_at: new Date().toISOString(),
      };
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setSelected(updated);
      toast({ variant: "success", title: "Feedback updated" });
    });
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardContent className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Select
              value={categoryFilter}
              onValueChange={(v) => v && setCategoryFilter(v as FeedbackCategory | "all")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {FEEDBACK_CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Priority</Label>
            <Select
              value={priorityFilter}
              onValueChange={(v) => v && setPriorityFilter(v as FeedbackPriority | "all")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => v && setStatusFilter(v as FeedbackStatus | "all")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {FEEDBACK_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">User search</Label>
            <Input
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              placeholder="Name or email"
            />
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card className="border-border/60 border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No feedback submissions match your filters.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Submitted</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Priority</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border/40 hover:bg-muted/20 cursor-pointer"
                      onClick={() => openDetail(item)}
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {format(new Date(item.created_at), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.user_name}</div>
                        {item.user_email && (
                          <div className="text-xs text-muted-foreground">{item.user_email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">{FEEDBACK_CATEGORY_LABELS[item.category]}</td>
                      <td className="px-4 py-3 font-medium max-w-[220px] truncate">{item.title}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn("text-xs", priorityClass(item.priority))}>
                          {FEEDBACK_PRIORITY_LABELS[item.priority]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(item.status)} className="text-xs">
                          {FEEDBACK_STATUS_LABELS[item.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.assigned_to_name ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.title}</SheetTitle>
                <SheetDescription>
                  {FEEDBACK_CATEGORY_LABELS[selected.category]} · submitted by {selected.user_name}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4">
                <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm whitespace-pre-wrap">
                  {selected.description}
                </div>

                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Priority</dt>
                    <dd className="font-medium">{FEEDBACK_PRIORITY_LABELS[selected.priority]}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">App version</dt>
                    <dd className="font-medium">{selected.app_version ?? "—"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Page</dt>
                    <dd className="font-medium break-all">{selected.page_url ?? "—"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Device</dt>
                    <dd className="font-medium break-all">{selected.device_info ?? "—"}</dd>
                  </div>
                </dl>

                {selected.screenshot_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<a href={selected.screenshot_url} target="_blank" rel="noopener noreferrer" />}
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    View attachment
                  </Button>
                )}

                <div className="space-y-2 pt-2 border-t border-border/60">
                  <Label>Status</Label>
                  <Select
                    value={editStatus}
                    onValueChange={(v) => v && setEditStatus(v as FeedbackStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FEEDBACK_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Assigned to</Label>
                  <Select value={editAssignedTo} onValueChange={(v) => v && setEditAssignedTo(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {assignableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resolution-notes">Resolution notes</Label>
                  <Textarea
                    id="resolution-notes"
                    rows={4}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Internal notes on investigation, plan, or resolution."
                  />
                </div>
              </div>

              <SheetFooter className="px-4">
                <Button onClick={saveDetail} disabled={pending}>
                  {pending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
