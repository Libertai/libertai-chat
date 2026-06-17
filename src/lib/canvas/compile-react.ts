// Host-side JSX/TSX -> React.createElement compilation for the Canvas React preview.
//
// We compile on the HOST (not in the sandbox) with @babel/standalone, lazily imported so the large
// Babel bundle stays out of the initial app chunk and only loads when a React artifact is actually
// opened. The output is plain `React.createElement(...)` calls (classic runtime, no bundler / module
// imports needed) which the sandbox iframe evaluates against React/ReactDOM UMD globals.
//
// The compiled string is the ONLY thing handed to the sandbox; the model's source never executes on
// the host. Compilation itself is a pure transform (Babel does not run the code), so a malicious or
// broken snippet can at worst fail to compile here.

type BabelTransform = (
	code: string,
	options: Record<string, unknown>,
) => { code?: string | null };

let babelPromise: Promise<BabelTransform> | null = null;

async function getBabel(): Promise<BabelTransform> {
	if (!babelPromise) {
		babelPromise = import("@babel/standalone").then((mod) => {
			const transform = (mod as unknown as { transform: BabelTransform }).transform;
			return transform;
		});
	}
	return babelPromise;
}

export interface CompileResult {
	code: string | null;
	error: string | null;
}

// Strip bare ES module syntax that won't resolve inside the sandbox (no bundler): we drop
// `import ... from "..."` lines (React/hooks are provided as globals) and turn
// `export default X` / `export { X }` into a plain reference so `App` detection still works.
function stripModuleSyntax(source: string): string {
	return source
		.replace(/^\s*import\s+[^;\n]*?from\s+['"][^'"]+['"];?\s*$/gm, "")
		.replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, "")
		.replace(/^\s*export\s+default\s+function\s+([A-Za-z0-9_]+)/gm, "function $1")
		.replace(/^\s*export\s+default\s+/gm, "var __default = ")
		.replace(/^\s*export\s+(const|let|var|function|class)\s+/gm, "$1 ");
}

// Compile a JSX/TSX artifact to React.createElement calls. `language` is the fence token (jsx/tsx/
// react) and selects whether the TypeScript preset is applied. Returns { code } on success or
// { error } with the Babel diagnostic on failure — never throws.
export async function compileReact(source: string, language: string): Promise<CompileResult> {
	const isTs = language === "tsx" || language === "ts" || language === "typescript";
	const filename = isTs ? "artifact.tsx" : "artifact.jsx";
	const cleaned = stripModuleSyntax(source);

	try {
		const transform = await getBabel();
		const presets: unknown[] = [["react", { runtime: "classic" }]];
		if (isTs) presets.push("typescript");
		const out = transform(cleaned, { presets, filename });
		const code = out.code ?? null;
		if (!code) return { code: null, error: "Compilation produced no output." };
		// Re-point a default export onto `App` so the sandbox's auto-mount finds it.
		const withDefault = /__default\s*=/.test(code) ? `${code}\nvar App = typeof App !== 'undefined' ? App : __default;` : code;
		return { code: withDefault, error: null };
	} catch (err) {
		return { code: null, error: err instanceof Error ? err.message : String(err) };
	}
}
