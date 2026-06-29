# Subscriptions Plan 1 — Backend metering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make authenticated chat (text + image) consume the dual-window free allowance then overflow to prepaid credits then block, unify tiers to Free/Go/Plus (USD), and enable subscriptions — without breaking anonymous free chat.

**Architecture:** Authenticated chat already hits the gateway (`api.libertai.io`) with a per-user `chat` key and reports usage per-user to `POST /api-keys/admin/usage` (today only logged, never charged). We make `chat` keys chargeable, count their usage in the entitlement windows, gate them in the admin whitelist, and meter them at the usage endpoint — while special-casing the shared `LIBERTAI_CHAT_API_KEY` (the anonymous free path) so it stays free and always-whitelisted. The inference `/chat/completions` proxy (anonymous path) is untouched.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy async, pytest + pytest-asyncio (`asyncio_mode=auto`), Postgres test DB (`scripts/dev.sh`).

**Repo:** `/Users/reza/Documents/work/freelance/libertai/libertai-inference` (all paths below are relative to it). Run tests with `poetry run pytest`.

**Key invariant changes:**
- OLD: chat usage is always free (`chat` excluded from charge + whitelist gate).
- NEW: per-user chat usage = window → prepaid → blocked, exactly like `api`/`cli`. The only always-free key is the shared `config.LIBERTAI_CHAT_API_KEY` (anonymous endpoint service key).

---

### Task 1: Retier to Free / Go / Plus (USD)

**Files:**
- Modify: `src/subscription_tiers.py:20-92`
- Test: `tests/test_subscription_tiers.py` (create)
- Update (tier-key references): `tests/test_payment_manager.py`, `tests/test_entitlement.py:112-117`, `tests/test_admin_list_enforcement.py:127`, `tests/test_payment_routes.py:39`, `tests/test_payments_migration.py:69-75`

- [ ] **Step 1: Write the failing test**

Create `tests/test_subscription_tiers.py`:

