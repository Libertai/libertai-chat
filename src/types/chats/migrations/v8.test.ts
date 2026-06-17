import { describe, expect, it } from "vitest";
import { v7ToV8Migration } from "./v8";

const CHAT_ID = "11111111-1111-4111-a111-111111111111";
const MSG_ID = "22222222-2222-4222-a222-222222222222";

const v7State = {
	chats: {
		[CHAT_ID]: {
			id: CHAT_ID,
			assistantId: "asst",
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
			messages: [{ id: MSG_ID, role: "user", content: "hi", timestamp: new Date("2026-01-01") }],
		},
	},
	legacyMigrated: true,
};

describe("v7ToV8Migration", () => {
	it("passes existing chats through unchanged and validates on the v8 schema", () => {
		const out = v7ToV8Migration.migrate(v7State as never);
		expect(out.chats[CHAT_ID].messages).toHaveLength(1);
		expect(v7ToV8Migration.outputSchema.safeParse(out).success).toBe(true);
	});

	it("accepts file attachments on a v8 user message", () => {
		const withAttachment = {
			chats: {
				[CHAT_ID]: {
					...v7State.chats[CHAT_ID],
					messages: [
						{
							id: MSG_ID,
							role: "user",
							content: "summarize",
							timestamp: new Date("2026-01-01"),
							attachments: [
								{
									filename: "data.csv",
									kind: "csv",
									mimeType: "text/csv",
									content: "a\tb\n1\t2",
									truncated: false,
								},
							],
						},
					],
				},
			},
			legacyMigrated: true,
		};
		expect(v7ToV8Migration.outputSchema.safeParse(withAttachment).success).toBe(true);
	});

	it("rejects an attachment with an unknown kind", () => {
		const bad = {
			chats: {
				[CHAT_ID]: {
					...v7State.chats[CHAT_ID],
					messages: [
						{
							id: MSG_ID,
							role: "user",
							content: "x",
							timestamp: new Date("2026-01-01"),
							attachments: [
								{ filename: "a.docx", kind: "docx", mimeType: "x", content: "x", truncated: false },
							],
						},
					],
				},
			},
			legacyMigrated: true,
		};
		expect(v7ToV8Migration.outputSchema.safeParse(bad).success).toBe(false);
	});

	it("declares fromVersion 7 -> toVersion 8", () => {
		expect(v7ToV8Migration.fromVersion).toBe(7);
		expect(v7ToV8Migration.toVersion).toBe(8);
	});
});
