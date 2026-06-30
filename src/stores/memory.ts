import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// A Memory is a single salient fact or preference the user wants the assistant to remember across
// ALL conversations (e.g. "I'm a vegetarian", "Prefers concise answers", "Lives in Berlin"). Unlike
// per-project instructions, memories are global and follow the user into every new chat.
//
// Memories are persisted client-side only (localStorage key 'libertai-memories'), exactly like
// chats, assistants and projects — NEVER a server. They are only ever transmitted as part of the
// normal inference request (prepended to the system context, see src/utils/memory-injection.ts),
// the same way the assistant persona and project instructions already are. Nothing about memory
// changes the privacy posture: it stays device-local until the user sends a message.
//
// A memory can be toggled off without deleting it (`enabled: false`) so the user can keep a fact
// around but stop injecting it. Only enabled memories are injected.
export interface Memory {
	id: string;
	// The fact/preference text, e.g. "Prefers TypeScript over JavaScript".
	content: string;
	// When false the memory is retained but excluded from the injected system context.
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
}

interface MemoryState {
	memories: Record<string, Memory>;
}

interface MemoryStore extends MemoryState {
	getMemory: (id: string) => Memory | undefined;
	// All memories, most-recently-updated first (matches the chat/project ordering convention).
	getAllMemories: () => Memory[];
	// Only the enabled memories, newest first — the set that gets injected into the system context.
	getEnabledMemories: () => Memory[];
	// Manual "remember this" capture. Trimmed; blank content is ignored (returns undefined). This is
	// the auth-free manual path: it never touches the network, just stores a fact locally.
	addMemory: (content: string) => Memory | undefined;
	updateMemory: (id: string, content: string) => void;
	setMemoryEnabled: (id: string, enabled: boolean) => void;
	deleteMemory: (id: string) => void;
	clearMemories: () => void;
}

export const useMemoryStore = create<MemoryStore>()(
	persist(
		(set, get) => ({
			memories: {},

			getMemory: (id: string) => get().memories[id],

			getAllMemories: () => {
				return Object.values(get().memories).sort(
					(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
				);
			},

			getEnabledMemories: () => {
				return Object.values(get().memories)
					.filter((m) => m.enabled)
					.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
			},

			addMemory: (content: string) => {
				const trimmed = content.trim();
				if (!trimmed) return undefined;
				const now = new Date().toISOString();
				const created: Memory = {
					id: crypto.randomUUID(),
					content: trimmed,
					enabled: true,
					createdAt: now,
					updatedAt: now,
				};
				set((state) => ({ memories: { ...state.memories, [created.id]: created } }));
				return created;
			},

			updateMemory: (id: string, content: string) => {
				set((state) => {
					const memory = state.memories[id];
					if (!memory) return state;
					const trimmed = content.trim();
					// An empty edit is treated as a no-op rather than silently blanking the fact; use
					// deleteMemory to remove one.
					if (!trimmed) return state;
					return {
						memories: {
							...state.memories,
							[id]: { ...memory, content: trimmed, updatedAt: new Date().toISOString() },
						},
					};
				});
			},

			setMemoryEnabled: (id: string, enabled: boolean) => {
				set((state) => {
					const memory = state.memories[id];
					if (!memory) return state;
					return {
						memories: {
							...state.memories,
							[id]: { ...memory, enabled, updatedAt: new Date().toISOString() },
						},
					};
				});
			},

			deleteMemory: (id: string) => {
				set((state) => {
					const { [id]: _deleted, ...remaining } = state.memories;
					return { memories: remaining };
				});
			},

			clearMemories: () => set({ memories: {} }),
		}),
		{
			name: "libertai-memories",
			version: 1,
			storage: createJSONStorage(() => localStorage),
		},
	),
);
