import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Brain } from "lucide-react";
import { ChatInput } from "@/components/ChatInput";
import { ConversationNotFound } from "@/components/ConversationNotFound";
import { Message } from "@/components/Message";
import { Canvas } from "@/components/canvas/Canvas";
import { useCanvasStore } from "@/stores/canvas";
import { useChatStore } from "@/stores/chat";
import { useAssistantStore } from "@/stores/assistant";
import { useProjectStore } from "@/stores/project";
import { useMemoryStore } from "@/stores/memory";
import { buildSystemPrompt } from "@/utils/build-system-prompt";
import { injectMemories } from "@/utils/memory-injection";
import { useAccountStore, useSubscription } from "@libertai/auth";
import { isChatBlocked, isPaywallError, isAnonLimitError } from "@/utils/paywall";
import { ChatPaywall } from "@/components/ChatPaywall";
import { ChatUsageWarning } from "@/components/ChatUsageWarning";
import { AnonChatNotice } from "@/components/AnonChatNotice";
import { useChatApiKey } from "@/hooks/data/use-chat-api-key";
import { useAnonUsage } from "@/hooks/data/use-anon-usage";
import { resolveChatEndpoint } from "@/utils/chat-endpoint";
import { useModels } from "@/hooks/data/use-models";
import { supportsTools, resolveChatModel } from "@/config/model-capabilities";
import { buildRequestMessages } from "@/utils/build-request-messages";
import { ToolCallAccumulator } from "@/utils/tool-call-accumulator";
import { TOOL_DEFINITIONS, executeWebSearch, executeGenerateImage, executeRunCode } from "@/utils/chat-tools";
import type { GenerateImageArgs, SearchType, InterpreterArtifact } from "@/utils/chat-tools";
import { consumePendingForcedTool } from "@/utils/pending-forced-tool";
import env from "@/config/env";
import OpenAI from "openai";
import { toast } from "sonner";
import type { ParsedMessage } from "@/utils/thinking-parser";
import type { ImageData, FileAttachment } from "@/types/chats";

export const Route = createFileRoute("/chat/$chatId")({
	component: Chat,
});

