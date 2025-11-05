/**
 * Parses streaming content to extract thinking blocks and message content
 * For models like glm-4.5-air that output reasoning in <think></think> tags
 */

export interface ParsedMessage {
	thinking: string;
	content: string;
}

/**
 * Extracts thinking and content based on model type and accumulated content
 * Handles incomplete streams (e.g., <think> without closing tag yet)
 */
export function parseStreamingContent(model: string, accumulatedContent: string): ParsedMessage {
	// Only parse thinking for models that support it
	const thinkingModels = ["glm-4.5-air"];

	if (!thinkingModels.includes(model)) {
		return {
			thinking: "",
			content: accumulatedContent,
		};
	}

	// Check for opening tag
	const openTagIndex = accumulatedContent.indexOf("<think>");

	if (openTagIndex === -1) {
		// No thinking tags, return all as content
		return {
			thinking: "",
			content: accumulatedContent,
		};
	}

	// Check for closing tag
	const closeTagIndex = accumulatedContent.indexOf("</think>");

	if (closeTagIndex === -1) {
		// Still streaming thinking (no closing tag yet)
		const thinkingContent = accumulatedContent.substring(openTagIndex + 7); // +7 for "<think>"
		return {
			thinking: thinkingContent.trim(),
			content: "",
		};
	}

	// Both tags present - extract thinking and content
	const thinkingContent = accumulatedContent.substring(openTagIndex + 7, closeTagIndex);
	const messageContent = accumulatedContent.substring(closeTagIndex + 8); // +8 for "</think>"

	return {
		thinking: thinkingContent.trim(),
		content: messageContent.trim(),
	};
}
