import { z } from "zod";
import { ChatV4Schema, MessageV4Schema, SearchSourceV4Schema } from "@/types/chats/v4.ts";

// v5 adds an optional explicit per-chat model override. When set (via the ModelPicker) it takes
// precedence over the persona's pinned model; when absent the persona model is used.
export const MessageV5Schema = MessageV4Schema;

export const ChatV5Schema = ChatV4Schema.extend({
	model: z.string().optional(),
});

export const SearchSourceV5Schema = SearchSourceV4Schema;

export type SearchSourceV5 = z.infer<typeof SearchSourceV5Schema>;
export type MessageV5 = z.infer<typeof MessageV5Schema>;
export type ChatV5 = z.infer<typeof ChatV5Schema>;
export type ChatsV5 = Record<string, ChatV5>;
