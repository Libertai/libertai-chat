import { Chat, Message } from "@/types/chats";

const LEGACY_STORAGE_KEY = "chats-store-pinia-key";

interface LegacyMessage {
	author: "user" | "ai";
	role: string;
	content: string;
	timestamp: string;
	attachments?: unknown[];
	searchResults?: unknown[];
	stopped?: boolean;
	error?: string | null;
	thought?: string;
	isLoading?: boolean;
}

interface LegacyPersona {
	id: string;
	name: string;
	role: string;
	description: string;
	avatar?: {
		item_hash?: string;
		ipfs_hash?: string;
	};
	allowEdit?: boolean;
	hidden?: boolean;
	knowledgeBases?: string[];
}

interface LegacyChat {
	id: string;
	title: string;
	username?: string;
	modelId: string;
	persona: LegacyPersona;
	messages: LegacyMessage[];
	createdAt: string;
	knowledgeBases?: string[];
}

interface LegacyChatsStore {
	version?: number;
	chats: LegacyChat[];
}

/**
 * Migrates legacy chats from the old Pinia store format to the new Zustand format
 * @param defaultAssistantId - The default assistant ID to use for migrated chats
 * @returns Record of migrated chats or null if no legacy chats found
 */
export function migrateLegacyChats(defaultAssistantId: string): Record<string, Chat> | null {
	try {
		const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
		if (!legacyData) {
			return null;
		}

		const parsed = JSON.parse(legacyData) as LegacyChatsStore;
		if (!parsed.chats || !Array.isArray(parsed.chats)) {
			return null;
		}

		const migratedChats: Record<string, Chat> = {};

		for (const legacyChat of parsed.chats) {
			try {
				// Convert legacy messages to new format
				const messages: Message[] = legacyChat.messages
					.filter((msg) => msg.content && msg.content.trim().length > 0)
					.map((msg) => ({
						id: crypto.randomUUID(),
						role: msg.author === "user" ? ("user" as const) : ("assistant" as const),
						content: msg.content,
						timestamp: new Date(msg.timestamp),
					}));

				// Skip chats with no valid messages
				if (messages.length === 0) {
					continue;
				}

				// Create the new chat object
				const newChat: Chat = {
					id: legacyChat.id,
					messages,
					assistantId: defaultAssistantId,
					createdAt: legacyChat.createdAt,
					updatedAt: legacyChat.createdAt,
				};

				console.log(`Migrated chat ${legacyChat.id} with ${messages.length} messages`);
				migratedChats[legacyChat.id] = newChat;
			} catch (error) {
				console.warn(`Failed to migrate chat ${legacyChat.id}:`, error);
				// Continue with other chats
			}
		}

		console.log(`Successfully migrated ${Object.keys(migratedChats).length} legacy chats`);
		return migratedChats;
	} catch (error) {
		console.error("Failed to migrate legacy chats:", error);
		return null;
	}
}
