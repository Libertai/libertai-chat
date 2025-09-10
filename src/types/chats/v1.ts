import { z } from "zod";

export const MessageV1Schema = z.object({
	id: z.uuid(),
	role: z.enum(["user", "assistant"]),
	content: z.string(),
	timestamp: z.date(),
});

export const ChatV1Schema = z.object({
	id: z.uuid(),
	messages: z.array(MessageV1Schema),
	assistantId: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const ChatStoreV1Schema = z.object({
	chats: z.record(z.string(), ChatV1Schema),
});

export type MessageV1 = z.infer<typeof MessageV1Schema>;
export type ChatV1 = z.infer<typeof ChatV1Schema>;
export type ChatStoreV1 = z.infer<typeof ChatStoreV1Schema>;
