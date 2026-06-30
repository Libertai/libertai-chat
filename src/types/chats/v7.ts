import { z } from "zod";
import { ChatV6Schema, MessageV6Schema, SearchSourceV6Schema, InterpreterRunV6Schema } from "@/types/chats/v6.ts";

// v7 adds the Canvas artifact model. An assistant message can carry one or more `artifacts`:
// self-contained, renderable documents detected in its output (html / react / svg / mermaid /
// markdown). Each artifact keeps a VERSION HISTORY — successive revisions of the same artifact slot
// in a conversation are appended as versions so the canvas can switch between them. Persisted
// client-side only (localStorage), exactly like sources / images / interpreter runs.

export const ArtifactKindV7Schema = z.enum(["html", "react", "svg", "mermaid", "markdown"]);

export const ArtifactVersionV7Schema = z.object({
	// Monotonic version number within the artifact (1-based).
	version: z.number(),
	// Raw artifact source (the inner text of the fenced block).
	code: z.string(),
	// Fence language token (e.g. "tsx", "html").
	language: z.string(),
	// ISO timestamp the version was captured.
	createdAt: z.string(),
});

export const CanvasArtifactV7Schema = z.object({
	id: z.string(),
	kind: ArtifactKindV7Schema,
	title: z.string(),
	// Stable slot key tying successive versions to "the same artifact" across regenerations.
	slot: z.string(),
	versions: z.array(ArtifactVersionV7Schema).min(1),
});

export const MessageV7Schema = MessageV6Schema.extend({
	artifacts: z.array(CanvasArtifactV7Schema).optional(),
});

export const ChatV7Schema = ChatV6Schema.omit({ messages: true }).extend({
	messages: z.array(MessageV7Schema),
});

export const SearchSourceV7Schema = SearchSourceV6Schema;
export const InterpreterRunV7Schema = InterpreterRunV6Schema;

export type ArtifactKindV7 = z.infer<typeof ArtifactKindV7Schema>;
export type ArtifactVersionV7 = z.infer<typeof ArtifactVersionV7Schema>;
export type CanvasArtifactV7 = z.infer<typeof CanvasArtifactV7Schema>;
export type SearchSourceV7 = z.infer<typeof SearchSourceV7Schema>;
export type InterpreterRunV7 = z.infer<typeof InterpreterRunV7Schema>;
export type MessageV7 = z.infer<typeof MessageV7Schema>;
export type ChatV7 = z.infer<typeof ChatV7Schema>;
export type ChatsV7 = Record<string, ChatV7>;
