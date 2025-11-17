import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChatInput } from "@/components/ChatInput";
import { ConversationNotFound } from "@/components/ConversationNotFound";
import { Message } from "@/components/Message";
import { useChatStore } from "@/stores/chat";
import { useAssistantStore } from "@/stores/assistant";
import { useAccountStore } from "@/stores/account";
import env from "@/config/env";
import OpenAI from "openai";
import { parseStreamingContent } from "@/utils/thinking-parser";
import type { ImageData } from "@/types/chats";

export const Route = createFileRoute("/chat/$chatId")({
	component: Chat,
});

function Chat() {
	const { chatId } = Route.useParams();
	const { getChat, addMessage, updateMessage, deleteMessage, truncateMessagesAfter } = useChatStore();
	const { getAssistantOrDefault } = useAssistantStore();
	const { isAuthenticated, chatApiKey } = useAccountStore();
	const [isLoading, setIsLoading] = useState(false);
	const [isInitialized, setIsInitialized] = useState(false);
	const [isStreaming, setIsStreaming] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);

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
					...messages.map((m) => {
						/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
						const messageContent: any = { role: m.role };

						// Handle images for user messages
						if (m.role === "user" && m.images && m.images.length > 0) {
							messageContent.content = [
								{
									type: "text",
									text: m.content,
								},
								...m.images.map((img) => ({
									type: "image_url",
									image_url: {
										url: img.data,
									},
								})),
							];
						} else {
							messageContent.content = m.content;
						}

						return messageContent;
					}),
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

	const handleSendMessage = async (value: string, images?: ImageData[]) => {
		if (!value.trim() || isLoading) return;

		// Add user message to store with images
		addMessage(chatId, "user", value.trim(), undefined, images);
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

	const handleEditMessage = (messageId: string, newContent: string) => {
		updateMessage(chatId, messageId, newContent);
	};

	const handleRegenerateFromMessage = async (messageId: string) => {
		if (isLoading || isStreaming) return;

		truncateMessagesAfter(chatId, messageId);
		await generateAIResponse();
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
						<Message
							key={message.id}
							message={message}
							isLastMessage={index === messages.length - 1}
							isLoading={isLoading}
							isStreaming={isStreaming}
							onRegenerate={handleRegenerateMessage}
							onEditMessage={handleEditMessage}
							onRegenerateFromMessage={handleRegenerateFromMessage}
						/>
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
							onSubmit={handleSendMessage}
							placeholder="Continue private conversation..."
							disabled={isLoading}
							assistant={getAssistantOrDefault(chat?.assistantId)}
							autoFocus
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
