import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Download, FileText, Loader2, Terminal } from "lucide-react";
import { CodeBlock } from "@/components/CodeBlock";
import { downloadBlob } from "@/lib/export/download";
import { formatBytes } from "@/utils/chat-tools";
import type { InterpreterRun } from "@/types/chats";

// Renders one client-side code-interpreter run inside an assistant message: the executed source
// (syntax-highlighted via the shared CodeBlock), captured stdout, the last expression / return
// value, any matplotlib figure (base64 PNG), and errors / timeout notices. Pure presentation —
// the run already happened client-side and is persisted on the message.

const LANGUAGE_LABEL: Record<InterpreterRun["language"], string> = {
	python: "Python",
	javascript: "JavaScript",
};

const CODE_FENCE_LANG: Record<InterpreterRun["language"], string> = {
	python: "python",
	javascript: "javascript",
};

function OutputBlock({ label, text, tone }: { label: string; text: string; tone: "normal" | "error" }) {
	if (!text.trim()) return null;
	return (
		<div className="mt-2">
			<div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
			<pre
				className={`overflow-x-auto rounded-lg p-3 text-xs font-mono whitespace-pre-wrap ${
					tone === "error" ? "bg-destructive/10 text-destructive" : "bg-background/50 text-foreground"
				}`}
			>
				{text.replace(/\n+$/, "")}
			</pre>
		</div>
	);
}

/** One download chip for a file the executed code wrote to the sandbox filesystem. The bytes are
 *  base64-embedded on the message; on click we decode them to a Blob and fire the download via the
 *  shared downloadBlob helper (the same pattern transactions / the image preview / canvas export use),
 *  rather than holding a long-lived blob: anchor — a persistent blob URL tripped a CSP/load error. */
function FileChip({ file }: { file: { name: string; mime: string; base64: string; size: number } }) {
	const handleDownload = () => {
		try {
			const bin = atob(file.base64);
			const bytes = new Uint8Array(bin.length);
			for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
			downloadBlob(new Blob([bytes], { type: file.mime || "application/octet-stream" }), file.name);
		} catch (err) {
			console.error("Failed to decode interpreter file:", err);
		}
	};
	return (
		<button
			type="button"
			onClick={handleDownload}
			className="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-sm transition-colors hover:bg-muted/40"
			data-interpreter-file={file.name}
		>
			<FileText className="h-4 w-4 flex-none text-primary" />
			<span className="flex min-w-0 flex-col">
				<span className="truncate font-medium">{file.name}</span>
				<span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
			</span>
			<Download className="ml-auto h-4 w-4 flex-none text-muted-foreground" />
		</button>
	);
}

export function InterpreterOutput({ run }: { run: InterpreterRun }) {
	const [isCodeExpanded, setIsCodeExpanded] = useState(false);
	const hasOutput =
		run.stdout.trim() || run.stderr.trim() || (run.result != null && run.result !== "") || run.imagePng || run.error;

	return (
		<div
			className="my-3 rounded-xl border border-border bg-card/40 p-3"
			data-interpreter-run
			data-language={run.language}
		>
			<div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				<Terminal className="h-4 w-4 text-primary" />
				<span>{LANGUAGE_LABEL[run.language]} interpreter</span>
			</div>

			{/* Source is collapsed by default — non-technical users see the result (output / files /
			    images), not the code; click the header to reveal it. */}
			<button
				type="button"
				onClick={() => setIsCodeExpanded((v) => !v)}
				aria-expanded={isCodeExpanded}
				className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/20"
			>
				{isCodeExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
				<span>{isCodeExpanded ? "Hide code" : "Show code"}</span>
			</button>

			{isCodeExpanded && <CodeBlock language={CODE_FENCE_LANG[run.language]} code={run.code} />}

			{run.pending && (
				<div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
					<Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
					<span>{run.phase === "preparing" ? "Preparing Python environment…" : "Running…"}</span>
				</div>
			)}

			{run.imagePng && (
				<div className="mt-2">
					<img
						src={run.imagePng}
						alt="Generated plot"
						data-interpreter-image
						className="max-w-md max-h-[28rem] w-auto rounded-lg border border-card dark:border-hover bg-white object-contain"
					/>
				</div>
			)}

			<OutputBlock label="Output" text={run.stdout} tone="normal" />

			{run.result != null && run.result !== "" && <OutputBlock label="Result" text={run.result} tone="normal" />}

			{run.files && run.files.length > 0 && (
				<div className="mt-2 flex flex-wrap gap-2">
					{run.files.map((file, i) => (
						<FileChip key={i} file={file} />
					))}
				</div>
			)}

			<OutputBlock label="Errors" text={run.stderr} tone="error" />

			{(run.error || run.timedOut) && (
				<div
					className="mt-2 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
					data-interpreter-error
				>
					<AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
					<span>{run.timedOut ? "Execution timed out and was stopped." : run.error || "The code failed to run."}</span>
				</div>
			)}

			{!hasOutput && !run.timedOut && !run.pending && (
				<div className="mt-2 text-xs text-muted-foreground">Ran with no output.</div>
			)}
		</div>
	);
}
