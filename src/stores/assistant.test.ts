import { describe, expect, it, beforeEach } from "vitest";
import { useAssistantStore } from "@/stores/assistant";

// The default "Light" persona id, also the default selection.
const LIGHT_ID = "6984ea23-1c6c-402e-adf0-1afddceec404";
const BUILTIN_COUNT = 6;

function reset() {
	// Clear all persisted slices, then trigger a recompute of the derived `assistants` array.
	// `deleteAssistant` with a non-existent id is a no-op on the slices but always recomputes.
	useAssistantStore.setState({
		customAssistants: [],
		builtinOverrides: {},
		selectedAssistant: LIGHT_ID,
	});
	useAssistantStore.getState().deleteAssistant("__none__");
}

describe("assistant store CRUD", () => {
	beforeEach(() => {
		reset();
	});

	it("exposes the 6 built-in personas with the default selected", () => {
		const state = useAssistantStore.getState();
		expect(state.assistants).toHaveLength(BUILTIN_COUNT);
		expect(state.assistants.every((a) => a.builtin)).toBe(true);
		expect(state.selectedAssistant).toBe(LIGHT_ID);
		expect(state.getAssistantOrDefault().id).toBe(LIGHT_ID);
	});

	it("creates a custom assistant that appears in the merged list", () => {
		const created = useAssistantStore.getState().createAssistant({
			title: "My Helper",
			subtitle: "Does my thing",
			model: "qwen3.6-35b-a3b",
			systemPrompt: "You are my helper.",
			emoji: "🛠️",
		});

		const state = useAssistantStore.getState();
		expect(state.customAssistants).toHaveLength(1);
		expect(state.assistants).toHaveLength(BUILTIN_COUNT + 1);
		// Built-ins come first, custom appended.
		expect(state.assistants[BUILTIN_COUNT].id).toBe(created.id);
		const found = state.getAssistant(created.id)!;
		expect(found.title).toBe("My Helper");
		expect(found.systemPrompt).toBe("You are my helper.");
		expect(found.emoji).toBe("🛠️");
		expect(found.builtin).toBe(false);
		// Custom assistants never carry a JSX icon (keeps them serializable).
		expect(found.icon).toBeUndefined();
	});

	it("updates a custom assistant in place", () => {
		const created = useAssistantStore.getState().createAssistant({
			title: "Draft",
			subtitle: "v1",
			model: "qwen3.6-35b-a3b",
			systemPrompt: "p1",
		});

		useAssistantStore.getState().updateAssistant(created.id, { title: "Final", systemPrompt: "p2" });

		const found = useAssistantStore.getState().getAssistant(created.id)!;
		expect(found.title).toBe("Final");
		expect(found.systemPrompt).toBe("p2");
		expect(found.subtitle).toBe("v1"); // untouched fields preserved
	});

	it("deletes a custom assistant and resets selection to default when it was selected", () => {
		const created = useAssistantStore.getState().createAssistant({
			title: "Temp",
			subtitle: "",
			model: "qwen3.6-35b-a3b",
			systemPrompt: "p",
		});
		useAssistantStore.getState().setSelectedAssistant(created.id);
		expect(useAssistantStore.getState().selectedAssistant).toBe(created.id);

		useAssistantStore.getState().deleteAssistant(created.id);

		const state = useAssistantStore.getState();
		expect(state.getAssistant(created.id)).toBeUndefined();
		expect(state.assistants).toHaveLength(BUILTIN_COUNT);
		// Selection fell back to the default persona.
		expect(state.selectedAssistant).toBe(LIGHT_ID);
	});

	it("never deletes a built-in persona", () => {
		useAssistantStore.getState().deleteAssistant(LIGHT_ID);
		expect(useAssistantStore.getState().assistants).toHaveLength(BUILTIN_COUNT);
		expect(useAssistantStore.getState().getAssistant(LIGHT_ID)).toBeDefined();
	});

	it("overrides editable fields of a built-in and keeps its JSX icon", () => {
		useAssistantStore.getState().updateAssistant(LIGHT_ID, {
			title: "Lightning",
			systemPrompt: "Be very fast.",
		});

		const found = useAssistantStore.getState().getAssistant(LIGHT_ID)!;
		expect(found.title).toBe("Lightning");
		expect(found.systemPrompt).toBe("Be very fast.");
		expect(found.builtin).toBe(true);
		// The shipped JSX icon survives the override (only persisted fields are merged).
		expect(found.icon).toBeDefined();
		// The override slice is what gets persisted, not the full assistant.
		expect(useAssistantStore.getState().builtinOverrides[LIGHT_ID]).toMatchObject({
			title: "Lightning",
			systemPrompt: "Be very fast.",
		});
	});

	it("resets a built-in back to its shipped definition", () => {
		useAssistantStore.getState().updateAssistant(LIGHT_ID, { title: "Renamed" });
		expect(useAssistantStore.getState().getAssistant(LIGHT_ID)!.title).toBe("Renamed");

		useAssistantStore.getState().resetAssistant(LIGHT_ID);

		const found = useAssistantStore.getState().getAssistant(LIGHT_ID)!;
		expect(found.title).toBe("Light");
		expect(useAssistantStore.getState().builtinOverrides[LIGHT_ID]).toBeUndefined();
	});

	it("selected assistant's prompt/model is what getAssistantOrDefault returns for new chats", () => {
		const created = useAssistantStore.getState().createAssistant({
			title: "Coder",
			subtitle: "writes code",
			model: "qwen3.6-27b-thinking",
			systemPrompt: "You only write code.",
		});
		useAssistantStore.getState().setSelectedAssistant(created.id);

		const selected = useAssistantStore.getState().getAssistantOrDefault();
		expect(selected.id).toBe(created.id);
		expect(selected.systemPrompt).toBe("You only write code.");
		expect(selected.model).toBe("qwen3.6-27b-thinking");
	});
});
