"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WorkPackageBulkPicker } from "@/components/work-creation/work-package-bulk-picker";
import type { SmartHierarchyLabels } from "@/lib/work-packages/smart-labels";
import { parseBulkLines } from "@/lib/work-creation/project-structure-types";
import { dedupeSortLabels, sortNumbers } from "@/lib/work-creation/sort-labels";

export function MatrixDimensionPicker({
  dimensionLabel,
  dimensionLabelPlural,
  dimensionShort,
  suggested,
  selected,
  customOptions,
  onSelectedChange,
  onAddCustom,
  onRemoveCustom,
  pastePlaceholder,
  sortMode = "alpha",
}: {
  dimensionLabel: string;
  dimensionLabelPlural: string;
  dimensionShort: string;
  suggested: string[];
  selected: string[];
  customOptions: string[];
  onSelectedChange: (names: string[]) => void;
  onAddCustom: (name: string) => void;
  onRemoveCustom: (name: string) => void;
  pastePlaceholder?: string;
  sortMode?: "alpha" | "numeric";
}) {
  const labels: SmartHierarchyLabels = {
    workPackage: dimensionLabel,
    workPackageShort: dimensionShort,
    workPackagePlural: dimensionLabelPlural,
    phase: "Phase",
    phaseShort: "Phase",
    phasePlural: "Phases",
    task: "Task",
    taskPlural: "Tasks",
  };

  const allOptions = dedupeSortLabels(
    [...suggested, ...customOptions, ...selected].map((s) => s.trim()).filter(Boolean),
    sortMode
  );
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  function applyPaste() {
    const lines = parseBulkLines(pasteText);
    if (!lines.length) return;
    for (const line of lines) onAddCustom(line);
    onSelectedChange(dedupeSortLabels([...selected, ...lines], sortMode));
    setPasteText("");
    setShowPaste(false);
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/5 p-4 min-w-0">
      <WorkPackageBulkPicker
        labels={labels}
        options={allOptions}
        selected={selected}
        customOptions={customOptions}
        onSelectedChange={onSelectedChange}
        onAddCustom={onAddCustom}
        onRemoveCustom={onRemoveCustom}
        sortMode={sortMode}
      />
      <div>
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={() => setShowPaste((v) => !v)}
        >
          {showPaste ? "Hide paste list" : "Paste list instead"}
        </button>
        {showPaste && (
          <div className="mt-2 space-y-2">
            <Label className="text-xs">One {dimensionShort.toLowerCase()} per line</Label>
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={pastePlaceholder ?? "Toyota\nHonda\nFord"}
              rows={5}
              className="text-sm font-mono"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!pasteText.trim()}
              onClick={applyPaste}
            >
              Apply pasted list
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function YearDimensionPicker({
  suggestedYears,
  selectedYears,
  customYears,
  onSelectedChange,
  onAddCustom,
  onRemoveCustom,
}: {
  suggestedYears: number[];
  selectedYears: number[];
  customYears: number[];
  onSelectedChange: (years: number[]) => void;
  onAddCustom: (year: number) => void;
  onRemoveCustom: (year: number) => void;
}) {
  const selectedStr = selectedYears.map(String);
  const customStr = customYears.map(String);
  const suggestedStr = suggestedYears.map(String);

  return (
    <MatrixDimensionPicker
      dimensionLabel="Year"
      dimensionLabelPlural="Years"
      dimensionShort="Year"
      sortMode="numeric"
      suggested={dedupeSortLabels(suggestedStr, "numeric")}
      selected={dedupeSortLabels(selectedStr, "numeric")}
      customOptions={dedupeSortLabels(customStr, "numeric")}
      onSelectedChange={(names) => {
        const years = sortNumbers(
          names
            .map((n) => parseInt(n, 10))
            .filter((y) => y >= 1990 && y <= 2100)
        );
        onSelectedChange(years);
      }}
      onAddCustom={(name) => {
        const y = parseInt(name, 10);
        if (y >= 1990 && y <= 2100) onAddCustom(y);
      }}
      onRemoveCustom={(name) => onRemoveCustom(parseInt(name, 10))}
      pastePlaceholder={"2026\n2025\n2024\n2023"}
    />
  );
}
