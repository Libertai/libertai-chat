import { describe, expect, it } from "vitest";
import { supportsTools, supportsImages } from "@/config/model-capabilities";
import type { Model } from "@/hooks/data/use-models";

const model = (id: string, fc: boolean, vision: boolean): Model =>
	({
		id,
		name: id,
		capabilities: { text: { context_window: 1, function_calling: fc, reasoning: false, vision } },
	}) as unknown as Model;

describe("supportsTools", () => {
	const models = [model("qwen3.6-35b-a3b", true, true), model("hermes", false, false)];

	it("is true when the model advertises function_calling", () => {
		expect(supportsTools("qwen3.6-35b-a3b", models)).toBe(true);
	});

	it("is false when the model lacks function_calling", () => {
		expect(supportsTools("hermes", models)).toBe(false);
	});

	it("strips the -thinking suffix before lookup", () => {
		expect(supportsTools("qwen3.6-35b-a3b-thinking", models)).toBe(true);
	});

	it("is false for unknown models", () => {
		expect(supportsTools("nope", models)).toBe(false);
	});

	it("keeps supportsImages working (regression)", () => {
		expect(supportsImages("qwen3.6-35b-a3b", models)).toBe(true);
	});
});
