import { Children, cloneElement, isValidElement, useEffect, useState, type ReactElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { ChevronDown, ChevronRight, Copy, Globe, Lightbulb, Loader2, RotateCcw, Pencil, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MessageEditInput } from "@/components/MessageEditInput";
import { CodeBlock } from "@/components/CodeBlock";
import { useReadAloud } from "@/hooks/use-read-aloud";
import { extractLanguageFromClassName, hastText, normalizeCodeSource } from "@/utils/markdown";
import { citationAnchorId, parseCitations } from "@/utils/citations";
import type { Message as MessageType } from "@/types/chats";

function faviconDomain(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return "";
	}
}

interface MessageProps {
	message: MessageType;
	isLastMessage: boolean;
	isLoading: boolean;
	isStreaming: boolean;
	toolStatus?: string | null;
	onRegenerate: () => void;
	onEditMessage?: (id: string, content: string) => void;
	onRegenerateFromMessage?: (id: string) => void;
}

export function Message({
	message,
	isLastMessage,
	isLoading,
	isStreaming,
	toolStatus,
	onRegenerate,
	onEditMessage,
	onRegenerateFromMessage,
}: MessageProps) {
	const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
	const [isSourcesExpanded, setIsSourcesExpanded] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editedContent, setEditedContent] = useState(message.content);
	const { isPlaying, isPreparing, toggle: toggleReadAloud } = useReadAloud();

	const sourceCount = message.role === "assistant" && message.sources ? message.sources.length : 0;

	// Clicking an inline [n] marker opens the sources panel and scrolls the matching entry into
	// view. The panel mounts on expand, so defer the scroll until after it has rendered.
	const handleCitationClick = (n: number) => {
		setIsSourcesExpanded(true);
		const id = citationAnchorId(message.id, n);
		requestAnimationFrame(() => {
			const el = document.getElementById(id);
			el?.scrollIntoView({ behavior: "smooth", block: "center" });
			el?.classList.add("citation-flash");
			window.setTimeout(() => el?.classList.remove("citation-flash"), 1200);
		});
	};

	// Walk react-markdown's rendered children and turn `[n]` markers in string nodes into
	// clickable citation anchors. Recurses into nested element children (e.g. bold/links) so a
	// marker inside emphasis still becomes clickable; never touches non-string leaves we can't parse.
	const renderWithCitations = (children: ReactNode): ReactNode => {
		if (sourceCount <= 0) return children;
		return Children.map(children, (child) => {
			if (typeof child === "string") {
				const segments = parseCitations(child, sourceCount);
				if (segments.length === 1 && segments[0].type === "text") return child;
				return segments.map((seg, i) =>
					seg.type === "text" ? (
						seg.value
					) : (
						<a
							key={`cite-${i}-${seg.n}`}
							href={`#${citationAnchorId(message.id, seg.n)}`}
							data-citation={seg.n}
							onClick={(e) => {
								e.preventDefault();
								handleCitationClick(seg.n);
							}}
							className="citation-marker cursor-pointer align-baseline text-primary font-medium no-underline hover:underline"
						>
							[{seg.n}]
						</a>
					),
				);
			}
			if (isValidElement(child)) {
				const el = child as ReactElement<{ children?: ReactNode }>;
				if (el.props && "children" in el.props) {
					return cloneElement(el, undefined, renderWithCitations(el.props.children));
				}
			}
			return child;
		});
	};

	useEffect(() => {
		const hasOnlyThinking = message.role === "assistant" && message.thinking && !message.content;

		if (hasOnlyThinking) {
			setIsThinkingExpanded(true);
		}
	}, [message.thinking, message.content, message.role]);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(message.content);
			toast.success("Message copied to clipboard");
		} catch (err) {
			console.error("Failed to copy text: ", err);
			toast.error("Failed to copy message");
		}
	};

	const handleSave = (newContent: string) => {
		if (onEditMessage) {
			onEditMessage(message.id, newContent);
		} else {
			message.content = newContent;
		}

		setEditedContent(newContent);
		setIsEditing(false);

		if (message.role === "user" && onRegenerateFromMessage) {
			onRegenerateFromMessage(message.id);
		}
	};

	const handleCancel = () => {
		setEditedContent(message.content);
		setIsEditing(false);
	};

	return (
		<div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
			<div className={`group ${message.role === "user" ? "max-w-full" : "w-full"}`}>
				{/* Thinking section for assistant messages */}
				{message.role === "assistant" && message.thinking && (
					<div className="mb-3">
						<button
							onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
							className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-muted/20 rounded-lg transition-colors"
						>
							<Lightbulb className="w-4 h-4 text-primary" />
							<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Thinking</span>
							{isThinkingExpanded ? (
								<ChevronDown className="w-4 h-4 text-muted-foreground" />
							) : (
								<ChevronRight className="w-4 h-4 text-muted-foreground" />
							)}
						</button>

						{isThinkingExpanded && (
							<div className="mt-2 px-4 py-3 bg-muted/30 rounded-lg border-l-2 border-primary/30">
								<div className="text-sm text-muted-foreground italic whitespace-pre-wrap">{message.thinking}</div>
							</div>
						)}
					</div>
				)}

				{message.role === "assistant" && isLastMessage && toolStatus && (
					<div className="mb-3 flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
						<span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
						{toolStatus}
					</div>
				)}

				{/* Main message content */}
				<div
					className={`px-4 py-2 text-foreground ${
						message.role === "user" ? "bg-white dark:bg-card rounded-2xl rounded-br-none" : "bg-transparent"
					}`}
				>
					{/* Images for user messages */}
					{message.role === "user" && message.images && message.images.length > 0 && (
						<div className="mb-3 flex flex-wrap gap-2">
							{message.images.map((image, index) => (
								<div key={index} className="relative">
									<img
										src={image.data}
										alt={image.filename}
										className="max-w-xs max-h-48 object-cover rounded-lg border border-card dark:border-hover"
									/>
								</div>
							))}
						</div>
					)}

					{/* Text for user messages */}
					{message.role === "user" &&
						(isEditing ? (
							<MessageEditInput initialValue={editedContent} onSave={handleSave} onCancel={handleCancel} />
						) : (
							<p className="message-content whitespace-pre-wrap">{message.content}</p>
						))}

					{/* Images for assistant messages */}
					{message.role === "assistant" && message.images && message.images.length > 0 && (
						<div className="mb-3 flex flex-wrap gap-2">
							{message.images.map((image, index) => (
								<img
									key={index}
									src={image.data}
									alt={image.filename}
									className="max-w-sm w-full rounded-lg border border-card dark:border-hover"
								/>
							))}
						</div>
					)}

					{/* Text for assistant messages */}
					{message.role === "assistant" && (
						<div className="markdown-content message-content">
							<ReactMarkdown
								remarkPlugins={[remarkGfm, remarkMath]}
								rehypePlugins={[rehypeKatex]}
								components={{
									h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{renderWithCitations(children)}</h1>,
									h2: ({ children }) => <h2 className="text-base font-bold mb-2">{renderWithCitations(children)}</h2>,
									h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{renderWithCitations(children)}</h3>,
									p: ({ children }) => <p className="mb-2 last:mb-0">{renderWithCitations(children)}</p>,
									strong: ({ children }) => <strong className="font-bold">{renderWithCitations(children)}</strong>,
									em: ({ children }) => <em className="italic">{renderWithCitations(children)}</em>,
									del: ({ children }) => <del className="line-through opacity-70">{children}</del>,
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
									// Inline code only. Fenced blocks are handled by the `pre` override below,
									// which has reliable access to the language + raw source via the hast node.
									code: ({ children }) => (
										<code className="bg-background/50 rounded px-1 py-0.5 text-xs font-mono">{children}</code>
									),
									pre: ({ node, children }) => {
										// A fenced block is a <pre> wrapping a single <code> element. Read the
										// language class + raw text off the hast node so Shiki / mermaid get the
										// exact source. Fall back to the default <pre> if the shape is unexpected.
										const codeNode = node?.children?.find((c) => c.type === "element" && c.tagName === "code");
										if (codeNode && codeNode.type === "element") {
											const className = codeNode.properties?.className;
											const classStr = Array.isArray(className) ? className.join(" ") : String(className ?? "");
											const language = extractLanguageFromClassName(classStr);
											const source = normalizeCodeSource(hastText(codeNode));
											return <CodeBlock language={language} code={source} />;
										}
										return (
											<pre className="bg-background/50 rounded p-2 overflow-x-auto text-xs font-mono">{children}</pre>
										);
									},
									ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
									ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
									li: ({ children }) => (
										<li className="text-sm [&>p]:inline [&>p]:m-0">{renderWithCitations(children)}</li>
									),
									input: ({ checked, type }) =>
										type === "checkbox" ? (
											<input
												type="checkbox"
												checked={!!checked}
												readOnly
												className="mr-2 align-middle accent-primary"
											/>
										) : null,
									table: ({ children }) => (
										<div className="my-2 overflow-x-auto">
											<table className="w-full border-collapse text-sm">{children}</table>
										</div>
									),
									thead: ({ children }) => <thead className="border-b border-border">{children}</thead>,
									th: ({ children }) => (
										<th className="border border-border px-3 py-1.5 text-left font-semibold">{children}</th>
									),
									td: ({ children }) => (
										<td className="border border-border px-3 py-1.5">{renderWithCitations(children)}</td>
									),
									blockquote: ({ children }) => (
										<blockquote className="border-l-2 border-primary/50 pl-3 italic">
											{renderWithCitations(children)}
										</blockquote>
									),
								}}
							>
								{message.content}
							</ReactMarkdown>
						</div>
					)}

					{message.role === "assistant" && message.sources && message.sources.length > 0 && (
						<div className="mt-3">
							<button
								onClick={() => setIsSourcesExpanded(!isSourcesExpanded)}
								className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-muted/20 rounded-lg transition-colors"
							>
								<Globe className="w-4 h-4 text-primary" />
								<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
									{message.sources.length} source{message.sources.length > 1 ? "s" : ""}
								</span>
								{isSourcesExpanded ? (
									<ChevronDown className="w-4 h-4 text-muted-foreground" />
								) : (
									<ChevronRight className="w-4 h-4 text-muted-foreground" />
								)}
							</button>
							{isSourcesExpanded && (
								<div className="mt-2 space-y-2">
									{message.sources.map((s, index) => (
										<a
											key={s.url}
											id={citationAnchorId(message.id, index + 1)}
											href={s.url}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-muted/20 transition-colors scroll-mt-4 [&.citation-flash]:bg-primary/10 [&.citation-flash]:ring-1 [&.citation-flash]:ring-primary/40"
										>
											<span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded bg-primary/15 text-tiny font-semibold text-primary">
												{index + 1}
											</span>
											<img
												src={`https://www.google.com/s2/favicons?domain=${faviconDomain(s.url)}&sz=32`}
												alt=""
												className="w-4 h-4 mt-0.5 rounded"
											/>
											<span className="min-w-0">
												<span className="block text-sm font-medium truncate">{s.title}</span>
												<span className="block text-xs text-muted-foreground truncate">{s.snippet}</span>
											</span>
										</a>
									))}
								</div>
							)}
						</div>
					)}
				</div>

				{/* Edit button */}
				{message.role === "user" && !isEditing && (
					<div className="relative mt-1 w-full">
						<div className="absolute inset-0 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex justify-end items-center pr-4">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setIsEditing(true)}
								className="h-8 px-2 mt-8 text-muted-foreground hover:text-foreground hover:bg-white hover:dark:bg-card"
							>
								<Pencil className="w-4 h-4" />
							</Button>
						</div>
					</div>
				)}

				{/* Assistant actions */}
				{message.role === "assistant" && message.content && (
					<div className="flex items-center gap-2 mt-2 mx-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={handleCopy}
							className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-white hover:dark:bg-card"
						>
							<Copy className="w-4 h-4" />
						</Button>

						<Button
							variant="ghost"
							size="sm"
							onClick={() => toggleReadAloud(message.content)}
							aria-label={isPlaying || isPreparing ? "Stop reading" : "Read aloud"}
							title={isPlaying || isPreparing ? "Stop reading" : "Read aloud"}
							className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-white hover:dark:bg-card"
						>
							{isPreparing ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : isPlaying ? (
								<Square className="w-4 h-4" />
							) : (
								<Volume2 className="w-4 h-4" />
							)}
						</Button>

						{isLastMessage && !isLoading && !isStreaming && (
							<Button
								variant="ghost"
								size="sm"
								onClick={onRegenerate}
								className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-white hover:dark:bg-card"
							>
								<RotateCcw className="w-4 h-4" />
							</Button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
