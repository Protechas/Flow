"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { runSopReviewAction } from "@/app/actions/ai-sop-review";
import { AI_NAME } from "@/lib/ai/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AiSopReviewFinding, AiSopReviewResult } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

const KIND_LABELS: Record<AiSopReviewFinding["kind"], string> = {
  clarity: "Unclear",
  contradiction: "Contradiction",
  stale_reference: "Stale reference",
  missing_step: "Missing step",
  inconsistency: "Inconsistent",
  other: "Other",
};

const SEVERITY_STYLES: Record<AiSopReviewFinding["severity"], string> = {
  high: "border-red-500/30 text-red-500",
  medium: "border-amber-500/30 text-amber-500",
  low: "border-border text-muted-foreground",
};

export function EddyReviewPanel({ documentId }: { documentId: string }) {
  const [review, setReview] = useState<AiSopReviewResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewing, startReview] = useTransition();

  const runReview = () =>
    startReview(async () => {
      setMessage(null);
      const result = await runSopReviewAction(documentId);
      if (result.review) setReview(result.review);
      if (!result.ok) setMessage(result.message ?? "Review failed");
    });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {`Review with ${AI_NAME}`}
            </CardTitle>
            <CardDescription>
              {`${AI_NAME} reads the last saved version like a new employee would: unclear steps, contradictions, stale references, missing steps. Advisory — you decide what to change.`}
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" disabled={reviewing} onClick={runReview}>
            {reviewing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {reviewing ? "Reviewing…" : review ? "Review again" : "Review document"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && <p className="text-sm text-destructive">{message}</p>}

        {!review && !reviewing && !message && (
          <p className="text-sm text-muted-foreground">
            Save your changes first — the review reads the saved copy. Takes about half a
            minute.
          </p>
        )}

        {review && (
          <>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.summary}</p>

            {review.findings.length === 0 ? (
              <p className="text-sm text-emerald-500">
                {`${AI_NAME} found nothing to flag in this document.`}
              </p>
            ) : (
              <div className="space-y-3">
                {review.findings.map((finding, i) => (
                  <div key={i} className="rounded-md border p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn("capitalize", SEVERITY_STYLES[finding.severity])}
                      >
                        {finding.severity}
                      </Badge>
                      <Badge variant="outline">{KIND_LABELS[finding.kind]}</Badge>
                    </div>
                    {finding.quote && (
                      <blockquote className="border-l-2 border-border pl-3 text-xs text-muted-foreground italic">
                        “{finding.quote}”
                      </blockquote>
                    )}
                    <p className="text-sm text-muted-foreground">{finding.issue}</p>
                    {finding.suggestion && (
                      <p className="text-sm">
                        <span className="font-medium">Suggested: </span>
                        {finding.suggestion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {review.truncated ? "Long document — reviewed up to the length cap · " : ""}
              Reviewed {new Date(review.reviewed_at).toLocaleString()}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
