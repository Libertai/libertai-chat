import { z } from "zod";
import { ChatV3Schema } from "../v3";
import { ChatV4Schema } from "../v4";
import type { Migration } from "./index";

const V3StoreSchema = z.object({
	chats: z.record(z.string(), ChatV3Schema),
	legacyMigrated: z.boolean().optional(),
});

const V4StoreSchema = z.object({
	chats: z.record(z.string(), ChatV4Schema),
	legacyMigrated: z.boolean().optional(),
});

type V3Store = z.infer<typeof V3StoreSchema>;
type V4Store = z.infer<typeof V4StoreSchema>;

export const v3ToV4Migration: Migration<V3Store, V4Store> = {
	fromVersion: 3,
	toVersion: 4,
	inputSchema: V3StoreSchema,
	outputSchema: V4StoreSchema,
	// Add `sources` (defaults to undefined) to every message.
	migrate: (state: V3Store): V4Store => {
		const migratedChats = Object.entries(state.chats).reduce(
			(acc, [chatId, chat]) => {
				acc[chatId] = {
					...chat,
					messages: chat.messages.map((msg) => ({ ...msg, sources: undefined })),
				};
				return acc;
			},
			{} as Record<string, V4Store["chats"][string]>,
		);
		return { ...state, chats: migratedChats };
	},
};
