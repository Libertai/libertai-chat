import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatInput } from "@/components/ChatInput";
import { ConversationNotFound } from "@/components/ConversationNotFound";
import { Message } from "@/components/Message";
import { useChatStore } from "@/stores/chat";
import { useAssistantStore } from "@/stores/assistant";
import { useAccountStore } from "@libertai/auth";
import { useChatApiKey } from "@/hooks/data/use-chat-api-key";
import { resolveChatEndpoint } from "@/utils/chat-endpoint";
import { useModels } from "@/hooks/data/use-models";
import { supportsTools, resolveChatModel } from "@/config/model-capabilities";
import { buildRequestMessages } from "@/utils/build-request-messages";
import { ToolCallAccumulator } from "@/utils/tool-call-accumulator";
import { TOOL_DEFINITIONS, executeWebSearch, executeGenerateImage } from "@/utils/chat-tools";
import type { GenerateImageArgs } from "@/utils/chat-tools";
import { consumePendingForcedTool } from "@/utils/pending-forced-tool";
import env from "@/config/env";
import OpenAI from "openai";
import { toast } from "sonner";
import type { ParsedMessage } from "@/utils/thinking-parser";
import type { ImageData } from "@/types/chats";

export const Route = createFileRoute("/chat/$chatId")({
	component: Chat,
});

