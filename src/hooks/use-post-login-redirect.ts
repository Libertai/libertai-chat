import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
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
 * Where to send the user after login. Persisted in sessionStorage (not just the /login
 * `redirect` search param) because OAuth and magic-link flows leave the site entirely and
 * come back on /auth/callback or /auth/verify — the param wouldn't survive the round-trip.
 */
const REDIRECT_STORAGE_KEY = "libertai-post-login-redirect";

/** Internal app paths only — full URLs and protocol-relative ("//host") values are discarded. */
function sanitizeRedirect(path: string | null | undefined): string | null {
	return path && path.startsWith("/") && !path.startsWith("//") ? path : null;
}

/**
 * Remember (or clear, when undefined) the post-login destination. Called by the /login page
 * with its `redirect` search param; clearing on a plain /login visit prevents a stale target
 * from a previous abandoned sign-in from leaking into this one.
 */
export function rememberPostLoginRedirect(path: string | undefined) {
	const safe = sanitizeRedirect(path);
	if (safe) sessionStorage.setItem(REDIRECT_STORAGE_KEY, safe);
	else sessionStorage.removeItem(REDIRECT_STORAGE_KEY);
}

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
	const router = useRouter();

	return useCallback(async () => {
		// `prefetchQuery` never throws and dedupes with the hook's in-flight fetch.
		// `retry: 1` + the timeout race keep a failing key endpoint from hanging the redirect.
		await Promise.race([
			queryClient.prefetchQuery({ ...chatApiKeyQueryOptions, retry: 1 }),
			new Promise((resolve) => setTimeout(resolve, KEY_WARMUP_TIMEOUT_MS)),
		]);
		const target = sanitizeRedirect(sessionStorage.getItem(REDIRECT_STORAGE_KEY)) ?? "/";
		sessionStorage.removeItem(REDIRECT_STORAGE_KEY);
		// history.push (not navigate) — the target is a dynamic href (may include a search
		// string), which the typed `to` option doesn't accept.
		router.history.push(target);
	}, [router]);
}
