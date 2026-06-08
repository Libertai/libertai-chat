import { z } from "zod";
import { ChatV3Schema, MessageV3Schema } from "@/types/chats/v3.ts";

export const SearchSourceV4Schema = z.object({
	title: z.string(),
	url: z.string(),
	snippet: z.string(),
});

export const MessageV4Schema = MessageV3Schema.extend({
	sources: z.array(SearchSourceV4Schema).optional(),
});

export const ChatV4Schema = ChatV3Schema.omit({ messages: true }).extend({
	messages: z.array(MessageV4Schema),
});

export type SearchSourceV4 = z.infer<typeof SearchSourceV4Schema>;
export type MessageV4 = z.infer<typeof MessageV4Schema>;
export type ChatV4 = z.infer<typeof ChatV4Schema>;
export type ChatsV4 = Record<string, ChatV4>;
