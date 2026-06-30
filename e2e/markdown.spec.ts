import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Verifies the rich-markdown baseline (m1): GFM tables/task-lists/strikethrough,
// inline KaTeX math, Shiki-highlighted fenced code with a working Copy button, and a
// mermaid diagram rendered to SVG. We seed a chat directly into the persisted store
// (localStorage key 'libertai-chats') whose LAST message is from the assistant, so the
// chat route renders the content without firing any network/inference call.

mkdirSync("test-results/screenshots", { recursive: true });

const CHAT_ID = "e2e-markdown-chat";

const ASSISTANT_MARKDOWN = [
	"# Rich markdown",
	"",
	"Here is a **GFM table**:",
	"",
	"| Feature | Status |",
	"| ------- | ------ |",
	"| Tables  | done   |",
	"| Math    | done   |",
	"",
	"Inline math: the area is $E = mc^2$ for the record.",
	"",
	"A task list:",
	"",
	"- [x] highlight code",
	"- [ ] render diagram",
	"",
	"~~struck through~~ and a [link](https://libertai.io).",
	"",
	"A fenced js code block:",
	"",
	"```js",
	"function greet(name) {",
	"\treturn `hello, ${name}`;",
	"}",
	"```",
	"",
	"And a mermaid graph:",
	"",
	"```mermaid",
	"graph TD;",
	"  A[Start] --> B[End];",
	"```",
].join("\n");

function seedChat(page: Page) {
	const now = new Date().toISOString();
	const persisted = {
		state: {
			chats: {
				[CHAT_ID]: {
					id: CHAT_ID,
					assistantId: "default",
					createdAt: now,
					updatedAt: now,
					title: "Markdown smoke",
					messages: [
						{
							id: "11111111-1111-4111-8111-111111111111",
							role: "user",
							content: "show me rich markdown",
							timestamp: now,
						},
						{
							id: "22222222-2222-4222-8222-222222222222",
							role: "assistant",
							content: ASSISTANT_MARKDOWN,
							timestamp: now,
						},
					],
				},
			},
			legacyMigrated: true,
		},
		version: 4,
	};

	return page.addInitScript(
		([key, value]) => {
			window.localStorage.setItem(key, value);
		},
		["libertai-chats", JSON.stringify(persisted)] as const,
	);
}

test("rich markdown renders table, highlighted code, copy, katex and mermaid", async ({ page }) => {
	await seedChat(page);

	await page.goto(`/chat/${CHAT_ID}`, { waitUntil: "domcontentloaded", timeout: 30_000 });

	const content = page.locator(".markdown-content").first();
	await expect(content).toBeVisible({ timeout: 20_000 });

	// GFM table renders as a real <table> with our seeded cells.
	const table = content.locator("table");
	await expect(table).toBeVisible();
	await expect(table.locator("th", { hasText: "Feature" })).toBeVisible();
	await expect(table.locator("td", { hasText: "done" }).first()).toBeVisible();

	// GFM task list -> checkbox inputs (one checked, one unchecked).
	const checkboxes = content.locator('input[type="checkbox"]');
	await expect(checkboxes).toHaveCount(2);
	await expect(checkboxes.nth(0)).toBeChecked();
	await expect(checkboxes.nth(1)).not.toBeChecked();

	// remark-math + rehype-katex -> .katex output present.
	await expect(content.locator(".katex").first()).toBeVisible({ timeout: 20_000 });

	// Shiki highlighting -> a highlighted block with token <span style="color:...">.
	const highlighted = content.locator('[data-highlighted="true"]');
	await expect(highlighted).toBeVisible({ timeout: 20_000 });
	await expect(highlighted.locator("span[style*='color']").first()).toBeVisible();
	await expect(highlighted).toContainText("function greet");

	// mermaid -> an <svg> rendered into the diagram container.
	const mermaid = content.locator('[data-mermaid="rendered"]');
	await expect(mermaid).toBeVisible({ timeout: 20_000 });
	await expect(mermaid.locator("svg")).toBeVisible();

	// Copy button copies the raw source of the js block (grant clipboard perms).
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
	const codeBlock = highlighted.locator("..");
	await codeBlock.hover();
	const copyButton = codeBlock.getByRole("button", { name: /copy code/i });
	await expect(copyButton).toBeVisible();
	await copyButton.click();
	await expect(codeBlock.getByRole("button", { name: /copied/i })).toBeVisible();

	const clipboard = await page.evaluate(() => navigator.clipboard.readText());
	expect(clipboard).toContain("function greet(name)");
	expect(clipboard).toContain("return `hello, ${name}`;");

	await page.screenshot({ path: "test-results/screenshots/markdown.png", fullPage: true });
});
