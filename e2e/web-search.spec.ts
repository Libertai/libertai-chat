import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Verifies the web-search polish milestone (m3):
//  1. Inline numbered citation markers: an assistant message whose `sources` array is populated
//     renders bracketed [n] markers inline in the prose. Each marker is a clickable link that
//     opens the expandable sources panel and scrolls/targets the matching numbered source.
//  2. Search-type segmented control: forcing a web search surfaces a web/news/academic/images
//     toggle near the forced-tool chip, and picking a mode updates the control's state.
//
// Citations render without any network call (we seed the chat into localStorage). The mode toggle
// only appears once "Web search" is forced, which requires a connected (signed-in) state, so we
// mock the cookie-session endpoints (/auth/me, /api-keys/chat) and pin the Aleph model registry to
// a tools-capable model — the real auth + tool-forcing UI code all runs for real against the mocks.

mkdirSync("test-results/screenshots", { recursive: true });

const CITATIONS_CHAT_ID = "e2e-citations-chat";
const SEARCH_CHAT_ID = "e2e-search-toggle-chat";
const ALEPH_GLOB = "**/aggregates/**LTAI_PRICING**";

// A tools-capable (function_calling) text model so the ChatInput tool menu + forced-tool chip show.
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

const ASSISTANT_WITH_SOURCES = [
	"Rust 1.85 shipped the 2024 edition [1], and async closures are now stable [2].",
	"",
	"The release also stabilized several APIs that had been pending [1].",
].join("\n");

const SOURCES = [
	{
		title: "Announcing Rust 1.85.0",
		url: "https://blog.rust-lang.org/2025/02/20/Rust-1.85.0.html",
		snippet: "The Rust team is happy to announce a new version.",
	},
	{
		title: "Async closures stabilization",
		url: "https://github.com/rust-lang/rust/pull/132706",
		snippet: "Stabilize async closures.",
	},
];

function seedCitationsChat(page: Page) {
	const now = new Date().toISOString();
	const persisted = {
		state: {
			chats: {
				[CITATIONS_CHAT_ID]: {
					id: CITATIONS_CHAT_ID,
					assistantId: "default",
					createdAt: now,
					updatedAt: now,
					title: "Citations smoke",
					messages: [
						{
							id: "11111111-1111-4111-8111-111111111111",
							role: "user",
							content: "what's new in rust?",
							timestamp: now,
						},
						{
							id: "22222222-2222-4222-8222-222222222222",
							role: "assistant",
							content: ASSISTANT_WITH_SOURCES,
							timestamp: now,
							sources: SOURCES,
						},
					],
				},
			},
			legacyMigrated: true,
		},
		version: 5,
	};
	return page.addInitScript(
		([key, value]) => {
			if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value);
		},
		["libertai-chats", JSON.stringify(persisted)] as const,
	);
}

function seedSearchChat(page: Page) {
	const now = new Date().toISOString();
	const persisted = {
		state: {
			chats: {
				[SEARCH_CHAT_ID]: {
					id: SEARCH_CHAT_ID,
					// Default "Light" persona pins qwen3.6-35b-a3b (the tools-capable model above).
					assistantId: "6984ea23-1c6c-402e-adf0-1afddceec404",
					createdAt: now,
					updatedAt: now,
					title: "Search toggle smoke",
					messages: [
						{ id: "33333333-3333-4333-8333-333333333333", role: "user", content: "hi", timestamp: now },
						{ id: "44444444-4444-4444-8444-444444444444", role: "assistant", content: "Hello!", timestamp: now },
					],
				},
			},
			legacyMigrated: true,
		},
		version: 5,
	};
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

// Mock the cookie-session endpoints so the app treats us as signed-in with a chat key. This drives
// the real connected/tool-forcing UI path (isConnected === true) without a real wallet/login.
async function mockConnected(page: Page) {
	await page.route("**/auth/me", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ address: "0x000000000000000000000000000000000000dEaD", display_name: "E2E" }),
		}),
	);
	await page.route("**/api-keys/chat", (route) =>
		route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ key: "sk-e2e-chat-key" }) }),
	);
}

test("inline numbered citations render and link to the matching source", async ({ page }) => {
	await seedCitationsChat(page);

	await page.goto(`/chat/${CITATIONS_CHAT_ID}`, { waitUntil: "domcontentloaded", timeout: 30_000 });

	const content = page.locator(".markdown-content").first();
	await expect(content).toBeVisible({ timeout: 20_000 });

	// Bracketed [n] markers render as clickable citation anchors (not literal text). [1] appears
	// twice in the prose; [2] once. The out-of-range guard means we never render [3]+.
	const markers = content.locator("a.citation-marker");
	await expect(markers.first()).toBeVisible();
	await expect(markers).toHaveCount(3);
	await expect(content.locator('a.citation-marker[data-citation="1"]')).toHaveCount(2);
	await expect(content.locator('a.citation-marker[data-citation="2"]')).toHaveCount(1);

	// Each marker links to the per-message anchor of its source.
	await expect(markers.first()).toHaveAttribute("href", `#cite-22222222-2222-4222-8222-222222222222-1`);

	// The sources panel is collapsed initially; clicking a [2] marker opens it and reveals the
	// matching numbered source entry (anchored by id so the marker can scroll to it).
	const sourceAnchor = page.locator("#cite-22222222-2222-4222-8222-222222222222-2");
	await expect(sourceAnchor).toHaveCount(0);

	await content.locator('a.citation-marker[data-citation="2"]').click();

	await expect(sourceAnchor).toBeVisible();
	await expect(sourceAnchor).toContainText("Async closures stabilization");
	await expect(sourceAnchor).toHaveAttribute("href", SOURCES[1].url);

	// The expandable sources panel header is present alongside the inline markers.
	await expect(page.getByText(/2 sources/i)).toBeVisible();

	await page.screenshot({ path: "test-results/screenshots/web-search-citations.png", fullPage: true });
});

test("forcing a web search shows the chip; the search-type selector is hidden for now", async ({ page }) => {
	await pinRegistry(page);
	await mockConnected(page);
	await seedSearchChat(page);

	await page.goto(`/chat/${SEARCH_CHAT_ID}`, { waitUntil: "domcontentloaded", timeout: 30_000 });

	// Open the attachments/tools menu (the "+" button) in the chat input toolbar.
	const plusButton = page.getByRole("button").filter({ has: page.locator("svg.lucide-plus") });
	await expect(plusButton).toBeVisible({ timeout: 20_000 });
	await plusButton.click();

	// Choose "Web search" — enabled because we are mocked as connected.
	const webSearchItem = page.getByRole("menuitem", { name: /web search/i });
	await expect(webSearchItem).toBeVisible();
	await webSearchItem.click();

	// The forced-tool chip appears (search defaults to plain "web" under the hood).
	await expect(page.getByTestId("forced-tool-chip")).toContainText("Web search");

	// The search-type segmented control (Web / News / Academic / Images) is intentionally hidden
	// for now — its non-web modes don't return useful results yet. The code stays behind a flag.
	await expect(page.getByRole("radiogroup", { name: /search type/i })).toHaveCount(0);

	await page.screenshot({ path: "test-results/screenshots/web-search-toggle.png", fullPage: true });
});
