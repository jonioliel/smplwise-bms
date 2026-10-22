"""LEASELIFE-295: the lifecycle of the WisKey consumer registration, the bridge's native lease capability (checkable source and ownership) and the
immutability of the validated DTO (`wiskey-capture-lease-v1`). Design: docs/changes/LEASELIFE-295-LEASE-CONSUMER-LIFECYCLE.md.

Like test_bridge_lease_event.py: Home Assistant is NOT installed here; the pure modules are loaded with bridge_loader and `hass` is a fake with a
`data` dict. Synthetic data only (the golden vectors and their published TEST key); nothing contacts a bridge, WisKey, a reader or Home Assistant."""
from __future__ import annotations

import asyncio
import dataclasses
import json
import sys
import types
from pathlib import Path
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bridge_loader  # noqa: E402

REPO = bridge_loader.REPO
VECTORS = json.loads((REPO / "docs" / "contracts" / "wiskey-capture-lease" / "GOLDEN_VECTORS.json").read_text(encoding="utf-8"))
TEST_SECRET = VECTORS["test_hmac_key"]["value"]
ACCEPT = {v["id"]: v for v in VECTORS["accept"]}

const = bridge_loader.load("const")
keyset = bridge_loader.load("keyset")
lc = bridge_loader.load("lease_contract")
ls = bridge_loader.load("lease_service")

KIND = {"lease_event": lc.KIND_EVENT, "lease_request": lc.KIND_REQUEST}


def _hass() -> Any:
    return types.SimpleNamespace(data={})


def _ks() -> Any:
    return keyset.KeySet(TEST_SECRET)


def _ack(dto: Any) -> dict[str, Any]:
    rid = dto.request_id
    return {
        "lease_revoke": {"result": "acknowledged", "request_id": rid, "sequence": dto.params.get("sequence"), "destroyed": 1},
        "lease_heartbeat": {"result": "acknowledged", "request_id": rid, "sequence": dto.params.get("sequence"), "destroyed": 0,
                            "live_leases": list(dto.params.get("live_leases", ()))},
        "lease_stream_reset": {"result": "acknowledged", "request_id": rid, "sequence": 1, "destroyed": 0},
        "capture_start": {"result": "acknowledged", "request_id": rid, "session": {"session_id": "0123456789abcdef", "state": "waiting"}},
        "capture_status": {"result": "acknowledged", "request_id": rid, "capture": {"state": "waiting", "error": None, "card": None}},
        "capture_cancel": {"result": "acknowledged", "request_id": rid, "cancelled": True},
    }[dto.action]


async def _handle(hass: Any, vid: str, ks: Any) -> dict[str, Any]:
    v = ACCEPT[vid]
    return await ls.async_handle(hass, "svc", KIND[v["service"]], {"signed_message_json": v["signed_message_json"]}, ks, v["now"])


def _call(hass: Any, vid: str, ks: Any = None) -> dict[str, Any]:
    return asyncio.run(_handle(hass, vid, ks or _ks()))


class Consumer:
    def __init__(self) -> None:
        self.seen: list[Any] = []

    async def handle(self, dto: Any) -> Any:
        self.seen.append(dto)
        return _ack(dto)


class Gate:
    """A consumer that blocks inside handle() until released: an in-flight call."""

    def __init__(self, swallow_cancel: bool = False) -> None:
        self.seen: list[Any] = []
        self.entered = asyncio.Event()
        self.release = asyncio.Event()
        self.cancelled = 0
        self.swallow_cancel = swallow_cancel

    async def handle(self, dto: Any) -> Any:
        self.seen.append(dto)
        self.entered.set()
        try:
            await self.release.wait()
        except asyncio.CancelledError:
            self.cancelled += 1
            if not self.swallow_cancel:
                raise
        return _ack(dto)


# ---------------------------------------------------------------- registration: setup, failed setup, the returned handle

