import type { SubscriptionResponse } from "@libertai/inference-sdk";

/**
 * Whether the authenticated user is walled: the gateway has no path left for the next call
 * (free window exhausted AND prepaid below the minimum). Driven by the backend `allowed` flag
 * on /payments/subscription. Returns false while the subscription is still loading or on an
 * older backend that doesn't send `allowed` (fail-open — the reactive 401/402 catch still guards).
 */
export function isChatBlocked(subscription: SubscriptionResponse | undefined | null): boolean {
	return subscription?.allowed === false;
}

/** A thrown inference error that means "out of allowance" — gateway 402, or 401 from a chat key
 * dropped off the whitelist once the user is blocked. Tolerant of the OpenAI SDK error shape. */
export function isPaywallError(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const e = error as { status?: number; response?: { status?: number } };
	const status = e.status ?? e.response?.status;
	return status === 401 || status === 402;
}

/** A 429 from the anonymous chat proxy — the logged-out free message limit is exhausted. */
export function isAnonLimitError(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const e = error as { status?: number; response?: { status?: number } };
	return (e.status ?? e.response?.status) === 429;
}
