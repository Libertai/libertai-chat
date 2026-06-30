import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Per-route smoke gate for the dev-factory loop.
// Walks every route logged-out (the app falls back to the free public endpoint), fails on
// uncaught exceptions / error-boundary / blank-crashed pages, and screenshots each route.
//
// Auth note: this app has a guest/logged-out mode (resolveChatEndpoint -> free endpoint), so
// every route below renders without a wallet. Paths that REQUIRE a connected key (model-invoked
// tool calls: web_search / generate_image) are covered in feature specs, not here.
const ROUTES = [
	{ name: "home", path: "/", min: 60 },
	{ name: "login", path: "/login", min: 30 },
	{ name: "images", path: "/images", min: 30 },
	{ name: "settings", path: "/settings", min: 20 },
	{ name: "rewards", path: "/rewards", min: 20 },
	{ name: "top-up", path: "/top-up", min: 20 },
	{ name: "transactions", path: "/transactions", min: 20 },
	{ name: "chat", path: "/chat/e2e-smoke-chat", min: 20 },
	{ name: "notfound", path: "/this-route-does-not-exist", min: 10 },
] as const;

// Benign console-error noise from the crypto/wallet stack and unreachable external APIs in a
// headless env. We never ignore uncaught `pageerror` — that is the honest "page is broken" signal.
const IGNORE = [
	"favicon",
	"Download the React DevTools",
	"Failed to load resource",
	"net::",
	"ERR_",
	"Failed to fetch",
	"NetworkError",
	"thirdweb",
	"WalletConnect",
	"solana",
	"401",
	"403",
	"CORS",
	"ResizeObserver",
];

mkdirSync("test-results/screenshots", { recursive: true });

function wireErrorCapture(page: Page) {
	const errors: string[] = [];
	page.on("console", (m) => {
		if (m.type() === "error") {
			const t = m.text();
			if (!IGNORE.some((s) => t.toLowerCase().includes(s.toLowerCase()))) errors.push(`console.error: ${t}`);
		}
	});
	page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
	return errors;
}

for (const r of ROUTES) {
	test(`route ${r.name} (${r.path})`, async ({ page }) => {
		const errors = wireErrorCapture(page);
		const resp = await page.goto(r.path, { waitUntil: "domcontentloaded", timeout: 30_000 });
		expect(resp, `no response for ${r.path}`).toBeTruthy();

		// Let React mount + the app shell render (crypto apps rarely reach networkidle).
		await expect
			.poll(async () => (await page.locator("body").innerText()).trim().length, { timeout: 20_000 })
			.toBeGreaterThan(r.min);

		const body = (await page.locator("body").innerText()).trim();
		expect(body.toLowerCase(), `error boundary on ${r.path}`).not.toContain("something went wrong");

		await page.screenshot({ path: `test-results/screenshots/${r.name}.png`, fullPage: true });
		expect(errors, `runtime errors on ${r.path}:\n${errors.join("\n")}`).toEqual([]);
	});
}
