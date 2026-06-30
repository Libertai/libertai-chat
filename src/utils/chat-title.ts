import { type Chat, type Message } from "@/types/chats";

/** The display title for a chat: explicit title, else first user message, else "New chat". */
export function getChatTitle(chat: Chat): string {
	if (chat.title) {
		return chat.title;
	}
	const firstMessage = chat.messages.find((msg: Message) => msg.role === "user");
	return firstMessage?.content || "New chat";
}

/** Truncate to `maxLength` chars, trimming and appending an ellipsis when cut. */
export function truncateText(text: string, maxLength: number = 50): string {
	if (text.length <= maxLength) return text;
	return text.substring(0, maxLength).trim() + "...";
}
