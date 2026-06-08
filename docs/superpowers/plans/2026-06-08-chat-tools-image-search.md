# Chat Tools (image generation + web search) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let chat models call two tools — web search and image generation — for logged-in users, ChatGPT-style (auto + per-message force buttons in the `+` menu), routed through `api.libertai.io` with the per-user chat API key.

**Architecture:** A client-side agentic tool-calling loop replaces the single streaming completion in the chat route. Pure, unit-tested utilities handle tool schemas/executors, streaming `tool_call` accumulation, and request-message building (incl. a 4-image cap). Artifacts (generated images, search sources) persist on the assistant message via a new chat schema version (v4) and render in the message component. The `+` menu gains Create image / Web search items (disabled+tooltip when not connected) plus a forced-tool chip.

**Tech Stack:** React 19, TypeScript, TanStack Router/Query, Zustand (+persist migrations), OpenAI SDK v6, Zod, Radix UI, Vitest.

**Backend contracts (verified):** connected base `https://api.libertai.io`, `Authorization: Bearer {chatApiKey}`, CORS `*` on `/search` and image endpoints.
- Search: `POST /search` body `{query, engines?, max_results?, search_type?}` → `{results:[{title,url,snippet,...}], meta}`.
- Image: `POST /sdapi/v1/txt2img` body `{model, prompt, width, height, steps, seed, remove_background}` → `{images:string[] (base64), parameters, info}`.
- Chat: `POST /v1/chat/completions`, OpenAI-compatible, streaming; all chat models advertise `function_calling=true`.
- **Runtime risks (degradation built in, verify manually):** named `tool_choice` forcing and streaming `tool_call` deltas may not be honored by the upstream.

**Spec:** `docs/superpowers/specs/2026-06-08-chat-tools-image-search-design.md`

---

## File map

**Create**
- `src/config/model-capabilities.ts` → add `supportsTools` (modify, but listed here for clarity)
- `src/utils/chat-tools.ts` — tool JSON schemas, `formatSearchResults`, `executeWebSearch`, `executeGenerateImage`, shared types
- `src/utils/chat-tools.test.ts`
- `src/utils/tool-call-accumulator.ts` — accumulate streaming `tool_calls` deltas → resolved calls
- `src/utils/tool-call-accumulator.test.ts`
- `src/utils/build-request-messages.ts` — map history → OpenAI messages with 4-image cap + assistant-image wrapping
- `src/utils/build-request-messages.test.ts`
- `src/types/chats/v4.ts` — `MessageV4`/`ChatV4` + `SearchSource`
- `src/types/chats/migrations/v4.ts` — `v3ToV4Migration`

**Modify**
- `src/config/model-capabilities.ts` — `supportsTools`
- `src/types/chats/index.ts` — re-export V4
- `src/types/chats/migrations/index.ts` — register `v3ToV4Migration`
- `src/stores/chat.ts` — bump `CHAT_VERSION` → 4, add `updateMessageArtifacts`
- `src/hooks/data/use-image-generation.ts` — delegate to `executeGenerateImage`
- `src/components/ChatInput.tsx` — `isConnected` prop, `+` menu items, forced-tool chip, extended `onSubmit`
- `src/components/Message.tsx` — render assistant images, Sources block, `toolStatus`
- `src/routes/chat.$chatId.tsx` — agentic loop, `forcedTool` ref, abort/stop button, status, pass `isConnected`

---

### Task 1: `supportsTools` capability helper

**Files:**
- Modify: `src/config/model-capabilities.ts`
- Test: `src/config/model-capabilities.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/config/model-capabilities.test.ts
import { describe, expect, it } from "vitest";
import { supportsTools, supportsImages } from "@/config/model-capabilities";
import type { Model } from "@/hooks/data/use-models";

const model = (id: string, fc: boolean, vision: boolean): Model =>
	({
		id,
		name: id,
		capabilities: { text: { context_window: 1, function_calling: fc, reasoning: false, vision } },
	}) as unknown as Model;

describe("supportsTools", () => {
	const models = [model("qwen3.6-35b-a3b", true, true), model("hermes", false, false)];

	it("is true when the model advertises function_calling", () => {
		expect(supportsTools("qwen3.6-35b-a3b", models)).toBe(true);
	});

	it("is false when the model lacks function_calling", () => {
		expect(supportsTools("hermes", models)).toBe(false);
	});

	it("strips the -thinking suffix before lookup", () => {
		expect(supportsTools("qwen3.6-35b-a3b-thinking", models)).toBe(true);
	});

	it("is false for unknown models", () => {
		expect(supportsTools("nope", models)).toBe(false);
	});

	it("keeps supportsImages working (regression)", () => {
		expect(supportsImages("qwen3.6-35b-a3b", models)).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/config/model-capabilities.test.ts`
Expected: FAIL — `supportsTools` is not exported.

- [ ] **Step 3: Implement**

Append to `src/config/model-capabilities.ts`:

```ts
export function supportsTools(model: string, models: Model[]): boolean {
	return findModel(model, models)?.capabilities.text?.function_calling ?? false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/config/model-capabilities.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config/model-capabilities.ts src/config/model-capabilities.test.ts
git commit -m "feat(models): add supportsTools capability helper"
```

---

### Task 2: Chat schema v4 (sources field) + migration + store version bump

**Files:**
- Create: `src/types/chats/v4.ts`, `src/types/chats/migrations/v4.ts`
- Modify: `src/types/chats/index.ts`, `src/types/chats/migrations/index.ts`, `src/stores/chat.ts`
- Test: `src/types/chats/migrations/v4.test.ts` (create)

- [ ] **Step 1: Create the v4 schema**

