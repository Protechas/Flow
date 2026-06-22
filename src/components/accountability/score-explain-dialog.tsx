"use client";

import {
  Dialog,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  WizardDialogBody,
  WizardDialogContent,
  WizardDialogHeader,
  WizardDialogScroll,
} from "@/components/ui/wizard-dialog";
import type { ComponentScore, FlowScoreBreakdown } from "@/types/flow";

export function ScoreExplainDialog({
  title,
  score,
  breakdown,
  children,
}: {
  title: string;
  score: number;
  breakdown: ComponentScore;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<button type="button" className="text-left w-full" />}>
        {children}
      </DialogTrigger>
      <WizardDialogContent size="md">
        <WizardDialogHeader>
          <DialogTitle>
            {title}: {score}
            <span className="text-muted-foreground font-normal text-sm ml-2">
              ({Math.round(breakdown.weight * 100)}% of Flow Score)
            </span>
          </DialogTitle>
        </WizardDialogHeader>
        <WizardDialogBody>
          <WizardDialogScroll>
            <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Calculated from live work_packages, qa_reviews, corrections, activity_events, and
            time_logs. Each factor contributes to the component score.
          </p>
          {breakdown.factors.map((f) => (
            <div
              key={f.id}
              className="rounded-lg border border-border/60 p-3 space-y-1"
            >
              <div className="flex justify-between font-medium">
                <span>{f.label}</span>
                <span className="tabular-nums text-primary">{f.normalizedScore}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Raw: {f.rawValue}</span>
                <span>
                  Weight {Math.round(f.weight * 100)}% → +{f.contribution} pts
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{f.explanation}</p>
            </div>
          ))}
          <div className="pt-2 border-t border-border/60 flex justify-between font-semibold">
            <span>Component score</span>
            <span className="tabular-nums">{breakdown.score}</span>
          </div>
            </div>
          </WizardDialogScroll>
        </WizardDialogBody>
      </WizardDialogContent>
    </Dialog>
  );
}

export function FlowScoreExplainDialog({
  breakdown,
  children,
}: {
  breakdown: FlowScoreBreakdown;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<button type="button" className="text-left" />}>
        {children}
      </DialogTrigger>
      <WizardDialogContent size="lg">
        <WizardDialogHeader>
          <DialogTitle>Flow Score: {breakdown.flowScore}</DialogTitle>
        </WizardDialogHeader>
        <WizardDialogBody>
          <WizardDialogScroll>
            <p className="text-sm text-muted-foreground mb-4">{breakdown.formula}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["Productivity", breakdown.productivity],
              ["Quality", breakdown.quality],
              ["On-Time", breakdown.onTime],
              ["Activity", breakdown.activity],
            ] as const
          ).map(([name, comp]) => (
            <div key={name} className="rounded-lg border border-border/60 p-3">
              <p className="font-medium mb-2">
                {name}{" "}
                <span className="text-primary tabular-nums">{comp.score}</span>
                <span className="text-xs text-muted-foreground ml-1">
                  ({Math.round(comp.weight * 100)}%)
                </span>
              </p>
              <ul className="space-y-2 text-xs">
                {comp.factors.map((f) => (
                  <li key={f.id}>
                    <span className="font-medium">{f.label}</span>: {f.rawValue} → {f.normalizedScore}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
            <p className="text-xs text-muted-foreground mt-4">
              Last calculated {new Date(breakdown.calculatedAt).toLocaleString()}
            </p>
          </WizardDialogScroll>
        </WizardDialogBody>
      </WizardDialogContent>
    </Dialog>
  );
}
