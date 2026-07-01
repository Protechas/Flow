import { describe, expect, it } from "vitest";
import { canAccessRoute } from "@/lib/auth/permissions";

const CRITICAL_ROUTES = [
  { role: "admin", path: "/settings", allowed: true },
  { role: "admin", path: "/system-health", allowed: true },
  { role: "admin", path: "/projects", allowed: true },
  { role: "manager", path: "/operations", allowed: true },
  { role: "manager", path: "/settings", allowed: true },
  { role: "teamlead", path: "/operations", allowed: true },
  { role: "teamlead", path: "/settings", allowed: true },
  { role: "employee", path: "/work", allowed: true },
  { role: "employee", path: "/time-clock", allowed: false },
  { role: "employee", path: "/settings", allowed: false },
  { role: "employee", path: "/system-health", allowed: false },
  { role: "employee", path: "/projects", allowed: false },
  { role: "employee", path: "/qa-center", allowed: false },
  { role: "viewer", path: "/executive", allowed: true },
  { role: "viewer", path: "/settings", allowed: false },
] as const;

describe("canAccessRoute critical paths", () => {
  for (const { role, path, allowed } of CRITICAL_ROUTES) {
    it(`${role} ${allowed ? "can" : "cannot"} access ${path}`, () => {
      expect(canAccessRoute(role, path)).toBe(allowed);
    });
  }
});

describe("canAccessRoute employee work subpaths", () => {
  it("allows /work/[id]", () => {
    expect(canAccessRoute("employee", "/work/task-123")).toBe(true);
  });

  it("allows own people profile deep link pattern", () => {
    expect(canAccessRoute("employee", "/people/user-1")).toBe(true);
  });
});
