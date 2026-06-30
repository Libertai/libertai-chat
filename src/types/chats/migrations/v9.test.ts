import { describe, expect, it } from "vitest";
import { v8ToV9Migration } from "./v9";

const CHAT_ID = "11111111-1111-4111-a111-111111111111";
const MSG_ID = "22222222-2222-4222-a222-222222222222";

const v8State = {
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

describe("v8ToV9Migration", () => {
	it("passes existing chats through unchanged and validates on the v9 schema", () => {
		const out = v8ToV9Migration.migrate(v8State as never);
		expect(out.chats[CHAT_ID].messages).toHaveLength(1);
		// Pre-existing chats are ungrouped (no projectId).
		expect(out.chats[CHAT_ID].projectId).toBeUndefined();
		expect(v8ToV9Migration.outputSchema.safeParse(out).success).toBe(true);
	});

	it("accepts a projectId on a v9 chat", () => {
		const withProject = {
			chats: {
				[CHAT_ID]: {
					...v8State.chats[CHAT_ID],
					projectId: "project-abc",
				},
			},
			legacyMigrated: true,
		};
		const parsed = v8ToV9Migration.outputSchema.safeParse(withProject);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.chats[CHAT_ID].projectId).toBe("project-abc");
		}
	});

	it("rejects a non-string projectId", () => {
		const bad = {
			chats: {
				[CHAT_ID]: {
					...v8State.chats[CHAT_ID],
					projectId: 42,
				},
			},
			legacyMigrated: true,
		};
		expect(v8ToV9Migration.outputSchema.safeParse(bad).success).toBe(false);
	});

	it("declares fromVersion 8 -> toVersion 9", () => {
		expect(v8ToV9Migration.fromVersion).toBe(8);
		expect(v8ToV9Migration.toVersion).toBe(9);
	});
});
