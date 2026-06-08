import { defineConfig } from "vite";
import path from "path";

import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vite.dev/config/
export default defineConfig({
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
			"@libertai/branding": path.resolve(__dirname, "./src/shared/branding"),
			"@libertai/inference-sdk": path.resolve(__dirname, "./src/shared/inference-sdk"),
		},
		// Force a single copy of these React-context packages. pnpm gives the
		// src/shared submodule its own thirdweb install, so without dedupe the bundle
		// gets two ThirdwebProviders → "useActiveAccount must be used within <ThirdwebProvider>".
		dedupe: [
			"thirdweb",
			"react",
			"react-dom",
			"@tanstack/react-query",
			"@solana/wallet-adapter-react",
			"@solana/wallet-adapter-react-ui",
			"@solana/wallet-adapter-base",
		],
	},
});
