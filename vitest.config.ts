import path from "path";
import { defineConfig } from "vitest/config";

// Standalone test config: the app's vite.config.ts pulls in the TanStack Router, Tailwind and
// node-polyfill plugins which we don't need for unit tests. We only need the `@` path alias.
export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	test: {
		environment: "node",
		// Node >=25 defines a `localStorage` global that is undefined without --localstorage-file;
		// zustand's persist only falls back to no-op storage when the global is absent.
		execArgv: ["--no-experimental-webstorage"],
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
	},
});
