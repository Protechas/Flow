import { describe, expect, it } from "vitest";
import {
  getAllowedCreationModes,
  usesManagerWorkHub,
} from "@/lib/work-creation/permissions";

describe("work-creation permissions", () => {
  it("gives teamlead board and task modes", () => {
    const modes = getAllowedCreationModes("teamlead");
    expect(modes).toContain("board");
    expect(modes).toContain("task");
    expect(modes).toContain("project");
  });

  it("uses manager work hub for teamlead and manager", () => {
    expect(usesManagerWorkHub("teamlead")).toBe(true);
    expect(usesManagerWorkHub("manager")).toBe(true);
    expect(usesManagerWorkHub("admin")).toBe(true);
  });

  it("does not use hub for employee without board access", () => {
    expect(usesManagerWorkHub("employee")).toBe(false);
  });

  it("does not grant task mode to standard employees", () => {
    const modes = getAllowedCreationModes("employee");
    expect(modes).not.toContain("task");
    expect(modes).not.toContain("board");
  });
});
