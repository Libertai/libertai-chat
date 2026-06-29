# Subscriptions Plan 3 — Chat UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** In the chat app, show the current plan in the account button (Free + Upgrade / "<Tier> plan"), add a `/plans` page, show a compact allowance meter in the sidebar, and wall the composer when the user is out of allowance + prepaid (the `allowed`/`source` signal from `/payments/subscription`, plus a reactive catch of the gateway 401/402).

**Architecture:** Reuses the shared pieces created in Plan 2 (`@libertai/auth`: `useSubscription`, `PlanBadge`, `PlansSection`, `AllowanceBar`, regenerated SDK with `allowed`/`source`). Chat-specific work: a `/plans` route, the sidebar meter, two pure paywall helpers (unit-tested), and the composer wall in `chat.$chatId.tsx`. The free/anonymous endpoint path is untouched.

**Tech stack:** React 19, TanStack Router (file routes), Tailwind + shadcn primitives in `src/components/ui`, `cn()` at `src/lib/utils.ts`, **vitest** (`pnpm test`, `describe`/`it`, files `src/**/*.{test,spec}.{ts,tsx}`, env node). pnpm.

**Repo:** `/Users/reza/Documents/work/freelance/libertai/libertai-chat`. Its `src/shared` is the SAME web-shared submodule as console.

**PREREQUISITE:** Plan 2 must be merged/pushed to the web-shared branch `feat/subscriptions-ui` (the shared hooks/components + regenerated SDK). Task 1 points chat's submodule at it.

---

### Task 1: Bump chat's web-shared submodule to the shared-UI branch

**Files:** `libertai-chat` submodule pointer (`src/shared`)

- [ ] **Step 1: Check out the shared branch in the submodule + install**
```bash
cd /Users/reza/Documents/work/freelance/libertai/libertai-chat/src/shared
git fetch origin && git checkout feat/subscriptions-ui && git pull
cd /Users/reza/Documents/work/freelance/libertai/libertai-chat
pnpm install
```

- [ ] **Step 2: Sanity-check the shared exports resolve**
```bash
cd /Users/reza/Documents/work/freelance/libertai/libertai-chat
rg -n "PlanBadge|PlansSection|AllowanceBar|useSubscription" src/shared/auth/index.ts
```
Expected: all four exported. (Do not commit yet — the pointer bump is committed at the end with the chat changes, Task 7.)

---

### Task 2: Paywall helpers (TDD)

Pure functions so the wall logic is tested without rendering. One decides "is the user walled" from the subscription snapshot; one detects a gateway paywall error from a thrown inference error.

**Files:**
- Create: `libertai-chat/src/utils/paywall.ts`
- Test: `libertai-chat/src/utils/paywall.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/paywall.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `pnpm test -- src/utils/paywall.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/utils/paywall.ts`:
```typescript
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
```

- [ ] **Step 4: Run it, expect PASS**

Run: `pnpm test -- src/utils/paywall.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**
```bash
git add src/utils/paywall.ts src/utils/paywall.test.ts
git commit -m "feat(chat): add paywall detection helpers"
```

---

### Task 3: Plan badge in the account button

**Files:** `libertai-chat/src/components/ConnectedAccountFooter.tsx`

- [ ] **Step 1: Pass the shared `PlanBadge` to `AccountMenu`**

Edit `ConnectedAccountFooter.tsx`:
```tsx
import { Settings } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { AccountMenu, PlanBadge, useAccountStore } from "@libertai/auth";
import { useENS } from "@/hooks/useENS";
import { useSidebar } from "@/components/ui/sidebar";

export function ConnectedAccountFooter() {
	const account = useAccountStore((state) => state.account);
	const ens = useENS(account?.address);
	const navigate = useNavigate();
	const { isMobile, setOpenMobile } = useSidebar();

	const closeMobile = () => {
		if (isMobile) setOpenMobile(false);
	};

	return (
		<AccountMenu
			ens={ens}
			planBadge={
				<PlanBadge
					onUpgrade={() => {
						closeMobile();
						navigate({ to: "/plans" });
					}}
				/>
			}
			items={[
				{
					label: "Settings",
					icon: <Settings className="h-4 w-4" />,
					onSelect: () => navigate({ to: "/settings" }),
				},
			]}
			onSignedOut={() => navigate({ to: "/" })}
			onAction={closeMobile}
		/>
	);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**
```bash
git add src/components/ConnectedAccountFooter.tsx
git commit -m "feat(chat): show plan badge in the account button"
```

---

### Task 4: `/plans` route

**Files:** Create `libertai-chat/src/routes/plans.tsx`

- [ ] **Step 1: Create the route** (file-based; renders inside `Layout` since it's not in `CHROMELESS_ROUTES`). Mirrors the `top-up.tsx`/`rewards.tsx` container style; renders the shared `PlansSection`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { PlansSection } from "@libertai/auth";

export const Route = createFileRoute("/plans")({
	component: Plans,
});

function Plans() {
	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col space-y-6 max-w-5xl mx-auto">
				<div>
					<h1 className="text-3xl font-bold">Plans</h1>
					<p className="text-muted-foreground mt-1">
						Free includes a generous daily allowance. Upgrade for more usage and larger models.
					</p>
				</div>
				<PlansSection />
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Regenerate the route tree + typecheck**

Run: `pnpm exec tsc --noEmit` (TanStack Router's vite plugin regenerates `routeTree.gen.ts` on dev/build; if the typecheck complains the route isn't registered, run `pnpm build` once or start `pnpm dev` to regenerate, then re-typecheck).
Expected: `/plans` is a known route; clean typecheck.

- [ ] **Step 3: Commit**
```bash
git add src/routes/plans.tsx src/routeTree.gen.ts
git commit -m "feat(chat): add /plans page"
```

---

### Task 5: Compact allowance meter in the sidebar

A small "weekly allowance" bar above the account footer, visible to signed-in users. Reuses the shared `AllowanceBar`.

**Files:**
- Create: `libertai-chat/src/components/SidebarAllowance.tsx`
- Modify: `libertai-chat/src/components/Layout.tsx` (SidebarFooter)

- [ ] **Step 1: Create the meter component**

```tsx
import { useEffect, useState } from "react";
import { AllowanceBar, useAccountStore, useSubscription } from "@libertai/auth";

