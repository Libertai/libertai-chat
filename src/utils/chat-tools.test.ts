import { describe, expect, it, vi, afterEach } from "vitest";
import type OpenAI from "openai";
import {
	formatSearchResults,
	executeWebSearch,
	executeGenerateImage,
	TOOL_DEFINITIONS,
	SEARCH_TYPES,
	DEFAULT_SEARCH_TYPE,
} from "@/utils/chat-tools";
import type { SearchType } from "@/utils/chat-tools";

const OPTS = { connectedApiUrl: "https://api.libertai.io", chatApiKey: "sk-chat-1" };

afterEach(() => vi.restoreAllMocks());

describe("TOOL_DEFINITIONS", () => {
	it("declares web_search and generate_image functions", () => {
		const names = TOOL_DEFINITIONS.filter(
			(t): t is OpenAI.Chat.Completions.ChatCompletionFunctionTool => t.type === "function",
		)
			.map((t) => t.function.name)
			.sort();
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
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({ Authorization: "Bearer sk-chat-1" }),
			}),
		);
		const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
		expect(body).toMatchObject({ query: "rust", max_results: 5, search_type: "web" });
		expect(body.engines).toEqual(["google", "bing", "duckduckgo"]);
		expect(out.sources[0].title).toBe("A");
	});

	it("defaults search_type to 'web' when none is supplied", () => {
		expect(DEFAULT_SEARCH_TYPE).toBe("web");
	});

	it("exposes exactly the backend-supported search modes", () => {
		expect([...SEARCH_TYPES].sort()).toEqual(["academic", "images", "news", "web"]);
	});

	it.each<SearchType>(["web", "news", "academic", "images"])(
		"passes the chosen search_type=%s through to the request body",
		async (searchType) => {
			const fetchMock = vi
				.spyOn(global, "fetch")
				.mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));

			await executeWebSearch("rust", { ...OPTS, searchType });

			const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
			expect(body.search_type).toBe(searchType);
		},
	);

	it("returns an error toolText (no throw) on HTTP failure", async () => {
		vi.spyOn(global, "fetch").mockResolvedValue(new Response("boom", { status: 500 }));
		const out = await executeWebSearch("rust", OPTS);
		expect(out.sources).toEqual([]);
		expect(out.toolText.toLowerCase()).toContain("search failed");
	});
});

describe("executeGenerateImage", () => {
	it("POSTs to /sdapi/v1/txt2img and returns an ImageData", async () => {
		const fetchMock = vi
			.spyOn(global, "fetch")
			.mockResolvedValue(
				new Response(JSON.stringify({ images: ["BASE64DATA"], parameters: { seed: 1 } }), { status: 200 }),
			);
		const out = await executeGenerateImage({ prompt: "a cat" }, OPTS);

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.libertai.io/sdapi/v1/txt2img",
			expect.objectContaining({ method: "POST" }),
		);
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
