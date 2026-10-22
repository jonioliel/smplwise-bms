# LEASELIFE-295 - capture-lease consumer lifecycle, native capability, DTO immutability

Status: built on `pilot/LEASELIFE-295` (bridge 0.9.6, no version bump). Answers WisKey's review of 2026-10-22 of
`smplwise_bridge/lease_service.py`. Nothing switches the capture lease on: `capture_lease.py` keeps `GO_LIVE_PERMITTED = False`.

Unchanged and FINAL: protocol `wiskey-capture-lease-v1`; services `smplwise_bridge.lease_event` / `smplwise_bridge.lease_request`; service
data exactly `{signed_message_json}`; no `kid` on the v1 wire (an unknown field); verification only through the bridge's key set
(`KeySet.verify`, rotation-aware); `binding_revision` is `null` in v1 as the lease schema allows. The seam
`async_register_consumer(hass, consumer)` and `consumer.handle(dto)` (coroutine or plain function) is kept; the return value is still
callable as the remover.

Code: `custom_components/smplwise_bridge/lease_service.py`, `lease_contract.py` (`LeaseDTO`), `const.py`
(`LEASE_CAPABILITY_KEY` replaces `LEASE_CONSUMER_KEY`), `__init__.py` (attach / detach); mirrored into
`smplwise_vms/integration/smplwise_bridge/`. Tests: `smplwise_vms/backend/tests/test_bridge_lease_lifecycle.py`.

## 1. Lifecycle of the consumer registration

States of a `LeaseRegistration`: `active` -> `removed` (terminal, entered exactly once).

| Event | What the consumer does | Bridge behaviour |
|---|---|---|
| setup | `reg = async_register_consumer(hass, consumer, owner="<domain>")` | `active`; new calls are dispatched to it |
| failed registration | (bad consumer / bad owner / slot taken) | `TypeError` / `ValueError` / `RuntimeError`; nothing changes |
| failed setup after registering | call `reg.remove()` in the error path | `removed`; calls answer `lease_consumer_missing` before any stage runs (no nonce spent) |
| stop / unload | `await reg.async_unload()` (or `reg.remove()` / `reg()`) | `removed` at once; `async_unload` then waits `UNLOAD_GRACE_S` (2 s) for calls inside `handle()`, cancels the rest, waits `CANCEL_GRACE_S` (0.5 s); returns True iff all finished by themselves |
| reload | unload, then register again | the new registration serves new calls; the old one gets nothing new |
| reload whose unload never removed the old one | register again with the SAME `owner` | the old registration is superseded (`removed`); a different or absent owner is refused (`RuntimeError`) |
| duplicate / late remove | any number of `remove()` / `reg()` / `async_unload()` | idempotent; a stale handle never removes a newer registration |
| answer after removal (late callback) | the consumer finishes a call it received while active | never relayed: `LeaseUnavailable("lease_consumer_removed")` -> HA error `lease_unavailable: lease_consumer_removed` |
| consumer removes itself inside `handle()` | | same: the answer is discarded |
| caller cancelled (HA stop, caller timeout) | | the cancellation propagates to the caller and is forwarded to the consumer's task; counters stay consistent |

Rules: no call is ever dispatched to a removed registration; every outcome is either a closed answer or a `LeaseUnavailable` with a fixed
code (no consumer exception, text or cancellation leaks to the caller). Arx treats every `lease_unavailable` as "no answer" (retry / revoke).
A call that was already dispatched has spent its nonce; Arx re-sends with a fresh one. Every entry point runs on the event loop
(HA `@callback` rules); nothing is thread-safe by design.

The bridge side: `async_attach_bridge(hass, entry_id)` in `async_setup_entry`, `async_detach_bridge(hass, entry_id)` in
`async_unload_entry`. A consumer registration survives a bridge reload (WisKey does not re-register). An answer to a call that was in flight
while the bridge unloaded is not relayed (`lease_bridge_unloaded`).

New fixed `LeaseUnavailable` codes: `lease_consumer_removed`, `lease_bridge_unloaded`, `lease_dto_tampered` (besides
`lease_consumer_missing`, `lease_consumer_failed`, `lease_answer_invalid`).

