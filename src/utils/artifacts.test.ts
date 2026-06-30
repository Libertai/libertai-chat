import { describe, expect, it } from "vitest";
import { detectArtifacts, hasArtifacts, artifactKindForLanguage, artifactSlotKey } from "@/utils/artifacts";

describe("artifactKindForLanguage", () => {
	it("maps renderable languages to kinds", () => {
		expect(artifactKindForLanguage("html")).toBe("html");
		expect(artifactKindForLanguage("HTM")).toBe("html");
		expect(artifactKindForLanguage("svg")).toBe("svg");
		expect(artifactKindForLanguage("mermaid")).toBe("mermaid");
		expect(artifactKindForLanguage("jsx")).toBe("react");
		expect(artifactKindForLanguage("tsx")).toBe("react");
		expect(artifactKindForLanguage("markdown")).toBe("markdown");
		expect(artifactKindForLanguage("md")).toBe("markdown");
	});

	it("returns undefined for plain code languages", () => {
		expect(artifactKindForLanguage("python")).toBeUndefined();
		expect(artifactKindForLanguage("json")).toBeUndefined();
		expect(artifactKindForLanguage("bash")).toBeUndefined();
		expect(artifactKindForLanguage("")).toBeUndefined();
		expect(artifactKindForLanguage(undefined)).toBeUndefined();
	});
});

describe("detectArtifacts", () => {
	it("returns an empty list when there are no fenced blocks", () => {
		expect(detectArtifacts("just some text, no code at all")).toEqual([]);
		expect(detectArtifacts("")).toEqual([]);
	});

	it("ignores non-renderable fenced code (python/json)", () => {
		const md = "Here:\n\n```python\nprint('hi')\n```\n\nand\n\n```json\n{\"a\":1}\n```";
		expect(detectArtifacts(md)).toEqual([]);
		expect(hasArtifacts(md)).toBe(false);
	});

	it("extracts a single html artifact with exact inner source", () => {
		const md = ["Here is a page:", "", "```html", "<h1>Hello</h1>", "<p>World</p>", "```", "", "Enjoy."].join("\n");
		const arts = detectArtifacts(md);
		expect(arts).toHaveLength(1);
		expect(arts[0].kind).toBe("html");
		expect(arts[0].language).toBe("html");
		expect(arts[0].code).toBe("<h1>Hello</h1>\n<p>World</p>");
		expect(arts[0].index).toBe(0);
		expect(hasArtifacts(md)).toBe(true);
	});

	it("derives a title from a React component declaration", () => {
		const md = "```tsx\nfunction Counter() { return <div/>; }\n```";
		const arts = detectArtifacts(md);
		expect(arts[0].kind).toBe("react");
		expect(arts[0].title).toBe("Counter");
	});

	it("derives a title from an html <title> or <h1>", () => {
		expect(detectArtifacts("```html\n<title>My App</title>\n```")[0].title).toBe("My App");
		expect(detectArtifacts("```html\n<h1>Dashboard</h1>\n```")[0].title).toBe("Dashboard");
	});

	it("extracts multiple artifacts in document order with stable indices", () => {
		const md = [
			"First an html block:",
			"```html",
			"<div>one</div>",
			"```",
			"Then a react block:",
			"```jsx",
			"const App = () => <p>two</p>;",
			"```",
		].join("\n");
		const arts = detectArtifacts(md);
		expect(arts).toHaveLength(2);
		expect(arts[0].kind).toBe("html");
		expect(arts[0].index).toBe(0);
		expect(arts[1].kind).toBe("react");
		expect(arts[1].index).toBe(1);
	});

	it("treats a substantial markdown fence as a document artifact but skips tiny ones", () => {
		const big = "```markdown\n" + "# Report\n\n" + "Lorem ipsum dolor sit amet ".repeat(6) + "\n```";
		expect(detectArtifacts(big)).toHaveLength(1);
		expect(detectArtifacts(big)[0].kind).toBe("markdown");

		const tiny = "```md\n# hi\n```";
		expect(detectArtifacts(tiny)).toHaveLength(0);
	});

	it("handles ~~~ fences and longer backtick fences", () => {
		expect(detectArtifacts("~~~svg\n<svg></svg>\n~~~")).toHaveLength(1);
		expect(detectArtifacts("````html\n<div>x</div>\n````")).toHaveLength(1);
	});

	it("does not treat an empty html fence as an artifact", () => {
		expect(detectArtifacts("```html\n\n```")).toHaveLength(0);
	});
});

describe("artifactSlotKey", () => {
	it("is stable per (kind, index) so versions line up across regenerations", () => {
		expect(artifactSlotKey("react", 0)).toBe("react:0");
		expect(artifactSlotKey("html", 1)).toBe("html:1");
		expect(artifactSlotKey("react", 0)).toBe(artifactSlotKey("react", 0));
	});
});
