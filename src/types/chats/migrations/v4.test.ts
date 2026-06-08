import { describe, expect, it } from "vitest";
import { v3ToV4Migration } from "./v4";

const CHAT_ID = "11111111-1111-4111-a111-111111111111";
const MSG_ID = "22222222-2222-4222-a222-222222222222";

const v3State = {
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

describe("v3ToV4Migration", () => {
	it("adds an undefined sources field to every message and validates", () => {
		const out = v3ToV4Migration.migrate(v3State as never);
		expect(out.chats[CHAT_ID].messages[0]).toHaveProperty("sources", undefined);
		expect(v3ToV4Migration.outputSchema.safeParse(out).success).toBe(true);
	});

	it("declares fromVersion 3 -> toVersion 4", () => {
		expect(v3ToV4Migration.fromVersion).toBe(3);
		expect(v3ToV4Migration.toVersion).toBe(4);
	});
});
