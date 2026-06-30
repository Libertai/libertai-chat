import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Verifies the client-side code interpreter (m4). The runner module (src/lib/interpreter/run.ts)
// is EXPORTED so we drive it DIRECTLY in the browser via a dynamic import — no model needed. The
// runner spins up a sandboxed iframe (sandbox="allow-scripts", opaque origin, CSP-locked to
// jsdelivr) -> Web Worker, runs the code, and returns a structured result.
//
// We exercise: a JS return value, a Pyodide pandas snippet (stdout), a matplotlib snippet (PNG),
// and an infinite loop killed by the execution timeout. Pyodide loads from the pinned CDN so the
// Python cases get generous timeouts. Finally we seed a chat with a persisted interpreter artifact
// and screenshot the rendered Python result in the real Message UI.

mkdirSync("test-results/screenshots", { recursive: true });

// A bridge installed on window that imports the exported runner and exposes runCode to the test.
// Returns a serialisable InterpreterResult (no PyProxy leaks — the worker repr()'s values to text).
type RunResult = {
	language: string;
	stdout: string;
	stderr: string;
	result: string | null;
	imagePng: string | null;
	error: string | null;
	timedOut: boolean;
};

async function installRunner(page: Page) {
	await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
	await page.waitForFunction(
		async () => {
			try {
				const mod = await import("/src/lib/interpreter/run.ts");
				(window as unknown as { __runCode: unknown }).__runCode = mod.runCode;
				return typeof mod.runCode === "function";
			} catch {
				return false;
			}
		},
		undefined,
		{ timeout: 30_000 },
	);
}

function runInBrowser(page: Page, language: string, code: string, timeoutMs: number) {
	return page.evaluate(
		async ([lang, src, t]) => {
			const runCode = (window as unknown as { __runCode: (l: string, c: string, o: unknown) => Promise<RunResult> })
				.__runCode;
			return runCode(lang as string, src as string, { timeoutMs: t as number });
		},
		[language, code, timeoutMs] as const,
	) as Promise<RunResult>;
}

test.describe("client-side code interpreter", () => {
	test("runs a JavaScript snippet and captures console output + return value", async ({ page }) => {
		await installRunner(page);

		const result = await runInBrowser(
			page,
			"javascript",
			"console.log('hello from js');\nconst x = 6 * 7;\nreturn x;",
			15_000,
		);

		expect(result.error).toBeNull();
		expect(result.stdout).toContain("hello from js");
		// The trailing `return x` value is captured and stringified.
		expect(result.result).toBe("42");
	});

	test("kills an infinite loop via the execution timeout", async ({ page }) => {
		await installRunner(page);

		const result = await runInBrowser(page, "javascript", "while (true) {}", 2_000);

		// The sandbox terminated the worker; the run reports a timeout instead of hanging the app.
		expect(result.timedOut).toBe(true);
		expect((result.error ?? "").toLowerCase()).toContain("timed out");
	});

	test("runs a pandas snippet in Pyodide and prints a DataFrame sum", async ({ page }) => {
		test.setTimeout(180_000); // Pyodide cold-load + pandas wheel from the CDN is slow.
		await installRunner(page);

		const code = [
			"import pandas as pd",
			"df = pd.DataFrame({'a': [1, 2, 3], 'b': [4, 5, 6]})",
			"print('sum_a', int(df['a'].sum()))",
			"print('sum_b', int(df['b'].sum()))",
			"int(df.values.sum())",
		].join("\n");

		const result = await runInBrowser(page, "python", code, 150_000);

		expect(result.error, result.error ?? "").toBeNull();
		expect(result.stdout).toContain("sum_a 6");
		expect(result.stdout).toContain("sum_b 15");
		// Last expression value (total) captured as repr.
		expect(result.result).toBe("21");
	});

	test("runs a matplotlib snippet in Pyodide and produces a PNG", async ({ page }) => {
		test.setTimeout(180_000);
		await installRunner(page);

		const code = [
			"import matplotlib.pyplot as plt",
			"plt.plot([1, 2, 3], [2, 4, 6])",
			"plt.title('line')",
			"print('plotted')",
		].join("\n");

		const result = await runInBrowser(page, "python", code, 150_000);

		expect(result.error, result.error ?? "").toBeNull();
		expect(result.stdout).toContain("plotted");
		expect(result.imagePng, "expected a base64 PNG data URL").toMatch(/^data:image\/png;base64,/);
		expect((result.imagePng ?? "").length).toBeGreaterThan(1000);
	});

	test("renders a persisted Python interpreter result in the chat message", async ({ page }) => {
		const CHAT_ID = "e2e-interpreter-chat";
		// 1x1 transparent PNG (base64) standing in for a captured matplotlib figure.
		const PNG =
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
		const now = new Date().toISOString();
		const persisted = {
			state: {
				chats: {
					[CHAT_ID]: {
						id: CHAT_ID,
						assistantId: "default",
						createdAt: now,
						updatedAt: now,
						title: "Interpreter smoke",
						messages: [
							{
								id: "11111111-1111-4111-8111-111111111111",
								role: "user",
								content: "what's the sum of 1..3 in python?",
								timestamp: now,
							},
							{
								id: "22222222-2222-4222-8222-222222222222",
								role: "assistant",
								content: "I ran it for you:",
								timestamp: now,
								interpreter: [
									{
										language: "python",
										code: "import pandas as pd\ndf = pd.DataFrame({'a':[1,2,3]})\nprint(int(df['a'].sum()))",
										stdout: "6\n",
										stderr: "",
										result: "6",
										imagePng: PNG,
										error: null,
										timedOut: false,
									},
								],
							},
						],
					},
				},
				legacyMigrated: true,
			},
			version: 6,
		};

		await page.addInitScript(
			([key, value]) => {
				window.localStorage.setItem(key, value);
			},
			["libertai-chats", JSON.stringify(persisted)] as const,
		);

		await page.goto(`/chat/${CHAT_ID}`, { waitUntil: "domcontentloaded", timeout: 30_000 });

		const run = page.locator("[data-interpreter-run]").first();
		await expect(run).toBeVisible({ timeout: 20_000 });
		await expect(run).toHaveAttribute("data-language", "python");

		// The source is collapsed by default; expand it, then the executed code renders (via the
		// shared CodeBlock). The captured stdout shows regardless.
		await run.getByRole("button", { name: /show code/i }).click();
		await expect(run).toContainText("pd.DataFrame");
		await expect(run.getByText("6", { exact: false }).first()).toBeVisible();

		// The captured figure renders as an <img>.
		await expect(run.locator("img[data-interpreter-image]")).toBeVisible();

		await page.screenshot({ path: "test-results/screenshots/interpreter-python.png", fullPage: true });
	});
});
