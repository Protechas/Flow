"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { MetricExplanation } from "@/types/flow";
import { ExternalLink } from "lucide-react";

export function MetricExplainer({
  explanation,
  children,
}: {
  explanation: MetricExplanation;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <div
            role="button"
            tabIndex={0}
            className="text-left w-full hover:opacity-90 transition-opacity cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
          />
        }
      >
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{explanation.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="text-2xl font-semibold tabular-nums text-primary">
            {explanation.value}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              How it&apos;s calculated
            </p>
            <p className="text-muted-foreground">{explanation.formula}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Data source
            </p>
            <p>{explanation.source}</p>
          </div>
          {explanation.factors && explanation.factors.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Breakdown
              </p>
              {explanation.factors.map((f) => (
                <div key={f.label} className="flex justify-between text-xs rounded bg-muted/40 px-2 py-1.5">
                  <span>{f.label}</span>
                  <span className="tabular-nums font-medium">{f.value}</span>
                </div>
              ))}
            </div>
          )}
          {explanation.drilldownHref && (
            <Button variant="outline" size="sm" className="w-full" render={<Link href={explanation.drilldownHref} />}>
              <ExternalLink className="h-3.5 w-3.5 mr-2" />
              View underlying records
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