/**
 * Compact weekly-allowance meter for the sidebar footer. Only renders for signed-in users with
 * a loaded subscription. `now` ticks each minute so the reset countdown stays roughly current.
 */
export function SidebarAllowance() {
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	const { data: subscription } = useSubscription();
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 60_000);
		return () => clearInterval(id);
	}, []);

	if (!isAuthenticated || !subscription) return null;

	return (
		<div className="px-2 pb-2">
			<AllowanceBar
				label="Weekly allowance"
				used={subscription.weekly_used ?? 0}
				limit={subscription.weekly_limit ?? 0}
				resetsAt={subscription.weekly_resets_at}
				now={now}
			/>
		</div>
	);
}
```

- [ ] **Step 2: Render it in the sidebar footer** — in `src/components/Layout.tsx`, the `<SidebarFooter>` becomes:
```tsx
				<SidebarFooter>
					<SidebarAllowance />
					<ConnectedAccountFooter />
				</SidebarFooter>
```
Add `import { SidebarAllowance } from "@/components/SidebarAllowance";` at the top.

- [ ] **Step 3: Typecheck + commit**
```bash
pnpm exec tsc --noEmit
git add src/components/SidebarAllowance.tsx src/components/Layout.tsx
git commit -m "feat(chat): sidebar weekly allowance meter"
```

---

### Task 6: Composer paywall in the chat route

When the user is blocked (proactively via `allowed===false`, or reactively when a send throws a 401/402), show an out-of-credits panel with a reset countdown + Upgrade / Top up, and prevent sending.

**Files:**
- Create: `libertai-chat/src/components/ChatPaywall.tsx`
- Modify: `libertai-chat/src/routes/chat.$chatId.tsx`

- [ ] **Step 1: Create the paywall panel**

```tsx
import { useNavigate } from "@tanstack/react-router";
import { useSubscription } from "@libertai/auth";
import { Button } from "@/components/ui/button";

function resetsLabel(resetsAt?: string | null): string {
	if (!resetsAt) return "soon";
	const diff = new Date(resetsAt).getTime() - Date.now();
	if (diff <= 0) return "soon";
	const h = Math.floor(diff / 3_600_000);
	if (h >= 24) return `in ${Math.floor(h / 24)}d ${h % 24}h`;
	if (h >= 1) return `in ${h}h`;
	return `in ${Math.max(1, Math.floor(diff / 60_000))}m`;
}

