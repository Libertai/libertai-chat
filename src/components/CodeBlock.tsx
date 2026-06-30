import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { highlightCode } from "@/utils/shiki";
import { renderMermaid } from "@/utils/mermaid";
import { isMermaidLanguage, resolveCodeLanguage } from "@/utils/markdown";

interface CodeBlockProps {
	// Raw language token from the fence (e.g. "js", "mermaid"), if any.
	language: string | undefined;
	// Exact source the user wrote (trailing newline already stripped).
	code: string;
}

let mermaidCounter = 0;

// Renders a fenced code block: a mermaid diagram (rendered to SVG) or syntax-highlighted
// code via Shiki, with a Copy button that copies the raw source. All rendering is lazy
// and client-side; parse/highlight failures fall back to plain text so a bad block never
// crashes the message.
export function CodeBlock({ language, code }: CodeBlockProps) {
	const isMermaid = isMermaidLanguage(language);

	if (isMermaid) {
		return <MermaidBlock code={code} />;
	}

	return <HighlightedBlock language={language} code={code} />;
}

function CopyButton({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		};
	}, []);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
			timeoutRef.current = setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy code block:", err);
		}
	};

	return (
		<button
			type="button"
			onClick={handleCopy}
			aria-label={copied ? "Copied" : "Copy code"}
			title={copied ? "Copied" : "Copy code"}
			data-copied={copied ? "true" : "false"}
			className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/40 px-2 py-1 text-xs text-white/80 opacity-0 transition-opacity hover:bg-black/60 hover:text-white focus-visible:opacity-100 group-hover/code:opacity-100"
		>
			{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
			<span>{copied ? "Copied" : "Copy"}</span>
		</button>
	);
}

function HighlightedBlock({ language, code }: CodeBlockProps) {
	const [html, setHtml] = useState<string | null>(null);
	const resolved = resolveCodeLanguage(language);

	useEffect(() => {
		if (!resolved) {
			setHtml(null);
			return;
		}

		let cancelled = false;
		highlightCode(code, resolved)
			.then((result) => {
				if (!cancelled) setHtml(result);
			})
			.catch((err) => {
				console.error("Shiki highlight failed:", err);
				if (!cancelled) setHtml(null);
			});

		return () => {
			cancelled = true;
		};
	}, [code, resolved]);

	return (
		<div className="group/code relative my-2">
			<CopyButton code={code} />
			{html ? (
				<div
					className="shiki-block overflow-x-auto rounded-lg text-xs [&_pre]:m-0 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:font-mono"
					data-highlighted="true"
					// Shiki returns sanitized, theme-styled HTML (token <span>s). Source is the
					// model's fenced code; rendered client-side only.
					dangerouslySetInnerHTML={{ __html: html }}
				/>
			) : (
				<pre className="overflow-x-auto rounded-lg bg-[#0d1117] p-3 text-xs font-mono text-white/90">
					<code>{code}</code>
				</pre>
			)}
		</div>
	);
}

function MermaidBlock({ code }: { code: string }) {
	const [svg, setSvg] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const id = `mermaid-svg-${(mermaidCounter += 1)}`;

		setFailed(false);
		setSvg(null);

		renderMermaid(id, code)
			.then((result) => {
				if (!cancelled) setSvg(result);
			})
			.catch((err) => {
				console.error("Mermaid render failed:", err);
				if (!cancelled) setFailed(true);
			});

		return () => {
			cancelled = true;
		};
	}, [code]);

	if (failed) {
		// A bad diagram should never break the message: show the raw source instead.
		return (
			<div className="group/code relative my-2">
				<CopyButton code={code} />
				<pre className="overflow-x-auto rounded-lg bg-background/50 p-3 text-xs font-mono text-muted-foreground">
					<code>{code}</code>
				</pre>
			</div>
		);
	}

	if (!svg) {
		return <div className="my-2 rounded-lg bg-background/50 p-3 text-xs text-muted-foreground">Rendering diagram…</div>;
	}

	return (
		<div
			className="mermaid-diagram my-2 flex justify-center overflow-x-auto rounded-lg bg-white/95 p-3 [&_svg]:max-w-full"
			data-mermaid="rendered"
			// mermaid renders with securityLevel "strict" (HTML labels disabled, scripts stripped).
			dangerouslySetInnerHTML={{ __html: svg }}
		/>
	);
}
