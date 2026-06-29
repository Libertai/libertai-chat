# Subscriptions Plan 2 — Shared billing UI + console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move the console's subscription UI + data hooks into the shared package so both apps use them, add a plan badge to the shared account menu, surface the allowance meters, and make the SDK expose `allowed`/`source` + USD tiers. Console becomes the reference consumer; chat (Plan 3) reuses the same shared pieces.

**Architecture:** `libertai-web-shared` is a git submodule mounted at `src/shared` in BOTH `libertai-console` and `libertai-chat`, consumed as source via vite aliases (`@libertai/auth`, `@libertai/inference-sdk`). Edits live in the submodule repo; each app then bumps its submodule pointer. The subscription data hooks + presentational components move into `@libertai/auth`; `BuyCreditsSection` stays in console (it depends on console-only `CryptoCheckout`).

**Tech stack:** React 19, TanStack Router + Query, Tailwind + shadcn-style primitives, `@hey-api/openapi-ts` codegen. **No test runner in console/web-shared** — verify with `pnpm tsc`/`pnpm build`/`pnpm lint` and a manual check.

**Repos & paths:**
- web-shared repo (the submodule): `/Users/reza/Documents/work/freelance/libertai/libertai-web-shared` — work here, commit, push.
- console: `/Users/reza/Documents/work/freelance/libertai/libertai-console` — its `src/shared` is the submodule checkout. After web-shared commits, bump the pointer here.
- Beta backend (has `allowed`/`source` + USD tiers): `https://beta.inference.api.libertai.io`

**Package manager:** pnpm everywhere.

**Submodule workflow (applies to every web-shared change):** edit under the submodule, `git -C <app>/src/shared add/commit/push` on a branch, then in the app `git add src/shared && git commit` to record the new pointer. Do BOTH apps' pointer bumps only where the plan says (console here; chat in Plan 3). Use a branch `feat/subscriptions-ui` in web-shared.

---

### Task 1: Regenerate the inference SDK from the beta backend

Brings `allowed`/`source` onto `SubscriptionResponse` and confirms the USD Free/Go/Plus tier shape. Runs in the web-shared submodule (shared by both apps).

**Files:**
- Modify (generated): `libertai-web-shared/inference-sdk/*` (via `pnpm gen:sdk`)
- Check: `libertai-web-shared/openapi-ts.config.ts`

- [ ] **Step 1: Point codegen at the beta backend and regenerate**

In `libertai-web-shared`, read `openapi-ts.config.ts` to find the `input`/source URL. Temporarily set it to `https://beta.inference.api.libertai.io/openapi.json` (or pass via env if it reads one), then:

```bash
cd /Users/reza/Documents/work/freelance/libertai/libertai-web-shared
pnpm install
pnpm gen:sdk
```

Revert `openapi-ts.config.ts` to its original source value afterward if you changed the file (do NOT commit a beta URL as the permanent source).

- [ ] **Step 2: Verify the new fields landed**

```bash
cd /Users/reza/Documents/work/freelance/libertai/libertai-web-shared
rg -n "allowed|source" inference-sdk/types.gen.ts | rg -i "subscription" -A1 || rg -n "allowed\??:|source\??:" inference-sdk/types.gen.ts
```
Expected: `SubscriptionResponse` now contains `allowed?: boolean` and `source?: string`.

- [ ] **Step 3: Commit in the submodule**

```bash
cd /Users/reza/Documents/work/freelance/libertai/libertai-web-shared
git checkout -b feat/subscriptions-ui 2>/dev/null || git checkout feat/subscriptions-ui
git add inference-sdk
git commit -m "chore(sdk): regen inference SDK (adds subscription allowed/source)"
```

---

### Task 2: Move the billing hooks into web-shared

**Files:**
- Create: `libertai-web-shared/auth/use-payments.ts`
- Modify: `libertai-web-shared/auth/index.ts`, `libertai-web-shared/package.json` (peerDeps)
- Delete later (Task 7): `libertai-console/src/hooks/data/use-payments.ts`

- [ ] **Step 1: Create the shared hooks file**

Create `libertai-web-shared/auth/use-payments.ts` with the exact current console hooks, but with imports rewired to relative shared paths (`./account`, `../inference-sdk`):

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	cancelPaymentsCancelPost,
	downgradePaymentsDowngradePost,
	getSubscriptionPaymentsSubscriptionGet,
	listProvidersPaymentsProvidersGet,
	listTiersPaymentsTiersGet,
	subscribePaymentsSubscribePost,
	topupPaymentsTopupPost,
	upgradePaymentsUpgradePost,
} from "../inference-sdk";
import { useAccountStore } from "./account";

