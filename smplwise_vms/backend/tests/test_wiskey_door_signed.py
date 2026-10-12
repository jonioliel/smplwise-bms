"""CR-033 slices D5a / D5b, PREP on fakes (WXD-INT, 2026-10-12): the add-on side of bridge 0.8.1's `execute` block and the
signed `door_open` acceptance path against the fake WisKey consumer (FakeTrustedBridge = the DTO v3 reference model).

- D5a (add-on side): `ha_client.call_bridge_execute`, the one function that sends `execute`, refuses a WisKey door before
  anything leaves (`wiskey_door_execute_blocked`, the bridge 0.8.1 code) - whoever built the payload.
- D5b (acceptance path, flag on only in these tests): the signed actor binding (actor, command, target, request id are
  all under the signature), replay never dispatches twice, an UNKNOWN outcome is never success, a write is never retried,
  the trusted path stays unavailable / off by default and is switched only by the administrator setting; review I7 (status
  rate limit) and I8 (no Unicode format character in a signed actor name).

No live door command, no real key (the pairing secret is the published golden-vector TEST constant), no Home Assistant,
no bridge, no WisKey."""
from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any

import pytest
from conftest import as_user, bind
from fake_trusted_bridge import TEST_SECRET, FakeClock
from test_wiskey_door_path import API, DOCK, ENTRY, SIDE, _clean, env, map_all, rows, signed, tile, world  # noqa: F401  (fixtures)

from smplwise.db import Database, now_iso, set_setting
from smplwise.errors import ApiError
from smplwise.routers import access_control
from smplwise.services import door_execute_guard, ha_actions, ha_client, trusted_door


REAL_EXECUTE = ha_client.call_bridge_execute  # the `world` fixture replaces it with a recorder; D5a tests the real one


@pytest.fixture(autouse=True)
def _status_rate():
    trusted_door.reset_status_rate()
    yield
    trusted_door.reset_status_rate()


# ================================================================ D5a: the add-on never sends `execute` for a WisKey door

class _Posted:
    def __init__(self) -> None:
        self.bodies: list[dict[str, Any]] = []

    def post(self, url: str, headers: Any = None, content: str = "", timeout: float = 0) -> Any:
        self.bodies.append(json.loads(content))
        return SimpleNamespace(status_code=200, text="{}", json=lambda: {"service_response": {"ok": True}})


