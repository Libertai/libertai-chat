import { z } from "zod";
import { ChatV8Schema } from "../v8";
import { ChatV9Schema } from "../v9";
import type { Migration } from "./index";

const V8StoreSchema = z.object({
	chats: z.record(z.string(), ChatV8Schema),
	legacyMigrated: z.boolean().optional(),
});

const V9StoreSchema = z.object({
	chats: z.record(z.string(), ChatV9Schema),
	legacyMigrated: z.boolean().optional(),
});

type V8Store = z.infer<typeof V8StoreSchema>;
type V9Store = z.infer<typeof V9StoreSchema>;

export const v8ToV9Migration: Migration<V8Store, V9Store> = {
	fromVersion: 8,
	toVersion: 9,
	inputSchema: V8StoreSchema,
	outputSchema: V9StoreSchema,
	// Additive only: `projectId` is an optional foreign key on a chat. Existing chats keep their
	// shape (no projectId => ungrouped) — V9 simply widens the chat schema, so the data passes
	// through unchanged.
	migrate: (state: V8Store): V9Store => state,
};
