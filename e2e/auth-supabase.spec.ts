import { test, expect } from "@playwright/test";

const supabaseReady =
  process.env.RUN_SUPABASE_E2E === "true" &&
  Boolean(process.env.E2E_SUPABASE_URL) &&
  Boolean(process.env.E2E_SUPABASE_ANON_KEY) &&
  Boolean(process.env.E2E_TEST_EMAIL) &&
  Boolean(process.env.E2E_TEST_PASSWORD);

test.describe("Supabase auth (staging)", () => {
  test.skip(!supabaseReady, "Set RUN_SUPABASE_E2E=true and E2E_* env vars for staging auth tests");

  test.use({
    baseURL: process.env.E2E_SUPABASE_SITE_URL ?? "https://flowproduction.space",
  });

  test("login page shows email form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("invalid login shows friendly error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("invalid@example.com");
    await page.getByLabel(/password/i).fill("wrong-password-123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/could not sign in|check your email/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("test user can log in and reach dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(work|operations|dashboard|executive|settings)/, {
      timeout: 25_000,
    });
  });

  test("auth confirm redirects without server error", async ({ page }) => {
    const response = await page.goto("/auth/confirm");
    expect(response?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("signup page loads when enabled", async ({ page }) => {
    await page.goto("/auth/signup");
    await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("forgot password page loads", async ({ page }) => {
    await page.goto("/auth/forgot-password");
    await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("reset password page loads", async ({ page }) => {
    await page.goto("/auth/reset-password");
    await expect(page.getByRole("heading", { name: /set your password/i })).toBeVisible({
      timeout: 15_000,
    });
  });
});
