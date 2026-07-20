import { expect, test } from "@playwright/test";
import { DEMO_USERS, demoLogin } from "./helpers/demo-auth";

/**
 * Org chart team filter keeps a lead's reports visible — regression guard for
 * the team-inheritance fix (reports with unset team ids vanished on filter).
 */
test("team filter shows the team's lead and members", async ({ page }) => {
  await demoLogin(page, DEMO_USERS.admin);
  await page.goto("/org-chart");
  await expect(page.getByText(/Team Lead A1/i).first()).toBeVisible({ timeout: 20_000 });

  // The critical-alert modal pops on a delay and can swallow clicks —
  // dismiss and retry until the team filter is actually open.
  await expect(async () => {
    const dismiss = page.getByRole("button", { name: "Dismiss for now" });
    if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
    await page.getByRole("combobox").filter({ hasText: "All teams" }).click();
    await expect(
      page.getByRole("option", { name: /Manager A Branch/i })
    ).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 45_000 });
  await page.getByRole("option", { name: /Manager A Branch/i }).click();

  // Lead and their reports stay visible; other branches drop out.
  await expect(page.getByText(/Team Lead A1/i).first()).toBeVisible();
  await expect(page.getByText(/Employee A1/i).first()).toBeVisible();
  await expect(page.getByText(/Team Lead B1/i)).toHaveCount(0);
});
