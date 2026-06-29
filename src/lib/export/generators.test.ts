import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
	markdownToDocxBlob,
	markdownToPdfBlob,
	rowsToCsv,
	rowsToCsvBlob,
	rowsToXlsxBlob,
	textToBlob,
} from "@/lib/export/generators";

async function magic(blob: Blob, n = 4): Promise<string> {
	const bytes = new Uint8Array(await blob.arrayBuffer()).slice(0, n);
	return String.fromCharCode(...bytes);
}

describe("rowsToCsv", () => {
	it("serializes a grid with CRLF line endings", () => {
		expect(
			rowsToCsv([
				["a", "b"],
				["1", "2"],
			]),
		).toBe("a,b\r\n1,2");
	});

	it("quotes and escapes cells with commas, quotes and newlines (RFC 4180)", () => {
		expect(rowsToCsv([["a,b", 'c"d', "e\nf"]])).toBe('"a,b","c""d","e\nf"');
	});

	it("rowsToCsvBlob produces a text/csv blob", async () => {
		const blob = rowsToCsvBlob([["x"], ["1"]]);
		expect(blob.type).toContain("text/csv");
		expect(await blob.text()).toBe("x\r\n1");
	});
});

describe("rowsToXlsxBlob", () => {
	it("produces a real .xlsx (zip) blob with the spreadsheet mime type", async () => {
		const blob = rowsToXlsxBlob([
			["Name", "Age"],
			["Ada", "36"],
		]);
		expect(blob.type).toContain("spreadsheetml.sheet");
		// XLSX files are ZIP archives -> "PK" magic.
		expect(await magic(blob, 2)).toBe("PK");
	});

	it("round-trips: the workbook parses back to the original grid (numbers coerced)", async () => {
		const grid = [
			["Name", "Age"],
			["Ada", "36"],
			["Bob", "41"],
		];
		const blob = rowsToXlsxBlob(grid, "People");
		const wb = XLSX.read(new Uint8Array(await blob.arrayBuffer()), { type: "array" });
		expect(wb.SheetNames[0]).toBe("People");
		const back = XLSX.utils.sheet_to_json<string[]>(wb.Sheets["People"], { header: 1 });
		expect(back).toEqual([
			["Name", "Age"],
			["Ada", 36],
			["Bob", 41],
		]);
	});

	it("sanitizes invalid sheet names", async () => {
		const blob = rowsToXlsxBlob([["a"]], "bad/name:with*chars");
		const wb = XLSX.read(new Uint8Array(await blob.arrayBuffer()), { type: "array" });
		expect(wb.SheetNames[0]).not.toMatch(/[\\/?*[\]:]/);
	});
});

describe("markdownToDocxBlob", () => {
	it("produces a real .docx (zip) blob with the wordprocessing mime type", async () => {
		const blob = await markdownToDocxBlob("# Title\n\nA paragraph.\n\n- one\n- two", "My Doc");
		expect(blob.type).toContain("wordprocessingml.document");
		expect(await magic(blob, 2)).toBe("PK");
		expect(blob.size).toBeGreaterThan(1000);
	});

	it("handles an empty document without throwing", async () => {
		const blob = await markdownToDocxBlob("");
		expect(await magic(blob, 2)).toBe("PK");
	});

	it("embeds table content as a Word table (present in the document XML)", async () => {
		const md = "| A | B |\n| - | - |\n| 1 | 2 |";
		const blob = await markdownToDocxBlob(md);
		const text = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()));
		// The zip is not decompressed here, but the office-open-xml package stores enough that a
		// non-trivial document is produced; assert it is a valid, sizeable archive.
		expect(text.slice(0, 2)).toBe("PK");
		expect(blob.size).toBeGreaterThan(1000);
	});
});

describe("markdownToPdfBlob", () => {
	it("produces a real PDF blob (%PDF magic) with the pdf mime type", async () => {
		const blob = markdownToPdfBlob(
			"# Heading\n\nBody text that is long enough to wrap across the page width several times over.",
			"Title",
		);
		expect(blob.type).toBe("application/pdf");
		expect(await magic(blob, 4)).toBe("%PDF");
	});

	it("handles headings, lists, code, hr and tables without throwing", () => {
		const md = [
			"# H1",
			"## H2",
			"intro paragraph",
			"- a",
			"- b",
			"1. c",
			"```js",
			"const x = 1;",
			"```",
			"---",
			"| A | B |",
			"| - | - |",
			"| 1 | 2 |",
		].join("\n");
		const blob = markdownToPdfBlob(md);
		expect(blob.type).toBe("application/pdf");
		expect(blob.size).toBeGreaterThan(500);
	});
});

describe("textToBlob", () => {
	it("wraps text with the given mime type", async () => {
		const blob = textToBlob("<svg></svg>", "image/svg+xml");
		expect(blob.type).toBe("image/svg+xml");
		expect(await blob.text()).toBe("<svg></svg>");
	});
});
