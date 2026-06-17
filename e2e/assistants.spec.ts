import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Verifies m8 (editable / custom assistants): from the home page a user opens the assistant manager,
// creates a custom assistant (name + emoji + system prompt + model), sees it listed, confirms it
// PERSISTS across a full reload (localStorage key 'libertai-assistants'), edits it, then deletes it.
//
// The app has a guest/logged-out mode, so the home page and the whole manager flow run WITHOUT a
// wallet. We pin the Aleph model registry so the in-editor ModelPicker renders deterministically.

mkdirSync("test-results/screenshots", { recursive: true });

const ALEPH_GLOB = "**/aggregates/**LTAI_PRICING**";
const STORE_KEY = "libertai-assistants";

const REGISTRY = {
	data: {
		LTAI_PRICING: {
			models: [
				{
					id: "qwen3.6-35b-a3b",
					name: "Qwen3.6-35B-A3B",
					pricing: { text: { price_per_million_input_tokens: 0.2, price_per_million_output_tokens: 0.8 } },
					capabilities: { text: { tee: false, vision: true, reasoning: false, context_window: 131072, function_calling: true } },
				},
				{
					id: "qwen3.6-27b",
					name: "Qwen3.6-27B",
					pricing: { text: { price_per_million_input_tokens: 0.2, price_per_million_output_tokens: 0.8 } },
					capabilities: { text: { tee: false, vision: false, reasoning: true, context_window: 65536, function_calling: true } },
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

test("create, persist, edit and delete a custom assistant", async ({ page }) => {
	await pinRegistry(page);
	await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });

	// Open the manager from the home page.
	const manageButton = page.getByTestId("manage-assistants");
	await expect(manageButton).toBeVisible({ timeout: 20_000 });
	await manageButton.click();

	const manager = page.getByTestId("assistant-manager");
	await expect(manager).toBeVisible();
	// The 6 built-in personas are listed as non-deletable rows.
	await expect(page.getByTestId("assistant-list").locator("li")).toHaveCount(6);

	// Create a new custom assistant.
	await page.getByTestId("assistant-create").click();
	await page.getByTestId("assistant-form-emoji").fill("🦊");
	await page.getByTestId("assistant-form-title").fill("Fox Tutor");
	await page.getByTestId("assistant-form-subtitle").fill("Teaches with patience");
	await page.getByTestId("assistant-form-prompt").fill("You are a patient tutor named Fox.");

	// Pick a model in the in-editor ModelPicker.
	await page.getByTestId("model-picker-trigger").click();
	await page.getByTestId("model-option-qwen3.6-27b").click();

	await page.getByTestId("assistant-form-save").click();

	// It now appears as a row in the list (7 total: 6 built-in + 1 custom).
	await expect(page.getByTestId("assistant-list").locator("li")).toHaveCount(7);
	const row = manager.getByText("Fox Tutor");
	await expect(row).toBeVisible();
	await expect(manager.getByText("Custom").first()).toBeVisible();

	// Screenshot the manager with the custom assistant present.
	await page.screenshot({ path: "test-results/screenshots/assistants-manager.png", fullPage: true });

	// It persisted to localStorage.
	const stored = await page.evaluate((k) => window.localStorage.getItem(k), STORE_KEY);
	expect(stored).toContain("Fox Tutor");
	expect(stored).toContain("You are a patient tutor named Fox.");
	expect(stored).toContain("qwen3.6-27b");

	// Persists across a full reload.
	await page.reload({ waitUntil: "domcontentloaded" });
	await expect(page.getByTestId("manage-assistants")).toBeVisible({ timeout: 20_000 });
	// The custom assistant also surfaces as a selectable card on the home page.
	await expect(page.getByText("Fox Tutor")).toBeVisible();

	// Re-open the manager and edit it.
	await page.getByTestId("manage-assistants").click();
	const manager2 = page.getByTestId("assistant-manager");
	await expect(manager2).toBeVisible();

	// Find the custom row's id from the rendered DOM and target its edit button.
	const editButton = page.locator('[data-testid^="assistant-edit-"]').last();
	await editButton.click();
	const titleInput = page.getByTestId("assistant-form-title");
	await expect(titleInput).toHaveValue("Fox Tutor");
	await titleInput.fill("Wolf Tutor");
	await page.getByTestId("assistant-form-save").click();

	// Scope name assertions to the manager (the home cards behind it also show the name).
	await expect(manager2.getByText("Wolf Tutor")).toBeVisible();
	await expect(manager2.getByText("Fox Tutor")).toHaveCount(0);

	// Delete it (two-step confirm).
	const deleteButton = page.locator('[data-testid^="assistant-delete-"]').last();
	await deleteButton.click();
	const confirmButton = page.locator('[data-testid^="assistant-confirm-delete-"]').last();
	await confirmButton.click();

	// Back to 6 built-ins only; the custom assistant is gone and stays gone in storage.
	await expect(page.getByTestId("assistant-list").locator("li")).toHaveCount(6);
	await expect(manager2.getByText("Wolf Tutor")).toHaveCount(0);

	const storedAfter = await page.evaluate((k) => window.localStorage.getItem(k), STORE_KEY);
	expect(storedAfter).not.toContain("Wolf Tutor");
});
