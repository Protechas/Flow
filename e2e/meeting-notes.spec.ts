import { expect, test } from "@playwright/test";
import { DEMO_USERS, demoLogin } from "./helpers/demo-auth";

const runAi = process.env.RUN_AI_E2E === "1";

const TRANSCRIPT = `
Dusty: Ok quick sync. Two things. First, the Kia special functions backlog.
Manager A: Right — Employee A1 should take the 2026 Kia batch, about 40 files. He can have it done by Friday.
Dusty: Good, that's decided then, Employee A1 owns the Kia batch this week.
Manager A: Second thing — the QA checklist doc is stale. I'll rewrite it myself, high priority, no hard date.
Dusty: Ok. And we agreed the Email team stays out of production metrics — that's final.
Manager A: Agreed. That's everything.
`;

test.describe("Meeting Notes tool", () => {
  test("page renders with transcript form", async ({ page }) => {
    await demoLogin(page, DEMO_USERS.manager);
    await page.goto("/tools/meeting-notes");
    const dismiss = page.getByRole("button", { name: "Dismiss for now" });
    if (await dismiss.isVisible().catch(() => false)) await dismiss.click();

    await expect(page.getByPlaceholder(/Paste the Teams transcript/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /Digest with Eddy/i })).toBeDisabled();
  });

  test("digest → action items → approve creates tasks", async ({ page }) => {
    test.skip(!runAi, "Set RUN_AI_E2E=1 to run the live-AI digest test");
    test.setTimeout(180_000);

    await demoLogin(page, DEMO_USERS.manager);
    await page.goto("/tools/meeting-notes");

    const textarea = page.getByPlaceholder(/Paste the Teams transcript/i);
    await expect(textarea).toBeVisible({ timeout: 20_000 });
    await textarea.fill(TRANSCRIPT);

    // The demo critical-alert popup can swallow clicks — strip and retry.
    await expect(async () => {
      const dismiss = page.getByRole("button", { name: "Dismiss for now" });
      if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
      await page.getByRole("button", { name: /Digest with Eddy/i }).click();
      await expect(page.getByText(/is reading the meeting|Summary/i).first()).toBeVisible({
        timeout: 3_000,
      });
    }).toPass({ timeout: 30_000 });

    await expect(page.getByText(/Action items — approve to create tasks/i)).toBeVisible({
      timeout: 90_000,
    });

    // Pick a project and approve whatever Eddy drafted.
    await page.getByRole("combobox").filter({ hasText: /Project for these tasks/i }).click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: /Create \d+ task/ }).click();
    await expect(page.getByText(/Created \d+ of \d+ task/i)).toBeVisible({ timeout: 30_000 });
  });
});
