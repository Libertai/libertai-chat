// Pure extraction of GFM tables from markdown source, used by the export feature to decide whether
// an artifact/document carries tabular data (so we can offer XLSX / CSV) and to turn that table into
// rows for the spreadsheet/csv generators.
//
// Dependency-free and DOM-free so it can be unit-tested directly. We only support the common GFM
// pipe-table shape (a header row, a `|---|---|` delimiter row, then body rows) which is what
// react-markdown + remark-gfm render in messages and the canvas markdown preview.

export type TableRow = string[];

export interface ExtractedTable {
	// Header cells (first row of the table).
	header: TableRow;
	// Body rows (everything after the delimiter row), each padded/truncated to header width.
	rows: TableRow[];
	// All rows including the header, for generators that want a single grid (header + body).
	grid: TableRow[];
}

// A delimiter row is the GFM separator under the header: cells of dashes with optional leading/
// trailing colons for alignment, e.g. `| :--- | ---: | :--: |`.
const DELIMITER_CELL_RE = /^\s*:?-{1,}:?\s*$/;

// Split a single markdown table line into its cells. Handles optional leading/trailing pipes and
// escaped pipes (`\|`) inside a cell.
export function splitTableRow(line: string): TableRow {
	const cells: string[] = [];
	let current = "";
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === "\\" && line[i + 1] === "|") {
			// Escaped pipe -> literal pipe inside the cell.
			current += "|";
			i++;
			continue;
		}
		if (ch === "|") {
			cells.push(current);
			current = "";
			continue;
		}
		current += ch;
	}
	cells.push(current);

	// Drop the empty leading/trailing cells produced by a leading/trailing pipe.
	if (cells.length && cells[0].trim() === "") cells.shift();
	if (cells.length && cells[cells.length - 1].trim() === "") cells.pop();

	return cells.map((c) => c.trim());
}

function isDelimiterRow(line: string): boolean {
	const cells = splitTableRow(line);
	if (cells.length === 0) return false;
	return cells.every((c) => DELIMITER_CELL_RE.test(c));
}

// True only when the line contains a pipe somewhere outside an escape — a quick pre-filter so we do
// not treat ordinary prose as a candidate header/delimiter pair.
function looksLikeTableLine(line: string): boolean {
	return /(?<!\\)\|/.test(line);
}

// Pad/truncate a row to a fixed column count so every body row lines up with the header.
function normalizeWidth(row: TableRow, width: number): TableRow {
	const out = row.slice(0, width);
	while (out.length < width) out.push("");
	return out;
}

// Extract every GFM pipe-table found in the markdown source, in document order. Fenced code blocks
// are skipped so a table drawn inside a ``` fence is not mistaken for a real table.
export function extractTables(markdown: string): ExtractedTable[] {
	if (!markdown) return [];

	const lines = markdown.split("\n");
	const tables: ExtractedTable[] = [];

	let inFence = false;
	let fenceMarker = "";

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Track fenced code blocks (``` or ~~~) so we ignore tables drawn inside code.
		const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
		if (fenceMatch) {
			if (!inFence) {
				inFence = true;
				fenceMarker = fenceMatch[1][0];
			} else if (line.trim().startsWith(fenceMarker)) {
				inFence = false;
				fenceMarker = "";
			}
			continue;
		}
		if (inFence) continue;

		// A table starts at a header line immediately followed by a delimiter row.
		const next = lines[i + 1];
		if (looksLikeTableLine(line) && next !== undefined && looksLikeTableLine(next) && isDelimiterRow(next)) {
			const header = splitTableRow(line);
			const width = header.length;
			const rows: TableRow[] = [];

			let j = i + 2;
			for (; j < lines.length; j++) {
				const bodyLine = lines[j];
				if (!looksLikeTableLine(bodyLine) || bodyLine.trim() === "") break;
				rows.push(normalizeWidth(splitTableRow(bodyLine), width));
			}

			const grid = [normalizeWidth(header, width), ...rows];
			tables.push({ header: normalizeWidth(header, width), rows, grid });
			// Continue scanning after this table.
			i = j - 1;
		}
	}

	return tables;
}

// True when the markdown contains at least one GFM table (so the export menu can offer XLSX / CSV).
export function hasTable(markdown: string): boolean {
	return extractTables(markdown).length > 0;
}