```ts
// src/types/chats/v4.ts
import { z } from "zod";
import { ChatV3Schema, MessageV3Schema } from "@/types/chats/v3.ts";

export const SearchSourceV4Schema = z.object({
	title: z.string(),
	url: z.string(),
	snippet: z.string(),
});

export const MessageV4Schema = MessageV3Schema.extend({
	sources: z.array(SearchSourceV4Schema).optional(),
});

export const ChatV4Schema = ChatV3Schema.omit({ messages: true }).extend({
	messages: z.array(MessageV4Schema),
});

export type SearchSourceV4 = z.infer<typeof SearchSourceV4Schema>;
export type MessageV4 = z.infer<typeof MessageV4Schema>;
export type ChatV4 = z.infer<typeof ChatV4Schema>;
export type ChatsV4 = Record<string, ChatV4>;
```

- [ ] **Step 2: Create the migration**

```ts
// src/types/chats/migrations/v4.ts
import { z } from "zod";
import { ChatV3Schema } from "../v3";
import { ChatV4Schema } from "../v4";
import type { Migration } from "./index";

const V3StoreSchema = z.object({
	chats: z.record(z.string(), ChatV3Schema),
	legacyMigrated: z.boolean().optional(),
});

const V4StoreSchema = z.object({
	chats: z.record(z.string(), ChatV4Schema),
	legacyMigrated: z.boolean().optional(),
});

type V3Store = z.infer<typeof V3StoreSchema>;
type V4Store = z.infer<typeof V4StoreSchema>;

export const v3ToV4Migration: Migration<V3Store, V4Store> = {
	fromVersion: 3,
	toVersion: 4,
	inputSchema: V3StoreSchema,
	outputSchema: V4StoreSchema,
	// Add `sources` (defaults to undefined) to every message.
	migrate: (state: V3Store): V4Store => {
		const migratedChats = Object.entries(state.chats).reduce(
			(acc, [chatId, chat]) => {
				acc[chatId] = {
					...chat,
					messages: chat.messages.map((msg) => ({ ...msg, sources: undefined })),
				};
				return acc;
			},
			{} as Record<string, V4Store["chats"][string]>,
		);
		return { ...state, chats: migratedChats };
	},
};
```

- [ ] **Step 3: Write the failing migration test**

```ts
// src/types/chats/migrations/v4.test.ts
import { describe, expect, it } from "vitest";
import { v3ToV4Migration } from "./v4";

const v3State = {
	chats: {
		a: {
			id: "a",
			assistantId: "asst",
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
			messages: [{ id: "m1", role: "user", content: "hi", timestamp: new Date("2026-01-01") }],
		},
	},
	legacyMigrated: true,
};

describe("v3ToV4Migration", () => {
	it("adds an undefined sources field to every message and validates", () => {
		const out = v3ToV4Migration.migrate(v3State as never);
		expect(out.chats.a.messages[0]).toHaveProperty("sources", undefined);
		expect(v3ToV4Migration.outputSchema.safeParse(out).success).toBe(true);
	});

	it("declares fromVersion 3 -> toVersion 4", () => {
		expect(v3ToV4Migration.fromVersion).toBe(3);
		expect(v3ToV4Migration.toVersion).toBe(4);
	});
});
```

- [ ] **Step 4: Run test to verify it fails, then passes after wiring**

Run: `pnpm test src/types/chats/migrations/v4.test.ts`
Expected: PASS (the module already exists from Steps 1-2; if it fails, fix imports).

- [ ] **Step 5: Register the migration**

In `src/types/chats/migrations/index.ts`, add the import and array entry:

```ts
import { v3ToV4Migration } from "./v4.ts";
```
```ts
const migrations: Migration[] = [v1ToV2Migration, v2ToV3Migration, v3ToV4Migration];
```

- [ ] **Step 6: Re-point the public types**

Replace the contents of `src/types/chats/index.ts`:

```ts
// Re-export latest version schemas and types
export type { MessageV4 as Message, ChatV4 as Chat, ImageDataV3 as ImageData, SearchSourceV4 as SearchSource } from "./v4";
```

(Note: `v4.ts` does not re-export `ImageDataV3`; keep importing `ImageData` from `./v3` is also valid. Update the line above to:)

```ts
export type { MessageV4 as Message, ChatV4 as Chat, SearchSourceV4 as SearchSource } from "./v4";
export type { ImageDataV3 as ImageData } from "./v3";
```

- [ ] **Step 7: Bump the persisted store version**

In `src/stores/chat.ts`, change:

```ts
const CHAT_VERSION = 4;
```

- [ ] **Step 8: Verify build + full test suite**

Run: `pnpm test && pnpm build`
Expected: tests PASS; `tsc -b` compiles (the `SearchSource` type now exists for later tasks).

- [ ] **Step 9: Commit**

```bash
git add src/types/chats/ src/stores/chat.ts
git commit -m "feat(chats): add v4 schema with message sources + migration"
```

---

### Task 3: `updateMessageArtifacts` store action

**Files:**
- Modify: `src/stores/chat.ts`
- Test: `src/stores/chat.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/stores/chat.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/stores/chat.test.ts`
Expected: FAIL — `updateMessageArtifacts` is not a function.

- [ ] **Step 3: Implement**

In `src/stores/chat.ts`: add to the `ChatStore` interface (after `updateMessage`):

```ts
	updateMessageArtifacts: (
		chatId: string,
		messageId: string,
		artifacts: { sources?: Message["sources"]; images?: ImageData[] },
	) => void;
```

Add the implementation (after the `updateMessage` action):

