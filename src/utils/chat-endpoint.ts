/**
 * Decide which inference endpoint the chat UI talks to.
 *
 * The chat UI always uses the per-user **chat API key** against the connected endpoint when
 * authenticated. Chat keys are whitelisted unconditionally at the inference gateway, so chat
 * is FREE and must NOT be gated on credit balance.
 *
 * Two rules encoded here, both regression guards:
 *  1. Never gate on credits. Coupling chat to `credits > 0` routed every session-based
 *     (email/OAuth) user — who never has a wallet `account`, so `credits` reads 0 — onto the
 *     free tier permanently.
 *  2. Never send the connected endpoint an empty API key. The key is fetched asynchronously
 *     after auth; until it resolves we stay on the free public endpoint instead of hitting the
 *     paid endpoint with `""` (which the gateway rejects → "can't send a message").
 */

export type ChatEndpointInput = {
	isAuthenticated: boolean;
	/** The per-user chat API key, or null while it is still being fetched / when logged out. */
	chatApiKey: string | null;
	/** Connected (per-user key) inference base, WITHOUT the trailing `/v1`. */
	connectedApiUrl: string;
	/** Free public inference base (server injects a shared key). */
	freeApiUrl: string;
};

export type ChatEndpoint = {
	baseURL: string;
	apiKey: string;
	/** True when we resolved to the connected (authenticated, keyed) endpoint. */
	useConnected: boolean;
};

export function resolveChatEndpoint({
	isAuthenticated,
	chatApiKey,
	connectedApiUrl,
	freeApiUrl,
}: ChatEndpointInput): ChatEndpoint {
	const useConnected = isAuthenticated && !!chatApiKey;

	return {
		baseURL: useConnected ? `${connectedApiUrl}/v1` : freeApiUrl,
		apiKey: useConnected ? (chatApiKey ?? "") : "",
		useConnected,
	};
}
