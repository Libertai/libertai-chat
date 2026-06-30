import { z } from "zod";
import { ChatV5Schema } from "../v5";
import { ChatV6Schema } from "../v6";
import type { Migration } from "./index";

const V5StoreSchema = z.object({
	chats: z.record(z.string(), ChatV5Schema),
	legacyMigrated: z.boolean().optional(),
});

const V6StoreSchema = z.object({
	chats: z.record(z.string(), ChatV6Schema),
	legacyMigrated: z.boolean().optional(),
});

type V5Store = z.infer<typeof V5StoreSchema>;
type V6Store = z.infer<typeof V6StoreSchema>;

export const v5ToV6Migration: Migration<V5Store, V6Store> = {
	fromVersion: 5,
	toVersion: 6,
	inputSchema: V5StoreSchema,
	outputSchema: V6StoreSchema,
	// Additive only: `interpreter` is an optional artifact array. Existing messages keep their
	// shape (no interpreter runs) — V6 simply widens the message schema, so the data passes through.
	migrate: (state: V5Store): V6Store => state,
};
