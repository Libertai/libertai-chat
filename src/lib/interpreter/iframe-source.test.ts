import { describe, expect, it } from "vitest";
import {
	buildIframeSource,
	PYODIDE_CDN_ORIGIN,
	PYODIDE_INDEX_URL,
	PYODIDE_VERSION,
} from "@/lib/interpreter/iframe-source";
import { WORKER_SOURCE } from "@/lib/interpreter/worker-source";

// The sandbox is the privacy/security boundary. These pure-string assertions guard the two
// load-bearing decisions: (1) the CSP locks network to the single pinned CDN, and (2) the pinned
// CDN version matches the `pyodide` npm dependency (same ABI -> wheels load).

describe("PYODIDE_INDEX_URL", () => {
	it("is a pinned full jsdelivr path matching the npm pyodide version (0.29.4)", () => {
		expect(PYODIDE_VERSION).toBe("0.29.4");
		expect(PYODIDE_CDN_ORIGIN).toBe("https://cdn.jsdelivr.net");
		expect(PYODIDE_INDEX_URL).toBe("https://cdn.jsdelivr.net/pyodide/v0.29.4/full/");
		// loadPyodide requires a trailing slash on indexURL.
		expect(PYODIDE_INDEX_URL.endsWith("/")).toBe(true);
	});
});

describe("buildIframeSource", () => {
	const html = buildIframeSource();

	it("pins a CSP that limits network to exactly the trusted CDN", () => {
		expect(html).toContain('http-equiv="Content-Security-Policy"');
		expect(html).toContain("default-src 'none'");
		// connect-src (where the worker fetches Pyodide + wheels) is the CDN only — no wildcard.
		expect(html).toMatch(/connect-src https:\/\/cdn\.jsdelivr\.net/);
		expect(html).not.toContain("connect-src *");
	});

	it("builds the worker from an inline Blob (no same-origin worker URL needed)", () => {
		expect(html).toContain("new Blob([WORKER_SOURCE]");
		expect(html).toContain("new Worker(url)");
	});

	it("enforces an execution timeout by terminating the worker", () => {
		expect(html).toContain("worker.terminate()");
		expect(html).toContain("setTimeout");
		expect(html).toContain("timedOut: true");
	});

	it("announces readiness and replies with a typed result", () => {
		expect(html).toContain('type: "sandbox-ready"');
		expect(html).toContain('type: "result"');
	});

	it("embeds the worker source as a safely-escaped string literal", () => {
		// JSON.stringify(WORKER_SOURCE) must appear verbatim so the worker code is delivered intact.
		expect(html).toContain(JSON.stringify(WORKER_SOURCE));
	});
});

describe("WORKER_SOURCE", () => {
	it("loads Pyodide and captures stdout/stderr", () => {
		expect(WORKER_SOURCE).toContain("loadPyodide");
		expect(WORKER_SOURCE).toContain("setStdout");
		expect(WORKER_SOURCE).toContain("setStderr");
	});

	it("auto-loads imported packages and captures a matplotlib PNG", () => {
		expect(WORKER_SOURCE).toContain("loadPackagesFromImports");
		expect(WORKER_SOURCE).toContain("savefig");
		expect(WORKER_SOURCE).toContain("base64");
	});

	it("captures JS console output and the returned value", () => {
		expect(WORKER_SOURCE).toContain("sandboxConsole");
		expect(WORKER_SOURCE).toContain("out.result");
	});
});