/** Hard wall shown above the composer when the user has exhausted their free allowance and prepaid. */
export function ChatPaywall() {
	const navigate = useNavigate();
	const { data: subscription } = useSubscription();
	const resets = resetsLabel(subscription?.weekly_resets_at);

	return (
		<div className="mx-auto mb-3 max-w-3xl rounded-xl border border-border bg-card/60 p-4">
			<p className="text-sm font-medium">You've used your free allowance.</p>
			<p className="mt-1 text-sm text-muted-foreground">
				Your weekly allowance resets {resets}. Upgrade your plan or top up credits to keep chatting now.
			</p>
			<div className="mt-3 flex gap-2">
				<Button size="sm" onClick={() => navigate({ to: "/plans" })}>
					Upgrade
				</Button>
				<Button size="sm" variant="outline" onClick={() => navigate({ to: "/top-up" })}>
					Top up credits
				</Button>
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Wire it into `chat.$chatId.tsx`**

Read the file first. Make these precise changes:

1. Add imports near the top:
```tsx
import { useSubscription } from "@libertai/auth";
import { isChatBlocked, isPaywallError } from "@/utils/paywall";
import { ChatPaywall } from "@/components/ChatPaywall";
```

2. Inside the component, get the subscription and a reactive-block state:
```tsx
	const { data: subscription, refetch: refetchSubscription } = useSubscription();
	const [hitPaywall, setHitPaywall] = useState(false);
	const blocked = isChatBlocked(subscription) || hitPaywall;
```
(Reset `hitPaywall` to false at the start of a successful send attempt.)

3. In the send handler (the function that builds the request and calls the inference client), guard at the very top — only for the connected/authenticated path (never block the free/anonymous endpoint):
```tsx
	if (isAuthenticated && blocked) {
		return; // composer is disabled + paywall shown; nothing to send
	}
```

4. In the `catch (error)` block of the send (around the existing generic handler), before the generic message, intercept paywall errors:
```tsx
		} else if (isPaywallError(error)) {
			setHitPaywall(true);
			void refetchSubscription();
			// remove the empty assistant placeholder instead of a generic error
			updateMessage(chatId, assistantMessage.id, "_(out of allowance)_");
		} else {
			// ...existing generic error message...
		}
```
(Adapt to the existing `if (controller.signal.aborted) {...} else {...}` structure — add the `isPaywallError` branch as an `else if` before the generic `else`.)

5. Render `<ChatPaywall />` just above the composer when `isAuthenticated && blocked`, and disable the composer's submit while blocked. Find where the message input / send button render and:
   - render `{isAuthenticated && blocked && <ChatPaywall />}` directly above the input container;
   - add `|| (isAuthenticated && blocked)` to the send button's `disabled` prop (and ideally the textarea's Enter-to-send guard).

- [ ] **Step 3: Typecheck + run helper tests**

```bash
pnpm exec tsc --noEmit
pnpm test -- src/utils/paywall.test.ts
```
Expected: clean + green.

- [ ] **Step 4: Commit**
```bash
git add src/components/ChatPaywall.tsx src/routes/chat.$chatId.tsx
git commit -m "feat(chat): paywall the composer when out of allowance"
```

---

### Task 7: Build, manual verification, record the submodule pointer

**Files:** `libertai-chat` submodule pointer + final commit

- [ ] **Step 1: Full build**
```bash
cd /Users/reza/Documents/work/freelance/libertai/libertai-chat
pnpm exec tsc --noEmit && pnpm build && pnpm test
```
Expected: all clean/green.

- [ ] **Step 2: Manual check against beta**

Point chat's `VITE_LTAI_CONNECTED_API_URL` + `VITE_LTAI_INFERENCE_API_URL` at the beta backend (`https://beta.inference.api.libertai.io`) for the check, `pnpm dev`, sign in, and verify:
- Account button shows **Free + Upgrade**; clicking Upgrade opens `/plans`.
- `/plans` shows Free/Go/Plus (paid disabled — no fiat provider) with "Plan: free".
- Sidebar shows the weekly allowance meter.
- Drive usage past the free weekly window (2.0 credits) with no prepaid (or temporarily lower the tier window on beta) → the composer shows the paywall panel and won't send; logged-out chat still works on the free endpoint.

- [ ] **Step 3: Commit the submodule pointer + any remaining changes**
```bash
git add src/shared
git commit -m "chore(shared): bump submodule to shared subscription UI"
```
(If `src/shared` was already staged in an earlier commit, this is a no-op — ensure the final tree records the `feat/subscriptions-ui` pointer.)

---

## Self-review notes
- **Spec coverage:** account plan badge (T3), `/plans` page (T4), sidebar allowance meter (T5), composer paywall with reset countdown + Upgrade/Top-up (T6), shared-pieces wiring (T1). The "messages remaining" translation + 80% pre-wall toast remain out of scope (fast-follow), as agreed.
- **Anonymous path untouched:** all blocking is gated on `isAuthenticated` — logged-out users keep the free public endpoint.
- **Two-layer wall:** proactive (`allowed===false` from the subscription query) + reactive (`isPaywallError` catch on 401/402) so a user who crosses the line mid-session is caught even before the query refetches.
- **TDD where possible:** the pure helpers are unit-tested (chat has vitest); the React wiring is verified by typecheck + build + manual (no component test harness exists here).
- **Type consistency:** `isChatBlocked` reads `SubscriptionResponse.allowed` (added in Plan 2's SDK regen); `SidebarAllowance`/`ChatPaywall` read `weekly_used`/`weekly_limit`/`weekly_resets_at` (present on the type).

## Dependencies / ordering
1. Plan 1 (backend) — provides `allowed`/`source` + tiers (deployed to beta). ✅
2. Plan 2 (shared + console) — provides the shared hooks/components + regenerated SDK on `feat/subscriptions-ui`. **Must land first.**
3. This plan points chat's submodule at that branch (T1) and builds the chat UI on top.
