import { describe, expect, it } from "vitest";
import { formatActionError } from "@/lib/errors/action-messages";

describe("formatActionError", () => {
  it("maps FORBIDDEN to friendly copy", () => {
    expect(formatActionError(new Error("FORBIDDEN"))).toBe(
      "You don't have permission to perform this action."
    );
  });

  it("maps WRAP_UP_REQUIRED", () => {
    expect(formatActionError("WRAP_UP_REQUIRED")).toBe(
      "Submit your end-of-day wrap-up before clocking out."
    );
  });

  it("maps ACTIVE_TASK prefix", () => {
    expect(formatActionError(new Error("ACTIVE_TASK:task-123"))).toBe(
      "Finish your current active task before starting another."
    );
  });

  it("maps transient 'Bad Request' to retry guidance", () => {
    const msg = formatActionError(new Error("Bad Request"));
    expect(msg).toMatch(/refresh the page and drop the file again/i);
    expect(msg).toMatch(/don't re-add files that already landed/i);
  });

  it("maps account setup incomplete message", () => {
    expect(
      formatActionError(
        new Error(
          "Your account setup is not complete. Ask your manager to assign your department, team, and supervisor in Settings → Users."
        )
      )
    ).toContain("account setup is not complete");
  });

  it("maps service role persistence errors", () => {
    expect(
      formatActionError(
        new Error(
          "Production data could not save. Set SUPABASE_SERVICE_ROLE_KEY in production environment variables."
        )
      )
    ).toBe("Your change could not be saved. Contact an administrator — server persistence is not configured.");
  });

  it("returns short raw messages as-is", () => {
    expect(formatActionError(new Error("Already clocked in"))).toBe(
      "You are already clocked in for this shift."
    );
  });

  it("maps persist id validation errors", () => {
    expect(
      formatActionError(new Error("PERSIST_ID_INVALID: time_clock_entries.id must be a UUID"))
    ).toBe("Your change could not be saved because of invalid record IDs. Contact an administrator.");
  });

  it("truncates very long unknown errors", () => {
    const long = "x".repeat(200);
    expect(formatActionError(new Error(long))).toBe("Something went wrong. Please try again.");
  });
});
