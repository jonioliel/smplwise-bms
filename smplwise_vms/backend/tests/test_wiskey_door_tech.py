"""WISKEY-DOOR-TECH-2390 (plan 2026-11-03 T6, owner Q5 = a): door technical writes from Arx - a door's hold-open schedule (save /
delete), a public door code (set / clear), the door's hold-open program (apply / pause / remove) - end to end over the add-on's live
service session against the fake WisKey (tests/fake_wiskey.py, answered here statefully for the five writes and their reads, after the
rc.10 source): nothing contacts a device, a station, Home Assistant or WisKey.

What is proven:
- the exact frames: each command once, with the pinned catalog's keys and `api_contract`, on the closed `door_technical` channel; the
  code write's `door` is WisKey's API relay id (entry-c relay 2 -> api 7), read with `overview` in the same coroutine;
- the gates: `system.configure` or `access.stations.manage` somewhere before the body (audited 403); on the station an explicit deny of
  `access.stations.manage` wins even over `system.configure`; an unseen station is the uniform 404; no confirmation, no typed phrase for a
  code, an expired or duplicate envelope, an offline station for a device write, a malformed schedule -> refused, audited, nothing sent;
- honest results: `acknowledged`, `partial` (program saved, draft cleanup unknown), `refused` with WisKey's reason ("WisKey סירב"),
  `unknown` (no clear answer / timeout), `not_sent` - never retried;
- Arx's limits: the per-door cool-down after a send, the code window, the per-station in-flight slot;
- a code value is never in a reply, an error, an audit row or a log line."""
from __future__ import annotations

import copy
import json
import logging
import time
import uuid
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from conftest import as_user, bind
from fake_wiskey import PREFIX, FakeWiskey, fail, ok
from fastapi.testclient import TestClient
from intercom_station_scope import station_scope  # noqa: F401 - a fixture

from smplwise.db import Database
from smplwise.errors import ApiError
from smplwise.services import intercom_authority as ia
from smplwise.services import intercom_client, intercom_sync, wiskey_channels
from smplwise.services import wiskey_door_tech as dt

API = "/api/v1/access-control/stations"
NEW_CODE = "86420975"  # sentinels: a test fails if either ever appears outside the frame sent to the fake
CUR_CODE = "13579024"
WEEK = {d: [] for d in dt.WEEKDAYS}
POLICY = {"timezone": "Asia/Jerusalem", "name": "Lobby hours", "weekly": {**WEEK, "Sunday": [{"start": "07:00", "end": "19:00"}], "Monday": [{"start": "07:00", "end": "19:00"}]},
          "holidays": [{"name": "Holiday", "start": "2026-12-25", "end": "2026-12-26", "periods": []}]}


