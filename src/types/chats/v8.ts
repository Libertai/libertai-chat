import { z } from "zod";
import {
	ChatV7Schema,
	MessageV7Schema,
	SearchSourceV7Schema,
	InterpreterRunV7Schema,
	CanvasArtifactV7Schema,
	ArtifactVersionV7Schema,
	ArtifactKindV7Schema,
} from "@/types/chats/v7.ts";

// v8 adds non-image file attachments to user messages. Each attachment is a labelled text block
// extracted CLIENT-SIDE from a dropped/pasted/picked file (PDF via pdfjs-dist, CSV via papaparse,
// plain text / markdown read directly). We persist the filename, the file's mime type, and the
// extracted text (already truncated for very large files, with a marker noting the truncation).
// The raw file bytes are never persisted or uploaded — only the extracted text. Persisted
// client-side only (localStorage), exactly like images / sources / interpreter runs / artifacts.
export const FileAttachmentV8Schema = z.object({
	// Original filename (e.g. "report.pdf").
	filename: z.string(),
	// Detected file type used for labelling / icon selection.
	kind: z.enum(["pdf", "csv", "text"]),
	// Source mime type as reported by the browser (best effort; may be empty for some files).
	mimeType: z.string(),
	// Extracted plain text. Large files are truncated with a trailing note before this is stored.
	content: z.string(),
	// True when `content` was truncated from a larger original.
	truncated: z.boolean(),
});

export const MessageV8Schema = MessageV7Schema.extend({
	attachments: z.array(FileAttachmentV8Schema).optional(),
});

export const ChatV8Schema = ChatV7Schema.omit({ messages: true }).extend({
	messages: z.array(MessageV8Schema),
});

export const SearchSourceV8Schema = SearchSourceV7Schema;
export const InterpreterRunV8Schema = InterpreterRunV7Schema;
export const CanvasArtifactV8Schema = CanvasArtifactV7Schema;
export const ArtifactVersionV8Schema = ArtifactVersionV7Schema;
export const ArtifactKindV8Schema = ArtifactKindV7Schema;

export type FileAttachmentV8 = z.infer<typeof FileAttachmentV8Schema>;
export type ArtifactKindV8 = z.infer<typeof ArtifactKindV8Schema>;
export type ArtifactVersionV8 = z.infer<typeof ArtifactVersionV8Schema>;
export type CanvasArtifactV8 = z.infer<typeof CanvasArtifactV8Schema>;
export type SearchSourceV8 = z.infer<typeof SearchSourceV8Schema>;
export type InterpreterRunV8 = z.infer<typeof InterpreterRunV8Schema>;
export type MessageV8 = z.infer<typeof MessageV8Schema>;
export type ChatV8 = z.infer<typeof ChatV8Schema>;
export type ChatsV8 = Record<string, ChatV8>;
