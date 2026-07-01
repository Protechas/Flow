import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { isSelfSignupAllowed } from "@/lib/auth/signup-policy";

describe("signup policy", () => {
  const prevPublic = process.env.NEXT_PUBLIC_ALLOW_SELF_SIGNUP;
  const prevServer = process.env.ALLOW_SELF_SIGNUP;

  afterEach(() => {
    process.env.NEXT_PUBLIC_ALLOW_SELF_SIGNUP = prevPublic;
    process.env.ALLOW_SELF_SIGNUP = prevServer;
  });

  it("defaults self signup to disabled", () => {
    delete process.env.NEXT_PUBLIC_ALLOW_SELF_SIGNUP;
    delete process.env.ALLOW_SELF_SIGNUP;
    expect(isSelfSignupAllowed()).toBe(false);
  });

  it("enables when NEXT_PUBLIC_ALLOW_SELF_SIGNUP=true", () => {
    process.env.NEXT_PUBLIC_ALLOW_SELF_SIGNUP = "true";
    expect(isSelfSignupAllowed()).toBe(true);
  });
});
