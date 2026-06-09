import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { queryClient } from "@/lib/query-client";
import { chatApiKeyQueryOptions } from "@/hooks/data/use-chat-api-key";

/**
 * Max wait for the chat API key before redirecting anyway. The chat page still works
 * without it (it falls back to the free endpoint), so we must never trap the user on
 * /login when the key endpoint is slow or down — we just lose the guarantee for that
 * one slow sign-in.
 */
const KEY_WARMUP_TIMEOUT_MS = 4000;

/**
 * Redirect out of the login flow ONLY after the per-user chat API key is warm in the
 * query cache.
 *
 * Root cause this guards: the key is fetched asynchronously once `isAuthenticated`
 * flips true. In the window right after sign-in (authenticated, key not yet loaded)
 * the chat treats the user as not-connected and silently downgrades to the free /
 * anonymous endpoint — which surfaced as "can't send a message" immediately after
 * logging in, fixed only by a refresh (by then the key had loaded). Prefetching the
 * key here, before leaving /login, closes that window for every login path.
 */
export function usePostLoginRedirect() {
	const navigate = useNavigate();

	return useCallback(async () => {
		// `prefetchQuery` never throws and dedupes with the hook's in-flight fetch.
		// `retry: 1` + the timeout race keep a failing key endpoint from hanging the redirect.
		await Promise.race([
			queryClient.prefetchQuery({ ...chatApiKeyQueryOptions, retry: 1 }),
			new Promise((resolve) => setTimeout(resolve, KEY_WARMUP_TIMEOUT_MS)),
		]);
		await navigate({ to: "/" });
	}, [navigate]);
}
