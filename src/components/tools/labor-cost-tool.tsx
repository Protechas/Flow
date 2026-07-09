"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Hours × people × rate, with per-document math when a doc count is given. */
export function LaborCostTool({ defaultRate }: { defaultRate: number }) {
  const [hours, setHours] = useState("8");
  const [people, setPeople] = useState("1");
  const [rate, setRate] = useState(String(defaultRate));
  const [docs, setDocs] = useState("");

  const totalHours = num(hours) * num(people);
  const cost = Math.round(totalHours * num(rate) * 100) / 100;
  const docCount = num(docs);
  const costPerDoc = docCount > 0 ? Math.round((cost / docCount) * 100) / 100 : null;
  const docsPerHour =
    docCount > 0 && totalHours > 0
      ? Math.round((docCount / totalHours) * 100) / 100
      : null;

  const fields = [
    { id: "hours", label: "Hours (per person)", value: hours, set: setHours },
    { id: "people", label: "People", value: people, set: setPeople },
    { id: "rate", label: "Rate ($/hr)", value: rate, set: setRate },
    { id: "docs", label: "Documents (optional)", value: docs, set: setDocs },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {fields.map((f) => (
          <div key={f.id} className="space-y-1">
            <Label htmlFor={`labor-${f.id}`}>{f.label}</Label>
            <Input
              id={`labor-${f.id}`}
              type="number"
              min={0}
              step="0.25"
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Result label="Total labor cost" value={`$${cost.toLocaleString()}`} highlight />
        <Result label="Total hours" value={totalHours.toLocaleString()} />
        <Result label="Cost per document" value={costPerDoc != null ? `$${costPerDoc.toLocaleString()}` : "—"} />
        <Result label="Docs per hour needed" value={docsPerHour != null ? String(docsPerHour) : "—"} />
      </div>

      <p className="text-xs text-muted-foreground">
        The rate prefills from the ROI labor rate setting. Enter a document count to see
        what each document costs and the pace needed to hit it.
      </p>
    </div>
  );
}

function Result({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-md border p-3", highlight && "border-primary/40 bg-primary/5")}>
      <p className={cn("text-2xl font-semibold tabular-nums", highlight && "text-primary")}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
