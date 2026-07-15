import { describe, expect, it } from "vitest";
import {
  analyzeModelCoverage,
  classifyHighlightColor,
  documentBaseName,
  parseDocumentName,
  runContentChecks,
  runContentChecksOnSet,
  type ExtractedDoc,
} from "./engine";
import { DEFAULT_CONTENT_RULES } from "./rules";

function doc(overrides: Partial<ExtractedDoc>): ExtractedDoc {
  return {
    fileName: "2025 Toyota 4Runner (FRS).pdf",
    fileSizeBytes: 500 * 1024,
    numPages: 10,
    landscapePages: 10,
    text: "2025 Toyota 4Runner front radar sensor calibration. Please ensure the fuel tank is full.",
    hasTextLayer: true,
    highlights: [
      { page: 1, colorGroup: "yellow" },
      { page: 2, colorGroup: "blue" },
    ],
    ...overrides,
  };
}

describe("parseDocumentName", () => {
  it("parses the SOP grammar", () => {
    expect(parseDocumentName("2020 Chevrolet Silverado 1500 (FRS).pdf")).toEqual({
      year: 2020,
      makeModel: "Chevrolet Silverado 1500",
      evNomenclature: null,
      component: "FRS",
      partNumber: null,
    });
    expect(parseDocumentName("2025 Toyota Prius [HEV] (FRS).pdf")).toMatchObject({
      evNomenclature: "HEV",
      component: "FRS",
    });
    expect(parseDocumentName("2025 Toyota 4Runner (ACC 2)-part-10.pdf")).toMatchObject({
      component: "ACC 2",
      partNumber: 10,
    });
    expect(parseDocumentName("random-file.pdf")).toBeNull();
  });
});

describe("runContentChecks", () => {
  it("passes a compliant document", () => {
    const r = runContentChecks(doc({}), DEFAULT_CONTENT_RULES);
    expect(r.verdict).toBe("pass");
    expect(r.flags).toHaveLength(0);
  });

  it("fails oversize files with the split instruction", () => {
    const r = runContentChecks(doc({ fileSizeBytes: 2000 * 1024 }), DEFAULT_CONTENT_RULES);
    expect(r.flags.some((f) => f.code === "oversize" && f.severity === "fail")).toBe(true);
  });

  it("fails all-portrait documents", () => {
    const r = runContentChecks(doc({ landscapePages: 0 }), DEFAULT_CONTENT_RULES);
    expect(r.flags.some((f) => f.code === "orientation" && f.severity === "fail")).toBe(true);
  });

  it("catches the wrong document under the right name", () => {
    const r = runContentChecks(
      doc({ text: "2024 Honda Civic windshield camera aiming procedure follows." }),
      DEFAULT_CONTENT_RULES
    );
    expect(r.flags.some((f) => f.code === "identity_mismatch" && f.severity === "fail")).toBe(true);
  });

  it("flags missing yellow highlight harder when pre-quals are mentioned", () => {
    const r = runContentChecks(doc({ highlights: [] }), DEFAULT_CONTENT_RULES);
    const yellow = r.flags.find((f) => f.code === "no_yellow_highlight");
    expect(yellow?.severity).toBe("fail"); // text mentions fuel tank
  });

  it("flags bad naming grammar and make shorthand", () => {
    const bad = runContentChecks(doc({ fileName: "silverado-frs-final.pdf" }), DEFAULT_CONTENT_RULES);
    expect(bad.flags.some((f) => f.code === "naming_grammar")).toBe(true);

    const shorthand = runContentChecks(
      doc({ fileName: "2024 Chevy Silverado 1500 (FRS).pdf", text: "chevy silverado 1500 radar 2024" }),
      DEFAULT_CONTENT_RULES
    );
    expect(shorthand.flags.some((f) => f.code === "make_shorthand" && f.severity === "fail")).toBe(true);
  });

  it("treats unreadable and placeholder docs gently", () => {
    const unreadable = runContentChecks(doc({ numPages: 0 }), DEFAULT_CONTENT_RULES);
    expect(unreadable.verdict).toBe("unreadable");

    const placeholder = runContentChecks(
      doc({
        fileName: "2025 Toyota 4Runner (NV) Placeholder.pdf",
        text: "Place Holder — this system is not offered on this vehicle.",
        highlights: [],
      }),
      DEFAULT_CONTENT_RULES
    );
    // Placeholders skip identity and highlight rules.
    expect(placeholder.flags.some((f) => f.code === "identity_mismatch")).toBe(false);
    expect(placeholder.flags.some((f) => f.code === "no_yellow_highlight")).toBe(false);
  });
});

