# Subscriptions Plan 4 — Credit-billed (crypto) subscriptions

**Goal:** recurring tier subscriptions paid by deducting prepaid **credits** (provider id `credits`), renewed by an hourly cron — for wallet users. Email/OAuth users keep the Revolut (fiat) path. Both share the same `PlanSubscription` + entitlement windows (a credits "Plus" === a Revolut "Plus").

**Pattern source:** the removed agent-subscription cron (`SubscriptionService.process_renewal`, commit `12fe1664`) — credit deduction + hourly renewal + cancel-at-period-end. Grafted onto today's `PlanSubscription`/tier model, with upgrade/downgrade added.

**Decisions (locked):**
- Upgrade = **prorate the difference** (charge `(new_price − old_price) × remaining_fraction`, keep period end, switch tier now).
- Renewal with insufficient credits = **expire to Free immediately**.
- Downgrade = **at period end** (`pending_tier`, applied on next renewal; `free` ⇒ cancel).
- Naming: provider `credits` (only *surfaced* to wallet users in the UI; the backend doesn't care how they got the credits).

**Branches (stacked):** inference `feat/credit-subscriptions` off `feat/subscriptions-backend`; web-shared/console/chat `feat/credit-subscriptions` off `feat/subscriptions-ui`.

**Credits are USD-equivalent**, so monthly price = `tier.price_cents / 100` credits.

---

## Backend (libertai-inference)

### Task 1 — `CreditSubscriptionService` + optional checkout_url
**Files:** create `src/services/payments/credit_subscription.py`; modify `src/interfaces/payments.py` (`CheckoutResponse.checkout_url: str | None = None`); test `tests/test_credit_subscription.py`.

Operates on `PlanSubscription` rows with `provider="credits"`, using `CreditService.get_balance(user_id)` / `use_credits(user_id, amount)->bool` and logging to `plan_subscription_events`. All methods take a `db` session + commit by the caller (match `PaymentManager` style — flush, caller commits). Reads tiers via `get_tier`, `is_upgrade`, `is_downgrade`, `PAID_TIERS`.

- `monthly_price(tier) -> float` = `get_tier(tier).price_cents / 100`.
- `async subscribe(db, user, tier)`:
  - validate `tier in PAID_TIERS` else `ValueError`.
  - reject if the user already has an active/pending/overdue sub (any provider) → `ValueError("already subscribed")`.
  - `price = monthly_price(tier)`; `if get_balance(user.id) < price: raise ValueError("Insufficient credits — top up first")`.
  - `use_credits(user.id, price)`; create `PlanSubscription(user_id, tier, status="active", provider="credits", currency="USD", current_period_start=now, current_period_end=now+relativedelta(months=1), cancel_at_period_end=False)`; flush; `_log(sub, "activated")`. Return the sub.
- `async upgrade(db, user, new_tier)`:
  - load active `credits` sub; require `is_upgrade(sub.tier, new_tier)` else `ValueError`.
  - proration: `span = (current_period_end - current_period_start).total_seconds()`; `remaining = max(0, (current_period_end - now).total_seconds())`; `frac = remaining/span if span>0 else 1.0`; `charge = (monthly_price(new_tier) - monthly_price(sub.tier)) * frac` (≥0).
  - `if get_balance < charge: raise ValueError("Insufficient credits — top up first")`; `use_credits(charge)` (skip if charge≈0); `sub.tier = new_tier` (keep period end); `sub.pending_tier=None`; `_log(sub, "upgraded")`.
- `async request_downgrade(db, user, new_tier)`:
  - load active `credits` sub; require `is_downgrade(sub.tier, new_tier)` else `ValueError`.
  - `sub.pending_tier = new_tier`; if `new_tier == "free"`: `sub.cancel_at_period_end = True`. `_log(sub, "downgrade_requested")`. Effective date = `current_period_end`.
- `async cancel(db, user)`:
  - load active `credits` sub; `sub.cancel_at_period_end = True`; `_log(sub, "cancel_requested")`. Effective = `current_period_end`.
- `async process_renewals(db, now=None) -> int` (the cron core):
  - select `PlanSubscription` where `provider=="credits"`, `status=="active"`, `current_period_end <= now`, `with_for_update`.
  - for each:
    - if `cancel_at_period_end` or `pending_tier == "free"`: `status="expired"`; `_log(sub,"expired")`; continue.
    - `target = sub.pending_tier or sub.tier`; `price = monthly_price(target)`.
    - if `get_balance(user_id) < price`: `status="expired"`; `_log(sub,"expired_insufficient_credits")`; continue.
    - `use_credits(user_id, price)`; `sub.tier=target`; `sub.pending_tier=None`; `sub.current_period_start=now`; `sub.current_period_end=now+1mo`; `_log(sub,"renewed")`.
  - return count.
- `_log(sub, event_type, metadata=None)` → add `PlanSubscriptionEvent` (no provider_event_id needed; these are local).

**Tests** (`tests/test_credit_subscription.py`, mirror `tests/test_payment_manager.py` style with the `db` fixture + seed a user with credits via `CreditService.add_credits_for_user`):
- subscribe deducts price, creates active sub with `provider="credits"`, period ~1mo.
- subscribe with insufficient credits raises + creates no sub + no deduction.
- renewal when due + funded → deducts, advances period, stays active.
- renewal when due + unfunded → status expired, no deduction-below-zero.
- cancel → cancel_at_period_end; renewal of a cancelled sub → expired (no charge).
- upgrade prorated → charges `(new−old)×frac`, tier switched, period end unchanged.
- downgrade → pending_tier set; renewal applies pending_tier at the lower price.

### Task 2 — route the `credits` provider
**Files:** modify `src/routes/payments/payments.py`; test `tests/test_payment_routes.py`.

In `subscribe`/`upgrade`/`downgrade`/`cancel`: if the request/sub provider is `"credits"`, use `CreditSubscriptionService` instead of `_require_provider`+`PaymentManager` (credits is not in `payment_registry`). Credits responses carry **no** checkout_url:
- `subscribe`/`upgrade` (credits) → `CheckoutResponse(checkout_url=None)` after the in-process charge. Catch `ValueError` → 400 (insufficient credits / already subscribed).
- `downgrade`/`cancel` (sub.provider == "credits") → call the credit service, return the existing `DowngradeResponse`/`CancelResponse`.
- Revolut path unchanged. (`_require_subscriptions_enabled` is gone — subscriptions always on.)

**Tests:** authed user with seeded credits → `POST /payments/subscribe {provider:"credits", tier:"go"}` → 200, `checkout_url=null`, `GET /payments/subscription` shows tier=go/active; insufficient credits → 400.

### Task 3 — renewal cron
**Files:** modify `src/routes/payments/payments.py` (add a scheduled job alongside `expire_subscriptions`).
```python
@scheduler.scheduled_job("interval", hours=1)
async def renew_credit_subscriptions() -> int:
    async with AsyncSessionLocal() as db:
        count = await CreditSubscriptionService.process_renewals(db)
        await db.commit()
    return count
```
**Test:** seed an active credits sub with `current_period_end` in the past + funded → run `process_renewals` → renewed + period advanced; unfunded → expired. (Covered in Task 1 tests; this task just wires the cron.)

---

## Frontend (web-shared + apps)

### Task 4 — route by auth type; handle the no-redirect credits flow
**Files:** `libertai-web-shared/auth/use-payments.ts` (`useBillingActions`), `libertai-web-shared/auth/PlansSection.tsx`.

- `useBillingActions`: the `subscribe`/`upgrade` mutations already POST `{provider, tier}`. When the response has **no `checkout_url`** (credits path), don't redirect — `invalidateQueries(["subscription"])` + success toast. On error, surface the detail (e.g. "Insufficient credits — top up first").
- `PlansSection`: pick the provider by **wallet presence** — `const { account } = useAccountStore(...)`. If `account` (wallet) → `provider = "credits"`; else → the fiat provider id (`revolut`). Enable paid buttons when **either** a wallet is connected (credits) **or** a fiat provider exists. Keep the "card payments not configured" hint only for the non-wallet, no-fiat case.
- Insufficient-credits error → toast already surfaces it; optionally link to top-up (app-specific, can be a fast-follow).

### Task 5 — adopt in chat + console
Bump both apps' `src/shared` submodule to the new web-shared commit; `tsc`/`build`; verify wallet user sees the credits flow (no redirect, sub goes active after a top-up) and email user still sees Revolut. Commit submodule bumps.

---

## Notes / out of scope
- No proration *refund* on downgrade (period-end only) — matches the decision.
- `process_renewals` runs hourly; a sub renews within ≤1h of its period end (fine).
- One active sub per user (existing partial unique index on pending/active/overdue) — a user can't hold both a credits and a Revolut sub at once.
- Frontend "top up then it auto-subscribes" is NOT built — user tops up, then clicks subscribe; insufficient-credit subscribe returns a clear 400.
