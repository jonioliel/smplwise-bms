"""CR-BRIDGE-COMMON-2440 (review 05 P2-20): the bridge's shared helpers (`_common.py`) and the per-module names that now point at them.

Pure refactor: every table below states the behaviour the modules had before, per variant, and the signatures are compared with the
original recipe (the json.dumps call three modules typed out), kept in this file as `_original_canonical`.
"""
from __future__ import annotations

import ast
import hashlib
import hmac
import json
from collections import deque
from types import SimpleNamespace

import pytest

import bridge_loader

common = bridge_loader.load("_common")
signing = bridge_loader.load("signing")
keyset = bridge_loader.load("keyset")
lease_contract = bridge_loader.load("lease_contract")
schedule_service = bridge_loader.load("schedule_service")
config_service = bridge_loader.load("config_service")
runnable = bridge_loader.load("runnable")
service_identity = bridge_loader.load("service_identity")
cast_service = bridge_loader.load("cast_service")
stream_source_service = bridge_loader.load("stream_source_service")
media_query_service = bridge_loader.load("media_query_service")
wiskey_door_block = bridge_loader.load("wiskey_door_block")  # not moved (its import pin): its walk is pinned here next to the other

BODIES = [
    {},
    {"b": 1, "a": 2},
    {"users": [{"id": "u1", "name": "דנה כהן", "is_admin": False, "group_ids": ["system-users"]}], "version": "0.10.7", "rotation": "rotation_v1"},
    {"nested": {"z": [1, 2.5, None, True], "a": {"é": "ü", "quote": "\"", "slash": "/", "tab": "\t"}}, "n": -0.0, "big": 2 ** 53},
]


def _original_canonical(body) -> str:
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


# ---------------------------------------------------------------- canonical JSON: one function, byte-identical signatures

def test_one_canonical_json_under_the_three_module_names():
    assert keyset.canonical is common.canonical and lease_contract._canonical is common.canonical and signing.canonical is common.canonical
    for body in BODIES:
        assert common.canonical(body) == _original_canonical(body)
    assert common.canonical({"b": "ש", "a": 1}) == '{"a":1,"b":"ש"}'


def test_signatures_are_byte_identical_to_the_typed_out_recipes():
    for i, body in enumerate(BODIES):
        ts, nonce = 1794819000 + i, f"{i:032x}"
        body_hash = hashlib.sha256(_original_canonical(body).encode("utf-8")).hexdigest()
        v1 = hmac.new(b"pairing code", f"{ts}.{nonce}.{body_hash}".encode(), hashlib.sha256).hexdigest()
        v2 = hmac.new(b"key material", f"v2.g3-0a1b2c3d.{ts}.{nonce}.{body_hash}".encode(), hashlib.sha256).hexdigest()
        assert signing.sign("pairing code", body, ts, nonce) == {**body, "ts": ts, "nonce": nonce, "sig": v1}
        assert keyset.v1_sig("pairing code", body, ts, nonce) == v1
        assert keyset.v2_sig("key material", "g3-0a1b2c3d", body, ts, nonce) == v2


def test_pinned_vectors():
    """Fixed outputs of the canonical form (the add-on verifies exactly these bytes)."""
    body = BODIES[2]
    assert signing.sign("pairing code", body, 1794819000, "00000000000000aa")["sig"] == _hex(b"pairing code", "1794819000.00000000000000aa.", body)
    assert common.canonical(body) == ('{"rotation":"rotation_v1","users":[{"group_ids":["system-users"],"id":"u1","is_admin":false,"name":"דנה כהן"}],'
                                      '"version":"0.10.7"}')
    assert common.canonical(BODIES[3]) == '{"big":9007199254740992,"n":-0.0,"nested":{"a":{"quote":"\\"","slash":"/","tab":"\\t","é":"ü"},"z":[1,2.5,null,true]}}'


def _hex(key: bytes, prefix: str, body) -> str:
    return hmac.new(key, (prefix + hashlib.sha256(_original_canonical(body).encode()).hexdigest()).encode(), hashlib.sha256).hexdigest()


# ---------------------------------------------------------------- the refusal answer

