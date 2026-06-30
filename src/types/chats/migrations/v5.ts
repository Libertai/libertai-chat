import { z } from "zod";
import { ChatV4Schema } from "../v4";
import { ChatV5Schema } from "../v5";
import type { Migration } from "./index";

const V4StoreSchema = z.object({
	chats: z.record(z.string(), ChatV4Schema),
	legacyMigrated: z.boolean().optional(),
});

const V5StoreSchema = z.object({
	chats: z.record(z.string(), ChatV5Schema),
	legacyMigrated: z.boolean().optional(),
});

type V4Store = z.infer<typeof V4StoreSchema>;
type V5Store = z.infer<typeof V5StoreSchema>;

export const v4ToV5Migration: Migration<V4Store, V5Store> = {
	fromVersion: 4,
	toVersion: 5,
	inputSchema: V4StoreSchema,
	outputSchema: V5StoreSchema,
	// Add an `model` field (defaults to undefined) to every chat. Existing chats keep using their
	// persona's pinned model until the user explicitly picks one.
	migrate: (state: V4Store): V5Store => {
		const migratedChats = Object.entries(state.chats).reduce(
			(acc, [chatId, chat]) => {
				acc[chatId] = { ...chat, model: undefined };
				return acc;
			},
			{} as Record<string, V5Store["chats"][string]>,
		);
		return { ...state, chats: migratedChats };
	},
};