const unwrap = <T>(response: { data?: T; error?: unknown }, fallback: string): T => {
	if (response.error) {
		const detail = (response.error as { detail?: unknown })?.detail;
		throw new Error(detail ? detail.toString() : fallback);
	}
	return response.data as T;
};

/** Providers available to the current user (fiat for everyone, the matching chain provider for wallet users). */
export function usePaymentProviders() {
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	return useQuery({
		queryKey: ["paymentProviders"],
		queryFn: async () => unwrap(await listProvidersPaymentsProvidersGet(), "Failed to load payment providers"),
		enabled: isAuthenticated,
	});
}

/** Subscription tiers + pricing/allowances (public). */
export function useTiers() {
	return useQuery({
		queryKey: ["paymentTiers"],
		queryFn: async () => unwrap(await listTiersPaymentsTiersGet(), "Failed to load tiers"),
		staleTime: 60 * 60 * 1000,
	});
}

/** Current subscription state + dual-window allowance snapshot. */
export function useSubscription() {
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	return useQuery({
		queryKey: ["subscription"],
		queryFn: async () => unwrap(await getSubscriptionPaymentsSubscriptionGet(), "Failed to load subscription"),
		enabled: isAuthenticated,
	});
}

/** Billing actions. Checkout flows redirect the browser to the provider's hosted page. */
export function useBillingActions() {
	const queryClient = useQueryClient();

	const redirectTo = (url?: string) => {
		if (url) window.location.href = url;
	};

	const onError = (action: string) => (error: unknown) =>
		toast.error(`Failed to ${action}`, {
			description: error instanceof Error ? error.message : "Unknown error occurred",
		});

	const topup = useMutation({
		mutationFn: async ({ provider, amount }: { provider: string; amount: number }) =>
			unwrap(await topupPaymentsTopupPost({ body: { provider, amount } }), "Failed to start top-up"),
		onSuccess: (data) => redirectTo(data.checkout_url),
		onError: onError("start top-up"),
	});

	const subscribe = useMutation({
		mutationFn: async ({ provider, tier }: { provider: string; tier: string }) =>
			unwrap(await subscribePaymentsSubscribePost({ body: { provider, tier } }), "Failed to subscribe"),
		onSuccess: (data) => redirectTo(data.checkout_url),
		onError: onError("subscribe"),
	});

	const upgrade = useMutation({
		mutationFn: async ({ provider, tier }: { provider: string; tier: string }) =>
			unwrap(await upgradePaymentsUpgradePost({ body: { provider, tier } }), "Failed to upgrade"),
		onSuccess: (data) => redirectTo(data.checkout_url),
		onError: onError("upgrade"),
	});

	const cancel = useMutation({
		mutationFn: async () => unwrap(await cancelPaymentsCancelPost(), "Failed to cancel"),
		onSuccess: async (data) => {
			toast.success(data.message);
			await queryClient.invalidateQueries({ queryKey: ["subscription"] });
		},
		onError: onError("cancel subscription"),
	});

	const downgrade = useMutation({
		mutationFn: async ({ tier }: { tier: string }) =>
			unwrap(await downgradePaymentsDowngradePost({ body: { tier } }), "Failed to downgrade"),
		onSuccess: async () => {
			toast.success("Downgrade scheduled for the end of the billing period");
			await queryClient.invalidateQueries({ queryKey: ["subscription"] });
		},
		onError: onError("downgrade"),
	});

	return { topup, subscribe, upgrade, cancel, downgrade };
}
```

- [ ] **Step 2: Add `@tanstack/react-query` to web-shared peerDependencies**

In `libertai-web-shared/package.json` add to `peerDependencies` (keep alphabetical-ish, match the `"*"` style):
```json
		"@tanstack/react-query": "*",
