import { describe, expect, it } from "vitest";
import { parseMarkdownBlocks, stripInlineMarkdown } from "@/lib/export/markdown-blocks";

describe("stripInlineMarkdown", () => {
	it("removes bold, italic and inline code markers", () => {
		expect(stripInlineMarkdown("**bold** and _italic_ and `code`")).toBe("bold and italic and code");
	});

	it("reduces links and images to their text/alt", () => {
		expect(stripInlineMarkdown("see [docs](https://x.com) and ![alt](img.png)")).toBe("see docs and alt");
	});
});

describe("parseMarkdownBlocks", () => {
	it("parses headings with their level", () => {
		const blocks = parseMarkdownBlocks("# Title\n\n## Sub");
		expect(blocks).toEqual([
			{ type: "heading", level: 1, text: "Title" },
			{ type: "heading", level: 2, text: "Sub" },
		]);
	});

	it("joins wrapped lines into a single paragraph", () => {
		const blocks = parseMarkdownBlocks("one\ntwo\n\nthree");
		expect(blocks).toEqual([
			{ type: "paragraph", text: "one two" },
			{ type: "paragraph", text: "three" },
		]);
	});

	it("parses ordered and unordered list items with nesting level", () => {
		const md = ["- a", "  - b", "1. c"].join("\n");
		const blocks = parseMarkdownBlocks(md);
		expect(blocks).toEqual([
			{ type: "listItem", ordered: false, text: "a", level: 0 },
			{ type: "listItem", ordered: false, text: "b", level: 1 },
			{ type: "listItem", ordered: true, text: "c", level: 0 },
		]);
	});

	it("captures fenced code blocks with their language", () => {
		const md = ["```python", "print(1)", "x = 2", "```"].join("\n");
		const blocks = parseMarkdownBlocks(md);
		expect(blocks).toEqual([{ type: "code", text: "print(1)\nx = 2", language: "python" }]);
	});

	it("emits a hr block for a horizontal rule", () => {
		const blocks = parseMarkdownBlocks("a\n\n---\n\nb");
		expect(blocks.map((b) => b.type)).toEqual(["paragraph", "hr", "paragraph"]);
	});

	it("splices a table block in document order", () => {
		const md = ["intro", "", "| A | B |", "| - | - |", "| 1 | 2 |", "", "outro"].join("\n");
		const blocks = parseMarkdownBlocks(md);
		expect(blocks).toEqual([
			{ type: "paragraph", text: "intro" },
			{ type: "table", header: ["A", "B"], rows: [["1", "2"]] },
			{ type: "paragraph", text: "outro" },
		]);
	});
});
