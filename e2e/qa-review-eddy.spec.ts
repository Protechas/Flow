import { expect, test } from "@playwright/test";
import { DEMO_USERS, demoLogin } from "./helpers/demo-auth";

/** QA Review Queue renders with the Eddy review section wired in (demo mode
 * has no content-review rows, so the section stays hidden — this guards
 * against render crashes and confirms the queue still works). */
test("review queue renders for a team lead", async ({ page }) => {
  await demoLogin(page, DEMO_USERS.teamLead);
  await page.goto("/qa-center/review");
  const dismiss = page.getByRole("button", { name: "Dismiss for now" });
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();

  await expect(
    page.getByRole("heading", { name: /review queue|qa review/i }).first()
  ).toBeVisible({ timeout: 20_000 });
  // Either queue items or an empty state — never a crash page.
  await expect(page.locator("text=/Application error|something went wrong/i")).toHaveCount(0);
});
