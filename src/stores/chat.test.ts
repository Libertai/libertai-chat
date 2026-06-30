import { describe, expect, it, beforeEach } from "vitest";
import { useChatStore } from "@/stores/chat";

describe("attachMessageMeta", () => {
	beforeEach(() => {
		useChatStore.setState({ chats: {}, legacyMigrated: true });
	});

	it("patches sources and images without clobbering content/thinking", () => {
		const store = useChatStore.getState();
		store.addMessage("c1", "user", "hello");
		const assistant = store.addMessage("c1", "assistant", "answer", "reasoning");

		store.attachMessageMeta("c1", assistant.id, {
			sources: [{ title: "T", url: "https://x", snippet: "s" }],
			images: [{ data: "data:image/png;base64,AAA", mimeType: "image/png", filename: "gen.png" }],
		});

		const msg = useChatStore
			.getState()
			.getChat("c1")!
			.messages.find((m) => m.id === assistant.id)!;
		expect(msg.content).toBe("answer");
		expect(msg.thinking).toBe("reasoning");
		expect(msg.sources).toHaveLength(1);
		expect(msg.images).toHaveLength(1);
	});
});

describe("syncMessageArtifacts", () => {
	beforeEach(() => {
		useChatStore.setState({ chats: {}, legacyMigrated: true });
	});

	const HTML = 'Here you go:\n\n```html\n<button id="b">Click</button>\n```\n';
	const HTML_V2 = 'Updated:\n\n```html\n<button id="b">Tap</button>\n```\n';

	it("detects an html artifact and stores a first version", () => {
		const store = useChatStore.getState();
		store.addMessage("c1", "user", "make a button");
		const assistant = store.addMessage("c1", "assistant", HTML);

		const reconciled = store.syncMessageArtifacts("c1", assistant.id, HTML);
		expect(reconciled).toHaveLength(1);
		expect(reconciled[0].kind).toBe("html");
		expect(reconciled[0].versions).toHaveLength(1);

		const msg = useChatStore
			.getState()
			.getChat("c1")!
			.messages.find((m) => m.id === assistant.id)!;
		expect(msg.artifacts).toHaveLength(1);
		expect(msg.artifacts![0].versions[0].code).toContain("Click");
	});

	it("appends a new version when the same slot's source changes", () => {
		const store = useChatStore.getState();
		store.addMessage("c1", "user", "make a button");
		const assistant = store.addMessage("c1", "assistant", HTML);

		store.syncMessageArtifacts("c1", assistant.id, HTML);
		const reconciled = store.syncMessageArtifacts("c1", assistant.id, HTML_V2);

		expect(reconciled).toHaveLength(1);
		expect(reconciled[0].versions).toHaveLength(2);
		expect(reconciled[0].versions[1].version).toBe(2);
		expect(reconciled[0].versions[1].code).toContain("Tap");
		// First version is preserved for the history switcher.
		expect(reconciled[0].versions[0].code).toContain("Click");
	});

	it("does not append a version when the source is unchanged", () => {
		const store = useChatStore.getState();
		store.addMessage("c1", "user", "make a button");
		const assistant = store.addMessage("c1", "assistant", HTML);

		store.syncMessageArtifacts("c1", assistant.id, HTML);
		const reconciled = store.syncMessageArtifacts("c1", assistant.id, HTML);
		expect(reconciled[0].versions).toHaveLength(1);
	});

	it("leaves a plain message with no artifacts untouched", () => {
		const store = useChatStore.getState();
		store.addMessage("c1", "user", "hi");
		const assistant = store.addMessage("c1", "assistant", "just text, no fenced blocks");

		const reconciled = store.syncMessageArtifacts("c1", assistant.id, "just text, no fenced blocks");
		expect(reconciled).toHaveLength(0);
		const msg = useChatStore
			.getState()
			.getChat("c1")!
			.messages.find((m) => m.id === assistant.id)!;
		expect(msg.artifacts).toBeUndefined();
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
