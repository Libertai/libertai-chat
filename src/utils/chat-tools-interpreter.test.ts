import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type OpenAI from "openai";
import { TOOL_DEFINITIONS, formatInterpreterResult, executeRunCode } from "@/utils/chat-tools";
import type { InterpreterResult } from "@/lib/interpreter/types";

// Mock the sandbox runner so we test the pure tool-layer logic (formatting + artifact assembly)
// without spinning up an iframe/Pyodide. The runner itself is exercised for real in the e2e spec.
const runCodeMock = vi.fn<(...args: unknown[]) => Promise<InterpreterResult>>();
vi.mock("@/lib/interpreter/run", () => ({
	runCode: (...args: unknown[]) => runCodeMock(...args),
}));

function makeResult(over: Partial<InterpreterResult> = {}): InterpreterResult {
	return {
		language: "python",
		stdout: "",
		stderr: "",
		result: null,
		imagePng: null,
		error: null,
		timedOut: false,
		...over,
	};
}

beforeEach(() => runCodeMock.mockReset());
afterEach(() => vi.restoreAllMocks());

describe("interpreter TOOL_DEFINITIONS", () => {
	it("registers run_python and run_javascript, each requiring a `code` arg", () => {
		const fns = TOOL_DEFINITIONS.filter(
			(t): t is OpenAI.Chat.Completions.ChatCompletionFunctionTool => t.type === "function",
		);
		for (const name of ["run_python", "run_javascript"]) {
			const def = fns.find((t) => t.function.name === name);
			expect(def, `${name} missing`).toBeTruthy();
			const params = def!.function.parameters as { properties: Record<string, unknown>; required: string[] };
			expect(params.properties).toHaveProperty("code");
			expect(params.required).toContain("code");
		}
	});
});

describe("formatInterpreterResult", () => {
	it("includes stdout, the last value, and notes an image", () => {
		const text = formatInterpreterResult(
			makeResult({ stdout: "hello\n", result: "42", imagePng: "data:image/png;base64,AAAA" }),
		);
		expect(text).toContain("stdout:\nhello");
		expect(text).toContain("result: 42");
		expect(text).toMatch(/plot image .* shown to the user/i);
	});

	it("surfaces stderr and a generic error", () => {
		const text = formatInterpreterResult(makeResult({ stderr: "Traceback...\n", error: "boom" }));
		expect(text).toContain("stderr:\nTraceback...");
		expect(text).toContain("error: boom");
	});

	it("reports a timeout instead of the generic error", () => {
		const text = formatInterpreterResult(makeResult({ error: "Execution timed out after 50 ms.", timedOut: true }));
		expect(text.toLowerCase()).toContain("terminated");
		expect(text).not.toContain("error:");
	});

	it("falls back to a success-with-no-output note", () => {
		expect(formatInterpreterResult(makeResult()).toLowerCase()).toContain("ran successfully");
	});
});

describe("executeRunCode", () => {
	it("passes language/code/options through to the sandbox runner and builds an artifact", async () => {
		runCodeMock.mockResolvedValue(makeResult({ stdout: "ok\n", result: "7" }));
		const signal = new AbortController().signal;

		const { artifact, toolText } = await executeRunCode("python", "print('ok')\n7", {
			timeoutMs: 1234,
			pyodideIndexUrl: "https://cdn.example/full/",
			signal,
		});

		expect(runCodeMock).toHaveBeenCalledWith(
			"python",
			"print('ok')\n7",
			expect.objectContaining({ timeoutMs: 1234, pyodideIndexUrl: "https://cdn.example/full/", signal }),
		);
		expect(artifact).toMatchObject({ language: "python", code: "print('ok')\n7", stdout: "ok\n", result: "7" });
		expect(toolText).toContain("result: 7");
	});

	it("never throws on a failed run — returns an artifact with the error set", async () => {
		runCodeMock.mockResolvedValue(
			makeResult({ language: "javascript", error: "Sandbox worker crashed: x" }),
		);
		const { artifact, toolText } = await executeRunCode("javascript", "boom()");
		expect(artifact.error).toContain("crashed");
		expect(toolText).toContain("error:");
	});
});
