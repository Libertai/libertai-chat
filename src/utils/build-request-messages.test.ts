import { describe, expect, it } from "vitest";
import { buildRequestMessages, attachmentsBlock } from "@/utils/build-request-messages";
import type { Message, FileAttachment } from "@/types/chats";
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

	it("folds file attachments into the user message as a labelled text block (non-vision model)", () => {
		const attachments: FileAttachment[] = [
			{ filename: "data.csv", kind: "csv", mimeType: "text/csv", content: "a\tb\n1\t2", truncated: false },
		];
		const out = buildRequestMessages(
			[msg({ role: "user", content: "summarize this", attachments })],
			"m",
			noVisionModels,
		);
		const content = out[0].content as string;
		expect(content).toContain("summarize this");
		expect(content).toContain("Attached file: data.csv (csv)");
		expect(content).toContain("a\tb\n1\t2");
		expect(content).toContain("End of file");
	});

	it("folds attachments into the text block alongside images on vision models", () => {
		const attachments: FileAttachment[] = [
			{ filename: "report.pdf", kind: "pdf", mimeType: "application/pdf", content: "PDF body", truncated: true },
		];
		const out = buildRequestMessages(
			[msg({ role: "user", content: "see file", images: [img("a")], attachments })],
			"m",
			visionModels,
		);
		const content = out[0].content as Array<{ type: string; text?: string }>;
		const textPart = content.find((c) => c.type === "text")!;
		expect(textPart.text).toContain("see file");
		expect(textPart.text).toContain("Attached file: report.pdf (pdf (truncated))");
		expect(content.some((c) => c.type === "image_url")).toBe(true);
	});
});

describe("attachmentsBlock", () => {
	it("returns empty string when there are no attachments", () => {
		expect(attachmentsBlock(undefined)).toBe("");
		expect(attachmentsBlock([])).toBe("");
	});

	it("labels each attached file with its name and kind", () => {
		const block = attachmentsBlock([
			{ filename: "a.txt", kind: "text", mimeType: "text/plain", content: "hello", truncated: false },
			{ filename: "b.csv", kind: "csv", mimeType: "text/csv", content: "x\ty", truncated: true },
		]);
		expect(block).toContain("Attached file: a.txt (text)");
		expect(block).toContain("hello");
		expect(block).toContain("Attached file: b.csv (csv (truncated))");
		expect(block).toContain("x\ty");
	});
});
