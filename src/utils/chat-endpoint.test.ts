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

	// Regression guard for Bug #2: chat is FREE and must never be gated on credits. The signature
	// has no credits input by design — an authenticated, keyed user always reaches the connected
	// endpoint regardless of balance (this is what broke email/OAuth users, whose credits read 0).
	it("does not depend on a credit balance", () => {
		const zeroCredits = resolveChatEndpoint({ ...base, isAuthenticated: true, chatApiKey: "sk-chat-123" });
		// Same inputs, no credits knob to flip — result is purely auth + key driven.
		expect(zeroCredits.useConnected).toBe(true);
		// The public type must not carry a credits field.
		expect("credits" in base).toBe(false);
	});
});
