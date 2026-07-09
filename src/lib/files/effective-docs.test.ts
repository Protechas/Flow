import { describe, expect, it } from "vitest";
import {
  analyzeInflation,
  documentKey,
  effectiveDocumentCount,
} from "@/lib/files/effective-docs";

const f = (file_name: string, file_size = 1000) => ({ file_name, file_size });

describe("effective document counting", () => {
  it("collapses explicit -Part-N splits into one document", () => {
    const files = [
      f("2021 Chevrolet Silverado 2500 (SCI)-Part-1.pdf", 780),
      f("2021 Chevrolet Silverado 2500 (SCI)-Part-2.pdf", 225),
      f("2021 Chevrolet Silverado 2500 (SCI)-Part-19.pdf", 872),
      f("2021 Chevrolet Silverado 2500 (SCI) part 3.pdf", 146),
      f("Manual 2 of 3.pdf", 500),
      f("Manual 1 of 3.pdf", 400),
    ];
    expect(effectiveDocumentCount(files)).toBe(2); // Silverado SCI + Manual
  });

  it("counts exact duplicate re-uploads once", () => {
    const files = [
      f("2021 Chevrolet Aveo (SBI).pdf", 337_000),
      f("2021 Chevrolet Aveo (SBI).pdf", 337_000),
      f("2021 Chevrolet Aveo (SBI).pdf", 337_000),
      f("2021 chevrolet aveo (sbi).PDF", 337_000), // case-insensitive
    ];
    expect(effectiveDocumentCount(files)).toBe(1);
  });

  it("never collapses legitimate distinct documents", () => {
    const files = [
      f("2021 Chevrolet Silverado 1500 (SCI).pdf", 100),
      f("2021 Chevrolet Silverado 2500 (SCI).pdf", 200), // trailing digits = model, kept
      f("2021 Chevrolet Silverado 2500 (SBI).pdf", 300), // different system, kept
      f("2021 Chevrolet Aveo (OCS).pdf", 400),
      f("2021 Chevrolet Aveo (OCS) v2.pdf", 400), // not a split marker, kept
    ];
    expect(effectiveDocumentCount(files)).toBe(5);
  });

  it("same name at a different size is a revision, not a duplicate", () => {
    const files = [
      f("2021 Chevrolet Blazer (SRR).pdf", 290_000),
      f("2021 Chevrolet Blazer (SRR).pdf", 310_000),
    ];
    // different bytes → not an exact duplicate; same document key → one doc
    expect(effectiveDocumentCount(files)).toBe(1);
  });

  it("documentKey strips copy suffixes but keeps system tags", () => {
    expect(documentKey("2021 Aveo (SBI).pdf")).toBe("2021 aveo (sbi)");
    expect(documentKey("2021 Aveo (SBI) (2).pdf")).toBe("2021 aveo (sbi)");
    expect(documentKey("Report pt 4.pdf")).toBe("report");
  });

  it("analyzeInflation reports duplicates and split parts separately", () => {
    const files = [
      f("Doc-Part-1.pdf", 100),
      f("Doc-Part-2.pdf", 200),
      f("Doc-Part-2.pdf", 200), // exact duplicate of a part
      f("Other.pdf", 300),
    ];
    const a = analyzeInflation(files);
    expect(a.raw).toBe(4);
    expect(a.duplicateCopies).toBe(1);
    expect(a.splitParts).toBe(1); // Part-1 + Part-2 → 1 doc
    expect(a.effective).toBe(2); // Doc + Other
  });
});
