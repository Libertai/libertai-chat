import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageValue } from "zustand/middleware";
import { createDebouncedPersistStorage } from "./debounced-persist-storage";

// Minimal localStorage stand-in for the node test environment.
function makeLocalStorage() {
	const data = new Map<string, string>();
	return {
		getItem: (k: string) => data.get(k) ?? null,
		setItem: vi.fn((k: string, v: string) => {
			data.set(k, v);
		}),
		removeItem: (k: string) => {
			data.delete(k);
		},
		data,
	};
}

const value = (n: number): StorageValue<{ n: number }> => ({ state: { n }, version: 1 });

describe("createDebouncedPersistStorage", () => {
	let ls: ReturnType<typeof makeLocalStorage>;

	beforeEach(() => {
		vi.useFakeTimers();
		ls = makeLocalStorage();
		vi.stubGlobal("localStorage", ls);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("coalesces rapid writes into one serialized write after the delay", () => {
		const storage = createDebouncedPersistStorage<{ n: number }>(1000);

		for (let i = 0; i < 50; i++) storage.setItem("key", value(i));
		expect(ls.setItem).not.toHaveBeenCalled(); // nothing written synchronously

		vi.advanceTimersByTime(1000);
		expect(ls.setItem).toHaveBeenCalledTimes(1); // one write, latest state only
		expect(JSON.parse(ls.data.get("key")!)).toEqual(value(49));
	});

	it("serves the pending (unflushed) value from getItem", () => {
		const storage = createDebouncedPersistStorage<{ n: number }>(1000);
		storage.setItem("key", value(7));
		expect(storage.getItem("key")).toEqual(value(7));
	});

	it("reads existing localStorage state synchronously (hydration path)", () => {
		ls.data.set("key", JSON.stringify(value(3)));
		const storage = createDebouncedPersistStorage<{ n: number }>(1000);
		expect(storage.getItem("key")).toEqual(value(3));
		expect(storage.getItem("missing")).toBeNull();
	});

	it("survives a quota error without throwing into the caller", () => {
		const storage = createDebouncedPersistStorage<{ n: number }>(1000);
		ls.setItem.mockImplementationOnce(() => {
			throw new DOMException("quota", "QuotaExceededError");
		});
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

		storage.setItem("key", value(1));
		expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
		expect(consoleError).toHaveBeenCalled();

		// A later write still goes through.
		storage.setItem("key", value(2));
		vi.advanceTimersByTime(1000);
		expect(JSON.parse(ls.data.get("key")!)).toEqual(value(2));
		consoleError.mockRestore();
	});

	it("removeItem drops both the pending value and the stored one", () => {
		ls.data.set("key", JSON.stringify(value(1)));
		const storage = createDebouncedPersistStorage<{ n: number }>(1000);
		storage.setItem("key", value(2));
		storage.removeItem("key");
		expect(storage.getItem("key")).toBeNull();
		vi.advanceTimersByTime(1000);
		expect(ls.data.has("key")).toBe(false);
	});
});
