import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Demo user IDs from mock-data.ts */
export const DEMO_USERS = {
  admin: "user-admin",
  manager: "user-manager",
  teamLead: "user-tara",
  employee: "user-michael",
} as const;

const DEMO_USER_LABELS: Record<string, RegExp> = {
  "user-admin": /Dusty/i,
  "user-manager": /Manager A/i,
  "user-tara": /Team Lead A1/i,
  "user-michael": /Employee A1/i,
};

export async function demoLogin(page: Page, userId: string) {
  await page.goto("/login");
  await expect(page.getByText(/demo mode/i)).toBeVisible({ timeout: 20_000 });
  const label = DEMO_USER_LABELS[userId];
  if (!label) throw new Error(`Unknown demo user: ${userId}`);
  await page.getByRole("button", { name: label }).click();
  await page.waitForURL(/\/(work|dashboard|operations|settings|projects|executive)/, {
    timeout: 20_000,
  });
}

export async function demoLogout(page: Page) {
  const logout = page.getByTitle("Logout");
  await logout.click();
  await page.waitForURL(/\/login/, { timeout: 15_000 });
}
