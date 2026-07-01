import { describe, expect, it } from "vitest";
import { formatSignupError } from "@/lib/auth/signup-errors";

describe("formatSignupError", () => {
  it("maps duplicate email", () => {
    expect(formatSignupError("User already registered", "user_already_exists")).toContain(
      "already exists"
    );
  });

  it("maps rate limit", () => {
    expect(formatSignupError("Email rate limit exceeded", "over_email_send_rate_limit")).toContain(
      "Too many signup emails"
    );
  });

  it("maps database profile failure", () => {
    expect(formatSignupError("Database error saving new user")).toContain("administrator");
  });

  it("maps disabled signup", () => {
    expect(formatSignupError("Signups are disabled for this project")).toContain("disabled");
  });

  it("returns trimmed message for unknown errors", () => {
    expect(formatSignupError("  Custom server message  ")).toBe("Custom server message");
  });
});
