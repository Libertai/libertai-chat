import { describe, expect, it } from "vitest";
import { resolveChatEndpoint } from "@/utils/chat-endpoint";

const CONNECTED = "https://api.libertai.io";
const FREE = "https://inference.api.libertai.io";

const base = { connectedApiUrl: CONNECTED, freeApiUrl: FREE };

describe("resolveChatEndpoint", () => {
	it("uses the free public endpoint with no key when logged out", () => {
		const result = resolveChatEndpoint({ ...base, isAuthenticated: false, chatApiKey: null });

		expect(result).toEqual({ baseURL: FREE, apiKey: "", useConnected: false });
	});

	it("uses the connected endpoint with the chat key when authenticated", () => {
		const result = resolveChatEndpoint({ ...base, isAuthenticated: true, chatApiKey: "sk-chat-123" });

		expect(result).toEqual({ baseURL: `${CONNECTED}/v1`, apiKey: "sk-chat-123", useConnected: true });
	});

	// Regression guard for Bug #1: while authenticated but before the chat key resolves, never hit
	// the connected endpoint with an empty key (the gateway rejects it → "can't send a message").
	it("stays on the free endpoint while the chat key is still loading", () => {
		const result = resolveChatEndpoint({ ...base, isAuthenticated: true, chatApiKey: null });

		expect(result.useConnected).toBe(false);
		expect(result.baseURL).toBe(FREE);
		expect(result.apiKey).toBe("");
	});

	// Regression guard for Bug #2: chat is FREE and must never be gated on credits. The result is
	// purely auth + key driven — an authenticated, keyed user always reaches the connected endpoint
	// regardless of balance (this is what broke email/OAuth users, whose credits read 0). The
	// `credits`-independence is also enforced at compile time: ChatEndpointInput has no credits field,
	// so any attempt to re-introduce credit-gating would not type-check.
	it("reaches the connected endpoint for an authenticated keyed user (no credit gate)", () => {
		const result = resolveChatEndpoint({ ...base, isAuthenticated: true, chatApiKey: "sk-chat-123" });

		expect(result.useConnected).toBe(true);
		expect(result.baseURL).toBe(`${CONNECTED}/v1`);
	});

	// Guards the auth gating: even if a stale key lingers in cache after logout (isAuthenticated has
	// flipped false before the query cache is cleared), we must never send it to the paid endpoint.
	it("stays on the free endpoint when logged out even with a stale key present", () => {
		const result = resolveChatEndpoint({ ...base, isAuthenticated: false, chatApiKey: "sk-stale-key" });

		expect(result).toEqual({ baseURL: FREE, apiKey: "", useConnected: false });
	});
});
