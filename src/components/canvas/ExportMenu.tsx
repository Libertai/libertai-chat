import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@libertai/ui/dropdown-menu";
import { exportFormatsFor, FORMAT_META, type ExportFormat } from "@/lib/export/formats";
import { exportArtifact } from "@/lib/export/download";
import type { ArtifactKind } from "@/types/chats";

interface ExportMenuProps {
	kind: ArtifactKind;
	code: string;
	title: string;
}

// Export menu for the Canvas panel. Offers only the formats that produce a FAITHFUL file for the
// current artifact (a markdown doc -> PDF / DOCX / Markdown, plus XLSX / CSV when it embeds a table;
// HTML / SVG -> file; React / mermaid -> raw source). All generation is in-browser (Blob + download);
// nothing is uploaded. The available-format logic and the byte generators are unit-tested; this
// component is exercised by e2e/export.spec.ts (which asserts a real Playwright download event).
export function ExportMenu({ kind, code, title }: ExportMenuProps) {
	const [busy, setBusy] = useState<ExportFormat | null>(null);
	const formats = exportFormatsFor(kind, code);

	if (formats.length === 0) return null;

	const handleExport = async (format: ExportFormat) => {
		setBusy(format);
		try {
			await exportArtifact(code, format, title);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : `Could not export to ${FORMAT_META[format].label}.`);
		} finally {
			setBusy(null);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					data-canvas-export
					aria-label="Export artifact"
					className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
				>
					{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
					Export
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-[10rem]" data-canvas-export-menu>
				<DropdownMenuLabel className="text-tiny uppercase tracking-wide text-muted-foreground">
					Download as
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{formats.map((format) => (
					<DropdownMenuItem
						key={format}
						data-export-format={format}
						disabled={busy !== null}
						onSelect={() => {
							// Let Radix close the menu on select; the async export fires-and-finishes
							// independently (the trigger shows a spinner via `busy` while it runs).
							void handleExport(format);
						}}
					>
						{FORMAT_META[format].label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
