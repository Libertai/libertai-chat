import { create } from "zustand";
import { persist } from "zustand/middleware";
import { runMigrations } from "@/types/chats/migrations";
import { Chat, Message, ImageData } from "@/types/chats";
import { useAssistantStore } from "./assistant";
import { migrateLegacyChats } from "@/utils/legacy-chat-migration";

interface ChatStore {
	chats: Record<string, Chat>;
	legacyMigrated: boolean;

	getChat: (chatId: string) => Chat | undefined;
	getAllChats: () => Chat[];
	createChat: (chatId: string, firstMessage: string, assistantId: string, images?: ImageData[]) => void;
	addMessage: (chatId: string, role: "user" | "assistant", content: string, thinking?: string, images?: ImageData[]) => Message;
	updateMessage: (chatId: string, messageId: string, content: string, thinking?: string) => void;
	deleteMessage: (chatId: string, messageId: string) => void;
	deleteChat: (chatId: string) => void;
	renameChat: (chatId: string, title: string) => void;
	migrateLegacyChatsIfNeeded: () => void;
}

const CHAT_VERSION = 3;

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

			createChat: (chatId: string, firstMessage: string, assistantId: string, images?: ImageData[]) => {
				const now = new Date().toISOString();
				const userMessage: Message = {
					id: crypto.randomUUID(),
					role: "user",
					content: firstMessage,
					images,
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

			addMessage: (chatId: string, role: "user" | "assistant", content: string, thinking?: string, images?: ImageData[]) => {
				const message: Message = {
					id: crypto.randomUUID(),
					role,
					content,
					thinking,
					images,
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
