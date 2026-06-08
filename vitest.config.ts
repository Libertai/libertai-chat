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
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
	},
});
