"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { ManufacturerScore } from "@/lib/validation-center/library-intelligence";
import { validationPath } from "@/lib/validation-center/nav";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";

function complianceTone(value: number): string {
  if (value >= 85) return "text-emerald-400";
  if (value >= 70) return "text-amber-500";
  return "text-destructive";
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null || delta === 0) return <span className="text-muted-foreground">—</span>;
  const up = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 tabular-nums",
        up ? "text-emerald-400" : "text-destructive"
      )}
    >
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {up ? "+" : ""}
      {delta}%
    </span>
  );
}

export function LibraryScoreboard({ rows }: { rows: ManufacturerScore[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(manufacturer: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(manufacturer)) next.delete(manufacturer);
      else next.add(manufacturer);
      return next;
    });
  }

  return (
    <div className="enterprise-panel overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Manufacturer</th>
            <th className="px-3 py-3 font-medium text-right">Compliance</th>
            <th className="px-3 py-3 font-medium text-right">Trend</th>
            <th className="px-3 py-3 font-medium text-right">Expected</th>
            <th className="px-3 py-3 font-medium text-right">Passing</th>
            <th className="px-3 py-3 font-medium text-right">Review</th>
            <th className="px-3 py-3 font-medium text-right">Missing</th>
            <th className="px-3 py-3 font-medium text-right">PCS/Naming</th>
            <th className="px-3 py-3 font-medium">Last audit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const open = expanded.has(row.manufacturer);
            return [
              <tr
                key={row.manufacturer}
                className="cursor-pointer border-b border-border/30 hover:bg-muted/20"
                onClick={() => toggle(row.manufacturer)}
              >
                <td className="px-4 py-2.5 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {open ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {row.manufacturer}
                  </span>
                </td>
                <td
                  className={cn(
                    "px-3 py-2.5 text-right font-semibold tabular-nums",
                    complianceTone(row.compliance)
                  )}
                >
                  {row.compliance}%
                </td>
                <td className="px-3 py-2.5 text-right">
                  <DeltaBadge delta={row.delta} />
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{row.expected}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{row.passing}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{row.review}</td>
                <td
                  className={cn(
                    "px-3 py-2.5 text-right tabular-nums",
                    row.missing > 0 && "text-destructive"
                  )}
                >
                  {row.missing}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{row.pcsReview}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {row.auditDate ? new Date(row.auditDate).toLocaleDateString() : "—"}
                </td>
              </tr>,
              open && (
                <tr key={`${row.manufacturer}-history`} className="border-b border-border/30 bg-muted/10">
                  <td colSpan={9} className="px-8 py-3">
                    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                      Audit history
                    </p>
                    <ul className="space-y-1 text-sm">
                      {row.history.map((h) => (
                        <li key={h.runId} className="flex items-center gap-3">
                          <span className="w-24 tabular-nums text-muted-foreground">
                            {h.date ? new Date(h.date).toLocaleDateString() : "—"}
                          </span>
                          <span className={cn("w-16 text-right font-medium tabular-nums", complianceTone(h.compliance))}>
                            {h.compliance}%
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {h.review} review
                          </Badge>
                          <Link
                            href={validationPath(`/runs/${h.runId}`)}
                            className="text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open run
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
