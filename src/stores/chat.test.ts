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

describe("setChatModel", () => {
	beforeEach(() => {
		useChatStore.setState({ chats: {}, legacyMigrated: true });
	});

	it("persists an explicit per-chat model override", () => {
		const store = useChatStore.getState();
		store.createChat("c1", "hello", "asst-1");
		expect(useChatStore.getState().getChat("c1")!.model).toBeUndefined();

		store.setChatModel("c1", "hermes-3-8b-tee");

		expect(useChatStore.getState().getChat("c1")!.model).toBe("hermes-3-8b-tee");
	});

	it("can be changed again and keeps the assistant pin intact", () => {
		const store = useChatStore.getState();
		store.createChat("c1", "hello", "asst-1");
		store.setChatModel("c1", "hermes-3-8b-tee");
		store.setChatModel("c1", "qwen3.6-35b-a3b");

		const chat = useChatStore.getState().getChat("c1")!;
		expect(chat.model).toBe("qwen3.6-35b-a3b");
		expect(chat.assistantId).toBe("asst-1");
	});

	it("is a no-op for an unknown chat id", () => {
		useChatStore.getState().setChatModel("missing", "hermes-3-8b-tee");
		expect(useChatStore.getState().getChat("missing")).toBeUndefined();
	});
});
