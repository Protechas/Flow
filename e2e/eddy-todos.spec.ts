import { expect, test } from "@playwright/test";
import { DEMO_USERS, demoLogin } from "./helpers/demo-auth";

const runAi = process.env.RUN_AI_E2E === "1";

async function openEddyList(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /Ask Eddy/i }).click();
  await page.getByRole("button", { name: /^My List$/ }).click();
}

test.describe("Eddy to-do list", () => {
  test("panel add / complete round-trip", async ({ page }) => {
    await demoLogin(page, DEMO_USERS.employee);
    await openEddyList(page);

    const input = page.getByPlaceholder("Add an item…");
    await expect(input).toBeVisible();
    await input.fill("Re-scan the Lexus batch");
    await page.getByRole("button", { name: "Add to-do" }).click();
    await expect(page.getByText("Re-scan the Lexus batch")).toBeVisible();

    // Controlled checkbox: completing removes the row rather than checking it.
    await page
      .getByRole("checkbox", { name: /Mark "Re-scan the Lexus batch" done/ })
      .click();
    await expect(page.getByText("Re-scan the Lexus batch")).toHaveCount(0);
  });

  test("chat 'add to my list' lands on the list", async ({ page }) => {
    test.skip(!runAi, "Set RUN_AI_E2E=1 to run the live-AI tool-call test");
    test.setTimeout(120_000);

    await demoLogin(page, DEMO_USERS.employee);
    await page.getByRole("button", { name: /Ask Eddy/i }).click();

    const input = page.getByPlaceholder(/How do I…\?|Reply…/);
    await input.fill("Add 'follow up with Tara about the Lincoln corrections' to my list");
    await page.getByRole("button", { name: /Send to Eddy/i }).click();

    // Wait for Eddy's assistant reply bubble (right-side thinking spinner gone).
    await expect(page.getByText(/is thinking/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/is thinking/i)).toHaveCount(0, { timeout: 90_000 });
    console.log(
      "[eddy reply]",
      await page.locator(".mr-8").last().textContent()
    );

    await page.getByRole("button", { name: /^My List$/ }).click();
    await expect(page.getByText(/follow up with Tara/i)).toBeVisible({ timeout: 10_000 });
  });
});
