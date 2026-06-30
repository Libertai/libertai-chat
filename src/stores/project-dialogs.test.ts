import { describe, expect, it, beforeEach } from "vitest";
import { useProjectDialogStore } from "@/stores/project-dialogs";
import type { Project } from "@/stores/project";

const project: Project = {
	id: "p1",
	name: "Travel",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("useProjectDialogStore", () => {
	beforeEach(() => {
		useProjectDialogStore.setState({ createOpen: false, settingsProject: null });
	});

	it("opens and closes the create dialog", () => {
		useProjectDialogStore.getState().openCreate();
		expect(useProjectDialogStore.getState().createOpen).toBe(true);
		useProjectDialogStore.getState().closeCreate();
		expect(useProjectDialogStore.getState().createOpen).toBe(false);
	});

	it("opens settings for a specific project and clears it on close", () => {
		useProjectDialogStore.getState().openSettings(project);
		expect(useProjectDialogStore.getState().settingsProject?.id).toBe("p1");
		useProjectDialogStore.getState().closeSettings();
		expect(useProjectDialogStore.getState().settingsProject).toBeNull();
	});
});
