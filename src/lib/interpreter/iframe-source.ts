import { WORKER_SOURCE } from "./worker-source";

// HTML document loaded into the sandboxed iframe via `srcdoc`. The iframe carries
// `sandbox="allow-scripts"` (set by the host) so it runs as an OPAQUE origin: no DOM/storage/
// cookie access to the parent app, no app credentials. This document:
//   1. pins a Content-Security-Policy via <meta http-equiv> that limits network to the single
//      trusted CDN (jsdelivr) the worker loads Pyodide + wheels from. `connect-src`/`script-src`
//      name only jsdelivr (+ 'self'/blob for the worker itself).
//   2. receives a `run` postMessage from the host, builds the worker from a Blob (WORKER_SOURCE),
//      forwards the job, enforces the execution timeout with worker.terminate() on overrun, and
//      posts a structured result back to the host.
//
// We build the iframe document as a STRING (srcdoc) so the worker Blob is created inside the
// opaque origin; a same-origin Worker URL would not be reachable from the sandboxed frame.

/** Origin the sandbox is allowed to fetch Pyodide + wheels from. The CSP locks the sandbox to
 *  exactly this CDN — the network/wheel decision documented in worker-source.ts. */
export const PYODIDE_CDN_ORIGIN = "https://cdn.jsdelivr.net";

/** Pinned Pyodide runtime version. MUST match the `pyodide` npm dependency so the lockfile and
 *  wheels served from the CDN share the same ABI (npm pyodide@0.29.4 -> CDN v0.29.4). */
export const PYODIDE_VERSION = "0.29.4";

/** Pinned full CDN base for the loader + wheels. Trailing slash required by loadPyodide. */
export const PYODIDE_INDEX_URL = `${PYODIDE_CDN_ORIGIN}/pyodide/v${PYODIDE_VERSION}/full/`;

export function buildIframeSource(): string {
	// JSON.stringify keeps the worker source safely embeddable inside a <script> string literal
	// (escapes quotes/newlines/`</script>` sequences won't appear because it is a JS string).
	const workerSourceLiteral = JSON.stringify(WORKER_SOURCE);

	return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob: ${PYODIDE_CDN_ORIGIN}; connect-src ${PYODIDE_CDN_ORIGIN} blob: data:; worker-src blob:; img-src data: blob:; style-src 'unsafe-inline';" />
</head>
<body>
<script>
${"// Runs inside the opaque-origin sandbox. Builds a Blob worker from the injected source string."}
var WORKER_SOURCE = ${workerSourceLiteral};

// A single shared Blob worker lives for the lifetime of the iframe and is reused across runs so
// Pyodide (loaded inside the worker) stays warm — previously each run built a fresh worker and
// terminated it on completion, throwing away Pyodide and forcing a full cold reload (Pyodide
// runtime + numpy/pandas/matplotlib wheels) on EVERY run. The host reuses one iframe across the
// chat, so the worker (and Pyodide) now survives from the first run onward. Only failure paths
// (timeout / worker crash) tear the worker down so a runaway run can't poison the next one.
var sharedWorker = null;
var workerUrl = null;
function getWorker() {
	if (!sharedWorker) {
		var blob = new Blob([WORKER_SOURCE], { type: "application/javascript" });
		workerUrl = URL.createObjectURL(blob);
		sharedWorker = new Worker(workerUrl);
	}
	return sharedWorker;
}
function dropWorker() {
	if (sharedWorker) { try { sharedWorker.terminate(); } catch (e) {} }
	sharedWorker = null;
}

function runJob(req, source) {
	return new Promise(function (resolve) {
		var settled = false;
		var worker;
		var timer;

		// keepWorker — true on normal completion (Pyodide stays warm for the next run), false on
		// failure paths (timeout / worker crash / setup error) so a bad run can't taint the next.
		function finish(result, keepWorker) {
			if (settled) return;
			settled = true;
			if (timer) clearTimeout(timer);
			if (worker && !keepWorker) dropWorker();
			resolve(result);
		}

		var base = { language: req.language, stdout: "", stderr: "", result: null, imagePng: null, error: null, timedOut: false };

		try {
			worker = getWorker();
		} catch (e) {
			finish(Object.assign(base, { error: "Failed to start sandbox worker: " + (e && e.message ? e.message : String(e)) }), false);
			return;
		}

		// Hard timeout: terminate the worker (kills infinite loops / runaway Pyodide work).
		timer = setTimeout(function () {
			finish(Object.assign(base, { error: "Execution timed out after " + req.timeoutMs + " ms.", timedOut: true }), false);
		}, req.timeoutMs);

		worker.onmessage = function (ev) {
			var d = ev.data || {};
			// Intermediate progress (cold load / streaming stdout): forward to the host without
			// resolving the job so the interpreter card can render live instead of stalling blank.
			if (d.type === "progress") {
				var pmsg = { type: "progress", id: d.id, phase: d.phase, stdout: d.stdout || "", stderr: d.stderr || "" };
				if (source && source.postMessage) {
					source.postMessage(pmsg, "*");
				} else if (window.parent) {
					window.parent.postMessage(pmsg, "*");
				}
				return;
			}
			var p = d.partial || {};
			// Success (ok true) keeps the worker warm; a worker-reported error tears it down so the
			// next run starts fresh rather than reusing a half-broken Pyodide instance.
			finish({
				language: req.language,
				stdout: p.stdout || "",
				stderr: p.stderr || "",
				result: p.result != null ? p.result : null,
				imagePng: p.imagePng || null,
				files: Array.isArray(p.files) ? p.files : [],
				error: d.ok ? null : (d.error || "Unknown sandbox error."),
				timedOut: false,
			}, !!d.ok);
		};

		// Worker crash (e.g. Pyodide load failure throwing at top level).
		worker.onerror = function (ev) {
			finish(Object.assign(base, { error: "Sandbox worker crashed: " + (ev && ev.message ? ev.message : "unknown error") }), false);
		};

		worker.postMessage({ id: req.id, language: req.language, code: req.code, pyodideIndexUrl: req.pyodideIndexUrl });
	});
}

window.addEventListener("message", function (event) {
	var msg = event.data;
	if (!msg || msg.type !== "run") return;
	var source = event.source;
	runJob(msg, source).then(function (result) {
		// Reply to the exact host window that asked (opaque-origin -> target "*").
		if (source && source.postMessage) {
			source.postMessage({ type: "result", id: msg.id, result: result }, "*");
		} else if (window.parent) {
			window.parent.postMessage({ type: "result", id: msg.id, result: result }, "*");
		}
	});
});

${"// Tell the host the sandbox document is ready to accept jobs."}
if (window.parent) window.parent.postMessage({ type: "sandbox-ready" }, "*");
</script>
</body>
</html>`;
}
