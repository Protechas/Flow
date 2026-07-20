/**
 * Structured editors for QA validation rule `config` blobs, so admins tune
 * rules with real form controls instead of hand-editing raw JSON. Rules whose
 * key has no schema here fall back to the advanced JSON editor. Serialization
 * always preserves config keys the schema doesn't name (e.g. the
 * knowledge-library `source` pointers on required_sections).
 */

export type RuleFieldType = "number" | "boolean" | "string" | "string-list";

export interface RuleConfigField {
  key: string;
  label: string;
  type: RuleFieldType;
  help?: string;
  /** number only */
  min?: number;
  max?: number;
  step?: number;
  /** string only — empty input serializes to null instead of "" */
  nullable?: boolean;
  /** string-list only — placeholder for the add box */
  placeholder?: string;
}

export interface RuleConfigSchema {
  fields: RuleConfigField[];
  /** Shown above the form; e.g. "Section list comes from the SOP library." */
  note?: string;
}

const SCHEMAS: Record<string, RuleConfigSchema> = {
  max_file_size_mb: {
    fields: [
      {
        key: "max_mb",
        label: "Maximum file size (MB)",
        type: "number",
        min: 1,
        max: 500,
        step: 1,
        help: "Uploads larger than this are rejected before review.",
      },
    ],
  },
  allowed_extensions: {
    fields: [
      {
        key: "extensions",
        label: "Accepted file types",
        type: "string-list",
        placeholder: "pdf",
        help: "Lowercase, no dot. Anything else is flagged on upload.",
      },
    ],
  },
  landscape_orientation: {
    fields: [
      {
        key: "required",
        label: "Require landscape orientation",
        type: "boolean",
        help: "Flags portrait PDFs per the SI Library SOP.",
      },
    ],
  },
  required_sections: {
    note: "Section headings are normally read from the active SI Content SOP in the Knowledge Library. Anything you add here is checked in addition.",
    fields: [
      {
        key: "sections",
        label: "Extra required section headings",
        type: "string-list",
        placeholder: "Calibration",
        help: "Submissions missing these headings are flagged.",
      },
    ],
  },
  naming_convention: {
    fields: [
      {
        key: "pattern",
        label: "Naming pattern",
        type: "string",
        nullable: true,
        help: "A regular expression file names must match. Leave blank to accept any name.",
      },
    ],
  },
  gold_standard_compare: {
    fields: [
      {
        key: "enabled",
        label: "Compare against gold standards",
        type: "boolean",
        help: "Cross-checks submissions with approved reference documents when the library has them.",
      },
    ],
  },
  scoring_weights: {
    note: "Weights blend the per-layer scores into one QA score. They are relative — they do not need to sum to 1.",
    fields: [
      { key: "file", label: "File layer", type: "number", min: 0, max: 1, step: 0.05 },
      { key: "content", label: "Content layer", type: "number", min: 0, max: 1, step: 0.05 },
      { key: "mcc", label: "MCC layer", type: "number", min: 0, max: 1, step: 0.05 },
      { key: "business", label: "Business layer", type: "number", min: 0, max: 1, step: 0.05 },
      { key: "ai", label: "Smart review", type: "number", min: 0, max: 1, step: 0.05 },
    ],
  },
};

export function getRuleConfigSchema(ruleKey: string): RuleConfigSchema | null {
  return SCHEMAS[ruleKey] ?? null;
}

export function hasStructuredEditor(ruleKey: string): boolean {
  return ruleKey in SCHEMAS;
}

export type RuleFieldValue = number | boolean | string | string[];

/** Pull initial form values out of a stored config, coercing to field types. */
export function readRuleConfigValues(
  schema: RuleConfigSchema,
  config: Record<string, unknown>
): Record<string, RuleFieldValue> {
  const values: Record<string, RuleFieldValue> = {};
  for (const field of schema.fields) {
    const raw = config[field.key];
    switch (field.type) {
      case "number":
        values[field.key] = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
        break;
      case "boolean":
        // Rules treat a missing/undefined flag as "on" (opt-out semantics).
        values[field.key] = raw === undefined ? true : Boolean(raw);
        break;
      case "string":
        values[field.key] = typeof raw === "string" ? raw : "";
        break;
      case "string-list":
        values[field.key] = Array.isArray(raw)
          ? raw.map((v) => String(v).trim()).filter(Boolean)
          : [];
        break;
    }
  }
  return values;
}

export interface RuleConfigValidationError {
  field: string;
  message: string;
}

/**
 * Merge edited values back into the existing config. Keys not named by the
 * schema (source pointers, etc.) are preserved untouched. Returns either the
 * new config or a list of validation errors.
 */
export function applyRuleConfigValues(
  schema: RuleConfigSchema,
  existing: Record<string, unknown>,
  values: Record<string, RuleFieldValue>
): { ok: true; config: Record<string, unknown> } | { ok: false; errors: RuleConfigValidationError[] } {
  const errors: RuleConfigValidationError[] = [];
  const next: Record<string, unknown> = { ...existing };

  for (const field of schema.fields) {
    const value = values[field.key];
    switch (field.type) {
      case "number": {
        const num = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(num)) {
          errors.push({ field: field.key, message: `${field.label} must be a number.` });
          break;
        }
        if (field.min != null && num < field.min) {
          errors.push({ field: field.key, message: `${field.label} must be at least ${field.min}.` });
          break;
        }
        if (field.max != null && num > field.max) {
          errors.push({ field: field.key, message: `${field.label} must be at most ${field.max}.` });
          break;
        }
        next[field.key] = num;
        break;
      }
      case "boolean":
        next[field.key] = Boolean(value);
        break;
      case "string": {
        const str = typeof value === "string" ? value.trim() : "";
        if (field.nullable) {
          next[field.key] = str.length > 0 ? str : null;
        } else {
          next[field.key] = str;
        }
        break;
      }
      case "string-list": {
        const list = Array.isArray(value)
          ? Array.from(new Set(value.map((v) => String(v).trim()).filter(Boolean)))
          : [];
        next[field.key] = list;
        break;
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, config: next };
}
