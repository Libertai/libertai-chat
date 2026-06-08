import { describe, expect, it, beforeEach } from "vitest";
import { useChatStore } from "@/stores/chat";

describe("updateMessageArtifacts", () => {
	beforeEach(() => {
		useChatStore.setState({ chats: {}, legacyMigrated: true });
	});

	it("patches sources and images without clobbering content/thinking", () => {
		const store = useChatStore.getState();
		store.addMessage("c1", "user", "hello");
		const assistant = store.addMessage("c1", "assistant", "answer", "reasoning");

		store.updateMessageArtifacts("c1", assistant.id, {
			sources: [{ title: "T", url: "https://x", snippet: "s" }],
			images: [{ data: "data:image/png;base64,AAA", mimeType: "image/png", filename: "gen.png" }],
		});

		const msg = useChatStore.getState().getChat("c1")!.messages.find((m) => m.id === assistant.id)!;
		expect(msg.content).toBe("answer");
		expect(msg.thinking).toBe("reasoning");
		expect(msg.sources).toHaveLength(1);
		expect(msg.images).toHaveLength(1);
	});
});
