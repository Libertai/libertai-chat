import { defineConfig, loadEnv } from "vite";
import path from "path";

import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");

	return {
		plugins: [
			tanstackRouter({ target: "react", autoCodeSplitting: true }),
			tailwindcss(),
			react(),
			nodePolyfills({
				globals: {
					Buffer: true,
				},
			}),
		],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
				"@libertai/auth": path.resolve(__dirname, "./src/shared/auth"),
				"@libertai/inference-sdk": path.resolve(__dirname, "./src/shared/inference-sdk"),
			},
		},
		server: {
			proxy: {
				// Same-origin proxy so the httpOnly session cookie is set/sent without
				// cross-site restrictions during local dev. `initLibertaiAuth` points the
				// SDK at "/api" in DEV; here we forward it to the real backend.
				"/api": {
					target: env.VITE_LTAI_INFERENCE_API_URL,
					changeOrigin: true,
					secure: true,
					cookieDomainRewrite: "",
					rewrite: (p) => p.replace(/^\/api/, ""),
				},
			},
		},
	};
});
