import { describe, expect, it } from "vitest";
import { compileReact } from "@/lib/canvas/compile-react";

// Babel runs in node here exactly as it does in the browser (the lib is environment-agnostic), so we
// can assert the JSX/TSX -> React.createElement transform + module-syntax stripping directly.

describe("compileReact", () => {
	it("compiles JSX to classic React.createElement calls", async () => {
		const res = await compileReact("function App() { return <div>hi {1 + 1}</div>; }", "jsx");
		expect(res.error).toBeNull();
		expect(res.code).toContain("React.createElement");
		expect(res.code).not.toContain("<div>");
	});

	it("strips TypeScript types from TSX", async () => {
		const res = await compileReact("const App = (): any => { const n: number = 2; return <p>{n}</p>; };", "tsx");
		expect(res.error).toBeNull();
		expect(res.code).toContain("React.createElement");
		expect(res.code).not.toContain(": number");
	});

	it("strips ES import lines (React is a sandbox global)", async () => {
		const src = ['import React from "react";', 'import { useState } from "react";', "function App(){ return <i/>; }"].join(
			"\n",
		);
		const res = await compileReact(src, "jsx");
		expect(res.error).toBeNull();
		expect(res.code).not.toContain('from "react"');
		expect(res.code).toContain("React.createElement");
	});

	it("rewrites a default export so the sandbox can auto-mount App", async () => {
		const res = await compileReact("export default function App(){ return <span>x</span>; }", "jsx");
		expect(res.error).toBeNull();
		expect(res.code).toContain("function App");
		expect(res.code).not.toContain("export default");
	});

	it("rewrites an anonymous default export into an App reference", async () => {
		const res = await compileReact("const Widget = () => <b/>;\nexport default Widget;", "jsx");
		expect(res.error).toBeNull();
		expect(res.code).toContain("var App = typeof App !== 'undefined' ? App : __default;");
	});

	it("returns an error (does not throw) on a syntax error", async () => {
		const res = await compileReact("function App() { return <div>", "jsx");
		expect(res.code).toBeNull();
		expect(res.error).toBeTruthy();
	});
});
