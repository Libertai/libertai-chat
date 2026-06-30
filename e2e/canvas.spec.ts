import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Verifies the Artifacts / Canvas side-panel (m5). We seed a chat whose LAST message is from the
// assistant and carries two self-contained artifacts (an HTML doc and a React/JSX component), with a
// SECOND version of the React artifact so the version-history switcher has something to switch. The
// chat route renders without any network/inference call, so this exercises the real user path:
// click "Open in canvas" -> the right-hand Canvas panel mounts -> Preview renders inside a sandboxed
// iframe -> switch to the Code tab -> switch React versions and confirm the preview updates.

mkdirSync("test-results/screenshots", { recursive: true });

const CHAT_ID = "e2e-canvas-chat";

// A bare HTML fragment artifact (wrapped by the preview builder into a styled, CSP-locked document).
const HTML_CODE = '<h1 id="hello">Canvas HTML works</h1>\n<p>Rendered inside a sandboxed iframe.</p>';

// A React component artifact. Compiled on the host via @babel/standalone, mounted in the sandbox via
// React UMD globals.
const REACT_V1 = [
	"function App() {",
	"  const [n, setN] = React.useState(0);",
	"  return React.createElement('div', null,",
	"    React.createElement('p', { id: 'react-out' }, 'React version one'),",
	"    React.createElement('button', { onClick: () => setN(n + 1) }, 'count ' + n)",
	"  );",
	"}",
].join("\n");

const REACT_V2 = REACT_V1.replace("React version one", "React version two");

const now = new Date().toISOString();

const persisted = {
	state: {
		chats: {
			[CHAT_ID]: {
				id: CHAT_ID,
				assistantId: "default",
				createdAt: now,
				updatedAt: now,
				title: "Canvas smoke",
				messages: [
					{
						id: "11111111-1111-4111-8111-111111111111",
						role: "user",
						content: "build me an html page and a react component",
						timestamp: now,
					},
					{
						id: "22222222-2222-4222-8222-222222222222",
						role: "assistant",
						content:
							"Here is an HTML page:\n\n```html\n" +
							HTML_CODE +
							"\n```\n\nAnd a React component:\n\n```jsx\n" +
							REACT_V2 +
							"\n```\n",
						timestamp: now,
						artifacts: [
							{
								id: "art-html",
								kind: "html",
								title: "Canvas HTML works",
								slot: "html:0",
								versions: [{ version: 1, code: HTML_CODE, language: "html", createdAt: now }],
							},
							{
								id: "art-react",
								kind: "react",
								title: "App",
								slot: "react:1",
								versions: [
									{ version: 1, code: REACT_V1, language: "jsx", createdAt: now },
									{ version: 2, code: REACT_V2, language: "jsx", createdAt: now },
								],
							},
						],
					},
				],
			},
		},
		legacyMigrated: true,
	},
	version: 7,
};

function seedChat(page: Page) {
	return page.addInitScript(
		([key, value]) => {
			window.localStorage.setItem(key, value);
		},
		["libertai-chats", JSON.stringify(persisted)] as const,
	);
}

test.describe("artifacts / canvas side-panel", () => {
	test("opens the canvas, renders previews, switches tabs and versions", async ({ page }) => {
		await seedChat(page);
		await page.goto(`/chat/${CHAT_ID}`, { waitUntil: "domcontentloaded", timeout: 30_000 });

		// Both "Open in canvas" chips render (one per detected artifact).
		const artifactBar = page.locator("[data-message-artifacts]").first();
		await expect(artifactBar).toBeVisible({ timeout: 20_000 });
		const htmlChip = page.locator('[data-open-canvas="art-html"]');
		const reactChip = page.locator('[data-open-canvas="art-react"]');
		await expect(htmlChip).toBeVisible();
		await expect(reactChip).toBeVisible();

		// --- HTML artifact: open the canvas, assert the preview renders expected text INSIDE the frame.
		await htmlChip.click();
		const panel = page.locator("[data-canvas-panel]");
		await expect(panel).toBeVisible();
		await expect(panel.locator("[data-canvas-title]")).toContainText("Canvas HTML works");

		const htmlFrame = page.frameLocator("[data-canvas-preview-frame]");
		await expect(htmlFrame.locator("#hello")).toHaveText("Canvas HTML works", { timeout: 20_000 });

		// Switch to the Code tab: the raw source shows (and the preview iframe is gone).
		await panel.getByTestId("canvas-tab-code").click();
		await expect(panel.locator("[data-canvas-code]")).toContainText("Rendered inside a sandboxed iframe");
		await expect(page.locator("[data-canvas-preview-frame]")).toHaveCount(0);

		// Back to Preview.
		await panel.getByTestId("canvas-tab-preview").click();
		await expect(htmlFrame.locator("#hello")).toBeVisible();

		// --- React artifact: open it, the in-browser-Babel-compiled component renders in the sandbox.
		await reactChip.click();
		await expect(panel.locator("[data-canvas-title]")).toContainText("App");

		const reactFrame = page.frameLocator("[data-canvas-preview-frame]");
		// Defaults to the latest version (v2) -> "React version two".
		await expect(reactFrame.locator("#react-out")).toHaveText("React version two", { timeout: 30_000 });

		// Version history switcher is present (two versions) — switch to Version 1 and confirm the
		// preview updates to the v1 text.
		const versionSelect = panel.locator("[data-canvas-version-select]");
		await expect(versionSelect).toBeVisible();
		await versionSelect.selectOption({ label: "Version 1" });
		await expect(reactFrame.locator("#react-out")).toHaveText("React version one", { timeout: 30_000 });

		await page.screenshot({ path: "test-results/screenshots/canvas.png", fullPage: true });

		// Close the canvas: the panel unmounts and the chat column returns.
		await panel.locator("[data-canvas-close]").click();
		await expect(panel).toHaveCount(0);
	});
});
