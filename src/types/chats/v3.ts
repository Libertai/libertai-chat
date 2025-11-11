import { z } from "zod";

export const ImageDataV3Schema = z.object({
	data: z.string(), // base64 encoded image data
	mimeType: z.string(), // e.g., "image/png", "image/jpeg"
	filename: z.string(), // original filename
});

export const MessageV3Schema = z.object({
	id: z.uuid(),
	role: z.enum(["user", "assistant"]),
	content: z.string(),
	thinking: z.string().optional(),
	images: z.array(ImageDataV3Schema).optional(), // NEW in v3
	timestamp: z.date(),
});

export const ChatV3Schema = z.object({
	id: z.uuid(),
	messages: z.array(MessageV3Schema),
	assistantId: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
	title: z.string().optional(),
});

export type ImageDataV3 = z.infer<typeof ImageDataV3Schema>;
export type MessageV3 = z.infer<typeof MessageV3Schema>;
export type ChatV3 = z.infer<typeof ChatV3Schema>;
export type ChatsV3 = Record<string, ChatV3>;