## 2. Native capability with a checkable source and ownership

Smallest design consistent with the existing code: one `LeaseCapability` object per Home Assistant, kept by the bridge in
`hass.data[LEASE_CAPABILITY_KEY]` (`smplwise_bridge_lease_capability`). It holds the active registration; the consumer object is no
longer stored directly in `hass.data`.

- Source: only `lease_service` can build one (a module-private origin token; `LeaseCapability()` and a forged token raise `TypeError`).
  `is_bridge_capability(obj)` is `type(obj) is LeaseCapability`. It names `domain == "smplwise_bridge"`, `protocol ==
  "wiskey-capture-lease-v1"`, `services == ("lease_event", "lease_request")`, a per-run `capability_id` (random tag, not a secret) and
  `bridge_entry_id` (the bridge config entry serving the services, `None` while unloaded). All read-only properties.
- Ownership: `reg.capability is cap`, `cap.registration is reg`, `cap.owner == "<domain>"`, `cap.owns(reg)` (False once removed or for a
  registration of another capability).
- Provenance of a DTO: `cap.verify_dto(dto)` is True only for the very `LeaseDTO` object this capability handed out, still alive, with its
  seal and nonce unchanged and all fields still hashing to the seal. A look-alike (`dataclasses.replace`, a DTO validated elsewhere, a dict)
  is False.
- A foreign object under the key is never trusted (`async_get_capability` returns None, calls answer `lease_consumer_missing`) and never
  overwritten (`async_register_consumer` / `async_attach_bridge` raise `RuntimeError`).

Consumer check (WisKey side, suggested):

```python
from custom_components.smplwise_bridge import lease_service as ls
reg = ls.async_register_consumer(hass, consumer, owner="smplwise_intercom")
cap = ls.async_get_capability(hass)
assert ls.is_bridge_capability(cap) and cap.owns(reg) and cap.protocol == "wiskey-capture-lease-v1"
# inside handle(dto): optionally `cap.verify_dto(dto)`
```

Residual: this proves "issued by the bridge module loaded in this Python process", not a cryptographic identity. Any code running inside the
same Home Assistant process can import the module; that is the trust boundary of every HA integration and is accepted here.

## 3. DTO immutability after validation (DTO v3 of `wiskey-capture-lease-v1`)

`LeaseDTO` is `@dataclass(frozen=True)` with hand-written `__slots__` (the fields plus `__weakref__`; `slots=True` is avoided because on Python 3.12 it turns an assignment to an unknown name into a bare `TypeError`):

- assignment and deletion of any field raise `FrozenInstanceError`; no new attribute; no `__dict__` (so no `vars(dto)[...]` back door);
- `params` is a read-only `MappingProxyType` tree with tuples for arrays (`lease_actions`, `live_leases`); built fresh from the parsed body,
  so nothing the caller still holds (its service data) is shared; `as_json()` returns a deep copy;
- `body_sha256` is the seal (the SHA-256 of the signed body, equal to the golden vectors' `body_sha256_of_signed_fields`). `intact()`
  rebuilds the signed body from the DTO's fields and compares. Python cannot forbid `object.__setattr__`; such a forced write is detected:
  the bridge re-checks seal, nonce and `intact()` after the consumer returned and refuses to relay (`lease_dto_tampered`).
- no `kid`, `ts` or `sig` field; `binding_revision` stays `null` in v1.

## 4. Tests (fakes only; no Home Assistant, no device)

`test_bridge_lease_lifecycle.py`: registration / failed registration / failed setup; owner rules and supersede; unload drain within the
grace; unload cancelling past the grace; a consumer swallowing the cancellation; reload with an in-flight call; self-removal inside
`handle()`; no dispatch after removal; caller cancellation; bridge attach / detach / reload and an in-flight answer across a bridge unload;
the HA wiring (source text); capability source, read-only properties, ownership, foreign object under the key, `verify_dto`; DTO intact
for every accept vector, every mutation attempt, caller-held data, forced writes detected and not relayed, no `kid`, final names, the gate.
`test_bridge_lease_event.py` adjusted to the capability (two assertions).
