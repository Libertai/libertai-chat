import { describe, expect, it } from "vitest";
import { setPendingForcedTool, consumePendingForcedTool } from "@/utils/pending-forced-tool";

describe("pending-forced-tool", () => {
	it("returns undefined when nothing is pending for the chat", () => {
		expect(consumePendingForcedTool("none")).toBeUndefined();
	});

	it("hands off a forced tool and consumes it exactly once", () => {
		setPendingForcedTool("c1", "web_search");
		expect(consumePendingForcedTool("c1")).toBe("web_search");
		expect(consumePendingForcedTool("c1")).toBeUndefined();
	});

	it("keys pending tools per chat id", () => {
		setPendingForcedTool("a", "generate_image");
		setPendingForcedTool("b", "web_search");
		expect(consumePendingForcedTool("b")).toBe("web_search");
		expect(consumePendingForcedTool("a")).toBe("generate_image");
	});
});
