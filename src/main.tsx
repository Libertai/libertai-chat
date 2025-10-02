import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { createRouter, RouterProvider } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import "./styles.css";
import { NotFoundPage } from "@/components/404.tsx";
import { client as inferenceClient } from "@/apis/inference/client.gen";
import env from "@/config/env.ts";
import { useChatStore } from "@/stores/chat";

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

// Configure the inference client with cross-origin credentials support
// This enables sending cookies with requests to different domains
inferenceClient.setConfig({
	baseURL: env.LTAI_INFERENCE_API_URL,
	withCredentials: true, // Enable sending cookies in cross-origin requests
});

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
