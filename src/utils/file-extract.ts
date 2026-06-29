import Papa from "papaparse";
import type { FileAttachment } from "@/types/chats";

// Client-side extraction of non-image file input into labelled text blocks. EVERYTHING here runs
// in the browser: PDFs are parsed with pdfjs-dist (worker), CSVs with papaparse, plain text /
// markdown is read directly. The raw bytes never leave the device — only the extracted text is
// attached to the outgoing message. Very large extractions are truncated with a trailing marker.

export type AttachmentKind = FileAttachment["kind"];

// Cap on the characters we keep from a single extracted file. Anything past this is dropped and a
// truncation note is appended so the model knows the content is partial. Generous enough for normal
// documents while keeping the request (and the persisted localStorage chat) bounded.
export const MAX_ATTACHMENT_CHARS = 20_000;

// Hard ceiling on the raw file size we even attempt to read (10 MB). Bigger files are rejected up
// front rather than blocking the main thread / blowing up memory on a doomed parse.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const TRUNCATION_NOTE = "\n\n[... truncated: file was too large to include in full ...]";

const PDF_EXTENSIONS = [".pdf"];
const CSV_EXTENSIONS = [".csv", ".tsv"];
const TEXT_EXTENSIONS = [
	".txt",
	".md",
	".markdown",
	".text",
	".log",
	".json",
	".yaml",
	".yml",
	".xml",
	".html",
	".htm",
];

// The accept attribute for the <input type="file"> and the value we drag/drop/paste-filter against.
// Images keep working for vision models; these are the new non-image types.
export const IMAGE_ACCEPT = "image/jpeg,image/jpg,image/png";
export const FILE_ACCEPT = [
	"application/pdf",
	"text/csv",
	"text/tab-separated-values",
	"text/plain",
	"text/markdown",
	".pdf",
	".csv",
	".tsv",
	".txt",
	".md",
	".markdown",
	".log",
	".json",
	".yaml",
	".yml",
	".xml",
].join(",");

function extensionMatches(filename: string, extensions: string[]): boolean {
	const lower = filename.toLowerCase();
	return extensions.some((ext) => lower.endsWith(ext));
}

/** True for the image types the vision pipeline already handles (kept on the image/vision path). */
export function isImageFile(file: { type: string; name: string }): boolean {
	if (file.type === "image/jpeg" || file.type === "image/jpg" || file.type === "image/png") return true;
	return extensionMatches(file.name, [".jpg", ".jpeg", ".png"]);
}

/**
 * Classify a file into one of the extractable kinds, or null if it isn't a supported non-image file.
 * Mime type is preferred; we fall back to the extension because browsers report empty/odd mime
 * types for some files (e.g. markdown is often "" or "text/markdown" inconsistently).
 */
export function classifyFile(file: { type: string; name: string }): AttachmentKind | null {
	const type = file.type.toLowerCase();
	if (type === "application/pdf" || extensionMatches(file.name, PDF_EXTENSIONS)) return "pdf";
	if (type === "text/csv" || type === "text/tab-separated-values" || extensionMatches(file.name, CSV_EXTENSIONS)) {
		return "csv";
	}
	if (type.startsWith("text/") || type === "application/json" || extensionMatches(file.name, TEXT_EXTENSIONS)) {
		return "text";
	}
	return null;
}

/** Apply the character cap, marking the attachment truncated when content was dropped. */
export function applyTruncation(content: string): { content: string; truncated: boolean } {
	if (content.length <= MAX_ATTACHMENT_CHARS) return { content, truncated: false };
	return { content: content.slice(0, MAX_ATTACHMENT_CHARS) + TRUNCATION_NOTE, truncated: true };
}

/**
 * Parse CSV/TSV text into a compact, readable table dump for the model. We keep the raw structure
 * (header + rows) rather than re-serialising to JSON so the model sees the data the way the user
 * does. `papaparse` handles quoting/embedded newlines correctly where a naive split would not.
 */
