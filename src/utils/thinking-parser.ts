/**
 * Parses streaming content to extract thinking blocks and message content
 * Supports models that send reasoning_content as a separate field in the API delta
 */

export interface ParsedMessage {
	thinking: string;
	content: string;
}