def test_register_returns_an_active_registration_that_is_also_the_old_remover():
    hass = _hass()
    reg = ls.async_register_consumer(hass, Consumer(), owner="smplwise_intercom")
    assert reg.state == ls.STATE_ACTIVE and reg.active and reg.owner == "smplwise_intercom" and reg.in_flight == 0
    assert callable(reg)  # the seam confirmed 2026-10-21: the return value removes the consumer when called
    reg()
    assert reg.state == ls.STATE_REMOVED and not reg.active
    reg()  # idempotent
    reg.remove()
    assert reg.state == ls.STATE_REMOVED


def test_a_failed_registration_leaves_nothing_behind_and_a_later_one_succeeds():
    hass = _hass()
    for bad in (object(), types.SimpleNamespace(handle=None), types.SimpleNamespace(handle="not callable")):
        with pytest.raises(TypeError):
            ls.async_register_consumer(hass, bad)
    for owner in ("", "Has Space", "x" * 65, 5, "ünï"):
        with pytest.raises(ValueError):
            ls.async_register_consumer(hass, Consumer(), owner=owner)  # type: ignore[arg-type]
    cap = ls.async_get_capability(hass)
    assert cap is None or cap.registration is None
    reg = ls.async_register_consumer(hass, Consumer())
    assert reg.active and reg.owner is None


def test_a_consumer_whose_own_setup_fails_after_registering_removes_itself_cleanly():
    """WisKey's async_setup_entry registers first and fails afterwards: it calls remove() in its error path; the bridge is as before."""
    hass, ks = _hass(), _ks()

    async def wiskey_setup() -> None:
        reg = ls.async_register_consumer(hass, Consumer(), owner="smplwise_intercom")
        try:
            raise ConnectionError("the reader did not answer")
        except ConnectionError:
            reg.remove()
            raise

    with pytest.raises(ConnectionError):
        asyncio.run(wiskey_setup())
    with pytest.raises(ls.LeaseUnavailable) as err:
        _call(hass, "capture_status", ks)
    assert err.value.code == "lease_consumer_missing"  # and no nonce was spent: the same bytes are accepted once a consumer is back
    ls.async_register_consumer(hass, Consumer(), owner="smplwise_intercom")
    assert _call(hass, "capture_status", ks)["result"] == "acknowledged"


def test_a_second_consumer_is_refused_unless_it_is_the_same_named_owner_which_supersedes_its_stale_registration():
    hass = _hass()
    anon = ls.async_register_consumer(hass, Consumer())
    with pytest.raises(RuntimeError):
        ls.async_register_consumer(hass, Consumer())  # anonymous: no takeover
    with pytest.raises(RuntimeError):
        ls.async_register_consumer(hass, Consumer(), owner="smplwise_intercom")  # a named owner cannot take over an anonymous one either
    anon.remove()
    old = ls.async_register_consumer(hass, Consumer(), owner="smplwise_intercom")
    with pytest.raises(RuntimeError):
        ls.async_register_consumer(hass, Consumer(), owner="someone_else")
    assert old.active
    new = ls.async_register_consumer(hass, Consumer(), owner="smplwise_intercom")  # a reload whose unload never removed the old one
    assert old.state == ls.STATE_REMOVED and new.active
    assert ls.async_get_capability(hass).registration is new
    old.remove()  # the stale handle does not drop the new registration
    assert ls.async_get_capability(hass).registration is new


# ---------------------------------------------------------------- unload, reload, in-flight calls, late answers

def test_unload_waits_for_an_in_flight_call_to_finish_inside_the_grace_and_its_late_answer_is_closed_not_relayed():
    async def scenario() -> tuple[Any, bool, Any]:
        hass, gate = _hass(), Gate()
        reg = ls.async_register_consumer(hass, gate, owner="smplwise_intercom")
        call = asyncio.ensure_future(_handle(hass, "capture_status", _ks()))
        await gate.entered.wait()
        assert reg.in_flight == 1
        unload = asyncio.ensure_future(reg.async_unload(grace_s=2.0))
        await asyncio.sleep(0)
        assert reg.state == ls.STATE_REMOVED  # no NEW call reaches it from now on
        gate.release.set()
        drained = await unload
        try:
            out = await call
        except ls.LeaseUnavailable as exc:
            out = exc
        return out, drained, reg

    out, drained, reg = asyncio.run(scenario())
    assert drained is True and reg.in_flight == 0
    # the call was dispatched while the consumer was active, but its answer arrived after the removal: closed, never relayed
    assert isinstance(out, ls.LeaseUnavailable) and out.code == "lease_consumer_removed"


