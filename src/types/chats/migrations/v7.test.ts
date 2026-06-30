import { describe, expect, it } from "vitest";
import { v6ToV7Migration } from "./v7";

const CHAT_ID = "11111111-1111-4111-a111-111111111111";
const MSG_ID = "22222222-2222-4222-a222-222222222222";

const v6State = {
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

describe("v6ToV7Migration", () => {
	it("passes existing chats through unchanged and validates on the v7 schema", () => {
		const out = v6ToV7Migration.migrate(v6State as never);
		expect(out.chats[CHAT_ID].messages).toHaveLength(1);
		expect(v6ToV7Migration.outputSchema.safeParse(out).success).toBe(true);
	});

	it("accepts a canvas artifact (with version history) on a v7 assistant message", () => {
		const withArtifact = {
			chats: {
				[CHAT_ID]: {
					...v6State.chats[CHAT_ID],
					messages: [
						{
							id: "33333333-3333-4333-a333-333333333333",
							role: "assistant",
							content: "here:\n```html\n<div/>\n```",
							timestamp: new Date("2026-01-01"),
							artifacts: [
								{
									id: "art-1",
									kind: "html",
									title: "HTML document",
									slot: "html:0",
									versions: [
										{
											version: 1,
											code: "<div/>",
											language: "html",
											createdAt: "2026-01-01T00:00:00.000Z",
										},
									],
								},
							],
						},
					],
				},
			},
			legacyMigrated: true,
		};
		expect(v6ToV7Migration.outputSchema.safeParse(withArtifact).success).toBe(true);
	});

	it("rejects an artifact with an unknown kind", () => {
		const bad = {
			chats: {
				[CHAT_ID]: {
					...v6State.chats[CHAT_ID],
					messages: [
						{
							id: "44444444-4444-4444-a444-444444444444",
							role: "assistant",
							content: "x",
							timestamp: new Date("2026-01-01"),
							artifacts: [
								{
									id: "art-2",
									kind: "pdf",
									title: "bad",
									slot: "pdf:0",
									versions: [{ version: 1, code: "x", language: "pdf", createdAt: "2026-01-01T00:00:00.000Z" }],
								},
							],
						},
					],
				},
			},
			legacyMigrated: true,
		};
		expect(v6ToV7Migration.outputSchema.safeParse(bad).success).toBe(false);
	});

	it("rejects an artifact with an empty version history", () => {
		const bad = {
			chats: {
				[CHAT_ID]: {
					...v6State.chats[CHAT_ID],
					messages: [
						{
							id: "55555555-5555-4555-a555-555555555555",
							role: "assistant",
							content: "x",
							timestamp: new Date("2026-01-01"),
							artifacts: [{ id: "art-3", kind: "svg", title: "t", slot: "svg:0", versions: [] }],
						},
					],
				},
			},
			legacyMigrated: true,
		};
		expect(v6ToV7Migration.outputSchema.safeParse(bad).success).toBe(false);
	});

	it("declares fromVersion 6 -> toVersion 7", () => {
		expect(v6ToV7Migration.fromVersion).toBe(6);
		expect(v6ToV7Migration.toVersion).toBe(7);
	});
});
