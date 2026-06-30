import { describe, expect, it } from "vitest";
import { v5ToV6Migration } from "./v6";

const CHAT_ID = "11111111-1111-4111-a111-111111111111";
const MSG_ID = "22222222-2222-4222-a222-222222222222";

const v5State = {
	chats: {
		[CHAT_ID]: {
			id: CHAT_ID,
			assistantId: "asst",
			model: undefined,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
			messages: [{ id: MSG_ID, role: "user", content: "hi", timestamp: new Date("2026-01-01") }],
		},
	},
	legacyMigrated: true,
};

describe("v5ToV6Migration", () => {
	it("passes existing chats through unchanged and validates on the v6 schema", () => {
		const out = v5ToV6Migration.migrate(v5State as never);
		expect(out.chats[CHAT_ID].messages).toHaveLength(1);
		expect(v5ToV6Migration.outputSchema.safeParse(out).success).toBe(true);
	});

	it("accepts an interpreter artifact array on a v6 assistant message", () => {
		const withInterpreter = {
			chats: {
				[CHAT_ID]: {
					...v5State.chats[CHAT_ID],
					messages: [
						{
							id: "33333333-3333-4333-a333-333333333333",
							role: "assistant",
							content: "done",
							timestamp: new Date("2026-01-01"),
							interpreter: [
								{
									language: "python",
									code: "print(1+1)",
									stdout: "2\n",
									stderr: "",
									result: null,
									imagePng: null,
									error: null,
									timedOut: false,
								},
							],
						},
					],
				},
			},
			legacyMigrated: true,
		};
		expect(v5ToV6Migration.outputSchema.safeParse(withInterpreter).success).toBe(true);
	});

	it("rejects an interpreter run with an unknown language", () => {
		const bad = {
			chats: {
				[CHAT_ID]: {
					...v5State.chats[CHAT_ID],
					messages: [
						{
							id: "44444444-4444-4444-a444-444444444444",
							role: "assistant",
							content: "x",
							timestamp: new Date("2026-01-01"),
							interpreter: [
								{
									language: "ruby",
									code: "puts 1",
									stdout: "",
									stderr: "",
									result: null,
									imagePng: null,
									error: null,
									timedOut: false,
								},
							],
						},
					],
				},
			},
			legacyMigrated: true,
		};
		expect(v5ToV6Migration.outputSchema.safeParse(bad).success).toBe(false);
	});

	it("declares fromVersion 5 -> toVersion 6", () => {
		expect(v5ToV6Migration.fromVersion).toBe(5);
		expect(v5ToV6Migration.toVersion).toBe(6);
	});
});
