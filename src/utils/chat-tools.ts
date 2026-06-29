import type OpenAI from "openai";
import type { ImageData, SearchSource } from "@/types/chats";
import { runCode } from "@/lib/interpreter/run";
import type { InterpreterFile, InterpreterLanguage, InterpreterResult } from "@/lib/interpreter/types";

export type ToolName = "web_search" | "generate_image" | "run_python" | "run_javascript";

/** Backend-supported web-search modes (search-service `SearchType`, serialized lowercase). */
export type SearchType = "web" | "news" | "academic" | "images";

export const SEARCH_TYPES: SearchType[] = ["web", "news", "academic", "images"];

export const DEFAULT_SEARCH_TYPE: SearchType = "web";

export interface ToolExecOptions {
	/** Connected API base WITHOUT trailing /v1, e.g. https://api.libertai.io */
	connectedApiUrl: string;
	chatApiKey: string;
	/** Which search mode to request from the /search endpoint. Defaults to "web". */
	searchType?: SearchType;
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
	{
		type: "function",
		function: {
			name: "run_python",
			description:
				"Run Python code in a secure sandboxed environment (Pyodide/WASM) and return its output. " +
				"numpy, pandas and matplotlib are available. Use print() to show results; the value of the " +
				"last expression is also captured. A matplotlib figure is returned as an image to the user. " +
				"Use for calculations, data analysis, plotting, and verifying code.",
			parameters: {
				type: "object",
				properties: { code: { type: "string", description: "The Python source code to execute." } },
				required: ["code"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "run_javascript",
			description:
				"Run JavaScript code in a secure sandboxed Web Worker and return its output. console.log output " +
				"and the returned value are captured. Use for quick calculations, string/JSON manipulation, and " +
				"verifying logic.",
			parameters: {
				type: "object",
				properties: { code: { type: "string", description: "The JavaScript source code to execute." } },
				required: ["code"],
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
				search_type: opts.searchType ?? DEFAULT_SEARCH_TYPE,
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

/** What we persist on the assistant message so a code run renders in the chat. Mirrors the
 *  interpreter result but only the display-relevant fields (plus the source code we ran). */
export interface InterpreterArtifact {
	language: InterpreterLanguage;
	code: string;
	stdout: string;
	stderr: string;
	result: string | null;
	imagePng: string | null;
	error: string | null;
	timedOut: boolean;
	/** True while the run is in flight (cold load / executing). The UI renders a preparing/streaming
	 *  state and fills in stdout live as progress arrives. False once the final result lands. */
	pending?: boolean;
	/** Current phase while pending: "preparing" (runtime + packages downloading) or "running"
	 *  (user code executing). Undefined once settled. */
	phase?: "preparing" | "running";
	/** Files the code wrote to the sandbox filesystem, delivered to the user as downloads. */
	files?: InterpreterFile[];
}

/** Render an interpreter run as the `tool` message text the model reads next turn. Keeps it
 *  compact but faithful: stdout, last value, errors, and a note that any image was shown. */
export function formatInterpreterResult(result: InterpreterResult): string {
	const parts: string[] = [];
	if (result.stdout.trim()) parts.push(`stdout:\n${result.stdout.trim()}`);
	if (result.result != null && result.result !== "") parts.push(`result: ${result.result}`);
	if (result.stderr.trim()) parts.push(`stderr:\n${result.stderr.trim()}`);
	if (result.imagePng) parts.push("A plot image was produced and shown to the user.");
	if (result.files && result.files.length > 0) {
		const list = result.files.map((f) => `${f.name} (${formatBytes(f.size)})`).join(", ");
		parts.push(
			`Delivered to the user as downloads: ${list}. File writes to the sandbox filesystem are ` +
				`delivered to the user automatically — reference them by name and do not report a local /tmp path.`,
		);
	}
	if (result.timedOut) parts.push("The execution was terminated because it exceeded the time limit.");
	else if (result.error) parts.push(`error: ${result.error}`);
	if (parts.length === 0) parts.push("The code ran successfully with no output.");
	return parts.join("\n\n");
}

/** Human-readable byte size, e.g. 67.7 KB, used in the tool-result file list and the download chip. */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface RunCodeOptions {
	/** Execution budget in ms before the sandbox terminates the worker. */
	timeoutMs?: number;
	/** Override the Pyodide CDN base (tests/self-host). */
	pyodideIndexUrl?: string;
	signal?: AbortSignal;
	/** Live progress from the sandbox (cold load / streaming stdout). */
	onProgress?: (progress: { phase: "preparing" | "running"; stdout: string; stderr: string }) => void;
}

/**
 * Execute model-supplied code through the client-side sandbox. NEVER throws — a load failure,
 * crash, or timeout comes back as an InterpreterArtifact with `error` set, plus a `toolText` the
 * model can read. The artifact is rendered in the message; the toolText feeds the next loop turn.
 */
export async function executeRunCode(
	language: InterpreterLanguage,
	code: string,
	opts: RunCodeOptions = {},
): Promise<{ artifact: InterpreterArtifact; toolText: string }> {
	const result = await runCode(language, code, {
		timeoutMs: opts.timeoutMs,
		pyodideIndexUrl: opts.pyodideIndexUrl,
		signal: opts.signal,
		onProgress: opts.onProgress,
	});
	const artifact: InterpreterArtifact = {
		language,
		code,
		stdout: result.stdout,
		stderr: result.stderr,
		result: result.result,
		imagePng: result.imagePng,
		error: result.error,
		timedOut: result.timedOut,
		files: result.files,
	};
	return { artifact, toolText: formatInterpreterResult(result) };
}
