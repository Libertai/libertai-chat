import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Verifies the explicit model picker (m2): the chat header surfaces a ModelPicker listing the real
// chat models from the Aleph LTAI_PRICING registry, renders a "TEE attested" badge for the TEE
// model, lets the user pick a model, and persists that choice on the chat across a reload.
//
// We seed a chat directly into the persisted store (localStorage key 'libertai-chats') whose LAST
// message is from the assistant, so the chat route renders without firing any inference call. We
// also pin the Aleph registry response to a deterministic, production-shaped payload so the test is
// not flaky against live data drift — the picker / store / render code all run for real.

mkdirSync("test-results/screenshots", { recursive: true });

const CHAT_ID = "e2e-model-picker-chat";
const ALEPH_GLOB = "**/aggregates/**LTAI_PRICING**";

// Real LTAI_PRICING shape: a TEE text model, two non-TEE text models, plus non-text (image / search)
// entries that must NOT appear in the chat model picker.
const REGISTRY = {
	data: {
		LTAI_PRICING: {
			models: [
				{
					id: "hermes-3-8b-tee",
					name: "Hermes 3 8B (TEE)",
					hf_id: "NousResearch/Hermes-3-Llama-3.1-8B",
					pricing: { text: { price_per_million_input_tokens: 0.15, price_per_million_output_tokens: 0.6 } },
					capabilities: {
						text: { tee: true, vision: false, reasoning: false, context_window: 16000, function_calling: true },
					},
				},
				{
					id: "qwen3.6-35b-a3b",
					name: "Qwen3.6-35B-A3B",
					pricing: { text: { price_per_million_input_tokens: 0.2, price_per_million_output_tokens: 0.8 } },
					capabilities: {
						text: { tee: false, vision: true, reasoning: false, context_window: 131072, function_calling: true },
					},
				},
				{
					id: "qwen3.6-27b",
					name: "Qwen3.6-27B",
					pricing: { text: { price_per_million_input_tokens: 0.2, price_per_million_output_tokens: 0.8 } },
					capabilities: {
						text: { tee: false, vision: false, reasoning: true, context_window: 65536, function_calling: true },
					},
				},
				{
					id: "z-image-turbo",
					name: "Z-Image Turbo",
					pricing: { image: 0.01 },
					capabilities: { image: true },
				},
			],
		},
	},
};

function seedChat(page: Page) {
	const now = new Date().toISOString();
	const persisted = {
		state: {
			chats: {
				[CHAT_ID]: {
					id: CHAT_ID,
					// Default "Light" persona (pins qwen3.6-35b-a3b); no explicit model yet.
					assistantId: "6984ea23-1c6c-402e-adf0-1afddceec404",
					createdAt: now,
					updatedAt: now,
					title: "Model picker smoke",
					messages: [
						{ id: "11111111-1111-4111-8111-111111111111", role: "user", content: "hi", timestamp: now },
						{ id: "22222222-2222-4222-8222-222222222222", role: "assistant", content: "Hello!", timestamp: now },
					],
				},
			},
			legacyMigrated: true,
		},
		version: 5,
	};

	// Idempotent seed: only write when the key is absent. The init script re-runs on every load
	// (including reload), so guarding on absence lets the user's persisted model choice survive the
	// reload instead of being clobbered back to the seed.
	return page.addInitScript(
		([key, value]) => {
			if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value);
		},
		["libertai-chats", JSON.stringify(persisted)] as const,
	);
}

async function pinRegistry(page: Page) {
	await page.route(ALEPH_GLOB, (route) =>
		route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(REGISTRY) }),
	);
}

test("model picker lists real models, shows a TEE badge, and persists the selection", async ({ page }) => {
	await pinRegistry(page);
	await seedChat(page);

	await page.goto(`/chat/${CHAT_ID}`, { waitUntil: "domcontentloaded", timeout: 30_000 });

	// The picker trigger lives in the chat input toolbar. Default persona pins qwen3.6-35b-a3b.
	const trigger = page.getByTestId("model-picker-trigger");
	await expect(trigger).toBeVisible({ timeout: 20_000 });
	await expect(trigger).toContainText("Qwen3.6-35B-A3B");

	// Open the picker.
	await trigger.click();

	// Multiple real chat models are listed; the non-text (image) entry is filtered out.
	await expect(page.getByTestId("model-option-hermes-3-8b-tee")).toBeVisible();
	await expect(page.getByTestId("model-option-qwen3.6-35b-a3b")).toBeVisible();
	await expect(page.getByTestId("model-option-qwen3.6-27b")).toBeVisible();
	await expect(page.getByTestId("model-option-z-image-turbo")).toHaveCount(0);

	// At least one TEE attested badge is visible inside the open picker.
	const teeBadges = page.getByTestId("tee-badge");
	expect(await teeBadges.count()).toBeGreaterThanOrEqual(1);
	await expect(teeBadges.first()).toBeVisible();
	await expect(teeBadges.first()).toContainText("TEE attested");

	// Screenshot the open picker.
	await page.screenshot({ path: "test-results/screenshots/model-picker.png", fullPage: true });

	// Select the TEE model.
	await page.getByTestId("model-option-hermes-3-8b-tee").click();

	// Trigger now reflects the chosen model and shows the TEE shield.
	await expect(trigger).toContainText("Hermes 3 8B (TEE)");

	// The choice persisted to the chat store (localStorage) and survives a reload.
	const stored = await page.evaluate(() => window.localStorage.getItem("libertai-chats"));
	expect(stored).toContain("hermes-3-8b-tee");

	await page.reload({ waitUntil: "domcontentloaded" });
	const triggerAfterReload = page.getByTestId("model-picker-trigger");
	await expect(triggerAfterReload).toBeVisible({ timeout: 20_000 });
	await expect(triggerAfterReload).toContainText("Hermes 3 8B (TEE)");
});
