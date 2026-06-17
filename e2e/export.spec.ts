import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";

// Verifies client-side document export (m7), wired into the Canvas panel. We seed a chat whose last
// assistant message carries TWO artifacts:
//   - a markdown DOCUMENT artifact that embeds a GFM table (so the export menu offers PDF / DOCX /
//     Markdown / XLSX / CSV), and
//   - an HTML artifact (so the menu offers an HTML file download).
// The chat route renders without any network/inference call, so this exercises the real user path:
// open the Canvas -> open the Export menu -> pick a format -> a REAL browser download fires. We
// assert the Playwright download event, the suggested filename, and the on-disk bytes (Markdown text
// + the XLSX "PK" zip magic). All generation happens in-browser (Blob + anchor download), no server.

mkdirSync("test-results/screenshots", { recursive: true });

const CHAT_ID = "e2e-export-chat";

const MD_CODE = [
	"# Quarterly Report",
	"",
	"Some prose describing the numbers below.",
	"",
	"| Region | Revenue |",
	"| --- | --- |",
	"| North | 120 |",
	"| South | 95 |",
].join("\n");

const HTML_CODE = '<h1 id="hello">Export HTML works</h1>\n<p>Saved to a file.</p>';

const now = new Date().toISOString();

const persisted = {
	state: {
		chats: {
			[CHAT_ID]: {
				id: CHAT_ID,
				assistantId: "default",
				createdAt: now,
				updatedAt: now,
				title: "Export smoke",
				messages: [
					{
						id: "11111111-1111-4111-8111-111111111111",
						role: "user",
						content: "write me a report with a table and an html page",
						timestamp: now,
					},
					{
						id: "22222222-2222-4222-8222-222222222222",
						role: "assistant",
						content:
							"Here is a document:\n\n```markdown\n" +
							MD_CODE +
							"\n```\n\nAnd an HTML page:\n\n```html\n" +
							HTML_CODE +
							"\n```\n",
						timestamp: now,
						artifacts: [
							{
								id: "art-doc",
								kind: "markdown",
								title: "Quarterly Report",
								slot: "markdown:0",
								versions: [{ version: 1, code: MD_CODE, language: "markdown", createdAt: now }],
							},
							{
								id: "art-html",
								kind: "html",
								title: "Export HTML works",
								slot: "html:1",
								versions: [{ version: 1, code: HTML_CODE, language: "html", createdAt: now }],
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

test.describe("client-side document export (m7)", () => {
	test("exports a markdown document and a table to real downloads", async ({ page }) => {
		await seedChat(page);
		await page.goto(`/chat/${CHAT_ID}`, { waitUntil: "domcontentloaded", timeout: 30_000 });

		// Open the markdown document artifact in the canvas.
		const docChip = page.locator('[data-open-canvas="art-doc"]');
		await expect(docChip).toBeVisible({ timeout: 20_000 });
		await docChip.click();

		const panel = page.locator("[data-canvas-panel]");
		await expect(panel).toBeVisible();
		await expect(panel.locator("[data-canvas-title]")).toContainText("Quarterly Report");

		// Open the export menu and confirm the document formats (PDF / DOCX / Markdown) plus the
		// table-only formats (XLSX / CSV) are offered.
		await panel.locator("[data-canvas-export]").click();
		const menu = page.locator("[data-canvas-export-menu]");
		await expect(menu).toBeVisible();
		await expect(menu.locator('[data-export-format="pdf"]')).toBeVisible();
		await expect(menu.locator('[data-export-format="docx"]')).toBeVisible();
		await expect(menu.locator('[data-export-format="md"]')).toBeVisible();
		await expect(menu.locator('[data-export-format="xlsx"]')).toBeVisible();
		await expect(menu.locator('[data-export-format="csv"]')).toBeVisible();

		await page.screenshot({ path: "test-results/screenshots/export-menu.png", fullPage: true });

		// --- Markdown download: assert a real download event + filename + on-disk content.
		const mdDownloadPromise = page.waitForEvent("download");
		await menu.locator('[data-export-format="md"]').click();
		const mdDownload = await mdDownloadPromise;
		expect(mdDownload.suggestedFilename()).toBe("quarterly-report.md");
		const mdPath = await mdDownload.path();
		expect(mdPath).toBeTruthy();
		const mdContent = readFileSync(mdPath as string, "utf-8");
		expect(mdContent).toContain("# Quarterly Report");
		expect(mdContent).toContain("| Region | Revenue |");

		// --- XLSX download: assert a real download event + filename + that the bytes are a real .xlsx
		// (ZIP archives start with the "PK" magic). This exercises the full SheetJS generator path.
		await panel.locator("[data-canvas-export]").click();
		await expect(menu).toBeVisible();
		const xlsxDownloadPromise = page.waitForEvent("download");
		await menu.locator('[data-export-format="xlsx"]').click();
		const xlsxDownload = await xlsxDownloadPromise;
		expect(xlsxDownload.suggestedFilename()).toBe("quarterly-report.xlsx");
		const xlsxPath = await xlsxDownload.path();
		expect(xlsxPath).toBeTruthy();
		const xlsxBytes = readFileSync(xlsxPath as string);
		expect(xlsxBytes.length).toBeGreaterThan(1000);
		expect(xlsxBytes.subarray(0, 2).toString("latin1")).toBe("PK");
	});

	test("offers an HTML file download for an html artifact", async ({ page }) => {
		await seedChat(page);
		await page.goto(`/chat/${CHAT_ID}`, { waitUntil: "domcontentloaded", timeout: 30_000 });

		const htmlChip = page.locator('[data-open-canvas="art-html"]');
		await expect(htmlChip).toBeVisible({ timeout: 20_000 });
		await htmlChip.click();

		const panel = page.locator("[data-canvas-panel]");
		await expect(panel).toBeVisible();

		await panel.locator("[data-canvas-export]").click();
		const menu = page.locator("[data-canvas-export-menu]");
		await expect(menu).toBeVisible();
		// An HTML artifact only offers the HTML file download (no faithful office format).
		await expect(menu.locator('[data-export-format="html"]')).toBeVisible();
		await expect(menu.locator('[data-export-format="pdf"]')).toHaveCount(0);

		const downloadPromise = page.waitForEvent("download");
		await menu.locator('[data-export-format="html"]').click();
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toBe("export-html-works.html");
		const content = readFileSync((await download.path()) as string, "utf-8");
		expect(content).toContain('<h1 id="hello">Export HTML works</h1>');
	});
});
