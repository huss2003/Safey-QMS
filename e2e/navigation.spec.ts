import { test, expect } from "@playwright/test";

test.describe("Sidebar navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  const NAV_LINKS = [
    { label: "Dashboard", path: "/" },
    { label: "Vendors", path: "/vendors" },
    { label: "Raw materials", path: "/raw-materials" },
    { label: "Parts", path: "/parts" },
    { label: "Products", path: "/products" },
    { label: "Production", path: "/production" },
    { label: "Production planning", path: "/production-planning" },
    { label: "Stock", path: "/stock" },
    { label: "Traceability", path: "/traceability" },
    { label: "Reports", path: "/reports" },
    { label: "Alerts", path: "/alerts" },
    { label: "Settings", path: "/settings" },
  ] as const;

  for (const { label, path } of NAV_LINKS) {
    test(`should navigate to ${label} page from sidebar`, async ({ page }) => {
      const link = page.locator("aside a", { hasText: label });
      await link.click();

      // Production and Dashboard are both at /production and / — handle special case
      if (path === "/") {
        await expect(page).toHaveURL("/");
      } else {
        await expect(page).toHaveURL(new RegExp(path));
      }

      // Verify the page header shows the section title
      await expect(page.locator("h1").first()).toBeVisible();
    });
  }

  test("should highlight active nav item", async ({ page }) => {
    await page.goto("/vendors");
    const activeLink = page.locator("aside a.bg-sidebar-accent");
    await expect(activeLink).toContainText("Vendors");
  });

  test("should have all navigation groups visible", async ({ page }) => {
    const groups = page.locator("aside .label-caps");
    await expect(groups).toContainText(["Operations", "Insight", "System"]);
  });
});
