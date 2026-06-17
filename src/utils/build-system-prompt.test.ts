import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/utils/build-system-prompt";

const PERSONA = "You are a quick and nimble AI advisor.";
const PROJECT = "Always answer in formal British English and cite sources.";

describe("buildSystemPrompt", () => {
	it("returns just the persona prompt when there are no project instructions", () => {
		expect(buildSystemPrompt(PERSONA)).toBe(PERSONA);
		expect(buildSystemPrompt(PERSONA, undefined)).toBe(PERSONA);
	});

	it("returns just the persona prompt when project instructions are blank", () => {
		expect(buildSystemPrompt(PERSONA, "   ")).toBe(PERSONA);
		expect(buildSystemPrompt(PERSONA, "\n\n")).toBe(PERSONA);
	});

	it("prepends project instructions before the persona prompt", () => {
		const out = buildSystemPrompt(PERSONA, PROJECT);
		expect(out).toBe(`${PROJECT}\n\n${PERSONA}`);
		// Project guidance comes first.
		expect(out.indexOf(PROJECT)).toBeLessThan(out.indexOf(PERSONA));
	});

	it("trims surrounding whitespace on both parts", () => {
		const out = buildSystemPrompt(`  ${PERSONA}  `, `  ${PROJECT}  `);
		expect(out).toBe(`${PROJECT}\n\n${PERSONA}`);
	});

	it("returns just the project instructions when the persona prompt is empty", () => {
		expect(buildSystemPrompt("", PROJECT)).toBe(PROJECT);
		expect(buildSystemPrompt("   ", PROJECT)).toBe(PROJECT);
	});

	it("returns an empty string when both are empty", () => {
		expect(buildSystemPrompt("", "")).toBe("");
		expect(buildSystemPrompt("   ", "   ")).toBe("");
	});
});
