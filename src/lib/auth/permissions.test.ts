import { describe, expect, it } from "vitest";
import { canAccessRoute } from "@/lib/auth/permissions";

describe("canAccessRoute", () => {
  it("allows senior_manager on /people", () => {
    expect(canAccessRoute("senior_manager", "/people")).toBe(true);
  });

  it("allows super_admin on /qa-center", () => {
    expect(canAccessRoute("super_admin", "/qa-center")).toBe(true);
  });

  it("allows teamlead on /project-health", () => {
    expect(canAccessRoute("teamlead", "/project-health")).toBe(true);
  });

  it("blocks employee on /settings", () => {
    expect(canAccessRoute("employee", "/settings")).toBe(false);
  });

  it("allows admin on /settings/help-flags", () => {
    expect(canAccessRoute("admin", "/settings/help-flags")).toBe(true);
  });
});