describe("runContentChecksOnSet — logical documents", () => {
  it("judges split parts as one document (header and highlights live in Part-1)", () => {
    const parts: ExtractedDoc[] = [
      doc({
        fileName: "2025 Lexus RC F (AEB 2)-Part-1.pdf",
        text: "2025 Lexus RC F pre-collision system. Please ensure the fuel tank is full.",
        highlights: [
          { page: 1, colorGroup: "yellow" },
          { page: 2, colorGroup: "blue" },
        ],
      }),
      doc({
        fileName: "2025 Lexus RC F (AEB 2)-Part-2.pdf",
        text: "Continue the aiming procedure per the display on the GTS.",
        highlights: [],
      }),
    ];
    const [g] = runContentChecksOnSet(parts, DEFAULT_CONTENT_RULES);
    expect(g.partFiles).toHaveLength(2);
    expect(g.result.verdict).toBe("pass");
  });

  it("reports gaps in the part sequence", () => {
    const parts: ExtractedDoc[] = [
      doc({ fileName: "2025 Toyota 4Runner (FRS)-Part-1.pdf" }),
      doc({ fileName: "2025 Toyota 4Runner (FRS)-Part-3.pdf", highlights: [] }),
    ];
    const [g] = runContentChecksOnSet(parts, DEFAULT_CONTENT_RULES);
    expect(g.result.flags.some((f) => f.code === "missing_parts")).toBe(true);
  });

  it("treats a lone continuation part gently", () => {
    const [g] = runContentChecksOnSet(
      [doc({ fileName: "2025 Lexus RC F (AEB 2)-Part-4.pdf", text: "aiming continues", highlights: [] })],
      DEFAULT_CONTENT_RULES
    );
    expect(g.result.flags.some((f) => f.code === "identity_mismatch")).toBe(false);
    expect(g.result.flags.some((f) => f.code === "solo_continuation")).toBe(true);
    expect(g.result.verdict).toBe("pass");
  });

  it("attributes per-part structural failures to the offending part", () => {
    const parts: ExtractedDoc[] = [
      doc({ fileName: "2025 Toyota 4Runner (FRS)-Part-1.pdf" }),
      doc({ fileName: "2025 Toyota 4Runner (FRS)-Part-2.pdf", fileSizeBytes: 2000 * 1024, highlights: [] }),
    ];
    const [g] = runContentChecksOnSet(parts, DEFAULT_CONTENT_RULES);
    const oversize = g.result.flags.find((f) => f.code === "oversize");
    expect(oversize?.message).toContain("Part-2");
  });

  it("documentBaseName strips split suffixes only", () => {
    expect(documentBaseName("2025 Lexus RC F (AEB 2)-Part-3.pdf")).toBe("2025 Lexus RC F (AEB 2)");
    expect(documentBaseName("2020 Chevrolet Silverado 1500 (FRS).pdf")).toBe(
      "2020 Chevrolet Silverado 1500 (FRS)"
    );
  });
});

describe("analyzeModelCoverage — the 8-docs-per-model rule", () => {
  const mk = (name: string) =>
    doc({ fileName: name, text: "matching content 2022 chevrolet silverado 1500" });

  it("grades a model's component set, mapping legacy features to components", () => {
    const files = [
      "2022 Chevrolet Silverado 1500 (ACC 2).pdf", // legacy → FRS
      "2022 Chevrolet Silverado 1500 (LKA 1).pdf", // legacy → WSC
      "2022 Chevrolet Silverado 1500 (APA 1).pdf", // legacy → PDS
      "2022 Chevrolet Silverado 1500 (BUC).pdf",
      "2022 Chevrolet Silverado 1500 (SVC 1).pdf",
      "2022 Chevrolet Silverado 1500 (BSW 1).pdf", // legacy → RRS
    ].map(mk);
    const grouped = runContentChecksOnSet(files, DEFAULT_CONTENT_RULES);
    const [model] = analyzeModelCoverage(grouped, DEFAULT_CONTENT_RULES);
    expect(model.modelLabel).toBe("2022 Chevrolet Silverado 1500");
    expect(Object.keys(model.componentsPresent).sort()).toEqual(
      ["BUC", "FRS", "PDS", "RRS", "SVC", "WSC"]
    );
    expect(model.missingComponents).toEqual(["NV"]);
  });

  it("Honda models additionally require LW", () => {
    const grouped = runContentChecksOnSet(
      [mk("2024 Honda Civic (FRS).pdf")],
      DEFAULT_CONTENT_RULES
    );
    const [model] = analyzeModelCoverage(grouped, DEFAULT_CONTENT_RULES);
    expect(model.missingComponents).toContain("LW");
  });

  it("special functions count as extras, never against the model", () => {
    const grouped = runContentChecksOnSet(
      [mk("2022 Chevrolet Silverado 1500 (SCI).pdf")],
      DEFAULT_CONTENT_RULES
    );
    const [model] = analyzeModelCoverage(grouped, DEFAULT_CONTENT_RULES);
    expect(model.extraDocs).toHaveLength(1);
    expect(model.missingComponents).toHaveLength(7);
  });
});

describe("classifyHighlightColor", () => {
  it("recognizes Adobe yellow and light blue in both scales", () => {
    expect(classifyHighlightColor([255, 255, 0])).toBe("yellow");
    expect(classifyHighlightColor([1, 0.9, 0.2])).toBe("yellow");
    expect(classifyHighlightColor([115, 210, 255])).toBe("blue");
    expect(classifyHighlightColor([0.3, 0.7, 1])).toBe("blue");
    expect(classifyHighlightColor([255, 0, 0])).toBe("other");
    expect(classifyHighlightColor(null)).toBe("other");
  });
});
