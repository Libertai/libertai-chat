import { useQuery } from "@tanstack/react-query";
import { getChatApiKeyApiKeysChatGet } from "@libertai/inference-sdk";
import { useAccountStore } from "@libertai/auth";

/**
 * Chat inference API key.
 *
 * This is chat-specific (used to call the OpenAI-compatible inference endpoint and the
 * image-generation endpoint), NOT auth/session state — so it lives here rather than in
 * the shared auth store. The shared account store (console-derived) intentionally does
 * not expose `chatApiKey`/`getChatApiKey`; we fetch it from the SDK once the cookie
 * session is established.
 */
/**
 * Shared query config for the chat API key. Exported so the login flow can prefetch
 * the key into the cache before redirecting off /login (see `usePostLoginRedirect`),
 * while this hook reads the very same cache entry — same `queryKey`, same `queryFn`.
 */
export const chatApiKeyQueryOptions = {
	queryKey: ["chatApiKey"] as const,
	queryFn: async (): Promise<string | null> => {
		const response = await getChatApiKeyApiKeysChatGet();
		return response.data?.key ?? null;
	},
	staleTime: 5 * 60 * 1000,
};

export function useChatApiKey() {
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);

	const query = useQuery({
		...chatApiKeyQueryOptions,
		enabled: isAuthenticated,
	});

	// Gate on isAuthenticated: React Query keeps the last cached data when `enabled`
	// flips false, so without this a signed-out state could expose a prior user's key.
	return { chatApiKey: isAuthenticated ? (query.data ?? null) : null, isLoading: query.isLoading };
}
