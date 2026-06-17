import { describe, expect, it } from "vitest";
import { v4ToV5Migration } from "./v5";

const CHAT_ID = "11111111-1111-4111-a111-111111111111";
const MSG_ID = "22222222-2222-4222-a222-222222222222";

const v4State = {
	chats: {
		[CHAT_ID]: {
			id: CHAT_ID,
			assistantId: "asst",
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
			messages: [{ id: MSG_ID, role: "user", content: "hi", timestamp: new Date("2026-01-01"), sources: undefined }],
		},
	},
	legacyMigrated: true,
};

describe("v4ToV5Migration", () => {
	it("adds an undefined model field to every chat and validates", () => {
		const out = v4ToV5Migration.migrate(v4State as never);
		expect(out.chats[CHAT_ID]).toHaveProperty("model", undefined);
		expect(v4ToV5Migration.outputSchema.safeParse(out).success).toBe(true);
	});

	it("preserves existing chat data (messages, assistantId)", () => {
		const out = v4ToV5Migration.migrate(v4State as never);
		expect(out.chats[CHAT_ID].assistantId).toBe("asst");
		expect(out.chats[CHAT_ID].messages).toHaveLength(1);
	});

	it("accepts an explicit model on the v5 output schema", () => {
		const withModel = {
			chats: {
				[CHAT_ID]: { ...v4State.chats[CHAT_ID], model: "hermes-3-8b-tee" },
			},
			legacyMigrated: true,
		};
		expect(v4ToV5Migration.outputSchema.safeParse(withModel).success).toBe(true);
	});

	it("declares fromVersion 4 -> toVersion 5", () => {
		expect(v4ToV5Migration.fromVersion).toBe(4);
		expect(v4ToV5Migration.toVersion).toBe(5);
	});
});
