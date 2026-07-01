"use client";

import { useState, useTransition } from "react";
import { updateQaRuleAction } from "@/app/actions/qa-center";
import { QaCenterSubnav } from "@/components/qa-center/qa-center-subnav";
import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useFlowToast } from "@/components/ui/flow-toast";
import type { QaValidationRule } from "@/lib/qa-center/types";
import { Scale } from "lucide-react";

const LAYER_LABELS: Record<string, string> = {
  file: "Layer 1 · File",
  content: "Layer 2 · Content",
  mcc: "Layer 3 · MCC",
  business: "Layer 4 · Business",
  ai: "Layer 5 · Smart review",
  scoring: "Scoring",
};

export function RuleEngineView({ rules }: { rules: QaValidationRule[] }) {
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();
  const [editingRule, setEditingRule] = useState<QaValidationRule | null>(null);
  const [configDraft, setConfigDraft] = useState("");

  function toggleRule(rule: QaValidationRule, enabled: boolean) {
    startTransition(async () => {
      await updateQaRuleAction(rule.rule_key, { enabled });
    });
  }

  function saveWeight(rule: QaValidationRule, weight: number) {
    startTransition(async () => {
      await updateQaRuleAction(rule.rule_key, { weight });
    });
  }

  function openConfigEditor(rule: QaValidationRule) {
    setEditingRule(rule);
    setConfigDraft(JSON.stringify(rule.config, null, 2));
  }

  function saveConfig() {
    if (!editingRule) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(configDraft) as Record<string, unknown>;
    } catch {
      toast({
        variant: "error",
        title: "Invalid JSON",
        description: "Fix syntax errors before saving.",
      });
      return;
    }

    startTransition(async () => {
      try {
        await updateQaRuleAction(editingRule.rule_key, { config: parsed });
        toast({ variant: "success", title: "Rule updated", description: editingRule.label });
        setEditingRule(null);
      } catch {
        toast({ variant: "error", title: "Save failed", description: "Could not update rule." });
      }
    });
  }

  const grouped = rules.reduce<Record<string, QaValidationRule[]>>((acc, rule) => {
    (acc[rule.layer] ??= []).push(rule);
    return acc;
  }, {});

  return (
    <>
      <QaCenterSubnav />

      <div className="mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          Rule Engine
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl mt-1">
          Configure validation rules without code changes. Deterministic layers run first, then
          knowledge-backed smart review (library cross-checks — no external AI). Disabled rules are
          skipped during validation.
        </p>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([layer, layerRules]) => (
          <section key={layer} className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {LAYER_LABELS[layer] ?? layer}
            </h3>
            {layerRules.map((rule) => (
              <div
                key={rule.id}
                className="enterprise-panel p-4 grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-center"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{rule.label}</p>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {rule.rule_key}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{rule.description}</p>
                  <pre className="mt-2 text-[11px] bg-muted/40 rounded p-2 overflow-x-auto max-h-24">
                    {JSON.stringify(rule.config, null, 2)}
                  </pre>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={rule.enabled}
                    onCheckedChange={(v) => toggleRule(rule, v === true)}
                    disabled={pending}
                  />
                  <Label className="text-xs">Enabled</Label>
                </div>
                <div className="flex items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Weight</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      max={5}
                      defaultValue={rule.weight}
                      className="w-20 h-8"
                      onBlur={(e) => saveWeight(rule, Number(e.target.value) || rule.weight)}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => openConfigEditor(rule)}
                  >
                    Edit config
                  </Button>
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>

      <Dialog open={editingRule != null} onOpenChange={(open) => !open && setEditingRule(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit rule config</DialogTitle>
            <DialogDescription>
              {editingRule?.label} ({editingRule?.rule_key})
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={configDraft}
            onChange={(e) => setConfigDraft(e.target.value)}
            className="font-mono text-xs min-h-[240px]"
            spellCheck={false}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRule(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={saveConfig} disabled={pending}>
              Save config
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
