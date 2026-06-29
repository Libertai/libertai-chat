import { create } from "zustand";
import { persist } from "zustand/middleware";
import { runMigrations } from "@/types/chats/migrations";
import { Chat, Message, ImageData, CanvasArtifact, FileAttachment } from "@/types/chats";
import { useAssistantStore } from "./assistant";
import { migrateLegacyChats } from "@/utils/legacy-chat-migration";
import { detectArtifacts, artifactSlotKey, type DetectedArtifact } from "@/utils/artifacts";

interface ChatStore {
	chats: Record<string, Chat>;
	legacyMigrated: boolean;

	getChat: (chatId: string) => Chat | undefined;
	getAllChats: () => Chat[];
	createChat: (
		chatId: string,
		firstMessage: string,
		assistantId: string,
		images?: ImageData[],
		attachments?: FileAttachment[],
	) => void;
	addMessage: (
		chatId: string,
		role: "user" | "assistant",
		content: string,
		thinking?: string,
		images?: ImageData[],
		attachments?: FileAttachment[],
	) => Message;
	updateMessage: (chatId: string, messageId: string, content: string, thinking?: string) => void;
	// Attaches tool-call metadata (web_search sources / generated images / interpreter runs) onto a
	// message without touching its content/thinking. This is the artifact-METADATA patch; the real
	// canvas artifact model lives in `syncMessageArtifacts` below.
	attachMessageMeta: (
		chatId: string,
		messageId: string,
		meta: { sources?: Message["sources"]; images?: ImageData[]; interpreter?: Message["interpreter"] },
	) => void;
	// Detects self-contained canvas artifacts (html / react / svg / mermaid / markdown) in an
	// assistant message's content and reconciles them onto the message's `artifacts`, preserving a
	// version history per artifact slot across regenerations. Returns the reconciled artifacts.
	syncMessageArtifacts: (chatId: string, messageId: string, content: string) => CanvasArtifact[];
	deleteMessage: (chatId: string, messageId: string) => void;
	deleteChat: (chatId: string) => void;
	renameChat: (chatId: string, title: string) => void;
	setChatModel: (chatId: string, model: string) => void;
	// Move a chat into a project (folder), or back to the ungrouped section (projectId undefined).
	setChatProject: (chatId: string, projectId: string | undefined) => void;
	// Detach every chat from a project so deleting that project leaves its chats ungrouped (we never
	// cascade-delete conversations). Called by the project store when a project is removed.
	clearProjectFromChats: (projectId: string) => void;
	truncateMessagesAfter: (chatId: string, messageId: string) => void;
	migrateLegacyChatsIfNeeded: () => void;
}

const CHAT_VERSION = 9;

// Reconcile freshly detected artifacts against any already persisted on the message. Same slot
// (kind + position) => append a new VERSION only when the source actually changed, so streaming
// updates don't spam the history. New slot => a new artifact. Slots no longer present are dropped.
function reconcileArtifacts(existing: CanvasArtifact[] | undefined, detected: DetectedArtifact[]): CanvasArtifact[] {
	const now = new Date().toISOString();
	const prevBySlot = new Map<string, CanvasArtifact>();
	for (const a of existing ?? []) prevBySlot.set(a.slot, a);

	return detected.map((d) => {
		const slot = artifactSlotKey(d.kind, d.index);
		const prev = prevBySlot.get(slot);
		if (prev && prev.kind === d.kind) {
			const last = prev.versions[prev.versions.length - 1];
			if (last.code === d.code && last.language === d.language) {
				// Unchanged: keep the existing artifact (and its full history) as-is.
				return { ...prev, title: d.title };
			}
			// Changed: append a new version, keeping prior versions for the history switcher.
			return {
				...prev,
				title: d.title,
				versions: [
					...prev.versions,
					{ version: prev.versions.length + 1, code: d.code, language: d.language, createdAt: now },
				],
			};
		}
		// Brand-new artifact slot.
		return {
			id: crypto.randomUUID(),
			kind: d.kind,
			title: d.title,
			slot,
			versions: [{ version: 1, code: d.code, language: d.language, createdAt: now }],
		};
	});
}

