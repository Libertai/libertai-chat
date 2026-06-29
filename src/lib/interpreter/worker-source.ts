// Source of the Web Worker that executes user/model code. It is shipped as a STRING and turned
// into a Blob inside the sandboxed iframe (the iframe has an opaque origin, so a same-origin
// worker URL would be unavailable). Keeping it as a template string also lets us inject the
// pinned Pyodide CDN base without bundling Pyodide itself into the worker.
//
// NETWORK / WHEEL DECISION: the iframe `sandbox="allow-scripts"` does NOT block network, and
// micropip/loadPackage needs wheels. We pin loading to a single trusted CDN (jsdelivr) via the
// iframe CSP `connect-src`/`script-src` (see iframe-source.ts) and load Pyodide + the pandas/
// numpy/matplotlib wheels from a pinned jsdelivr version. We do NOT self-host wheels (the full
// scientific stack is tens of MB); the CSP makes jsdelivr the ONLY origin the sandbox can reach.

// The worker receives a single { language, code, pyodideIndexUrl } message and posts back a
// structured InterpreterResult. It never imports app code — it is a standalone classic worker.
export const WORKER_SOURCE = String.raw`
let pyodideReadyPromise = null;

// The id of the job currently running in this worker. Set in onmessage; used by postProgress so
// the host can correlate progress events with the run it started.
let currentId = null;

// Post an intermediate progress event to the host so a long run (cold Pyodide load + package
// install + slow code) shows live instead of a silent multi-minute wait. 'phase' is "preparing"
// (downloading the runtime + wheels) or "running" (user code executing, stdout streaming).
function postProgress(phase, out) {
	if (!currentId) return;
	self.postMessage({ id: currentId, type: "progress", phase: phase, stdout: out.stdout || "", stderr: out.stderr || "" });
}

// Load Pyodide once per worker, from the pinned CDN base. importScripts is allowed by the iframe
// CSP script-src for the jsdelivr origin. Returns the Pyodide instance.
function loadPyodideOnce(indexUrl) {
	if (pyodideReadyPromise) return pyodideReadyPromise;
	pyodideReadyPromise = (async () => {
		postProgress("preparing", { stdout: "", stderr: "" });
		importScripts(indexUrl + "pyodide.js");
		// eslint-disable-next-line no-undef
		const pyodide = await loadPyodide({ indexURL: indexUrl });
		return pyodide;
	})();
	return pyodideReadyPromise;
}

async function runPython(code, indexUrl) {
	const out = { stdout: "", stderr: "", result: null, imagePng: null, files: [] };

	// Scratch dirs we scan for files the user's code wrote. /tmp is Pyodide's default writable dir;
	// we add /output and /home/web_user as common targets. We snapshot before the run and diff after
	// so only files the code created are delivered (not pre-existing runtime files).
	const SCRATCH_DIRS = ["/tmp", "/output", "/home/web_user", "/home/pyodide"];
	// Caps are bounded by localStorage: files (base64) are persisted with the chat, so a huge PDF
	// would blow the ~5 MB quota. 2 MB/file and 5 MB total covers typical charts/PDFs while keeping
	// persistence safe; larger writes are skipped with a stderr note.
	const MAX_FILE_BYTES = 2 * 1024 * 1024;
	const MAX_TOTAL_BYTES = 5 * 1024 * 1024;
	const MIME_BY_EXT = {
		pdf: "application/pdf", csv: "text/csv", tsv: "text/tab-separated-values",
		png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
		svg: "image/svg+xml", webp: "image/webp", bmp: "image/bmp",
		txt: "text/plain", log: "text/plain", md: "text/markdown",
		json: "application/json", xml: "application/xml", html: "text/html", htm: "text/html",
		zip: "application/zip", gz: "application/gzip", tar: "application/x-tar",
		xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		xls: "application/vnd.ms-excel",
	};
	function extOf(name) {
		var i = String(name).lastIndexOf(".");
		return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
	}
	function guessMime(name) {
		return MIME_BY_EXT[extOf(name)] || "application/octet-stream";
	}
	// Snapshot the files present in each scratch dir (path -> mtime/size) before the run.
	function snapshotFSSet() {
		var seen = {};
		for (var d = 0; d < SCRATCH_DIRS.length; d++) {
			var dir = SCRATCH_DIRS[d];
			try {
				var entries = pyodide.FS.readdir(dir);
				for (var e = 0; e < entries.length; e++) {
					var name = entries[e];
					if (name === "." || name === "..") continue;
					var p = dir + (dir.endsWith("/") ? "" : "/") + name;
					try {
						var st = pyodide.FS.stat(p);
						if (pyodide.FS.isDir(st.mode)) continue;
						seen[p] = (st.mtime || 0) + ":" + (st.size || 0);
					} catch (_e) { /* skip */ }
				}
			} catch (_e) { /* dir missing */ }
		}
		return seen;
	}

	const pyodide = await loadPyodideOnce(indexUrl);

	// Capture stdout/stderr into JS-side buffers (batched, not line-buffered, so partial prints
	// and tracebacks are preserved verbatim). Forward each batch as a progress event so live output
	// streams into the interpreter card instead of appearing only at the end.
	pyodide.setStdout({ batched: (s) => { out.stdout += s + "\n"; postProgress("running", out); } });
	pyodide.setStderr({ batched: (s) => { out.stderr += s + "\n"; postProgress("running", out); } });

	// Auto-install any packages the snippet imports (numpy/pandas/matplotlib + their deps) from
	// the same pinned CDN. loadPackagesFromImports resolves the import graph against the lockfile.
	try {
		postProgress("preparing", out);
		await pyodide.loadPackagesFromImports(code);
	} catch (e) {
		// Non-fatal: a missing optional import shouldn't abort; the run below will surface the real
		// ImportError in the traceback if the package was actually required.
		out.stderr += "package load warning: " + (e && e.message ? e.message : String(e)) + "\n";
	}

	// Configure matplotlib to a headless backend BEFORE user code imports pyplot, so figures are
	// captured to an in-memory PNG instead of trying to open a GUI (which fails in a worker).
	const hasMatplotlib = /matplotlib|pyplot|\bplt\b/.test(code);
	if (hasMatplotlib) {
		try {
			await pyodide.runPythonAsync("import matplotlib\nmatplotlib.use('AGG')");
		} catch (_e) { /* matplotlib not present; ignore */ }
	}

	// Run the snippet and capture the last expression value (like a REPL). Pyodide returns the
	// value of the trailing expression; we render it with Python repr() for a faithful string,
	// then free any PyProxy to avoid leaking across runs.
	const fsBefore = snapshotFSSet();
	let resultRepr = null;
	try {
		const value = await pyodide.runPythonAsync(code);
		if (value !== undefined && value !== null) {
			try {
				const reprFn = pyodide.globals.get("repr");
				resultRepr = reprFn(value);
				if (reprFn && typeof reprFn.destroy === "function") reprFn.destroy();
			} catch (_e) {
				resultRepr = String(value);
			}
			if (value && typeof value.destroy === "function") {
				try { value.destroy(); } catch (_e) { /* already freed */ }
			}
		}
	} catch (e) {
		// Python exception -> traceback string on stderr; not a fatal worker error.
		out.stderr += (e && e.message ? e.message : String(e)) + "\n";
	}
	out.result = resultRepr;

	// Capture any open matplotlib figure as a base64 PNG.
	if (hasMatplotlib) {
		try {
			const png = await pyodide.runPythonAsync(
				"import io, base64\n" +
				"import matplotlib.pyplot as _plt\n" +
				"_figs = [n for n in _plt.get_fignums()]\n" +
				"_b64 = ''\n" +
				"if _figs:\n" +
				"    _buf = io.BytesIO()\n" +
				"    _plt.savefig(_buf, format='png', bbox_inches='tight')\n" +
				"    _buf.seek(0)\n" +
				"    _b64 = base64.b64encode(_buf.read()).decode('ascii')\n" +
				"    _plt.close('all')\n" +
				"_b64"
			);
			if (png) out.imagePng = "data:image/png;base64," + png;
		} catch (e) {
			out.stderr += "figure capture failed: " + (e && e.message ? e.message : String(e)) + "\n";
		}
	}

	// Harvest files the user's code wrote to the scratch dirs (PDF/CSV/images/text/...). Pyodide's
	// filesystem is in-memory and dies with the worker, so without this the file is trapped and the
	// model would falsely report a local path the user can't open. We diff the post-run tree against
	// the pre-run snapshot and deliver each new/changed file as base64 so the host can build a download.
	try {
		const fsAfter = snapshotFSSet();
		let total = 0;
		for (const path of Object.keys(fsAfter)) {
			if (fsBefore[path] === fsAfter[path]) continue; // unchanged or pre-existing
			let name = path.split("/").pop() || "file";
			let size = 0;
			try {
				const st = pyodide.FS.stat(path);
				size = st.size || 0;
			} catch (_e) { continue; }
			if (size > MAX_FILE_BYTES) {
				out.stderr += "skipped large file " + name + " (" + size + " bytes > " + MAX_FILE_BYTES + " cap)\n";
				continue;
			}
			if (total + size > MAX_TOTAL_BYTES) {
				out.stderr += "skipped " + name + " (total delivered would exceed " + MAX_TOTAL_BYTES + " cap)\n";
				continue;
			}
			try {
				const b64 = pyodide.FS.readFile(path, { encoding: "base64" });
				if (b64) {
					out.files.push({ name: name, mime: guessMime(name), base64: String(b64), size: size });
					total += size;
				}
			} catch (e) {
				out.stderr += "failed to read " + name + ": " + (e && e.message ? e.message : String(e)) + "\n";
			}
		}
	} catch (e) {
		out.stderr += "file harvest failed: " + (e && e.message ? e.message : String(e)) + "\n";
	}

	return out;
}

function runJavaScript(code) {
	const out = { stdout: "", stderr: "", result: null, imagePng: null, files: [] };
	const log = (...args) => { out.stdout += args.map(stringify).join(" ") + "\n"; };
	const err = (...args) => { out.stderr += args.map(stringify).join(" ") + "\n"; };
	const sandboxConsole = { log, info: log, debug: log, warn: err, error: err };

	function stringify(v) {
		if (typeof v === "string") return v;
		try { return JSON.stringify(v); } catch (_e) { return String(v); }
	}

	try {
		// Run inside a function with a shadowed console; support both an explicit "return" and a
		// trailing bare expression by wrapping in an async IIFE-style evaluator.
		//
		// SECURITY: new Function() here is intentional and is the whole point of a code interpreter
		// — executing model/user-supplied JS. It is safe ONLY because it runs inside the sandboxed
		// iframe (sandbox="allow-scripts", no allow-same-origin -> opaque origin) -> Web Worker, with
		// a CSP that limits network to the pinned CDN. The worker has no DOM, no parent access, no
		// app credentials. The isolation boundary is the sandbox, not input sanitisation.
		const fn = new Function("console", '"use strict";\nreturn (async () => {\n' + code + "\n})();");
		const maybePromise = fn(sandboxConsole);
		return Promise.resolve(maybePromise).then(
			(value) => {
				if (value !== undefined) out.result = stringify(value);
				return out;
			},
			(e) => {
				out.stderr += (e && e.stack ? e.stack : String(e)) + "\n";
				return out;
			},
		);
	} catch (e) {
		out.stderr += (e && e.stack ? e.stack : String(e)) + "\n";
		return Promise.resolve(out);
	}
}

self.onmessage = async (event) => {
	const { id, language, code, pyodideIndexUrl } = event.data || {};
	currentId = id;
	let partial = { stdout: "", stderr: "", result: null, imagePng: null, files: [] };
	try {
		if (language === "python") {
			partial = await runPython(code, pyodideIndexUrl);
		} else if (language === "javascript") {
			postProgress("running", partial);
			partial = await runJavaScript(code);
		} else {
			self.postMessage({ id, ok: false, error: "Unsupported language: " + language, partial });
			return;
		}
		self.postMessage({ id, ok: true, error: null, partial });
	} catch (e) {
		// Catastrophic failure (e.g. Pyodide load error): report as a fatal error, never throw.
		self.postMessage({ id, ok: false, error: (e && e.message ? e.message : String(e)), partial });
	} finally {
		currentId = null;
	}
};
`;