def test_unload_cancels_a_call_that_outlives_the_grace_and_the_call_gets_a_closed_error_not_a_cancellation():
    async def scenario() -> tuple[Any, bool, Gate, Any]:
        hass, gate = _hass(), Gate()
        reg = ls.async_register_consumer(hass, gate)
        call = asyncio.ensure_future(_handle(hass, "capture_start", _ks()))
        await gate.entered.wait()
        drained = await reg.async_unload(grace_s=0.01)
        try:
            out = await call
        except ls.LeaseUnavailable as exc:
            out = exc
        return out, drained, gate, reg

    out, drained, gate, reg = asyncio.run(scenario())
    assert drained is False and gate.cancelled == 1 and reg.in_flight == 0
    assert isinstance(out, ls.LeaseUnavailable) and out.code == "lease_consumer_removed"


def test_a_consumer_that_swallows_the_cancellation_still_never_gets_its_late_answer_relayed():
    async def scenario() -> Any:
        hass, gate = _hass(), Gate(swallow_cancel=True)
        reg = ls.async_register_consumer(hass, gate)
        call = asyncio.ensure_future(_handle(hass, "capture_cancel", _ks()))
        await gate.entered.wait()
        await reg.async_unload(grace_s=0.01)
        try:
            return await call
        except ls.LeaseUnavailable as exc:
            return exc

    out = asyncio.run(scenario())
    assert isinstance(out, ls.LeaseUnavailable) and out.code == "lease_consumer_removed"


def test_reload_unload_then_register_again_new_calls_go_to_the_new_consumer_and_the_old_one_gets_nothing():
    async def scenario() -> tuple[Any, Any, Any, Any]:
        hass, ks = _hass(), _ks()
        old_gate, new = Gate(), Consumer()
        old = ls.async_register_consumer(hass, old_gate, owner="smplwise_intercom")
        in_flight = asyncio.ensure_future(_handle(hass, "capture_status", ks))
        await old_gate.entered.wait()
        old.remove()  # the unload half of a reload (no wait)
        ls.async_register_consumer(hass, new, owner="smplwise_intercom")  # the setup half
        fresh = await _handle(hass, "capture_cancel", ks)
        old_gate.release.set()  # the old consumer answers late
        try:
            late = await in_flight
        except ls.LeaseUnavailable as exc:
            late = exc
        return fresh, late, old_gate, new

    fresh, late, old_gate, new = asyncio.run(scenario())
    assert fresh["result"] == "acknowledged"
    assert isinstance(late, ls.LeaseUnavailable) and late.code == "lease_consumer_removed"
    assert [d.action for d in old_gate.seen] == ["capture_status"] and [d.action for d in new.seen] == ["capture_cancel"]


def test_a_consumer_that_removes_itself_inside_handle_gets_its_answer_discarded():
    hass = _hass()
    box: dict[str, Any] = {}

    class SelfRemoving:
        def handle(self, dto: Any) -> Any:
            box["reg"].remove()  # a late/duplicate callback path: the consumer drops itself while answering
            box["reg"].remove()
            return _ack(dto)

    box["reg"] = ls.async_register_consumer(hass, SelfRemoving())
    with pytest.raises(ls.LeaseUnavailable) as err:
        _call(hass, "capture_status")
    assert err.value.code == "lease_consumer_removed"
    with pytest.raises(ls.LeaseUnavailable) as err2:
        _call(hass, "capture_status")
    assert err2.value.code == "lease_consumer_missing"


def test_no_dispatch_after_removal_and_unload_of_a_removed_registration_is_a_no_op():
    hass = _hass()
    c = Consumer()
    reg = ls.async_register_consumer(hass, c)
    reg.remove()
    with pytest.raises(ls.LeaseUnavailable) as err:
        _call(hass, "capture_status")
    assert err.value.code == "lease_consumer_missing" and c.seen == []
    assert asyncio.run(reg.async_unload()) is True
    assert asyncio.run(reg.async_unload()) is True