@pytest.fixture()
def wire(world, monkeypatch):
    """The real `call_bridge_execute` with its HTTP client replaced by a recorder (nothing leaves the process)."""
    posted = _Posted()
    monkeypatch.setattr(ha_client, "call_bridge_execute", REAL_EXECUTE)
    monkeypatch.setattr(ha_client, "configured", lambda s: True)
    monkeypatch.setattr(ha_client, "_bridge_client", lambda s: posted)
    with world["db"].connection() as conn:
        conn.execute("INSERT INTO ha_entities(entity_id, domain, name, platform, config_entry_id, state, state_seen_at, first_seen_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                     ("button.entrance_open", "button", "entrance_open", "hikvision_intercom", ENTRY, "unknown", now_iso(), now_iso(), now_iso()))
        conn.execute("INSERT INTO ha_entities(entity_id, domain, name, platform, config_entry_id, state, state_seen_at, first_seen_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                     ("lock.mystery", "lock", "mystery", None, None, "locked", now_iso(), now_iso(), now_iso()))
    return posted


def _send(world: dict[str, Any], domain: str, service: str, entity: Any) -> Any:
    return ha_client.call_bridge_execute(world["settings"], {"user_id": "u", "domain": domain, "service": service, "data": {"entity_id": entity}, "request_id": "r"})


def test_d5a_execute_refuses_every_wiskey_door_whoever_built_the_payload(world, wire):
    """T3 at the send function: a WisKey-platform lock (both platform names), a WisKey button, a mapped door, a lock list
    holding one, and a lock the mirror does not know (where a WisKey door exists) never leave; an ordinary lock does."""
    for domain, service, entity, reason in (
        ("lock", "unlock", "lock.entrance", "wiskey_platform"),
        ("lock", "unlock", "lock.side", "wiskey_platform"),
        ("lock", "lock", "lock.entrance", "wiskey_platform"),
        ("button", "press", "button.entrance_open", "wiskey_platform"),
        ("lock", "unlock", ["lock.office", "lock.dock_gate"], "wiskey_platform"),
        ("lock", "unlock", "lock.office, lock.entrance", "wiskey_platform"),
        ("lock", "unlock", "lock.mystery", "unknown_lock"),
        ("lock", "unlock", "lock.never_seen", "unknown_lock"),
    ):
        with pytest.raises(ApiError) as exc:
            _send(world, domain, service, entity)
        assert exc.value.code == door_execute_guard.BLOCKED_CODE and exc.value.status == 409, (entity, exc.value.code)
        assert exc.value.details == {"outcome": "not_sent", "sent": False, "reason": reason}, entity
    assert wire.bodies == [], "nothing left the add-on"
    assert _send(world, "lock", "unlock", "lock.office") == {"ok": True}
    assert _send(world, "light", "turn_on", "light.kitchen") == {"ok": True}
    assert [b["data"]["entity_id"] for b in wire.bodies] == ["lock.office", "light.kitchen"]


def test_d5a_a_door_map_row_is_a_door_whatever_the_platform_says(world, wire):
    with world["db"].connection() as conn:
        conn.execute("INSERT INTO intercom_door_map(entity_id, config_entry_id, physical_index, source, mapped_by, mapped_at) VALUES (?,?,?,?,?,?)",
                     ("lock.office", DOCK, 2, "manual", "test", now_iso()))
    with pytest.raises(ApiError) as exc:
        _send(world, "lock", "unlock", "lock.office")
    assert exc.value.details["reason"] == "door_map" and wire.bodies == []


def test_d5a_without_a_wiskey_door_an_unknown_lock_is_not_judged(settings, monkeypatch):
    posted = _Posted()
    monkeypatch.setattr(ha_client, "call_bridge_execute", REAL_EXECUTE)
    monkeypatch.setattr(ha_client, "configured", lambda s: True)
    monkeypatch.setattr(ha_client, "_bridge_client", lambda s: posted)
    from smplwise.main import create_app

    create_app(settings)  # migrations: an installation without any WisKey lock or door map row
    assert ha_client.call_bridge_execute(settings, {"domain": "lock", "service": "unlock", "data": {"entity_id": "lock.never_seen"}}) == {"ok": True}
    assert len(posted.bodies) == 1


def test_d5a_other_domains_never_read_the_mirror_and_an_unreadable_mirror_refuses_locks(world, wire, monkeypatch):
    import smplwise.db as dbmod

    class Broken:
        def __init__(self, *_a: Any, **_k: Any) -> None:
            raise OSError("disk")

    monkeypatch.setattr(dbmod, "Database", Broken)
    assert _send(world, "light", "turn_off", "light.kitchen") == {"ok": True}, "no database read for a domain that holds no door"
    with pytest.raises(ApiError) as exc:
        _send(world, "lock", "unlock", "lock.office")
    assert exc.value.details["reason"] == "guard_unavailable", "fail closed for lock / button"
    assert [b["domain"] for b in wire.bodies] == ["light"]


def test_d5a_the_bridge_081_answer_is_a_failure_never_pending():
    """Bridge 0.8.1 answers `execute` for a WisKey lock with `wiskey_door_execute_blocked`: the action row is `failed`."""
    assert ha_actions.bridge_status({"ok": False, "error": "wiskey_door_execute_blocked"}) == ("failed", "wiskey_door_execute_blocked")


# ================================================================ D5b: the signed acceptance path on the fake WisKey

def _open(world: dict[str, Any], station_id: str = ENTRY, user: str = "dana", **fields: Any) -> Any:
    return world["c"].post(f"{API}/intercom/stations/{station_id}/release", json=env(confirmed=True, **fields), headers=as_user(user))


def test_d5b_the_signature_binds_actor_command_target_and_request_id(world, signed):
    """One open: the signed body names the REAL person, the command `door_open`, the station and relay, and the request id
    the audit and the reply carry. Changing any of them in the captured message breaks the signature: refused at the
    signature stage, nothing dispatched."""
    r = _open(world)
    assert r.status_code == 200, r.text
    (sent,) = signed.opens()
    m = sent["message"]
    assert (m["protocol"], m["action"], m["actor"], m["station"], m["params"]) == (trusted_door.PROTOCOL, "door_open", {"id": "dev-dana", "display_name": "dana"}, ENTRY, {"relay": 1})
    assert m["request_id"] == r.json()["door_request_id"]
    (attempt,) = [x for x in rows(world["db"], "intercom.release") if x["details"].get("phase") == "attempt"]
    assert attempt["actor_user_id"] == "dev-dana" and attempt["details"]["door_request_id"] == m["request_id"]
    dispatched = len(signed.records)
    for path, value in ((("actor", "id"), "dev-mallory"), (("actor", "display_name"), "mallory"), (("action",), "door_open_status"), (("station",), SIDE),
                        (("params", "relay"), 2), (("request_id",), trusted_door.new_request_id())):
        forged = json.loads(sent["text"])
        node = forged
        for key in path[:-1]:
            node = node[key]
        node[path[-1]] = value
        answer = signed.call_service(None, "smplwise_bridge", "door_open", {"signed_message_json": json.dumps(forged, ensure_ascii=False, separators=(",", ":"))}, return_response=True)
        assert answer["result"] == "rejected", (path, answer)
        assert trusted_door.classify(answer, forged["request_id"])[0] == "refused"
    assert len(signed.records) == dispatched, "no altered message reached the door"


def test_d5b_a_replay_never_opens_twice(world, signed, monkeypatch):
    """The captured message sent again: the bridge answers from its store (never dispatched twice); sent after its 30 s
    lifetime it is refused at the time stage. Arx itself never re-sends: a repeated client request is a duplicate."""
    body = env(confirmed=True)
    assert world["c"].post(f"{API}/intercom/stations/{ENTRY}/release", json=body, headers=as_user("dana")).status_code == 200
    (sent,) = signed.opens()
    again = signed.call_service(None, "smplwise_bridge", "door_open", {"signed_message_json": sent["text"]}, return_response=True)
    assert again["result"] == "stored_result" and len(signed.records) == 1
    signed.clock = FakeClock(offset_s=120)
    late = signed.call_service(None, "smplwise_bridge", "door_open", {"signed_message_json": sent["text"]}, return_response=True)
    assert late["result"] == "rejected" and late["stage"] == "time", late
    assert len(signed.records) == 1
    signed.clock = FakeClock()
    dup = world["c"].post(f"{API}/intercom/stations/{ENTRY}/release", json=body, headers=as_user("dana"))
    assert dup.status_code == 409 and dup.json()["code"] == "intercom_duplicate_command"
    assert len(signed.opens()) == 3, "the two replays above were the test's own; Arx sent exactly one"


@pytest.mark.parametrize("result", ["unconfirmed", "interrupted", "outcome_persistence_failed"])
def test_d5b_an_unknown_outcome_is_never_success(world, signed, result):
    """WisKey cannot confirm the dispatch: 504 `door_outcome_unknown`, the tile row `unknown` (never `confirmed`), the
    outcome audit row `unknown`, the relay held, no "sent" text anywhere in the reply."""
    signed.dispatch_result = result
    r = tile(world["c"], "lock.side", "dana")
    assert r.status_code == 504 and r.json()["code"] == "door_outcome_unknown" and r.json()["details"]["outcome"] == "unknown", r.text
    assert "נשלח" not in json.dumps(r.json(), ensure_ascii=False).replace("לא ידוע אם נשלח", "")
    with Database(world["settings"].db_path).connection(mode="read") as conn:
        assert [x["status"] for x in conn.execute("SELECT status FROM ha_actions").fetchall()] == ["unknown"]
    outcome = [x for x in rows(world["db"], "intercom.release") if x["details"].get("phase") == "outcome"][-1]
    assert outcome["details"]["outcome"] == "unknown"
    assert tile(world["c"], "lock.side", "dana").json()["code"] == "intercom_release_in_progress"
    assert len(signed.opens()) == 1


def test_d5b_a_write_is_never_retried_and_a_second_open_is_a_new_request(world, signed):
    """A timeout after a possible delivery: exactly one door_open; the status read is the only follow-up; once the relay
    hold is over a new open needs a new click (a new request id, its own confirmation)."""
    signed.timeout_after_delivery = True
    r = _open(world, SIDE)
    assert r.status_code == 504 and r.json()["details"]["outcome"] == "unknown"
    first = r.json()["details"]["door_request_id"]
    signed.timeout_after_delivery = False
    assert len(signed.opens()) == 1
    st = world["c"].post(f"{API}/doors/requests/{first}/status", headers=as_user("dana"))
    assert st.status_code == 200 and len(signed.opens()) == 1 and len(signed.statuses()) == 1
    access_control.RELAYS.clear()  # the hold is over
    unconfirmed = world["c"].post(f"{API}/intercom/stations/{SIDE}/release", json=env(), headers=as_user("dana"))
    assert unconfirmed.status_code == 409 and unconfirmed.json()["code"] == "confirmation_required"
    r2 = _open(world, SIDE)
    assert r2.status_code == 200 and r2.json()["door_request_id"] != first
    assert [o["message"]["request_id"] for o in signed.opens()] == [first, r2.json()["door_request_id"]]


def test_d5b_the_trusted_path_is_unavailable_by_default_and_only_the_administrator_setting_switches_it(world):
    """No bridge offers door_open yet (MIN_BRIDGE_FOR_TRUSTED_PATH is None): unavailable whatever version is reported. The
    flag moves only through PUT /doors/settings (system.configure, confirmed, audited) - not through PATCH /settings."""
    c = world["c"]
    assert trusted_door.MIN_BRIDGE_FOR_TRUSTED_PATH is None
    with world["db"].connection() as conn:
        set_setting(conn, "bridge.integration_version", "9.9.9")
        assert trusted_door.trusted_path_available(conn) is False
    assert c.get(f"{API}/doors/settings").json()["trusted_path"] == "off"
    bind(c, world["settings"], "otto", "operator", "installation", "*")
    assert c.put(f"{API}/doors/settings", json={"trusted_path": "on", "confirmed": True}, headers=as_user("otto")).status_code == 403
    c.patch(f"{API}/settings", json={"doors.trusted_path": "on"})
    c.patch(f"{API}/settings", json={"doors": {"trusted_path": "on"}})
    with world["db"].connection(mode="read") as conn:
        assert trusted_door.mode(conn) == "off"
    denied = [x for x in rows(world["db"], "settings.changed") if x["decision"] == "denied"]
    assert denied == [], "the operator was stopped by the permission, before the flag logic"
    r = c.put(f"{API}/doors/settings", json={"trusted_path": "on", "confirmed": True})
    assert r.status_code == 409 and r.json()["code"] == "trusted_path_unavailable"
    assert [x["reason"] for x in rows(world["db"], "settings.changed") if x["decision"] == "denied"] == ["trusted_path_unavailable"]


def test_i8_a_signed_actor_name_never_carries_a_format_character():
    """Review I8: bidi embeddings / overrides / isolates and the LRM / RLM marks are refused in every signed text field;
    the actor name falls back to the user name, then the id - never an altered string."""
    for bad in ("דנה‮", "⁦x", "a‏b", "z​"):
        assert trusted_door._text_ok(bad) is False, repr(bad)
        with pytest.raises(ApiError) as exc:
            trusted_door.sign_message(TEST_SECRET, "door_open", "dev-dana", bad, ENTRY, {"relay": 1}, trusted_door.new_request_id())
        assert exc.value.code == "door_message_invalid" and exc.value.details == {"outcome": "not_sent"}
    assert trusted_door.actor_name(SimpleNamespace(display_name="דנה‮כהן", username="dana", user_id="u1")) == "dana"
    assert trusted_door.actor_name(SimpleNamespace(display_name="", username="⁧", user_id="u1")) == "u1"
    assert trusted_door.actor_name(SimpleNamespace(display_name="דנה כהן", username="dana", user_id="u1")) == "דנה כהן"


def test_i7_the_status_read_is_rate_limited_per_person(world, signed):
    signed.timeout_after_delivery = True
    rid = _open(world).json()["details"]["door_request_id"]
    signed.timeout_after_delivery = False
    codes = [world["c"].post(f"{API}/doors/requests/{rid}/status", headers=as_user("dana")).status_code for _ in range(trusted_door.STATUS_PER_MIN + 1)]
    assert codes == [200] * trusted_door.STATUS_PER_MIN + [429]
    assert len(signed.statuses()) == trusted_door.STATUS_PER_MIN and len(signed.opens()) == 1
