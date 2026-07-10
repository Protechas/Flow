import { describe, expect, it } from "vitest";
import { diffBlocks } from "./document-revisions";

const doc = (blocks: string[]) => blocks.join("");

describe("diffBlocks", () => {
  it("returns nothing when content is unchanged", () => {
    const html = doc(["<h1>SOP</h1>", "<p>Step one.</p>", "<p>Step two.</p>"]);
    expect(diffBlocks(html, html)).toEqual([]);
  });

  it("detects an added block", () => {
    const prev = doc(["<h1>SOP</h1>", "<p>Step one.</p>"]);
    const next = doc(["<h1>SOP</h1>", "<p>Step one.</p>", "<p>Step two.</p>"]);
    const changes = diffBlocks(prev, next);
    expect(changes).toEqual([
      { type: "added", html: "<p>Step two.</p>", prev_html: "" },
    ]);
  });

  it("detects a removed block", () => {
    const prev = doc(["<h1>SOP</h1>", "<p>Old rule.</p>", "<p>Step two.</p>"]);
    const next = doc(["<h1>SOP</h1>", "<p>Step two.</p>"]);
    const changes = diffBlocks(prev, next);
    expect(changes).toEqual([
      { type: "removed", html: "", prev_html: "<p>Old rule.</p>" },
    ]);
  });

  it("pairs an edit into a single changed block", () => {
    const prev = doc(["<h1>SOP</h1>", "<p>Email results to the lead.</p>", "<p>Done.</p>"]);
    const next = doc(["<h1>SOP</h1>", "<p>Log results in Flow.</p>", "<p>Done.</p>"]);
    const changes = diffBlocks(prev, next);
    expect(changes).toEqual([
      {
        type: "changed",
        html: "<p>Log results in Flow.</p>",
        prev_html: "<p>Email results to the lead.</p>",
      },
    ]);
  });

  it("ignores formatting-only differences in matching", () => {
    const prev = doc(["<p>Verify the  part number.</p>"]);
    const next = doc(["<p>Verify the <strong>part number</strong>.</p>"]);
    // Same normalized text → treated as the same block, no change reported.
    expect(diffBlocks(prev, next)).toEqual([]);
  });

  it("handles tables and headings as blocks", () => {
    const prev = doc(["<h2>Limits</h2>", "<table><tr><td>10</td></tr></table>"]);
    const next = doc(["<h2>Limits</h2>", "<table><tr><td>25</td></tr></table>"]);
    const changes = diffBlocks(prev, next);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe("changed");
    expect(changes[0].html).toContain("25");
    expect(changes[0].prev_html).toContain("10");
  });

  it("survives a full rewrite without exploding", () => {
    const prev = doc(Array.from({ length: 100 }, (_, i) => `<p>Old step ${i}.</p>`));
    const next = doc(Array.from({ length: 100 }, (_, i) => `<p>New step ${i}.</p>`));
    const changes = diffBlocks(prev, next);
    expect(changes.length).toBeLessThanOrEqual(60);
    expect(changes.every((c) => c.type === "changed")).toBe(true);
  });
});
