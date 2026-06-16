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
		baseURL: "http://localhost:5173",
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
		viewport: { width: 1440, height: 900 },
	},
	webServer: {
		command: "pnpm dev",
		url: "http://localhost:5173",
		reuseExistingServer: true,
		timeout: 120_000,
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
