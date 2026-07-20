import { expect, test } from "@playwright/test";
import { DEMO_USERS, demoLogin } from "./helpers/demo-auth";

/**
 * End-to-end pass over the Eddy Task Builder: interview → draft preview →
 * approve → task exists. Makes a REAL Claude API call, so it only runs when
 * explicitly asked for (RUN_AI_E2E=1) and a key is configured.
 */
const runAi = process.env.RUN_AI_E2E === "1";

test.describe("Eddy Task Builder", () => {
  test("button appears for managers and opens the interview dialog", async ({ page }) => {
    await demoLogin(page, DEMO_USERS.manager);
    await page.goto("/projects");
    const dismiss = page.getByRole("button", { name: "Dismiss for now" });
    if (await dismiss.isVisible().catch(() => false)) await dismiss.click();

    const trigger = page.getByRole("button", { name: /Add with Eddy/i });
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByText(/Build work with Eddy/i)).toBeVisible();
    await expect(page.getByText(/What do you need to get done/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Send$/ })).toBeDisabled();
  });

  test("employees don't see the button", async ({ page }) => {
    await demoLogin(page, DEMO_USERS.employee);
    await page.goto("/projects");
    await expect(page.getByRole("button", { name: /Add with Eddy/i })).toHaveCount(0);
  });

  test("interview produces a draft and approve creates the task", async ({ page }) => {
    test.skip(!runAi, "Set RUN_AI_E2E=1 to run the live-AI interview test");
    test.setTimeout(180_000);

    await demoLogin(page, DEMO_USERS.manager);
    await page.goto("/projects");

    // Demo mode pops a critical-alert modal (on a delay) and a first-run
    // callout — both can swallow the first click. Dismiss, then retry until
    // the Eddy dialog is actually open.
    const input = page.getByPlaceholder(/name-edit files done by Friday/i);
    await expect(async () => {
      const dismiss = page.getByRole("button", { name: "Dismiss for now" });
      if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
      const tip = page.getByRole("button", { name: "Dismiss tip" });
      if (await tip.isVisible().catch(() => false)) await tip.click();
      await page.getByRole("button", { name: /Add with Eddy/i }).click();
      await expect(input).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 45_000 });
    await input.fill(
      "I need one task in the SF Phase 1 2026 project: 25 special-function files " +
        "for Toyota 2026, assigned to Employee A1, about 10 minutes per file, " +
        "QA required, files must be uploaded. Due next Friday. " +
        "If you have everything you need, produce the draft without further questions."
    );
    await page.getByRole("button", { name: /^Send$/ }).click();

    // Eddy may ask one clarifying question or draft immediately.
    const draftCard = page.getByText(/draft — will create/i);
    for (let i = 0; i < 3; i += 1) {
      try {
        await draftCard.waitFor({ timeout: 45_000 });
        break;
      } catch {
        const question = page.locator("text=/\\?/").last();
        if (!(await question.isVisible().catch(() => false))) throw new Error("No draft and no question");
        await page
          .getByPlaceholder(/name-edit files done by Friday|what to change/i)
          .fill("Use your best judgment for anything unclear and produce the draft now.");
        await page.getByRole("button", { name: /^Send$/ }).click();
      }
    }
    await expect(draftCard).toBeVisible();

    await page.getByRole("button", { name: /Approve & create/i }).click();
    await expect(page.getByText(/Created 1 task/i)).toBeVisible({ timeout: 30_000 });
  });
});