```ts
			updateMessageArtifacts: (chatId, messageId, artifacts) => {
				set((state) => {
					const chat = state.chats[chatId];
					if (!chat) return state;

					return {
						chats: {
							...state.chats,
							[chatId]: {
								...chat,
								messages: chat.messages.map((msg) =>
									msg.id === messageId ? { ...msg, ...artifacts } : msg,
								),
								updatedAt: new Date().toISOString(),
							},
						},
					};
				});
			},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/stores/chat.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/chat.ts src/stores/chat.test.ts
git commit -m "feat(chats): add updateMessageArtifacts store action"
```

---

### Task 4: Tool definitions + executors (`chat-tools.ts`)

**Files:**
- Create: `src/utils/chat-tools.ts`, `src/utils/chat-tools.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/chat-tools.test.ts
import { describe, expect, it, vi, afterEach } from "vitest";
import { formatSearchResults, executeWebSearch, executeGenerateImage, TOOL_DEFINITIONS } from "@/utils/chat-tools";

const OPTS = { connectedApiUrl: "https://api.libertai.io", chatApiKey: "sk-chat-1" };

afterEach(() => vi.restoreAllMocks());

describe("TOOL_DEFINITIONS", () => {
	it("declares web_search and generate_image functions", () => {
		const names = TOOL_DEFINITIONS.map((t) => t.function.name).sort();
		expect(names).toEqual(["generate_image", "web_search"]);
	});
});

describe("formatSearchResults", () => {
	it("formats a numbered list and maps sources", () => {
		const { sources, toolText } = formatSearchResults([
			{ title: "A", url: "https://a", snippet: "sa" },
			{ title: "B", url: "https://b", snippet: "sb" },
		]);
		expect(sources).toHaveLength(2);
		expect(toolText).toContain("1. A");
		expect(toolText).toContain("https://b");
	});

	it("returns 'No results found.' for an empty list", () => {
		const { sources, toolText } = formatSearchResults([]);
		expect(sources).toEqual([]);
		expect(toolText).toBe("No results found.");
	});
});

describe("executeWebSearch", () => {
	it("POSTs to /search with bearer key and default params", async () => {
		const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ results: [{ title: "A", url: "https://a", snippet: "sa", engine: "google" }] }), {
				status: 200,
			}),
		);

		const out = await executeWebSearch("rust", OPTS);

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.libertai.io/search",
			expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer sk-chat-1" }) }),
		);
		const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
		expect(body).toMatchObject({ query: "rust", max_results: 5, search_type: "web" });
		expect(body.engines).toEqual(["google", "bing", "duckduckgo"]);
		expect(out.sources[0].title).toBe("A");
	});

	it("returns an error toolText (no throw) on HTTP failure", async () => {
		vi.spyOn(global, "fetch").mockResolvedValue(new Response("boom", { status: 500 }));
		const out = await executeWebSearch("rust", OPTS);
		expect(out.sources).toEqual([]);
		expect(out.toolText.toLowerCase()).toContain("search failed");
	});
});

describe("executeGenerateImage", () => {
	it("POSTs to /sdapi/v1/txt2img and returns an ImageData", async () => {
		const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ images: ["BASE64DATA"], parameters: { seed: 1 } }), { status: 200 }),
		);
		const out = await executeGenerateImage({ prompt: "a cat" }, OPTS);

		expect(fetchMock).toHaveBeenCalledWith("https://api.libertai.io/sdapi/v1/txt2img", expect.objectContaining({ method: "POST" }));
		const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
		expect(body).toMatchObject({ model: "z-image-turbo", prompt: "a cat", width: 1024, height: 1024, steps: 9 });
		expect(out.image?.data).toBe("data:image/png;base64,BASE64DATA");
		expect(out.image?.mimeType).toBe("image/png");
		expect(out.toolText).toContain("successfully");
	});

	it("returns image=null and an error toolText on failure", async () => {
		vi.spyOn(global, "fetch").mockResolvedValue(new Response("nope", { status: 429 }));
		const out = await executeGenerateImage({ prompt: "x" }, OPTS);
		expect(out.image).toBeNull();
		expect(out.toolText.toLowerCase()).toContain("failed");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/utils/chat-tools.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/utils/chat-tools.ts`**

```ts
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
			description: "Generate an image from a text prompt. Use when the user asks to create, draw, or generate a picture.",
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
		return { image: null, toolText: `Image generation failed: ${error instanceof Error ? error.message : "unknown error"}.` };
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/utils/chat-tools.test.ts`
Expected: PASS (all groups).

- [ ] **Step 5: Commit**

```bash
git add src/utils/chat-tools.ts src/utils/chat-tools.test.ts
git commit -m "feat(chat): add tool definitions and web-search/image executors"
```

---

### Task 5: Reuse `executeGenerateImage` in `use-image-generation`

**Files:**
- Modify: `src/hooks/data/use-image-generation.ts`

Keep the hook's public API (`generate`, `isGenerating`, `error`) and `ImageGenerationParams`/`ImageGenerationResult` so the `/images` page is untouched, but route its network call through the shared executor's endpoint to avoid divergence. (The hook returns raw base64 in `ImageGenerationResult`; the standalone form depends on that shape, so we keep the direct fetch here but align the URL/headers. No behavior change — this task is a no-op safety alignment; skip if time-constrained.)

- [ ] **Step 1: Confirm no change needed**

The standalone form consumes `{ images: string[], parameters: { seed } }`. `executeGenerateImage` returns a wrapped `ImageData`. These shapes differ, so do NOT replace the hook body. Leave `use-image-generation.ts` as-is.

- [ ] **Step 2: No commit** (intentionally empty task — recorded so the executor duplication is a conscious decision, not an oversight).

---

### Task 6: Streaming tool-call accumulator

