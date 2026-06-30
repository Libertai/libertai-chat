// A tiny, dependency-free block parser that turns markdown into a flat list of typed blocks. It is
// intentionally minimal — just enough structure for the DOCX and PDF generators to produce a
// readable document (headings, paragraphs, list items, code blocks, a horizontal rule and tables).
// Inline formatting is NOT parsed; the raw text of each block is preserved. DOM-free so it is
// unit-testable.

import { extractTables, type TableRow } from "@/lib/export/markdown-table";

export type MarkdownBlock =
	| { type: "heading"; level: number; text: string }
	| { type: "paragraph"; text: string }
	| { type: "listItem"; ordered: boolean; text: string; level: number }
	| { type: "code"; text: string; language: string }
	| { type: "table"; header: TableRow; rows: TableRow[] }
	| { type: "hr" };

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const UNORDERED_RE = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED_RE = /^(\s*)\d+[.)]\s+(.*)$/;
const HR_RE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})\s*([A-Za-z0-9_+-]*)\s*$/;

// Strip the most common inline markdown markers from a span of text so the office formats show clean
// prose rather than literal `**`, `_`, backticks and link syntax. Conservative on purpose.
export function stripInlineMarkdown(text: string): string {
	return text
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images -> alt text
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> link text
		.replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
		.replace(/(\*|_)(.*?)\1/g, "$2") // italic
		.replace(/`([^`]+)`/g, "$1") // inline code
		.trim();
}

// Indentation depth -> list nesting level (2 spaces per level, clamped).
function indentLevel(indent: string): number {
	return Math.min(Math.floor(indent.replace(/\t/g, "  ").length / 2), 4);
}

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
	if (!markdown) return [];

	// Pre-extract tables so we can both render them as real tables and skip their source lines.
	const tables = extractTables(markdown);
	const lines = markdown.split("\n");
	const blocks: MarkdownBlock[] = [];

	let inFence = false;
	let fenceMarker = "";
	let fenceLang = "";
	let fenceBuffer: string[] = [];
	let paragraph: string[] = [];

	const flushParagraph = () => {
		if (paragraph.length) {
			const text = stripInlineMarkdown(paragraph.join(" ").replace(/\s+/g, " ").trim());
			if (text) blocks.push({ type: "paragraph", text });
			paragraph = [];
		}
	};

	// Identify, by source line index, the start of each detected table so we can splice it in and
	// jump past its lines without re-treating them as paragraphs.
	const tableStartIndex = new Map<number, (typeof tables)[number]>();
	{
		let cursor = 0;
		for (const table of tables) {
			const headerLine = table.header.length
				? lines.findIndex((l, idx) => idx >= cursor && l.includes("|") && splitMatchesHeader(l, table.header))
				: -1;
			if (headerLine >= 0) {
				tableStartIndex.set(headerLine, table);
				cursor = headerLine + 2 + table.rows.length;
			}
		}
	}

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		const fence = FENCE_RE.exec(line);
		if (fence && !inFence) {
			flushParagraph();
			inFence = true;
			fenceMarker = fence[1][0];
			fenceLang = fence[2] ?? "";
			fenceBuffer = [];
			continue;
		}
		if (inFence) {
			if (line.trim().startsWith(fenceMarker) && /^\s{0,3}(`{3,}|~{3,})\s*$/.test(line)) {
				blocks.push({ type: "code", text: fenceBuffer.join("\n"), language: fenceLang.toLowerCase() });
				inFence = false;
				fenceMarker = "";
				fenceLang = "";
				fenceBuffer = [];
			} else {
				fenceBuffer.push(line);
			}
			continue;
		}

		// Splice a real table here if one starts at this line.
		const table = tableStartIndex.get(i);
		if (table) {
			flushParagraph();
			blocks.push({ type: "table", header: table.header, rows: table.rows });
			i += 1 + table.rows.length; // skip delimiter + body rows (header is current line)
			continue;
		}

		if (line.trim() === "") {
			flushParagraph();
			continue;
		}

		if (HR_RE.test(line)) {
			flushParagraph();
			blocks.push({ type: "hr" });
			continue;
		}

		const heading = HEADING_RE.exec(line);
		if (heading) {
			flushParagraph();
			blocks.push({ type: "heading", level: heading[1].length, text: stripInlineMarkdown(heading[2]) });
			continue;
		}

		const ordered = ORDERED_RE.exec(line);
		if (ordered) {
			flushParagraph();
			blocks.push({
				type: "listItem",
				ordered: true,
				text: stripInlineMarkdown(ordered[2]),
				level: indentLevel(ordered[1]),
			});
			continue;
		}

		const unordered = UNORDERED_RE.exec(line);
		if (unordered) {
			flushParagraph();
			blocks.push({
				type: "listItem",
				ordered: false,
				text: stripInlineMarkdown(unordered[2]),
				level: indentLevel(unordered[1]),
			});
			continue;
		}

		paragraph.push(line.trim());
	}

	if (inFence) {
		// Unterminated fence: still emit what we captured so nothing is silently dropped.
		blocks.push({ type: "code", text: fenceBuffer.join("\n"), language: fenceLang.toLowerCase() });
	}
	flushParagraph();

	return blocks;
}

// Helper: does a raw markdown line, when split into cells, match a table's header cells? Used to
// locate the source line of a pre-extracted table.
function splitMatchesHeader(line: string, header: TableRow): boolean {
	const cells = line
		.split("|")
		.map((c) => c.trim())
		.filter((c, idx, arr) => !(c === "" && (idx === 0 || idx === arr.length - 1)));
	if (cells.length !== header.length) return false;
	return cells.every((c, idx) => c === header[idx]);
}