```python
"""Tier table is Free/Go/Plus in USD, ordered, with Go/Plus paid."""

from src.subscription_tiers import (
    DEFAULT_CURRENCY,
    PAID_TIERS,
    SUBSCRIPTION_TIERS,
    TIER_ORDER,
    get_tier,
    is_upgrade,
)


def test_tiers_are_free_go_plus_usd():
    assert set(SUBSCRIPTION_TIERS) == {"free", "go", "plus"}
    assert DEFAULT_CURRENCY == "USD"
    assert all(t.currency == "USD" for t in SUBSCRIPTION_TIERS.values())


def test_tier_prices_and_windows():
    free, go, plus = get_tier("free"), get_tier("go"), get_tier("plus")
    assert (free.price_cents, free.window_5h_credits, free.weekly_credits) == (0, 0.5, 2.0)
    assert (go.price_cents, go.window_5h_credits, go.weekly_credits) == (800, 2.5, 5.0)
    assert (plus.price_cents, plus.window_5h_credits, plus.weekly_credits) == (2000, 5.0, 12.0)


def test_order_and_paid_set():
    assert TIER_ORDER == {"free": 0, "go": 1, "plus": 2}
    assert PAID_TIERS == {"go", "plus"}
    assert is_upgrade("free", "plus") is True
    assert is_upgrade("plus", "go") is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `poetry run pytest tests/test_subscription_tiers.py -v`
Expected: FAIL (`{'free','starter','pro','team'}` != `{'free','go','plus'}`).

- [ ] **Step 3: Replace the tier table**

In `src/subscription_tiers.py`, change line 21 to `DEFAULT_CURRENCY = "USD"` and replace the whole `SUBSCRIPTION_TIERS` dict (lines 44-92) with:

```python
SUBSCRIPTION_TIERS: dict[str, TierConfig] = {
    "free": TierConfig(
        name="free",
        price_cents=0,
        currency=DEFAULT_CURRENCY,
        window_5h_credits=0.5,
        weekly_credits=2.0,
        provider_plan_ids={},
    ),
    "go": TierConfig(
        name="go",
        price_cents=800,
        currency=DEFAULT_CURRENCY,
        window_5h_credits=2.5,
        weekly_credits=5.0,
        provider_plan_ids={
            # NOTE: placeholder Revolut plan/variation UUIDs — replace before enabling Revolut.
            "revolut": {
                "plan_id": "a9a0b97f-753f-4e13-ac60-f86733809dce",
                "variation_id": "88e34b68-abea-497a-9743-01874274dcdf",
            }
        },
    ),
    "plus": TierConfig(
        name="plus",
        price_cents=2000,
        currency=DEFAULT_CURRENCY,
        window_5h_credits=5.0,
        weekly_credits=12.0,
        provider_plan_ids={
            "revolut": {
                "plan_id": "c4c23aef-c39d-419d-99b6-f84034102615",
                "variation_id": "2bdb31f1-78d5-48ad-88eb-c9c41fac57ef",
            }
        },
    ),
}
```

- [ ] **Step 4: Update existing tests that reference removed tier keys**

- `tests/test_payment_manager.py`: replace every `tier="starter"`→`tier="go"`, `tier="pro"`→`tier="plus"`, `new_tier="pro"`→`new_tier="plus"`, and the assertions `== "pro"`→`== "plus"`, `== "starter"`→`== "go"`, `parked.tier == "starter"`→`parked.tier == "go"`.
- `tests/test_entitlement.py:112,117`: `"pro"`→`"plus"`.
- `tests/test_admin_list_enforcement.py:127`: `tier="pro"`→`tier="plus"` (comment "fine for pro"→"fine for plus").
- `tests/test_payment_routes.py:39`: `{"free", "starter", "pro", "team"} <= names`→`{"free", "go", "plus"} == names`.
- `tests/test_payments_migration.py:69,75`: raw SQL tier strings `'pro'`→`'plus'`, `'starter'`→`'go'`.

- [ ] **Step 5: Run the full suite to verify green**

Run: `poetry run pytest tests/test_subscription_tiers.py tests/test_payment_manager.py tests/test_entitlement.py tests/test_admin_list_enforcement.py tests/test_payment_routes.py tests/test_payments_migration.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/subscription_tiers.py tests/test_subscription_tiers.py tests/test_payment_manager.py tests/test_entitlement.py tests/test_admin_list_enforcement.py tests/test_payment_routes.py tests/test_payments_migration.py
git commit -m "feat(tiers): retier to Free/Go/Plus in USD"
```

---

### Task 2: Count chat + cli usage in entitlement windows

**Files:**
- Modify: `src/services/entitlement.py:119-180` (`_usage_since`, `window_usage_by_users`)
- Test: `tests/test_entitlement.py`

Today both window-usage queries filter `ApiKeyDB.type == ApiKeyType.api`, so chat usage would never count against the window. Widen to all chargeable key types.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_entitlement.py` (reuse the file's existing `db`, `_subscribe`, user-seed helpers; mirror their style — read the top of the file first):

```python
async def test_chat_key_usage_counts_toward_window(db):
    # Seed a user with a chat key and one InferenceCall of 1.5 credits in an open weekly window.
    user = await _seed_user(db)  # use the file's existing user-seed helper
    chat_key = ApiKeyDB(key="ck_test_window", user_id=user.id, type=ApiKeyType.chat, name="chat", is_active=True)
    db.add(chat_key)
    await db.flush()
    from src.services.entitlement import open_windows, window_usage_by_users, WINDOW_WEEKLY
    now = datetime.now()
    await open_windows(db, user.id, now)
    db.add(InferenceCall(api_key_id=chat_key.id, credits_used=1.5, model_name="m", used_at=now))
    await db.flush()

    usage = await window_usage_by_users(db, {user.id}, WINDOW_WEEKLY, now)
    assert usage.get(user.id) == 1.5
```

(If `test_entitlement.py` lacks a `_seed_user` helper, create the user inline with the same pattern the file already uses for its other tests; import `ApiKeyDB`, `ApiKeyType`, `InferenceCall`, `datetime` at the top.)

- [ ] **Step 2: Run test to verify it fails**

Run: `poetry run pytest tests/test_entitlement.py::test_chat_key_usage_counts_toward_window -v`
Expected: FAIL (usage is empty — chat type excluded).

- [ ] **Step 3: Widen the type filter**

In `src/services/entitlement.py`, add near the window constants (after line 46):

```python
# Key types whose usage accrues against a user's entitlement windows + prepaid balance.
# Mirrors the chargeable set in api_key.py (everything except liberclaw / x402, and the
# shared anonymous chat service key which is filtered by value there).
CHARGEABLE_KEY_TYPES = (ApiKeyType.api, ApiKeyType.cli, ApiKeyType.chat)
```

In `_usage_since` (line ~127) change `ApiKeyDB.type == ApiKeyType.api,` to `ApiKeyDB.type.in_(CHARGEABLE_KEY_TYPES),`.

In `window_usage_by_users` (line ~173) change `ApiKeyDB.type == ApiKeyType.api,` to `ApiKeyDB.type.in_(CHARGEABLE_KEY_TYPES),`.

- [ ] **Step 4: Run test to verify it passes**

Run: `poetry run pytest tests/test_entitlement.py -v`
Expected: PASS (new test + existing entitlement tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/entitlement.py tests/test_entitlement.py
git commit -m "feat(entitlement): count chat/cli usage in windows"
```

---

### Task 3: Make chat keys chargeable (except the shared free key)

**Files:**
- Modify: `src/services/api_key.py:748-755`
- Test: `tests/test_inference_call_billing.py`

- [ ] **Step 1: Rewrite the billing tests to the new invariant**

Replace the body of `tests/test_inference_call_billing.py` test functions with the new behavior. Keep `_seed_user_with_credits`, `_balance` helpers. Replace `test_chat_key_usage_does_not_deduct_credits` and add cases:

```python
async def test_per_user_chat_key_deducts_when_subscriptions_disabled(monkeypatch):
    """Subscriptions off: a per-user chat key now draws down prepaid (no longer free)."""
    monkeypatch.setattr(config, "SUBSCRIPTIONS_ENABLED", False)
    address = "0xC4A7000000000000000000000000000000000010"
    user_id = await _seed_user_with_credits(address, 10.0)
    chat_key = await ApiKeyService.get_or_create_chat_api_key(user_id=user_id, user_address=address)

    ok = await ApiKeyService.register_inference_call(
        key=chat_key.full_key, credits_used=3.0, model_name="test-model"
    )
    assert ok is True
    assert await _balance(user_id) == 7.0  # chat now metered


async def test_per_user_chat_within_free_window_does_not_deduct(monkeypatch):
    """Subscriptions on, usage within the free weekly window (2.0): covered by tier, no deduct."""
    monkeypatch.setattr(config, "SUBSCRIPTIONS_ENABLED", True)
    address = "0xC4A7000000000000000000000000000000000013"
    user_id = await _seed_user_with_credits(address, 10.0)
    chat_key = await ApiKeyService.get_or_create_chat_api_key(user_id=user_id, user_address=address)

    ok = await ApiKeyService.register_inference_call(
        key=chat_key.full_key, credits_used=0.4, model_name="test-model"
    )
    assert ok is True
    assert await _balance(user_id) == 10.0  # within free window — not charged


async def test_shared_free_chat_key_never_deducts(monkeypatch):
    """The anonymous service key (config.LIBERTAI_CHAT_API_KEY) stays free regardless of flag."""
    monkeypatch.setattr(config, "SUBSCRIPTIONS_ENABLED", True)
    address = "0xC4A7000000000000000000000000000000000014"
    user_id = await _seed_user_with_credits(address, 10.0)
    chat_key = await ApiKeyService.get_or_create_chat_api_key(user_id=user_id, user_address=address)
    monkeypatch.setattr(config, "LIBERTAI_CHAT_API_KEY", chat_key.full_key)

    ok = await ApiKeyService.register_inference_call(
        key=chat_key.full_key, credits_used=5.0, model_name="test-model"
    )
    assert ok is True
    assert await _balance(user_id) == 10.0  # shared free key is never charged
```

Keep `test_api_key_usage_deducts_credits` as-is.

- [ ] **Step 2: Run to verify failure**

Run: `poetry run pytest tests/test_inference_call_billing.py -v`
Expected: FAIL (`test_per_user_chat_key_deducts_when_subscriptions_disabled` asserts 7.0 but chat is still excluded → 10.0).

- [ ] **Step 3: Make chat chargeable except the shared key**

In `src/services/api_key.py`, replace the `chargeable_user_id` assignment (lines 751-755) with:

```python
                # Chargeable keys (everything except liberclaw / x402, and the shared
                # anonymous chat service key) with an owner accrue against fixed windows
                # then prepaid balance. Per-user chat keys are chargeable like api/cli.
                is_shared_free_key = key == config.LIBERTAI_CHAT_API_KEY
                chargeable_user_id = (
                    api_key.user_id
                    if api_key.type not in (ApiKeyType.liberclaw, ApiKeyType.x402) and not is_shared_free_key
                    else None
                )
```

(Update the comment block at 748-750 accordingly. `config` is already imported in this module.)

- [ ] **Step 4: Run to verify pass**

Run: `poetry run pytest tests/test_inference_call_billing.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/api_key.py tests/test_inference_call_billing.py
git commit -m "feat(billing): meter per-user chat keys, keep shared free key free"
```

---

### Task 4: Gate chat keys in the admin whitelist (shared key always passes)

**Files:**
- Modify: `src/services/api_key.py:562-687` (`get_admin_all_api_keys`)
- Test: `tests/test_inference_call_billing.py` (extends the gateway test) + `tests/test_admin_list_enforcement.py`

A blocked per-user chat key must drop off the whitelist so the gateway 401s; the shared free key must always remain.

- [ ] **Step 1: Write failing tests**

Add to `tests/test_inference_call_billing.py`:

```python
async def test_blocked_chat_key_drops_from_whitelist(monkeypatch):
    """Subscriptions on: a chat user who exhausted the free window AND has no prepaid is dropped."""
    monkeypatch.setattr(config, "SUBSCRIPTIONS_ENABLED", True)
    address = "0xC4A7000000000000000000000000000000000015"
    async with AsyncSessionLocal() as db:
        user = await get_or_create_user_by_wallet(db, address)
        await db.commit()
        user_id = user.id
    chat_key = await ApiKeyService.get_or_create_chat_api_key(user_id=user_id, user_address=address)

    # Drain past the free weekly window (2.0) with zero prepaid → blocked.
    await ApiKeyService.register_inference_call(
        key=chat_key.full_key, credits_used=2.5, model_name="m"
    )
    whitelist = await ApiKeyService.get_admin_all_api_keys()
    assert chat_key.full_key not in whitelist


async def test_shared_free_chat_key_always_whitelisted(monkeypatch):
    monkeypatch.setattr(config, "SUBSCRIPTIONS_ENABLED", True)
    address = "0xC4A7000000000000000000000000000000000016"
    async with AsyncSessionLocal() as db:
        user = await get_or_create_user_by_wallet(db, address)
        await db.commit()
        user_id = user.id
    chat_key = await ApiKeyService.get_or_create_chat_api_key(user_id=user_id, user_address=address)
    monkeypatch.setattr(config, "LIBERTAI_CHAT_API_KEY", chat_key.full_key)
    # Even with usage that would block a normal user:
    await ApiKeyService.register_inference_call(key=chat_key.full_key, credits_used=5.0, model_name="m")

    whitelist = await ApiKeyService.get_admin_all_api_keys()
    assert chat_key.full_key in whitelist
```

Add `from src.models.base import AsyncSessionLocal` if not already imported in the test file (it is, via the billing helpers' module — confirm and add if missing).

- [ ] **Step 2: Run to verify failure**

Run: `poetry run pytest tests/test_inference_call_billing.py::test_blocked_chat_key_drops_from_whitelist -v`
Expected: FAIL (chat keys currently pass through unconditionally → present).

- [ ] **Step 3: Add chat to the gated path**

In `get_admin_all_api_keys` (`src/services/api_key.py`):

1. Line 563 — widen the chargeable set to include chat:
```python
                # CLI + per-user chat keys are credit-gated exactly like standard api keys.
                chargeable_api_types = (ApiKeyType.api, ApiKeyType.cli, ApiKeyType.chat)
```

2. The user-id prefetch at line 566 already keys off `k.type in chargeable_api_types` — now includes chat automatically.

3. In the per-key loop, the shared free key must bypass gating. Inside the `elif key.type in chargeable_api_types:` branch (line 655), add at the very top:
```python
                    elif key.type in chargeable_api_types:
                        if key.key == config.LIBERTAI_CHAT_API_KEY:
                            # Shared anonymous chat service key: always allowed, never gated.
                            result.append(key.key)
                            continue
                        if not key.user_id:
                            continue
```

4. Update the trailing comment at line 686 to: `# valid liberclaw/api/cli/chat keys pass through`.

- [ ] **Step 4: Run to verify pass**

Run: `poetry run pytest tests/test_inference_call_billing.py tests/test_admin_list_enforcement.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/api_key.py tests/test_inference_call_billing.py
git commit -m "feat(gateway): entitlement-gate per-user chat keys in whitelist"
```

---

### Task 5: Meter per-user chat usage at the usage endpoint

**Files:**
- Modify: `src/routes/api_keys/api_keys.py:169-187` (the `ApiKeyType.chat` branch)
- Test: `tests/test_inference_call_billing.py` (route-level via shared service is already covered; add a usage-endpoint test if a route harness exists — otherwise the service tests in Tasks 3-4 cover the deduction path)

The chat branch currently records a `ChatRequest` and returns without charging. Make per-user chat keys also compute price and call `register_inference_call` (which now meters). The shared free key keeps the log-only behavior.

**Analytics note (intentional, do NOT "fix"):** a per-user chat request now writes BOTH a `chat_request` row and an `inference_call` row. This does not falsify analytics: `InferenceCall` global stats are keyed by `ApiKey.type` for `api`/`cli`/`liberclaw` only (`src/services/stats.py:266,305,345,390,501`) and never include `chat`; `ChatRequest` remains the sole source for chat DAU/engagement; the `inference_call(type=chat)` row only surfaces in per-user usage (correct, since chat is now billed) and is required because the entitlement windows are summed from `InferenceCall`. Keep both writes.

- [ ] **Step 1: Update the chat branch**

Replace lines 169-187 with:

```python
            if api_key.type == ApiKeyType.chat:
                # Always keep the lightweight chat-history log.
                if isinstance(usage_log, ImageInferenceCallData):
                    await ChatRequestService.add_chat_request(
                        api_key_id=api_key.id,
                        input_tokens=0,
                        output_tokens=0,
                        cached_tokens=0,
                        model_name=usage_log.model_name,
                        image_count=usage_log.image_count,
                    )
                else:
                    await ChatRequestService.add_chat_request(
                        api_key_id=api_key.id,
                        input_tokens=usage_log.input_tokens,
                        output_tokens=usage_log.output_tokens,
                        cached_tokens=usage_log.cached_tokens,
                        model_name=usage_log.model_name,
                    )
                # The shared anonymous chat key stays free; per-user chat keys are metered
                # (window -> prepaid) via register_inference_call, like api/cli keys.
                if usage_log.key != config.LIBERTAI_CHAT_API_KEY:
                    if isinstance(usage_log, ImageInferenceCallData):
                        credits_used = await aleph_service.calculate_price(
                            model_id=usage_log.model_name,
                            image_count=usage_log.image_count,
                        )
                        await ApiKeyService.register_inference_call(
                            key=usage_log.key,
                            credits_used=credits_used,
                            model_name=usage_log.model_name,
                            image_count=usage_log.image_count,
                        )
                    else:
                        credits_used = await aleph_service.calculate_price(
                            model_id=usage_log.model_name,
                            input_tokens=usage_log.input_tokens,
                            output_tokens=usage_log.output_tokens - usage_log.cached_tokens,
                        )
                        await ApiKeyService.register_inference_call(
                            key=usage_log.key,
                            credits_used=credits_used,
                            model_name=usage_log.model_name,
                            input_tokens=usage_log.input_tokens,
                            output_tokens=usage_log.output_tokens,
                            cached_tokens=usage_log.cached_tokens,
                        )
```

Confirm `config` is imported in this module (it imports `aleph_service`; add `from src.config import config` if absent).

- [ ] **Step 2: Run the affected suites**

Run: `poetry run pytest tests/test_inference_call_billing.py -v`
Expected: PASS (deduction path unchanged at the service layer; this wires the route to it).

- [ ] **Step 3: Manual smoke (optional, if dev DB + app running)**

With `SUBSCRIPTIONS_ENABLED=True`, POST a text usage log for a per-user chat key over the 2.0 weekly window and confirm `GET /credits/balance` drops; POST for `LIBERTAI_CHAT_API_KEY` and confirm balance unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/routes/api_keys/api_keys.py
git commit -m "feat(usage): meter per-user chat usage at admin/usage endpoint"
```

---

### Task 6: Expose `allowed` + `source` on the subscription response

**Files:**
- Modify: `src/interfaces/payments.py` (`SubscriptionResponse`)
- Modify: `src/routes/payments/payments.py` (`get_subscription`, the `return SubscriptionResponse(...)`)
- Test: `tests/test_payment_routes.py`

Gives the frontend a direct signal to render the wall / current state without recomputing.

- [ ] **Step 1: Write the failing test**

Add to `tests/test_payment_routes.py` (mirror its existing route-test style with `async_client`; a fresh user defaults to free, empty windows → allowed, source "tier"):

```python
async def test_subscription_exposes_allowed_and_source(async_client, monkeypatch):
    monkeypatch.setattr(config, "SUBSCRIPTIONS_ENABLED", True)
    # ... authenticate as a fresh user the way other tests in this file do ...
    resp = await async_client.get("/payments/subscription")  # add auth headers/cookie per file convention
    assert resp.status_code == 200
    body = resp.json()
    assert body["tier"] == "free"
    assert body["allowed"] is True
    assert body["source"] == "tier"
```

(Follow the file's existing auth setup; if it has a helper for an authenticated client, use it.)

- [ ] **Step 2: Run to verify failure**

Run: `poetry run pytest tests/test_payment_routes.py::test_subscription_exposes_allowed_and_source -v`
Expected: FAIL (`KeyError: 'allowed'`).

- [ ] **Step 3: Add the fields**

In `src/interfaces/payments.py`, add to `SubscriptionResponse` (after `is_trial`):

```python
    # Live gateway decision for the next call: lets the UI show the wall directly.
    allowed: bool = True
    source: str = "tier"  # "tier" | "prepaid" | "blocked"
```

In `src/routes/payments/payments.py` `get_subscription`, in the `return SubscriptionResponse(...)`, add:

```python
        allowed=allowance.allowed,
        source=allowance.source,
```

- [ ] **Step 4: Run to verify pass**

Run: `poetry run pytest tests/test_payment_routes.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/interfaces/payments.py src/routes/payments/payments.py tests/test_payment_routes.py
git commit -m "feat(payments): expose allowed+source on subscription response"
```

---

### Task 7: Enable subscriptions

Flip the default on (`src/config.py:162` → `os.getenv("SUBSCRIPTIONS_ENABLED", "True")...`), append `SUBSCRIPTIONS_ENABLED=True` under a `# -- Subscriptions --` heading in `.env.example`, then run the full suite (`poetry run pytest -v`) and pin `monkeypatch.setattr(config, "SUBSCRIPTIONS_ENABLED", False)` on any test whose intent is the prepaid-only path. Commit `feat(config): enable subscriptions`.

---

## Self-review notes (resolved)
- **Spec coverage:** tiers (T1), flag (T7), chargeable chat (T3), usage counting (T2), usage-endpoint metering (T5), whitelist gate (T4), allowed/source for the UI wall (T6). Inference proxy intentionally untouched (anonymous path).
- **Shared-key safety:** the anonymous `LIBERTAI_CHAT_API_KEY` is special-cased in metering (T3, T5) and whitelist (T4) so anonymous free chat cannot break.
- **Type consistency:** `CHARGEABLE_KEY_TYPES` (entitlement) and `chargeable_api_types` (whitelist) both = api+cli+chat; `register_inference_call` excludes liberclaw+x402+shared-key. Tier keys `free/go/plus` used consistently across code + updated tests.

## Verification before done
- `poetry run pytest -v` green.
- Manual: with flag on, a fresh user's `GET /payments/subscription` → `tier=free, allowed=true, source=tier`; chat over 2.0 weekly credits with no prepaid → `source=blocked, allowed=false` and the user's chat key absent from `GET /api-keys/admin/list`.
