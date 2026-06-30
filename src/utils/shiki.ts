// Lazy Shiki highlighter. We dynamically import `shiki` and create a single
// highlighter (loaded with the languages we support) the first time a code block
// needs highlighting, so the highlighter + grammars stay out of the initial bundle.
import { SUPPORTED_CODE_LANGUAGES, type SupportedCodeLanguage } from "@/utils/markdown";

// Dark theme that reads well on the app's dark code-block background.
const SHIKI_THEME = "github-dark";

type Highlighter = {
	codeToHtml: (code: string, options: { lang: string; theme: string }) => string;
};

let highlighterPromise: Promise<Highlighter> | null = null;

async function getHighlighter(): Promise<Highlighter> {
	if (!highlighterPromise) {
		highlighterPromise = import("shiki").then((shiki) =>
			shiki.createHighlighter({
				themes: [SHIKI_THEME],
				langs: [...SUPPORTED_CODE_LANGUAGES],
			}),
		);
	}
	return highlighterPromise;
}

// Highlight `code` for the given (already-resolved) language and return Shiki's
// <pre class="shiki">...<span style>...</span></pre> HTML. The caller is responsible
// for only passing supported languages.
export async function highlightCode(code: string, lang: SupportedCodeLanguage): Promise<string> {
	const highlighter = await getHighlighter();
	return highlighter.codeToHtml(code, { lang, theme: SHIKI_THEME });
}
