// Shared types for the client-side code interpreter (Pyodide + JS sandbox).
//
// The whole interpreter runs client-side only: code executes inside a sandboxed iframe -> Web
// Worker, never on a server (privacy posture). These types describe the postMessage protocol
// between the host page and the sandbox, plus the structured result rendered in the chat.

export type InterpreterLanguage = "python" | "javascript";

/** A file the executed code wrote to the sandbox filesystem (PDF/CSV/image/text/...) and the host
 *  delivers to the user as a download. Pyodide's FS is in-memory and dies with the worker, so the
 *  bytes are base64-embedded here (same privacy posture as the inline matplotlib PNG). */
export interface InterpreterFile {
	name: string;
	mime: string;
	base64: string;
	size: number;
}

/** Structured outcome of a single code run. Always returned, never thrown, so a failing run
 *  becomes a tool result the model can read instead of crashing the app. */
export interface InterpreterResult {
	language: InterpreterLanguage;
	/** Captured stdout (Python print / JS console.log). */
	stdout: string;
	/** Captured stderr (Python tracebacks routed to stderr / JS console.error|warn). */
	stderr: string;
	/** Repr of the last expression value (Python) or the returned value (JS), if any. */
	result: string | null;
	/** A matplotlib figure captured as a base64 PNG data URL, if the run produced one. */
	imagePng: string | null;
	/** Files the code wrote to the sandbox filesystem, harvested and delivered to the user. */
	files: InterpreterFile[];
	/** A fatal error message (load failure, syntax error, timeout, crash). null on success. */
	error: string | null;
	/** True when the run was killed by the execution timeout (worker.terminate()). */
	timedOut: boolean;
}

/** Request the host posts into the sandbox iframe. */
export interface SandboxRequest {
	type: "run";
	id: string;
	language: InterpreterLanguage;
	code: string;
	/** Hard execution budget in ms; on overrun the iframe terminates the worker. */
	timeoutMs: number;
	/** Pinned CDN base the worker loads Pyodide + wheels from (CSP-allowed origin). */
	pyodideIndexUrl: string;
}

/** Response the sandbox iframe posts back to the host. */
export interface SandboxResponse {
	type: "result";
	id: string;
	result: InterpreterResult;
}

/** Intermediate progress event the sandbox forwards while a run is in flight. `phase` is
 *  "preparing" (Pyodide runtime + packages downloading) or "running" (user code executing, with
 *  stdout/stderr accumulated so far). Lets the host render live output instead of stalling blank
 *  through a long cold load. */
export interface SandboxProgress {
	type: "progress";
	id: string;
	phase: "preparing" | "running";
	stdout: string;
	stderr: string;
}
