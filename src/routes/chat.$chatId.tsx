import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ChevronDown, ChevronRight, Copy, Lightbulb, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ChatInput } from "@/components/ChatInput";
import { ConversationNotFound } from "@/components/ConversationNotFound";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/stores/chat";
import { useAssistantStore } from "@/stores/assistant";
import { useAccountStore } from "@/stores/account";
import { isMobileDevice } from "@/lib/utils";
import env from "@/config/env";
import OpenAI from "openai";
import { parseStreamingContent } from "@/utils/thinking-parser";

export const Route = createFileRoute("/chat/$chatId")({
	component: Chat,
});

function Chat() {
	const { chatId } = Route.useParams();
	const { getChat, addMessage, updateMessage, deleteMessage } = useChatStore();
	const { getAssistantOrDefault } = useAssistantStore();
	const { isAuthenticated, chatApiKey } = useAccountStore();
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isInitialized, setIsInitialized] = useState(false);
	const [isStreaming, setIsStreaming] = useState(false);
	const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	const chat = getChat(chatId);
	const messages = chat?.messages || [];

	// Use connected URL with API key when authenticated, otherwise use free URL without API key
	const openai = new OpenAI({
		baseURL: isAuthenticated ? env.LTAI_CONNECTED_API_URL : env.LTAI_INFERENCE_API_URL,
		apiKey: isAuthenticated ? chatApiKey || "" : "",
		dangerouslyAllowBrowser: true,
	});

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	// Only auto-scroll on initial load
	useEffect(() => {
		if (isInitialized) {
			scrollToBottom();
		}
	}, [isInitialized]);

	// Focus input when page loads (desktop only)
	useEffect(() => {
		if (!isMobileDevice()) {
			const timer = setTimeout(() => {
				inputRef.current?.focus();
			}, 600); // Wait for page transition to complete

			return () => clearTimeout(timer);
		}
	}, []);

	// Keep focus on input after sending messages (desktop only)
	useEffect(() => {
		if (!isLoading && !isMobileDevice() && inputRef.current) {
			inputRef.current.focus();
		}
	}, [isLoading]);

	// Initialize chat
	useEffect(() => {
		setIsInitialized(true);
	}, []);

	// Check if last message is from user and generate AI response
	useEffect(() => {
		if (messages.length > 0 && !isLoading && !isStreaming && isInitialized) {
			const lastMessage = messages[messages.length - 1];
			// Only generate response if last message is from user and there's no pending assistant message
			if (lastMessage.role === "user") {
				generateAIResponse().then();
			}
		}
	}, [messages.length, isLoading, isStreaming, isInitialized]); // eslint-disable-line react-hooks/exhaustive-deps

	const generateAIResponse = async () => {
		if (isLoading || isStreaming) return;

		// Double-check that the last message is from user (prevents duplicate calls)
		if (messages.length === 0) return;
		const lastMessage = messages[messages.length - 1];
		if (lastMessage.role !== "user") return;

		setIsLoading(true);
		setIsStreaming(false);

		// Add assistant message placeholder for streaming
		const assistantMessage = addMessage(chatId, "assistant", "");

		try {
			const assistant = getAssistantOrDefault(chat?.assistantId);

			const stream = await openai.chat.completions.create({
				model: assistant.model,
				messages: [
					{
						role: "system",
						content: assistant.systemPrompt,
					},
					...messages.map((m) => ({
						role: m.role,
						content: m.content,
					})),
				],
				stream: true,
			});

			let accumulatedRawContent = "";

			for await (const chunk of stream) {
				const content = chunk.choices[0]?.delta?.content;
				if (content) {
					accumulatedRawContent += content;

					if (!isStreaming) {
						setIsStreaming(true);
						setIsLoading(false);
					}

					// Parse thinking and content based on model
					const parsed = parseStreamingContent(assistant.model, accumulatedRawContent);

					// Update message with both content and thinking
					updateMessage(chatId, assistantMessage.id, parsed.content, parsed.thinking);
				}
			}

			// Final check to ensure we have content
			if (!accumulatedRawContent) {
				updateMessage(chatId, assistantMessage.id, "Sorry, I could not process your request.");
			}
		} catch (error) {
			console.error("Error sending message:", error);
			updateMessage(
				chatId,
				assistantMessage.id,
				"Sorry, there was an error processing your request. Please try again.",
			);
		} finally {
			// Ensure loading and streaming states are properly set at the end
			setIsLoading(false);
			setIsStreaming(false);
		}
	};

	const handleSendMessage = async (messageContent: string = input) => {
		if (!messageContent.trim() || isLoading) return;

		// Add user message to store
		addMessage(chatId, "user", messageContent.trim());
		setInput("");
	};

	const handleCopyMessage = async (content: string) => {
		try {
			await navigator.clipboard.writeText(content);
			toast.success("Message copied to clipboard");
		} catch (err) {
			console.error("Failed to copy text: ", err);
			toast.error("Failed to copy message");
		}
	};

	const handleRegenerateMessage = async () => {
		if (isLoading || isStreaming || messages.length === 0) return;

		// Find the last assistant message and regenerate it
		const lastAssistantMessageIndex = messages.length - 1;
		const lastMessage = messages[lastAssistantMessageIndex];

		if (lastMessage?.role !== "assistant") return;

		// Clear the last assistant message content and regenerate
		deleteMessage(chatId, lastMessage.id);
		await generateAIResponse();
	};

	const toggleThinking = (messageId: string) => {
		setExpandedThinking((prev) => {
			const next = new Set(prev);
			if (next.has(messageId)) {
				next.delete(messageId);
			} else {
				next.add(messageId);
			}
			return next;
		});
	};

	// Show 404 if chat doesn't exist
	if (!chat) {
		return <ConversationNotFound />;
	}

	return (
		<div className="h-full flex flex-col bg-background text-foreground animate-in slide-in-from-right-8 fade-in duration-500">
			{/* Messages area */}
			<div className="flex-1 overflow-y-auto p-4">
				<div className="max-w-4xl mx-auto space-y-8 md:space-y-11">
					{messages.map((message, index) => (
						<div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
							<div className={`group ${message.role === "user" ? "" : "w-full"}`}>
								{/* Thinking section for assistant messages */}
								{message.role === "assistant" && message.thinking && (
									<div className="mb-3">
										<button
											onClick={() => toggleThinking(message.id)}
											className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-muted/20 rounded-lg transition-colors"
										>
											<Lightbulb className="w-4 h-4 text-yellow-500" />
											<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
												Thinking
											</span>
											{expandedThinking.has(message.id) ? (
												<ChevronDown className="w-4 h-4 text-muted-foreground" />
											) : (
												<ChevronRight className="w-4 h-4 text-muted-foreground" />
											)}
										</button>
										{expandedThinking.has(message.id) && (
											<div className="mt-2 px-4 py-3 bg-muted/30 rounded-lg border-l-2 border-yellow-500/30">
												<div className="text-sm text-muted-foreground italic whitespace-pre-wrap">
													{message.thinking}
												</div>
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
														<pre className="bg-background/50 rounded p-2 overflow-x-auto text-xs font-mono">
															{children}
														</pre>
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
								{message.role === "assistant" && message.content && (
									<div className="flex items-center gap-2 mt-2 mx-2">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleCopyMessage(message.content)}
											className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-white hover:dark:bg-card"
										>
											<Copy className="w-4 h-4" />
										</Button>
										{index === messages.length - 1 && !isLoading && !isStreaming && (
											<Button
												variant="ghost"
												size="sm"
												onClick={handleRegenerateMessage}
												className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-white hover:dark:bg-card"
											>
												<RotateCcw className="w-4 h-4" />
											</Button>
										)}
									</div>
								)}
							</div>
						</div>
					))}

					{isLoading && !isStreaming && (
						<div className="flex justify-start">
							<div className="bg-white dark:bg-card text-muted-foreground rounded-2xl px-4 py-2">
								<div className="flex items-center space-x-2">
									<div className="flex space-x-1">
										<div className="w-2 h-2 bg-current rounded-full animate-bounce" />
										<div
											className="w-2 h-2 bg-current rounded-full animate-bounce"
											style={{ animationDelay: "0.1s" }}
										/>
										<div
											className="w-2 h-2 bg-current rounded-full animate-bounce"
											style={{ animationDelay: "0.2s" }}
										/>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>

				<div ref={messagesEndRef} />
			</div>

			{/* Input area */}
			<div className="p-4">
				<div className="max-w-4xl mx-auto">
					<div className="max-w-2xl mx-auto">
						<ChatInput
							value={input}
							onChange={setInput}
							onSubmit={() => handleSendMessage()}
							placeholder="Continue private conversation..."
							disabled={isLoading}
							inputRef={inputRef}
							assistantName={getAssistantOrDefault(chat?.assistantId).title}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
