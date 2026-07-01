import { test, expect } from "@playwright/test";
import { DEMO_USERS, demoLogin } from "./helpers/demo-auth";

test("login page loads", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText(/demo mode/i)).toBeVisible({ timeout: 20_000 });
});

test("projects page requires auth", async ({ page }) => {
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/login/);
});

test("auth confirm redirects safely in demo mode", async ({ page }) => {
  await page.goto("/auth/confirm");
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
});

test("reset password page loads in demo mode", async ({ page }) => {
  await page.goto("/auth/reset-password");
  await expect(page.getByText(/wrong environment|set your password/i)).toBeVisible({
    timeout: 20_000,
  });
});

test("forgot password redirects to login in demo mode", async ({ page }) => {
  await page.goto("/auth/forgot-password");
  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
});

test("demo login reaches work area", async ({ page }) => {
  await demoLogin(page, DEMO_USERS.employee);
  await expect(page).toHaveURL(/\/work/);
});
