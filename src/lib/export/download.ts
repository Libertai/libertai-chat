// Thin browser-only helper that triggers a file download for an in-memory Blob, plus the orchestrator
// that maps an (artifact kind, code, format) to the right generator and downloads the result. All
// generation is client-side (see generators.ts); this module only touches the DOM to fire the
// download, so it is NOT imported by the unit tests for the generators.

import { extractTables } from "@/lib/export/markdown-table";
import { exportFileName, FORMAT_META, type ExportFormat } from "@/lib/export/formats";

// The office libraries (jspdf / docx / xlsx) are heavy; load the generators lazily so they are only
// fetched when the user actually exports, keeping them out of the canvas's initial bundle.
const loadGenerators = () => import("@/lib/export/generators");

// Save a Blob to disk via a transient object-URL anchor click. Mirrors the pattern already used in
// transactions.tsx and the image preview dialog.
export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.style.visibility = "hidden";
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	// Revoke on the next tick so the click has a chance to start the download first.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Produce the Blob for a given format + artifact source. The format already determines the
// generator (the menu only offers formats valid for the artifact kind). Pure aside from the docx
// async packer; no DOM.
export async function buildExportBlob(code: string, format: ExportFormat, title: string): Promise<Blob> {
	const gen = await loadGenerators();
	switch (format) {
		case "pdf":
			return gen.markdownToPdfBlob(code, title);
		case "docx":
			return gen.markdownToDocxBlob(code, title);
		case "md":
			return gen.textToBlob(code, FORMAT_META.md.mime);
		case "html":
			return gen.textToBlob(code, FORMAT_META.html.mime);
		case "svg":
			return gen.textToBlob(code, FORMAT_META.svg.mime);
		case "jsx":
			return gen.textToBlob(code, FORMAT_META.jsx.mime);
		case "mmd":
			return gen.textToBlob(code, FORMAT_META.mmd.mime);
		case "xlsx": {
			const table = extractTables(code)[0];
			if (!table) throw new Error("No tabular data to export to XLSX.");
			return gen.rowsToXlsxBlob(table.grid, title);
		}
		case "csv": {
			const table = extractTables(code)[0];
			if (!table) throw new Error("No tabular data to export to CSV.");
			return gen.rowsToCsvBlob(table.grid);
		}
		default:
			throw new Error(`Unsupported export format: ${format}`);
	}
}

// One-shot: build the blob for (code, format) and trigger the browser download.
export async function exportArtifact(code: string, format: ExportFormat, title: string): Promise<void> {
	const blob = await buildExportBlob(code, format, title);
	downloadBlob(blob, exportFileName(title, format));
}
