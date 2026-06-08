import type OpenAI from "openai";
import type { Message, ImageData } from "@/types/chats";
import type { Model } from "@/hooks/data/use-models";
import { supportsImages } from "@/config/model-capabilities";

type Param = OpenAI.Chat.Completions.ChatCompletionMessageParam;

function imageBlock(image: ImageData): OpenAI.Chat.Completions.ChatCompletionContentPartImage {
	return { type: "image_url", image_url: { url: image.data } };
}

/**
 * Map persisted chat history into OpenAI request messages (caller prepends the system message).
 * Keeps only the 4 most recent images across the whole history; user images attach inline,
 * assistant-generated images are re-emitted as a synthetic user message (the API rejects
 * image_url on assistant turns). Non-vision models receive no images.
 */
export function buildRequestMessages(history: Message[], model: string, models: Model[]): Param[] {
	const vision = supportsImages(model, models);

	// Determine which images survive the 4-most-recent cap (by identity).
	const keep = new Set<ImageData>();
	if (vision) {
		const all: ImageData[] = [];
		for (const m of history) for (const im of m.images ?? []) all.push(im);
		for (const im of all.slice(-4)) keep.add(im);
	}

	const out: Param[] = [];
	for (const m of history) {
		const keptImages = (m.images ?? []).filter((im) => keep.has(im));

		if (m.role === "user") {
			if (keptImages.length > 0) {
				out.push({
					role: "user",
					content: [{ type: "text", text: m.content }, ...keptImages.map(imageBlock)],
				});
			} else {
				out.push({ role: "user", content: m.content });
			}
		} else {
			// assistant: text only (image_url not allowed on assistant role)
			out.push({ role: "assistant", content: m.content });
			if (keptImages.length > 0) {
				out.push({
					role: "user",
					content: [
						{ type: "text", text: "(image generated above, shown for reference)" },
						...keptImages.map(imageBlock),
					],
				});
			}
		}
	}
	return out;
}
