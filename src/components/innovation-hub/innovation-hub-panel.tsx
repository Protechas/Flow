"use client";

import { useCallback, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { submitInnovationHubFeedbackAction } from "@/app/actions/innovation-hub-feedback";
import { Button } from "@/components/ui/button";
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
import {
  FEEDBACK_CATEGORY_OPTIONS,
  FEEDBACK_PRIORITY_OPTIONS,
} from "@/lib/innovation-hub/constants";
import {
  clientFeedbackAttachmentMaxBytes,
  formatUploadLimitLabel,
} from "@/lib/files/upload-limits-client";
import type { FeedbackCategory, FeedbackPriority } from "@/types/flow";
import { CheckCircle2, ImagePlus, Loader2 } from "lucide-react";

function collectDeviceInfo() {
  if (typeof navigator === "undefined") return "";
  const parts = [navigator.userAgent];
  if (navigator.platform) parts.push(`platform:${navigator.platform}`);
  if (typeof window !== "undefined") {
    parts.push(`viewport:${window.innerWidth}x${window.innerHeight}`);
  }
  return parts.join(" | ");
}

export function InnovationHubPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<FeedbackCategory>("idea");
  const [priority, setPriority] = useState<FeedbackPriority>("medium");
  const [attachmentName, setAttachmentName] = useState<string | null>(null);

  const pageUrl = searchParams?.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;

  const resetForm = useCallback(() => {
    setSubmitted(false);
    setError(null);
    setCategory("idea");
    setPriority("medium");
    setAttachmentName(null);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        resetForm();
      }
      onOpenChange(next);
    },
    [onOpenChange, resetForm]
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="border-b border-border/60 pb-4">
          <SheetTitle>Innovation Hub</SheetTitle>
          <SheetDescription>
            Share ideas, report issues, or ask questions to help improve Flow.
          </SheetDescription>
        </SheetHeader>

        {submitted ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <p className="text-sm font-medium">Submitted. Thanks for helping improve Flow.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              className="mt-2"
            >
              Close
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4 px-4 pb-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              const fd = new FormData(e.currentTarget);
              fd.set("category", category);
              fd.set("priority", priority);
              fd.set("page_url", pageUrl);
              fd.set("device_info", collectDeviceInfo());

              startTransition(async () => {
                const res = await submitInnovationHubFeedbackAction(fd);
                if (!res.ok) {
                  setError(res.message);
                  return;
                }
                setSubmitted(true);
                e.currentTarget.reset();
                setAttachmentName(null);
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="ih-category">Category</Label>
              <Select
                value={category}
                onValueChange={(v) => v && setCategory(v as FeedbackCategory)}
              >
                <SelectTrigger id="ih-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEEDBACK_CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ih-title">Title</Label>
              <Input
                id="ih-title"
                name="title"
                required
                maxLength={200}
                placeholder="Brief summary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ih-description">Description</Label>
              <Textarea
                id="ih-description"
                name="description"
                required
                rows={5}
                placeholder="Describe your idea, issue, or question in detail."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ih-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => v && setPriority(v as FeedbackPriority)}
              >
                <SelectTrigger id="ih-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEEDBACK_PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ih-attachment">Screenshot or file (optional)</Label>
              <label
                htmlFor="ih-attachment"
                className="flex items-center gap-2 rounded-md border border-dashed border-border/70 px-3 py-2.5 text-sm text-muted-foreground cursor-pointer hover:bg-muted/30 transition-colors"
              >
                <ImagePlus className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {attachmentName ??
                    `PNG, JPG, PDF up to ${formatUploadLimitLabel(clientFeedbackAttachmentMaxBytes)}`}
                </span>
              </label>
              <input
                id="ih-attachment"
                name="attachment"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setAttachmentName(file?.name ?? null);
                }}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Page context and app version are captured automatically with your submission.
            </p>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <SheetFooter className="flex-row gap-2 px-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
