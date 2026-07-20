"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import {
  applyRuleConfigValues,
  readRuleConfigValues,
  type RuleConfigField,
  type RuleConfigSchema,
  type RuleFieldValue,
} from "@/lib/qa-center/rules/rule-config-form";

/** Structured form for a rule's config. Emits the merged config on save. */
export function RuleConfigEditor({
  schema,
  config,
  pending,
  onSave,
  onCancel,
}: {
  schema: RuleConfigSchema;
  config: Record<string, unknown>;
  pending: boolean;
  onSave: (nextConfig: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, RuleFieldValue>>(() =>
    readRuleConfigValues(schema, config)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setValue(key: string, value: RuleFieldValue) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSave() {
    const result = applyRuleConfigValues(schema, config, values);
    if (!result.ok) {
      setErrors(Object.fromEntries(result.errors.map((e) => [e.field, e.message])));
      return;
    }
    setErrors({});
    onSave(result.config);
  }

  return (
    <div className="space-y-4">
      {schema.note && (
        <p className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2">{schema.note}</p>
      )}
      {schema.fields.map((field) => (
        <FieldControl
          key={field.key}
          field={field}
          value={values[field.key]}
          error={errors[field.key]}
          onChange={(v) => setValue(field.key, v)}
        />
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function FieldControl({
  field,
  value,
  error,
  onChange,
}: {
  field: RuleConfigField;
  value: RuleFieldValue;
  error?: string;
  onChange: (v: RuleFieldValue) => void;
}) {
  return (
    <div className="space-y-1.5">
      {field.type === "boolean" ? (
        <label className="flex items-center gap-2">
          <Checkbox
            checked={Boolean(value)}
            onCheckedChange={(v) => onChange(v === true)}
          />
          <span className="text-sm font-medium">{field.label}</span>
        </label>
      ) : (
        <Label className="text-sm font-medium">{field.label}</Label>
      )}

      {field.type === "number" && (
        <Input
          type="number"
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={Number(value)}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          className="w-40"
        />
      )}

      {field.type === "string" && (
        <Input
          type="text"
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      )}

      {field.type === "string-list" && (
        <StringListControl
          value={Array.isArray(value) ? value : []}
          placeholder={field.placeholder}
          onChange={onChange}
        />
      )}

      {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function StringListControl({
  value,
  placeholder,
  onChange,
}: {
  value: string[];
  placeholder?: string;
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const trimmed = draft.trim();
    if (!trimmed || value.includes(trimmed)) {
      setDraft("");
      return;
    }
    onChange([...value, trimmed]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          spellCheck={false}
        />
        <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item) => (
            <Badge key={item} variant="secondary" className="gap-1 pr-1">
              {item}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== item))}
                className="rounded-sm hover:bg-muted-foreground/20 p-0.5"
                aria-label={`Remove ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