def test_refusal_shapes():
    msg = {"request_id": "r1", "query": "queue"}
    assert common.refusal(msg, "x") == {"ok": False, "request_id": "r1", "error": "x"}
    assert list(common.refusal(msg, "x", "payload.a", revision="7")) == ["ok", "request_id", "error", "path", "revision"]
    assert common.refusal(msg, "x", "") == {"ok": False, "request_id": "r1", "error": "x"}  # an empty path is no path
    assert common.refusal({}, "x") == {"ok": False, "request_id": None, "error": "x"}
    # the plain variant hands a non-text id back as it came; the text variant answers null
    assert common.refusal({"request_id": 7}, "x")["request_id"] == 7
    assert common.refusal({"request_id": 7}, "x", text_id=True)["request_id"] is None
    assert common.refusal({"request_id": "r"}, "x", text_id=True)["request_id"] == "r"


def test_the_module_refusals_keep_their_shapes(caplog):
    msg = {"request_id": "r1"}
    assert schedule_service._refuse(msg, "e") == {"ok": False, "request_id": "r1", "error": "e"}
    assert schedule_service._refuse(msg, "e", "payload.x") == {"ok": False, "request_id": "r1", "error": "e", "path": "payload.x"}
    assert config_service._refuse(msg, "e", None, detail="d") == {"ok": False, "request_id": "r1", "error": "e", "detail": "d"}
    assert config_service._refuse(msg, "e", "config.x", detail="d") == {"ok": False, "request_id": "r1", "error": "e", "path": "config.x", "detail": "d"}
    assert cast_service._refuse({"request_id": ["x"]}, "e") == {"ok": False, "request_id": None, "error": "e"}
    assert stream_source_service._refuse({"request_id": 5}, "e") == {"ok": False, "request_id": None, "error": "e"}
    assert stream_source_service._refuse(msg, "e") == {"ok": False, "request_id": "r1", "error": "e"}
    with caplog.at_level("WARNING"):
        assert service_identity._refuse({"request_id": 5}, "execute", "service_identity_refused") == {"ok": False, "request_id": 5, "error": "service_identity_refused"}
    assert "smplwise_bridge.execute refused: service_identity_refused" in caplog.text


# ---------------------------------------------------------------- the entity policy: two variants

class _Perms:
    def __init__(self, answers):
        self.answers, self.asked = answers, []

    def check_entity(self, entity_id, policy):
        self.asked.append((entity_id, policy))
        answer = self.answers[entity_id]
        if isinstance(answer, Exception):
            raise answer
        return answer


def _user(answers=None, **kw):
    return SimpleNamespace(permissions=_Perms(answers) if answers is not None else None, **kw)


CONTROL = "control"
# (user, policy_control, entity ids) -> (lenient answer, strict answer)
POLICY_CASES = [
    (lambda: _user({"a.b": True}, is_admin=True), CONTROL, ["a.b"], None, "UNAVAILABLE"),  # an administrator: always may / a fault
    (lambda: _user({"a.b": True}), CONTROL, ["a.b"], None, "UNAVAILABLE"),  # a user object that does not say: not an administrator / a fault
    (lambda: _user({"a.b": True}, is_admin=False), CONTROL, ["a.b"], None, None),
    (lambda: _user({"a.b": True, "c.d": False}, is_admin=False), CONTROL, ["a.b", "c.d"], "REFUSED", "REFUSED"),
    (lambda: _user({"a.b": 1}, is_admin=False), CONTROL, ["a.b"], None, "REFUSED"),  # truthy but not True: the strict variant refuses
    (lambda: _user({"a.b": None}, is_admin=False), CONTROL, ["a.b"], "REFUSED", "REFUSED"),
    (lambda: _user({"a.b": RuntimeError("x")}, is_admin=False), CONTROL, ["a.b"], "UNAVAILABLE", "UNAVAILABLE"),
    (lambda: _user(None, is_admin=False), CONTROL, ["a.b"], "UNAVAILABLE", "UNAVAILABLE"),  # no permission API
    (lambda: _user({"a.b": True}, is_admin=False), None, ["a.b"], "UNAVAILABLE", "UNAVAILABLE"),  # POLICY_CONTROL gone
    (lambda: _user({}, is_admin=False), CONTROL, [], None, None),
]


