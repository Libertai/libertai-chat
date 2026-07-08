import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyResponseReady } from "./background-notify";

// Minimal document stand-in for the node test environment.
function makeDocument(hidden: boolean) {
	const listeners = new Map<string, Set<() => void>>();
	const doc = {
		hidden,
		visibilityState: hidden ? "hidden" : "visible",
		title: "LibertAI",
		addEventListener: (type: string, fn: () => void) => {
			if (!listeners.has(type)) listeners.set(type, new Set());
			listeners.get(type)!.add(fn);
		},
		removeEventListener: (type: string, fn: () => void) => {
			listeners.get(type)?.delete(fn);
		},
		show() {
			doc.hidden = false;
			doc.visibilityState = "visible";
			for (const fn of [...(listeners.get("visibilitychange") ?? [])]) fn();
		},
		listenerCount: (type: string) => listeners.get(type)?.size ?? 0,
	};
	return doc;
}

describe("notifyResponseReady", () => {
	let doc: ReturnType<typeof makeDocument>;

	beforeEach(() => {
		doc = makeDocument(true);
		vi.stubGlobal("document", doc);
	});

	afterEach(() => {
		// Restore module state by simulating a return to the tab.
		if (doc.hidden !== false) doc.show();
		vi.unstubAllGlobals();
	});

	it("flags the title while hidden and restores it on return", () => {
		notifyResponseReady();
		expect(doc.title).toBe("✓ LibertAI");
		doc.show();
		expect(doc.title).toBe("LibertAI");
		expect(doc.listenerCount("visibilitychange")).toBe(0);
	});

	it("does not stack flags across multiple completions", () => {
		notifyResponseReady();
		notifyResponseReady();
		expect(doc.title).toBe("✓ LibertAI");
		doc.show();
		expect(doc.title).toBe("LibertAI");
	});

	it("does nothing when the tab is visible", () => {
		doc.show();
		notifyResponseReady();
		expect(doc.title).toBe("LibertAI");
		expect(doc.listenerCount("visibilitychange")).toBe(0);
	});
});
