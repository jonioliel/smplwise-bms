"""WKA-295 (WisKey's answer of 2026-10-22, item A03): the capture lease's public registration port as built, pinned by tests.
Design note: docs/changes/WKA-295-LEASE-PORT.md.

- the documented root re-export (`custom_components.smplwise_bridge.async_register_consumer` and friends) are lease_service's own objects;
- `async_register_consumer` is a plain (synchronous) function returning the registration - the `async_` prefix is Home Assistant's "call it
  from the event loop" convention, not a coroutine;
- the exact `LeaseDTO.as_json()` field list (no `protocol`, no `authenticated_message_sha256` - nothing is added for WisKey's projection);
- the source checks run before AND after the consumer's await: a capability replaced or dropped under LEASE_CAPABILITY_KEY while the consumer
  answered, or a DTO the capability no longer recognises (`verify_dto`), is never relayed.

Like test_bridge_lease_lifecycle.py: Home Assistant is NOT installed here; pure modules via bridge_loader, `hass` is a fake with a `data` dict.
Synthetic data only (the golden vectors and their published TEST key)."""
from __future__ import annotations

import ast
import asyncio
import hashlib
import inspect
import json
import re
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
AS_JSON_KEYS = ["action", "actor", "station", "params", "request_id", "nonce", "issued_at", "expires_at", "body_sha256"]


def _hass() -> Any:
    return types.SimpleNamespace(data={})


def _ack(dto: Any) -> dict[str, Any]:
    return {"result": "acknowledged", "request_id": dto.request_id, "capture": {"state": "waiting", "error": None, "card": None}}


def _call(hass: Any, vid: str = "capture_status") -> dict[str, Any]:
    v = ACCEPT[vid]
    return asyncio.run(ls.async_handle(hass, "svc", KIND[v["service"]], {"signed_message_json": v["signed_message_json"]},
                                       keyset.KeySet(TEST_SECRET), v["now"]))


def _dto(vid: str) -> Any:
    v = ACCEPT[vid]
    return lc.validate(KIND[v["service"]], {"signed_message_json": v["signed_message_json"]}, keyset.KeySet(TEST_SECRET), v["now"])


# ---------------------------------------------------------------- the port's shape (negative first)

def test_the_registration_door_is_synchronous_and_returns_the_registration_at_once():
    assert not inspect.iscoroutinefunction(ls.async_register_consumer)
    reg = ls.async_register_consumer(_hass(), types.SimpleNamespace(handle=lambda dto: None), owner="smplwise_intercom")
    assert not inspect.isawaitable(reg) and type(reg) is ls.LeaseRegistration and reg.active


@pytest.mark.parametrize("owner", ["", "Smplwise", "smplwise-intercom", "smplwise intercom", "x" * 65, "ünï", 7, b"smplwise", "a\n"])
def test_owner_is_none_or_a_short_lowercase_token(owner):
    with pytest.raises(ValueError):
        ls.async_register_consumer(_hass(), types.SimpleNamespace(handle=lambda dto: None), owner=owner)  # type: ignore[arg-type]


def test_owner_regex_is_the_documented_one():
    assert ls.OWNER_RE.pattern == r"[a-z0-9_]{1,64}"
    for ok in ("smplwise_intercom", "a", "x" * 64, "0_9"):
        ls.async_register_consumer(_hass(), types.SimpleNamespace(handle=lambda dto: None), owner=ok)


def test_the_package_root_re_exports_the_port_and_nothing_else_is_promised():
    tree = bridge_loader.init_tree()
    imported: dict[str, str] = {}
    public: tuple[str, ...] | None = None
    for node in tree.body:
        if isinstance(node, ast.ImportFrom) and node.level == 1 and node.module in ("lease_service", "lease_contract"):
            for alias in node.names:
                imported[alias.asname or alias.name] = node.module
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "LEASE_PUBLIC_API" for t in node.targets):
            public = tuple(ast.literal_eval(node.value))
    assert public == ("async_register_consumer", "async_get_capability", "is_bridge_capability", "LeaseCapability", "LeaseRegistration",
                      "LeaseConsumer", "LeaseUnavailable", "LeaseDTO")
    for name in public:
        assert name in imported, f"{name} is promised by LEASE_PUBLIC_API but not imported at the package root"
        module = ls if imported[name] == "lease_service" else lc
        assert hasattr(module, name), name
    assert imported["LeaseDTO"] == "lease_contract" and imported["async_register_consumer"] == "lease_service"
    # the old submodule path keeps working
    assert any(isinstance(n, ast.ImportFrom) and n.level == 1 and n.module is None and [a.name for a in n.names] == ["lease_service"] for n in tree.body)


def test_the_mirror_has_the_same_root_export():
    assert (bridge_loader.SRC / "__init__.py").read_bytes() == (bridge_loader.MIRROR / "__init__.py").read_bytes()
    assert (bridge_loader.SRC / "lease_service.py").read_bytes() == (bridge_loader.MIRROR / "lease_service.py").read_bytes()


# ---------------------------------------------------------------- LeaseDTO.as_json: exactly these fields, nothing invented

