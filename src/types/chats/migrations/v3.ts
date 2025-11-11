import { z } from "zod";
import { ChatV2Schema } from "../v2";
import { ChatV3Schema } from "../v3";
import type { Migration } from "./index";

const V2StoreSchema = z.object({
	chats: z.record(z.string(), ChatV2Schema),
	legacyMigrated: z.boolean().optional(),
});

const V3StoreSchema = z.object({
	chats: z.record(z.string(), ChatV3Schema),
	legacyMigrated: z.boolean().optional(),
});

type V2Store = z.infer<typeof V2StoreSchema>;
type V3Store = z.infer<typeof V3StoreSchema>;

export const v2ToV3Migration: Migration<V2Store, V3Store> = {
	fromVersion: 2,
	toVersion: 3,
	inputSchema: V2StoreSchema,
	outputSchema: V3StoreSchema,
	migrate: (state: V2Store): V3Store => {
		// Add images field to all messages (defaults to undefined)
		const migratedChats = Object.entries(state.chats).reduce((acc, [chatId, chat]) => {
			acc[chatId] = {
				...chat,
				messages: chat.messages.map((msg) => ({
					...msg,
					images: undefined,
				})),
			};
			return acc;
		}, {} as Record<string, V3Store["chats"][string]>);

		return {
			...state,
			chats: migratedChats,
		};
	},
};
