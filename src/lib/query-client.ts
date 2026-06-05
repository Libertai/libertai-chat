import { QueryClient } from "@tanstack/react-query";

// Shared query client. Lives in its own module so app startup (main.tsx) can hand it
// to the shared account store via `setQueryClient` for cache invalidation/clearing on
// auth changes, without coupling to a React component file.
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 5 * 60 * 1000, // 5 minutes
		},
	},
});
