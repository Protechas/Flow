import { expect, test } from "@playwright/test";
import { DEMO_USERS, demoLogin } from "./helpers/demo-auth";

/** Oversized files get a clear client-side message instead of the raw
 * "Bad Request" the framework body limit used to produce. */
test("dropping an oversized file shows a friendly size error", async ({ page }) => {
  await demoLogin(page, DEMO_USERS.manager);
  // Deep link straight to a known demo task's detail (wp-1 = first seed).
  await page.goto("/operations?package=wp-1");
  await expect(page.getByText("Drop completed files here").first()).toBeVisible({
    timeout: 30_000,
  });

  // Limit label rendered from config (4 MB on Vercel, 10 MB locally).
  await expect(page.getByText(/Max \d+(\.\d)? MB per file/i).first()).toBeVisible();

  // 11 MB fake PDF — over the cap in every environment; the client gate must
  // reject it without any server round-trip.
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "2026 Toyota Camry (FRS).pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(11 * 1024 * 1024, 1),
  });

  await expect(page.getByText(/is 11\.0 MB — the upload limit is/i).first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    page.getByText(/Split the document into "-Part-N" files/i).first()
  ).toBeVisible();
});
