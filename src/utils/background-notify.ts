// Flag a finished response in the tab title when the user is looking at another tab, and
// restore the original title the moment they come back. Long thinking-model responses take
// minutes, so users routinely tab away mid-generation — without a signal they have no way to
// know the answer landed.

let restorePending = false;

export function notifyResponseReady(): void {
	if (typeof document === "undefined" || !document.hidden || restorePending) return;

	const original = document.title;
	document.title = `✓ ${original}`;
	restorePending = true;

	const restore = () => {
		if (document.visibilityState !== "visible") return;
		document.title = original;
		document.removeEventListener("visibilitychange", restore);
		restorePending = false;
	};
	document.addEventListener("visibilitychange", restore);
}
