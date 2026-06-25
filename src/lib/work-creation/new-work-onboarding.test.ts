import { describe, expect, it, vi } from "vitest";
import {
  dismissNewWorkOnboarding,
  isNewWorkOnboardingDismissed,
  newWorkOnboardingStorageKey,
} from "@/lib/work-creation/new-work-onboarding";

describe("new-work-onboarding", () => {
  it("builds a versioned per-user storage key", () => {
    expect(newWorkOnboardingStorageKey("user-abc")).toContain("user-abc");
    expect(newWorkOnboardingStorageKey("user-abc")).toContain("v1");
  });

  it("tracks dismissed state in storage", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };

    expect(isNewWorkOnboardingDismissed("u1", storage)).toBe(false);
    dismissNewWorkOnboarding("u1", storage);
    expect(isNewWorkOnboardingDismissed("u1", storage)).toBe(true);
  });

  it("treats missing storage as dismissed (SSR-safe)", () => {
    expect(isNewWorkOnboardingDismissed("u1", null)).toBe(true);
  });
});
