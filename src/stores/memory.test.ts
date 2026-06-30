import { describe, expect, it, beforeEach } from "vitest";
import { useMemoryStore } from "@/stores/memory";

function reset() {
	useMemoryStore.setState({ memories: {} });
}

describe("memory store CRUD", () => {
	beforeEach(() => {
		reset();
	});

	it("starts empty", () => {
		expect(useMemoryStore.getState().getAllMemories()).toHaveLength(0);
		expect(useMemoryStore.getState().getEnabledMemories()).toHaveLength(0);
	});

	it("adds a memory with trimmed content, enabled by default", () => {
		const created = useMemoryStore.getState().addMemory("  I prefer concise answers  ");
		expect(created).toBeDefined();
		expect(created!.content).toBe("I prefer concise answers");
		expect(created!.enabled).toBe(true);

		const all = useMemoryStore.getState().getAllMemories();
		expect(all).toHaveLength(1);
		expect(useMemoryStore.getState().getMemory(created!.id)!.content).toBe("I prefer concise answers");
	});

	it("ignores blank captures (returns undefined, stores nothing)", () => {
		expect(useMemoryStore.getState().addMemory("   ")).toBeUndefined();
		expect(useMemoryStore.getState().addMemory("")).toBeUndefined();
		expect(useMemoryStore.getState().getAllMemories()).toHaveLength(0);
	});

	it("updates a memory's content (trimmed); blank edit is a no-op", () => {
		const created = useMemoryStore.getState().addMemory("Lives in Berlin")!;
		useMemoryStore.getState().updateMemory(created.id, "  Lives in Munich  ");
		expect(useMemoryStore.getState().getMemory(created.id)!.content).toBe("Lives in Munich");

		// Blank edit does not wipe the fact.
		useMemoryStore.getState().updateMemory(created.id, "   ");
		expect(useMemoryStore.getState().getMemory(created.id)!.content).toBe("Lives in Munich");
	});

	it("toggles a memory's enabled flag, affecting getEnabledMemories", () => {
		const created = useMemoryStore.getState().addMemory("Vegetarian")!;
		expect(useMemoryStore.getState().getEnabledMemories()).toHaveLength(1);

		useMemoryStore.getState().setMemoryEnabled(created.id, false);
		expect(useMemoryStore.getState().getMemory(created.id)!.enabled).toBe(false);
		// Retained but excluded from the injected set.
		expect(useMemoryStore.getState().getAllMemories()).toHaveLength(1);
		expect(useMemoryStore.getState().getEnabledMemories()).toHaveLength(0);

		useMemoryStore.getState().setMemoryEnabled(created.id, true);
		expect(useMemoryStore.getState().getEnabledMemories()).toHaveLength(1);
	});

	it("deletes a memory", () => {
		const a = useMemoryStore.getState().addMemory("a")!;
		const b = useMemoryStore.getState().addMemory("b")!;
		useMemoryStore.getState().deleteMemory(a.id);
		expect(useMemoryStore.getState().getMemory(a.id)).toBeUndefined();
		expect(useMemoryStore.getState().getMemory(b.id)).toBeDefined();
		expect(useMemoryStore.getState().getAllMemories()).toHaveLength(1);
	});

	it("clearMemories removes everything", () => {
		useMemoryStore.getState().addMemory("a");
		useMemoryStore.getState().addMemory("b");
		useMemoryStore.getState().clearMemories();
		expect(useMemoryStore.getState().getAllMemories()).toHaveLength(0);
	});

	it("getAllMemories / getEnabledMemories sort most-recently-updated first", async () => {
		const a = useMemoryStore.getState().addMemory("A")!;
		// Ensure a distinct timestamp so ordering is deterministic.
		await new Promise((r) => setTimeout(r, 2));
		useMemoryStore.getState().addMemory("B");
		// Bump A so it becomes the most recent.
		await new Promise((r) => setTimeout(r, 2));
		useMemoryStore.getState().updateMemory(a.id, "A2");

		const all = useMemoryStore.getState().getAllMemories();
		expect(all[0].id).toBe(a.id);
		expect(all[0].content).toBe("A2");
	});

	it("updates / toggles / deletes are no-ops for unknown ids", () => {
		useMemoryStore.getState().updateMemory("nope", "x");
		useMemoryStore.getState().setMemoryEnabled("nope", false);
		useMemoryStore.getState().deleteMemory("nope");
		expect(useMemoryStore.getState().getAllMemories()).toHaveLength(0);
		expect(useMemoryStore.getState().getMemory("nope")).toBeUndefined();
	});
});
