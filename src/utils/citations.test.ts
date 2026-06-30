import { describe, expect, it } from "vitest";
import { citationAnchorId, hasCitations, parseCitations } from "@/utils/citations";

describe("parseCitations", () => {
	it("returns a single text segment when there are no markers", () => {
		expect(parseCitations("plain text", 3)).toEqual([{ type: "text", value: "plain text" }]);
	});

	it("splits in-range markers into citation segments", () => {
		expect(parseCitations("Foo [1] bar [2].", 2)).toEqual([
			{ type: "text", value: "Foo " },
			{ type: "cite", n: 1 },
			{ type: "text", value: " bar " },
			{ type: "cite", n: 2 },
			{ type: "text", value: "." },
		]);
	});

	it("leaves out-of-range markers as literal text", () => {
		// Only 1 source, so [2] and [5] are not real citations.
		expect(parseCitations("a [1] b [2] c [5]", 1)).toEqual([
			{ type: "text", value: "a " },
			{ type: "cite", n: 1 },
			{ type: "text", value: " b [2] c [5]" },
		]);
	});

	it("treats every marker as text when there are no sources", () => {
		expect(parseCitations("see [1] and [2]", 0)).toEqual([{ type: "text", value: "see [1] and [2]" }]);
	});

	it("handles multi-digit citation numbers", () => {
		expect(parseCitations("ref [12]", 12)).toEqual([
			{ type: "text", value: "ref " },
			{ type: "cite", n: 12 },
		]);
	});

	it("handles a marker at the very start with no trailing text", () => {
		expect(parseCitations("[1]", 1)).toEqual([{ type: "cite", n: 1 }]);
	});
});

describe("hasCitations", () => {
	it("is true only when at least one in-range marker exists", () => {
		expect(hasCitations("text [1]", 1)).toBe(true);
		expect(hasCitations("text [2]", 1)).toBe(false);
		expect(hasCitations("text", 3)).toBe(false);
	});
});

describe("citationAnchorId", () => {
	it("scopes the anchor id per message and number", () => {
		expect(citationAnchorId("msg-abc", 3)).toBe("cite-msg-abc-3");
	});
});
