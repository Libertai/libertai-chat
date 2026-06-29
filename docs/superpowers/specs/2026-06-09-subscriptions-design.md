# Subscriptions + metered chat — design

Date: 2026-06-09. Repos: libertai-inference, libertai-api, libertai-models, libertai-web-shared, libertai-chat, libertai-console.

## Goal

Everybody free-by-default; chat usage consumes a free entitlement window, overflows to prepaid credits, then walls. Account button shows plan (ChatGPT-style "Free + Upgrade" / Claude-style "<Tier> plan"). Plans page. Paid subscribe flow built but provider-gated (Revolut unconfigured).

## Core rule

Every chargeable key bills usage **window-first → available credits → blocked** (existing `compute_source`). Chargeable = all key types **except liberclaw and x402** (those keep their current non-chargeable / separate path). The only change vs today: `chat` keys become chargeable like `api`/`cli`.

## Scope decisions (locked)

- Meter chat usage (text + image) on shared credit substrate. No separate image quota.
- Tiers: Free $0 / Go $8 / Plus $20. Drop Starter/Pro/Team. USD (was EUR).
- Free stays implicit (no DB row; `get_active_tier` defaults to free). No backfill migration.
- Exhaustion = hard 402 wall (upgrade/top-up + reset countdown). No "switch to free model" fallback this pass.
- Paid buttons auto-disable when no fiat provider (reuse console degradation). No Revolut creds/UUID setup.
- Shared UI extracted to web-shared; console migrates its local copies.

## Out of scope

Team tier, PAYG/x402 changes, LTAI −20% pricing, "messages remaining" translation + 80% toast, per-day image quotas, Revolut credential setup, dev free API tier, abuse rate-limiting (separate effort).

---

## Backend

### 1. Tiers — `libertai-inference/src/subscription_tiers.py`
Replace tier table:
- free: price_cents=0, currency USD, 5h=0.5, weekly=2.0
- go: price_cents=800, 5h=2.5, weekly=5.0
- plus: price_cents=2000, 5h=5.0, weekly=12.0
- DEFAULT_CURRENCY="USD". Tier order {free:0, go:1, plus:2}. PAID_TIERS={go, plus}.
- Keep placeholder `provider_plan_ids` (revolut) for go/plus — unconfigured provider gates them off.
- Verify upgrade/downgrade helpers (`is_upgrade`/`is_downgrade`) read the new order.

### 2. Enable flag — `src/config.py:156`
`SUBSCRIPTIONS_ENABLED=True` (env default flip + deploy env).

### 3. Make chat keys chargeable — `src/services/api_key.py` (~701)
Exclusion tuple becomes just `(liberclaw, x402)`. So api/cli/chat all → `open_windows` + `get_allowance_state` + tier/prepaid/blocked deduct. This makes image-gen-via-chat (already reported per-user to `/admin/usage`) deduct.

### 4. Route chat usage report past the chat-only branch — `src/routes/api_keys/api_keys.py:169-187`
Today `type==chat` logs a `ChatRequest` and returns without calling `register_inference_call`. Change: still record `ChatRequest` (history), but ALSO call `register_inference_call` for chat keys so deduction happens. (Image reports from libertai-models land here.)

