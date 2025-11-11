import { z } from "zod";

export const MessageV2Schema = z.object({
	id: z.uuid(),
	role: z.enum(["user", "assistant"]),
	content: z.string(),
	thinking: z.string().optional(),
	timestamp: z.date(),
});

export const ChatV2Schema = z.object({
	id: z.uuid(),
	messages: z.array(MessageV2Schema),
	assistantId: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
	title: z.string().optional(),
});

export type MessageV2 = z.infer<typeof MessageV2Schema>;
export type ChatV2 = z.infer<typeof ChatV2Schema>;
