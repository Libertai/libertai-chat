// Lazy mermaid renderer. We dynamically import `mermaid` on first use to keep it out
// of the initial bundle, initialise it once, and render a diagram definition to an SVG
// string. Parse errors are surfaced as a rejected promise so callers can show the raw
// source instead of crashing the message.
let initialized = false;

type MermaidModule = {
	initialize: (config: Record<string, unknown>) => void;
	render: (id: string, definition: string) => Promise<{ svg: string }>;
};

let mermaidPromise: Promise<MermaidModule> | null = null;

async function getMermaid(): Promise<MermaidModule> {
	if (!mermaidPromise) {
		mermaidPromise = import("mermaid").then((mod) => {
			const mermaid = (mod.default ?? mod) as unknown as MermaidModule;
			if (!initialized) {
				mermaid.initialize({
					startOnLoad: false,
					theme: "dark",
					securityLevel: "strict",
				});
				initialized = true;
			}
			return mermaid;
		});
	}
	return mermaidPromise;
}

// Render a mermaid diagram definition to an SVG string. `id` must be a unique, CSS-safe
// id (mermaid uses it for internal element ids). Throws on parse errors.
export async function renderMermaid(id: string, definition: string): Promise<string> {
	const mermaid = await getMermaid();
	const { svg } = await mermaid.render(id, definition);
	return svg;
}
