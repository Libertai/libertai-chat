// Pure detection of self-contained "canvas" artifacts in assistant markdown output.
//
// An artifact is a fenced code block whose language marks it as a renderable, self-contained
// document: html, a React component (jsx/tsx), an svg image, a mermaid diagram, or a standalone
// markdown document (```markdown / ```md). When the assistant emits one of these we offer an
// "Open in canvas" affordance and render a live preview in the Canvas side-panel.
//
// Kept dependency-free (no DOM, no markdown lib) so it can be unit-tested directly. The fenced-block
// scanner is a small line-based parser rather than a full markdown AST: it only needs the fence
// language + the raw inner source, and must agree with what a user sees in the rendered message.

export type ArtifactKind = "html" | "react" | "svg" | "mermaid" | "markdown";

export interface DetectedArtifact {
	kind: ArtifactKind;
	// Raw language token from the fence (e.g. "tsx", "html"), lowercased.
	language: string;
	// Exact inner source of the fenced block (no trailing newline).
	code: string;
	// 0-based index of this artifact among the detected artifacts in the message, in document order.
	index: number;
	// A short human title derived from the artifact kind/content for the canvas header + tab.
	title: string;
}

// Maps a fence language token to the artifact kind we render, or undefined when the block is just
// ordinary code (e.g. python, json) that should NOT open the canvas.
const LANGUAGE_TO_KIND: Record<string, ArtifactKind> = {
	html: "html",
	htm: "html",
	svg: "svg",
	mermaid: "mermaid",
	jsx: "react",
	tsx: "react",
	react: "react",
	markdown: "markdown",
	md: "markdown",
};

// Minimum body length (trimmed) before a markdown fence is treated as a standalone "document"
// artifact worth opening in the canvas. Tiny ```md snippets are left inline.
const MARKDOWN_MIN_LENGTH = 80;

export function artifactKindForLanguage(raw: string | undefined): ArtifactKind | undefined {
	if (!raw) return undefined;
	return LANGUAGE_TO_KIND[raw.trim().toLowerCase()];
}

// Derive a friendly title from the artifact. For React/HTML we look for an obvious name (a
// component declaration or <title>/<h1>); otherwise we fall back to a kind label.
function deriveTitle(kind: ArtifactKind, code: string): string {
	if (kind === "react") {
		const m =
			/(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/.exec(code) ??
			/export\s+default\s+function\s+([A-Za-z0-9_]+)/.exec(code);
		if (m) return m[1];
		return "React component";
	}
	if (kind === "html") {
		const title = /<title[^>]*>([^<]+)<\/title>/i.exec(code);
		if (title) return title[1].trim();
		const h1 = /<h1[^>]*>([^<]+)<\/h1>/i.exec(code);
		if (h1) return h1[1].trim();
		return "HTML document";
	}
	if (kind === "svg") return "SVG image";
	if (kind === "mermaid") return "Diagram";
	return "Document";
}

// Walk the message line-by-line and extract every fenced block whose language marks it as a
// renderable artifact. Handles ``` and ~~~ fences of 3+ chars and ignores indented/inline code.
// The inner source is returned verbatim (minus the surrounding fence lines and a single trailing
// newline) so the canvas preview gets exactly what the user sees in the message.
export function detectArtifacts(markdown: string): DetectedArtifact[] {
	if (!markdown) return [];

	const lines = markdown.split("\n");
	const artifacts: DetectedArtifact[] = [];

	let inFence = false;
	let fenceChar = "";
	let fenceLen = 0;
	let fenceLang = "";
	let buffer: string[] = [];

	const fenceOpenRe = /^(\s{0,3})(`{3,}|~{3,})\s*([A-Za-z0-9_+-]*)\s*$/;

	for (const line of lines) {
		if (!inFence) {
			const m = fenceOpenRe.exec(line);
			if (m) {
				inFence = true;
				fenceChar = m[2][0];
				fenceLen = m[2].length;
				fenceLang = m[3] ?? "";
				buffer = [];
			}
			continue;
		}

		// Inside a fence: a closing fence is the same char, at least as long, with no info string.
		const closeRe = new RegExp(`^\\s{0,3}${fenceChar === "`" ? "`" : "~"}{${fenceLen},}\\s*$`);
		if (closeRe.test(line)) {
			const kind = artifactKindForLanguage(fenceLang);
			if (kind) {
				const code = buffer.join("\n");
				const trimmed = code.trim();
				const keep = kind === "markdown" ? trimmed.length >= MARKDOWN_MIN_LENGTH : trimmed.length > 0;
				if (keep) {
					const index = artifacts.length;
					artifacts.push({
						kind,
						language: fenceLang.toLowerCase(),
						code,
						index,
						title: deriveTitle(kind, code),
					});
				}
			}
			inFence = false;
			fenceChar = "";
			fenceLen = 0;
			fenceLang = "";
			buffer = [];
			continue;
		}

		buffer.push(line);
	}

	return artifacts;
}

// True when the assistant message contains at least one renderable artifact.
export function hasArtifacts(markdown: string): boolean {
	return detectArtifacts(markdown).length > 0;
}

// A stable key that identifies "the same artifact" across regenerations / successive versions in a
// conversation, so the canvas can group them into a version history. We key on (messageOrdinal of
// the artifact within a message) + kind: when the assistant revises e.g. the first React component
// it produced, the new version lines up with the previous one under the same slot.
export function artifactSlotKey(kind: ArtifactKind, index: number): string {
	return `${kind}:${index}`;
}
