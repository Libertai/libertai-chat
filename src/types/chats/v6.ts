import { z } from "zod";
import { ChatV5Schema, MessageV5Schema, SearchSourceV5Schema } from "@/types/chats/v5.ts";

// v6 adds an optional `interpreter` artifact array to assistant messages: the results of
// client-side code-interpreter runs (run_python / run_javascript). Each entry holds the executed
// source plus captured stdout/stderr, the last expression / return value, an optional matplotlib
// PNG, and error/timeout flags. Persisted client-side only (localStorage), like every other
// artifact in this store.
export const InterpreterRunV6Schema = z.object({
	language: z.enum(["python", "javascript"]),
	code: z.string(),
	stdout: z.string(),
	stderr: z.string(),
	result: z.string().nullable(),
	imagePng: z.string().nullable(),
	error: z.string().nullable(),
	timedOut: z.boolean(),
	// Live-run state. Only set while a run is in flight (cold load / executing); absent on settled
	// runs, so older persisted chats deserialize fine.
	pending: z.boolean().optional(),
	phase: z.enum(["preparing", "running"]).optional(),
	// Files the code wrote to the sandbox filesystem, delivered to the user as downloads.
	// Optional so older persisted chats (pre-file-delivery) deserialize cleanly.
	files: z
		.array(
			z.object({
				name: z.string(),
				mime: z.string(),
				base64: z.string(),
				size: z.number(),
			}),
		)
		.optional(),
});

export const MessageV6Schema = MessageV5Schema.extend({
	interpreter: z.array(InterpreterRunV6Schema).optional(),
});

export const ChatV6Schema = ChatV5Schema.omit({ messages: true }).extend({
	messages: z.array(MessageV6Schema),
});

export const SearchSourceV6Schema = SearchSourceV5Schema;

export type InterpreterRunV6 = z.infer<typeof InterpreterRunV6Schema>;
export type SearchSourceV6 = z.infer<typeof SearchSourceV6Schema>;
export type MessageV6 = z.infer<typeof MessageV6Schema>;
export type ChatV6 = z.infer<typeof ChatV6Schema>;
export type ChatsV6 = Record<string, ChatV6>;
