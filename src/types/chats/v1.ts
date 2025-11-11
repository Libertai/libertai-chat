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
	title: z.string().optional(),
});
