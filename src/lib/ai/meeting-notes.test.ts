import { describe, expect, it } from "vitest";
import { parseMeetingDigest } from "./meeting-notes";

describe("parseMeetingDigest", () => {
  it("coerces a well-formed digest", () => {
    const digest = parseMeetingDigest({
      summary: "We discussed Q3 priorities.",
      decisions: ["ID3 gets its own operating model"],
      actionItems: [
        {
          title: "Set up ID3 operating model",
          detail: "Christopher to confirm tracking fields",
          suggestedAssignee: "Christopher",
          due: "2026-07-25",
          priority: "high",
        },
      ],
    });
    expect(digest.summary).toMatch(/Q3 priorities/);
    expect(digest.decisions).toHaveLength(1);
    expect(digest.actionItems[0]).toMatchObject({
      title: "Set up ID3 operating model",
      suggestedAssignee: "Christopher",
      due: "2026-07-25",
      priority: "high",
    });
  });

  it("drops invalid dates, bad priorities, and titleless items", () => {
    const digest = parseMeetingDigest({
      summary: "s",
      decisions: "not-an-array",
      actionItems: [
        { title: "Valid", due: "next Friday", priority: "mega" },
        { detail: "no title" },
        { title: "" },
      ],
    });
    expect(digest.decisions).toEqual([]);
    expect(digest.actionItems).toHaveLength(1);
    expect(digest.actionItems[0].due).toBeUndefined();
    expect(digest.actionItems[0].priority).toBe("medium");
  });

  it("caps runaway lists", () => {
    const digest = parseMeetingDigest({
      summary: "s",
      decisions: Array.from({ length: 50 }, (_, i) => `d${i}`),
      actionItems: Array.from({ length: 50 }, (_, i) => ({ title: `t${i}` })),
    });
    expect(digest.decisions.length).toBeLessThanOrEqual(12);
    expect(digest.actionItems.length).toBeLessThanOrEqual(20);
  });
});
