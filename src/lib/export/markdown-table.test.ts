import { describe, expect, it } from "vitest";
import { extractTables, hasTable, splitTableRow } from "@/lib/export/markdown-table";

describe("splitTableRow", () => {
	it("splits pipe cells and trims, dropping leading/trailing empties", () => {
		expect(splitTableRow("| a | b | c |")).toEqual(["a", "b", "c"]);
		expect(splitTableRow("a | b | c")).toEqual(["a", "b", "c"]);
	});

	it("keeps escaped pipes inside a cell", () => {
		expect(splitTableRow("| a \\| b | c |")).toEqual(["a | b", "c"]);
	});
});

describe("extractTables", () => {
	it("extracts a basic GFM table into header + rows + grid", () => {
		const md = ["| Name | Age |", "| --- | --- |", "| Ada | 36 |", "| Bob | 41 |"].join("\n");
		const tables = extractTables(md);
		expect(tables).toHaveLength(1);
		expect(tables[0].header).toEqual(["Name", "Age"]);
		expect(tables[0].rows).toEqual([
			["Ada", "36"],
			["Bob", "41"],
		]);
		expect(tables[0].grid).toEqual([
			["Name", "Age"],
			["Ada", "36"],
			["Bob", "41"],
		]);
	});

	it("supports alignment colons in the delimiter row", () => {
		const md = ["| L | C | R |", "| :--- | :---: | ---: |", "| 1 | 2 | 3 |"].join("\n");
		const tables = extractTables(md);
		expect(tables).toHaveLength(1);
		expect(tables[0].rows).toEqual([["1", "2", "3"]]);
	});

	it("pads short rows and truncates long rows to header width", () => {
		const md = ["| A | B | C |", "| - | - | - |", "| 1 |", "| 1 | 2 | 3 | 4 |"].join("\n");
		const tables = extractTables(md);
		expect(tables[0].rows).toEqual([
			["1", "", ""],
			["1", "2", "3"],
		]);
	});

	it("ignores tables inside fenced code blocks", () => {
		const md = ["```", "| A | B |", "| - | - |", "| 1 | 2 |", "```"].join("\n");
		expect(extractTables(md)).toHaveLength(0);
		expect(hasTable(md)).toBe(false);
	});

	it("does not treat ordinary prose with a pipe as a table", () => {
		expect(extractTables("use cmd a | b for piping")).toHaveLength(0);
	});

	it("extracts multiple tables in document order", () => {
		const md = ["| A | B |", "| - | - |", "| 1 | 2 |", "", "some text", "", "| X | Y |", "| - | - |", "| 9 | 8 |"].join(
			"\n",
		);
		const tables = extractTables(md);
		expect(tables).toHaveLength(2);
		expect(tables[0].header).toEqual(["A", "B"]);
		expect(tables[1].header).toEqual(["X", "Y"]);
	});

	it("hasTable is true for a real table", () => {
		expect(hasTable("| A | B |\n| - | - |\n| 1 | 2 |")).toBe(true);
		expect(hasTable("")).toBe(false);
	});
});
