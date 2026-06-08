import type OpenAI from "openai";
import type { ImageData, SearchSource } from "@/types/chats";

export type ToolName = "web_search" | "generate_image";

export interface ToolExecOptions {
	/** Connected API base WITHOUT trailing /v1, e.g. https://api.libertai.io */
	connectedApiUrl: string;
	chatApiKey: string;
	signal?: AbortSignal;
}

export const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
	{
		type: "function",
		function: {
			name: "web_search",
			description:
				"Search the public web for current information. Use when the user asks about recent events, facts you are unsure of, or anything that benefits from up-to-date sources.",
			parameters: {
				type: "object",
				properties: { query: { type: "string", description: "The search query." } },
				required: ["query"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "generate_image",
			description:
				"Generate an image from a text prompt. Use when the user asks to create, draw, or generate a picture.",
			parameters: {
				type: "object",
				properties: {
					prompt: { type: "string", description: "Detailed description of the image to generate." },
					width: { type: "number", description: "Optional width in pixels (default 1024)." },
					height: { type: "number", description: "Optional height in pixels (default 1024)." },
				},
				required: ["prompt"],
			},
		},
	},
];

interface RawSearchResult {
	title: string;
	url: string;
	snippet: string;
}

export function formatSearchResults(results: RawSearchResult[]): { sources: SearchSource[]; toolText: string } {
	if (results.length === 0) return { sources: [], toolText: "No results found." };

	const sources: SearchSource[] = results.map((r) => ({ title: r.title, url: r.url, snippet: r.snippet }));
	const toolText = sources.map((s, i) => `${i + 1}. ${s.title} — ${s.url}\n${s.snippet}`).join("\n\n");
	return { sources, toolText };
}

export async function executeWebSearch(
	query: string,
	opts: ToolExecOptions,
): Promise<{ sources: SearchSource[]; toolText: string }> {
	try {
		const response = await fetch(`${opts.connectedApiUrl}/search`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.chatApiKey}` },
			body: JSON.stringify({
				query,
				engines: ["google", "bing", "duckduckgo"],
				max_results: 5,
				search_type: "web",
			}),
			signal: opts.signal,
		});

		if (!response.ok) {
			return { sources: [], toolText: `Search failed: HTTP ${response.status}.` };
		}

		const data = (await response.json()) as { results?: RawSearchResult[] };
		return formatSearchResults((data.results ?? []).slice(0, 5));
	} catch (error) {
		return { sources: [], toolText: `Search failed: ${error instanceof Error ? error.message : "unknown error"}.` };
	}
}

export interface GenerateImageArgs {
	prompt: string;
	width?: number;
	height?: number;
}

export async function executeGenerateImage(
	args: GenerateImageArgs,
	opts: ToolExecOptions,
): Promise<{ image: ImageData | null; toolText: string }> {
	try {
		const response = await fetch(`${opts.connectedApiUrl}/sdapi/v1/txt2img`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.chatApiKey}` },
			body: JSON.stringify({
				model: "z-image-turbo",
				prompt: args.prompt,
				width: args.width ?? 1024,
				height: args.height ?? 1024,
				steps: 9,
				seed: -1,
				remove_background: false,
			}),
			signal: opts.signal,
		});

		if (!response.ok) {
			const text = await response.text();
			return { image: null, toolText: `Image generation failed: ${text || `HTTP ${response.status}`}.` };
		}

		const data = (await response.json()) as { images: string[] };
		const base64 = data.images?.[0];
		if (!base64) return { image: null, toolText: "Image generation failed: empty response." };

		const image: ImageData = {
			data: `data:image/png;base64,${base64}`,
			mimeType: "image/png",
			filename: "generated.png",
		};
		return { image, toolText: "Image generated successfully and shown to the user." };
	} catch (error) {
		return {
			image: null,
			toolText: `Image generation failed: ${error instanceof Error ? error.message : "unknown error"}.`,
		};
	}
}
