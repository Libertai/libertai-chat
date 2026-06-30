// Builds the HTML document loaded into the Canvas preview iframe via `srcdoc`. The iframe carries
// `sandbox="allow-scripts"` (set by the host) so it runs as an OPAQUE origin: no DOM/storage/cookie
// access to the parent app and no app credentials. A pinned Content-Security-Policy further locks
// the document down — scripts/styles are inline only (plus the React ESM CDN for the React preview),
// network is closed by default, and images are limited to data:/https.
//
// All five artifact kinds render entirely client-side:
//   - html  : the artifact source IS the document body (rendered as-is inside the sandbox).
//   - svg   : the inline <svg> markup, centred.
//   - react : the JSX/TSX is pre-compiled to React.createElement calls by @babel/standalone on the
//             HOST (so Babel stays out of the sandbox). The sandbox loads React 19 + react-dom/client
//             as ES modules from the pinned CDN, then evaluates the compiled component against them.
//   - mermaid / markdown are NOT built here — they render on the host (mermaid lib / m1 pipeline)
//     and are shown without an iframe.
//
// We build the document as a STRING so the host controls exactly what executes. The compiled React
// code is embedded as a JSON-stringified string literal and evaluated with `new Function` inside the
// sandbox, never on the host.

export type IframeArtifactKind = "html" | "svg" | "react";

// CDN the React preview fetches React from. esm.sh serves browser-ready ES modules (React 19 dropped
// the UMD builds), and resolves its transitive sub-imports from the same origin — so a single origin
// in the CSP covers React + react-dom. Pinned to the version the app ships so behaviour matches.
export const REACT_CDN_ORIGIN = "https://esm.sh";
export const REACT_PREVIEW_VERSION = "19.2.4";

// Pinned React 19 ESM entry points (react + react-dom/client) the sandbox imports.
export const REACT_ESM_URL = `${REACT_CDN_ORIGIN}/react@${REACT_PREVIEW_VERSION}`;
export const REACT_DOM_ESM_URL = `${REACT_CDN_ORIGIN}/react-dom@${REACT_PREVIEW_VERSION}/client`;

function escapeForScript(source: string): string {
	// JSON.stringify gives a safe JS string literal (escapes quotes/newlines); additionally neutralise
	// any literal `</script` so the embedded string can't close the surrounding <script> element.
	return JSON.stringify(source).replace(/<\/script/gi, "<\\/script");
}

// Wrap an HTML artifact. If the source already looks like a full document (<html>/<!doctype>) we use
// it verbatim; otherwise we drop it into a minimal styled body so a bare fragment still renders.
export function buildHtmlPreview(html: string): string {
	const looksFullDoc = /<!doctype|<html[\s>]/i.test(html);
	if (looksFullDoc) return html;

	return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data: https:;" />
<style>
	html, body { margin: 0; padding: 16px; font-family: ui-sans-serif, system-ui, sans-serif; color: #0f172a; background: #ffffff; }
</style>
</head>
<body>
${html}
</body>
</html>`;
}

// Wrap inline SVG markup, centred on a neutral backdrop.
export function buildSvgPreview(svg: string): string {
	return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline';" />
<style>
	html, body { margin: 0; height: 100%; display: flex; align-items: center; justify-content: center; background: #ffffff; }
	svg { max-width: 100%; max-height: 100%; }
</style>
</head>
<body>
${svg}
</body>
</html>`;
}

// Wrap pre-compiled React code (output of compileReact below — plain React.createElement calls).
// The sandbox imports React + react-dom/client as ES modules from the pinned CDN, then evaluates the
// user code in a controlled scope exposing `React`/hooks plus a `render(node)` helper, and mounts the
// result. A declared / default-exported `App` is auto-rendered when the snippet doesn't call render().
export function buildReactPreview(compiledCode: string): string {
	const literal = escapeForScript(compiledCode);
	return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' ${REACT_CDN_ORIGIN}; connect-src ${REACT_CDN_ORIGIN}; img-src data: https:; style-src 'unsafe-inline'; font-src data: https:;" />
<style>
	html, body { margin: 0; padding: 16px; font-family: ui-sans-serif, system-ui, sans-serif; color: #0f172a; background: #ffffff; }
	#root { min-height: 0; }
	.canvas-error { color: #b91c1c; font-family: ui-monospace, monospace; font-size: 12px; white-space: pre-wrap; }
</style>
</head>
<body>
<div id="root"></div>
<script type="module">
import * as React from "${REACT_ESM_URL}";
import { createRoot } from "${REACT_DOM_ESM_URL}";

var COMPILED = ${literal};
var rootEl = document.getElementById("root");

function showError(err) {
	rootEl.replaceChildren();
	var pre = document.createElement("pre");
	pre.className = "canvas-error";
	pre.textContent = "Preview error: " + (err && err.message ? err.message : String(err));
	rootEl.appendChild(pre);
}

try {
	// esm.sh namespace import exposes the named React exports; normalise to a single object that has
	// both the named hooks and createElement so the compiled React.createElement / React.useState work.
	var ReactObj = React.default && React.default.createElement ? React.default : React;
	var root = createRoot(rootEl);
	var rendered = false;
	function render(node) { rendered = true; root.render(node); }
	var hooks = ["useState","useEffect","useRef","useMemo","useCallback","useReducer","useContext","Fragment"];
	var hookValues = hooks.map(function (h) { return ReactObj[h]; });
	// Evaluate the compiled component code in a controlled scope. It runs inside the opaque-origin
	// sandbox only; the host never executes artifact code.
	var fn = new Function(["React", "render"].concat(hooks), COMPILED + "\\n;return (typeof App !== 'undefined' ? App : (typeof exports !== 'undefined' && exports.default ? exports.default : undefined));");
	var App = fn.apply(null, [ReactObj, render].concat(hookValues));
	if (!rendered && App) {
		root.render(ReactObj.createElement(App));
	} else if (!rendered && !App) {
		throw new Error("No component found. Define an App component or call render(<...>).");
	}
} catch (err) {
	showError(err);
}
</script>
</body>
</html>`;
}

// Pick the srcdoc for an iframe-rendered artifact kind. `code` is the raw artifact source for
// html/svg, or the already-compiled React code for react.
export function buildPreviewSource(kind: IframeArtifactKind, code: string): string {
	switch (kind) {
		case "html":
			return buildHtmlPreview(code);
		case "svg":
			return buildSvgPreview(code);
		case "react":
			return buildReactPreview(code);
	}
}
