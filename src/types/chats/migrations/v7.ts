import { z } from "zod";
import { ChatV6Schema } from "../v6";
import { ChatV7Schema } from "../v7";
import type { Migration } from "./index";

const V6StoreSchema = z.object({
	chats: z.record(z.string(), ChatV6Schema),
	legacyMigrated: z.boolean().optional(),
});

const V7StoreSchema = z.object({
	chats: z.record(z.string(), ChatV7Schema),
	legacyMigrated: z.boolean().optional(),
});

type V6Store = z.infer<typeof V6StoreSchema>;
type V7Store = z.infer<typeof V7StoreSchema>;

export const v6ToV7Migration: Migration<V6Store, V7Store> = {
	fromVersion: 6,
	toVersion: 7,
	inputSchema: V6StoreSchema,
	outputSchema: V7StoreSchema,
	// Additive only: `artifacts` is an optional array on assistant messages. Existing messages keep
	// their shape (no artifacts) — V7 simply widens the message schema, so the data passes through.
	migrate: (state: V6Store): V7Store => state,
};
