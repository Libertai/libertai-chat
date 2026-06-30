import { useChatStore } from "@/stores/chat";
import { useProjectStore } from "@/stores/project";

/** Attach a freshly created chat to a project, ignoring empty/unknown project ids. */
export function attachChatToProject(chatId: string, projectId: string | undefined): void {
	if (!projectId) return;
	if (!useProjectStore.getState().getProject(projectId)) return;
	useChatStore.getState().setChatProject(chatId, projectId);
}