function Chat() {
	const { chatId } = Route.useParams();
	const { getChat, addMessage, updateMessage, updateMessageArtifacts, deleteMessage, truncateMessagesAfter, setChatModel } =
		useChatStore();
	const { getAssistantOrDefault } = useAssistantStore();
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	const { chatApiKey, isLoading: isChatKeyLoading } = useChatApiKey();
	const { data: models } = useModels();
	const [isLoading, setIsLoading] = useState(false);
	const [isInitialized, setIsInitialized] = useState(false);
	const [isStreaming, setIsStreaming] = useState(false);
	const [toolStatus, setToolStatus] = useState<string | null>(null);
	const pendingForcedToolRef = useRef<"web_search" | "generate_image" | undefined>(undefined);
	const abortRef = useRef<AbortController | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const chat = getChat(chatId);
	const messages = chat?.messages || [];

	// Effective model = explicit per-chat override (set via the ModelPicker) overriding the persona's
	// pinned model. Personas still work when no explicit choice has been made.
	const effectiveModel = resolveChatModel(chat?.model, getAssistantOrDefault(chat?.assistantId).model);

	const useConnected = isAuthenticated && !!chatApiKey;
	const modelSupportsTools = useMemo(
		() => supportsTools(effectiveModel, models ?? []),
		[effectiveModel, models],
	);

	// Authenticated users always use the connected endpoint with their chat API key (chat keys are
	// free at the gateway — never credit-gated). Logged-out users (or while the key is still being
	// fetched) use the free public endpoint, so we never hit the connected endpoint with an empty key.
	const { baseURL, apiKey } = resolveChatEndpoint({
		isAuthenticated,
		chatApiKey,
		connectedApiUrl: env.LTAI_CONNECTED_API_URL,
		freeApiUrl: env.LTAI_INFERENCE_API_URL,
	});
	const openai = useMemo(
		() =>
			new OpenAI({
				baseURL,
				apiKey,
				dangerouslyAllowBrowser: true,
			}),
		[baseURL, apiKey],
	);

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
		// Hold the first send until the per-user chat key has loaded. On a cold reload
		// `checkSession()` restores auth before `useChatApiKey` finishes fetching; firing now
		// would read the user as not-connected and downgrade to the free endpoint (the post-login
		// "can't send a message" bug). When the key resolves, `isChatKeyLoading` flips and this
		// effect re-runs to generate against the connected endpoint.
		if (isAuthenticated && isChatKeyLoading) return;
		if (messages.length > 0 && !isLoading && !isStreaming && isInitialized) {
			const lastMessage = messages[messages.length - 1];
			// Only generate response if last message is from user and there's no pending assistant message
			if (lastMessage.role === "user") {
				// In-conversation force lives on the ref; a force chosen on the home input before this
				// chat existed is handed off by chat id and consumed here for the first response.
				const forced = pendingForcedToolRef.current ?? consumePendingForcedTool(chatId);
				pendingForcedToolRef.current = undefined;
				generateAIResponse(forced).then();
			}
		}
	}, [messages.length, isLoading, isStreaming, isInitialized, isAuthenticated, isChatKeyLoading]); // eslint-disable-line react-hooks/exhaustive-deps

	const TOOL_LABELS: Record<string, string> = {
		web_search: "Searching the web…",
		generate_image: "Generating image…",
	};

	const generateAIResponse = async (forcedTool?: "web_search" | "generate_image") => {
		if (isLoading || isStreaming) return;
		if (messages.length === 0) return;
		if (messages[messages.length - 1].role !== "user") return;

		setIsLoading(true);
		setIsStreaming(false);
		setToolStatus(null);

		const controller = new AbortController();
		abortRef.current = controller;

		const assistant = getAssistantOrDefault(chat?.assistantId);
		const assistantMessage = addMessage(chatId, "assistant", "");

		const toolsEnabled = useConnected && modelSupportsTools;

		const requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
			{ role: "system", content: assistant.systemPrompt },
			...buildRequestMessages(messages, effectiveModel, models ?? []),
		];

		const accumulated: ParsedMessage = { thinking: "", content: "" };
		const collectedSources: { title: string; url: string; snippet: string }[] = [];
		const collectedImages: ImageData[] = [];

		try {
			for (let iteration = 0; iteration < 5; iteration++) {
				const toolAcc = new ToolCallAccumulator();
				accumulated.content = "";
				accumulated.thinking = "";

				const stream = await openai.chat.completions.create(
					{
						model: effectiveModel,
						messages: requestMessages,
						stream: true,
						...(toolsEnabled ? { tools: TOOL_DEFINITIONS } : {}),
						...(toolsEnabled && iteration === 0 && forcedTool
							? { tool_choice: { type: "function", function: { name: forcedTool } } }
							: toolsEnabled
								? { tool_choice: "auto" }
								: {}),
					},
					{ signal: controller.signal },
				);

				for await (const chunk of stream) {
					const delta = chunk.choices[0]?.delta;
					if (!delta) continue;

					const deltaRecord = delta as Record<string, unknown>;
					const reasoningContent = (deltaRecord.reasoning ?? deltaRecord.reasoning_content) as string | undefined;
					const content = delta.content;

					if (reasoningContent) accumulated.thinking += reasoningContent;
					if (content) accumulated.content += content;
					toolAcc.add(delta.tool_calls as never);

					if (reasoningContent || content) {
						if (!isStreaming) {
							setIsStreaming(true);
							setIsLoading(false);
						}
						setToolStatus(null);
						updateMessage(chatId, assistantMessage.id, accumulated.content, accumulated.thinking);
					}
				}

				if (!toolAcc.hasCalls()) break;

				setIsStreaming(false);
				setIsLoading(true);

				const calls = toolAcc.finalize();
				requestMessages.push({
					role: "assistant",
					content: accumulated.content || null,
					tool_calls: calls.map((c) => ({
						id: c.id,
						type: "function",
						function: { name: c.name, arguments: JSON.stringify(c.arguments) },
					})),
				});

				if (forcedTool && iteration === 0 && !calls.some((c) => c.name === forcedTool)) {
					toast.warning("The model didn't run the requested tool.");
				}

				for (const call of calls) {
					setToolStatus(TOOL_LABELS[call.name] ?? "Working…");
					const opts = {
						connectedApiUrl: env.LTAI_CONNECTED_API_URL,
						chatApiKey: chatApiKey ?? "",
						signal: controller.signal,
					};

					if (call.name === "web_search") {
						const query = String(call.arguments.query ?? "");
						const { sources, toolText } = await executeWebSearch(query, opts);
						collectedSources.push(...sources);
						updateMessageArtifacts(chatId, assistantMessage.id, { sources: collectedSources });
						requestMessages.push({ role: "tool", tool_call_id: call.id, content: toolText });
					} else if (call.name === "generate_image") {
						const { image, toolText } = await executeGenerateImage(
							call.arguments as unknown as GenerateImageArgs,
							opts,
						);
						if (image) {
							collectedImages.push(image);
							updateMessageArtifacts(chatId, assistantMessage.id, { images: collectedImages });
						}
						requestMessages.push({ role: "tool", tool_call_id: call.id, content: toolText });
					} else {
						requestMessages.push({ role: "tool", tool_call_id: call.id, content: "Unknown tool." });
					}
				}
				setToolStatus(null);

				// An explicit "Create image" request is satisfied by the image alone — don't loop back for
				// a trailing text answer the user didn't ask for. (Only when it actually produced an image;
				// on failure we keep looping so the model can explain what went wrong.)
				if (forcedTool === "generate_image" && iteration === 0 && collectedImages.length > 0) {
					break;
				}
			}

			if (!accumulated.content && !accumulated.thinking && collectedImages.length === 0) {
				updateMessage(chatId, assistantMessage.id, "Sorry, I could not process your request.");
			}
		} catch (error) {
			if (controller.signal.aborted) {
				// Keep whatever streamed before the stop (content/thinking already persisted, images kept
				// via updateMessageArtifacts). Only leave a marker when the turn produced nothing at all.
				if (!accumulated.content && !accumulated.thinking && collectedImages.length === 0) {
					updateMessage(chatId, assistantMessage.id, "_(stopped)_");
				}
			} else {
				console.error("Error sending message:", error);
				updateMessage(
					chatId,
					assistantMessage.id,
					"Sorry, there was an error processing your request. Please try again.",
				);
			}
		} finally {
			setIsLoading(false);
			setIsStreaming(false);
			setToolStatus(null);
			abortRef.current = null;
		}
	};

	const handleSendMessage = async (
		value: string,
		images?: ImageData[],
		forcedTool?: "web_search" | "generate_image",
	) => {
		if (!value.trim() || isLoading) return;
		pendingForcedToolRef.current = forcedTool;
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
							toolStatus={index === messages.length - 1 ? toolStatus : null}
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
							model={chat?.model}
							onModelSelect={(m) => setChatModel(chatId, m)}
							autoFocus
							isConnected={useConnected}
							isGenerating={isLoading || isStreaming}
							onStop={() => abortRef.current?.abort()}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
