import { describe, expect, it } from "vitest";
import { composeMemoryBlock, injectMemories, MEMORY_BLOCK_HEADER } from "@/utils/memory-injection";
import type { Memory } from "@/stores/memory";

const PERSONA = "You are a quick and nimble AI advisor.";

function mem(content: string, enabled = true): Memory {
	const now = new Date().toISOString();
	return { id: crypto.randomUUID(), content, enabled, createdAt: now, updatedAt: now };
}

describe("composeMemoryBlock", () => {
	it("returns an empty string when there are no memories", () => {
		expect(composeMemoryBlock([])).toBe("");
	});

	it("returns an empty string when all memories are disabled", () => {
		expect(composeMemoryBlock([mem("Vegetarian", false), mem("Lives in Berlin", false)])).toBe("");
	});

	it("renders enabled memories as a header + bullet list", () => {
		const out = composeMemoryBlock([mem("Prefers concise answers"), mem("Lives in Berlin")]);
		expect(out).toBe(`${MEMORY_BLOCK_HEADER}\n- Prefers concise answers\n- Lives in Berlin`);
	});

	it("skips disabled memories but keeps enabled ones", () => {
		const out = composeMemoryBlock([mem("Vegetarian"), mem("secret", false), mem("Likes TypeScript")]);
		expect(out).toBe(`${MEMORY_BLOCK_HEADER}\n- Vegetarian\n- Likes TypeScript`);
		expect(out).not.toContain("secret");
	});

	it("preserves the order it is given (caller sorts)", () => {
		const out = composeMemoryBlock([mem("first"), mem("second")]);
		expect(out.indexOf("first")).toBeLessThan(out.indexOf("second"));
	});
});

describe("injectMemories", () => {
	it("returns the base prompt unchanged when there are no enabled memories", () => {
		expect(injectMemories(PERSONA, [])).toBe(PERSONA);
		expect(injectMemories(PERSONA, [mem("x", false)])).toBe(PERSONA);
	});

	it("prepends the memory block ahead of the base prompt", () => {
		const out = injectMemories(PERSONA, [mem("Prefers concise answers")]);
		expect(out).toBe(`${MEMORY_BLOCK_HEADER}\n- Prefers concise answers\n\n${PERSONA}`);
		// Memories come first so they frame the whole conversation.
		expect(out.indexOf(MEMORY_BLOCK_HEADER)).toBeLessThan(out.indexOf(PERSONA));
	});

	it("trims the base prompt", () => {
		const out = injectMemories(`  ${PERSONA}  `, [mem("Likes tabs")]);
		expect(out.endsWith(PERSONA)).toBe(true);
	});

	it("returns the memory block alone when the base prompt is empty", () => {
		const out = injectMemories("", [mem("Likes tabs")]);
		expect(out).toBe(`${MEMORY_BLOCK_HEADER}\n- Likes tabs`);
	});

	it("returns an empty string when base is empty and no enabled memories", () => {
		expect(injectMemories("   ", [])).toBe("");
	});
});
