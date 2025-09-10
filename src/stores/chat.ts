import { create } from "zustand";
import { persist } from "zustand/middleware";
import { runMigrations } from "@/types/chats/migrations";
import { Chat, Message } from "@/types/chats";
import { useAssistantStore } from "./assistant";

interface ChatStore {
	chats: Record<string, Chat>;

	getChat: (chatId: string) => Chat | undefined;
	getAllChats: () => Chat[];
	createChat: (chatId: string, firstMessage: string, assistantId: string) => void;
	addMessage: (chatId: string, role: "user" | "assistant", content: string) => Message;
	updateMessage: (chatId: string, messageId: string, content: string) => void;
	deleteChat: (chatId: string) => void;
}

const CHAT_VERSION = 1;

export const useChatStore = create<ChatStore>()(
	persist(
		(set, get) => ({
			chats: {},

			getChat: (chatId: string) => {
				return get().chats[chatId];
			},

			getAllChats: () => {
				const chats = Object.values(get().chats);
				return chats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
			},

			createChat: (chatId: string, firstMessage: string, assistantId: string) => {
				const now = new Date().toISOString();
				const userMessage: Message = {
					id: crypto.randomUUID(),
					role: "user",
					content: firstMessage,
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

			addMessage: (chatId: string, role: "user" | "assistant", content: string) => {
				const message: Message = {
					id: crypto.randomUUID(),
					role,
					content,
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

			updateMessage: (chatId: string, messageId: string, content: string) => {
				set((state) => {
					const chat = state.chats[chatId];
					if (!chat) return state;

					return {
						chats: {
							...state.chats,
							[chatId]: {
								...chat,
								messages: chat.messages.map((msg) => (msg.id === messageId ? { ...msg, content } : msg)),
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
		}),
		{
			name: "libertai-chats",
			version: CHAT_VERSION,
			migrate: runMigrations,
		},
	),
);