def test_the_caller_being_cancelled_mid_call_leaves_the_registration_consistent():
    """Home Assistant stopping (or a caller timing out) cancels the service call itself: the cancellation propagates, nothing leaks."""
    async def scenario() -> tuple[Any, Any]:
        hass, gate = _hass(), Gate()
        reg = ls.async_register_consumer(hass, gate)
        call = asyncio.ensure_future(_handle(hass, "capture_status", _ks()))
        await gate.entered.wait()
        call.cancel()
        with pytest.raises(asyncio.CancelledError):
            await call
        await asyncio.sleep(0.01)
        return reg, gate

    reg, gate = asyncio.run(scenario())
    assert reg.active and reg.in_flight == 0 and gate.cancelled == 1


# ---------------------------------------------------------------- the bridge side: attach / detach (bridge setup, unload, reload)

def test_the_bridge_attaches_and_detaches_and_a_registration_survives_a_bridge_reload():
    hass = _hass()
    reg = ls.async_register_consumer(hass, Consumer(), owner="smplwise_intercom")  # WisKey may load before the bridge
    cap = ls.async_get_capability(hass)
    assert cap.bridge_entry_id is None
    ls.async_attach_bridge(hass, "entry-1")
    assert cap.bridge_entry_id == "entry-1" and ls.async_get_capability(hass) is cap
    ls.async_detach_bridge(hass, "entry-other")  # not ours: no-op
    assert cap.bridge_entry_id == "entry-1"
    ls.async_detach_bridge(hass, "entry-1")
    assert cap.bridge_entry_id is None and reg.active
    ls.async_attach_bridge(hass, "entry-1")
    assert ls.async_get_capability(hass) is cap and cap.registration is reg
    assert _call(hass, "capture_status")["result"] == "acknowledged"


def test_an_answer_that_arrives_after_the_bridge_was_unloaded_is_not_relayed():
    async def scenario() -> Any:
        hass, gate = _hass(), Gate()
        ls.async_attach_bridge(hass, "entry-1")
        reg = ls.async_register_consumer(hass, gate)
        call = asyncio.ensure_future(_handle(hass, "capture_status", _ks()))
        await gate.entered.wait()
        ls.async_detach_bridge(hass, "entry-1")
        gate.release.set()
        try:
            out = await call
        except ls.LeaseUnavailable as exc:
            out = exc
        assert reg.active  # the consumer keeps its registration across the bridge's reload
        return out

    out = asyncio.run(scenario())
    assert isinstance(out, ls.LeaseUnavailable) and out.code == "lease_bridge_unloaded"


def test_the_home_assistant_wiring_attaches_on_setup_and_detaches_on_unload():
    init = (bridge_loader.SRC / "__init__.py").read_text(encoding="utf-8")
    setup = init.split("async def async_setup_entry(")[1].split("async def async_unload_entry(")[0]
    unload = init.split("async def async_unload_entry(")[1]
    assert "lease_service.async_attach_bridge(hass, entry.entry_id)" in setup
    assert "lease_service.async_detach_bridge(hass, entry.entry_id)" in unload
    assert "LEASE_CONSUMER_KEY" not in init


# ---------------------------------------------------------------- the native capability: checkable source and ownership

def test_the_capability_names_its_source_and_protocol_and_cannot_be_built_outside_the_bridge():
    hass = _hass()
    ls.async_attach_bridge(hass, "entry-1")
    cap = ls.async_get_capability(hass)
    assert type(cap) is ls.LeaseCapability and ls.is_bridge_capability(cap)
    assert (cap.domain, cap.protocol, cap.services) == (const.DOMAIN, lc.PROTOCOL, (const.SERVICE_LEASE_EVENT, const.SERVICE_LEASE_REQUEST))
    assert cap.domain == "smplwise_bridge" and cap.protocol == "wiskey-capture-lease-v1"
    assert len(cap.capability_id) == 32 and cap.registration is None and cap.owner is None
    assert hass.data[const.LEASE_CAPABILITY_KEY] is cap
    with pytest.raises(TypeError):
        ls.LeaseCapability()  # type: ignore[call-arg]
    with pytest.raises(TypeError):
        ls.LeaseCapability(object())  # a forged origin token
    for attr in ("domain", "protocol", "capability_id", "owner", "bridge_entry_id", "registration"):
        with pytest.raises(AttributeError):
            setattr(cap, attr, "x")
    assert not ls.is_bridge_capability(types.SimpleNamespace(domain="smplwise_bridge", protocol=lc.PROTOCOL))


