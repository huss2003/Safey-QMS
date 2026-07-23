import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should load the dashboard page", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Dashboard");
  });

  test("should display KPI cards", async ({ page }) => {
    // Wait for KPI cards to render (either loading skeleton or data)
    const kpiGrid = page.locator(".grid");
    await expect(kpiGrid.first()).toBeVisible();

    // Look for KPI card labels using the label-caps class
    const kpiLabels = [
      "Raw material stock",
      "Finished goods",
      "Today's production",
      "Vendors",
      "Parts in stock",
      "Raw batches",
      "Unread alerts",
    ];

    for (const label of kpiLabels) {
      const kpi = page.locator(".label-caps", { hasText: label });
      await expect(kpi.first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("should show numeric KPI values", async ({ page }) => {
    // The KPI values are rendered with font-semibold in the grid
    const values = page.locator(".grid .num");
    const count = await values.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test("should navigate to traceability from dashboard button", async ({ page }) => {
    const traceBtn = page.getByRole("link", { name: /trace batch/i });
    await traceBtn.click();
    await expect(page).toHaveURL(/\/traceability/);
  });

  test("should show page header with date", async ({ page }) => {
    const header = page.locator("h1");
    await expect(header).toContainText("Dashboard");
    const description = page.locator("p.text-muted-foreground").first();
    await expect(description).toContainText("Operational summary");
  });
});