@pytest.mark.parametrize("make,control,ids,lenient,strict", POLICY_CASES)
def test_entity_policy_variants(make, control, ids, lenient, strict):
    codes = {"UNAVAILABLE": "u", "REFUSED": "r", None: None}
    assert common.entity_policy_refusal(make(), control, ids, unavailable="u", refused="r") == codes[lenient]
    assert common.entity_policy_refusal(make(), control, ids, strict=True, unavailable="u", refused="r") == codes[strict]
    # the three module names answer as before, with their own codes
    deps = SimpleNamespace(POLICY_CONTROL=control)
    own = {"UNAVAILABLE": "permission_check_unavailable", "REFUSED": "unauthorized", None: None}
    assert schedule_service._check_permissions(make(), deps, ids) == own[lenient]
    assert config_service._check_permissions(make(), deps, ids) == own[lenient]
    run = {"UNAVAILABLE": runnable.POLICY_UNAVAILABLE, "REFUSED": runnable.POLICY_REFUSED, None: None}
    assert runnable.policy_refusal(make(), control, ids) == run[strict]
    if strict == "REFUSED":
        assert runnable.policy_refusal(make(), control, ids, refused="impact_entity_policy") == "impact_entity_policy"


def test_the_policy_stops_at_the_first_refusal_and_asks_with_the_control_policy():
    user = _user({"a.b": True, "c.d": False, "e.f": True}, is_admin=False)
    assert common.entity_policy_refusal(user, CONTROL, ["a.b", "c.d", "e.f"]) == "unauthorized"
    assert user.permissions.asked == [("a.b", CONTROL), ("c.d", CONTROL)]
    assert schedule_service._PERMISSION_UNAVAILABLE == common.PERMISSION_UNAVAILABLE == "permission_check_unavailable"


# ---------------------------------------------------------------- the group walk's member list

def _state(**attributes):
    return SimpleNamespace(attributes=attributes)


def test_group_members():
    assert common.group_members(None) is None
    assert common.group_members(_state(friendly_name="x")) is None
    assert common.group_members(SimpleNamespace(attributes=None)) is None
    assert common.group_members(_state(entity_id="light.a")) == ["light.a"]
    members = ["light.a", 5]
    assert common.group_members(_state(entity_id=members)) is members  # as given: each walk judges the members itself
    assert common.group_members(_state(entity_id=("light.a",))) == ("light.a",)
    assert common.group_members(_state(entity_id=[])) == []
    for odd in ({"light.a"}, {"a": 1}, 5, True):
        assert common.group_members(_state(entity_id=odd)) is common.UNREADABLE


class _Registry:
    def __init__(self, platforms):
        self.entities = {k: SimpleNamespace(entity_id=k, platform=v) for k, v in platforms.items()}

    def async_get(self, entity_id):
        return self.entities.get(entity_id)


def _hass(states):
    return SimpleNamespace(states=SimpleNamespace(get=lambda entity_id: states.get(entity_id)))


def test_both_group_walks_keep_their_own_rules():
    reg = _Registry({"switch.schedule_1": "scheduler", "lock.door": "hikvision_intercom", "light.a": "hue"})
    chain = {f"group.g{i}": _state(entity_id=[f"group.g{i + 1}"]) for i in range(8)}
    states = {
        "group.plain": _state(entity_id=["light.a"]), "group.single": _state(entity_id="switch.schedule_1"),
        "group.sched": _state(entity_id=["light.a", "switch.schedule_1"]), "group.odd": _state(entity_id={"light.a"}),
        "group.bad_member": _state(entity_id=["light.a", 5]), "group.door": _state(entity_id=("lock.door",)),
        "group.loop": _state(entity_id=["group.loop"]), **chain,
    }
    walk = lambda eid: schedule_service._members_refusal(_hass(states), reg, eid, 0, set())  # noqa: E731
    assert walk("light.a") is None and walk("group.plain") is None and walk("group.loop") is None
    assert walk("switch.schedule_1") == walk("group.single") == walk("group.sched") == "scheduler_switch_not_allowed"
    assert walk("group.odd") == walk("group.bad_member") == "scheduler_group_unverifiable"
    assert walk("group.g0") == "scheduler_group_unverifiable" and schedule_service.GROUP_DEPTH == 5  # deeper than five levels
    assert walk("group.g4") is None  # g4 -> g5 -> g6 -> g7 -> g8 (no state): four levels

    door = lambda eid: wiskey_door_block.refusal("lock", {"entity_id": eid}, lambda: reg, states.get, wiskey_door_block.POLICY_BLOCKED)  # noqa: E731
    assert door("lock.door") == "wiskey_platform" and door("group.door") == "wiskey_group_member"
    assert door("group.plain") is None and door("group.loop") is None
    assert door("group.odd") == door("group.bad_member") == "group_unverifiable"
    assert door("group.g0") == "group_unverifiable" and wiskey_door_block.GROUP_DEPTH == 3
    assert door("group.g6") is None
    assert door("lock.unknown") == "unknown_lock"


