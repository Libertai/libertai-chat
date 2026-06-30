import { describe, expect, it } from "vitest";
import { exportFileName, exportFormatsFor, safeBaseName } from "@/lib/export/formats";

describe("exportFormatsFor", () => {
	it("offers PDF / DOCX / Markdown for a plain markdown document", () => {
		expect(exportFormatsFor("markdown", "# Hello\n\nSome prose.")).toEqual(["pdf", "docx", "md"]);
	});

	it("adds XLSX / CSV when the markdown embeds a GFM table", () => {
		const md = "# Report\n\n| A | B |\n| - | - |\n| 1 | 2 |";
		expect(exportFormatsFor("markdown", md)).toEqual(["pdf", "docx", "md", "xlsx", "csv"]);
	});

	it("offers only HTML for an html artifact and only SVG for an svg artifact", () => {
		expect(exportFormatsFor("html", "<h1>hi</h1>")).toEqual(["html"]);
		expect(exportFormatsFor("svg", "<svg></svg>")).toEqual(["svg"]);
	});

	it("offers the raw source for react and mermaid artifacts", () => {
		expect(exportFormatsFor("react", "function App(){}")).toEqual(["jsx"]);
		expect(exportFormatsFor("mermaid", "graph TD; A-->B")).toEqual(["mmd"]);
	});
});

describe("safeBaseName / exportFileName", () => {
	it("slugifies titles to a safe lowercase base name", () => {
		expect(safeBaseName("My Report: 2026!")).toBe("my-report-2026");
		expect(safeBaseName("")).toBe("artifact");
	});

	it("composes the filename with the format extension", () => {
		expect(exportFileName("Quarterly Numbers", "xlsx")).toBe("quarterly-numbers.xlsx");
		expect(exportFileName("Doc", "pdf")).toBe("doc.pdf");
		expect(exportFileName("Doc", "docx")).toBe("doc.docx");
	});
});
