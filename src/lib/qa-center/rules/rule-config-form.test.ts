import { describe, expect, it } from "vitest";
import {
  applyRuleConfigValues,
  getRuleConfigSchema,
  hasStructuredEditor,
  readRuleConfigValues,
} from "@/lib/qa-center/rules/rule-config-form";

describe("rule-config-form", () => {
  it("exposes schemas for known rules and none for unknown ones", () => {
    expect(hasStructuredEditor("scoring_weights")).toBe(true);
    expect(hasStructuredEditor("mcc_verification")).toBe(false);
    expect(getRuleConfigSchema("mcc_verification")).toBeNull();
  });

  it("reads values with type coercion and opt-out boolean default", () => {
    const schema = getRuleConfigSchema("landscape_orientation")!;
    // missing flag reads as true (rules opt out, not in)
    expect(readRuleConfigValues(schema, {})).toEqual({ required: true });
    expect(readRuleConfigValues(schema, { required: false })).toEqual({ required: false });
  });

  it("reads a string-list, trimming and dropping blanks", () => {
    const schema = getRuleConfigSchema("allowed_extensions")!;
    const values = readRuleConfigValues(schema, { extensions: [" pdf ", "", "docx"] });
    expect(values.extensions).toEqual(["pdf", "docx"]);
  });

  it("preserves config keys the schema does not name", () => {
    const schema = getRuleConfigSchema("required_sections")!;
    const existing = {
      sections: ["Intro"],
      source: "knowledge_library",
      source_category: "si_content_sop",
    };
    const result = applyRuleConfigValues(schema, existing, { sections: ["Intro", "Calibration"] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.source).toBe("knowledge_library");
      expect(result.config.source_category).toBe("si_content_sop");
      expect(result.config.sections).toEqual(["Intro", "Calibration"]);
    }
  });

  it("dedupes string-list values on save", () => {
    const schema = getRuleConfigSchema("allowed_extensions")!;
    const result = applyRuleConfigValues(schema, {}, { extensions: ["pdf", "pdf", "docx"] });
    expect(result.ok && result.config.extensions).toEqual(["pdf", "docx"]);
  });

  it("serializes a blank nullable string to null", () => {
    const schema = getRuleConfigSchema("naming_convention")!;
    const result = applyRuleConfigValues(schema, { pattern: "old" }, { pattern: "  " });
    expect(result.ok && result.config.pattern).toBeNull();
  });

  it("rejects out-of-range numbers", () => {
    const schema = getRuleConfigSchema("max_file_size_mb")!;
    const tooBig = applyRuleConfigValues(schema, {}, { max_mb: 9000 });
    expect(tooBig.ok).toBe(false);
    const ok = applyRuleConfigValues(schema, {}, { max_mb: 25 });
    expect(ok.ok).toBe(true);
  });
});
