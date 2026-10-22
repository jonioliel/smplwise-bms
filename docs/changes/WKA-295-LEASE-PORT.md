# WKA-295 - the capture lease's public registration port, as built (answer to WisKey item A03)

Status: written on `pilot/WKA-295` from `origin/main` @ 90cd7d9ae (2.12.1, bridge 0.9.6). No bridge version bump in this change.
Paths are the canonical copy `custom_components/smplwise_bridge/`; the mirror `smplwise_vms/integration/smplwise_bridge/` is byte-identical
(`scripts/sync_integration.py --check`). Line numbers are those of this branch.

This note **describes** the port. It adds no field to the DTO, no digest, no key in the consumer, and does not change capture v1
(`wiskey-capture-lease-v1`, `docs/contracts/wiskey-capture-lease/`). The capture gate stays closed (`services/capture_lease.py`
`GO_LIVE_PERMITTED = False`).

## 1. Where the port lives (import path)

| Path | Works on | Notes |
|---|---|---|
| `custom_components.smplwise_bridge.lease_service` | every bridge 0.9.6+ (90cd7d9ae included) | the module itself; `__init__.py:84` imports it (`from . import lease_service`) |
| `custom_components.smplwise_bridge` (package root) | the first bridge release that carries WKA-295 (not yet released; no version bump here) | re-export, `__init__.py:85-90`; the promised names are `LEASE_PUBLIC_API`, `__init__.py:97-99` |

WisKey's finding is correct for 90cd7d9ae: the package root did **not** re-export the port; only the submodule did. WKA-295 adds the root
re-export (the same objects, no wrapper, no second registry). Recommendation: import from `...smplwise_bridge.lease_service` (works on the
deployed 0.9.6 and later); the root names are a convenience once the next bridge version ships.

`LEASE_PUBLIC_API` = `async_register_consumer`, `async_get_capability`, `is_bridge_capability`, `LeaseCapability`, `LeaseRegistration`,
`LeaseConsumer`, `LeaseUnavailable` (all from `lease_service`) and `LeaseDTO` (from `lease_contract`). Nothing else of the package is part of
the port. Importing either path imports the package root, which imports Home Assistant: the consumer runs inside Home Assistant anyway.

## 2. Registration

`lease_service.async_register_consumer(hass, consumer, *, owner=None) -> LeaseRegistration` - `lease_service.py:240-255`.

- **Synchronous.** It is a plain `def`, not a coroutine: call it, do not await it. The `async_` prefix is Home Assistant's convention for
  "call from the event loop" (`lease_service.py:35`: nothing here is thread-safe). It returns the registration at once.
- `consumer`: any object with a callable `handle(dto)` (`LeaseConsumer`, `lease_service.py:73-75`); otherwise `TypeError` (`:243-244`).
  `handle` may return the answer dict or an awaitable of it (`_dispatch`, `:308-337`), bounded by `HOST_TIMEOUT_S = 10.0` (`:53`).
- `owner`: `None` or a string that fully matches `OWNER_RE = [a-z0-9_]{1,64}` (`:59`, checked `:245-246`); anything else (upper case,
  `-`, space, non-ASCII, empty, longer than 64, a non-string) is `ValueError`. Nothing is changed on any failure.
- **One consumer at a time** (`:247-255`). A second registration is `RuntimeError`, except by the **same named** `owner`: that
  **replaces** the old registration (the old one goes to `removed` first, `:252`). An anonymous registration (`owner=None`) is never
  replaced, and a named owner never replaces an anonymous one or another owner.
- The registration is created in `hass.data[LEASE_CAPABILITY_KEY]`'s capability; `LEASE_CAPABILITY_KEY = "smplwise_bridge_lease_capability"`
  (`const.py:39`). The consumer never writes that key. A foreign object under the key is never trusted and never overwritten
  (`_ensure_capability`, `:214-220` raises `RuntimeError`; `async_get_capability` returns `None`, `:208-211`).

### The returned `LeaseRegistration` (`:78-135`)

- `state`: `active` -> `removed`, exactly once (`STATE_*`, `:57-58`). `active`, `owner`, `in_flight`, `capability` are read-only properties.
- `remove()` and calling the object itself (`__call__ = remove`, `:117`) remove it; both idempotent, and a stale handle never removes a
  newer registration (`LeaseCapability._drop`, `:198-200`).
- `async_unload(grace_s=None)` (a coroutine, `:119-132`): `remove()`, wait up to `UNLOAD_GRACE_S = 2.0` (`:54`) for calls still inside
  `handle()`, cancel the rest, return `True` iff all finished on their own.

### Lifetime across a bridge reload

The registration lives on the capability object, not on the bridge config entry. `async_attach_bridge` / `async_detach_bridge`
(`:223-237`; called from `__init__.py:628` and `:662`) only set the entry id and bump an epoch: **a registration survives a bridge
reload** and WisKey does not re-register for it. A call that was in flight while the bridge unloaded gets `lease_bridge_unloaded`. WisKey
re-registers only for its own reload (same `owner` -> replace). Registering before the bridge loads is allowed (the capability is created on
demand); the two services exist only while the bridge entry is loaded.

