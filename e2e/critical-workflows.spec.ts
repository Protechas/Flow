import { test, expect } from "@playwright/test";
import { DEMO_USERS, demoLogin, demoLogout } from "./helpers/demo-auth";

test.describe("Critical workflows (demo mode)", () => {
  test("admin can open system health and settings", async ({ page }) => {
    await demoLogin(page, DEMO_USERS.admin);
    await page.goto("/system-health");
    await expect(page.getByText(/production configuration|system health/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await page.goto("/settings/users");
    await expect(page).toHaveURL(/\/settings\/users/);
  });

  test("manager dashboard loads", async ({ page }) => {
    await demoLogin(page, DEMO_USERS.manager);
    await page.goto("/operations");
    await expect(page).toHaveURL(/\/operations/);
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/projects/);
  });

  test("team lead can open operations", async ({ page }) => {
    await demoLogin(page, DEMO_USERS.teamLead);
    await page.goto("/operations");
    await expect(page).toHaveURL(/\/operations/);
  });

  test("employee work dashboard loads", async ({ page }) => {
    await demoLogin(page, DEMO_USERS.employee);
    await page.goto("/work");
    await expect(page).toHaveURL(/\/work/);
    await expect(page.getByRole("button", { name: /clock in|continue work|request work/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("employee can clock in and state updates", async ({ page }) => {
    await demoLogin(page, DEMO_USERS.employee);
    await page.goto("/work");

    const clockIn = page.getByRole("button", { name: /clock in|back from lunch/i });
    if (await clockIn.isVisible().catch(() => false)) {
      await clockIn.click();
      await page.waitForTimeout(500);
      await page.reload();
      await expect(
        page.getByRole("button", { name: /clock out|lunch|continue work/i }).first()
      ).toBeVisible({ timeout: 15_000 });
    } else {
      await expect(
        page.getByRole("button", { name: /clock out|lunch|continue work/i }).first()
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test("employee cannot access admin settings", async ({ page }) => {
    await demoLogin(page, DEMO_USERS.employee);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/(unauthorized|login|work)/);
  });

  test("employee cannot access system health", async ({ page }) => {
    await demoLogin(page, DEMO_USERS.employee);
    await page.goto("/system-health");
    await expect(page).toHaveURL(/\/(unauthorized|login|work)/);
  });

  test("logout returns to login", async ({ page }) => {
    await demoLogin(page, DEMO_USERS.admin);
    await demoLogout(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test("project detail page loads for admin", async ({ page }) => {
    await demoLogin(page, DEMO_USERS.admin);
    await page.goto("/projects");
    const projectLink = page.locator('a[href^="/projects/"]').first();
    await expect(projectLink).toBeVisible({ timeout: 15_000 });
    const href = await projectLink.getAttribute("href");
    expect(href).toBeTruthy();
    await page.goto(href!);
    await expect(page).toHaveURL(/\/projects\//);
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 15_000 });
  });

  test("admin creates project from wizard", async ({ page }) => {
    const projectName = `E2E Project ${Date.now()}`;
    await demoLogin(page, DEMO_USERS.admin);
    await page.goto("/projects");
    await page.getByRole("button", { name: /new project/i }).click();
    await page.getByLabel(/project name/i).fill(projectName);
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.getByRole("button", { name: /create project/i }).click();
    await expect(page.getByRole("heading", { name: projectName }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("team lead creates task on project page", async ({ page }) => {
    const taskName = `E2E Task ${Date.now()}`;
    await demoLogin(page, DEMO_USERS.teamLead);
    await page.goto("/projects/proj-sf");
    await page.getByTestId("new-work-hub-button").click();
    const hubDialog = page.getByRole("dialog", { name: "New work" });
    await expect(hubDialog).toBeVisible();
    await hubDialog.getByRole("button", { name: /new task/i }).click();
    const taskDialog = page.getByRole("dialog", { name: "Create task" });
    await expect(taskDialog).toBeVisible();
    await taskDialog.locator("input").first().fill(taskName);
    await taskDialog.getByRole("button", { name: /create task/i }).click();
    await expect(page.getByText(/task created/i)).toBeVisible({ timeout: 20_000 });
    await page.goto("/operations?projectId=proj-sf");
    await expect(page.getByText(taskName)).toBeVisible({ timeout: 20_000 });
  });

  test("created project survives refresh", async ({ page }) => {
    const projectName = `E2E Refresh ${Date.now()}`;
    await demoLogin(page, DEMO_USERS.admin);
    await page.goto("/projects");
    await page.getByRole("button", { name: /new project/i }).click();
    await page.getByLabel(/project name/i).fill(projectName);
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.getByRole("button", { name: /create project/i }).click();
    await expect(page.getByRole("heading", { name: projectName }).first()).toBeVisible({
      timeout: 20_000,
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: projectName }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
