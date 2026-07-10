"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { runAiTriageAction } from "@/app/actions/ai-triage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AiTriageResult } from "@/lib/ai/types";
import {
  VALIDATION_ROOT_CAUSE_LABELS,
  type ValidationFinding,
} from "@/lib/validation-center/types";

const PRIORITY_LABELS: Record<string, string> = {
  now: "Fix now",
  next: "Up next",
  later: "Later",
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString();
}

export function AiTriagePanel({
  runId,
  findings,
  initialTriage,
}: {
  runId: string;
  findings: ValidationFinding[];
  initialTriage: AiTriageResult | null;
}) {
  const [triage, setTriage] = useState(initialTriage);
  const [message, setMessage] = useState<string | null>(null);
  const [analyzing, startAnalyze] = useTransition();

  const titleById = new Map(findings.map((f) => [f.id, f.title]));

  const analyze = () =>
    startAnalyze(async () => {
      setMessage(null);
      const result = await runAiTriageAction(runId);
      if (result.triage) setTriage(result.triage);
      if (!result.ok) setMessage(result.message ?? "AI triage failed");
    });

  const completed = triage?.status === "completed" ? triage : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Triage
            </CardTitle>
            <CardDescription>
              Claude groups this run&apos;s findings and suggests where to start. Suggestions
              are advisory — review before acting.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" disabled={analyzing} onClick={analyze}>
            {analyzing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {analyzing ? "Analyzing…" : completed ? "Re-analyze" : "Analyze findings"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && <p className="text-sm text-destructive">{message}</p>}
        {triage?.status === "failed" && triage.error_message && (
          <p className="text-sm text-destructive">Last attempt failed: {triage.error_message}</p>
        )}

        {!completed && !analyzing && !message && (
          <p className="text-sm text-muted-foreground">
            No analysis yet. Run it once the audit completes — it takes about half a minute.
          </p>
        )}

        {completed && (
          <>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {completed.summary}
            </p>

            <div className="space-y-3">
              {completed.clusters.map((cluster, i) => (
                <div key={i} className="rounded-md border p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{cluster.label}</p>
                    <Badge variant="outline">
                      {PRIORITY_LABELS[cluster.priority] ?? cluster.priority}
                    </Badge>
                    <Badge variant="outline">
                      {VALIDATION_ROOT_CAUSE_LABELS[cluster.likely_root_cause]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {cluster.finding_ids.length}{" "}
                      {cluster.finding_ids.length === 1 ? "finding" : "findings"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{cluster.explanation}</p>
                  <p className="text-sm">
                    <span className="font-medium">Suggested: </span>
                    {cluster.recommended_action}
                  </p>
                  <details>
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      Show findings in this group
                    </summary>
                    <ul className="mt-2 space-y-1 pl-4 text-xs text-muted-foreground list-disc">
                      {cluster.finding_ids.map((id) => (
                        <li key={id}>{titleById.get(id) ?? id}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Analyzed {completed.findings_analyzed} of {completed.findings_total} findings ·{" "}
              {formatWhen(completed.created_at)}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
