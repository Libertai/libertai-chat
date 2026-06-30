import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
	applyTruncation,
	classifyFile,
	extractFile,
	extractPdfText,
	isImageFile,
	parseCsv,
	MAX_ATTACHMENT_CHARS,
	MAX_FILE_BYTES,
	TRUNCATION_NOTE,
	type PdfDocumentLike,
} from "@/utils/file-extract";

const require = createRequire(import.meta.url);

describe("classifyFile", () => {
	it("classifies PDFs by mime and by extension", () => {
		expect(classifyFile({ type: "application/pdf", name: "a.pdf" })).toBe("pdf");
		expect(classifyFile({ type: "", name: "report.PDF" })).toBe("pdf");
	});

	it("classifies CSV/TSV by mime and by extension", () => {
		expect(classifyFile({ type: "text/csv", name: "a.csv" })).toBe("csv");
		expect(classifyFile({ type: "", name: "data.tsv" })).toBe("csv");
	});

	it("classifies plain text / markdown / json as text", () => {
		expect(classifyFile({ type: "text/plain", name: "notes.txt" })).toBe("text");
		expect(classifyFile({ type: "", name: "README.md" })).toBe("text");
		expect(classifyFile({ type: "application/json", name: "config.json" })).toBe("text");
	});

	it("returns null for unsupported types (and for images, which take the vision path)", () => {
		expect(classifyFile({ type: "image/png", name: "a.png" })).toBeNull();
		expect(classifyFile({ type: "application/zip", name: "a.zip" })).toBeNull();
	});
});

describe("isImageFile", () => {
	it("detects supported images by mime or extension", () => {
		expect(isImageFile({ type: "image/png", name: "a.png" })).toBe(true);
		expect(isImageFile({ type: "image/jpeg", name: "a.jpg" })).toBe(true);
		expect(isImageFile({ type: "", name: "photo.JPEG" })).toBe(true);
		expect(isImageFile({ type: "application/pdf", name: "a.pdf" })).toBe(false);
	});
});

describe("parseCsv", () => {
	it("parses comma-separated rows into a tab-joined table", () => {
		const out = parseCsv("name,age\nAlice,30\nBob,25");
		expect(out).toBe("name\tage\nAlice\t30\nBob\t25");
	});

	it("handles quoted fields with embedded commas and newlines", () => {
		const out = parseCsv('a,b\n"hello, world","line1\nline2"');
		const rows = out.split("\n");
		// The quoted comma stays inside one cell; only the real column delimiter splits.
		expect(rows[0]).toBe("a\tb");
		expect(out).toContain("hello, world");
		expect(out).toContain("line1\nline2");
	});

	it("parses TSV when an explicit tab delimiter is supplied", () => {
		const out = parseCsv("x\ty\n1\t2", "\t");
		expect(out).toBe("x\ty\n1\t2");
	});

	it("returns empty string for empty input", () => {
		expect(parseCsv("")).toBe("");
		expect(parseCsv("   \n  ")).toBe("");
	});
});

describe("applyTruncation", () => {
	it("leaves short content untouched", () => {
		const { content, truncated } = applyTruncation("short");
		expect(content).toBe("short");
		expect(truncated).toBe(false);
	});

	it("truncates oversized content and appends the note", () => {
		const big = "x".repeat(MAX_ATTACHMENT_CHARS + 100);
		const { content, truncated } = applyTruncation(big);
		expect(truncated).toBe(true);
		expect(content.endsWith(TRUNCATION_NOTE)).toBe(true);
		expect(content.length).toBe(MAX_ATTACHMENT_CHARS + TRUNCATION_NOTE.length);
	});
});

describe("extractPdfText (page joining)", () => {
	it("joins text items across pages, honoring EOL markers", async () => {
		const fakeDoc: PdfDocumentLike = {
			numPages: 2,
			getPage: async (n) => ({
				getTextContent: async () =>
					n === 1
						? { items: [{ str: "Hello" }, { str: "world", hasEOL: true }, { str: "again" }] }
						: { items: [{ str: "Page two" }] },
			}),
		};
		const text = await extractPdfText(fakeDoc);
		expect(text).toContain("Hello world");
		// hasEOL inserts a newline; pages are separated by a blank line.
		expect(text).toContain("world\nagain");
		expect(text).toContain("Page two");
		expect(text.split("\n\n")).toHaveLength(2);
	});

	it("ignores non-text marked-content items", async () => {
		const fakeDoc: PdfDocumentLike = {
			numPages: 1,
			getPage: async () => ({
				getTextContent: async () => ({ items: [{ str: "kept" }, { type: "beginMarkedContent" }, { str: "also" }] }),
			}),
		};
		const text = await extractPdfText(fakeDoc);
		expect(text).toBe("kept also");
	});
});

describe("extractFile", () => {
	const file = (content: string, name: string, type: string) => new File([content], name, { type });

	it("extracts a CSV into a tab table attachment", async () => {
		const att = await extractFile(file("a,b\n1,2", "data.csv", "text/csv"));
		expect(att).not.toBeNull();
		expect(att!.kind).toBe("csv");
		expect(att!.filename).toBe("data.csv");
		expect(att!.content).toBe("a\tb\n1\t2");
		expect(att!.truncated).toBe(false);
	});

	it("reads a plain text / markdown file directly", async () => {
		const att = await extractFile(file("# Title\n\nbody text", "notes.md", "text/markdown"));
		expect(att!.kind).toBe("text");
		expect(att!.content).toBe("# Title\n\nbody text");
	});

	it("returns null for unsupported (non-image) types", async () => {
		const att = await extractFile(file("zip", "a.zip", "application/zip"));
		expect(att).toBeNull();
	});

	it("throws when a file exceeds the size ceiling", async () => {
		const huge = file("x", "big.txt", "text/plain");
		Object.defineProperty(huge, "size", { value: MAX_FILE_BYTES + 1 });
		await expect(extractFile(huge)).rejects.toThrow(/too large/i);
	});

	it("truncates very large text files and flags them", async () => {
		const att = await extractFile(file("y".repeat(MAX_ATTACHMENT_CHARS + 50), "big.txt", "text/plain"));
		expect(att!.truncated).toBe(true);
		expect(att!.content.endsWith(TRUNCATION_NOTE)).toBe(true);
	});

	it("extracts text from a real PDF fixture via the injected pdfjs loader", async () => {
		// Use the legacy pdfjs build (the only one that runs outside a DOM) with a fake worker to parse
		// a tiny real PDF. This exercises the actual library + our extractPdfText joining end-to-end.
		const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist/legacy/build/pdf.mjs");
		GlobalWorkerOptions.workerSrc = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");

		const fixturePath = fileURLToPath(new URL("./__fixtures__/sample.pdf", import.meta.url));
		const bytes = readFileSync(fixturePath);
		const pdfFile = new File([bytes], "sample.pdf", { type: "application/pdf" });

		const att = await extractFile(pdfFile, {
			loadPdf: async (data) => {
				const doc = await getDocument({
					data,
					useWorkerFetch: false,
					disableFontFace: true,
					useSystemFonts: false,
				}).promise;
				return doc as unknown as PdfDocumentLike;
			},
		});

		expect(att).not.toBeNull();
		expect(att!.kind).toBe("pdf");
		expect(att!.content).toContain("Hello PDF fixture");
	});
});
