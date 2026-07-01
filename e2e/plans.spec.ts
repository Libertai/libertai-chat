import { test, expect, type Page } from "@playwright/test";

// The plans page is public: signed-out visitors can browse tiers, but the balance and
// transaction-history sections are gated to authenticated users, and any billing action
// bounces them to login first (returning to /plans afterwards).
//
// The tier catalog is served by the connected API, which isn't reachable from the test env
// (and isn't the subject under test). We stub /payments/tiers + /payments/region so the tier
// cards render deterministically. The request is cross-origin (app origin → api host) and the
// SDK sends credentials, so the stubbed response must carry credential-friendly CORS headers.
const TIERS = [
	{ name: "free", price_cents: 0, currency: "USD", window_5h_credits: 0, weekly_credits: 0, is_paid: false },
	{ name: "go", price_cents: 900, currency: "USD", window_5h_credits: 100, weekly_credits: 1000, is_paid: true },
];
const REGION = { currency: "USD", vat_rate: 0 };

async function mockPlansCatalog(page: Page) {
	// Credentialed cross-origin: ACAO must echo the app origin (not "*") and allow credentials.
	const cors = (req: import("@playwright/test").Request) => ({
		"Access-Control-Allow-Origin": req.headers()["origin"] ?? "http://localhost:5273",
		"Access-Control-Allow-Credentials": "true",
		"Access-Control-Allow-Methods": "GET,OPTIONS",
		"Access-Control-Allow-Headers": "*",
	});
	const stub = (body: unknown) => async (route: import("@playwright/test").Route) => {
		const req = route.request();
		if (req.method() === "OPTIONS") {
			await route.fulfill({ status: 204, headers: cors(req) });
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			headers: cors(req),
			body: JSON.stringify(body),
		});
	};
	await page.route(/\/payments\/tiers$/, stub(TIERS));
	await page.route(/\/payments\/region$/, stub(REGION));
}

test("signed-out /plans renders publicly without credits/transactions", async ({ page }) => {
	await mockPlansCatalog(page);
	await page.goto("/plans");
	await expect(page.getByRole("heading", { name: "Plans" })).toBeVisible();
	// Credits + transactions are gated to signed-in users.
	await expect(page.getByText(/transaction history/i)).toHaveCount(0);
	// The "Plan: <tier>" header is meaningless when logged out, so it's hidden.
	await expect(page.getByRole("heading", { name: /^Plan:/i })).toHaveCount(0);
});

test("signed-out Subscribe routes to login with redirect back to /plans", async ({ page }) => {
	await mockPlansCatalog(page);
	await page.goto("/plans");
	// The paid-tier CTA reads "Subscribe" for a non-subscriber and must be enabled so the click
	// can route a signed-out visitor to login (payment providers don't load when logged out).
	const subscribe = page.getByRole("button", { name: /^subscribe$/i }).first();
	await expect(subscribe).toBeVisible();
	await expect(subscribe).toBeEnabled();
	await subscribe.click();
	await expect(page).toHaveURL(/\/login\?redirect=%2Fplans/);
});