```
(`sonner` is already a peerDep. Both apps already dedupe `@tanstack/react-query` in their vite config.)

- [ ] **Step 3: Export the hooks from the shared barrel**

Append to `libertai-web-shared/auth/index.ts`:
```typescript
export { usePaymentProviders, useTiers, useSubscription, useBillingActions } from "./use-payments";
```

- [ ] **Step 4: Typecheck the submodule**

```bash
cd /Users/reza/Documents/work/freelance/libertai/libertai-web-shared
pnpm install
pnpm exec tsc --noEmit
```
Expected: no errors. (If web-shared has no `tsc` script, run `pnpm exec tsc --noEmit -p tsconfig.json`.)

- [ ] **Step 5: Commit in the submodule**

```bash
git add auth/use-payments.ts auth/index.ts package.json
git commit -m "feat(billing): move subscription/payment hooks into shared"
```

---

### Task 3: Move `AllowanceBar` into web-shared

**Files:**
- Create: `libertai-web-shared/auth/AllowanceBar.tsx`
- Modify: `libertai-web-shared/auth/index.ts`

- [ ] **Step 1: Create the shared component** (verbatim from console `usage.tsx:32-68`, exported):

```tsx
function formatCountdown(resetsAt: string | null | undefined, now: number): string | null {
	if (!resetsAt) return null;
	const diff = new Date(resetsAt).getTime() - now;
	if (diff <= 0) return null;
	const s = Math.floor(diff / 1000);
	const d = Math.floor(s / 86400);
	const h = Math.floor((s % 86400) / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	if (d > 0) return `${d}d ${h}h`;
	if (h > 0) return `${h}h ${m}m`;
	if (m > 0) return `${m}m ${sec}s`;
	return `${sec}s`;
}

export function AllowanceBar({
	label,
	used,
	limit,
	resetsAt,
	now,
}: Readonly<{ label: string; used: number; limit: number; resetsAt?: string | null; now: number }>) {
	const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
	const countdown = formatCountdown(resetsAt, now);
	return (
		<div>
			<div className="flex justify-between text-sm mb-1">
				<span className="text-muted-foreground">{label}</span>
				<span className="font-medium">{pct}% used</span>
			</div>
			<div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
				<div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
			</div>
			{countdown && <p className="text-xs text-muted-foreground mt-1 text-right">Resets in {countdown}</p>}
		</div>
	);
}
```

- [ ] **Step 2: Export it** — append to `auth/index.ts`:
```typescript
export { AllowanceBar } from "./AllowanceBar";
```

- [ ] **Step 3: Commit**
```bash
git add auth/AllowanceBar.tsx auth/index.ts
git commit -m "feat(billing): move AllowanceBar into shared"
```

---

### Task 4: Create the shared `PlanBadge`

A small presentational badge for the account menu: shows `Free` + an **Upgrade** button when on free, or `<Tier> plan` when subscribed. Uses the shared `useSubscription` + shared `Button`.

**Files:**
- Create: `libertai-web-shared/auth/PlanBadge.tsx`
- Modify: `libertai-web-shared/auth/index.ts`

- [ ] **Step 1: Create the component**

```tsx
import { useSubscription } from "./use-payments";
import { Button } from "./ui/button";

export type PlanBadgeProps = {
	/** Called when the user clicks Upgrade (app routes to its plans/billing page). */
	onUpgrade?: () => void;
};

/**
 * Compact plan indicator for the account menu. Free users see "Free" + an Upgrade button
 * (ChatGPT-style); subscribed users see "<Tier> plan" (Claude-style). Renders nothing until
 * the subscription query resolves (avoids a flicker of the wrong state).
 */
export function PlanBadge({ onUpgrade }: PlanBadgeProps) {
	const { data: subscription } = useSubscription();
	if (!subscription) return null;

	const tier = subscription.tier ?? "free";
	const isFree = tier === "free" || !subscription.has_subscription;

	if (isFree) {
		return (
			<div className="flex items-center gap-2">
				<span className="text-xs text-muted-foreground">Free</span>
				{onUpgrade && (
					<Button
						size="sm"
						variant="outline"
						className="h-6 px-2 text-xs"
						onClick={(e) => {
							e.stopPropagation();
							onUpgrade();
						}}
					>
						Upgrade
					</Button>
				)}
			</div>
		);
	}

	return <span className="text-xs text-muted-foreground capitalize">{tier} plan</span>;
}
```

(Confirm the shared button path: the explorer found primitives in `libertai-web-shared/auth/ui/`. If the file is `auth/ui/button.tsx`, the import `./ui/button` is correct; adjust if the export name differs — check `auth/ui/button.tsx`'s export.)

- [ ] **Step 2: Export it** — append to `auth/index.ts`:
```typescript
export { PlanBadge, type PlanBadgeProps } from "./PlanBadge";
```

- [ ] **Step 3: Commit**
```bash
git add auth/PlanBadge.tsx auth/index.ts
git commit -m "feat(billing): add shared PlanBadge"
```

---

### Task 5: Move `PlansSection` into web-shared (USD, Free/Go/Plus)

**Files:**
- Create: `libertai-web-shared/auth/PlansSection.tsx`
- Modify: `libertai-web-shared/auth/index.ts`

- [ ] **Step 1: Create the shared component** — the console version, with imports rewired to shared (`./use-payments`, `./ui/button`), taglines updated to Free/Go/Plus, and the price label using the tier's `currency` instead of a hardcoded `€`:

```tsx
import { useMemo } from "react";
import { Zap } from "lucide-react";
import { Button } from "./ui/button";
import { useBillingActions, usePaymentProviders, useSubscription, useTiers } from "./use-payments";

// Qualitative descriptions — we deliberately don't surface raw allowance numbers.
const TIER_TAGLINES: Record<string, string> = {
	free: "For getting started and light use",
	go: "For regular individual use",
	plus: "For heavy, daily workloads",
};

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€" };

export function PlansSection() {
	const { data: subscription } = useSubscription();
	const { data: tiers } = useTiers();
	const { data: providers } = usePaymentProviders();
	const { subscribe, upgrade, downgrade, cancel } = useBillingActions();

	const fiatProvider = useMemo(() => providers?.find((p) => p.kind === "fiat"), [providers]);
	const tierOrder = useMemo(() => {
		const map: Record<string, number> = {};
		(tiers ?? []).forEach((t, i) => (map[t.name] = i));
		return map;
	}, [tiers]);

	const currentTier = subscription?.tier ?? "free";
	const hasActivePaidSub =
		!!subscription?.has_subscription && subscription?.status === "active" && currentTier !== "free";

	const handleTierAction = (tierName: string) => {
		const provider = fiatProvider?.id ?? "revolut";
		const target = tierOrder[tierName] ?? 0;
		const current = tierOrder[currentTier] ?? 0;
		if (tierName === "free") {
			downgrade.mutate({ tier: "free" });
		} else if (target > current) {
			(hasActivePaidSub ? upgrade : subscribe).mutate({ provider, tier: tierName });
		} else if (target < current) {
			downgrade.mutate({ tier: tierName });
		}
	};

	return (
		<div className="flex flex-col space-y-4">
			<div className="flex items-center justify-between flex-wrap gap-3">
				<div className="flex items-center gap-3">
					<Zap className="h-5 w-5 text-primary" />
					<h2 className="text-xl font-semibold">
						Plan: <span className="capitalize text-primary">{currentTier}</span>
					</h2>
				</div>
				{hasActivePaidSub &&
					(subscription?.cancel_at_period_end ? (
						<span className="text-sm text-muted-foreground">Cancels at period end</span>
					) : (
						<Button variant="outline" size="sm" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
							Cancel subscription
						</Button>
					))}
			</div>

			<div className="grid gap-4 md:grid-cols-3">
				{(tiers ?? []).map((tier) => {
					const isCurrent = tier.name === currentTier;
					const symbol = CURRENCY_SYMBOL[tier.currency] ?? "$";
					return (
						<div
							key={tier.name}
							className={`p-6 rounded-xl border ${isCurrent ? "border-primary" : "border-border"} bg-card/50 flex flex-col`}
						>
							<h3 className="text-lg font-semibold capitalize">{tier.name}</h3>
							<p className="text-2xl font-bold mt-2">
								{tier.price_cents === 0 ? "Free" : `${symbol}${(tier.price_cents / 100).toFixed(0)}`}
								{tier.price_cents > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
							</p>
							<p className="mt-4 text-sm text-muted-foreground flex-1">{TIER_TAGLINES[tier.name] ?? ""}</p>
							<Button
								className="mt-4 w-full"
								variant={isCurrent ? "outline" : "default"}
								disabled={isCurrent || (tier.is_paid && !fiatProvider)}
								onClick={() => handleTierAction(tier.name)}
							>
								{isCurrent
									? "Current plan"
									: (tierOrder[tier.name] ?? 0) > (tierOrder[currentTier] ?? 0)
										? "Upgrade"
										: "Downgrade"}
							</Button>
						</div>
					);
				})}
			</div>
			{!fiatProvider && (
				<p className="text-xs text-muted-foreground">Paid plans become available once card payments are configured.</p>
			)}
		</div>
	);
}
```

(Grid changed `lg:grid-cols-4` → `md:grid-cols-3` for three tiers.)

- [ ] **Step 2: Export it** — append to `auth/index.ts`:
```typescript
export { PlansSection } from "./PlansSection";
```

- [ ] **Step 3: Typecheck + commit**
```bash
cd /Users/reza/Documents/work/freelance/libertai/libertai-web-shared
pnpm exec tsc --noEmit
git add auth/PlansSection.tsx auth/index.ts
git commit -m "feat(billing): move PlansSection into shared (USD, Free/Go/Plus)"
```

---

### Task 6: Add a `planBadge` slot to the shared `AccountMenu`

**Files:**
- Modify: `libertai-web-shared/auth/AccountMenu.tsx`

- [ ] **Step 1: Add the prop**

In `AccountMenuProps` (after `onAction`) add:
```typescript
	/** Optional plan indicator rendered under the display name in the trigger (e.g. <PlanBadge/>). */
	planBadge?: ReactNode;
```
Add `planBadge` to the destructured props of the component.

- [ ] **Step 2: Render it in the trigger** — in the trigger's name column (the `<div className="flex flex-col items-start flex-1 min-w-0">` block), add the badge under the name:
```tsx
				<div className="flex flex-col items-start flex-1 min-w-0">
					<div className="text-md font-medium truncate w-full text-left">{label}</div>
					{planBadge && <div className="mt-0.5">{planBadge}</div>}
				</div>
```

- [ ] **Step 3: Typecheck + commit**
```bash
cd /Users/reza/Documents/work/freelance/libertai/libertai-web-shared
pnpm exec tsc --noEmit
git add auth/AccountMenu.tsx
git commit -m "feat(account-menu): optional planBadge slot in the trigger"
git push -u origin feat/subscriptions-ui
```

---

### Task 7: Console — consume the shared pieces, flip the flags

**Files:**
- Delete: `libertai-console/src/hooks/data/use-payments.ts`
- Delete: `libertai-console/src/components/billing/PlansSection.tsx`
- Modify: `libertai-console/src/components/billing/BuyCreditsSection.tsx` (import hooks from shared)
- Modify: `libertai-console/src/routes/billing.tsx` (`SHOW_PLANS=true`, import `PlansSection` from shared)
- Modify: `libertai-console/src/routes/usage.tsx` (`SHOW_PLAN_OVERVIEW=true`, import `AllowanceBar` from shared, delete the inline copy)
- Modify: `libertai-console/src/components/AccountFooter.tsx` (pass `planBadge`)
- Modify: `libertai-console` submodule pointer (`src/shared`)

- [ ] **Step 1: Bump the console submodule pointer to the web-shared branch**

```bash
cd /Users/reza/Documents/work/freelance/libertai/libertai-console/src/shared
git fetch origin && git checkout feat/subscriptions-ui && git pull
cd /Users/reza/Documents/work/freelance/libertai/libertai-console
pnpm install
```

- [ ] **Step 2: Repoint console imports to the shared hooks**

- Delete `src/hooks/data/use-payments.ts`.
- In every file that imported from `@/hooks/data/use-payments` (find them: `rg -n "hooks/data/use-payments" src`), change the import to `@libertai/auth`. Known consumers: `src/components/billing/BuyCreditsSection.tsx`, the deleted `PlansSection.tsx` (now shared), and `src/routes/usage.tsx`. Example:
```typescript
// before
import { useBillingActions, usePaymentProviders } from "@/hooks/data/use-payments";
// after
import { useBillingActions, usePaymentProviders } from "@libertai/auth";
```

- [ ] **Step 3: Use the shared `PlansSection` + flip `SHOW_PLANS`**

- Delete `src/components/billing/PlansSection.tsx`.
- In `src/routes/billing.tsx`: change the import to `import { PlansSection } from "@libertai/auth";` and set `const SHOW_PLANS = true;`.

- [ ] **Step 4: Use the shared `AllowanceBar` + flip `SHOW_PLAN_OVERVIEW`**

In `src/routes/usage.tsx`:
- Delete the inline `formatCountdown` + `AllowanceBar` definitions (the ~32-68 block).
- Add `import { AllowanceBar } from "@libertai/auth";`.
- Set `const SHOW_PLAN_OVERVIEW = true;`.
- Leave the existing `<AllowanceBar .../>` usages as-is (same props).

- [ ] **Step 5: Show the plan badge in the console account footer**

In `src/components/AccountFooter.tsx`:
```tsx
import { Settings } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { AccountMenu, PlanBadge } from "@libertai/auth";
import { useSidebar } from "@/components/ui/sidebar";

export default function AccountFooter() {
	const navigate = useNavigate();
	const { isMobile, setOpenMobile } = useSidebar();

	return (
		<AccountMenu
			planBadge={<PlanBadge onUpgrade={() => navigate({ to: "/billing" })} />}
			items={[
				{
					label: "Settings",
					icon: <Settings className="h-4 w-4" />,
					onSelect: () => navigate({ to: "/settings" }),
				},
			]}
			onSignedOut={() => navigate({ to: "/" })}
			onAction={() => {
				if (isMobile) setOpenMobile(false);
			}}
		/>
	);
}
```

- [ ] **Step 6: Typecheck + build + manual check**

```bash
cd /Users/reza/Documents/work/freelance/libertai/libertai-console
pnpm exec tsc --noEmit && pnpm build
```
Expected: clean. Then `pnpm dev`, sign in against the beta backend (point the console's inference API base at `https://beta.inference.api.libertai.io` via its env for the manual check), and verify: account footer shows **Free + Upgrade**; `/billing` shows the three plan cards (paid disabled — no fiat provider) + a "Plan: free" header; `/usage` overview shows the two allowance bars.

- [ ] **Step 7: Commit (console, including the submodule pointer)**

```bash
cd /Users/reza/Documents/work/freelance/libertai/libertai-console
git add -A
git commit -m "feat(billing): adopt shared subscription UI; surface plans + allowance meters"
```

---

### Task 8: Remove the dead `getAPICredits` stub (cleanup, only if unused)

The real balance source is `useCredits()` (`/credits/balance`). The account store's `apiCredits`/`getAPICredits`/`formattedAPICredits` is a `0` placeholder.

**Files:** `libertai-web-shared/auth/account.ts` (+ any references)

- [ ] **Step 1: Check for usage across BOTH apps**
```bash
rg -n "formattedAPICredits|getAPICredits|\.apiCredits" /Users/reza/Documents/work/freelance/libertai/libertai-console/src /Users/reza/Documents/work/freelance/libertai/libertai-chat/src /Users/reza/Documents/work/freelance/libertai/libertai-web-shared/auth
```

- [ ] **Step 2: If the only hits are the definitions in `account.ts`** (no app reads them), remove the `apiCredits` field, `formattedAPICredits`, `getAPICredits`, and the two `apiCredits` set/reset sites (login ~519-525, `onDisconnect` ~557). Then `pnpm exec tsc --noEmit` in web-shared, commit `chore(account): drop dead apiCredits placeholder`, and bump the console pointer again. **If anything outside `account.ts` references them, SKIP this task** (leave a note) — don't refactor consumers in this plan.

---

## Self-review notes
- **Spec coverage:** SDK `allowed`/`source` (T1), shared hooks (T2), AllowanceBar (T3), PlanBadge (T4), PlansSection USD/Go/Plus (T5), account-menu slot (T6), console adoption + flag flips + footer badge (T7), credits-source cleanup (T8). `BuyCreditsSection` intentionally stays in console (CryptoCheckout dependency).
- **No test runner** in these repos → verification is `tsc --noEmit` + `build` + a manual pass against beta. This is a deliberate deviation from TDD because the tooling doesn't exist here; do not scaffold a test runner as part of this plan.
- **Submodule discipline:** every web-shared change is committed in the submodule first, then the console pointer is bumped (T7 step 1 + commit at step 7). Chat's pointer bump happens in Plan 3.
- **Type consistency:** hooks return SDK types (`SubscriptionResponse` etc.); `PlanBadge`/`PlansSection` read `tier`, `has_subscription`, `status`, `cancel_at_period_end`, `price_cents`, `currency`, `is_paid`, `name` — all present on the regenerated types.

## Dependency on beta
`allowed`/`source` only exist on the beta backend until PR #52 merges to prod. Keep the SDK regen (T1) sourced from beta; once prod has it, a later routine regen against prod is a no-op for these fields.
