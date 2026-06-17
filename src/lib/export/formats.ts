// Pure logic that decides which export formats are offered for a given artifact, plus the file
// extension / mime metadata for each. Kept DOM-free and dependency-free so it can be unit-tested:
// the actual byte generation lives in generators.ts and the browser download in download.ts.

import type { ArtifactKind } from "@/types/chats";
import { hasTable } from "@/lib/export/markdown-table";

export type ExportFormat = "pdf" | "docx" | "md" | "html" | "svg" | "xlsx" | "csv" | "jsx" | "mmd";

export interface ExportFormatMeta {
	format: ExportFormat;
	// Human label shown in the export menu.
	label: string;
	// File extension WITHOUT the dot.
	ext: string;
	// MIME type for the generated Blob / download.
	mime: string;
}

export const FORMAT_META: Record<ExportFormat, ExportFormatMeta> = {
	pdf: { format: "pdf", label: "PDF", ext: "pdf", mime: "application/pdf" },
	docx: {
		format: "docx",
		label: "Word (DOCX)",
		ext: "docx",
		mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	},
	md: { format: "md", label: "Markdown", ext: "md", mime: "text/markdown;charset=utf-8" },
	html: { format: "html", label: "HTML", ext: "html", mime: "text/html;charset=utf-8" },
	svg: { format: "svg", label: "SVG", ext: "svg", mime: "image/svg+xml;charset=utf-8" },
	xlsx: {
		format: "xlsx",
		label: "Excel (XLSX)",
		ext: "xlsx",
		mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	},
	csv: { format: "csv", label: "CSV", ext: "csv", mime: "text/csv;charset=utf-8" },
	jsx: { format: "jsx", label: "Source (JSX)", ext: "jsx", mime: "text/jsx;charset=utf-8" },
	mmd: { format: "mmd", label: "Source (.mmd)", ext: "mmd", mime: "text/vnd.mermaid;charset=utf-8" },
};

// Decide the export formats relevant to an artifact. The rules:
//   - markdown documents -> PDF / DOCX / Markdown (and XLSX / CSV when they embed a GFM table);
//   - html documents     -> HTML file (+ PDF of the rendered text is out of scope, so just HTML);
//   - svg images         -> SVG file;
//   - react components    -> the JSX source as a code/HTML-ish download is not meaningful, so we
//     offer the raw source as a "code" download via Markdown-less text — handled as `html`-like is
//     wrong, so react simply exports its source file. To keep the menu honest we expose md (the
//     source) only for documents; react/mermaid get their raw source as a plain download elsewhere.
//
// We always offer the format(s) that produce a faithful artifact and never a format that would be a
// lie (e.g. we do not claim to export a React component to PDF).
export function exportFormatsFor(kind: ArtifactKind, code: string): ExportFormat[] {
	switch (kind) {
		case "markdown": {
			const formats: ExportFormat[] = ["pdf", "docx", "md"];
			if (hasTable(code)) {
				formats.push("xlsx", "csv");
			}
			return formats;
		}
		case "html":
			return ["html"];
		case "svg":
			return ["svg"];
		case "react":
			// A React component has no faithful office-format; offer the raw component source as a file.
			return ["jsx"];
		case "mermaid":
			// Save the diagram definition as a .mmd source file.
			return ["mmd"];
		default:
			return [];
	}
}

// Build a safe, lowercase, hyphenated base filename (no extension) from an artifact title.
export function safeBaseName(title: string, fallback = "artifact"): string {
	const base = (title || "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
	return base || fallback;
}

// Compose the full download filename for an artifact + format.
export function exportFileName(title: string, format: ExportFormat): string {
	return `${safeBaseName(title)}.${FORMAT_META[format].ext}`;
}
