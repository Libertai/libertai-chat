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
export function useChatApiKey() {
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);

	const query = useQuery({
		queryKey: ["chatApiKey"],
		queryFn: async (): Promise<string | null> => {
			const response = await getChatApiKeyApiKeysChatGet();
			return response.data?.key ?? null;
		},
		enabled: isAuthenticated,
		staleTime: 5 * 60 * 1000,
	});

	return { chatApiKey: query.data ?? null, isLoading: query.isLoading };
}
