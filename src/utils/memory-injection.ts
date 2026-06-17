import type { Memory } from "@/stores/memory";

// Header that frames the user's saved memories inside the system context. Kept short and explicit
// so the model treats the lines as durable facts about the user rather than instructions for the
// current turn.
export const MEMORY_BLOCK_HEADER =
	"What you know about the user (saved memories, may be relevant across topics):";

// Render the enabled memories as a single system-context block, or "" when there are none. Pure
// function — no store/IO — so it can be unit tested directly and reused by the chat route.
//
// Each memory becomes a "- " bullet; blank/whitespace-only entries are skipped defensively even
// though the store already trims on write. Order is preserved (the caller passes newest-first).
export function composeMemoryBlock(memories: Memory[]): string {
	const lines = memories
		.filter((m) => m.enabled)
		.map((m) => m.content.trim())
		.filter((c) => c.length > 0)
		.map((c) => `- ${c}`);
	if (lines.length === 0) return "";
	return [MEMORY_BLOCK_HEADER, ...lines].join("\n");
}

// Prepend the user's memories to an already-composed base system prompt (persona + optional project
// instructions). Memories come FIRST so the model frames the whole conversation with what it knows
// about the user, mirroring how project instructions sit ahead of the persona prompt.
//
// Returns the base prompt unchanged when there are no enabled memories, and the memory block alone
// when the base is empty. Pure — unit testable, no IO.
export function injectMemories(baseSystemPrompt: string, memories: Memory[]): string {
	const block = composeMemoryBlock(memories);
	const base = baseSystemPrompt.trim();
	if (!block) return base;
	if (!base) return block;
	return `${block}\n\n${base}`;
}
