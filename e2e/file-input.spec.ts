import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Verifies the non-image file input milestone (m6): the chat composer accepts non-image files
// (CSV / plain text / markdown / PDF) and extracts their content CLIENT-SIDE into labelled
// attachments before sending. We drive the REAL user path:
//   1. On the home composer, attach a CSV and a TXT via the hidden <input type=file> (setInputFiles).
//   2. Assert each extracted file surfaces as an attachment chip in the composer.
//   3. Send the message and assert the attachments are persisted onto the sent user message AND
//      that the extracted text reached the persisted store (so it will be sent to the model).
// No network/inference is needed: extraction is fully local, and we read the persisted chat back
// out of localStorage to assert on the extracted content.

mkdirSync("test-results/screenshots", { recursive: true });

const ALEPH_GLOB = "**/aggregates/**LTAI_PRICING**";

// Pin a tools+vision-capable model so the composer shows the full "Add photos & files" affordance.
const REGISTRY = {
	data: {
		LTAI_PRICING: {
			models: [
				{
					id: "qwen3.6-35b-a3b",
					name: "Qwen3.6-35B-A3B",
					pricing: { text: { price_per_million_input_tokens: 0.2, price_per_million_output_tokens: 0.8 } },
					capabilities: {
						text: { tee: false, vision: true, reasoning: false, context_window: 131072, function_calling: true },
					},
				},
			],
		},
	},
};

async function pinRegistry(page: Page) {
	await page.route(ALEPH_GLOB, (route) =>
		route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(REGISTRY) }),
	);
}

// Block the inference endpoint so the (logged-out) auto-response never fires during the test — we
// only care that the attachment was captured + persisted, not the model reply.
async function blockInference(page: Page) {
	await page.route("**/chat/completions", (route) => route.abort());
}

const CSV_CONTENT = "product,units,price\nWidget,12,9.99\nGadget,7,19.50";
const TXT_CONTENT = "Meeting notes\n\n- ship the file input milestone\n- write the e2e test";

function writeFixtures() {
	const dir = join(tmpdir(), "libertai-file-input-e2e");
	mkdirSync(dir, { recursive: true });
	const csvPath = join(dir, "inventory.csv");
	const txtPath = join(dir, "notes.txt");
	writeFileSync(csvPath, CSV_CONTENT, "utf8");
	writeFileSync(txtPath, TXT_CONTENT, "utf8");
	return { csvPath, txtPath };
}

test("attaches a CSV and a text file, shows them in the composer, and persists the extracted text", async ({
	page,
}) => {
	await pinRegistry(page);
	await blockInference(page);
	const { csvPath, txtPath } = writeFixtures();

	await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });

	// The composer (and its hidden file input) renders for every model since extraction is local.
	const fileInput = page.locator('input[type="file"]');
	await expect(fileInput).toHaveCount(1, { timeout: 20_000 });

	// Attach both files through the real picker input (multiple-file support).
	await fileInput.setInputFiles([csvPath, txtPath]);

	// Both extracted files appear as attachment chips in the composer.
	const chips = page.getByTestId("attachment-chip");
	await expect(chips).toHaveCount(2, { timeout: 20_000 });
	await expect(page.getByText("inventory.csv")).toBeVisible();
	await expect(page.getByText("notes.txt")).toBeVisible();

	await page.screenshot({ path: "test-results/screenshots/file-input-composer.png", fullPage: true });

	// Type a prompt and send. The home composer creates a chat and navigates to /chat/:id.
	// fill() focuses + sets the value directly (no positional click that the toolbar could intercept).
	const textarea = page.locator("#chat-input");
	await textarea.fill("Summarize the attached files.");

	const sendButton = page.getByRole("button").filter({ has: page.locator("svg.lucide-arrow-up") });
	await expect(sendButton).toBeEnabled();
	await sendButton.click();

	// We land on the conversation; the sent user message shows the attachment chips.
	await page.waitForURL(/\/chat\//, { timeout: 20_000 });
	const sentAttachments = page.getByTestId("message-attachment");
	await expect(sentAttachments).toHaveCount(2, { timeout: 20_000 });
	// Scope to the message bubble (the sidebar chat list also echoes the title).
	await expect(page.locator("p.message-content", { hasText: "Summarize the attached files." })).toBeVisible();

	await page.screenshot({ path: "test-results/screenshots/file-input-sent.png", fullPage: true });

	// The extracted content is persisted (client-side) onto the user message, so it will be sent to
	// the model as a labelled text block. Read it straight out of localStorage to assert on it.
	const persisted = await page.evaluate(() => window.localStorage.getItem("libertai-chats"));
	expect(persisted).toBeTruthy();
	const parsed = JSON.parse(persisted!);
	const chats = Object.values(parsed.state.chats) as Array<{
		messages: Array<{ role: string; attachments?: Array<{ filename: string; kind: string; content: string }> }>;
	}>;
	const userMessage = chats.flatMap((c) => c.messages).find((m) => m.role === "user" && m.attachments);
	expect(userMessage).toBeTruthy();
	const attachments = userMessage!.attachments!;
	expect(attachments).toHaveLength(2);

	const csv = attachments.find((a) => a.filename === "inventory.csv")!;
	expect(csv.kind).toBe("csv");
	// papaparse output is tab-joined: header + rows preserved.
	expect(csv.content).toContain("product\tunits\tprice");
	expect(csv.content).toContain("Widget\t12\t9.99");

	const txt = attachments.find((a) => a.filename === "notes.txt")!;
	expect(txt.kind).toBe("text");
	expect(txt.content).toContain("ship the file input milestone");
});

test("a removed attachment chip drops out of the composer", async ({ page }) => {
	await pinRegistry(page);
	await blockInference(page);
	const { txtPath } = writeFixtures();

	await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });

	const fileInput = page.locator('input[type="file"]');
	await expect(fileInput).toHaveCount(1, { timeout: 20_000 });
	await fileInput.setInputFiles([txtPath]);

	const chip = page.getByTestId("attachment-chip");
	await expect(chip).toHaveCount(1, { timeout: 20_000 });

	// Hover to reveal the remove control, then remove it.
	await chip.hover();
	await page.getByRole("button", { name: /remove notes\.txt/i }).click();
	await expect(page.getByTestId("attachment-chip")).toHaveCount(0);
});