export const useChatStore = create<ChatStore>()(
	persist(
		(set, get) => ({
			chats: {},
			legacyMigrated: false,

			getChat: (chatId: string) => {
				return get().chats[chatId];
			},

			getAllChats: () => {
				const chats = Object.values(get().chats);
				return chats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
			},

			createChat: (
				chatId: string,
				firstMessage: string,
				assistantId: string,
				images?: ImageData[],
				attachments?: FileAttachment[],
			) => {
				const now = new Date().toISOString();
				const userMessage: Message = {
					id: crypto.randomUUID(),
					role: "user",
					content: firstMessage,
					images,
					attachments,
					timestamp: new Date(),
				};

				set((state) => ({
					chats: {
						...state.chats,
						[chatId]: {
							id: chatId,
							messages: [userMessage],
							assistantId,
							createdAt: now,
							updatedAt: now,
						},
					},
				}));
			},

			addMessage: (
				chatId: string,
				role: "user" | "assistant",
				content: string,
				thinking?: string,
				images?: ImageData[],
				attachments?: FileAttachment[],
			) => {
				const message: Message = {
					id: crypto.randomUUID(),
					role,
					content,
					thinking,
					images,
					attachments,
					timestamp: new Date(),
				};

				set((state) => {
					const chat = state.chats[chatId];
					if (!chat) {
						// Create chat if it doesn't exist
						const now = new Date().toISOString();
						const defaultAssistant = useAssistantStore.getState().getAssistantOrDefault();
						return {
							chats: {
								...state.chats,
								[chatId]: {
									id: chatId,
									messages: [message],
									assistantId: defaultAssistant.id,
									createdAt: now,
									updatedAt: now,
								},
							},
						};
					}

					return {
						chats: {
							...state.chats,
							[chatId]: {
								...chat,
								messages: [...chat.messages, message],
								updatedAt: new Date().toISOString(),
							},
						},
					};
				});

				return message;
			},

			updateMessage: (chatId: string, messageId: string, content: string, thinking?: string) => {
				set((state) => {
					const chat = state.chats[chatId];
					if (!chat) return state;

					return {
						chats: {
							...state.chats,
							[chatId]: {
								...chat,
								messages: chat.messages.map((msg) => (msg.id === messageId ? { ...msg, content, thinking } : msg)),
								updatedAt: new Date().toISOString(),
							},
						},
					};
				});
			},

			attachMessageMeta: (chatId, messageId, meta) => {
				set((state) => {
					const chat = state.chats[chatId];
					if (!chat) return state;

					return {
						chats: {
							...state.chats,
							[chatId]: {
								...chat,
								messages: chat.messages.map((msg) => (msg.id === messageId ? { ...msg, ...meta } : msg)),
								updatedAt: new Date().toISOString(),
							},
						},
					};
				});
			},

			syncMessageArtifacts: (chatId, messageId, content) => {
				const detected = detectArtifacts(content);
				let reconciled: CanvasArtifact[] = [];
				set((state) => {
					const chat = state.chats[chatId];
					if (!chat) return state;
					const target = chat.messages.find((m) => m.id === messageId);
					if (!target) return state;

					reconciled = reconcileArtifacts(target.artifacts, detected);
					// No artifacts now and none before: leave the message untouched (don't add an empty key).
					if (reconciled.length === 0 && (!target.artifacts || target.artifacts.length === 0)) {
						return state;
					}

					return {
						chats: {
							...state.chats,
							[chatId]: {
								...chat,
								messages: chat.messages.map((msg) =>
									msg.id === messageId ? { ...msg, artifacts: reconciled.length > 0 ? reconciled : undefined } : msg,
								),
								updatedAt: new Date().toISOString(),
							},
						},
					};
				});
				return reconciled;
			},

			deleteMessage: (chatId: string, messageId: string) => {
				set((state) => {
					const chat = state.chats[chatId];
					if (!chat) return state;

					return {
						chats: {
							...state.chats,
							[chatId]: {
								...chat,
								messages: chat.messages.filter((msg) => msg.id !== messageId),
								updatedAt: new Date().toISOString(),
							},
						},
					};
				});
			},

			deleteChat: (chatId: string) => {
				set((state) => {
					const { [chatId]: _deleted, ...remaining } = state.chats;
					return { chats: remaining };
				});
			},

			renameChat: (chatId: string, title: string) => {
				set((state) => {
					const chat = state.chats[chatId];
					if (!chat) return state;

					return {
						chats: {
							...state.chats,
							[chatId]: {
								...chat,
								title,
							},
						},
					};
				});
			},

			setChatModel: (chatId: string, model: string) => {
				set((state) => {
					const chat = state.chats[chatId];
					if (!chat) return state;

					return {
						chats: {
							...state.chats,
							[chatId]: {
								...chat,
								// Explicit per-chat model override; takes precedence over the persona's pinned model.
								model,
								updatedAt: new Date().toISOString(),
							},
						},
					};
				});
			},

			setChatProject: (chatId: string, projectId: string | undefined) => {
				set((state) => {
					const chat = state.chats[chatId];
					if (!chat) return state;

					return {
						chats: {
							...state.chats,
							[chatId]: {
								...chat,
								// Undefined removes the chat from any project (ungrouped section).
								projectId,
								updatedAt: new Date().toISOString(),
							},
						},
					};
				});
			},

			clearProjectFromChats: (projectId: string) => {
				set((state) => {
					let touched = false;
					const chats: Record<string, Chat> = {};
					for (const [id, chat] of Object.entries(state.chats)) {
						if (chat.projectId === projectId) {
							touched = true;
							const { projectId: _removed, ...rest } = chat;
							chats[id] = rest;
						} else {
							chats[id] = chat;
						}
					}
					if (!touched) return state;
					return { chats };
				});
			},

			truncateMessagesAfter: (chatId: string, messageId: string) => {
				set((state) => {
					const chat = state.chats[chatId];
					if (!chat) return state;

					const messageIndex = chat.messages.findIndex((msg) => msg.id === messageId);
					if (messageIndex === -1) return state;
					return {
						chats: {
							...state.chats,
							[chatId]: {
								...chat,
								messages: chat.messages.slice(0, messageIndex + 1),
								updatedAt: new Date().toISOString(),
							},
						},
					};
				});
			},

			migrateLegacyChatsIfNeeded: () => {
				const state = get();
				if (state.legacyMigrated) {
					return;
				}

				const defaultAssistant = useAssistantStore.getState().getAssistantOrDefault();
				const legacyChats = migrateLegacyChats(defaultAssistant.id);

				if (legacyChats) {
					set({
						chats: { ...legacyChats, ...state.chats },
						legacyMigrated: true,
					});
				} else {
					set({ legacyMigrated: true });
				}
			},
		}),
		{
			name: "libertai-chats",
			version: CHAT_VERSION,
			migrate: runMigrations,
		},
	),
);