class DoorFake(FakeWiskey):
    """The fake WisKey with rc.10's door technical commands, stateful: hold drafts and programs per (station, door), public code
    presence (and the fake device's code values, to check the current code) per (station, slot). Switches: `fail_with[command]` (a
    failure code), `partial` (program save answers `program_saved_draft_cleanup_unknown` after saving)."""

    def __init__(self, *a: Any, **kw: Any) -> None:
        super().__init__(*a, **kw)
        self.fail_with: dict[str, str] = {}
        self.partial = False
        self.drafts: dict[tuple[str, int], dict[str, Any]] = {}
        self.programs: dict[tuple[str, int], dict[str, Any]] = {}
        self.codes: dict[tuple[str, int], str] = {}

    def _station(self, sid: Any) -> dict[str, Any] | None:
        return next((s for s in self.overview["stations"] if s["id"] == sid), None)

    def _answer(self, command: str, msg: dict[str, Any], auth: dict[str, Any]) -> list[Any]:
        if command in dt.COMMANDS or command in ("stations/technical_hold_get", "stations/technical_program_list", "stations/technical_codes_get"):
            station = self._station(msg.get("station_id"))
            if station is None:
                return [fail(msg, "station_unloaded")]
            if command in self.fail_with:
                return [fail(msg, self.fail_with[command])]
            physical = [lock["physical_index"] for lock in station.get("integrated_locks") or []]
            apis = [lock["api_id"] for lock in station.get("integrated_locks") or []]
            sid = station["id"]
            if command == "stations/technical_hold_get":
                if msg["door"] not in physical:
                    return [fail(msg, "operation_unsupported")]
                return [ok(msg, {"draft": copy.deepcopy(self.drafts.get((sid, msg["door"]))), "active": False, "blocker": "schedule_writes_unverified", "timezone": "Asia/Jerusalem"})]
            if command == "stations/technical_hold_save":
                if msg["door"] not in physical:
                    return [fail(msg, "operation_unsupported")]
                old = self.drafts.get((sid, msg["door"]))
                if msg["revision"] != (old["revision"] if old else 0):
                    return [fail(msg, "revision_conflict")]
                item = {"station_id": sid, "door": msg["door"], "revision": msg["revision"] + 1, "policy": copy.deepcopy(msg["policy"])}
                self.drafts[(sid, msg["door"])] = item
                return [ok(msg, {"draft": copy.deepcopy(item), "active": False, "blocker": "schedule_writes_unverified", "timezone": "Asia/Jerusalem"})]
            if command == "stations/technical_hold_delete":
                old = self.drafts.get((sid, msg["door"]))
                if old is None or old["revision"] != msg["revision"]:
                    return [fail(msg, "revision_conflict")]
                del self.drafts[(sid, msg["door"])]
                return [ok(msg, {"deleted": True})]
            if command == "stations/technical_program_list":
                return [ok(msg, self._listing(sid) | {"saved": [copy.deepcopy(d) for (s, _), d in self.drafts.items() if s == sid], "timezone": "Asia/Jerusalem", "native_supported": False})]
            if command == "stations/technical_program_save":
                old = self.programs.get((sid, msg["door"]))
                if msg["revision"] != (old["revision"] if old else 0):
                    return [fail(msg, "revision_conflict")]
                if old and (old["enabled"] or old["removing"]):
                    return [fail(msg, "hold_pause_before_edit")]
                self.programs[(sid, msg["door"])] = {"station_id": sid, "door": msg["door"], "api_id": 1, "revision": msg["revision"] + 1, "policy": copy.deepcopy(msg["policy"]),
                                                     "enabled": msg["enabled"], "removing": False, "execution": {"owned": False, "attempted": None, "status": "idle"},
                                                     "error": None, "checked_at": None}
                if self.partial:
                    return [fail(msg, "program_saved_draft_cleanup_unknown")]
                self.drafts.pop((sid, msg["door"]), None)
                return [ok(msg, self._listing(sid))]
            if command == "stations/technical_program_action":
                old = self.programs.get((sid, msg["door"]))
                if msg["action"] not in ("pause", "remove"):
                    return [fail(msg, "invalid_fields")]
                if old is None or old["revision"] != msg["revision"]:
                    return [fail(msg, "revision_conflict")]
                old.update(enabled=False, removing=msg["action"] == "remove", revision=old["revision"] + 1)
                if msg["action"] == "remove":
                    del self.programs[(sid, msg["door"])]
                return [ok(msg, self._listing(sid))]
            if command == "stations/technical_codes_get":
                return [ok(msg, self._codes(sid))]
            if command == "stations/technical_codes_write":
                if msg["confirmed"] is not True or msg["action"] not in ("add", "replace", "remove"):
                    return [fail(msg, "invalid_fields")]
                if msg["door"] not in apis:
                    return [fail(msg, "unmanaged_lock")]
                current = self.codes.get((sid, msg["slot"]))
                if (current is not None) is not msg["expected"] or msg["expected"] != (msg["action"] != "add"):
                    return [fail(msg, "revision_conflict")]
                if msg["action"] != "add" and msg["old_pin"] != current:
                    return [fail(msg, "action_failed")]  # the device refused the old code: WisKey's answer does not prove "no effect"
                if msg["action"] == "remove":
                    self.codes.pop((sid, msg["slot"]), None)
                else:
                    self.codes[(sid, msg["slot"])] = msg["new_pin"]
                return [ok(msg, {**self._codes(sid), "acknowledged": True, "physical_verified": False})]
        return super()._answer(command, msg, auth)

    def _listing(self, sid: str) -> dict[str, Any]:
        return {"programs": [copy.deepcopy(p) for (s, _), p in self.programs.items() if s == sid]}

    def _codes(self, sid: str) -> dict[str, Any]:
        states = {f"public{n}Configured": (sid, n) in self.codes for n in range(1, 5)}
        return {"status": {"public_pin_state": "configured" if any(states.values()) else "absent", "states": states, "checked_at": "2026-11-03T08:00:00+00:00"},
                "capabilities": {"advertised": True, "slots": [1, 2, 3, 4], "min": 4, "max": 8, "locks": True}}


