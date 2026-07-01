import { describe, expect, it } from "vitest";
import { authRedirectPath } from "@/lib/supabase/auth-redirect";

describe("authRedirectPath", () => {
  it("defaults to /", () => {
    expect(authRedirectPath(null)).toBe("/");
    expect(authRedirectPath(undefined)).toBe("/");
    expect(authRedirectPath("")).toBe("/");
  });

  it("allows safe in-app paths", () => {
    expect(authRedirectPath("/work")).toBe("/work");
    expect(authRedirectPath("/auth/reset-password")).toBe("/auth/reset-password");
  });

  it("blocks protocol-relative and external paths", () => {
    expect(authRedirectPath("//evil.com")).toBe("/");
    expect(authRedirectPath("https://evil.com")).toBe("/");
  });
});

describe("buildAuthEmailRedirect", () => {
  it("builds confirm URL with encoded next path", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://flowproduction.space";
    const { buildAuthEmailRedirect } = await import("@/lib/supabase/auth-redirect");
    const url = buildAuthEmailRedirect("/auth/reset-password");
    expect(url).toContain("/auth/confirm?next=");
    expect(url).toContain(encodeURIComponent("/auth/reset-password"));
  });
});