### 5. Text chat metering — `src/routes/chat/proxy.py`
Currently: receives per-user key, replaces with shared `LIBERTAI_CHAT_API_KEY`, forwards, returns silently (no usage report). Add:
- Resolve per-user key → user_id (lookup ApiKey by incoming bearer before replacing).
- **Pre-flight**: `get_allowance_state(db, user_id)`. If `source=="blocked"` → return HTTP 402 JSON body `{detail, tier, prepaid_balance, weekly_resets_at, window_5h_resets_at}`.
- Forward as today. For streaming, inject `stream_options.include_usage=true` so a final usage chunk arrives; capture it. For non-streaming, read `usage` from response.
- **Post-response**: compute credits from input/output tokens via `AlephService` pricing (same calc libertai-models uses), then call `register_inference_call(key=per_user_key, credits_used, model_name, input_tokens, output_tokens)`. In-process, reliable (not fire-and-forget).
- Edge: if usage missing (client didn't allow include_usage / error), log warning; do not crash.

### 6. Whitelist entitlement-gate chat keys — `src/services/api_key.py` `get_admin_all_api_keys` (~580-639)
Chat keys currently fall through unconditionally (~636). When SUBSCRIPTIONS_ENABLED, run chat keys through the same `compute_source` check used for api/cli; drop `blocked` chat keys. Purpose: image-gen calls hit libertai-models directly (bypass inference proxy) — whitelist is the only block point for them. (Text is also blocked at proxy pre-flight; double cover is fine.)
- Accept the existing 30s refresh lag (known minor over-spend; not fixed this pass).

### 7. `SubscriptionResponse` already returns tier + windows + prepaid. No new endpoint. Confirm `/payments/tiers` returns the 3 tiers and `/payments/subscription` returns effective tier (free when no active sub).

### Backend correctness (in-scope, small)
- Ensure `register_inference_call` partial-deduction is acceptable (log only) — no change required this pass; note it.

---

## Frontend

### 8. Shared billing module — `libertai-web-shared` (submodule, source-consumed by both apps)
Move from console `src/hooks/data/use-payments.ts` + `src/components/billing/*` into web-shared (e.g. `billing/`):
- Hooks: `useSubscription`, `useTiers`, `usePaymentProviders`, `useBillingActions` (subscribe/upgrade/downgrade/cancel/topup). Gate on `isAuthenticated`.
- Components (radix/tailwind primitives web-shared already peer-deps; style via className): `AllowanceBar` (extract from console usage.tsx:47-68), `PlanBadge` (new), `PlansSection`/`PlanCard` (from console), optional `BuyCreditsSection`.
- Export from web-shared index; add vite alias if new (`@libertai/billing` or fold into `@libertai/auth`).
- Console: replace local copies with shared imports; flip `SHOW_PLANS=true` (billing.tsx:12) and `SHOW_PLAN_OVERVIEW=true` (usage.tsx:418) — paid buttons still gate on provider.

### 9. Credits source of truth — `libertai-web-shared`
Single source: the `/credits/balance` query (`useCredits` pattern). Delete the `getAPICredits()` stub (account.ts:314) and the `apiCredits=0` resets (~521, ~554); consumers use the query.

### 10. Account button plan indicator — both apps
- chat: `ConnectedAccountFooter.tsx` — show `PlanBadge` using `useSubscription().tier`. Free → label "Free" + Upgrade button → `/plans`. Subscribed → "<Tier> plan". Wire via `AccountMenu` header/items.
- console: `AccountFooter.tsx` analogous (link to `/billing`).

### 11. Plans page — chat `/plans` route (`src/routes/plans.tsx`)
Renders shared `PlansSection` (3 cards, current-plan marker, subscribe/upgrade/cancel). Layout auto-applies (sidebar+header). Add nav from account button Upgrade.

### 12. Chat allowance meter + wall — `libertai-chat`
- Sidebar: compact `AllowanceBar` (weekly window from `useSubscription`).
- `chat.$chatId.tsx` (~150-260): catch 402 from connected endpoint → render out-of-credits panel (tier, `weekly_resets_at` countdown, Upgrade → /plans, Top up → /top-up). Replace generic error path.
- Keep anonymous/free-endpoint path unchanged for logged-out users.

---

## Data flow (authed chat message)
1. chat → connected endpoint (`/chat/completions`) w/ per-user chat key.
2. inference proxy: resolve user → pre-flight allowance. blocked? 402 → wall.
3. forward (shared downstream key) → models → response (+usage chunk).
4. proxy computes cost, `register_inference_call(per_user_key,…)` → open_windows, tier? free : deduct prepaid.
5. next message: if now blocked, step 2 walls. Image-gen blocked via whitelist drop.

## Phasing (for writing-plans)
- P1 backend: tiers + flag + chargeable chat + usage routing + proxy metering/402 + whitelist gate. Verify with API/DB.
- P2 shared extraction + console migration (flags on).
- P3 chat UI: account badge, /plans, meter, 402 wall. web-shared getAPICredits fix.

## Implementation unknowns (resolve in-plan, no user input needed)
- web-shared billing components: confirm existing radix/tailwind primitives cover Button/Input/Card or add minimal ones.
- `AlephService` pricing import inside the chat proxy (5-min cache exists) — confirm cheap/available.
- Streaming usage: confirm downstream honors `stream_options.include_usage`; if not, count from response.