### The capability (`LeaseCapability`, `:138-200`)

Built only by the bridge (a private origin token, `:61`, `:143-145`). Read-only: `domain` (`smplwise_bridge`), `protocol`
(`wiskey-capture-lease-v1`), `services` (`lease_event`, `lease_request`), `capability_id` (32 hex, per run), `bridge_entry_id`,
`registration`, `owner`; `owns(registration)` (`:173-175`); `verify_dto(dto)` (`:177-184`); `is_bridge_capability(obj)` (`:203-205`).

## 3. The call path and its checks - before AND after the consumer

`async_handle` (`lease_service.py:258-301`):

Before dispatch:
1. `cap = async_get_capability(hass)` - the bridge's own type under the key, else `None` (`:261`); `reg = cap.registration` (`:262`);
   none -> `lease_consumer_missing`, **before** anything is read, so no nonce is spent (`:263-265`).
2. Stages 1-7 (`lease_contract.validate`); a refusal is the closed `rejected` answer and the consumer is not called (`:266-270`).
3. `reg.active` again (`:271-272`), then the bridge epoch and the seal are recorded and the DTO is registered as issued (`cap._issue`,
   `:273-274`). Inside `handle()` the consumer may call `cap.verify_dto(dto)` - it is `True`.

After the consumer returned (or failed) - `:281-301`, in this order:
1. `removed` = the registration is no longer the active one of this capability **or** (WKA-295) the object under `LEASE_CAPABILITY_KEY` is no
   longer this capability (replaced by a foreign object or another capability, or dropped) -> `lease_consumer_removed`.
2. `unloaded` = the bridge epoch changed (detach / reload) -> `lease_bridge_unloaded`.
3. `tampered` = seal / nonce differ, **or** (WKA-295) `cap.verify_dto(dto)` is false (no longer the object this capability issued, or not
   `intact()`) -> `lease_dto_tampered`. Before WKA-295 the after-check used `dto.intact()` only.
4. the consumer failed / timed out / was cancelled -> `lease_consumer_failed`.
5. the answer is not exactly one closed shape for that action naming this request (`lease_answers.py`) -> `lease_answer_invalid`.

The closed `LeaseUnavailable` codes are exactly: `lease_consumer_missing`, `lease_consumer_removed`, `lease_bridge_unloaded`,
`lease_dto_tampered`, `lease_consumer_failed`, `lease_answer_invalid` (pinned by `tests/test_wka_295_lease_port.py`). Home Assistant sees
`HomeAssistantError("lease_unavailable: <code>")` (`__init__.py:613-614`); Arx reads it as "no answer".

Not checked before dispatch, by construction: `bridge_entry_id` - the two services are registered only while the bridge entry is loaded
(`__init__.py:626-628`, removed at `:660-662`), so a call cannot arrive without an attached bridge. Recommendation only; no code change.

## 4. `LeaseDTO.as_json()` - the exact shape

`lease_contract.py:177-180`. Keys, in this order:

| Key | Type | Source |
|---|---|---|
| `action` | str | one of the 7 v1 actions |
| `actor` | `{id: str, display_name: str}` | wire `actor` |
| `station` | str | wire `station` (`"*"` for the wide events) |
| `params` | dict (a fresh, mutable copy) | wire `params` |
| `request_id` | str (UUID) | wire |
| `nonce` | str (32 hex) | wire |
| `issued_at` | str (`YYYY-MM-DDTHH:MM:SSZ`) | wire |
| `expires_at` | str (same) | wire |
| `body_sha256` | str (64 hex) | SHA-256 of the canonical signed body (`lease_contract.py:416-418`) |

`body_sha256` is the SHA-256 of `json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)` where `body` is the parsed wire
**without** `ts`, `nonce` and `sig` (it includes `protocol`). It is **not** a digest of the whole authenticated message (the signed text
as received), and it does not cover `nonce`/`ts`. It equals `body_sha256_of_signed_fields` in `GOLDEN_VECTORS.json`.

Not in `as_json()` (and not added by WKA-295):

- `protocol` - not a DTO field. The value is fixed for v1: `lease_contract.PROTOCOL` / `LeaseCapability.protocol` =
  `"wiskey-capture-lease-v1"`; every DTO the bridge hands out passed the schema stage that requires exactly this value.
- `authenticated_message_sha256` - does not exist anywhere in the bridge. The nearest existing value is `body_sha256` with the definition
  above; whether it serves WisKey's projection is WisKey's decision. A new digest would be a contract change (CR), not part of v1.
- also absent: `ts`, `sig`, `kid`, `kind` (`dto.kind` is a property, not in `as_json`).

## 5. Tests

`smplwise_vms/backend/tests/test_wka_295_lease_port.py`: the synchronous door, the owner regex, the root re-export (by syntax tree; Home
Assistant is not installed in the test environment) and its mirror, the exact `as_json` keys and the `body_sha256` definition, the
after-checks (capability replaced / dropped / another capability -> `lease_consumer_removed`; issued record lost -> `lease_dto_tampered`),
the unchanged path, the closed code set, the closed capture gate.
