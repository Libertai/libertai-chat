import { describe, expect, it } from "vitest";
import { buildRequestMessages } from "@/utils/build-request-messages";
import type { Message } from "@/types/chats";
import type { Model } from "@/hooks/data/use-models";

const img = (n: string) => ({ data: `data:image/png;base64,${n}`, mimeType: "image/png", filename: `${n}.png` });
const visionModels = [
	{ id: "m", name: "m", capabilities: { text: { vision: true, function_calling: true } } },
] as unknown as Model[];
const noVisionModels = [
	{ id: "m", name: "m", capabilities: { text: { vision: false, function_calling: true } } },
] as unknown as Model[];

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
