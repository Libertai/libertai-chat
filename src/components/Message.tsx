import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ChevronDown, ChevronRight, Copy, Lightbulb, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Message as MessageType } from "@/types/chats";

interface MessageProps {
	message: MessageType;
	isLastMessage: boolean;
	isLoading: boolean;
	isStreaming: boolean;
	onRegenerate: () => void;
}

export function Message({ message, isLastMessage, isLoading, isStreaming, onRegenerate }: MessageProps) {
	const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

	// Auto-expand thinking if there's only thinking (no content yet - still streaming thinking)
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

	return (
		<div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
			<div className={`group ${message.role === "user" ? "" : "w-full"}`}>
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

				{/* Main message content */}
				<div
					className={`px-4 py-2 text-foreground ${
						message.role === "user" ? "bg-white dark:bg-card rounded-2xl rounded-br-none" : "bg-transparent"
					}`}
				>
					{message.role === "assistant" ? (
						<div className="markdown-content message-content">
							<ReactMarkdown
								components={{
									h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
									h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
									h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
									p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
									strong: ({ children }) => <strong className="font-bold">{children}</strong>,
									em: ({ children }) => <em className="italic">{children}</em>,
									code: ({ children }) => (
										<code className="bg-background/50 rounded px-1 py-0.5 text-xs font-mono">{children}</code>
									),
									pre: ({ children }) => (
										<pre className="bg-background/50 rounded p-2 overflow-x-auto text-xs font-mono">{children}</pre>
									),
									ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
									ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
									li: ({ children }) => <li className="text-sm [&>p]:inline [&>p]:m-0">{children}</li>,
									blockquote: ({ children }) => (
										<blockquote className="border-l-2 border-primary/50 pl-3 italic">{children}</blockquote>
									),
								}}
							>
								{message.content}
							</ReactMarkdown>
						</div>
					) : (
						<p className="message-content">{message.content}</p>
					)}
				</div>

				{/* Action buttons for assistant messages */}
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
