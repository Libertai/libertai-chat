import type { PersistStorage, StorageValue } from "zustand/middleware";

// Write-behind localStorage adapter for zustand's persist middleware.
//
// The default persist storage serializes the WHOLE store and synchronously writes it to
// localStorage on every set(). For the chat store that meant: during streaming, every throttled
// token flush (~20/s) paid a JSON.stringify of every conversation ever had — an O(total history)
// main-thread block that grew with the chat and starved both rendering and the SSE read loop
// (very slow / lumpy streaming on long thinking-model conversations). A localStorage quota error
// also threw inside set(), breaking the stream mid-response.
//
// This adapter keeps hydration synchronous (getItem reads localStorage directly, so app startup
// and the e2e localStorage seeding are unchanged) but defers writes: setItem only records the
// latest state and schedules ONE serialize+write per `delayMs`, off the set() call path. Quota
// errors surface as a console error instead of breaking the caller. The pending state is flushed
// synchronously on pagehide / tab-hidden, so at most ~`delayMs` of the newest messages is at risk
// on a hard kill.
export function createDebouncedPersistStorage<S>(delayMs: number): PersistStorage<S> {
	const pending = new Map<string, StorageValue<S>>();
	let timer: ReturnType<typeof setTimeout> | null = null;

	// Absent outside the browser (node unit tests); every operation degrades to a no-op then.
	const store = typeof localStorage !== "undefined" ? localStorage : undefined;

	const flush = () => {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
		for (const [name, value] of pending) {
			try {
				store?.setItem(name, JSON.stringify(value));
			} catch (error) {
				// Quota exceeded (or storage unavailable): keep the app running on in-memory state.
				console.error(`Failed to persist "${name}":`, error);
			}
		}
		pending.clear();
	};

	if (typeof window !== "undefined") {
		// pagehide fires on reload/close/navigation; the synchronous localStorage write completes
		// before the document is torn down. visibilitychange covers mobile tab backgrounding.
		// These listeners are never removed: this factory is called exactly once, at store
		// definition (module scope), and the adapter lives for the page's lifetime.
		window.addEventListener("pagehide", flush);
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") flush();
		});
	}

	return {
		getItem: (name) => {
			// Read-your-writes: a scheduled-but-unflushed value is the freshest state.
			const scheduled = pending.get(name);
			if (scheduled !== undefined) return scheduled;
			const stored = store?.getItem(name) ?? null;
			return stored === null ? null : (JSON.parse(stored) as StorageValue<S>);
		},
		setItem: (name, value) => {
			// Zustand state is immutable, so holding the reference until the flush is safe.
			pending.set(name, value);
			if (timer === null) timer = setTimeout(flush, delayMs);
		},
		removeItem: (name) => {
			pending.delete(name);
			store?.removeItem(name);
		},
	};
}
