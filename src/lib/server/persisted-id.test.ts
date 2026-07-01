import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  assertPersistedUuid,
  isPersistedUuid,
  newPersistedId,
  persistedUuidOrNull,
} from "./persisted-id";

describe("persisted-id", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("accepts valid UUID v4", () => {
    expect(isPersistedUuid("75cbdc3d-0d5c-4fec-8cba-472e6ef6bff4")).toBe(true);
  });

  it("rejects demo clock ids", () => {
    expect(isPersistedUuid("clk-1782838525506-abc12")).toBe(false);
  });

  it("rejects mock department ids", () => {
    expect(isPersistedUuid("dept-service-info")).toBe(false);
  });

  it("uses UUID ids when Supabase is configured", async () => {
    vi.doMock("@/lib/supabase/client", () => ({ isSupabaseConfigured: () => true }));
    const mod = await import("./persisted-id");
    expect(mod.isPersistedUuid(mod.newPersistedId("clk"))).toBe(true);
  });

  it("uses readable ids in demo mode", async () => {
    vi.doMock("@/lib/supabase/client", () => ({ isSupabaseConfigured: () => false }));
    const mod = await import("./persisted-id");
    const id = mod.newPersistedId("clk");
    expect(id.startsWith("clk-")).toBe(true);
    expect(mod.isPersistedUuid(id)).toBe(false);
  });

  it("assertPersistedUuid throws for demo ids", () => {
    expect(() => assertPersistedUuid("clk-1", "time_clock_entries.id")).toThrow(
      /PERSIST_ID_INVALID/
    );
  });

  it("persistedUuidOrNull drops mock refs", () => {
    expect(persistedUuidOrNull("dept-service-info")).toBeNull();
    expect(persistedUuidOrNull("75cbdc3d-0d5c-4fec-8cba-472e6ef6bff4")).toBe(
      "75cbdc3d-0d5c-4fec-8cba-472e6ef6bff4"
    );
  });
});
