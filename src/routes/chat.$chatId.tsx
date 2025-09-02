import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ChatInput } from "@/components/ChatInput";

export const Route = createFileRoute("/chat/$chatId")({
	component: Chat,
});

interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: Date;
}

interface ChatData {
	id: string;
	messages: Message[];
	initialMessage?: string;
	createdAt: string;
	updatedAt: string;
}

function Chat() {
	const { chatId } = Route.useParams();
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isInitialized, setIsInitialized] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const initialMessageProcessed = useRef(false);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	// Focus input when page loads
	useEffect(() => {
		const timer = setTimeout(() => {
			inputRef.current?.focus();
		}, 600); // Wait for page transition to complete

		return () => clearTimeout(timer);
	}, []);

	// Keep focus on input after sending messages
	useEffect(() => {
		if (!isLoading && inputRef.current) {
			inputRef.current.focus();
		}
	}, [isLoading]);

	// Load chat data from localStorage
	useEffect(() => {
		const loadChat = () => {
			const storedChat = localStorage.getItem(`chat-${chatId}`);
			if (storedChat) {
				const chatData: ChatData = JSON.parse(storedChat);
				setMessages(
					chatData.messages.map((m) => ({
						...m,
						timestamp: new Date(m.timestamp),
					})),
				);

				// If there are no messages but there's an initial message, process it
				if (chatData.initialMessage && chatData.messages.length === 0 && !initialMessageProcessed.current) {
					initialMessageProcessed.current = true;
					setTimeout(() => {
						handleSendMessage(chatData.initialMessage!);
					}, 100);
				}
			}
			setIsInitialized(true);
		};

		if (!isInitialized) {
			loadChat();
		}
	}, [chatId, isInitialized]); // eslint-disable-line react-hooks/exhaustive-deps

	// Save chat data to localStorage whenever messages change
	useEffect(() => {
		if (messages.length > 0) {
			const chatData: ChatData = {
				id: chatId,
				messages: messages.map((m) => ({
					...m,
					timestamp: m.timestamp,
				})),
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
			localStorage.setItem(`chat-${chatId}`, JSON.stringify(chatData));
		}
	}, [messages, chatId]);

	const handleSendMessage = async (messageContent: string = input) => {
		if (!messageContent.trim() || isLoading) return;

		const userMessage: Message = {
			id: Date.now().toString(),
			role: "user",
			content: messageContent.trim(),
			timestamp: new Date(),
		};

		setMessages((prev) => [...prev, userMessage]);
		setInput("");
		setIsLoading(true);

		try {
			const response = await fetch("https://api.libertai.io/v1/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${import.meta.env.VITE_LIBERTAI_API_KEY}`,
				},
				body: JSON.stringify({
					model: "gemma-3-27b",
					messages: [
						...messages.map((m) => ({
							role: m.role,
							content: m.content,
						})),
						{
							role: "user",
							content: messageContent.trim(),
						},
					],
					stream: false,
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			const assistantMessage: Message = {
				id: (Date.now() + 1).toString(),
				role: "assistant",
				content: data.choices[0]?.message?.content || "Sorry, I could not process your request.",
				timestamp: new Date(),
			};

			setMessages((prev) => [...prev, assistantMessage]);
		} catch (error) {
			console.error("Error sending message:", error);
			const errorMessage: Message = {
				id: (Date.now() + 1).toString(),
				role: "assistant",
				content: "Sorry, there was an error processing your request. Please try again.",
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, errorMessage]);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="h-full flex flex-col bg-background text-foreground animate-in slide-in-from-right-8 fade-in duration-500">
			{/* Messages area */}
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{messages.map((message) => (
					<div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
						<div
							className={`max-w-[80%] rounded-2xl px-4 py-2 text-foreground ${
								message.role === "user" ? "bg-white dark:bg-card" : "bg-transparent"
							}`}
						>
							{message.role === "assistant" ? (
								<div className="markdown-content">
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
											li: ({ children }) => <li className="text-sm">{children}</li>,
											blockquote: ({ children }) => (
												<blockquote className="border-l-2 border-primary/50 pl-3 italic">{children}</blockquote>
											),
										}}
									>
										{message.content}
									</ReactMarkdown>
								</div>
							) : (
								<p>{message.content}</p>
							)}
						</div>
					</div>
				))}

				{isLoading && (
					<div className="flex justify-start">
						<div className="bg-muted text-muted-foreground rounded-2xl px-4 py-2">
							<div className="flex items-center space-x-2">
								<div className="flex space-x-1">
									<div className="w-2 h-2 bg-current rounded-full animate-bounce" />
									<div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
									<div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
								</div>
								<span className="text-xs">AI is thinking...</span>
							</div>
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* Input area */}
			<div className="border-t border-border p-4">
				<div className="max-w-2xl mx-auto">
					<ChatInput
						value={input}
						onChange={setInput}
						onSubmit={() => handleSendMessage()}
						placeholder="Type your message..."
						disabled={isLoading}
						inputRef={inputRef}
					/>
				</div>
			</div>
		</div>
	);
}
