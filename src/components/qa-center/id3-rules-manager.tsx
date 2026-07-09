"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addId3RuleAction,
  deleteId3RuleAction,
  updateId3RuleAction,
} from "@/app/actions/qa-engine";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFlowToast } from "@/components/ui/flow-toast";
import type { Id3Rule } from "@/lib/validation-center/id3-rules";
import { Pencil, Plus, Trash2 } from "lucide-react";

const DEFAULT_COLUMNS = ["Make", "Model", "System", "Calibration"];

/** Mark's no-code rules table: plain rows and columns, no Excel, no code. */
export function Id3RulesManager({ rules }: { rules: Id3Rule[] }) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Id3Rule | "new" | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [newColumn, setNewColumn] = useState("");

  const columns = useMemo(() => {
    const keys = new Set<string>();
    for (const rule of rules) Object.keys(rule.fields).forEach((k) => keys.add(k));
    Object.keys(draft).forEach((k) => keys.add(k));
    if (keys.size === 0) DEFAULT_COLUMNS.forEach((k) => keys.add(k));
    return [...keys];
  }, [rules, draft]);

  function openNew() {
    setDraft(Object.fromEntries(columns.map((c) => [c, ""])));
    setNotes("");
    setEditing("new");
  }

  function openEdit(rule: Id3Rule) {
    setDraft({ ...Object.fromEntries(columns.map((c) => [c, ""])), ...rule.fields });
    setNotes(rule.notes ?? "");
    setEditing(rule);
  }

  function save() {
    startTransition(async () => {
      const res =
        editing === "new"
          ? await addId3RuleAction(draft, notes)
          : await updateId3RuleAction((editing as Id3Rule).id, draft, notes);
      if (!res.ok) {
        toast({ variant: "error", title: "Could not save rule", description: res.message });
        return;
      }
      toast({ variant: "success", title: editing === "new" ? "Rule added" : "Rule saved" });
      setEditing(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteId3RuleAction(id);
      if (!res.ok) {
        toast({ variant: "error", title: "Could not delete", description: res.message });
        return;
      }
      router.refresh();
    });
  }

  function addColumn() {
    const name = newColumn.trim();
    if (!name || draft[name] !== undefined) return;
    setDraft((d) => ({ ...d, [name]: "" }));
    setNewColumn("");
  }

  return (
    <section className="enterprise-panel space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Validation rules — {rules.length} rule{rules.length === 1 ? "" : "s"}
          </h2>
          <p className="text-xs text-muted-foreground">
            Each row is one rule. Charts are checked against these — no spreadsheets, no code.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" />
          Add rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No rules yet. Add the first one — the columns should match the chart&apos;s columns
          (Make, Model, System, …).
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 text-xs text-muted-foreground">
                {columns.map((c) => (
                  <th key={c} className="px-3 py-2 text-left whitespace-nowrap">
                    {c}
                  </th>
                ))}
                <th className="px-3 py-2 text-left">Notes</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-t border-border/40">
                  {columns.map((c) => (
                    <td key={c} className="px-3 py-2 whitespace-nowrap">
                      {rule.fields[c] || <span className="text-muted-foreground/50">—</span>}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-xs text-muted-foreground">{rule.notes ?? ""}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Edit rule"
                        onClick={() => openEdit(rule)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Delete rule"
                        disabled={pending}
                        onClick={() => remove(rule.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add a rule" : "Edit rule"}</DialogTitle>
            <DialogDescription>
              Fill in the values this rule requires. Leave a field blank to ignore it.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {Object.keys(draft).map((col) => (
              <div key={col} className="space-y-1">
                <Label>{col}</Label>
                <Input
                  value={draft[col]}
                  onChange={(e) => setDraft((d) => ({ ...d, [col]: e.target.value }))}
                />
              </div>
            ))}
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="flex items-end gap-2 border-t border-border/40 pt-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Need another column?</Label>
                <Input
                  value={newColumn}
                  onChange={(e) => setNewColumn(e.target.value)}
                  placeholder="e.g. Target"
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addColumn}>
                Add column
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending}>
              Save rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
