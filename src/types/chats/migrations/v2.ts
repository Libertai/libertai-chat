import { z } from "zod";
import { ChatV1Schema } from "../v1";
import { ChatV2Schema } from "../v2";
import type { Migration } from "./index";

const V1StoreSchema = z.object({
	chats: z.record(z.string(), ChatV1Schema),
	legacyMigrated: z.boolean().optional(),
});

const V2StoreSchema = z.object({
	chats: z.record(z.string(), ChatV2Schema),
	legacyMigrated: z.boolean().optional(),
});

type V1Store = z.infer<typeof V1StoreSchema>;
type V2Store = z.infer<typeof V2StoreSchema>;

export const v1ToV2Migration: Migration<V1Store, V2Store> = {
	fromVersion: 1,
	toVersion: 2,
	inputSchema: V1StoreSchema,
	outputSchema: V2StoreSchema,
	migrate: (state: V1Store): V2Store => {
		// Add thinking field to all messages (defaults to undefined)
		const migratedChats = Object.entries(state.chats).reduce(
			(acc, [chatId, chat]) => {
				acc[chatId] = {
					...chat,
					messages: chat.messages.map((msg) => ({
						...msg,
						thinking: undefined,
					})),
				};
				return acc;
			},
			{} as Record<string, V2Store["chats"][string]>,
		);

		return {
			...state,
			chats: migratedChats,
		};
	},
};
