import { buildIframeSource, PYODIDE_INDEX_URL } from "./iframe-source";
import type { InterpreterLanguage, InterpreterResult } from "./types";

// Host-side entry point for the client-side code interpreter. EXPORTED so it can be unit/e2e
// tested directly (driven without the model). Everything runs client-side:
//   host page  --postMessage-->  sandboxed iframe (opaque origin, CSP-locked)  -->  Web Worker
// and the structured InterpreterResult comes back the same way. A failing/timed-out/crashed run
// always RESOLVES with an InterpreterResult whose `error` is set — it never throws or crashes the
// app (so it can become a `tool` message the model reads).

export type { InterpreterLanguage, InterpreterResult } from "./types";
export { PYODIDE_INDEX_URL, PYODIDE_VERSION, PYODIDE_CDN_ORIGIN } from "./iframe-source";

/** Default execution budget. Pyodide's first load is slow, but actual code execution after load
 *  should be quick; the host gives a generous default so cold Pyodide starts aren't false timeouts.
 *  Callers (tests) can shrink this to assert the infinite-loop kill path. */
export const DEFAULT_TIMEOUT_MS = 120_000;

export interface RunOptions {
	timeoutMs?: number;
	/** Override the CDN base (tests/self-host). Defaults to the pinned jsdelivr version. */
	pyodideIndexUrl?: string;
	signal?: AbortSignal;
}

interface Sandbox {
	iframe: HTMLIFrameElement;
	ready: Promise<void>;
}

let shared: Sandbox | null = null;

// Create the sandboxed iframe once and reuse it so Pyodide (loaded inside the worker) is warm
// across runs in the same page. The iframe is `sandbox="allow-scripts"` ONLY — no
// allow-same-origin — so it is an opaque origin with no access to the parent app, storage, or
// cookies. CSP inside the srcdoc locks network to the pinned CDN.
function getSandbox(): Sandbox {
	if (shared && document.body.contains(shared.iframe)) return shared;

	const iframe = document.createElement("iframe");
	iframe.setAttribute("sandbox", "allow-scripts");
	iframe.setAttribute("aria-hidden", "true");
	iframe.title = "code-interpreter-sandbox";
	iframe.style.cssText = "position:absolute;width:0;height:0;border:0;left:-9999px;top:-9999px;";

	const ready = new Promise<void>((resolve) => {
		const onMessage = (event: MessageEvent) => {
			if (event.source === iframe.contentWindow && event.data?.type === "sandbox-ready") {
				window.removeEventListener("message", onMessage);
				resolve();
			}
		};
		window.addEventListener("message", onMessage);
	});

	iframe.srcdoc = buildIframeSource();
	document.body.appendChild(iframe);

	shared = { iframe, ready };
	return shared;
}

/** Tear down the shared sandbox (used by tests; also lets the app reclaim the Pyodide worker). */
export function disposeInterpreter(): void {
	if (shared) {
		try {
			shared.iframe.remove();
		} catch {
			/* already detached */
		}
		shared = null;
	}
}

function errorResult(language: InterpreterLanguage, error: string, timedOut = false): InterpreterResult {
	return { language, stdout: "", stderr: "", result: null, imagePng: null, error, timedOut };
}

/**
 * Run a code snippet in the sandbox and resolve with a structured result. Python runs via Pyodide
 * (numpy/pandas/matplotlib auto-loaded, matplotlib figures captured as a base64 PNG); JavaScript
 * runs in the worker with console + return-value capture. The execution timeout is enforced inside
 * the sandbox by terminating the worker, so infinite loops and runaway work are killed.
 */
export async function runCode(
	language: InterpreterLanguage,
	code: string,
	options: RunOptions = {},
): Promise<InterpreterResult> {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return errorResult(language, "Code interpreter is only available in a browser context.");
	}

	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const pyodideIndexUrl = options.pyodideIndexUrl ?? PYODIDE_INDEX_URL;
	const id = crypto.randomUUID();

	let sandbox: Sandbox;
	try {
		sandbox = getSandbox();
		await sandbox.ready;
	} catch (e) {
		return errorResult(language, `Failed to initialise sandbox: ${e instanceof Error ? e.message : String(e)}`);
	}

	return new Promise<InterpreterResult>((resolve) => {
		let settled = false;
		// Host-side watchdog: a slightly longer backstop in case the sandbox itself becomes
		// unresponsive (the in-sandbox timeout is the primary kill switch).
		const watchdog = window.setTimeout(() => {
			cleanup();
			resolve(errorResult(language, `Execution timed out after ${timeoutMs} ms.`, true));
		}, timeoutMs + 2_000);

		const onMessage = (event: MessageEvent) => {
			if (event.source !== sandbox.iframe.contentWindow) return;
			const data = event.data;
			if (!data || data.type !== "result" || data.id !== id) return;
			cleanup();
			resolve(data.result as InterpreterResult);
		};

		const onAbort = () => {
			cleanup();
			// Drop the shared sandbox so the (possibly mid-run) worker is torn down.
			disposeInterpreter();
			resolve(errorResult(language, "Execution aborted.", false));
		};

		function cleanup() {
			if (settled) return;
			settled = true;
			window.clearTimeout(watchdog);
			window.removeEventListener("message", onMessage);
			options.signal?.removeEventListener("abort", onAbort);
		}

		if (options.signal?.aborted) {
			onAbort();
			return;
		}
		options.signal?.addEventListener("abort", onAbort);
		window.addEventListener("message", onMessage);

		sandbox.iframe.contentWindow?.postMessage(
			{ type: "run", id, language, code, timeoutMs, pyodideIndexUrl },
			"*",
		);
	});
}
