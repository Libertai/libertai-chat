// Inline numbered citation support for assistant messages that carry a `sources` array.
//
// The model writes citations as bracketed numbers in its prose (e.g. "...as reported [1]").
// We turn each such marker into a clickable anchor that scrolls to the matching entry in the
// expandable sources panel. Parsing is kept pure here (no React / no DOM) so it can be unit
// tested directly; the Message component renders the segments and walks react-markdown's
// children with `mapChildren` below.

/** A run of plain text, or a citation pointing at the 1-based source number `n`. */
export type CitationSegment = { type: "text"; value: string } | { type: "cite"; n: number };

// Matches a bracketed positive integer like [1] or [12]. Global so we can walk every marker.
const CITATION_RE = /\[(\d+)\]/g;

/**
 * Split `text` into plain-text and citation segments. A bracketed number only becomes a
 * citation when it references a real source (1 <= n <= sourceCount); anything out of range is
 * left as literal text so we never produce a dangling/broken citation link.
 */
export function parseCitations(text: string, sourceCount: number): CitationSegment[] {
	if (sourceCount <= 0 || !text.includes("[")) return [{ type: "text", value: text }];

	const segments: CitationSegment[] = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	CITATION_RE.lastIndex = 0;

	while ((match = CITATION_RE.exec(text)) !== null) {
		const n = Number(match[1]);
		if (n < 1 || n > sourceCount) continue; // out of range -> keep as literal text

		if (match.index > lastIndex) {
			segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
		}
		segments.push({ type: "cite", n });
		lastIndex = match.index + match[0].length;
	}

	if (lastIndex < text.length) {
		segments.push({ type: "text", value: text.slice(lastIndex) });
	}

	// No in-range markers found: hand back the original text unchanged.
	return segments.length > 0 ? segments : [{ type: "text", value: text }];
}

/** True when `text` contains at least one in-range citation marker. */
export function hasCitations(text: string, sourceCount: number): boolean {
	return parseCitations(text, sourceCount).some((s) => s.type === "cite");
}

/** DOM id of a source entry in the panel, scoped per message so multiple messages don't collide. */
export function citationAnchorId(messageId: string, n: number): string {
	return `cite-${messageId}-${n}`;
}
