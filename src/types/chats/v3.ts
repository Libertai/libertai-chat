import { z } from "zod";
import { ChatV2Schema, MessageV2Schema } from "@/types/chats/v2.ts";

export const ImageDataV3Schema = z.object({
	data: z.string(), // base64 encoded image data
	mimeType: z.string(), // e.g., "image/png", "image/jpeg"
	filename: z.string(), // original filename
});

export const MessageV3Schema = MessageV2Schema.extend({
	images: z.array(ImageDataV3Schema).optional(),
});

export const ChatV3Schema = ChatV2Schema.omit({ messages: true }).extend({
	messages: z.array(MessageV3Schema),
});

export type ImageDataV3 = z.infer<typeof ImageDataV3Schema>;
export type MessageV3 = z.infer<typeof MessageV3Schema>;
export type ChatV3 = z.infer<typeof ChatV3Schema>;
export type ChatsV3 = Record<string, ChatV3>;