# ---------------------------------------------------------------- the sliding window of the limiters

def test_window_full():
    q = deque([0.0, 10.0, 59.0])
    assert common.window_full(q, 60.0, 60.0, 3) is True and list(q) == [0.0, 10.0, 59.0]  # exactly a window old is still inside
    assert common.window_full(q, 60.5, 60.0, 3) is False and list(q) == [10.0, 59.0]
    assert common.window_full(q, 200.0, 60.0, 1) is False and not q
    assert common.window_full(deque(), 1.0, 60.0, 0) is True


def test_the_three_limiters_count_as_before(monkeypatch):
    monkeypatch.setattr(cast_service, "_calls", deque())
    assert [cast_service._rate_limited(float(i) / 100) for i in range(cast_service.RATE_MAX + 2)] == [False] * cast_service.RATE_MAX + [True, True]
    assert len(cast_service._calls) == cast_service.RATE_MAX  # a refused call is not counted
    assert cast_service._rate_limited(cast_service.RATE_WINDOW_S + 0.05) is False  # the oldest calls left the window

    monkeypatch.setattr(stream_source_service, "_calls", deque())
    monkeypatch.setattr(stream_source_service, "_calls_by_entity", {})
    per = stream_source_service.RATE_MAX_PER_ENTITY
    assert [stream_source_service._rate_limited(1.0, "camera.a") for _ in range(per + 1)] == [False] * per + [True]
    assert stream_source_service._rate_limited(1.0, "camera.b") is False and len(stream_source_service._calls) == per + 1
    for i in range(stream_source_service.RATE_MAX - per - 1):
        assert stream_source_service._rate_limited(2.0, f"camera.c{i}") is False
    assert stream_source_service._rate_limited(2.0, "camera.new") is True and not stream_source_service._calls_by_entity["camera.new"]

    monkeypatch.setattr(media_query_service, "_calls", deque())
    monkeypatch.setattr(media_query_service, "_user_calls", {})
    share = media_query_service.RATE_USER_MAX
    assert [media_query_service._rate_limited(1.0, "u1") for _ in range(share + 1)] == [False] * share + [True]
    assert len(media_query_service._calls) == share  # a refusal by the share never takes a global slot
    for n in range(2, 2 + (media_query_service.RATE_MAX - share) // share):
        assert all(media_query_service._rate_limited(1.0, f"u{n}") is False for _ in range(share))
    assert len(media_query_service._calls) == media_query_service.RATE_MAX
    assert media_query_service._rate_limited(1.0, "fresh") is True and media_query_service._rate_limited(1.0) is True
    assert media_query_service._rate_limited(1.0 + media_query_service.RATE_WINDOW_S + 0.1, "u1") is False


# ---------------------------------------------------------------- the module itself

def test_common_is_dependency_free_and_mirrored():
    src = (bridge_loader.SRC / "_common.py").read_text(encoding="utf-8")
    imported = set()
    for node in ast.walk(ast.parse(src)):
        if isinstance(node, ast.Import):
            imported |= {a.name.split(".")[0] for a in node.names}
        elif isinstance(node, ast.ImportFrom):
            assert node.level == 0, "_common.py imports no other module of the bridge"
            imported.add((node.module or "").split(".")[0])
    assert imported <= {"__future__", "json", "typing"}, imported
    assert (bridge_loader.MIRROR / "_common.py").read_bytes() == (bridge_loader.SRC / "_common.py").read_bytes()


def test_the_duplicates_are_gone_from_the_modules():
    """The recipe is typed once: no module but _common builds the canonical JSON or walks `permissions.check_entity` itself."""
    for path in sorted(bridge_loader.SRC.glob("*.py")):
        if path.name == "_common.py":
            continue
        text = path.read_text(encoding="utf-8")
        assert 'separators=(",", ":"), ensure_ascii=False' not in text or path.name == "config_policy.py", path.name  # config_policy.fingerprint: of number-normalised values, another purpose
        assert '"check_entity", None)' not in text, path.name
