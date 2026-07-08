import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Verifies the thinking-model plumbing end to end against a mocked SSE completion:
//  1. `reasoning_content` deltas accumulate into the message's thinking and survive completion —
//     the THINKING toggle renders and expanding it shows the reasoning text.
//  2. The final answer text renders as markdown below it.
// The live mid-stream preview (thinking tail while collapsed) can't be exercised here because
// route.fulfill delivers the SSE body in one shot; it is covered by review + manual verification.

mkdirSync("test-results/screenshots", { recursive: true });

const CHAT_ID = "e2e-thinking-chat";
const ALEPH_GLOB = "**/aggregates/**LTAI_PRICING**";

// A reasoning-capable model so the -thinking variant resolves client-side.
const REGISTRY = {
	data: {
		LTAI_PRICING: {
			models: [
				{
					id: "glm-5.2",
					name: "GLM 5.2",
					pricing: { text: { price_per_million_input_tokens: 0.2, price_per_million_output_tokens: 0.8 } },
					capabilities: {
						text: { tee: false, vision: false, reasoning: true, context_window: 131072, function_calling: false },
					},
				},
			],
		},
	},
};

const THINKING_TEXT = "Let me reason about prime gaps carefully before answering.";
const ANSWER_TEXT = "The answer is that prime gaps grow, but slowly.";

function sseBody(): string {
	const chunk = (delta: Record<string, string>) =>
		`data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`;
	const parts: string[] = [];
	for (const word of THINKING_TEXT.split(" ")) parts.push(chunk({ reasoning_content: `${word} ` }));
	for (const word of ANSWER_TEXT.split(" ")) parts.push(chunk({ content: `${word} ` }));
	parts.push("data: [DONE]\n\n");
	return parts.join("");
}

function seedThinkingChat(page: Page) {
	const now = new Date().toISOString();
	const persisted = {
		state: {
			chats: {
				[CHAT_ID]: {
					id: CHAT_ID,
					// Last message is from the user so the route auto-fires a generation on load.
					messages: [
						{
							id: "m1",
							role: "user",
							content: "How fast do prime gaps grow?",
							timestamp: now,
						},
					],
					assistantId: "light",
					model: "glm-5.2-thinking",
					createdAt: now,
					updatedAt: now,
				},
			},
			legacyMigrated: true,
		},
		version: 9,
	};
	return page.addInitScript(
		([key, value]) => {
			if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value);
		},
		["libertai-chats", JSON.stringify(persisted)] as const,
	);
}

test("reasoning deltas persist as expandable thinking and the answer renders", async ({ page }) => {
	await page.route(ALEPH_GLOB, (route) =>
		route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(REGISTRY) }),
	);
	await page.route("**/v1/chat/completions", (route) =>
		route.fulfill({
			status: 200,
			contentType: "text/event-stream; charset=utf-8",
			body: sseBody(),
		}),
	);
	await seedThinkingChat(page);

	await page.goto(`/chat/${CHAT_ID}`, { waitUntil: "domcontentloaded", timeout: 30_000 });

	// The answer streams in and renders as the assistant message.
	await expect(page.locator(".markdown-content", { hasText: "prime gaps grow, but slowly" })).toBeVisible({
		timeout: 20_000,
	});

	// The THINKING toggle is present; expanding it reveals the accumulated reasoning.
	// exact: the model-picker trigger also contains "thinking" (model id "glm-5.2-thinking").
	const thinkingToggle = page.getByRole("button", { name: "Thinking", exact: true });
	await expect(thinkingToggle).toBeVisible();
	await thinkingToggle.click();
	await expect(page.getByText("Let me reason about prime gaps carefully")).toBeVisible();

	await page.screenshot({ path: "test-results/screenshots/thinking-expanded.png", fullPage: true });
});
