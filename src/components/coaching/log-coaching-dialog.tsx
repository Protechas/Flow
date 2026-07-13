"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logCoachingSessionAction } from "@/app/actions/coaching";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFlowToast } from "@/components/ui/flow-toast";
import { COACHING_CATEGORY_LABELS, COACHING_LEVEL_LABELS } from "@/lib/coaching/labels";
import type { CoachingCategory, CoachingLevel } from "@/types/flow";
import { ClipboardPen, Loader2 } from "lucide-react";

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

export function LogCoachingDialog({
  employees,
  initialEmployeeId,
}: {
  employees: { id: string; name: string }[];
  initialEmployeeId?: string;
}) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState(initialEmployeeId ?? employees[0]?.id ?? "");
  const [sessionDate, setSessionDate] = useState(todayInput());
  const [category, setCategory] = useState<CoachingCategory>("time_attendance");
  const [level, setLevel] = useState<CoachingLevel>("coaching");
  const [summary, setSummary] = useState("");
  const [expectation, setExpectation] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!employeeId || !summary.trim()) return;
    startTransition(async () => {
      const res = await logCoachingSessionAction({
        employeeId,
        sessionDate,
        category,
        level,
        summary,
        expectation: expectation || undefined,
        followUpDate: followUpDate || undefined,
      });
      if (!res.ok) {
        toast({ variant: "error", title: "Could not log session", description: res.message });
        return;
      }
      toast({
        variant: "success",
        title: "Coaching session logged",
        description: "The employee was notified to review and acknowledge it.",
      });
      setOpen(false);
      setSummary("");
      setExpectation("");
      setFollowUpDate("");
      router.refresh();
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <ClipboardPen className="mr-1.5 h-4 w-4" />
        Log coaching session
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Log a coaching session</DialogTitle>
            <DialogDescription>
              This is the accountability record — the employee is notified and asked to
              acknowledge the conversation happened.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="coach-employee">Employee</Label>
                <Select value={employeeId} onValueChange={(v) => v && setEmployeeId(v)}>
                  <SelectTrigger id="coach-employee" className="w-full bg-card text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coach-date">Session date</Label>
                <Input
                  id="coach-date"
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="coach-category">Category</Label>
                <Select value={category} onValueChange={(v) => v && setCategory(v as CoachingCategory)}>
                  <SelectTrigger id="coach-category" className="w-full bg-card text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COACHING_CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coach-level">Level</Label>
                <Select value={level} onValueChange={(v) => v && setLevel(v as CoachingLevel)}>
                  <SelectTrigger id="coach-level" className="w-full bg-card text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COACHING_LEVEL_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coach-summary">What was discussed</Label>
              <Textarea
                id="coach-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="e.g. Talked through last week's clock-in times — 40+ minutes late three days without notice."
                rows={3}
                maxLength={4000}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coach-expectation">What was agreed / expected going forward</Label>
              <Textarea
                id="coach-expectation"
                value={expectation}
                onChange={(e) => setExpectation(e.target.value)}
                placeholder="e.g. Clocked in by 8:05 daily; message the lead ahead of time if something comes up."
                rows={2}
                maxLength={2000}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coach-followup">Follow-up date (optional)</Label>
              <Input
                id="coach-followup"
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submit} disabled={pending || !summary.trim() || !employeeId}>
              {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Log session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