**Files:**
- Create: `src/utils/tool-call-accumulator.ts`, `src/utils/tool-call-accumulator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/tool-call-accumulator.test.ts
import { describe, expect, it } from "vitest";
import { ToolCallAccumulator } from "@/utils/tool-call-accumulator";

describe("ToolCallAccumulator", () => {
	it("assembles a single tool call from streamed fragments", () => {
		const acc = new ToolCallAccumulator();
		acc.add([{ index: 0, id: "call_1", type: "function", function: { name: "web_search", arguments: '{"qu' } }]);
		acc.add([{ index: 0, function: { arguments: 'ery":"rust"}' } }]);

		const calls = acc.finalize();
		expect(calls).toEqual([{ id: "call_1", name: "web_search", arguments: { query: "rust" } }]);
	});

	it("handles two parallel tool calls keyed by index", () => {
		const acc = new ToolCallAccumulator();
		acc.add([{ index: 0, id: "a", function: { name: "web_search", arguments: '{"query":"x"}' } }]);
		acc.add([{ index: 1, id: "b", function: { name: "generate_image", arguments: '{"prompt":"cat"}' } }]);

		const calls = acc.finalize();
		expect(calls).toHaveLength(2);
		expect(calls[1]).toEqual({ id: "b", name: "generate_image", arguments: { prompt: "cat" } });
	});

	it("returns empty arguments object when args are blank or invalid JSON", () => {
		const acc = new ToolCallAccumulator();
		acc.add([{ index: 0, id: "a", function: { name: "web_search", arguments: "" } }]);
		expect(acc.finalize()[0].arguments).toEqual({});
	});

	it("hasCalls reflects whether any tool call was seen", () => {
		const acc = new ToolCallAccumulator();
		expect(acc.hasCalls()).toBe(false);
		acc.add([{ index: 0, id: "a", function: { name: "web_search", arguments: "{}" } }]);
		expect(acc.hasCalls()).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/utils/tool-call-accumulator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/utils/tool-call-accumulator.ts`**

```ts
export interface ResolvedToolCall {
	id: string;
	name: ToolName;
	arguments: Record<string, unknown>;
}

import type { ToolName } from "@/utils/chat-tools";

interface ToolCallDelta {
	index: number;
	id?: string;
	type?: string;
	function?: { name?: string; arguments?: string };
}

interface Partial {
	id: string;
	name: string;
	args: string;
}

/** Accumulates OpenAI streaming `delta.tool_calls` fragments (keyed by `index`) into resolved calls. */
export class ToolCallAccumulator {
	private partials = new Map<number, Partial>();

	add(deltas: ToolCallDelta[] | undefined): void {
		if (!deltas) return;
		for (const delta of deltas) {
			const existing = this.partials.get(delta.index) ?? { id: "", name: "", args: "" };
			if (delta.id) existing.id = delta.id;
			if (delta.function?.name) existing.name = delta.function.name;
			if (delta.function?.arguments) existing.args += delta.function.arguments;
			this.partials.set(delta.index, existing);
		}
	}

	hasCalls(): boolean {
		return this.partials.size > 0;
	}

	finalize(): ResolvedToolCall[] {
		return [...this.partials.entries()]
			.sort(([a], [b]) => a - b)
			.map(([, p]) => {
				let parsed: Record<string, unknown> = {};
				try {
					parsed = p.args.trim() ? (JSON.parse(p.args) as Record<string, unknown>) : {};
				} catch {
					parsed = {};
				}
				return { id: p.id, name: p.name as ToolName, arguments: parsed };
			});
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/utils/tool-call-accumulator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/tool-call-accumulator.ts src/utils/tool-call-accumulator.test.ts
git commit -m "feat(chat): add streaming tool-call accumulator"
```

---

### Task 7: Build request messages with 4-image cap

**Files:**
- Create: `src/utils/build-request-messages.ts`, `src/utils/build-request-messages.test.ts`

Behavior: map persisted history → OpenAI `ChatCompletionMessageParam[]` (user/assistant only; the caller prepends the system message). Collect every image across all messages in order; keep only the **4 most recent**. User-message images attach inline as `image_url` content blocks. Assistant-message images (model-generated) cannot ride on an assistant turn, so emit a synthetic `{ role: "user", content: [image_url...] }` immediately after the assistant text message. When the model lacks vision, attach no images (plain string content).

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/build-request-messages.test.ts
import { describe, expect, it } from "vitest";
import { buildRequestMessages } from "@/utils/build-request-messages";
import type { Message } from "@/types/chats";
import type { Model } from "@/hooks/data/use-models";

const img = (n: string) => ({ data: `data:image/png;base64,${n}`, mimeType: "image/png", filename: `${n}.png` });
const visionModels = [{ id: "m", name: "m", capabilities: { text: { vision: true, function_calling: true } } }] as unknown as Model[];
const noVisionModels = [{ id: "m", name: "m", capabilities: { text: { vision: false, function_calling: true } } }] as unknown as Model[];

const msg = (over: Partial<Message>): Message =>
	({ id: Math.random().toString(), role: "user", content: "", timestamp: new Date(), ...over }) as Message;