@pytest.mark.parametrize("vid", list(ACCEPT))
def test_as_json_has_exactly_the_documented_fields(vid):
    j = _dto(vid).as_json()
    assert list(j) == AS_JSON_KEYS
    assert sorted(j["actor"]) == ["display_name", "id"]
    for absent in ("protocol", "authenticated_message_sha256", "kid", "ts", "sig", "kind"):
        assert absent not in j, absent


def test_body_sha256_is_the_signed_body_without_ts_nonce_and_sig():
    v = ACCEPT["capture_start"]
    wire = json.loads(v["signed_message_json"])
    body = {k: x for k, x in wire.items() if k not in ("ts", "nonce", "sig")}
    want = hashlib.sha256(json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")).hexdigest()
    dto = _dto("capture_start")
    assert dto.as_json()["body_sha256"] == want == v["body_sha256_of_signed_fields"]
    whole = hashlib.sha256(v["signed_message_json"].encode("utf-8")).hexdigest()
    assert dto.body_sha256 != whole, "it is NOT a digest of the whole authenticated message"
    assert body["protocol"] == lc.PROTOCOL  # the protocol is inside the sealed body, but as_json does not repeat it


# ---------------------------------------------------------------- source checks before AND after the consumer's await (negative first)

class _Swapper:
    """A consumer during whose answer something else replaces (or drops) the capability under the key."""

    def __init__(self, hass: Any, replacement: Any, drop: bool = False) -> None:
        self.hass, self.replacement, self.drop, self.seen = hass, replacement, drop, []

    async def handle(self, dto: Any) -> Any:
        self.seen.append(dto)
        await asyncio.sleep(0)
        if self.drop:
            self.hass.data.pop(const.LEASE_CAPABILITY_KEY)
        else:
            self.hass.data[const.LEASE_CAPABILITY_KEY] = self.replacement
        await asyncio.sleep(0)
        return _ack(dto)


@pytest.mark.parametrize("replacement", ["foreign", "other_bridge_capability", "dropped"])
def test_an_answer_is_not_relayed_when_the_capability_was_replaced_or_dropped_meanwhile(replacement):
    hass = _hass()
    other = ls.async_get_capability(_attach(_hass()))
    repl = {"foreign": types.SimpleNamespace(domain="smplwise_bridge"), "other_bridge_capability": other, "dropped": None}[replacement]
    c = _Swapper(hass, repl, drop=replacement == "dropped")
    ls.async_register_consumer(hass, c, owner="smplwise_intercom")
    with pytest.raises(ls.LeaseUnavailable) as err:
        _call(hass)
    assert err.value.code == "lease_consumer_removed" and len(c.seen) == 1


def _attach(hass: Any) -> Any:
    ls.async_attach_bridge(hass, "entry-x")
    return hass


def test_an_answer_is_not_relayed_when_the_capability_no_longer_recognises_the_dto():
    """The 'after' check uses verify_dto (issued by THIS capability, alive, sealed), not only the seal."""
    hass = _hass()

    class Forgetter:
        async def handle(self, dto: Any) -> Any:
            cap = ls.async_get_capability(hass)
            assert cap.verify_dto(dto)  # before: the consumer can check its DTO
            cap._issued.clear()  # something drops the bridge's record of what it issued
            await asyncio.sleep(0)
            return _ack(dto)

    ls.async_register_consumer(hass, Forgetter())
    with pytest.raises(ls.LeaseUnavailable) as err:
        _call(hass)
    assert err.value.code == "lease_dto_tampered"


def test_nothing_is_dispatched_when_the_source_is_not_the_bridges_capability_before_the_call():
    hass = _hass()
    seen: list[Any] = []
    hass.data[const.LEASE_CAPABILITY_KEY] = types.SimpleNamespace(registration=types.SimpleNamespace(_consumer=types.SimpleNamespace(handle=seen.append)))
    with pytest.raises(ls.LeaseUnavailable) as err:
        _call(hass)
    assert err.value.code == "lease_consumer_missing" and seen == []


def test_an_unchanged_source_still_relays_the_answer():
    hass = _attach(_hass())
    seen: list[Any] = []

    class Ok:
        async def handle(self, dto: Any) -> Any:
            seen.append(ls.async_get_capability(hass).verify_dto(dto))
            await asyncio.sleep(0)
            return _ack(dto)

    ls.async_register_consumer(hass, Ok(), owner="smplwise_intercom")
    assert _call(hass)["result"] == "acknowledged" and seen == [True]


def test_the_closed_late_and_tamper_codes_are_exactly_these():
    src = (bridge_loader.SRC / "lease_service.py").read_text(encoding="utf-8")
    codes = set(re.findall(r'LeaseUnavailable\("([a-z_]+)"\)', src))
    assert codes == {"lease_consumer_missing", "lease_consumer_removed", "lease_bridge_unloaded", "lease_dto_tampered", "lease_consumer_failed",
                     "lease_answer_invalid"}


def test_the_capture_gate_stays_closed():
    text = (REPO / "smplwise_vms" / "backend" / "smplwise" / "services" / "capture_lease.py").read_text(encoding="utf-8")
    assert "\nGO_LIVE_PERMITTED = False" in text
