"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SmartHierarchyLabels } from "@/lib/work-packages/smart-labels";
import { dedupeSortLabels, sortLabels, type LabelSortMode } from "@/lib/work-creation/sort-labels";
import { Plus, X } from "lucide-react";

export function WorkPackageBulkPicker({
  labels,
  options,
  selected,
  customOptions = [],
  onSelectedChange,
  onAddCustom,
  onRemoveCustom,
  sortMode = "alpha",
}: {
  labels: SmartHierarchyLabels;
  options: string[];
  selected: string[];
  customOptions?: string[];
  onSelectedChange: (names: string[]) => void;
  onAddCustom: (name: string) => void;
  onRemoveCustom?: (name: string) => void;
  sortMode?: LabelSortMode;
}) {
  const [customInput, setCustomInput] = useState("");

  const sortedOptions = useMemo(
    () => dedupeSortLabels(options, sortMode),
    [options, sortMode]
  );
  const sortedSelected = useMemo(
    () => sortLabels(selected, sortMode),
    [selected, sortMode]
  );
  const selectedSet = useMemo(
    () => new Set(selected.map((n) => n.toLowerCase())),
    [selected]
  );
  const customSet = useMemo(
    () => new Set(customOptions.map((n) => n.toLowerCase())),
    [customOptions]
  );

  function emitSelected(names: string[]) {
    onSelectedChange(sortLabels(names, sortMode));
  }

  function toggle(name: string, checked: boolean) {
    const key = name.toLowerCase();
    if (checked) {
      if (selectedSet.has(key)) return;
      emitSelected([...selected, name]);
    } else {
      emitSelected(selected.filter((n) => n.toLowerCase() !== key));
    }
  }

  function selectAll() {
    emitSelected(sortedOptions);
  }

  function clearAll() {
    onSelectedChange([]);
  }

  function submitCustom() {
    const name = customInput.trim();
    if (!name) return;
    onAddCustom(name);
    if (!selectedSet.has(name.toLowerCase())) {
      emitSelected([...selected, name]);
    }
    setCustomInput("");
  }

  return (
    <div className="rounded-md border border-dashed border-border/60 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs">
          Quick select {labels.workPackagePlural.toLowerCase()}
        </Label>
        <div className="flex gap-2 text-xs">
          <button type="button" className="text-primary hover:underline" onClick={selectAll}>
            Select all
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground hover:underline"
            onClick={clearAll}
          >
            Clear
          </button>
        </div>
      </div>

      {sortedOptions.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No suggestions yet — add {labels.workPackagePlural.toLowerCase()} below.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-3 gap-y-2 max-h-[min(240px,42vh)] overflow-y-auto pr-1">
          {sortedOptions.map((name) => {
            const checked = selectedSet.has(name.toLowerCase());
            const isCustom = customSet.has(name.toLowerCase());
            return (
              <div
                key={name}
                className="flex items-center gap-1 min-w-0 rounded-md px-1 py-0.5 hover:bg-muted/30 group"
              >
                <label className="flex items-center gap-2 text-sm cursor-pointer min-w-0 flex-1">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggle(name, v === true)}
                  />
                  <span className="truncate">{name}</span>
                </label>
                {isCustom && onRemoveCustom && (
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground hover:text-destructive opacity-60 hover:opacity-100"
                    aria-label={`Remove ${name}`}
                    onClick={() => {
                      onRemoveCustom(name);
                      emitSelected(
                        selected.filter((n) => n.toLowerCase() !== name.toLowerCase())
                      );
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 pt-1 border-t border-border/40">
        <Input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder={`Add missing ${labels.workPackageShort.toLowerCase()}…`}
          className="h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitCustom();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 shrink-0"
          disabled={!customInput.trim()}
          onClick={submitCustom}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        <span className="font-medium text-foreground">{sortedSelected.length}</span>{" "}
        {labels.workPackageShort.toLowerCase()}
        {sortedSelected.length === 1 ? "" : "s"} selected
        {sortedSelected.length > 0 && (
          <span className="block mt-0.5 truncate" title={sortedSelected.join(", ")}>
            {sortedSelected.length <= 6
              ? sortedSelected.join(" · ")
              : `${sortedSelected.slice(0, 5).join(" · ")} · +${sortedSelected.length - 5} more`}
          </span>
        )}
      </p>
    </div>
  );
}
