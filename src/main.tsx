import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { createRouter, RouterProvider } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import "./styles.css";
import { NotFoundPage } from "@/components/404.tsx";
import { client as inferenceClient } from "@/apis/inference/client.gen";
import env from "@/config/env.ts";

// Add theme detection
function setInitialTheme() {
	// Check for theme in localStorage
	const storedTheme = localStorage.getItem("libertai-ui-theme");

	// Set theme based on stored preference or system preference
	if (
		storedTheme === "dark" ||
		(storedTheme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches)
	) {
		document.documentElement.classList.add("dark");
	} else {
		document.documentElement.classList.add("light");
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
