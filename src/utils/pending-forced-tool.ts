import type { ToolName } from "@/utils/chat-tools";

/**
 * Transient hand-off for a forced tool selected on the home input before a new chat exists.
 *
 * The home route creates the chat + first message then client-side-navigates to the chat route,
 * which generates the first response from its own (empty) state — so a `forcedTool` picked on the
 * home input would otherwise be lost. We stash it here keyed by the new chat id and the chat route
 * consumes it exactly once. Module-level state survives client-side navigation (no full reload) and
 * is intentionally NOT persisted — it only bridges that single navigation.
 */
const pending = new Map<string, ToolName>();

export function setPendingForcedTool(chatId: string, tool: ToolName): void {
	pending.set(chatId, tool);
}

export function consumePendingForcedTool(chatId: string): ToolName | undefined {
	const tool = pending.get(chatId);
	if (tool !== undefined) pending.delete(chatId);
	return tool;
}
