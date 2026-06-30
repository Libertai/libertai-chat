import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Verifies m10 (cross-conversation memory, local): from the home page a user opens the memory
// manager, captures a salient fact via the manual "remember this" input (works WITHOUT a wallet and
// never hits the network), confirms it PERSISTS across a full reload (localStorage key
// 'libertai-memories'), confirms it is INJECTED into a brand-new chat's composed system context
// (via the visible "memories in context" indicator, which is driven by the same enabled-memory set
// that injectMemories() folds into the request), toggles + edits it, then deletes it.
//
// The app has a guest/logged-out mode, so the whole flow runs WITHOUT a wallet. We seed one chat
// directly into localStorage so navigating to the chat route renders deterministically — the
// indicator does not depend on any inference response, only on the user's saved memories.

mkdirSync("test-results/screenshots", { recursive: true });

const MEMORY_KEY = "libertai-memories";
const CHATS_KEY = "libertai-chats";
const SEED_CHAT = "e2e-memory-chat";

function seedChat(page: Page) {
	const now = new Date().toISOString();
	const persisted = {
		state: {
			chats: {
				[SEED_CHAT]: {
					id: SEED_CHAT,
					assistantId: "6984ea23-1c6c-402e-adf0-1afddceec404",
					createdAt: now,
					updatedAt: now,
					title: "Memory test chat",
					messages: [
						{ id: "11111111-1111-4111-8111-111111111111", role: "user", content: "hello", timestamp: now },
						{ id: "22222222-2222-4222-8222-222222222222", role: "assistant", content: "Hi!", timestamp: now },
					],
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
		[CHATS_KEY, JSON.stringify(persisted)] as const,
	);
}

test("add a memory, persist across reload, inject into a chat, edit/toggle and delete", async ({ page }) => {
	await seedChat(page);
	await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });

	// Open the memory manager from the home page.
	const manageButton = page.getByTestId("manage-memory");
	await expect(manageButton).toBeVisible({ timeout: 20_000 });
	await manageButton.click();

	const manager = page.getByTestId("memory-manager");
	await expect(manager).toBeVisible();
	await expect(page.getByTestId("memory-empty")).toBeVisible();

	// Capture a fact via the manual "remember this" input (auth-free, local-only).
	await page.getByTestId("memory-add-input").fill("I prefer concise answers");
	await page.getByTestId("memory-add-submit").click();

	// It appears in the list and the empty state is gone.
	await expect(page.getByTestId("memory-empty")).toHaveCount(0);
	const list = page.getByTestId("memory-list");
	await expect(list.locator("li")).toHaveCount(1);
	await expect(manager.getByText("I prefer concise answers")).toBeVisible();

	// Resolve the new memory id from the rendered row testid.
	const rowTestId = await list.locator('[data-testid^="memory-row-"]').first().getAttribute("data-testid");
	const memoryId = rowTestId!.replace("memory-row-", "");

	// Screenshot the memory manager with the captured fact.
	await page.screenshot({ path: "test-results/screenshots/memory-manager.png", fullPage: true });

	// Persisted to localStorage.
	const stored = await page.evaluate((k) => window.localStorage.getItem(k), MEMORY_KEY);
	expect(stored).toContain("I prefer concise answers");
	expect(stored).toContain(memoryId);

	// Persists across a full reload.
	await page.reload({ waitUntil: "domcontentloaded" });
	await expect(page.getByTestId("manage-memory")).toBeVisible({ timeout: 20_000 });
	await page.getByTestId("manage-memory").click();
	await expect(page.getByTestId("memory-manager")).toBeVisible();
	await expect(page.getByTestId(`memory-row-${memoryId}`)).toBeVisible();

	// Close the dialog (press Escape) before navigating.
	await page.keyboard.press("Escape");
	await expect(page.getByTestId("memory-manager")).toHaveCount(0);

	// INJECTION: navigate to a chat and confirm the saved memory is folded into the composed system
	// context. The indicator's count mirrors the enabled-memory set passed to injectMemories().
	await page.goto(`/chat/${SEED_CHAT}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
	const indicator = page.getByTestId("memory-injected-indicator");
	await expect(indicator).toBeVisible({ timeout: 20_000 });
	await expect(indicator).toHaveAttribute("data-memory-count", "1");
	await expect(indicator).toContainText("1 memory in context");
	await page.screenshot({ path: "test-results/screenshots/memory-injected.png", fullPage: true });

	// Back to the home page and reopen the manager to edit / toggle / delete.
	await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
	await expect(page.getByTestId("manage-memory")).toBeVisible({ timeout: 20_000 });
	await page.getByTestId("manage-memory").click();
	await expect(page.getByTestId("memory-manager")).toBeVisible();

	// Edit the memory's content.
	await page.getByTestId(`memory-edit-${memoryId}`).click();
	await page.getByTestId(`memory-edit-input-${memoryId}`).fill("I prefer detailed answers");
	await page.getByTestId(`memory-edit-save-${memoryId}`).click();
	await expect(page.getByTestId("memory-manager").getByText("I prefer detailed answers")).toBeVisible();
	await expect(page.getByTestId("memory-manager").getByText("I prefer concise answers")).toHaveCount(0);

	// Toggle it OFF: it is retained but should drop out of the injected set.
	await page.getByTestId(`memory-toggle-${memoryId}`).click();
	const afterToggle = await page.evaluate((k) => window.localStorage.getItem(k), MEMORY_KEY);
	expect(afterToggle).toContain('"enabled":false');

	await page.keyboard.press("Escape");
	await page.goto(`/chat/${SEED_CHAT}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
	// Disabled memory => no enabled memories => the indicator disappears.
	await expect(page.getByTestId("memory-injected-indicator")).toHaveCount(0, { timeout: 20_000 });

	// Delete the memory (two-step confirm) and confirm it stays gone in storage.
	await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
	await page.getByTestId("manage-memory").click();
	await expect(page.getByTestId("memory-manager")).toBeVisible();
	await page.getByTestId(`memory-delete-${memoryId}`).click();
	await page.getByTestId(`memory-confirm-delete-${memoryId}`).click();
	await expect(page.getByTestId(`memory-row-${memoryId}`)).toHaveCount(0);
	await expect(page.getByTestId("memory-empty")).toBeVisible();

	const storedAfter = await page.evaluate((k) => window.localStorage.getItem(k), MEMORY_KEY);
	expect(storedAfter).not.toContain("I prefer detailed answers");
});
