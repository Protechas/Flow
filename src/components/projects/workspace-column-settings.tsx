"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorkspaceColumnDef, WorkspaceColumnType } from "@/lib/projects/workspace-types";
import { Checkbox } from "@/components/ui/checkbox";

const COLUMN_TYPES: { value: WorkspaceColumnType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "status", label: "Status" },
  { value: "person", label: "Person" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
  { value: "hours", label: "Hours" },
  { value: "dropdown", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "progress", label: "Progress" },
  { value: "files", label: "Files" },
  { value: "currency", label: "Currency" },
  { value: "tags", label: "Tags" },
  { value: "custom_metric", label: "Custom metric" },
];

export function WorkspaceColumnSettings({
  open,
  onOpenChange,
  columns,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: WorkspaceColumnDef[];
  onSave: (columns: WorkspaceColumnDef[]) => void;
}) {
  const [draft, setDraft] = useState(columns);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<WorkspaceColumnType>("text");

  function syncFromProps() {
    setDraft(columns);
  }

  function addColumn() {
    const label = newLabel.trim();
    if (!label) return;
    const id = `custom_${label.toLowerCase().replace(/\W+/g, "_")}_${Date.now()}`;
    setDraft((prev) => [
      ...prev,
      { id, label, type: newType, visible: true, width: 140 },
    ]);
    setNewLabel("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) syncFromProps();
      }}
    >
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize columns</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Build your task table like Monday.com. Built-in columns still feed reporting and QA.
        </p>
        <div className="space-y-2">
          {draft.map((col) => (
            <label
              key={col.id}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Checkbox
                  checked={col.visible}
                  onCheckedChange={(checked) =>
                    setDraft((prev) =>
                      prev.map((c) => (c.id === col.id ? { ...c, visible: Boolean(checked) } : c))
                    )
                  }
                />
                <span className="truncate text-sm font-medium">{col.label}</span>
                <span className="text-xs text-muted-foreground capitalize">{col.type}</span>
              </div>
            </label>
          ))}
        </div>
        <div className="rounded-lg border p-3 space-y-3">
          <p className="text-sm font-medium">Add column</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Label</Label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Risk" />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={newType}
                onChange={(e) => setNewType(e.target.value as WorkspaceColumnType)}
              >
                {COLUMN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addColumn}>
            Add column
          </Button>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Save columns
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
