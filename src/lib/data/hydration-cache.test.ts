import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HYDRATION_TTL_MS,
  invalidateHydration,
  isHydrationFresh,
  markHydrated,
} from "./hydration-cache";

describe("hydration-cache", () => {
  afterEach(() => {
    invalidateHydration();
    vi.restoreAllMocks();
  });

  it("is stale before anything is marked", () => {
    expect(isHydrationFresh("projects")).toBe(false);
  });

  it("is fresh after a mark, per key", () => {
    markHydrated("projects");
    expect(isHydrationFresh("projects")).toBe(true);
    expect(isHydrationFresh("time-logs")).toBe(false);
  });

  it("expires after the TTL", () => {
    const start = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(start);
    markHydrated("projects");
    expect(isHydrationFresh("projects")).toBe(true);

    vi.spyOn(Date, "now").mockReturnValue(start + HYDRATION_TTL_MS - 1);
    expect(isHydrationFresh("projects")).toBe(true);

    vi.spyOn(Date, "now").mockReturnValue(start + HYDRATION_TTL_MS);
    expect(isHydrationFresh("projects")).toBe(false);
  });

  it("invalidates one key without touching others", () => {
    markHydrated("projects");
    markHydrated("time-logs");
    invalidateHydration("projects");
    expect(isHydrationFresh("projects")).toBe(false);
    expect(isHydrationFresh("time-logs")).toBe(true);
  });

  it("invalidates everything with no key", () => {
    markHydrated("projects");
    markHydrated("time-logs");
    invalidateHydration();
    expect(isHydrationFresh("projects")).toBe(false);
    expect(isHydrationFresh("time-logs")).toBe(false);
  });
});
