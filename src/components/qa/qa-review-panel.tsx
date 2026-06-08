"use client";

import { useState, useTransition } from "react";
import { submitQaReviewAction } from "@/app/actions/qa";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ERROR_CATEGORIES, QA_RESULTS } from "@/lib/constants";
import type { QaResult, User, WorkPackage } from "@/types/flow";

interface QaReviewPanelProps {
  queue: WorkPackage[];
  reviewer: User;
  canReview: boolean;
}

export function QaReviewPanel({ queue, reviewer, canReview }: QaReviewPanelProps) {
  const [selectedId, setSelectedId] = useState(queue[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const selected = queue.find((q) => q.id === selectedId);

  function submit(result: QaResult, form: FormData) {
    if (!selected?.assigned_to) return;
    startTransition(async () => {
      await submitQaReviewAction({
        workPackageId: selected.id,
        reviewerId: reviewer.id,
        analystId: selected.assigned_to!,
        result,
        notes: (form.get("notes") as string) || undefined,
        errorCategory: (form.get("error_category") as string) || undefined,
      });
      setSelectedId(queue.find((q) => q.id !== selectedId)?.id ?? "");
    });
  }

  if (queue.length === 0) {
    return (
      <div className="enterprise-panel py-12 text-center text-muted-foreground text-sm">
        No work items awaiting QA review.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="enterprise-panel lg:col-span-1 overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-secondary">
          <h3 className="enterprise-section-title">Review Queue ({queue.length})</h3>
        </div>
        <div className="max-h-[calc(100vh-14rem)] overflow-y-auto">
          {queue.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${
                selectedId === item.id
                  ? "bg-blue-50 border-l-2 border-l-primary"
                  : "border-l-2 border-l-transparent hover:bg-accent"
              }`}
            >
              <p className="text-sm font-medium truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.assignee?.full_name} · {item.manufacturer?.name}
              </p>
              <div className="mt-2">
                <StatusBadge status={item.status} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="enterprise-panel lg:col-span-2">
          <div className="px-4 py-3 border-b border-border bg-secondary">
            <h3 className="enterprise-section-title">{selected.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selected.project?.name} · {selected.manufacturer?.name} · {selected.year} ·{" "}
              {selected.assignee?.full_name}
            </p>
          </div>
          <div className="p-4">
            <form id="qa-form" className="space-y-4 mb-6">
              <div className="space-y-2">
                <Label>Error Category</Label>
                <Select name="error_category">
                  <SelectTrigger>
                    <SelectValue placeholder="Select if correction needed" />
                  </SelectTrigger>
                  <SelectContent>
                    {ERROR_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Review Notes</Label>
                <Input id="notes" name="notes" placeholder="Optional feedback for analyst" />
              </div>
            </form>
            <div className="flex flex-wrap gap-2">
              {!canReview && (
                <p className="text-sm text-muted-foreground">You have read-only QA access.</p>
              )}
              {QA_RESULTS.map((r) => (
                <Button
                  key={r.value}
                  disabled={pending || !canReview}
                  variant={r.value === "pass" ? "default" : "outline"}
                  className={
                    r.value === "pass"
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : r.value === "rejected"
                        ? "border-red-300 text-red-700"
                        : ""
                  }
                  onClick={() => {
                    const form = document.getElementById("qa-form") as HTMLFormElement;
                    submit(r.value, new FormData(form));
                  }}
                >
                  {r.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