export function parseCsv(text: string, delimiter?: string): string {
	const result = Papa.parse<string[]>(text.trim(), {
		delimiter: delimiter ?? "",
		skipEmptyLines: true,
	});
	const rows = result.data.filter((row) => Array.isArray(row) && row.length > 0);
	if (rows.length === 0) return "";
	return rows.map((row) => row.map((cell) => String(cell ?? "")).join("\t")).join("\n");
}

/** Read a File/Blob as UTF-8 text. Uses Blob.text() (available in browsers and Node test env). */
async function readText(file: Blob): Promise<string> {
	return file.text();
}

// --- PDF extraction -------------------------------------------------------------------------------

// A structurally-minimal view of the pdfjs page text so the page-joining logic can be unit-tested
// with a fake document (no worker / no real PDF needed for that part).
export interface PdfTextItem {
	str?: string;
	hasEOL?: boolean;
}
export interface PdfTextContent {
	items: Array<PdfTextItem | object>;
}
export interface PdfPageProxyLike {
	getTextContent: () => Promise<PdfTextContent>;
}
export interface PdfDocumentLike {
	numPages: number;
	getPage: (n: number) => Promise<PdfPageProxyLike>;
}

/** Join a pdfjs document's per-page text items into a single newline-separated string. */
export async function extractPdfText(doc: PdfDocumentLike): Promise<string> {
	const pages: string[] = [];
	for (let i = 1; i <= doc.numPages; i++) {
		const page = await doc.getPage(i);
		const content = await page.getTextContent();
		let pageText = "";
		for (const item of content.items) {
			const ti = item as PdfTextItem;
			if (typeof ti.str !== "string") continue;
			pageText += ti.str;
			if (ti.hasEOL) pageText += "\n";
			else pageText += " ";
		}
		pages.push(pageText.replace(/[ \t]+\n/g, "\n").trim());
	}
	return pages.join("\n\n").trim();
}

// Lazily import pdfjs so the heavy library + worker only load when a PDF is actually attached, and
// so the rest of the module stays importable in a plain Node test environment.
async function loadPdfDocument(data: ArrayBuffer): Promise<PdfDocumentLike> {
	const pdfjs = await import("pdfjs-dist");
	// Vite resolves the bundled worker as a URL; wiring it here keeps parsing off the main thread.
	const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
	pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
	const loadingTask = pdfjs.getDocument({ data });
	return (await loadingTask.promise) as unknown as PdfDocumentLike;
}

// --- Orchestration --------------------------------------------------------------------------------

export interface ExtractDeps {
	// Injectable for tests: turns raw PDF bytes into a document-like object. Defaults to pdfjs.
	loadPdf?: (data: ArrayBuffer) => Promise<PdfDocumentLike>;
}

/**
 * Extract a single non-image file into a labelled text attachment. Returns null for unsupported
 * types. Throws on files over the size ceiling or on a parse failure so the caller can surface a
 * toast. All work is client-side.
 */
export async function extractFile(file: File, deps: ExtractDeps = {}): Promise<FileAttachment | null> {
	const kind = classifyFile(file);
	if (kind === null) return null;

	if (file.size > MAX_FILE_BYTES) {
		throw new Error(`${file.name} is too large (max ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB).`);
	}

	let raw: string;
	if (kind === "pdf") {
		const buffer = await file.arrayBuffer();
		const loadPdf = deps.loadPdf ?? loadPdfDocument;
		const doc = await loadPdf(buffer);
		raw = await extractPdfText(doc);
	} else if (kind === "csv") {
		const text = await readText(file);
		const delimiter = file.name.toLowerCase().endsWith(".tsv") ? "\t" : undefined;
		raw = parseCsv(text, delimiter);
	} else {
		raw = await readText(file);
	}

	const { content, truncated } = applyTruncation(raw.trim());
	return {
		filename: file.name,
		kind,
		mimeType: file.type,
		content,
		truncated,
	};
}
