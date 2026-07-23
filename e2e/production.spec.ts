import { test, expect } from "@playwright/test";

test.describe("Production page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/production");
  });

  test("should render the production page", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Production");
    await expect(page.getByText(/record finished product manufacturing/i)).toBeVisible();
  });

  test("should show production table or empty state", async ({ page }) => {
    // Wait for content to load (either table or empty state)
    await page.waitForTimeout(1_000);

    const table = page.locator("table");
    const emptyState = page.getByText(/no production runs yet/i);

    // Either we have a table or the empty state
    const tableVisible = await table.isVisible().catch(() => false);
    const emptyVisible = await emptyState.isVisible().catch(() => false);

    expect(tableVisible || emptyVisible).toBe(true);
  });

  test("should show start production button", async ({ page }) => {
    const startBtn = page.getByRole("link", { name: /start production/i });
    await expect(startBtn.first()).toBeVisible();
    await expect(startBtn.first()).toHaveAttribute("href", "/production-new");
  });

  test("should show plan production button", async ({ page }) => {
    const planBtn = page.getByRole("link", { name: /plan production/i });
    await expect(planBtn.first()).toBeVisible();
    await expect(planBtn.first()).toHaveAttribute("href", "/production-planning");
  });

  test("should navigate to production-new", async ({ page }) => {
    const startBtn = page.getByRole("link", { name: /start production/i });
    await startBtn.first().click();
    await expect(page).toHaveURL(/\/production-new/);
  });
});
