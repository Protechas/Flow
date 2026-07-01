import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => undefined,
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock("@/lib/supabase/client", () => ({ isSupabaseConfigured: () => false }));

describe("demo session contract", () => {
  it("getCurrentUser returns null without demo cookie (no implicit fallback user)", async () => {
    const { getCurrentUser } = await import("@/lib/auth/session");
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });
});
