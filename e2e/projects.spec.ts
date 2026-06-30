import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Verifies the projects redesign: projects are created/listed on the dedicated /projects page (the
// sidebar only carries the Projects nav link + a flat Chats list, ChatGPT/Claude-style). A seeded
// chat is moved into a project via its chat menu; both chats stay visible in the flat Chats list and
// the assignment PERSISTS across a reload (localStorage 'libertai-chats' for the chat->project link
// and 'libertai-projects' for the project record). Per-project instructions are set from the project
// detail page (shared ProjectDialogs) and confirmed to persist.
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
			.getByTestId("nav-projects")
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

	// Create a project from the dedicated Projects page (no longer from the sidebar).
	await page.goto("/projects", { waitUntil: "domcontentloaded", timeout: 30_000 });
	await expect(page.getByTestId("projects-page")).toBeVisible();
	await page.getByTestId("projects-new").click();
	await page.getByTestId("project-name-input").fill("Work");
	await page.getByTestId("project-create-submit").click();

	// Resolve the new project id from its row on the index page.
	const row = page.locator('[data-testid^="projects-row-"]');
	await expect(row).toHaveCount(1);
	const projectId = (await row.getAttribute("data-testid"))!.replace("projects-row-", "");

	// Move chat A into the project from the sidebar chat menu ("Add to project").
	await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
	await openSidebar(page);
	await expect(page.getByTestId(`chat-row-${CHAT_A}`)).toBeVisible();
	await expect(page.getByTestId(`chat-row-${CHAT_B}`)).toBeVisible();
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

	// Set per-project instructions from the project detail page (shared ProjectDialogs).
	await page.goto(`/project/${projectId}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
	await page.getByTestId("project-detail-actions").click();
	await page.getByTestId("project-detail-settings").click();
	await page.getByTestId("project-settings-instructions").fill("Always answer in formal British English.");
	await page.getByTestId("project-settings-save").click();

	// Instructions persisted to the project store.
	const projectsAfter = await page.evaluate((k) => window.localStorage.getItem(k), PROJECTS_KEY);
	expect(projectsAfter).toContain("Always answer in formal British English.");

	// And they survive a reload of the detail page.
	await page.reload({ waitUntil: "domcontentloaded" });
	await page.getByTestId("project-detail-actions").click();
	await page.getByTestId("project-detail-settings").click();
	await expect(page.getByTestId("project-settings-instructions")).toHaveValue(
		"Always answer in formal British English.",
	);
});

test("projects index lists projects and filters by search", async ({ page }) => {
	await page.goto("/projects", { waitUntil: "domcontentloaded", timeout: 30_000 });
	const projectsPage = page.getByTestId("projects-page");
	await expect(projectsPage).toBeVisible();
	// Create two projects via the page's New button.
	for (const name of ["Travel", "Work"]) {
		await page.getByTestId("projects-new").click();
		await page.getByTestId("project-name-input").fill(name);
		await page.getByTestId("project-create-submit").click();
	}
	await expect(projectsPage.getByText("Travel")).toBeVisible();
	await expect(projectsPage.getByText("Work")).toBeVisible();
	await page.getByTestId("projects-search").fill("Trav");
	await expect(projectsPage.getByText("Travel")).toBeVisible();
	await expect(projectsPage.getByText("Work")).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Task 6: /project/$projectId detail page
// ---------------------------------------------------------------------------

const PROJECT_ID = "e2e-project-detail-001";
const PROJECT_CHAT_ID = "e2e-project-detail-chat-001";

function seedProjectWithChat(page: Page) {
	const now = new Date().toISOString();
	const projects = {
		state: {
			projects: {
				[PROJECT_ID]: {
					id: PROJECT_ID,
					name: "Design System",
					createdAt: now,
					updatedAt: now,
				},
			},
		},
		version: 1,
	};
	const chats = {
		state: {
			chats: {
				[PROJECT_CHAT_ID]: {
					id: PROJECT_CHAT_ID,
					assistantId: "6984ea23-1c6c-402e-adf0-1afddceec404",
					createdAt: now,
					updatedAt: now,
					title: "Color tokens",
					messages: [
						{
							id: "aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
							role: "user",
							content: "Help with color tokens",
							timestamp: now,
						},
					],
					projectId: PROJECT_ID,
				},
			},
			legacyMigrated: true,
		},
		version: 9,
	};
	return Promise.all([
		page.addInitScript(
			([key, value]) => {
				window.localStorage.setItem(key, value);
			},
			[PROJECTS_KEY, JSON.stringify(projects)] as const,
		),
		page.addInitScript(
			([key, value]) => {
				window.localStorage.setItem(key, value);
			},
			[CHATS_KEY, JSON.stringify(chats)] as const,
		),
	]);
}

function seedProjectNoChats(page: Page) {
	const now = new Date().toISOString();
	const projects = {
		state: {
			projects: {
				[PROJECT_ID]: {
					id: PROJECT_ID,
					name: "Design System",
					createdAt: now,
					updatedAt: now,
				},
			},
		},
		version: 1,
	};
	const chats = {
		state: {
			chats: {},
			legacyMigrated: true,
		},
		version: 9,
	};
	return Promise.all([
		page.addInitScript(
			([key, value]) => {
				window.localStorage.setItem(key, value);
			},
			[PROJECTS_KEY, JSON.stringify(projects)] as const,
		),
		page.addInitScript(
			([key, value]) => {
				window.localStorage.setItem(key, value);
			},
			[CHATS_KEY, JSON.stringify(chats)] as const,
		),
	]);
}

test("project detail page: shows project name, lists seeded chat, new-chat link points to project", async ({
	page,
}) => {
	await seedProjectWithChat(page);
	await page.goto(`/project/${PROJECT_ID}`, { waitUntil: "domcontentloaded", timeout: 30_000 });

	await expect(page.getByTestId("project-detail-page")).toBeVisible();
	await expect(page.getByTestId("project-detail-name")).toHaveText("Design System");

	// Seeded chat appears in the list.
	await expect(page.getByTestId("project-chats")).toBeVisible();
	await expect(page.getByTestId(`project-chat-${PROJECT_CHAT_ID}`)).toBeVisible();

	// New-chat link href encodes the project id.
	const newChatLink = page.getByTestId("project-new-chat");
	await expect(newChatLink).toBeVisible();
	const href = await newChatLink.getAttribute("href");
	expect(href).toContain(`project=${PROJECT_ID}`);
});

test("project detail page: shows empty state when project has no chats", async ({ page }) => {
	await seedProjectNoChats(page);
	await page.goto(`/project/${PROJECT_ID}`, { waitUntil: "domcontentloaded", timeout: 30_000 });

	await expect(page.getByTestId("project-detail-page")).toBeVisible();
	await expect(page.getByTestId("project-chats-empty")).toBeVisible();
});

test("project detail page: not-found state for unknown project id", async ({ page }) => {
	await page.goto("/project/does-not-exist", { waitUntil: "domcontentloaded", timeout: 30_000 });

	await expect(page.getByTestId("project-not-found")).toBeVisible();
});
