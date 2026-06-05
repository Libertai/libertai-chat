import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { createRouter, RouterProvider } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import "./styles.css";
import { NotFoundPage } from "@/components/404.tsx";
import { initLibertaiAuth, useAccountStore } from "@libertai/auth";
import { queryClient } from "@/lib/query-client";
import env from "@/config/env.ts";
import { useChatStore } from "@/stores/chat";

// Configure the shared inference SDK + auth store. Cookie-based auth: the backend, the
// console and chat are all same-site (*.libertai.io; localhost in dev), so the httpOnly
// SameSite=Lax session cookie is sent on credentialed cross-origin requests (CORS allows it).
initLibertaiAuth({
	apiBaseUrl: env.LTAI_INFERENCE_API_URL,
	thirdwebClientId: env.THIRDWEB_CLIENT_ID,
	solanaRpc: env.SOLANA_RPC,
	ltaiBaseAddress: env.LTAI_BASE_ADDRESS,
	ltaiSolanaAddress: env.LTAI_SOLANA_ADDRESS,
});

// Give the store our query client (for cache invalidation/clearing on auth changes)
// and hydrate auth state from the session cookie on startup.
useAccountStore.getState().setQueryClient(queryClient);
void useAccountStore.getState().checkSession();

// Add theme detection
function setInitialTheme() {
	// Check for theme in localStorage
	const storedTheme = localStorage.getItem("libertai-ui-theme");

	// Determine theme: stored preference → system preference → default to dark
	if (storedTheme === "light") {
		document.documentElement.classList.add("light");
	} else if (storedTheme === "dark") {
		document.documentElement.classList.add("dark");
	} else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
		document.documentElement.classList.add("light");
	} else {
		document.documentElement.classList.add("dark");
	}
}

// Set initial theme before first render
setInitialTheme();

// Create a new router instance
const router = createRouter({
	routeTree,
	defaultNotFoundComponent: NotFoundPage,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

// Migrate legacy chats if needed
useChatStore.getState().migrateLegacyChatsIfNeeded();

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<StrictMode>
			<RouterProvider router={router} />
		</StrictMode>,
	);
}
