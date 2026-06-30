import { z } from "zod";
import {
	ChatV8Schema,
	MessageV8Schema,
	SearchSourceV8Schema,
	InterpreterRunV8Schema,
	CanvasArtifactV8Schema,
	ArtifactVersionV8Schema,
	ArtifactKindV8Schema,
	FileAttachmentV8Schema,
} from "@/types/chats/v8.ts";

// v9 adds an optional `projectId` to a chat. A chat can belong to a Project (folder); the project
// itself — its name and optional per-project instructions — lives in a separate Zustand persist
// store (`libertai-projects` / src/stores/project.ts), NOT in the chat record. We only persist the
// foreign key here so chats can be grouped in the sidebar and so a project's instructions can be
// prepended to the system prompt for every chat in that project. When the referenced project no
// longer exists (e.g. the user deleted it) the chat is treated as ungrouped. Persisted client-side
// only (localStorage), exactly like every other field in this store.

export const MessageV9Schema = MessageV8Schema;

export const ChatV9Schema = ChatV8Schema.omit({ messages: true }).extend({
	messages: z.array(MessageV9Schema),
	// Foreign key to a Project in the project store. Absent => ungrouped.
	projectId: z.string().optional(),
});

export const SearchSourceV9Schema = SearchSourceV8Schema;
export const InterpreterRunV9Schema = InterpreterRunV8Schema;
export const CanvasArtifactV9Schema = CanvasArtifactV8Schema;
export const ArtifactVersionV9Schema = ArtifactVersionV8Schema;
export const ArtifactKindV9Schema = ArtifactKindV8Schema;
export const FileAttachmentV9Schema = FileAttachmentV8Schema;

export type FileAttachmentV9 = z.infer<typeof FileAttachmentV9Schema>;
export type ArtifactKindV9 = z.infer<typeof ArtifactKindV9Schema>;
export type ArtifactVersionV9 = z.infer<typeof ArtifactVersionV9Schema>;
export type CanvasArtifactV9 = z.infer<typeof CanvasArtifactV9Schema>;
export type SearchSourceV9 = z.infer<typeof SearchSourceV9Schema>;
export type InterpreterRunV9 = z.infer<typeof InterpreterRunV9Schema>;
export type MessageV9 = z.infer<typeof MessageV9Schema>;
export type ChatV9 = z.infer<typeof ChatV9Schema>;
export type ChatsV9 = Record<string, ChatV9>;
