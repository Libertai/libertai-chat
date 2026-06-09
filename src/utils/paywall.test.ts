import { describe, expect, it } from "vitest";
import { isChatBlocked, isPaywallError } from "@/utils/paywall";

describe("isChatBlocked", () => {
	it("is false when subscription is not loaded yet", () => {
		expect(isChatBlocked(undefined)).toBe(false);
	});
	it("is false when allowed is true", () => {
		expect(isChatBlocked({ allowed: true, source: "tier" } as never)).toBe(false);
	});
	it("is true only when allowed is explicitly false", () => {
		expect(isChatBlocked({ allowed: false, source: "blocked" } as never)).toBe(true);
	});
	it("is false when allowed is missing (older backend)", () => {
		expect(isChatBlocked({ tier: "free" } as never)).toBe(false);
	});
});

describe("isPaywallError", () => {
	it("detects HTTP 402", () => {
		expect(isPaywallError({ status: 402 })).toBe(true);
	});
	it("detects HTTP 401 (key dropped from whitelist when blocked)", () => {
		expect(isPaywallError({ status: 401 })).toBe(true);
	});
	it("reads nested status (OpenAI SDK error shape)", () => {
		expect(isPaywallError({ response: { status: 402 } })).toBe(true);
	});
	it("ignores other errors", () => {
		expect(isPaywallError({ status: 500 })).toBe(false);
		expect(isPaywallError(new Error("network"))).toBe(false);
		expect(isPaywallError(null)).toBe(false);
	});
});
