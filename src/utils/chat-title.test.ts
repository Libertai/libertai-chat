import { describe, expect, it } from "vitest";
import { getChatTitle, truncateText } from "@/utils/chat-title";
import type { Chat } from "@/types/chats";

function chat(over: Partial<Chat> = {}): Chat {
	return {
		id: "c1",
		messages: [],
		assistantId: "light",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		...over,
	} as Chat;
}

describe("getChatTitle", () => {
	it("prefers an explicit title", () => {
		expect(getChatTitle(chat({ title: "My title" }))).toBe("My title");
	});

	it("falls back to the first user message", () => {
		expect(
			getChatTitle(
				chat({
					messages: [
						{ id: "m", role: "user", content: "Hello there", timestamp: new Date() } as Chat["messages"][number],
					],
				}),
			),
		).toBe("Hello there");
	});

	it("falls back to 'New chat' when empty", () => {
		expect(getChatTitle(chat())).toBe("New chat");
	});
});

describe("truncateText", () => {
	it("leaves short text intact", () => {
		expect(truncateText("short", 50)).toBe("short");
	});

	it("truncates and appends an ellipsis", () => {
		expect(truncateText("a".repeat(60), 50)).toBe("a".repeat(50) + "...");
	});
});
