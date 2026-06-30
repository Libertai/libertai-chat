import { describe, expect, it, beforeEach } from "vitest";
import { useProjectStore } from "@/stores/project";
import { useChatStore } from "@/stores/chat";

function reset() {
	useProjectStore.setState({ projects: {} });
	useChatStore.setState({ chats: {}, legacyMigrated: true });
}

describe("project store CRUD", () => {
	beforeEach(() => {
		reset();
	});

	it("starts empty", () => {
		expect(useProjectStore.getState().getAllProjects()).toHaveLength(0);
	});

	it("creates a project with a trimmed name and no instructions by default", () => {
		const created = useProjectStore.getState().createProject({ name: "  Research  " });
		expect(created.name).toBe("Research");
		expect(created.instructions).toBeUndefined();

		const all = useProjectStore.getState().getAllProjects();
		expect(all).toHaveLength(1);
		expect(useProjectStore.getState().getProject(created.id)!.name).toBe("Research");
	});

	it("stores trimmed instructions when provided, and undefined for blank", () => {
		const withInstr = useProjectStore.getState().createProject({
			name: "Legal",
			instructions: "  Always cite statutes.  ",
		});
		expect(withInstr.instructions).toBe("Always cite statutes.");

		const blank = useProjectStore.getState().createProject({ name: "Blank", instructions: "   " });
		expect(blank.instructions).toBeUndefined();
	});

	it("renames a project", () => {
		const created = useProjectStore.getState().createProject({ name: "Old" });
		useProjectStore.getState().renameProject(created.id, "  New Name  ");
		expect(useProjectStore.getState().getProject(created.id)!.name).toBe("New Name");
	});

	it("sets and clears per-project instructions", () => {
		const created = useProjectStore.getState().createProject({ name: "P" });
		useProjectStore.getState().setProjectInstructions(created.id, "  Write in French.  ");
		expect(useProjectStore.getState().getProject(created.id)!.instructions).toBe("Write in French.");

		// Blank instructions clear the field back to undefined.
		useProjectStore.getState().setProjectInstructions(created.id, "   ");
		expect(useProjectStore.getState().getProject(created.id)!.instructions).toBeUndefined();
	});

	it("updateProject patches name and instructions together", () => {
		const created = useProjectStore.getState().createProject({ name: "P", instructions: "a" });
		useProjectStore.getState().updateProject(created.id, { name: "Q", instructions: "b" });
		const p = useProjectStore.getState().getProject(created.id)!;
		expect(p.name).toBe("Q");
		expect(p.instructions).toBe("b");
	});

	it("getProject returns undefined for missing / undefined ids", () => {
		expect(useProjectStore.getState().getProject(undefined)).toBeUndefined();
		expect(useProjectStore.getState().getProject("nope")).toBeUndefined();
	});

	it("deleting a project removes it but detaches (does NOT delete) its chats", () => {
		const project = useProjectStore.getState().createProject({ name: "Group A" });

		const chatStore = useChatStore.getState();
		chatStore.createChat("c1", "hello", "asst-1");
		chatStore.createChat("c2", "world", "asst-1");
		chatStore.setChatProject("c1", project.id);
		chatStore.setChatProject("c2", project.id);

		expect(useChatStore.getState().getChat("c1")!.projectId).toBe(project.id);

		useProjectStore.getState().deleteProject(project.id);

		// Project gone.
		expect(useProjectStore.getState().getProject(project.id)).toBeUndefined();
		// Chats survive, now ungrouped.
		expect(useChatStore.getState().getChat("c1")).toBeDefined();
		expect(useChatStore.getState().getChat("c1")!.projectId).toBeUndefined();
		expect(useChatStore.getState().getChat("c2")!.projectId).toBeUndefined();
	});

	it("getAllProjects sorts most-recently-updated first", () => {
		const a = useProjectStore.getState().createProject({ name: "A" });
		const b = useProjectStore.getState().createProject({ name: "B" });
		// Bump A so it becomes the most recent.
		useProjectStore.getState().renameProject(a.id, "A2");

		const all = useProjectStore.getState().getAllProjects();
		expect(all[0].id).toBe(a.id);
		expect(all[1].id).toBe(b.id);
	});
});

describe("chat store project membership", () => {
	beforeEach(() => {
		reset();
	});

	it("setChatProject moves a chat in and back out of a project", () => {
		const chatStore = useChatStore.getState();
		chatStore.createChat("c1", "hello", "asst-1");
		expect(useChatStore.getState().getChat("c1")!.projectId).toBeUndefined();

		chatStore.setChatProject("c1", "proj-1");
		expect(useChatStore.getState().getChat("c1")!.projectId).toBe("proj-1");

		chatStore.setChatProject("c1", undefined);
		expect(useChatStore.getState().getChat("c1")!.projectId).toBeUndefined();
	});

	it("setChatProject is a no-op for an unknown chat id", () => {
		useChatStore.getState().setChatProject("missing", "proj-1");
		expect(useChatStore.getState().getChat("missing")).toBeUndefined();
	});

	it("clearProjectFromChats only detaches chats in the given project", () => {
		const chatStore = useChatStore.getState();
		chatStore.createChat("c1", "a", "asst-1");
		chatStore.createChat("c2", "b", "asst-1");
		chatStore.createChat("c3", "c", "asst-1");
		chatStore.setChatProject("c1", "p1");
		chatStore.setChatProject("c2", "p1");
		chatStore.setChatProject("c3", "p2");

		chatStore.clearProjectFromChats("p1");

		expect(useChatStore.getState().getChat("c1")!.projectId).toBeUndefined();
		expect(useChatStore.getState().getChat("c2")!.projectId).toBeUndefined();
		// p2 chat untouched.
		expect(useChatStore.getState().getChat("c3")!.projectId).toBe("p2");
	});
});