def test_ownership_is_checkable_by_the_consumer():
    hass = _hass()
    ls.async_attach_bridge(hass, "entry-1")
    reg = ls.async_register_consumer(hass, Consumer(), owner="smplwise_intercom")
    cap = ls.async_get_capability(hass)
    assert reg.capability is cap and cap.registration is reg and cap.owner == "smplwise_intercom" and cap.bridge_entry_id == "entry-1"
    assert cap.owns(reg)
    reg.remove()
    assert not cap.owns(reg) and cap.owner is None
    other_hass = _hass()
    other = ls.async_register_consumer(other_hass, Consumer(), owner="smplwise_intercom")
    assert not cap.owns(other) and ls.async_get_capability(other_hass).capability_id != cap.capability_id


def test_a_foreign_object_under_the_capability_key_is_never_trusted_and_never_overwritten():
    hass = _hass()
    impostor = types.SimpleNamespace(domain="smplwise_bridge", protocol=lc.PROTOCOL, registration=types.SimpleNamespace(consumer=Consumer()))
    hass.data[const.LEASE_CAPABILITY_KEY] = impostor
    assert ls.async_get_capability(hass) is None
    with pytest.raises(ls.LeaseUnavailable) as err:
        _call(hass, "capture_status")
    assert err.value.code == "lease_consumer_missing"
    with pytest.raises(RuntimeError):
        ls.async_register_consumer(hass, Consumer())
    with pytest.raises(RuntimeError):
        ls.async_attach_bridge(hass, "entry-1")
    assert hass.data[const.LEASE_CAPABILITY_KEY] is impostor


def test_the_consumer_can_verify_that_a_dto_was_issued_by_this_bridge_and_is_unaltered():
    hass = _hass()
    c = Consumer()
    ls.async_register_consumer(hass, c)
    _call(hass, "capture_start")
    cap = ls.async_get_capability(hass)
    dto = c.seen[0]
    assert cap.verify_dto(dto)
    # a look-alike built by the caller (same fields) is not issued by the bridge
    assert not cap.verify_dto(dataclasses.replace(dto))
    assert not cap.verify_dto(lc.validate("request", {"signed_message_json": ACCEPT["capture_start"]["signed_message_json"]}, _ks(), ACCEPT["capture_start"]["now"]))
    assert not cap.verify_dto(None) and not cap.verify_dto(dto.as_json())
    # another bridge capability (another Home Assistant) did not issue it either
    hass2 = _hass()
    ls.async_register_consumer(hass2, Consumer())
    assert not ls.async_get_capability(hass2).verify_dto(dto)


# ---------------------------------------------------------------- DTO v3 (wiskey-capture-lease-v1) immutability after validation

def _dto(vid: str = "capture_start") -> Any:
    v = ACCEPT[vid]
    return lc.validate(KIND[v["service"]], {"signed_message_json": v["signed_message_json"]}, _ks(), v["now"])


@pytest.mark.parametrize("vid", list(ACCEPT))
def test_every_validated_dto_is_intact_and_its_seal_is_the_signed_body(vid):
    dto = _dto(vid)
    assert dto.intact()
    assert dto.body_sha256 == ACCEPT[vid]["body_sha256_of_signed_fields"]


