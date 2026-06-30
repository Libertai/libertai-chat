// Pure helpers for rich-markdown rendering (syntax highlighting, mermaid, copy).
// Kept dependency-free so they can be unit-tested without a DOM or Shiki/mermaid.

// Languages we proactively load into the Shiki highlighter. Anything outside this
// set falls back to plain text rather than crashing the message.
export const SUPPORTED_CODE_LANGUAGES = [
	"javascript",
	"typescript",
	"jsx",
	"tsx",
	"json",
	"python",
	"bash",
	"shell",
	"html",
	"css",
	"markdown",
	"sql",
	"rust",
	"go",
	"yaml",
	"toml",
	"diff",
] as const;

export type SupportedCodeLanguage = (typeof SUPPORTED_CODE_LANGUAGES)[number];

// Maps common aliases to a canonical Shiki language id. Returns undefined when the
// language is unknown or absent, so callers can render plain text.
const LANGUAGE_ALIASES: Record<string, SupportedCodeLanguage> = {
	js: "javascript",
	javascript: "javascript",
	ts: "typescript",
	typescript: "typescript",
	jsx: "jsx",
	tsx: "tsx",
	json: "json",
	py: "python",
	python: "python",
	sh: "bash",
	bash: "bash",
	shell: "shell",
	zsh: "bash",
	html: "html",
	xml: "html",
	css: "css",
	md: "markdown",
	markdown: "markdown",
	sql: "sql",
	rs: "rust",
	rust: "rust",
	go: "go",
	golang: "go",
	yml: "yaml",
	yaml: "yaml",
	toml: "toml",
	diff: "diff",
};

// react-markdown passes the fenced-code language as a `language-xxx` class. Extract
// the raw language token (lowercased) from a className string, or undefined.
export function extractLanguageFromClassName(className: string | undefined): string | undefined {
	if (!className) return undefined;
	const match = /\blanguage-([\w-]+)/.exec(className);
	if (!match) return undefined;
	const lang = match[1].toLowerCase();
	return lang.length > 0 ? lang : undefined;
}

// Resolve a raw language token to a canonical Shiki id, or undefined when unsupported.
export function resolveCodeLanguage(raw: string | undefined): SupportedCodeLanguage | undefined {
	if (!raw) return undefined;
	return LANGUAGE_ALIASES[raw.toLowerCase()];
}

// A fenced block is a mermaid diagram when its language is exactly `mermaid`.
export function isMermaidLanguage(raw: string | undefined): boolean {
	return raw?.toLowerCase() === "mermaid";
}

// react-markdown hands `children` to the `code` renderer as a (possibly nested) React
// node. For fenced blocks it is the raw source string, sometimes with a trailing
// newline. Normalise it to the exact text the user wrote so Copy yields clean source.
export function nodeChildrenToText(children: unknown): string {
	if (children == null) return "";
	if (typeof children === "string") return children;
	if (typeof children === "number") return String(children);
	if (Array.isArray(children)) return children.map(nodeChildrenToText).join("");
	return "";
}

// Strip the single trailing newline that markdown adds to fenced-code content so the
// copied source matches what the user typed.
export function normalizeCodeSource(text: string): string {
	return text.replace(/\n$/, "");
}

// Minimal hast node shape (subset of `hast` we read from react-markdown's `node` prop).
export interface HastNode {
	type: string;
	value?: string;
	children?: HastNode[];
}

// Recursively concatenate the text content of a hast element node. Used to recover the
// raw fenced-code source from react-markdown's `pre`/`code` hast node.
export function hastText(node: HastNode | undefined | null): string {
	if (!node) return "";
	if (node.type === "text") return node.value ?? "";
	if (Array.isArray(node.children)) return node.children.map(hastText).join("");
	return "";
}
