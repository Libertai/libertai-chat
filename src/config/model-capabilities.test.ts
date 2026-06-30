import { describe, expect, it } from "vitest";
import {
	supportsTools,
	supportsImages,
	isTeeAttested,
	chatModels,
	resolveChatModel,
} from "@/config/model-capabilities";
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

// Registry shaped like the real Aleph LTAI_PRICING: a TEE text model, a vision/tools text model,
// a reasoning text model, plus non-text entries (image / search) that are NOT chat-selectable.
const REGISTRY: Model[] = [
	{
		id: "hermes-3-8b-tee",
		name: "Hermes 3 8B (TEE)",
		capabilities: {
			text: { context_window: 16384, function_calling: false, reasoning: false, tee: true, vision: false },
		},
		pricing: {},
	},
	{
		id: "qwen3.6-35b-a3b",
		name: "Qwen3.6-35B-A3B",
		capabilities: {
			text: { context_window: 131072, function_calling: true, reasoning: false, tee: false, vision: true },
		},
		pricing: {},
	},
	{
		id: "qwen3.6-27b",
		name: "Qwen3.6-27B",
		capabilities: { text: { context_window: 65536, function_calling: true, reasoning: true, vision: false } },
		pricing: {},
	},
	{ id: "z-image-turbo", name: "Z-Image Turbo", capabilities: { image: true }, pricing: { image: 0.01 } },
	{ id: "search/google", name: "Search: Google", capabilities: { search: true }, pricing: { search: 0.005 } },
];

describe("chatModels", () => {
	it("keeps only text-capable models (drops image / search entries)", () => {
		expect(chatModels(REGISTRY).map((m) => m.id)).toEqual(["hermes-3-8b-tee", "qwen3.6-35b-a3b", "qwen3.6-27b"]);
	});

	it("returns an empty list for an empty registry", () => {
		expect(chatModels([])).toEqual([]);
	});
});

describe("isTeeAttested", () => {
	it("is true for a model flagged tee", () => {
		expect(isTeeAttested("hermes-3-8b-tee", REGISTRY)).toBe(true);
	});

	it("is false for a non-tee model", () => {
		expect(isTeeAttested("qwen3.6-35b-a3b", REGISTRY)).toBe(false);
	});

	it("is false when the optional tee flag is absent", () => {
		expect(isTeeAttested("qwen3.6-27b", REGISTRY)).toBe(false);
	});

	it("is false for an unknown model id", () => {
		expect(isTeeAttested("does-not-exist", REGISTRY)).toBe(false);
	});

	it("resolves the base model for a -thinking variant", () => {
		expect(isTeeAttested("hermes-3-8b-tee-thinking", REGISTRY)).toBe(true);
	});
});

describe("resolveChatModel", () => {
	it("uses the explicit per-chat model when present", () => {
		expect(resolveChatModel("hermes-3-8b-tee", "qwen3.6-35b-a3b")).toBe("hermes-3-8b-tee");
	});

	it("falls back to the persona model when no explicit choice", () => {
		expect(resolveChatModel(undefined, "qwen3.6-35b-a3b")).toBe("qwen3.6-35b-a3b");
	});

	it("treats an empty / whitespace override as no choice", () => {
		expect(resolveChatModel("", "qwen3.6-35b-a3b")).toBe("qwen3.6-35b-a3b");
		expect(resolveChatModel("   ", "qwen3.6-35b-a3b")).toBe("qwen3.6-35b-a3b");
	});

	it("lets the explicit choice decide capabilities (override beats persona)", () => {
		const persona = "qwen3.6-35b-a3b";
		const override = resolveChatModel("hermes-3-8b-tee", persona);
		expect(supportsImages(override, REGISTRY)).toBe(false);
		expect(supportsTools(override, REGISTRY)).toBe(false);
		// The original persona DID support them, proving the override actually changed behavior.
		expect(supportsImages(persona, REGISTRY)).toBe(true);
		expect(supportsTools(persona, REGISTRY)).toBe(true);
	});
});