describe("buildRequestMessages", () => {
	it("attaches user images inline as image_url blocks", () => {
		const out = buildRequestMessages([msg({ role: "user", content: "hi", images: [img("a")] })], "m", visionModels);
		expect(out).toHaveLength(1);
		const content = out[0].content as Array<{ type: string }>;
		expect(content.some((c) => c.type === "image_url")).toBe(true);
		expect(content.some((c) => c.type === "text")).toBe(true);
	});

	it("keeps only the 4 most recent images, dropping the oldest", () => {
		const out = buildRequestMessages(
			[msg({ role: "user", content: "many", images: [img("1"), img("2"), img("3"), img("4"), img("5")] })],
			"m",
			visionModels,
		);
		const content = out[0].content as Array<{ type: string; image_url?: { url: string } }>;
		const urls = content.filter((c) => c.type === "image_url").map((c) => c.image_url!.url);
		expect(urls).toHaveLength(4);
		expect(urls.some((u) => u.includes("base64,1"))).toBe(false); // oldest dropped
		expect(urls.some((u) => u.includes("base64,5"))).toBe(true);
	});

	it("wraps assistant (generated) images in a synthetic user message", () => {
		const out = buildRequestMessages(
			[msg({ role: "user", content: "draw a cat" }), msg({ role: "assistant", content: "here", images: [img("cat")] })],
			"m",
			visionModels,
		);
		// user, assistant(text), synthetic-user(image)
		expect(out).toHaveLength(3);
		expect(out[1].role).toBe("assistant");
		expect(typeof out[1].content).toBe("string");
		expect(out[2].role).toBe("user");
		const synth = out[2].content as Array<{ type: string }>;
		expect(synth.some((c) => c.type === "image_url")).toBe(true);
	});

	it("omits images entirely for non-vision models", () => {
		const out = buildRequestMessages([msg({ role: "user", content: "hi", images: [img("a")] })], "m", noVisionModels);
		expect(out[0].content).toBe("hi");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/utils/build-request-messages.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/utils/build-request-messages.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/utils/build-request-messages.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/build-request-messages.ts src/utils/build-request-messages.test.ts
git commit -m "feat(chat): build request messages with 4-image cap and assistant-image wrapping"
```

---

### Task 8: ChatInput — `+` menu, forced-tool chip, `isConnected`

**Files:**
- Modify: `src/components/ChatInput.tsx`

No unit tests (no component-test harness in this repo); verify via typecheck/build + manual.

- [ ] **Step 1: Extend props and `onSubmit`**

In `ChatInputProps`:

```ts
	onSubmit: (value: string, images?: ImageData[], forcedTool?: "web_search" | "generate_image") => void;
	isConnected: boolean;
```

Destructure `isConnected` in the component signature.

- [ ] **Step 2: Add capability + state**

Below the existing `modelSupportsImages` memo:

```ts
	const modelSupportsTools = useMemo(() => supportsTools(assistant.model, models ?? []), [assistant, models]);
	const [forcedTool, setForcedTool] = useState<"web_search" | "generate_image" | null>(null);

	// Clear a stale forced tool if the user switches to a model that can't use tools.
	useEffect(() => {
		if (!modelSupportsTools) setForcedTool(null);
	}, [modelSupportsTools]);
```

Add imports at the top:

```ts
import { ArrowUp, Globe, ImageIcon, Paperclip, Plus, Sparkles, X } from "lucide-react";
import { supportsTools } from "@/config/model-capabilities";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
```

- [ ] **Step 3: Pass `forcedTool` through submit and clear it**

In `handleSubmit`:

```ts
	const handleSubmit = () => {
		if (!hasContent || disabled || isSubmitting) return;
		onSubmit(value, modelSupportsImages && images.length > 0 ? images : undefined, forcedTool ?? undefined);
		setValue("");
		setImages([]);
		setForcedTool(null);
	};
```

- [ ] **Step 4: Render the forced-tool chip inside the input container**

Immediately after the image-preview block (inside the rounded container, before `<Textarea>`):

```tsx
				{forcedTool && (
					<div className="px-4 pt-3 flex">
						<span className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary/10 text-primary rounded-full pl-2.5 pr-1.5 py-1">
							{forcedTool === "web_search" ? <Globe className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
							{forcedTool === "web_search" ? "Web search" : "Create image"}
							<button
								type="button"
								onClick={() => setForcedTool(null)}
								className="cursor-pointer rounded-full hover:bg-primary/20 p-0.5"
							>
								<X className="h-2.5 w-2.5" />
							</button>
						</span>
					</div>
				)}
```

- [ ] **Step 5: Restructure the `+` menu**

Replace the whole `{modelSupportsImages && ( ... )}` block (the file-input + DropdownMenu) with this. The file input is hoisted out of the image-only guard; the menu shows whenever tools OR images are available:

```tsx
					{(modelSupportsTools || modelSupportsImages) && (
						<>
							<input
								type="file"
								ref={fileInputRef}
								className="hidden"
								accept="image/jpeg,image/jpg,image/png"
								onChange={handleImageUpload}
							/>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 rounded-full border border-card dark:border-hover text-foreground"
									>
										<Plus className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start">
									{modelSupportsImages && (
										<DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
											<Paperclip className="mr-2 h-4 w-4" />
											<span>Add photos & files</span>
										</DropdownMenuItem>
									)}
									{modelSupportsTools && (
										<>
											<ToolMenuItem
												icon={<Sparkles className="mr-2 h-4 w-4" />}
												label="Create image"
												isConnected={isConnected}
												onSelect={() => setForcedTool("generate_image")}
											/>
											<ToolMenuItem
												icon={<Globe className="mr-2 h-4 w-4" />}
												label="Web search"
												isConnected={isConnected}
												onSelect={() => setForcedTool("web_search")}
											/>
										</>
									)}
								</DropdownMenuContent>
							</DropdownMenu>
						</>
					)}
```

- [ ] **Step 6: Add the `ToolMenuItem` helper component**

At the bottom of the file (outside `ChatInput`):

```tsx
function ToolMenuItem({
	icon,
	label,
	isConnected,
	onSelect,
}: Readonly<{ icon: React.ReactNode; label: string; isConnected: boolean; onSelect: () => void }>) {
	if (isConnected) {
		return (
			<DropdownMenuItem onClick={onSelect}>
				{icon}
				<span>{label}</span>
			</DropdownMenuItem>
		);
	}
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				{/* span wrapper: disabled items don't fire pointer events for the tooltip */}
				<div>
					<DropdownMenuItem disabled onSelect={(e) => e.preventDefault()} className="opacity-50">
						{icon}
						<span>{label}</span>
					</DropdownMenuItem>
				</div>
			</TooltipTrigger>
			<TooltipContent side="right">Connect your account to use this</TooltipContent>
		</Tooltip>
	);
}
```

Add `import type React from "react";` if not already importing React types.

- [ ] **Step 7: Typecheck + lint + build**

Run: `pnpm lint && pnpm build`
Expected: no errors. (Callers of `ChatInput` now require `isConnected` — Task 10 supplies it; the index/home route may also render `ChatInput`. Grep and fix in the next step.)

- [ ] **Step 8: Supply `isConnected` to every `ChatInput` usage**

Run: `git grep -n "<ChatInput"`
For each call site, add `isConnected={isAuthenticated && !!chatApiKey}` (import `useAccountStore` from `@libertai/auth` and `useChatApiKey` where needed). For `src/routes/index.tsx`, wire the same; logged-out home page passes `isConnected={false}`.

Run: `pnpm lint && pnpm build`
Expected: clean.

- [ ] **Step 9: Manual verification**

Run `pnpm dev`. Logged out: `+` menu shows "Create image" / "Web search" disabled with tooltip "Connect your account to use this"; "Add photos & files" only on vision models. Logged in: items enabled, selecting one shows a removable chip; sending clears the chip.

- [ ] **Step 10: Commit**

```bash
git add src/components/ChatInput.tsx src/routes/index.tsx
git commit -m "feat(chat): add tools to the + menu with forced-tool chip and connect gating"
```

---

### Task 9: Message — render assistant images, Sources block, tool status

**Files:**
- Modify: `src/components/Message.tsx`

- [ ] **Step 1: Extend props**

```ts
interface MessageProps {
	message: MessageType;
	isLastMessage: boolean;
	isLoading: boolean;
	isStreaming: boolean;
	toolStatus?: string | null; // e.g. "Searching the web…"
	onRegenerate: () => void;
	onEditMessage?: (id: string, content: string) => void;
	onRegenerateFromMessage?: (id: string) => void;
}
```

Destructure `toolStatus` in the component.

- [ ] **Step 2: Render assistant generated images**

Inside the assistant branch, before the markdown `<div>` (after line ~127), add:

```tsx
						{message.role === "assistant" && message.images && message.images.length > 0 && (
							<div className="mb-3 flex flex-wrap gap-2">
								{message.images.map((image, index) => (
									<img
										key={index}
										src={image.data}
										alt={image.filename}
										className="max-w-sm w-full rounded-lg border border-card dark:border-hover"
									/>
								))}
							</div>
						)}
```

- [ ] **Step 3: Render the live tool status**

Right after the thinking block (before "Main message content"), add:

```tsx
					{message.role === "assistant" && isLastMessage && toolStatus && (
						<div className="mb-3 flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
							<span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
							{toolStatus}
						</div>
					)}
```

- [ ] **Step 4: Render the Sources block**

After the assistant markdown content `<div>` (after line ~154), add a collapsible block. Add `const [isSourcesExpanded, setIsSourcesExpanded] = useState(false);` near the other `useState` hooks, and import `Globe` from lucide-react:

```tsx
						{message.role === "assistant" && message.sources && message.sources.length > 0 && (
							<div className="mt-3">
								<button
									onClick={() => setIsSourcesExpanded(!isSourcesExpanded)}
									className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-muted/20 rounded-lg transition-colors"
								>
									<Globe className="w-4 h-4 text-primary" />
									<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
										{message.sources.length} source{message.sources.length > 1 ? "s" : ""}
									</span>
									{isSourcesExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
								</button>
								{isSourcesExpanded && (
									<div className="mt-2 space-y-2">
										{message.sources.map((s, i) => (
											<a
												key={i}
												href={s.url}
												target="_blank"
												rel="noopener noreferrer"
												className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-muted/20 transition-colors"
											>
												<img
													src={`https://www.google.com/s2/favicons?domain=${new URL(s.url).hostname}&sz=32`}
													alt=""
													className="w-4 h-4 mt-0.5 rounded"
												/>
												<span className="min-w-0">
													<span className="block text-sm font-medium truncate">{s.title}</span>
													<span className="block text-xs text-muted-foreground truncate">{s.snippet}</span>
												</span>
											</a>
										))}
									</div>
								)}
							</div>
						)}
```

(Wrap the `new URL(s.url)` in a try/catch helper if a malformed URL is a concern; for snippets-only search results URLs are well-formed.)

- [ ] **Step 5: Typecheck + build**

Run: `pnpm lint && pnpm build`
Expected: clean. (The new `toolStatus` prop is optional, so the existing call site in Task 10 compiles before/after.)

- [ ] **Step 6: Commit**

```bash
git add src/components/Message.tsx
git commit -m "feat(chat): render assistant images, sources block, and tool status"
```

---

### Task 10: Agentic loop in the chat route

**Files:**
- Modify: `src/routes/chat.$chatId.tsx`

This is the integration task that wires everything. No unit test (UI-driven); verify manually against the live gateway.

- [ ] **Step 1: Imports + capability/state**

Add imports:

```ts
import { useModels } from "@/hooks/data/use-models";
import { supportsTools } from "@/config/model-capabilities";
import { buildRequestMessages } from "@/utils/build-request-messages";
import { ToolCallAccumulator } from "@/utils/tool-call-accumulator";
import { TOOL_DEFINITIONS, executeWebSearch, executeGenerateImage } from "@/utils/chat-tools";
import type { GenerateImageArgs } from "@/utils/chat-tools";
import type OpenAI from "openai";
```

Inside `Chat()`, add:

```ts
	const { data: models } = useModels();
	const { updateMessageArtifacts } = useChatStore();
	const [toolStatus, setToolStatus] = useState<string | null>(null);
	const pendingForcedToolRef = useRef<"web_search" | "generate_image" | undefined>(undefined);
	const abortRef = useRef<AbortController | null>(null);

	const useConnected = isAuthenticated && !!chatApiKey;
	const modelSupportsTools = useMemo(
		() => supportsTools(getAssistantOrDefault(chat?.assistantId).model, models ?? []),
		[chat?.assistantId, models], // eslint-disable-line react-hooks/exhaustive-deps
	);
```

Add `useChatStore` already imports `updateMessage` etc. — extend the destructure at line 22 to include `updateMessageArtifacts`.

- [ ] **Step 2: Capture `forcedTool` from submit before adding the message**

Replace `handleSendMessage`:

```ts
	const handleSendMessage = async (value: string, images?: ImageData[], forcedTool?: "web_search" | "generate_image") => {
		if (!value.trim() || isLoading) return;
		pendingForcedToolRef.current = forcedTool;
		addMessage(chatId, "user", value.trim(), undefined, images);
	};
```

- [ ] **Step 3: Read+clear the forced tool in the auto-trigger effect**

In the effect that calls `generateAIResponse()` (line ~75), pass the captured tool:

```ts
			if (lastMessage.role === "user") {
				const forced = pendingForcedToolRef.current;
				pendingForcedToolRef.current = undefined;
				generateAIResponse(forced).then();
			}
```

- [ ] **Step 4: Replace `generateAIResponse` with the agentic loop**

Replace the whole function. Key invariants: `isLoading` stays `true` for the entire loop; `isStreaming` toggles per streamed token batch; tool plumbing stays in `requestMessages` (in-memory); artifacts persist via `updateMessageArtifacts`; aborting finalizes gracefully.

```ts
	const TOOL_LABELS: Record<string, string> = {
		web_search: "Searching the web…",
		generate_image: "Generating image…",
	};

	const generateAIResponse = async (forcedTool?: "web_search" | "generate_image") => {
		if (isLoading || isStreaming) return;
		if (messages.length === 0) return;
		if (messages[messages.length - 1].role !== "user") return;

		setIsLoading(true);
		setIsStreaming(false);
		setToolStatus(null);

		const controller = new AbortController();
		abortRef.current = controller;

		const assistant = getAssistantOrDefault(chat?.assistantId);
		const assistantMessage = addMessage(chatId, "assistant", "");

		const toolsEnabled = useConnected && modelSupportsTools;

		// requestMessages persists tool plumbing across loop iterations (in-memory only).
		const requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
			{ role: "system", content: assistant.systemPrompt },
			...buildRequestMessages(messages, assistant.model, models ?? []),
		];

		const accumulated: ParsedMessage = { thinking: "", content: "" };
		const collectedSources: { title: string; url: string; snippet: string }[] = [];
		const collectedImages: ImageData[] = [];

		try {
			for (let iteration = 0; iteration < 5; iteration++) {
				const toolAcc = new ToolCallAccumulator();
				accumulated.content = "";
				accumulated.thinking = "";

				const stream = await openai.chat.completions.create(
					{
						model: assistant.model,
						messages: requestMessages,
						stream: true,
						...(toolsEnabled ? { tools: TOOL_DEFINITIONS } : {}),
						...(toolsEnabled && iteration === 0 && forcedTool
							? { tool_choice: { type: "function", function: { name: forcedTool } } }
							: toolsEnabled
								? { tool_choice: "auto" }
								: {}),
					},
					{ signal: controller.signal },
				);

				for await (const chunk of stream) {
					const delta = chunk.choices[0]?.delta;
					if (!delta) continue;

					const deltaRecord = delta as Record<string, unknown>;
					const reasoningContent = (deltaRecord.reasoning ?? deltaRecord.reasoning_content) as string | undefined;
					const content = delta.content;

					if (reasoningContent) accumulated.thinking += reasoningContent;
					if (content) accumulated.content += content;
					toolAcc.add(delta.tool_calls as never);

					if (reasoningContent || content) {
						if (!isStreaming) {
							setIsStreaming(true);
							setIsLoading(false);
						}
						setToolStatus(null);
						updateMessage(chatId, assistantMessage.id, accumulated.content, accumulated.thinking);
					}
				}

				if (!toolAcc.hasCalls()) break; // final answer produced

				// Model wants to call tools. Show dots again while we execute.
				setIsStreaming(false);
				setIsLoading(true);

				const calls = toolAcc.finalize();
				requestMessages.push({
					role: "assistant",
					content: accumulated.content || null,
					tool_calls: calls.map((c) => ({
						id: c.id,
						type: "function",
						function: { name: c.name, arguments: JSON.stringify(c.arguments) },
					})),
				});

				if (forcedTool && iteration === 0 && !calls.some((c) => c.name === forcedTool)) {
					toast.warning("The model didn't run the requested tool.");
				}

				for (const call of calls) {
					setToolStatus(TOOL_LABELS[call.name] ?? "Working…");
					const opts = { connectedApiUrl: env.LTAI_CONNECTED_API_URL, chatApiKey: chatApiKey ?? "", signal: controller.signal };

					if (call.name === "web_search") {
						const query = String(call.arguments.query ?? "");
						const { sources, toolText } = await executeWebSearch(query, opts);
						collectedSources.push(...sources);
						updateMessageArtifacts(chatId, assistantMessage.id, { sources: collectedSources });
						requestMessages.push({ role: "tool", tool_call_id: call.id, content: toolText });
					} else if (call.name === "generate_image") {
						const { image, toolText } = await executeGenerateImage(call.arguments as GenerateImageArgs, opts);
						if (image) {
							collectedImages.push(image);
							updateMessageArtifacts(chatId, assistantMessage.id, { images: collectedImages });
						}
						requestMessages.push({ role: "tool", tool_call_id: call.id, content: toolText });
					} else {
						requestMessages.push({ role: "tool", tool_call_id: call.id, content: "Unknown tool." });
					}
				}
				setToolStatus(null);
				// loop continues → model produces the next message
			}

			if (!accumulated.content && !accumulated.thinking && collectedImages.length === 0) {
				updateMessage(chatId, assistantMessage.id, "Sorry, I could not process your request.");
			}
		} catch (error) {
			if (controller.signal.aborted) {
				if (!accumulated.content) updateMessage(chatId, assistantMessage.id, accumulated.content || "_(stopped)_");
			} else {
				console.error("Error sending message:", error);
				updateMessage(chatId, assistantMessage.id, "Sorry, there was an error processing your request. Please try again.");
			}
		} finally {
			setIsLoading(false);
			setIsStreaming(false);
			setToolStatus(null);
			abortRef.current = null;
		}
	};
```

Add `import { toast } from "sonner";` at the top.

- [ ] **Step 5: Add a stop button + pass `isConnected`/`toolStatus` to children**

In the send `Button` area, branch on `isLoading || isStreaming` to show a stop button:

```tsx
					{isLoading || isStreaming ? (
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 rounded-full text-white bg-primary hover:bg-primary/80"
							onClick={() => abortRef.current?.abort()}
						>
							<Square className="h-4 w-4" />
						</Button>
					) : (
						/* existing ArrowUp submit button is handled inside ChatInput; this stop button lives in the route only if the route owns a send button */
						null
					)}
```

Note: the send button lives inside `ChatInput`, not the route. So instead, pass a stop affordance down OR rely on `ChatInput`'s own button. Simplest: add an `onStop` + `isGenerating` prop to `ChatInput` and render the `Square` stop button in place of `ArrowUp` when `isGenerating`. Implement that in `ChatInput` (mirror Task 8 button block):

In `ChatInput`, accept `isGenerating?: boolean; onStop?: () => void;` and render:

```tsx
					{isGenerating ? (
						<Button variant="ghost" size="icon" onClick={onStop}
							className="h-8 w-8 rounded-full text-white bg-primary hover:bg-primary/80">
							<Square className="h-4 w-4" />
						</Button>
					) : (
						<Button variant="ghost" size="icon" disabled={!hasContent || disabled || isSubmitting} onClick={handleSubmit}
							className="h-8 w-8 rounded-full text-white bg-primary hover:bg-primary/80">
							<ArrowUp className="h-4 w-4" />
						</Button>
					)}
```

(Import `Square` from lucide-react in `ChatInput`.)

In the route, pass to the `Message` list and `ChatInput`:

```tsx
						<Message
							key={message.id}
							message={message}
							isLastMessage={index === messages.length - 1}
							isLoading={isLoading}
							isStreaming={isStreaming}
							toolStatus={index === messages.length - 1 ? toolStatus : null}
							onRegenerate={handleRegenerateMessage}
							onEditMessage={handleEditMessage}
							onRegenerateFromMessage={handleRegenerateFromMessage}
						/>
```

```tsx
						<ChatInput
							onSubmit={handleSendMessage}
							placeholder="Continue private conversation..."
							disabled={isLoading}
							isConnected={useConnected}
							isGenerating={isLoading || isStreaming}
							onStop={() => abortRef.current?.abort()}
							assistant={getAssistantOrDefault(chat?.assistantId)}
							autoFocus
						/>
```

- [ ] **Step 6: Typecheck, lint, build, full test suite**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: clean; all unit tests pass.

- [ ] **Step 7: Manual verification against the live gateway**

`pnpm dev`, logged in:
1. "Search the web for today's date" → typing dots → "Searching the web…" status → answer with a Sources block (expand → favicons/links).
2. "Draw a watercolor fox" → "Generating image…" → image renders inline; caption follows.
3. Force **Web search** via `+`, send a normal question → search runs; chip cleared after send.
4. Force **Create image** → image generated.
5. Multi-step ("search X then make an image about it") → both tools run in one turn.
6. Press **Stop** during image gen → generation halts, partial message finalized, input re-enabled.
7. Logged out → no tools offered; the model answers normally (no `tools` sent).
8. Switch to a non-vision model (if any) → uploaded/generated images omitted from requests, no crash.

Note any case where named `tool_choice` is ignored (forced tool not run → toast fires); if the upstream rejects `tool_choice` named function with an error, change the force path to inject a strong system hint instead and re-test.

- [ ] **Step 8: Commit**

```bash
git add src/routes/chat.$chatId.tsx src/components/ChatInput.tsx
git commit -m "feat(chat): agentic tool-calling loop with web search, image gen, and stop control"
```

---

## Self-review notes

- **Spec coverage:** tools/executors (T4), supportsTools (T1), schema+migration+store (T2/T3), 4-image cap + assistant wrapping (T7), streaming accumulator (T6), `+` menu + chip + connect gating (T8), rendering images/sources/status (T9), agentic loop + forcedTool wiring + isLoading discipline + abort/stop + degradation toast (T10). All spec sections map to a task.
- **Runtime risks** (named `tool_choice`, streaming tool_call deltas) are exercised in T10 Step 7 with a documented fallback.
- **Type consistency:** `ToolName` ("web_search"|"generate_image"), `ResolvedToolCall`, `SearchSource`, `ImageData`, `GenerateImageArgs`, `updateMessageArtifacts`, `executeWebSearch`/`executeGenerateImage` signatures are used identically across tasks.
- **Open follow-ups (not in scope):** `/search/fetch`, saving generated images to `/images` gallery, persisting raw tool transcript.
```
