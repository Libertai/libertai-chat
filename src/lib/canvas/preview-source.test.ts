import { describe, expect, it } from "vitest";
import {
	buildHtmlPreview,
	buildSvgPreview,
	buildReactPreview,
	buildPreviewSource,
	REACT_CDN_ORIGIN,
	REACT_ESM_URL,
	REACT_DOM_ESM_URL,
} from "@/lib/canvas/preview-source";

describe("buildHtmlPreview", () => {
	it("uses a full document verbatim", () => {
		const doc = "<!doctype html><html><body><h1>x</h1></body></html>";
		expect(buildHtmlPreview(doc)).toBe(doc);
	});

	it("wraps a bare fragment in a styled document with a CSP", () => {
		const out = buildHtmlPreview("<button>Click</button>");
		expect(out).toContain("<!doctype html>");
		expect(out).toContain("<button>Click</button>");
		expect(out).toContain('http-equiv="Content-Security-Policy"');
		expect(out).toContain("default-src 'none'");
	});
});

describe("buildSvgPreview", () => {
	it("centres inline svg under a locked-down CSP", () => {
		const out = buildSvgPreview('<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>');
		expect(out).toContain("<svg");
		expect(out).toContain("default-src 'none'");
		expect(out).toContain("align-items: center");
	});
});

describe("buildReactPreview", () => {
	const compiled = "function App(){ return React.createElement('div', null, 'hi'); }";
	const out = buildReactPreview(compiled);

	it("imports the pinned React ESM modules", () => {
		expect(out).toContain(REACT_ESM_URL);
		expect(out).toContain(REACT_DOM_ESM_URL);
		expect(REACT_ESM_URL.startsWith(REACT_CDN_ORIGIN)).toBe(true);
		expect(REACT_DOM_ESM_URL.startsWith(REACT_CDN_ORIGIN)).toBe(true);
	});

	it("pins a CSP that only allows scripts/network from inline + the React CDN", () => {
		expect(out).toContain('http-equiv="Content-Security-Policy"');
		expect(out).toContain("default-src 'none'");
		// The compiled component is run with new Function inside the opaque-origin sandbox, so the
		// sandbox CSP needs 'unsafe-eval'; scripts otherwise come from inline + the pinned React CDN only.
		expect(out).toContain(`script-src 'unsafe-inline' 'unsafe-eval' ${REACT_CDN_ORIGIN}`);
		// React loads as an ES module (fetch), so connect-src must allow exactly that CDN — no wildcard.
		expect(out).toContain(`connect-src ${REACT_CDN_ORIGIN}`);
		expect(out).not.toContain("connect-src *");
	});

	it("embeds the compiled code as a safely-escaped string literal (not raw)", () => {
		// The compiled source must appear as a JSON string literal so it is data, never spliced into
		// the surrounding script as code.
		expect(out).toContain(JSON.stringify(compiled));
	});

	it("neutralises a closing script tag in the compiled code", () => {
		const evil = "var x = '</script><img src=x onerror=alert(1)>';";
		const html = buildReactPreview(evil);
		// The literal </script must be escaped so it can't close the wrapper <script>.
		expect(html).not.toContain("</script><img");
		expect(html).toContain("<\\/script");
	});

	it("auto-mounts an App component and exposes a render() helper", () => {
		expect(out).toContain("render");
		expect(out).toContain("createRoot");
		expect(out).toContain("typeof App");
	});
});

describe("buildPreviewSource", () => {
	it("dispatches by kind", () => {
		expect(buildPreviewSource("html", "<b>x</b>")).toContain("<b>x</b>");
		expect(buildPreviewSource("svg", "<svg/>")).toContain("<svg/>");
		expect(buildPreviewSource("react", "function App(){return null;}")).toContain("createRoot");
	});
});
