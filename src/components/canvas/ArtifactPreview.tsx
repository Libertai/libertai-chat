import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Loader2 } from "lucide-react";
import { buildPreviewSource } from "@/lib/canvas/preview-source";
import { compileReact } from "@/lib/canvas/compile-react";
import { renderMermaid } from "@/utils/mermaid";
import { CodeBlock } from "@/components/CodeBlock";
import { extractLanguageFromClassName, hastText, normalizeCodeSource } from "@/utils/markdown";
import type { ArtifactKind } from "@/types/chats";

interface ArtifactPreviewProps {
	kind: ArtifactKind;
	code: string;
	language: string;
}

// Live preview of one artifact version. html/svg/react render in a sandboxed iframe (opaque origin,
// CSP-locked) so model-generated code can never touch the parent app. mermaid renders to SVG via the
// shared lib; markdown renders through the m1 markdown pipeline. All client-side.
export function ArtifactPreview({ kind, code, language }: ArtifactPreviewProps) {
	if (kind === "html" || kind === "svg") {
		return <IframePreview srcdoc={buildPreviewSource(kind, code)} />;
	}
	if (kind === "react") {
		return <ReactPreview code={code} language={language} />;
	}
	if (kind === "mermaid") {
		return <MermaidPreview code={code} />;
	}
	return <MarkdownPreview code={code} />;
}

function PreviewFrame({ srcdoc }: { srcdoc: string }) {
	return (
		<iframe
			title="artifact-preview"
			data-canvas-preview-frame
			// Opaque-origin sandbox: scripts allowed, but no same-origin / storage / cookie access to
			// the parent app. The srcdoc additionally pins a CSP. Same posture as the code interpreter.
			sandbox="allow-scripts"
			srcDoc={srcdoc}
			className="h-full w-full border-0 bg-white"
		/>
	);
}

function IframePreview({ srcdoc }: { srcdoc: string }) {
	return <PreviewFrame srcdoc={srcdoc} />;
}

function ReactPreview({ code, language }: { code: string; language: string }) {
	const [srcdoc, setSrcdoc] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		setSrcdoc(null);
		setError(null);
		compileReact(code, language)
			.then((res) => {
				if (cancelled) return;
				if (res.error || !res.code) {
					setError(res.error ?? "Failed to compile component.");
					return;
				}
				setSrcdoc(buildPreviewSource("react", res.code));
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof Error ? err.message : String(err));
			});
		return () => {
			cancelled = true;
		};
	}, [code, language]);

	if (error) {
		return (
			<div className="h-full overflow-auto p-4">
				<pre
					data-canvas-preview-error
					className="whitespace-pre-wrap rounded-lg bg-destructive/10 p-3 text-xs font-mono text-destructive"
				>
					{error}
				</pre>
			</div>
		);
	}

	if (!srcdoc) {
		return (
			<div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" />
				Compiling component…
			</div>
		);
	}

	return <PreviewFrame srcdoc={srcdoc} />;
}

let canvasMermaidCounter = 0;

function MermaidPreview({ code }: { code: string }) {
	const [svg, setSvg] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const id = `canvas-mermaid-${(canvasMermaidCounter += 1)}`;
		setFailed(false);
		setSvg(null);
		renderMermaid(id, code)
			.then((result) => {
				if (!cancelled) setSvg(result);
			})
			.catch(() => {
				if (!cancelled) setFailed(true);
			});
		return () => {
			cancelled = true;
		};
	}, [code]);

	if (failed) {
		return (
			<div className="h-full overflow-auto p-4">
				<pre className="whitespace-pre-wrap rounded-lg bg-background/50 p-3 text-xs font-mono text-muted-foreground">
					{code}
				</pre>
			</div>
		);
	}

	if (!svg) {
		return (
			<div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" />
				Rendering diagram…
			</div>
		);
	}

	return (
		<div className="h-full overflow-auto bg-white/95 p-4">
			<div
				data-canvas-mermaid
				className="flex justify-center [&_svg]:max-w-full"
				// mermaid renders with securityLevel "strict" (HTML labels disabled, scripts stripped).
				dangerouslySetInnerHTML={{ __html: svg }}
			/>
		</div>
	);
}

function MarkdownPreview({ code }: { code: string }) {
	// Reuse the m1 markdown pipeline (GFM + math). Fenced code goes through the shared CodeBlock so
	// highlighting/mermaid stays consistent with the message renderer.
	return (
		<div className="markdown-content message-content h-full overflow-auto p-4" data-canvas-markdown>
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkMath]}
				rehypePlugins={[rehypeKatex]}
				components={{
					h1: ({ children }) => <h1 className="mb-2 text-lg font-bold">{children}</h1>,
					h2: ({ children }) => <h2 className="mb-2 text-base font-bold">{children}</h2>,
					h3: ({ children }) => <h3 className="mb-1 text-sm font-bold">{children}</h3>,
					p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
					a: ({ children, href }) => (
						<a
							href={href}
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary underline underline-offset-2 hover:opacity-80"
						>
							{children}
						</a>
					),
					code: ({ children }) => (
						<code className="rounded bg-background/50 px-1 py-0.5 text-xs font-mono">{children}</code>
					),
					pre: ({ node, children }) => {
						const codeNode = node?.children?.find((c) => c.type === "element" && c.tagName === "code");
						if (codeNode && codeNode.type === "element") {
							const className = codeNode.properties?.className;
							const classStr = Array.isArray(className) ? className.join(" ") : String(className ?? "");
							const language = extractLanguageFromClassName(classStr);
							const source = normalizeCodeSource(hastText(codeNode));
							return <CodeBlock language={language} code={source} />;
						}
						return (
							<pre className="overflow-x-auto rounded bg-background/50 p-2 text-xs font-mono">{children}</pre>
						);
					},
					ul: ({ children }) => <ul className="mb-2 list-disc list-inside space-y-1">{children}</ul>,
					ol: ({ children }) => <ol className="mb-2 list-decimal list-inside space-y-1">{children}</ol>,
					li: ({ children }) => <li className="text-sm [&>p]:m-0 [&>p]:inline">{children}</li>,
					blockquote: ({ children }) => (
						<blockquote className="border-l-2 border-primary/50 pl-3 italic">{children}</blockquote>
					),
				}}
			>
				{code}
			</ReactMarkdown>
		</div>
	);
}
