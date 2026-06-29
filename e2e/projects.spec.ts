import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Verifies the flat-sidebar projects redesign: from the sidebar a user creates a project (flat row
// linking to /project/:id), moves a seeded chat into it, confirms both chats remain visible in the
// flat Chats list, and confirms the assignment PERSISTS across a full reload (localStorage keys
// 'libertai-chats' for the chat->project link and 'libertai-projects' for the project record).
// Then sets per-project instructions via the shared ProjectDialogs and confirms those persist too.
//
// The app has a guest/logged-out mode, so the whole flow runs WITHOUT a wallet. We seed two chats
// directly into localStorage so the sidebar ChatList renders deterministically with real data.

mkdirSync("test-results/screenshots", { recursive: true });

const CHAT_A = "e2e-project-chat-a";
const CHAT_B = "e2e-project-chat-b";
const CHATS_KEY = "libertai-chats";
const PROJECTS_KEY = "libertai-projects";

function seedChats(page: Page) {
	const now = new Date().toISOString();
	const persisted = {
		state: {
			chats: {
				[CHAT_A]: {
					id: CHAT_A,
					assistantId: "6984ea23-1c6c-402e-adf0-1afddceec404",
					createdAt: now,
					updatedAt: now,
					title: "Quarterly report",
					messages: [
						{ id: "11111111-1111-4111-8111-111111111111", role: "user", content: "draft a report", timestamp: now },
						{ id: "22222222-2222-4222-8222-222222222222", role: "assistant", content: "Sure!", timestamp: now },
					],
				},
				[CHAT_B]: {
					id: CHAT_B,
					assistantId: "6984ea23-1c6c-402e-adf0-1afddceec404",
					createdAt: now,
					// Slightly older so ordering is deterministic.
					updatedAt: new Date(Date.now() - 60_000).toISOString(),
					title: "Random thoughts",
					messages: [
						{ id: "33333333-3333-4333-8333-333333333333", role: "user", content: "hi", timestamp: now },
						{ id: "44444444-4444-4444-8444-444444444444", role: "assistant", content: "Hello!", timestamp: now },
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

async function openSidebar(page: Page) {
	// The desktop sidebar starts offcanvas (collapsed); its content is in the DOM but positioned
	// off-screen until expanded. We drive open-state off the sidebar wrapper's data-state rather
	// than the list's visibility (an offcanvas list still reports visible). Click whichever toggle
	// is currently visible (mobile header vs desktop header) until expanded.
	const desktopSidebar = page.locator('[data-slot="sidebar"][data-state]');
	const list = page.getByTestId("chat-list");
	for (let attempt = 0; attempt < 3; attempt++) {
		const state = await desktopSidebar
			.first()
			.getAttribute("data-state")
			.catch(() => null);
		const inViewport = await page
			.getByTestId("create-project")
			.first()
			.evaluate((el) => {
				const r = el.getBoundingClientRect();
				return r.left >= 0 && r.right <= window.innerWidth && r.width > 0;
			})
			.catch(() => false);
		if (state === "expanded" && inViewport) break;
		const triggers = page.getByRole("button", { name: /toggle sidebar/i });
		const count = await triggers.count();
		for (let i = 0; i < count; i++) {
			const t = triggers.nth(i);
			if (await t.isVisible().catch(() => false)) {
				await t.click();
				break;
			}
		}
		await page.waitForTimeout(400);
	}
	await expect(list).toBeVisible({ timeout: 20_000 });
}

test("create a project, move a chat into it, persist across reload, and set instructions", async ({ page }) => {
	await seedChats(page);
	await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
	await openSidebar(page);

	// Both seeded chats are visible in the flat Chats list at start.
	await expect(page.getByTestId(`chat-row-${CHAT_A}`)).toBeVisible();
	await expect(page.getByTestId(`chat-row-${CHAT_B}`)).toBeVisible();

	// Create a project from the sidebar header button (flat Projects section).
	await page.getByTestId("create-project").first().click();
	await page.getByTestId("project-name-input").fill("Work");
	await page.getByTestId("project-create-submit").click();

	// A flat project row appears in the Projects section.
	const projectGroup = page.locator('[data-testid^="project-group-"]');
	await expect(projectGroup).toHaveCount(1);
	await expect(page.getByText("Work")).toBeVisible();

	// Resolve the new project id from the rendered group testid.
	const groupTestId = await projectGroup.getAttribute("data-testid");
	const projectId = groupTestId!.replace("project-group-", "");

	// Move chat A into the project via its actions menu -> "Move to project" submenu.
	await page.getByTestId(`chat-row-${CHAT_A}`).hover();
	await page.getByTestId(`chat-actions-${CHAT_A}`).click();
	await page.getByTestId(`chat-move-${CHAT_A}`).click();
	await page.getByTestId(`chat-move-to-${projectId}-${CHAT_A}`).click();

	// After moving: BOTH chats remain visible in the flat Chats list (project chats stay in list).
	await expect(page.getByTestId(`chat-row-${CHAT_A}`)).toBeVisible();
	await expect(page.getByTestId(`chat-row-${CHAT_B}`)).toBeVisible();

	// Persisted: the chat carries the projectId and the project record exists.
	const chatsStored = await page.evaluate((k) => window.localStorage.getItem(k), CHATS_KEY);
	expect(chatsStored).toContain(projectId);
	const projectsStored = await page.evaluate((k) => window.localStorage.getItem(k), PROJECTS_KEY);
	expect(projectsStored).toContain("Work");
	expect(projectsStored).toContain(projectId);

	// Screenshot the flat sidebar.
	await page.screenshot({ path: "test-results/screenshots/projects-sidebar.png", fullPage: true });

	// Flat layout persists across a full reload.
	await page.reload({ waitUntil: "domcontentloaded" });
	await openSidebar(page);
	await expect(page.getByTestId(`project-group-${projectId}`)).toBeVisible();
	await expect(page.getByTestId(`chat-row-${CHAT_A}`)).toBeVisible();
	await expect(page.getByTestId(`chat-row-${CHAT_B}`)).toBeVisible();

	// Set per-project instructions via the project settings dialog (shared ProjectDialogs).
	await page.getByTestId(`project-actions-${projectId}`).click();
	await page.getByTestId(`project-settings-${projectId}`).click();
	await page.getByTestId("project-settings-instructions").fill("Always answer in formal British English.");
	await page.getByTestId("project-settings-save").click();

	// Instructions persisted to the project store.
	const projectsAfter = await page.evaluate((k) => window.localStorage.getItem(k), PROJECTS_KEY);
	expect(projectsAfter).toContain("Always answer in formal British English.");

	// And they survive a reload.
	await page.reload({ waitUntil: "domcontentloaded" });
	await openSidebar(page);
	await page.getByTestId(`project-actions-${projectId}`).click();
	await page.getByTestId(`project-settings-${projectId}`).click();
	await expect(page.getByTestId("project-settings-instructions")).toHaveValue(
		"Always answer in formal British English.",
	);
});
