import { describe, expect, it } from "vitest";
import { ToolCallAccumulator } from "@/utils/tool-call-accumulator";

describe("ToolCallAccumulator", () => {
	it("assembles a single tool call from streamed fragments", () => {
		const acc = new ToolCallAccumulator();
		acc.add([{ index: 0, id: "call_1", type: "function", function: { name: "web_search", arguments: '{"qu' } }]);
		acc.add([{ index: 0, function: { arguments: 'ery":"rust"}' } }]);

		const calls = acc.finalize();
		expect(calls).toEqual([{ id: "call_1", name: "web_search", arguments: { query: "rust" } }]);
	});

	it("handles two parallel tool calls keyed by index", () => {
		const acc = new ToolCallAccumulator();
		acc.add([{ index: 0, id: "a", function: { name: "web_search", arguments: '{"query":"x"}' } }]);
		acc.add([{ index: 1, id: "b", function: { name: "generate_image", arguments: '{"prompt":"cat"}' } }]);

		const calls = acc.finalize();
		expect(calls).toHaveLength(2);
		expect(calls[1]).toEqual({ id: "b", name: "generate_image", arguments: { prompt: "cat" } });
	});

	it("returns empty arguments object when args are blank or invalid JSON", () => {
		const acc = new ToolCallAccumulator();
		acc.add([{ index: 0, id: "a", function: { name: "web_search", arguments: "" } }]);
		expect(acc.finalize()[0].arguments).toEqual({});
	});

	it("hasCalls reflects whether any tool call was seen", () => {
		const acc = new ToolCallAccumulator();
		expect(acc.hasCalls()).toBe(false);
		acc.add([{ index: 0, id: "a", function: { name: "web_search", arguments: "{}" } }]);
		expect(acc.hasCalls()).toBe(true);
	});
});