def env(ttl: float = 15.0, **fields: Any) -> dict[str, Any]:
    return {"client_request_id": uuid.uuid4().hex, "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=ttl)).strftime("%Y-%m-%dT%H:%M:%SZ"), **fields}


def wait_for(pred: Any, timeout: float = 5.0) -> None:
    end = time.time() + timeout
    while time.time() < end:
        if pred():
            return
        time.sleep(0.02)
    raise AssertionError(f"condition not met; feed state {intercom_sync.STATE.as_dict()}")


@pytest.fixture()
def wx(settings, monkeypatch, station_scope):  # noqa: F811
    """The app with DoorFake as its WisKey and these principals: root (system_admin, installation: system.configure) - mia (site_admin
    on entry-a: no door technical writes) - otto (operator) - tech (a custom role at the installation: access.read + access.stations.read +
    access.stations.manage; access.stations.manage DENIED on entry-c)."""
    import websockets

    fake = DoorFake("admin", token="t")
    monkeypatch.setattr(websockets, "connect", fake.connect)
    monkeypatch.setattr(intercom_sync, "RETRY_S", 0.05)
    monkeypatch.setattr(intercom_sync, "RETRY_MAX_S", 0.2)
    for name in ("USER_BURST", "GLOBAL_BURST"):
        monkeypatch.setattr(intercom_sync, name, 1000.0)
    monkeypatch.setattr(dt, "SCALE", 1.0)
    monkeypatch.setattr(dt, "COOLDOWN_S", 0.0)  # the cool-down's own tests set it back
    dt.reset()
    intercom_sync.SYNC.reset()
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t", ha_core_url="http://ha.local:8123")
    from smplwise.main import create_app

    c = TestClient(create_app(s))
    bind(c, s, "root", "system_admin", "installation", "*")
    bind(c, s, "otto", "operator", "installation", "*")
    c.get("/api/v1/me", headers=as_user("mia"))
    station_scope.bind("dev-mia", "site_admin", "entry-a")
    role = c.post("/api/v1/access/roles", json={"name": "door technician", "description": "T6 test", "permissions": ["access.read", "access.stations.read"],
                                                 "sensitive": [ia.STATIONS_MANAGE]})
    assert role.status_code == 201, role.text
    bind(c, s, "tech", role.json()["id"], "installation", "*")
    deny = c.post("/api/v1/access/roles", json={"name": "no door technical", "description": "T6 test", "permissions": [], "sensitive": [ia.STATIONS_MANAGE]})
    assert deny.status_code == 201, deny.text
    station_scope.bind("dev-tech", deny.json()["id"], "entry-c", effect="deny")
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    yield fake, c, s, station_scope, deny.json()["id"]
    intercom_sync.SYNC.shutdown()
    if intercom_sync.SYNC.thread is not None:
        intercom_sync.SYNC.thread.join(timeout=5)
    intercom_sync.SYNC.reset()
    dt.reset()


def post(c: TestClient, path: str, user: str = "root", **body: Any) -> Any:
    return c.post(f"{API}/{path}", json=env(**{"confirmed": True, **body}), headers=as_user(user))


def code_body(**kw: Any) -> dict[str, Any]:
    return {"action": "set", "door": 1, "expected": False, "new_code": NEW_CODE, "confirm_text": "קוד 2", **kw}


def sent(fake: FakeWiskey, command: str) -> list[dict[str, Any]]:
    return [m for m in fake.received if m.get("type") == PREFIX + command]


def rows(settings: Any, action: str | None = None) -> list[dict[str, Any]]:
    with Database(settings.db_path).connection() as conn:
        sql, args = ("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)) if action else ("SELECT * FROM audit_log ORDER BY id", ())
        out = [dict(r) for r in conn.execute(sql, args).fetchall()]
    for r in out:
        r["details"] = json.loads(r["details_json"]) if r["details_json"] else {}
    return out


def all_audit_text(settings: Any) -> str:
    return json.dumps(rows(settings), ensure_ascii=False, default=str)


# ---------------------------------------------------------------- the channel

def test_the_door_technical_channel_is_exactly_the_five_writes_and_the_relay_read():
    assert wiskey_channels.DOOR_TECHNICAL == dt.COMMANDS | {"overview"}
    assert dt.COMMANDS == {"stations/technical_hold_save", "stations/technical_hold_delete", "stations/technical_codes_write",
                           "stations/technical_program_save", "stations/technical_program_action"}
    assert "door_technical" in wiskey_channels.ADAPTER_CHANNELS and wiskey_channels.HA_FRAMES["door_technical"] == frozenset()
    for channel in wiskey_channels.ALLOWLISTS:
        for command in dt.COMMANDS:
            assert wiskey_channels.allowed(channel, PREFIX + command) == (channel == "door_technical"), (channel, command)
    for other in ("stations/technical_relays", "stations/technical_update", "stations/test_unlock", "users/update", "stations/technical_codes_get"):
        assert not wiskey_channels.allowed("door_technical", PREFIX + other), other


# ---------------------------------------------------------------- hold-open schedules

def test_hold_schedule_add_edit_delete_each_one_frame_with_the_catalog_keys(wx):
    fake, c, s, *_ = wx
    r = post(c, "entry-a/doors/1/hold", revision=0, policy=POLICY)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "acknowledged" and body["kind"] == "hold_save" and body["command_id"]
    assert body["data"]["draft"]["revision"] == 1 and body["data"]["active"] is False and body["data"]["blocker"] == "schedule_writes_unverified"
    frame = sent(fake, "stations/technical_hold_save")[0]
    assert set(frame) == {"id", "type", "station_id", "api_contract", "door", "revision", "policy"} and frame["api_contract"] == 1
    assert frame["policy"]["timezone"] == "Asia/Jerusalem" and set(frame["policy"]["schedule"]) == {"name", "weekly", "holidays"}
    assert set(frame["policy"]["schedule"]["weekly"]) == set(dt.WEEKDAYS)
    # the existing read shows it
    read = c.get(f"{API}/entry-a/doors/1/hold", headers=as_user("root")).json()
    assert read["hold"]["draft"]["revision"] == 1 and read["hold"]["draft"]["policy"]["name"] == "Lobby hours"
    edited = post(c, "entry-a/doors/1/hold", revision=1, policy={**POLICY, "name": "Evening"})
    assert edited.status_code == 200 and edited.json()["data"]["draft"]["revision"] == 2
    gone = post(c, "entry-a/doors/1/hold/delete", revision=2)
    assert gone.status_code == 200 and gone.json()["data"] == {"deleted": True}
    trail = rows(s, "intercom.door_hold_save")
    assert [r["details"]["phase"] for r in trail] == ["attempt", "outcome", "attempt", "outcome"]
    assert trail[1]["details"]["outcome"] == "ok" and trail[1]["actor_user_id"] == "dev-root" and trail[1]["details"]["door"] == 1
    assert "Lobby hours" not in json.dumps(trail, ensure_ascii=False), "the schedule body is not copied into the audit"


def test_a_stale_revision_is_wiskeys_refusal_with_its_reason_and_never_retried(wx):
    fake, c, s, *_ = wx
    assert post(c, "entry-a/doors/1/hold", revision=0, policy=POLICY).status_code == 200
    r = post(c, "entry-a/doors/1/hold", revision=0, policy=POLICY)
    assert r.status_code == 409 and r.json()["code"] == "door_tech_refused"
    d = r.json()["details"]
    assert d["outcome"] == "refused" and d["wiskey_code"] == "revision_conflict" and "WisKey סירב" in r.json()["user_message"]
    assert len(sent(fake, "stations/technical_hold_save")) == 2
    assert rows(s, "intercom.door_hold_save")[-1]["reason"] == "revision_conflict"


@pytest.mark.parametrize("bad,field", [
    ({**POLICY, "weekly": {**WEEK, "Monday": [{"start": "07:00", "end": "12:00"}, {"start": "11:00", "end": "13:00"}]}}, "policy.weekly.Monday"),
    ({**POLICY, "weekly": {"Monday": []}}, "policy.weekly"),
    ({**POLICY, "timezone": "Mars/Olympus"}, "policy.timezone"),
    ({**POLICY, "name": ""}, "policy.name"),
    ({**POLICY, "holidays": [{"name": "x", "start": "2026-12-26", "end": "2026-12-25", "periods": []}]}, "policy.holidays.0"),
    ({"timezone": "UTC"}, "policy"),
])
def test_a_malformed_schedule_is_refused_before_sending(wx, bad, field):
    fake, c, s, *_ = wx
    r = post(c, "entry-a/doors/1/hold", revision=0, policy=bad)
    assert r.status_code == 422 and r.json()["code"] == "door_tech_invalid" and r.json()["details"]["fields"] == [field]
    assert r.json()["details"]["outcome"] == "not_sent" and not sent(fake, "stations/technical_hold_save")


def test_a_relay_the_station_does_not_have_is_refused(wx):
    fake, c, _s, *_ = wx
    r = post(c, "entry-a/doors/2/hold", revision=0, policy=POLICY)
    assert r.status_code == 422 and r.json()["code"] == "intercom_lock_unknown"
    bad = post(c, "entry-a/doors/9/hold", revision=0, policy=POLICY)
    assert bad.status_code == 422 and bad.json()["details"]["fields"] == ["door"]
    assert not sent(fake, "stations/technical_hold_save")


# ---------------------------------------------------------------- programs

def test_apply_pause_and_remove_a_program(wx):
    fake, c, s, *_ = wx
    r = post(c, "entry-a/doors/1/program", revision=0, policy=POLICY, enabled=True)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "acknowledged" and r.json()["partial"] is None
    prog = r.json()["data"]["programs"][0]
    assert prog["door"] == 1 and prog["enabled"] is True and prog["revision"] == 1
    frame = sent(fake, "stations/technical_program_save")[0]
    assert set(frame) == {"id", "type", "station_id", "api_contract", "door", "revision", "policy", "enabled"} and frame["enabled"] is True
    busy_edit = post(c, "entry-a/doors/1/program", revision=1, policy=POLICY, enabled=True)
    assert busy_edit.status_code == 409 and busy_edit.json()["details"]["wiskey_code"] == "hold_pause_before_edit"
    paused = post(c, "entry-a/doors/1/program/pause", revision=1)
    assert paused.status_code == 200 and paused.json()["data"]["programs"][0]["enabled"] is False
    assert set(sent(fake, "stations/technical_program_action")[0]) == {"id", "type", "station_id", "api_contract", "door", "revision", "action"}
    removed = post(c, "entry-a/doors/1/program/remove", revision=2)
    assert removed.status_code == 200 and removed.json()["data"]["programs"] == []
    assert post(c, "entry-a/doors/1/program/resume", revision=3).status_code == 404, "resume is a save with enabled, not a WisKey action"
    outcome = [r for r in rows(s, "intercom.door_program_action") if r["details"].get("phase") == "outcome"][-1]
    assert outcome["details"]["program_action"] == "remove" and outcome["details"]["result"]["present"] is False


def test_a_partial_failure_is_reported_as_partial_not_as_done_or_failed(wx):
    fake, c, s, *_ = wx
    fake.partial = True
    r = post(c, "entry-a/doors/1/program", revision=0, policy=POLICY, enabled=False)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "partial" and r.json()["partial"] == "program_saved_draft_cleanup_unknown" and r.json()["data"]["programs"] is None
    last = rows(s, "intercom.door_program_save")[-1]
    assert last["details"]["outcome"] == "partial" and last["reason"] == "program_saved_draft_cleanup_unknown"
    view = c.get(f"{API}/entry-a/door-tech", headers=as_user("root")).json()
    assert view["history"][0]["status"] == "partial" and view["history"][0]["kind"] == "program_save"


def test_enabling_needs_an_online_station(wx):
    fake, c, _s, *_ = wx
    on = post(c, "entry-b/doors/1/program", revision=0, policy=POLICY, enabled=True)  # entry-b is offline in the recorded overview
    assert on.status_code == 409 and on.json()["code"] == "intercom_station_offline" and on.json()["details"]["outcome"] == "not_sent"
    assert not sent(fake, "stations/technical_program_save")


# ---------------------------------------------------------------- public codes

def test_set_a_code_sends_the_api_relay_and_never_echoes_the_value(wx, caplog):
    fake, c, s, *_ = wx
    caplog.set_level(logging.DEBUG)
    r = post(c, "entry-c/codes/2", **code_body(door=2))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "acknowledged" and body["data"] == {"slot": 2, "configured": True, "acknowledged": True, "physical_verified": False,
                                                                 "checked_at": "2026-11-03T08:00:00+00:00"}
    frame = sent(fake, "stations/technical_codes_write")[0]
    assert set(frame) == {"id", "type", "station_id", "api_contract", "slot", "action", "door", "expected", "old_pin", "new_pin", "compatibility", "confirmed"}
    assert frame["door"] == 7, "entry-c relay 2 is WisKey's API relay 7"
    assert frame["action"] == "add" and frame["new_pin"] == NEW_CODE and frame["old_pin"] == "" and frame["confirmed"] is True
    ov = [m for m in fake.received if m.get("type") == PREFIX + "overview"]
    assert ov, "the relay map is read right before the write"
    # the read shows presence only
    codes = c.get(f"{API}/entry-c/codes", headers=as_user("root")).json()
    assert {"slot": 2, "configured": True} in codes["codes"]["slots"]
    view = c.get(f"{API}/entry-c/door-tech", headers=as_user("root")).json()
    for text in (r.text, json.dumps(codes), json.dumps(view), all_audit_text(s), caplog.text):
        assert NEW_CODE not in text and CUR_CODE not in text
    outcome = rows(s, "intercom.door_code_write")[-1]["details"]
    assert outcome["code_action"] == "set" and outcome["wiskey_action"] == "add" and outcome["slot"] == 2 and outcome["result"] == {"configured": True, "acknowledged": True}
    assert not any(k in json.dumps(outcome) for k in ("new_code", "current_code", "old_pin", "new_pin"))


def test_replace_and_clear_need_the_current_code_and_wrong_current_is_unknown_not_refused(wx, caplog, monkeypatch):
    fake, c, s, *_ = wx
    monkeypatch.setattr(dt, "COOLDOWN_S", 0.0)
    caplog.set_level(logging.DEBUG)
    fake.codes[("entry-a", 2)] = CUR_CODE
    missing = post(c, "entry-a/codes/2", **code_body(expected=True))
    assert missing.status_code == 422 and missing.json()["details"]["fields"] == ["current_code"]
    replaced = post(c, "entry-a/codes/2", **code_body(expected=True, current_code=CUR_CODE))
    assert replaced.status_code == 200 and sent(fake, "stations/technical_codes_write")[-1]["action"] == "replace"
    assert fake.codes[("entry-a", 2)] == NEW_CODE
    wrong = post(c, "entry-a/codes/2", **code_body(action="clear", expected=True, new_code=None, current_code=CUR_CODE))
    assert wrong.status_code == 504 and wrong.json()["code"] == "door_tech_outcome_unknown" and wrong.json()["details"]["outcome"] == "unknown"
    cleared = post(c, "entry-a/codes/2", **code_body(action="clear", expected=True, new_code=None, current_code=NEW_CODE))
    assert cleared.status_code == 200 and cleared.json()["data"]["configured"] is False
    assert sent(fake, "stations/technical_codes_write")[-1]["action"] == "remove" and sent(fake, "stations/technical_codes_write")[-1]["new_pin"] == ""
    not_set = post(c, "entry-a/codes/3", **code_body(action="clear", expected=False, new_code=None, confirm_text="קוד 3"))
    assert not_set.status_code == 409 and not_set.json()["code"] == "door_tech_code_not_set"
    for resp in (missing, replaced, wrong, cleared, not_set):
        assert NEW_CODE not in resp.text and CUR_CODE not in resp.text
    assert NEW_CODE not in all_audit_text(s) and CUR_CODE not in all_audit_text(s) and NEW_CODE not in caplog.text and CUR_CODE not in caplog.text


def test_a_code_needs_the_typed_confirmation_and_valid_digits(wx):
    fake, c, s, *_ = wx
    for text in (None, "", "קוד 3", "code 2", "אישור"):
        r = post(c, "entry-a/codes/2", **code_body(confirm_text=text))
        assert r.status_code == 409 and r.json()["code"] == "typed_confirmation_required", text
    for bad in ("12", "12345678901234567", "12a4", "١٢٣٤"):
        r = post(c, "entry-a/codes/2", **code_body(new_code=bad))
        assert r.status_code == 422 and r.json()["details"]["fields"] == ["new_code"], bad
        assert bad not in r.text
    assert not sent(fake, "stations/technical_codes_write") and bad not in all_audit_text(s)


def test_a_relay_wiskey_does_not_map_is_not_sent(wx):
    fake, c, _s, *_ = wx
    fake.overview["stations"][2]["integrated_locks"][1]["api_id"] = 99  # not a relay id WisKey can have: Arx keeps no mapping for it
    r = post(c, "entry-c/codes/2", **code_body(door=2))
    assert r.status_code == 409 and r.json()["code"] == "door_tech_not_sent" and r.json()["details"]["outcome"] == "not_sent"
    assert r.json()["details"]["wiskey_code"] == "unmanaged_lock" and not sent(fake, "stations/technical_codes_write")


def test_an_offline_station_gets_no_code_write(wx):
    fake, c, _s, *_ = wx
    r = post(c, "entry-b/codes/1", **code_body(confirm_text="קוד 1"))
    assert r.status_code in (409, 422) and r.json()["details"]["outcome"] == "not_sent"
    assert not sent(fake, "stations/technical_codes_write")


# ---------------------------------------------------------------- the gates

def test_without_the_door_admin_permission_the_gate_refuses_before_the_body(wx):
    fake, c, s, *_ = wx
    for user in ("otto", "mia"):
        r = c.post(f"{API}/entry-a/doors/1/hold", content=b"not json", headers={**as_user(user), "content-type": "text/plain"})
        assert r.status_code == 403, (user, r.text)
        assert c.get(f"{API}/entry-a/door-tech", headers=as_user(user)).status_code == 403
    assert not any(sent(fake, cmd) for cmd in dt.COMMANDS)
    denied = [r for r in rows(s, ia.STATIONS_MANAGE) if r["decision"] == "denied"]
    assert len(denied) == 4


def test_a_station_deny_wins_even_over_system_configure_and_an_unseen_station_is_not_found(wx):
    fake, c, s, scope, deny_role = wx
    assert post(c, "entry-a/doors/1/hold", "tech", revision=0, policy=POLICY).status_code == 200
    r = post(c, "entry-c/doors/1/hold", "tech", revision=0, policy=POLICY)
    assert r.status_code == 403 and r.json()["details"]["outcome"] == "not_sent" and r.json()["details"]["reason"] == "explicit_deny"
    scope.bind("dev-root", deny_role, "entry-c", effect="deny")
    r2 = post(c, "entry-c/doors/1/hold", "root", revision=0, policy=POLICY)
    assert r2.status_code == 403 and r2.json()["details"]["reason"] == "explicit_deny"
    view = c.get(f"{API}/entry-c/door-tech", headers=as_user("root")).json()
    assert view["allowed"] is False and view["reason"] == "explicit_deny" and view["history"] == []
    unknown = post(c, "no-such-station/doors/1/hold", revision=0, policy=POLICY)
    assert unknown.status_code == 404 and unknown.json()["code"] == "intercom_station_not_found"
    assert [m["station_id"] for m in sent(fake, "stations/technical_hold_save")] == ["entry-a"]


def test_no_confirmation_expired_or_duplicate_is_refused_and_nothing_sent(wx):
    fake, c, _s, *_ = wx
    no = c.post(f"{API}/entry-a/doors/1/hold", json=env(revision=0, policy=POLICY), headers=as_user("root"))
    assert no.status_code == 409 and no.json()["code"] == "confirmation_required"
    stale = c.post(f"{API}/entry-a/doors/1/hold", json=env(ttl=-5, revision=0, policy=POLICY, confirmed=True), headers=as_user("root"))
    assert stale.status_code == 409 and stale.json()["code"] == "expired"
    once = env(revision=0, policy=POLICY, confirmed=True)
    assert c.post(f"{API}/entry-a/doors/1/hold", json=once, headers=as_user("root")).status_code == 200
    again = c.post(f"{API}/entry-a/doors/1/hold", json=once, headers=as_user("root"))
    assert again.status_code == 409 and again.json()["code"] == "intercom_duplicate_command"
    extra = post(c, "entry-a/doors/1/hold", revision=1, policy=POLICY, door=1)
    assert extra.status_code == 422, "unknown body keys are refused"
    assert len(sent(fake, "stations/technical_hold_save")) == 1


# ---------------------------------------------------------------- WisKey's side

def test_wiskey_refusing_arx_is_shown_as_wiskey_refused_with_the_reason(wx):
    fake, c, _s, *_ = wx
    fake.set_forbidden(["stations/technical_hold_save"])
    r = post(c, "entry-a/doors/1/hold", revision=0, policy=POLICY)
    assert r.status_code == 409 and r.json()["details"]["outcome"] == "refused" and r.json()["details"]["wiskey_code"] == "unauthorized"
    assert r.json()["user_message"].startswith("WisKey סירב:")
    fake.set_forbidden(False)
    fake.fail_with["stations/technical_hold_delete"] = "reauth_required"
    fake.drafts[("entry-a", 1)] = {"station_id": "entry-a", "door": 1, "revision": 1, "policy": dt.policy(POLICY)}
    r2 = post(c, "entry-a/doors/1/hold/delete", revision=1)
    assert r2.status_code == 409 and r2.json()["details"]["wiskey_code"] == "reauth_required"


def test_an_unknown_wiskey_code_or_station_unloaded_is_unknown_not_refused(wx):
    fake, c, _s, *_ = wx
    fake.fail_with["stations/technical_program_action"] = "station_unloaded"
    r = post(c, "entry-a/doors/1/program/pause", revision=1)
    assert r.status_code == 504 and r.json()["details"]["outcome"] == "unknown"


def test_no_answer_in_time_is_unknown(wx, monkeypatch):
    fake, c, _s, *_ = wx
    monkeypatch.setattr(intercom_sync, "ACTION_TIMEOUT_S", 0.3)
    fake.slow, fake.slow_commands = 1.0, {"stations/technical_hold_save"}
    r = post(c, "entry-a/doors/1/hold", revision=0, policy=POLICY)
    assert r.status_code == 504 and r.json()["code"] == "door_tech_outcome_unknown" and r.json()["details"]["outcome"] == "unknown"


def test_a_wiskey_without_the_command_gets_nothing(wx, monkeypatch):
    fake, c, _s, *_ = wx
    facts = intercom_sync.SYNC.api_facts
    monkeypatch.setattr(intercom_sync.SYNC, "api_facts", lambda settings: {**facts(settings), "commands": [x for x in facts(settings)["commands"] if x != "stations/technical_codes_write"]})
    r = post(c, "entry-a/codes/2", **code_body())
    assert r.status_code == 409 and r.json()["code"] == "door_tech_unsupported" and r.json()["details"]["wiskey_code"] == "not_listed"
    view = c.get(f"{API}/entry-a/door-tech", headers=as_user("root")).json()
    assert view["commands"]["code_write"] == {"available": False, "reason": "not_listed"} and view["commands"]["hold_save"]["available"] is True
    assert not sent(fake, "stations/technical_codes_write")


# ---------------------------------------------------------------- Arx's limits

def test_the_cooldown_after_a_send_and_not_after_a_refusal(wx, monkeypatch):
    fake, c, _s, *_ = wx
    monkeypatch.setattr(dt, "COOLDOWN_S", 3.0)
    assert post(c, "entry-a/doors/1/hold", revision=0, policy=POLICY).status_code == 200
    again = post(c, "entry-a/doors/1/hold", revision=1, policy=POLICY)
    assert again.status_code == 429 and again.json()["code"] == "door_tech_cooldown" and again.json()["details"]["outcome"] == "not_sent"
    assert post(c, "entry-c/doors/1/hold", revision=0, policy=POLICY).status_code == 200, "another station is not cooled down"
    bad = post(c, "entry-c/doors/2/hold", revision=0, policy={**POLICY, "name": ""})
    assert bad.status_code == 422
    assert post(c, "entry-c/doors/2/hold", revision=0, policy=POLICY).status_code == 200, "a refusal before sending starts no cool-down"


def test_the_code_window_and_the_station_slot(wx, monkeypatch):
    fake, c, _s, *_ = wx
    monkeypatch.setattr(dt, "CODE_USER_MAX", 1)
    assert post(c, "entry-a/codes/2", **code_body()).status_code == 200
    r = post(c, "entry-a/codes/3", **code_body(confirm_text="קוד 3"))
    assert r.status_code == 429 and r.json()["code"] == "door_tech_code_rate_limited"
    dt.LIMITS.reset()
    dt.LIMITS._inflight.add("entry-a")
    busy = post(c, "entry-a/doors/1/hold", revision=0, policy=POLICY)
    assert busy.status_code == 429 and busy.json()["code"] == "door_tech_busy"
    assert "entry-a" in dt.LIMITS._inflight, "a refused request never frees another request's slot"
    dt.LIMITS.reset()
    assert len(sent(fake, "stations/technical_codes_write")) == 1


# ---------------------------------------------------------------- the read

def test_the_view_says_who_may_write_what_this_wiskey_offers_and_the_recent_writes(wx, monkeypatch):
    fake, c, _s, *_ = wx
    monkeypatch.setattr(dt, "COOLDOWN_S", 3.0)
    v = c.get(f"{API}/entry-c/door-tech", headers=as_user("root")).json()
    assert v["allowed"] is True and v["reason"] == "system.configure" and v["online"] is True
    assert v["locks"] == [{"door": 1, "name": "Gate"}, {"door": 2, "name": "Barrier"}]
    assert all(x == {"available": True, "reason": None} for x in v["commands"].values())
    assert v["confirm_phrase"] == "קוד {slot}" and "api_id" not in json.dumps(v)
    tech = c.get(f"{API}/entry-a/door-tech", headers=as_user("tech")).json()
    assert tech["allowed"] is True and tech["reason"] == ia.STATIONS_MANAGE
    post(c, "entry-a/doors/1/hold", "tech", revision=0, policy=POLICY)
    post(c, "entry-a/doors/1/hold", "tech", revision=5, policy=POLICY)  # cooled down: not_sent
    hist = c.get(f"{API}/entry-a/door-tech", headers=as_user("root")).json()["history"]
    assert [(h["kind"], h["status"]) for h in hist[:2]] == [("hold_save", "not_sent"), ("hold_save", "acknowledged")]
    assert hist[0]["code"] == "door_tech_cooldown" and hist[1]["door"] == 1


# ---------------------------------------------------------------- pure parts

def test_result_of_reads_wiskey_answers_honestly():
    kind = dt.KINDS["hold_save"]
    assert dt.result_of({"success": True, "result": {"x": 1}}, kind) == {"x": 1}
    for code in ("revision_conflict", "unauthorized", "device_busy", "schedule_overlap", "reauth_required"):
        with pytest.raises(intercom_client.IntercomError):
            dt.result_of({"success": False, "error": {"code": code}}, kind)
    for code in ("station_unloaded", "storage_write_failed", "", "weird code with spaces"):
        with pytest.raises(intercom_client.UnclearAnswer):
            dt.result_of({"success": False, "error": {"code": code}}, kind)
    with pytest.raises(intercom_client.UnclearAnswer):
        dt.result_of({"success": "yes"}, kind)
    assert dt.result_of({"success": False, "error": {"code": "program_saved_draft_cleanup_unknown"}}, dt.KINDS["program_save"]) == {"partial": "program_saved_draft_cleanup_unknown"}
    with pytest.raises(intercom_client.UnclearAnswer):
        dt.result_of({"success": False, "error": {"code": "ambiguous_write"}}, dt.KINDS["code_write"])
    with pytest.raises(intercom_client.UnclearAnswer):
        dt.result_of({"success": False, "error": {"code": "readback_mismatch"}}, dt.KINDS["code_write"])


def test_the_policy_is_wiskeys_shape_and_the_code_rules():
    p = dt.policy(POLICY)
    assert set(p) == {"timezone", "schedule"} and p["schedule"]["weekly"]["Sunday"] == [{"start": "07:00", "end": "19:00"}]
    assert dt.policy({**POLICY, "weekly": {**WEEK, "Friday": [{"start": "20:00", "end": "24:00"}, {"start": "06:00", "end": "08:00"}]}})["schedule"]["weekly"]["Friday"][0]["start"] == "06:00"
    with pytest.raises(ApiError):
        dt.policy({**POLICY, "weekly": {**WEEK, "Monday": [{"start": "24:00", "end": "24:00"}]}})
    assert dt.wiskey_code_action("set", False) == "add" and dt.wiskey_code_action("set", True) == "replace" and dt.wiskey_code_action("clear", True) == "remove"
    assert dt.confirm_phrase(3) == "קוד 3"
    with pytest.raises(ApiError) as exc:
        dt.code_value("12x45", "new_code")
    assert "12x45" not in json.dumps(exc.value.details) and "12x45" not in exc.value.user_message


def test_project_relays_and_codes_keep_no_value():
    relays = dt.project_relays("entry-c")({"stations": [{"id": "entry-c", "host": "192.0.2.9", "integrated_locks": [{"physical_index": 1, "api_id": 1}, {"physical_index": 2, "api_id": 7}]}]})
    assert relays == {"found": True, "relays": {1: 1, 2: 7}}
    out = dt.project_code_write(2)({"status": {"states": {"public2Configured": True}, "new_pin": "999999"}, "capabilities": {"slots": [2]}, "acknowledged": True,
                                    "old_pin": "111111"})
    assert out["configured"] is True and "999999" not in json.dumps(out) and "111111" not in json.dumps(out)
