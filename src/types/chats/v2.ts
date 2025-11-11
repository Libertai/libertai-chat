import { z } from "zod";
import { ChatV1Schema, MessageV1Schema } from "@/types/chats/v1.ts";

export const MessageV2Schema = MessageV1Schema.extend({
	thinking: z.string().optional(),
});

export const ChatV2Schema = ChatV1Schema.omit({ messages: true }).extend({
	messages: z.array(MessageV2Schema),
});