function Chat() {
	const { chatId } = Route.useParams();
	const {
		getChat,
		addMessage,
		updateMessage,
		attachMessageMeta,
		syncMessageArtifacts,
		deleteMessage,
		truncateMessagesAfter,
		setChatModel,
	} = useChatStore();
	const { getAssistantOrDefault } = useAssistantStore();
	const getProject = useProjectStore((s) => s.getProject);
	// Subscribe to the memory store so the injected-context indicator re-renders when the user adds,
	// edits, toggles or deletes a memory while this chat is open. The actual injection at send-time
	// reads getEnabledMemories() so it always uses the freshest set.
	const memories = useMemoryStore((s) => s.memories);
	const enabledMemoryCount = useMemo(
		() => Object.values(memories).filter((m) => m.enabled).length,
		[memories],
	);
	const isCanvasOpen = useCanvasStore((s) => s.openChatId === chatId);
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	const { data: subscription, refetch: refetchSubscription } = useSubscription();
	// Blocked is derived solely from the live subscription's `allowed` flag — no optimistic local
	// flag (that flashed the wall + left a ghost message on a bare 401 for users who aren't blocked).
	const blocked = isAuthenticated && isChatBlocked(subscription);
	// Logged-out users get a per-IP free-message limit (enforced by the chat proxy).
	const { data: anonUsage, refetch: refetchAnonUsage } = useAnonUsage();
	const anonBlocked = !isAuthenticated && anonUsage?.allowed === false;
	const { chatApiKey, isLoading: isChatKeyLoading } = useChatApiKey();
	const { data: models } = useModels();
	const [isLoading, setIsLoading] = useState(false);
	const [isInitialized, setIsInitialized] = useState(false);
	const [isStreaming, setIsStreaming] = useState(false);
	const [toolSteps, setToolSteps] = useState<string[]>([]);
	const [toolStatus, setToolStatus] = useState<string | null>(null);
	const pendingForcedToolRef = useRef<"web_search" | "generate_image" | undefined>(undefined);
	const pendingSearchTypeRef = useRef<SearchType | undefined>(undefined);
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

	// Close the canvas when leaving this conversation so it doesn't bleed into another chat.
	useEffect(() => {
		return () => {
			if (useCanvasStore.getState().openChatId === chatId) {
				useCanvasStore.getState().close();
			}
		};
	}, [chatId]);

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
		// Don't auto-fire a doomed request when the subscription says the user is out of allowance.
		if (blocked || anonBlocked) return;
		if (messages.length > 0 && !isLoading && !isStreaming && isInitialized) {
			const lastMessage = messages[messages.length - 1];
			// Only generate response if last message is from user and there's no pending assistant message
			if (lastMessage.role === "user") {
				// In-conversation force lives on the refs; a force chosen on the home input before this
				// chat existed is handed off by chat id and consumed here for the first response.
				let forced = pendingForcedToolRef.current;
				let searchType = pendingSearchTypeRef.current;
				if (forced === undefined) {
					const handoff = consumePendingForcedTool(chatId);
					// Only web_search / generate_image are user-forceable from the input menu; the
					// interpreter tools are model-invoked, never force-handed-off, so narrow here.
					if (handoff?.tool === "web_search" || handoff?.tool === "generate_image") {
						forced = handoff.tool;
						searchType = handoff.searchType;
					}
				}
				pendingForcedToolRef.current = undefined;
				pendingSearchTypeRef.current = undefined;
				generateAIResponse(forced, searchType).then();
			}
		}
	}, [messages.length, isLoading, isStreaming, isInitialized, isAuthenticated, isChatKeyLoading, blocked, anonBlocked]); // eslint-disable-line react-hooks/exhaustive-deps

	const TOOL_LABELS: Record<string, string> = {
		web_search: "Searching the web…",
		generate_image: "Generating image…",
		run_python: "Running Python…",
		run_javascript: "Running JavaScript…",
	};

	const generateAIResponse = async (forcedTool?: "web_search" | "generate_image", searchType?: SearchType) => {
		// Single chokepoint for every generation path (auto-fire effect, regenerate, regenerate-from):
		// a blocked user must never reach the gateway, or they'd get a 401/402 and a ghost message.
		if (blocked || anonBlocked) return;
		if (isLoading || isStreaming) return;
		if (messages.length === 0) return;
		if (messages[messages.length - 1].role !== "user") return;

		setIsLoading(true);
		setIsStreaming(false);
		setToolStatus(null);
		setToolSteps([]);

		const controller = new AbortController();
		abortRef.current = controller;

		const assistant = getAssistantOrDefault(chat?.assistantId);
		const assistantMessage = addMessage(chatId, "assistant", "");

		const toolsEnabled = useConnected && modelSupportsTools;

		// Prepend the chat's project instructions (if any) to the persona prompt so a folder's
		// guidance frames every conversation inside it, then prepend the user's saved cross-conversation
		// memories ahead of everything so the model frames the whole chat with what it knows about the
		// user. Memories stay device-local until this request; we read them fresh at send-time.
		const project = getProject(chat?.projectId);
		const baseSystemPrompt = buildSystemPrompt(assistant.systemPrompt, project?.instructions);
		const systemPrompt = injectMemories(baseSystemPrompt, useMemoryStore.getState().getEnabledMemories());

		const requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...buildRequestMessages(messages, effectiveModel, models ?? []),
		];

		const accumulated: ParsedMessage = { thinking: "", content: "" };
		const collectedSources: { title: string; url: string; snippet: string }[] = [];
		const collectedImages: ImageData[] = [];
		const collectedInterpreter: InterpreterArtifact[] = [];

		// Coalesce streaming writes. The route subscribes to the whole chat store, so every
		// updateMessage re-renders it. Thinking models (e.g. Mega Mind) emit thousands of tiny
		// reasoning deltas that can arrive in a burst — writing per-delta floods React and trips its
		// max-update-depth guard (#185), which surfaced as a generic "error processing your request".
		// Flush at most once per frame and force a final flush per turn so nothing is dropped.
		const FLUSH_INTERVAL_MS = 50;
		let lastFlush = 0;
		const flushStreamedMessage = (force = false) => {
			const now = Date.now();
			if (!force && now - lastFlush < FLUSH_INTERVAL_MS) return;
			lastFlush = now;
			updateMessage(chatId, assistantMessage.id, accumulated.content, accumulated.thinking);
		};

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
						flushStreamedMessage();
					}
				}

				// Detect self-contained canvas artifacts (html / react / svg / mermaid / markdown) in the
				// settled content for this iteration and reconcile them onto the message (with version
				// history). Runs client-side from the message text — no model tool call required.
				if (accumulated.content) {
					syncMessageArtifacts(chatId, assistantMessage.id, accumulated.content);
				}
				// Force the trailing tokens since the last throttled flush to land before we either
				// break or reset `accumulated` for the next tool iteration.
				flushStreamedMessage(true);

				if (!toolAcc.hasCalls()) break;

				// Stay in the streaming (working) state across tool turns. Previously this dropped
				// isStreaming and raised isLoading, which flickered the whole chat between "streaming"
				// and "loading" on every tool transition and made multiple things look like they were
				// running at once. We're still actively generating — tool execution is part of the
				// same response from the user's view — so keep isStreaming true until the response
				// settles in `finally`. isLoading stays false (it only gates the pre-stream waiting
				// state); the streaming guard (isLoading || isStreaming) still blocks new messages.
				setIsStreaming(true);
				setIsLoading(false);

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
					// Promote the previous step to completed and start the new one as current, so the
					// progress log accumulates across the whole multi-turn response instead of flashing
					// and vanishing between tools. Only the friendly label is shown — never the tool
					// name, arguments, or results.
					setToolSteps((prev) => (toolStatus ? [...prev, toolStatus] : prev));
					setToolStatus(TOOL_LABELS[call.name] ?? "Working…");
					const opts = {
						connectedApiUrl: env.LTAI_CONNECTED_API_URL,
						chatApiKey: chatApiKey ?? "",
						searchType,
						signal: controller.signal,
					};

					if (call.name === "web_search") {
						const query = String(call.arguments.query ?? "");
						const { sources, toolText } = await executeWebSearch(query, opts);
						collectedSources.push(...sources);
						attachMessageMeta(chatId, assistantMessage.id, { sources: collectedSources });
						requestMessages.push({ role: "tool", tool_call_id: call.id, content: toolText });
					} else if (call.name === "generate_image") {
						const { image, toolText } = await executeGenerateImage(
							call.arguments as unknown as GenerateImageArgs,
							opts,
						);
						if (image) {
							collectedImages.push(image);
							attachMessageMeta(chatId, assistantMessage.id, { images: collectedImages });
						}
						requestMessages.push({ role: "tool", tool_call_id: call.id, content: toolText });
					} else if (call.name === "run_python" || call.name === "run_javascript") {
						const language = call.name === "run_python" ? "python" : "javascript";
						const code = String(call.arguments.code ?? "");

						// Insert a pending interpreter card immediately so the user sees the code that's
						// about to run instead of a bare silent spinner through the long Pyodide cold load.
						// The card fills in live as progress arrives; we swap in the final artifact on
						// completion.
						const pending: InterpreterArtifact = {
							language,
							code,
							stdout: "",
							stderr: "",
							result: null,
							imagePng: null,
							error: null,
							timedOut: false,
							pending: true,
							phase: "preparing",
						};
						collectedInterpreter.push(pending);
						attachMessageMeta(chatId, assistantMessage.id, { interpreter: [...collectedInterpreter] });

						// Throttle live updates for the same reason streaming text is throttled (#185):
						// Pyodide batches stdout in a burst and writing per-batch floods React. Always
						// attach a fresh array copy — reusing the same mutated `collectedInterpreter`
						// reference can let a downstream reference-equality check skip the re-render, so a
						// later run's pending card wouldn't paint until the next forced attach.
						let lastMetaFlush = 0;
						const flushMeta = (force = false) => {
							const now = Date.now();
							if (!force && now - lastMetaFlush < FLUSH_INTERVAL_MS) return;
							lastMetaFlush = now;
							attachMessageMeta(chatId, assistantMessage.id, { interpreter: [...collectedInterpreter] });
						};

						const { artifact, toolText } = await executeRunCode(language, code, {
							signal: controller.signal,
							onProgress: (p) => {
								pending.stdout = p.stdout;
								pending.stderr = p.stderr;
								pending.phase = p.phase;
								flushMeta();
							},
						});
						// Replace the pending placeholder with the settled artifact (carries result /
						// image / error / timedOut, and pending cleared so the card renders its final form).
						collectedInterpreter[collectedInterpreter.length - 1] = { ...artifact };
						attachMessageMeta(chatId, assistantMessage.id, { interpreter: [...collectedInterpreter] });
						requestMessages.push({ role: "tool", tool_call_id: call.id, content: toolText });
					} else {
						requestMessages.push({ role: "tool", tool_call_id: call.id, content: "Unknown tool." });
					}
				}
				// Promote the last running step to completed before the next streaming turn, so the
				// indicator never lingers as "in progress" while text streams.
				setToolSteps((prev) => (toolStatus ? [...prev, toolStatus] : prev));
				setToolStatus(null);

				// An explicit "Create image" request is satisfied by the image alone — don't loop back for
				// a trailing text answer the user didn't ask for. (Only when it actually produced an image;
				// on failure we keep looping so the model can explain what went wrong.)
				if (forcedTool === "generate_image" && iteration === 0 && collectedImages.length > 0) {
					break;
				}
			}

			if (
				!accumulated.content &&
				!accumulated.thinking &&
				collectedImages.length === 0 &&
				collectedInterpreter.length === 0
			) {
				updateMessage(chatId, assistantMessage.id, "Sorry, I could not process your request.");
			}
		} catch (error) {
			if (controller.signal.aborted) {
				// Keep whatever streamed before the stop (content/thinking already persisted, images kept
				// via attachMessageMeta). Only leave a marker when the turn produced nothing at all.
				if (
					!accumulated.content &&
					!accumulated.thinking &&
					collectedImages.length === 0 &&
					collectedInterpreter.length === 0
				) {
					updateMessage(chatId, assistantMessage.id, "_(stopped)_");
				}
			} else if (!isAuthenticated && isAnonLimitError(error)) {
				// Logged-out user hit the per-IP free limit (proxy 429). Refresh the meter so the
				// sign-in wall shows + the composer disables, and drop the empty turn (no ghost text).
				await refetchAnonUsage();
				deleteMessage(chatId, assistantMessage.id);
			} else if (isPaywallError(error)) {
				// A 401/402 only means "out of allowance" if the subscription confirms it. Bare 401s
				// also come from transient auth/whitelist issues — so re-fetch the subscription and
				// only wall the composer (via the derived `blocked`) when it reports allowed===false.
				const res = await refetchSubscription();
				if (isChatBlocked(res.data)) {
					// The ChatPaywall panel is the only signal — drop the empty turn (no ghost text).
					deleteMessage(chatId, assistantMessage.id);
				} else {
					updateMessage(
						chatId,
						assistantMessage.id,
						"Sorry, there was an error processing your request. Please try again.",
					);
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
			setToolSteps([]);
			abortRef.current = null;
		}
	};

	const handleSendMessage = async (
		value: string,
		images?: ImageData[],
		forcedTool?: "web_search" | "generate_image",
		searchType?: SearchType,
		attachments?: FileAttachment[],
	) => {
		if (blocked || anonBlocked) return;
		if (!value.trim() || isLoading) return;
		pendingForcedToolRef.current = forcedTool;
		pendingSearchTypeRef.current = searchType;
		addMessage(chatId, "user", value.trim(), undefined, images, attachments);
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
		<div className="h-full flex bg-background text-foreground animate-in slide-in-from-right-8 fade-in duration-500">
			{/* Chat column. Hidden on small screens when the canvas takes over the viewport. */}
			<div className={`h-full min-w-0 flex-1 flex-col ${isCanvasOpen ? "hidden md:flex" : "flex"}`}>
				{/* Messages area */}
				<div className="flex-1 overflow-y-auto p-4">
					<div className="max-w-4xl mx-auto space-y-8 md:space-y-11">
						{messages.map((message, index) => (
							<Message
								key={message.id}
								message={message}
								chatId={chatId}
								isLastMessage={index === messages.length - 1}
								isLoading={isLoading}
								isStreaming={isStreaming}
								toolStatus={index === messages.length - 1 ? toolStatus : null}
								toolSteps={index === messages.length - 1 ? toolSteps : []}
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
					{/* Transparency indicator: when the user has saved memories, show how many are folded
					    into this chat's system context. Doubles as the e2e hook proving injection. */}
					{enabledMemoryCount > 0 && (
						<div className="max-w-2xl mx-auto mb-2 flex justify-center">
							<span
								data-testid="memory-injected-indicator"
								data-memory-count={enabledMemoryCount}
								className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-tiny text-muted-foreground"
							>
								<Brain className="h-3 w-3" />
								{enabledMemoryCount} {enabledMemoryCount === 1 ? "memory" : "memories"} in context
							</span>
						</div>
					)}
					<div className="max-w-2xl mx-auto">
						{isAuthenticated ? blocked ? <ChatPaywall /> : <ChatUsageWarning /> : <AnonChatNotice />}
						<ChatInput
							onSubmit={handleSendMessage}
							placeholder="Continue private conversation..."
							disabled={isLoading || blocked || anonBlocked}
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

			{/* Right-hand Canvas side-panel (only the artifact opened from this chat). */}
			{isCanvasOpen && <Canvas />}
		</div>
	);
}
