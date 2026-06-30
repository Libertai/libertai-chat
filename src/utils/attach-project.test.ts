import { describe, expect, it, beforeEach } from "vitest";
import { attachChatToProject } from "@/utils/attach-project";
import { useChatStore } from "@/stores/chat";
import { useProjectStore } from "@/stores/project";

describe("attachChatToProject", () => {
	beforeEach(() => {
		useChatStore.setState({ chats: {} });
		useProjectStore.setState({ projects: {} });
	});

	it("sets the chat's projectId when the project exists", () => {
		const project = useProjectStore.getState().createProject({ name: "Travel" });
		useChatStore.getState().createChat("c1", "hi", "light");
		attachChatToProject("c1", project.id);
		expect(useChatStore.getState().chats["c1"].projectId).toBe(project.id);
	});

	it("is a no-op for an unknown or empty project id", () => {
		useChatStore.getState().createChat("c1", "hi", "light");
		attachChatToProject("c1", undefined);
		attachChatToProject("c1", "does-not-exist");
		expect(useChatStore.getState().chats["c1"].projectId).toBeUndefined();
	});
});
