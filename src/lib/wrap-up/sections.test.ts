import { describe, expect, it } from "vitest";
import { sanitizeWrapUpSections } from "./sections";

const FIELDS = [
  { id: "next_action", label: "Next planned action" },
  { id: "eta", label: "Estimated completion or remaining time" },
];

describe("sanitizeWrapUpSections", () => {
  it("keeps only answers for fields the team defines", () => {
    const out = sanitizeWrapUpSections(
      { next_action: "Finish regression suite", rogue_key: "injected" },
      FIELDS
    );
    expect(out).toEqual({ next_action: "Finish regression suite" });
  });

  it("trims, drops empties, and returns null when nothing remains", () => {
    expect(sanitizeWrapUpSections({ next_action: "   " }, FIELDS)).toBeNull();
    expect(sanitizeWrapUpSections(undefined, FIELDS)).toBeNull();
    expect(sanitizeWrapUpSections({ eta: " Friday " }, FIELDS)).toEqual({ eta: "Friday" });
  });

  it("returns null for teams with no extra fields (SI unchanged)", () => {
    expect(sanitizeWrapUpSections({ next_action: "x" }, [])).toBeNull();
  });

  it("caps oversized answers", () => {
    const out = sanitizeWrapUpSections({ eta: "x".repeat(9000) }, FIELDS);
    expect(out?.eta.length).toBe(4000);
  });
});
