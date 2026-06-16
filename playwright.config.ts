import { defineConfig, devices } from "@playwright/test";

// Headless-browser QA harness for the dev-factory client-side-parity work.
// Serves the Vite dev server and walks every route with a real Chromium.
export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
	outputDir: "test-results/artifacts",
	use: {
		// Dedicated port: 5173 is often taken by sibling apps (e.g. libertai-console).
		baseURL: "http://localhost:5273",
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
		viewport: { width: 1440, height: 900 },
	},
	webServer: {
		command: "pnpm dev --port 5273 --strictPort",
		url: "http://localhost:5273",
		reuseExistingServer: true,
		timeout: 120_000,
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