def test_every_ordinary_mutation_attempt_fails():
    dto = _dto("capture_start")
    for name in ("action", "actor_id", "station", "params", "request_id", "nonce", "body_sha256"):
        with pytest.raises(dataclasses.FrozenInstanceError):
            setattr(dto, name, "x")
        with pytest.raises(dataclasses.FrozenInstanceError):
            delattr(dto, name)
    with pytest.raises((dataclasses.FrozenInstanceError, AttributeError)):
        dto.extra = 1  # type: ignore[attr-defined]
    assert not hasattr(dto, "__dict__")  # no vars(dto)[...] back door
    with pytest.raises(TypeError):
        vars(dto)
    p = dto.params
    with pytest.raises(TypeError):
        p["lease"] = {}  # type: ignore[index]
    with pytest.raises(TypeError):
        del p["lease"]  # type: ignore[attr-defined]
    for meth in ("update", "pop", "clear", "setdefault", "popitem"):
        assert not hasattr(p, meth), meth
    lease = p["lease"]
    with pytest.raises(TypeError):
        lease["binding_revision"] = "r1"  # type: ignore[index]
    with pytest.raises(TypeError):
        lease["receiver"]["reader_id"] = 2  # type: ignore[index]
    with pytest.raises((TypeError, AttributeError)):
        lease["lease_actions"].append("door_open")  # type: ignore[attr-defined]
    with pytest.raises(TypeError):
        lease["lease_actions"][0] = "door_open"  # type: ignore[index]
    assert dto.intact()


def test_the_caller_cannot_alter_the_validated_dto_afterwards_through_anything_it_still_holds():
    v = ACCEPT["capture_start"]
    data = {"signed_message_json": v["signed_message_json"]}
    dto = lc.validate("request", data, _ks(), v["now"])
    before = dto.as_json()
    data["signed_message_json"] = "{}"  # the caller's service data
    data.clear()
    out = dto.as_json()  # a copy: changing it changes nothing
    out["params"]["lease"]["receiver"]["reader_id"] = 7
    out["params"]["lease"]["lease_actions"].append("door_open")
    out["station"] = "elsewhere"
    assert dto.as_json() == before and dto.intact()


def test_a_forced_write_past_the_frozen_guard_is_detected_by_the_seal_and_never_relayed():
    """Python cannot forbid object.__setattr__; the DTO's seal (the SHA-256 of the signed body) catches it, and the bridge refuses to relay."""
    dto = _dto("capture_status")
    object.__setattr__(dto, "station", "entry-b")
    assert not dto.intact()

    hass = _hass()

    class Tamperer:
        def handle(self, d: Any) -> Any:
            ans = _ack(d)
            object.__setattr__(d, "request_id", "11111111-1111-4111-8111-111111111111")
            ans["request_id"] = d.request_id  # an answer that would match the forged DTO
            return ans

    ls.async_register_consumer(hass, Tamperer())
    with pytest.raises(ls.LeaseUnavailable) as err:
        _call(hass, "capture_status")
    assert err.value.code == "lease_dto_tampered"

    class SealForger:
        def handle(self, d: Any) -> Any:
            object.__setattr__(d, "body_sha256", "0" * 64)
            return _ack(d)

    hass2 = _hass()
    ls.async_register_consumer(hass2, SealForger())
    with pytest.raises(ls.LeaseUnavailable) as err2:
        _call(hass2, "capture_status")
    assert err2.value.code == "lease_dto_tampered"


def test_the_v1_dto_has_no_kid_binding_revision_null_and_the_transport_is_exactly_one_field():
    dto = _dto("capture_start")
    fields = {f.name for f in dataclasses.fields(dto)}
    assert "kid" not in fields and "sig" not in fields and "ts" not in fields
    j = dto.as_json()
    assert "kid" not in j and "kid" not in json.dumps(j)
    assert dto.params["lease"]["binding_revision"] is None
    for extra in ({"kid": "g1-0a1b2c3d"}, {"binding_revision": None}):
        with pytest.raises(lc.Reject) as err:
            lc.validate("request", {"signed_message_json": ACCEPT["capture_start"]["signed_message_json"], **extra}, _ks(), ACCEPT["capture_start"]["now"])
        assert (err.value.stage, err.value.code) == ("transport", "transport_shape")
    assert (const.SERVICE_LEASE_EVENT, const.SERVICE_LEASE_REQUEST) == ("lease_event", "lease_request")


def test_the_capture_gate_stays_closed():
    text = (REPO / "smplwise_vms" / "backend" / "smplwise" / "services" / "capture_lease.py").read_text(encoding="utf-8")
    assert "\nGO_LIVE_PERMITTED = False" in text
