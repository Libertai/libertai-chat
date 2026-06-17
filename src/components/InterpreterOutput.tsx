import { AlertTriangle, Terminal } from "lucide-react";
import { CodeBlock } from "@/components/CodeBlock";
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

export function InterpreterOutput({ run }: { run: InterpreterRun }) {
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

			<CodeBlock language={CODE_FENCE_LANG[run.language]} code={run.code} />

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

			{run.result != null && run.result !== "" && (
				<OutputBlock label="Result" text={run.result} tone="normal" />
			)}

			<OutputBlock label="Errors" text={run.stderr} tone="error" />

			{(run.error || run.timedOut) && (
				<div
					className="mt-2 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
					data-interpreter-error
				>
					<AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
					<span>
						{run.timedOut
							? "Execution timed out and was stopped."
							: run.error || "The code failed to run."}
					</span>
				</div>
			)}

			{!hasOutput && !run.timedOut && (
				<div className="mt-2 text-xs text-muted-foreground">Ran with no output.</div>
			)}
		</div>
	);
}
