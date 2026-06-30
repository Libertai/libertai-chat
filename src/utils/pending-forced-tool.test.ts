import { describe, expect, it } from "vitest";
import { setPendingForcedTool, consumePendingForcedTool } from "@/utils/pending-forced-tool";

describe("pending-forced-tool", () => {
	it("returns undefined when nothing is pending for the chat", () => {
		expect(consumePendingForcedTool("none")).toBeUndefined();
	});

	it("hands off a forced tool and consumes it exactly once", () => {
		setPendingForcedTool("c1", "web_search");
		expect(consumePendingForcedTool("c1")).toEqual({ tool: "web_search", searchType: undefined });
		expect(consumePendingForcedTool("c1")).toBeUndefined();
	});

	it("carries the chosen search mode alongside the tool", () => {
		setPendingForcedTool("c2", "web_search", "news");
		expect(consumePendingForcedTool("c2")).toEqual({ tool: "web_search", searchType: "news" });
	});

	it("keys pending tools per chat id", () => {
		setPendingForcedTool("a", "generate_image");
		setPendingForcedTool("b", "web_search", "academic");
		expect(consumePendingForcedTool("b")).toEqual({ tool: "web_search", searchType: "academic" });
		expect(consumePendingForcedTool("a")).toEqual({ tool: "generate_image", searchType: undefined });
	});
});
