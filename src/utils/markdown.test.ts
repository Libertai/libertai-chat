import { describe, expect, it } from "vitest";
import {
	extractLanguageFromClassName,
	resolveCodeLanguage,
	isMermaidLanguage,
	nodeChildrenToText,
	normalizeCodeSource,
	hastText,
} from "@/utils/markdown";

describe("extractLanguageFromClassName", () => {
	it("pulls the language token out of a language-* class", () => {
		expect(extractLanguageFromClassName("language-js")).toBe("js");
		expect(extractLanguageFromClassName("hljs language-python extra")).toBe("python");
		expect(extractLanguageFromClassName("language-objective-c")).toBe("objective-c");
	});

	it("lowercases the token", () => {
		expect(extractLanguageFromClassName("language-TypeScript")).toBe("typescript");
	});

	it("returns undefined when there is no language class", () => {
		expect(extractLanguageFromClassName(undefined)).toBeUndefined();
		expect(extractLanguageFromClassName("")).toBeUndefined();
		expect(extractLanguageFromClassName("some-other-class")).toBeUndefined();
	});
});

describe("resolveCodeLanguage", () => {
	it("maps aliases to canonical Shiki ids", () => {
		expect(resolveCodeLanguage("js")).toBe("javascript");
		expect(resolveCodeLanguage("ts")).toBe("typescript");
		expect(resolveCodeLanguage("py")).toBe("python");
		expect(resolveCodeLanguage("sh")).toBe("bash");
		expect(resolveCodeLanguage("rs")).toBe("rust");
	});

	it("passes through canonical ids", () => {
		expect(resolveCodeLanguage("javascript")).toBe("javascript");
		expect(resolveCodeLanguage("json")).toBe("json");
	});

	it("is case-insensitive", () => {
		expect(resolveCodeLanguage("JS")).toBe("javascript");
	});

	it("returns undefined for unknown or missing languages", () => {
		expect(resolveCodeLanguage(undefined)).toBeUndefined();
		expect(resolveCodeLanguage("brainfuck")).toBeUndefined();
	});
});

describe("isMermaidLanguage", () => {
	it("detects mermaid fenced blocks", () => {
		expect(isMermaidLanguage("mermaid")).toBe(true);
		expect(isMermaidLanguage("Mermaid")).toBe(true);
	});

	it("rejects everything else", () => {
		expect(isMermaidLanguage("js")).toBe(false);
		expect(isMermaidLanguage(undefined)).toBe(false);
		expect(isMermaidLanguage("mermaidx")).toBe(false);
	});
});

describe("nodeChildrenToText", () => {
	it("handles strings, numbers, arrays and nullish", () => {
		expect(nodeChildrenToText("hello")).toBe("hello");
		expect(nodeChildrenToText(42)).toBe("42");
		expect(nodeChildrenToText(["a", "b", "c"])).toBe("abc");
		expect(nodeChildrenToText(["line1\n", "line2"])).toBe("line1\nline2");
		expect(nodeChildrenToText(null)).toBe("");
		expect(nodeChildrenToText(undefined)).toBe("");
	});

	it("ignores non-text react nodes", () => {
		expect(nodeChildrenToText({ type: "span" })).toBe("");
	});
});

describe("normalizeCodeSource", () => {
	it("strips a single trailing newline", () => {
		expect(normalizeCodeSource("const x = 1;\n")).toBe("const x = 1;");
	});

	it("keeps interior newlines and content without a trailing newline", () => {
		expect(normalizeCodeSource("a\nb\nc")).toBe("a\nb\nc");
		expect(normalizeCodeSource("a\nb\n")).toBe("a\nb");
	});
});

describe("hastText", () => {
	it("returns the value of a text node", () => {
		expect(hastText({ type: "text", value: "hello" })).toBe("hello");
	});

	it("concatenates text across nested element children", () => {
		const node = {
			type: "element",
			children: [
				{ type: "text", value: "const x = 1;\n" },
				{
					type: "element",
					children: [{ type: "text", value: "const y = 2;\n" }],
				},
			],
		};
		expect(hastText(node)).toBe("const x = 1;\nconst y = 2;\n");
	});

	it("handles missing/nullish nodes and value-less elements", () => {
		expect(hastText(undefined)).toBe("");
		expect(hastText(null)).toBe("");
		expect(hastText({ type: "element" })).toBe("");
		expect(hastText({ type: "text" })).toBe("");
	});
});
