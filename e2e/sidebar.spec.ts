import { test, expect } from "@playwright/test";

// Desktop viewport (playwright.config default 1440×900), fresh context = no sidebar_state cookie.
//
// NOTE: the desktop Sidebar uses collapsible="offcanvas", which hides content by translating the
// fixed container off-screen (`left: -256px`), not via display:none/visibility:hidden. Playwright's
// toBeVisible()/toBeHidden() only check bounding-box emptiness and CSS visibility/display -- they do
// not check viewport intersection -- so a getByTestId("nav-projects") visibility assertion cannot
// distinguish open vs. collapsed here (verified empirically: it passes in both states). Instead we
// assert on the sidebar's own data-state attribute ("expanded"/"collapsed"), which is the actual
// source of truth driven by the `open` boolean from useSidebar().
test("sidebar is open by default on desktop", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute("data-state", "expanded");
});

test("collapsed state persists across reload", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute("data-state", "expanded");
	// Toggle closed via the header trigger, then reload; cookie should keep it closed.
	await page.getByRole("button", { name: /toggle sidebar/i }).first().click();
	await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute("data-state", "collapsed");
	await page.reload();
	await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute("data-state", "collapsed");
});

test("signed-out sidebar shows plans link that navigates to /plans", async ({ page }) => {
	await page.goto("/");
	const plans = page.getByTestId("nav-plans");
	await expect(plans).toBeVisible();
	await plans.click();
	await expect(page).toHaveURL(/\/plans$/);
});

test("header Upgrade button is absent when logged out", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByTestId("header-upgrade")).toHaveCount(0);
});
