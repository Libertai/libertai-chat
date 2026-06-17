// Pure, in-browser document generators. Each function takes plain data (markdown string, a grid of
// rows, raw text) and returns a Blob — NO network, NO server. The heavy office libraries (jspdf,
// docx, xlsx) all run fine under both the browser and the node unit-test environment, so these
// generators are unit-testable directly (assert the blob type / magic bytes).
//
// The browser download wrapper lives in download.ts; the format/menu logic lives in formats.ts.

import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow as DocxTableRow, TableCell, WidthType } from "docx";
import * as XLSX from "xlsx";
import { parseMarkdownBlocks, type MarkdownBlock } from "@/lib/export/markdown-blocks";
import type { TableRow } from "@/lib/export/markdown-table";
import { FORMAT_META } from "@/lib/export/formats";

// --- Plain text / passthrough --------------------------------------------------------------------

// Wrap raw text (markdown source, HTML, SVG) in a Blob with the right mime type for download.
export function textToBlob(text: string, mime: string): Blob {
	return new Blob([text], { type: mime });
}

// --- CSV ------------------------------------------------------------------------------------------

// Escape one CSV cell per RFC 4180: quote when it contains a comma, quote, CR or LF; double embedded
// quotes.
function escapeCsvCell(value: string): string {
	if (/[",\r\n]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

// Serialize a grid of rows to a CSV string (CRLF line endings, RFC 4180).
export function rowsToCsv(grid: TableRow[]): string {
	return grid.map((row) => row.map((cell) => escapeCsvCell(cell ?? "")).join(",")).join("\r\n");
}

export function rowsToCsvBlob(grid: TableRow[]): Blob {
	return textToBlob(rowsToCsv(grid), FORMAT_META.csv.mime);
}

// --- XLSX -----------------------------------------------------------------------------------------

// Build an .xlsx workbook from a grid of rows (first row used as the header). Numeric-looking cells
// are coerced to numbers so spreadsheets sort/sum them correctly.
function coerceCell(value: string): string | number {
	const trimmed = (value ?? "").trim();
	if (trimmed === "") return "";
	// Plain integer or decimal (no thousands separators, optional leading minus). Avoid coercing
	// things like phone numbers with leading zeros by requiring no leading zero on multi-digit ints.
	if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(trimmed)) {
		const n = Number(trimmed);
		if (Number.isFinite(n)) return n;
	}
	return value;
}

export function rowsToXlsxBlob(grid: TableRow[], sheetName = "Sheet1"): Blob {
	const aoa = grid.map((row) => row.map((cell) => coerceCell(cell)));
	const ws = XLSX.utils.aoa_to_sheet(aoa);
	const wb = XLSX.utils.book_new();
	// Excel limits sheet names to 31 chars and forbids a handful of characters.
	const safeSheet = (sheetName || "Sheet1").replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet1";
	XLSX.utils.book_append_sheet(wb, ws, safeSheet);
	const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
	return new Blob([out], { type: FORMAT_META.xlsx.mime });
}

// --- DOCX -----------------------------------------------------------------------------------------

const DOCX_HEADING: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
	1: HeadingLevel.HEADING_1,
	2: HeadingLevel.HEADING_2,
	3: HeadingLevel.HEADING_3,
	4: HeadingLevel.HEADING_4,
	5: HeadingLevel.HEADING_5,
	6: HeadingLevel.HEADING_6,
};

function blockToDocx(block: MarkdownBlock): Paragraph | Table | (Paragraph | Table)[] {
	switch (block.type) {
		case "heading":
			return new Paragraph({ text: block.text, heading: DOCX_HEADING[block.level] ?? HeadingLevel.HEADING_6 });
		case "paragraph":
			return new Paragraph({ children: [new TextRun(block.text)] });
		case "listItem":
			return new Paragraph({
				children: [new TextRun(block.text)],
				bullet: block.ordered ? undefined : { level: block.level },
				numbering: undefined,
				indent: block.ordered ? { left: 360 * (block.level + 1) } : undefined,
			});
		case "code":
			// Render code as monospace lines so it stays readable in Word.
			return block.text
				.split("\n")
				.map((line) => new Paragraph({ children: [new TextRun({ text: line || " ", font: "Courier New", size: 20 })] }));
		case "hr":
			return new Paragraph({ text: "", border: { bottom: { style: "single", size: 6, color: "999999", space: 1 } } });
		case "table":
			return new Table({
				width: { size: 100, type: WidthType.PERCENTAGE },
				rows: [block.header, ...block.rows].map(
					(row, rowIndex) =>
						new DocxTableRow({
							children: row.map(
								(cell) =>
									new TableCell({
										children: [
											new Paragraph({
												children: [new TextRun({ text: cell ?? "", bold: rowIndex === 0 })],
											}),
										],
									}),
							),
						}),
				),
			});
		default:
			return new Paragraph({ children: [] });
	}
}

// Convert a markdown document to a .docx Blob. Headings/paragraphs/lists/code/tables are mapped to
// native Word constructs; inline markdown markers are stripped by the block parser.
export async function markdownToDocxBlob(markdown: string, title?: string): Promise<Blob> {
	const blocks = parseMarkdownBlocks(markdown);
	const children: (Paragraph | Table)[] = [];
	if (title) {
		children.push(new Paragraph({ text: title, heading: HeadingLevel.TITLE }));
	}
	for (const block of blocks) {
		const out = blockToDocx(block);
		if (Array.isArray(out)) children.push(...out);
		else children.push(out);
	}
	if (children.length === 0) {
		children.push(new Paragraph({ children: [new TextRun("")] }));
	}
	const doc = new Document({ sections: [{ children }] });
	const blob = await Packer.toBlob(doc);
	// Ensure the canonical office mime type regardless of platform.
	return new Blob([await blob.arrayBuffer()], { type: FORMAT_META.docx.mime });
}

// --- PDF ------------------------------------------------------------------------------------------

const PDF_MARGIN = 48; // pt
const PDF_LINE = 16; // pt line height for body text

// Render a markdown document to a multi-page PDF Blob using jsPDF's text API (no canvas needed).
// Headings get larger/bold text, lists are indented + bulleted, code is monospace, tables are
// rendered as aligned monospace rows, and long lines wrap inside the page width.
export function markdownToPdfBlob(markdown: string, title?: string): Blob {
	const doc = new jsPDF({ unit: "pt", format: "a4" });
	const pageWidth = doc.internal.pageSize.getWidth();
	const pageHeight = doc.internal.pageSize.getHeight();
	const maxWidth = pageWidth - PDF_MARGIN * 2;
	let y = PDF_MARGIN;

	const ensureSpace = (lineHeight: number) => {
		if (y + lineHeight > pageHeight - PDF_MARGIN) {
			doc.addPage();
			y = PDF_MARGIN;
		}
	};

	const writeLines = (text: string, opts: { size: number; bold?: boolean; font?: string; indent?: number }) => {
		doc.setFont(opts.font ?? "helvetica", opts.bold ? "bold" : "normal");
		doc.setFontSize(opts.size);
		const indent = opts.indent ?? 0;
		const wrapped = doc.splitTextToSize(text || " ", maxWidth - indent) as string[];
		const lh = opts.size * 1.2;
		for (const line of wrapped) {
			ensureSpace(lh);
			doc.text(line, PDF_MARGIN + indent, y);
			y += lh;
		}
	};

	if (title) {
		writeLines(title, { size: 22, bold: true });
		y += PDF_LINE * 0.5;
	}

	for (const block of parseMarkdownBlocks(markdown)) {
		switch (block.type) {
			case "heading":
				y += PDF_LINE * 0.4;
				writeLines(block.text, { size: Math.max(13, 22 - block.level * 2), bold: true });
				y += 4;
				break;
			case "paragraph":
				writeLines(block.text, { size: 11 });
				y += 6;
				break;
			case "listItem":
				writeLines(`${block.ordered ? "•" : "•"} ${block.text}`, { size: 11, indent: 14 + block.level * 14 });
				break;
			case "code":
				for (const line of block.text.split("\n")) {
					writeLines(line, { size: 9.5, font: "courier", indent: 8 });
				}
				y += 6;
				break;
			case "hr":
				ensureSpace(PDF_LINE);
				doc.setDrawColor(180);
				doc.line(PDF_MARGIN, y, pageWidth - PDF_MARGIN, y);
				y += PDF_LINE;
				break;
			case "table": {
				const all = [block.header, ...block.rows];
				const colCount = block.header.length || 1;
				const colWidth = Math.floor((maxWidth / colCount) * 0.18); // chars per column (monospace approx)
				for (let r = 0; r < all.length; r++) {
					const row = all[r];
					const cells = row.map((c) => (c ?? "").slice(0, Math.max(4, colWidth)).padEnd(Math.max(4, colWidth)));
					writeLines(cells.join(" | "), { size: 9.5, font: "courier", bold: r === 0 });
				}
				y += 6;
				break;
			}
		}
	}

	const buffer = doc.output("arraybuffer") as ArrayBuffer;
	return new Blob([buffer], { type: FORMAT_META.pdf.mime });
}
