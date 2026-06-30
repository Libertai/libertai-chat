import { z } from "zod";
import { ChatV7Schema } from "../v7";
import { ChatV8Schema } from "../v8";
import type { Migration } from "./index";

const V7StoreSchema = z.object({
	chats: z.record(z.string(), ChatV7Schema),
	legacyMigrated: z.boolean().optional(),
});

const V8StoreSchema = z.object({
	chats: z.record(z.string(), ChatV8Schema),
	legacyMigrated: z.boolean().optional(),
});

type V7Store = z.infer<typeof V7StoreSchema>;
type V8Store = z.infer<typeof V8StoreSchema>;

export const v7ToV8Migration: Migration<V7Store, V8Store> = {
	fromVersion: 7,
	toVersion: 8,
	inputSchema: V7StoreSchema,
	outputSchema: V8StoreSchema,
	// Additive only: `attachments` is an optional array of extracted file-text blocks on user
	// messages. Existing messages keep their shape (no attachments) — V8 simply widens the message
	// schema, so the data passes through unchanged.
	migrate: (state: V7Store): V8Store => state,
};
