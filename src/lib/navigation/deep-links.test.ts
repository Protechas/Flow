import { describe, expect, it } from "vitest";
import { operationsHref } from "@/lib/navigation/deep-links";

describe("operationsHref", () => {
  it("includes projectId and grouping for program drill-down", () => {
    const href = operationsHref({
      grouping: "by_program",
      projectId: "abc-123",
    });
    expect(href).toBe("/operations?grouping=by_program&projectId=abc-123");
  });

  it("omits default today grouping", () => {
    expect(operationsHref({ grouping: "today" })).toBe("/operations");
  });

  it("preserves ready_for_qa view with project filter", () => {
    const href = operationsHref({
      grouping: "by_program",
      projectId: "p1",
      view: "ready_for_qa",
    });
    expect(href).toContain("view=ready_for_qa");
    expect(href).toContain("projectId=p1");
  });
});

describe("projectHealthHref", () => {
  it("supports projectId deep link", async () => {
    const { projectHealthHref } = await import("@/lib/navigation/deep-links");
    expect(projectHealthHref({ projectId: "p-99" })).toBe("/project-health?projectId=p-99");
  });
});
