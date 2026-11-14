"""WISKEY-CONFLICTS-2400 (plan 2026-11-03 T5): resolve WisKey's sync conflicts and snooze / restore its fleet alerts from Arx, end to end over
the add-on's live service session against the fake WisKey (tests/fake_wiskey.py, answered here for the four triage commands with rc.10's
semantics: the review's token is a fingerprint of the device record, the resolve re-checks it and WisKey's record revision, the alert
action is a compare-and-set on WisKey's suppression revision). Nothing contacts a device, a station, Home Assistant or WisKey.

What is proven:
- the channel: exactly the four commands on the closed `triage` guard, no other guard carries them, and the frames carry the pinned
  catalog's keys (`api_contract` on every one);
- the manage rule: `access.stations.manage` unrestricted or `system.configure` at the installation, checked before the body (audited
  403): a station-scoped manager, a manager with a deny on one station and an operator are refused, nothing sent;
- preview -> confirm -> apply: the review is WisKey's (a read; the token never reaches the browser), single use, bound to the operator,
  expires; the resolution needs the confirmation and a direction WisKey allowed, and sends the stored token and revision once;
- honest outcomes: acknowledged (WisKey accepted and queued the sync), WisKey's stale / revision refusal as `triage_stale`, another
  refusal with WisKey's code, an unclear answer as unknown, a feed that is down as not sent;
- the alert actions: snooze with a closed duration and reason, restore, the fresh read's revision, `revision_conflict`, an alert that is
  no longer active / not snoozed is refused before sending;
- Arx's limits (cool-down after a send, per-operator window, in-flight cap) and the audit rows (attempt + outcome, actor, station,
  WisKey person id - never a name);
- the notification feed: off by default and silent while off; on, one notification per active alert, none for a snoozed one, resolved
  when the alert goes; the setting is system.configure only and audited; the source is listed only while it is on."""
from __future__ import annotations

import copy
import json
import time
import uuid
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from conftest import as_user, bind
from fake_wiskey import PREFIX, FakeWiskey, fail, fixture, ok
from fastapi.testclient import TestClient
from intercom_station_scope import station_scope  # noqa: F401 - a fixture

from smplwise.db import Database
from smplwise.services import intercom_authority as ia
from smplwise.services import intercom_sync, wiskey_channels
from smplwise.services import wiskey_triage as tr

API = "/api/v1/access-control"


class TriageFake(FakeWiskey):
    """The fake WisKey with rc.10's triage semantics. `device_version` stands for the device record: the review's token is derived from
    it, so bumping it makes an earlier review stale (`review_stale`). `user_revision` is WisKey's record revision of the person.
    `alert_revision` is WisKey's suppression revision (fleet/alerts answers it; fleet/alerts_action compares it)."""

    def __init__(self, *a: Any, **kw: Any) -> None:
        super().__init__(*a, **kw)
        self.device_version = 1
        self.user_revision = 3
        self.alert_revision = 4
        self.fail_with: dict[str, str] = {}
        self.allowed = {"central": True, "device": True, "delete": False}
        self.alert_items: list[dict[str, Any]] | None = None

    def fp(self, station: str, user: str) -> str:
        return f"fp-{station}-{user}-{self.device_version}"

    def review(self, station: str, user: str) -> dict[str, Any]:
        tomb = user == "u8"
        device = {"present": True, "display_name": "Dana (device)", "user_type": "normal",
                  "validity": {"timed": True, "from": "2026-01-01T00:00:00", "until": "2027-01-01T00:00:00", "time_type": "local"},
                  "door_rights": [1], "pin_configured": True, "cards": [{"id": "", "card_no": "****4321", "card_type": "normalCard"}],
                  "schedule_configured": False, "privileged": False, "other_credentials": False}
        central = None if tomb else {**copy.deepcopy(device), "display_name": "Dana", "door_rights": [1, 2], "cards": []}
        return {
            "user_id": user, "employee_no": "1001", "station_id": station, "review_token": self.fp(station, user),
            "revision": None if tomb else self.user_revision, "reviewed_at": "2026-11-04T08:00:00+00:00", "absent": False,
            "display_name": "Dana (device)", "pin_configured": True, "cards": device["cards"], "deletion_pending": tomb,
            "central": central, "device": device, "active": not tomb, "unverified_fields": [], "affected_stations": ["entry-a", "entry-b"],
            "actions": {k: {"allowed": (v if not tomb else k == "delete"), "reason": None if (v if not tomb else k == "delete") else "deletion_not_pending"}
                        for k, v in self.allowed.items()},
            "differences": ["door_rights", "cards", "pin"], "plan": {"person": "update", "pin": "remove", "cards_add": 0, "cards_remove": 1, "cards_update": 0},
        }

    def _answer(self, command: str, msg: dict[str, Any], auth: dict[str, Any]) -> list[Any]:
        if command in tr.COMMANDS or (command == "fleet/alerts" and self.alert_items is not None):
            if command in self.fail_with:
                return [fail(msg, self.fail_with[command])]
            if command == "fleet/alerts":
                body = fixture("fleet_alerts.json")
                body["items"], body["revision"], body["total"] = copy.deepcopy(self.alert_items), self.alert_revision, len(self.alert_items or [])
                return [ok(msg, body)]
            sid = msg.get("station_id")
            if not any(s["id"] == sid for s in self.overview["stations"]):
                return [fail(msg, "station_not_found")]
            if command == "conflicts/review":
                if msg["user_id"] not in ("u1", "u8"):
                    return [fail(msg, "user_not_found")]
                return [ok(msg, self.review(sid, msg["user_id"]))]
            if command == "conflicts/resolve":
                if msg["direction"] not in ("central", "device"):
                    return [fail(msg, "invalid_resolution")]
                if msg["revision"] != self.user_revision:
                    return [fail(msg, "revision_conflict")]
                if msg["review_token"] != self.fp(sid, msg["user_id"]):
                    return [fail(msg, "review_stale")]
                self.user_revision += 1
                person = fixture("users_get.json")
                person.update(revision=self.user_revision)
                person["assignments"] = {sid: {**person["assignments"].get(sid, {}), "sync_state": "pending"}}
                return [ok(msg, person)]
            if command == "conflicts/resolve_deletion":
                if msg["user_id"] != "u8":
                    return [fail(msg, "deletion_not_pending")]
                if msg["review_token"] != self.fp(sid, msg["user_id"]):
                    return [fail(msg, "review_stale")]
                return [ok(msg, {"accepted": True})]
            if command == "fleet/alerts_action":
                if msg["revision"] != self.alert_revision:
                    return [fail(msg, "revision_conflict")]
                if msg["action"] not in ("suppress", "restore") or (msg["action"] == "suppress" and msg["duration_minutes"] not in tr.DURATIONS):
                    return [fail(msg, "invalid_fields")]
                self.alert_revision += 1
                return [ok(msg, {"revision": self.alert_revision})]
        return super()._answer(command, msg, auth)


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
    """The app with TriageFake as its WisKey and: root (system_admin: system.configure at the installation) - mgr (a custom role at the
    installation: access.read + access.admin.read + access.stations.manage) - local (access.read + access.admin.read at the installation,
    access.stations.manage only on entry-a) - denied (mgr's role at the installation, access.stations.manage DENIED on entry-c) -
    otto (operator)."""
    import websockets

    fake = TriageFake("admin", token="t")
    monkeypatch.setattr(websockets, "connect", fake.connect)
    monkeypatch.setattr(intercom_sync, "RETRY_S", 0.05)
    monkeypatch.setattr(intercom_sync, "RETRY_MAX_S", 0.2)
    for name in ("USER_BURST", "GLOBAL_BURST"):
        monkeypatch.setattr(intercom_sync, name, 1000.0)
    monkeypatch.setattr(tr, "COOLDOWN_SCALE", 0.0)
    tr.reset()
    intercom_sync.SYNC.reset()
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t", ha_core_url="http://ha.local:8123")
    from smplwise.main import create_app

    c = TestClient(create_app(s))
    bind(c, s, "root", "system_admin", "installation", "*")
    bind(c, s, "otto", "operator", "installation", "*")
    role = c.post(f"/api/v1/access/roles", json={"name": "triage manager", "description": "T5 test", "permissions": ["access.read", "access.admin.read", "access.stations.read"],
                                                  "sensitive": [ia.STATIONS_MANAGE]})
    assert role.status_code == 201, role.text
    bind(c, s, "mgr", role.json()["id"], "installation", "*")
    bind(c, s, "denied", role.json()["id"], "installation", "*")
    viewer = c.post(f"/api/v1/access/roles", json={"name": "status viewer", "description": "T5 test", "permissions": ["access.read", "access.admin.read"], "sensitive": []})
    assert viewer.status_code == 201, viewer.text
    bind(c, s, "local", viewer.json()["id"], "installation", "*")
    manage = c.post(f"/api/v1/access/roles", json={"name": "station manage only", "description": "T5 test", "permissions": [], "sensitive": [ia.STATIONS_MANAGE]})
    assert manage.status_code == 201, manage.text
    station_scope.bind("dev-local", manage.json()["id"], "entry-a")
    station_scope.bind("dev-denied", manage.json()["id"], "entry-c", effect="deny")
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    yield fake, c, s
    intercom_sync.SYNC.shutdown()
    if intercom_sync.SYNC.thread is not None:
        intercom_sync.SYNC.thread.join(timeout=5)
    intercom_sync.SYNC.reset()
    tr.reset()


def sent(fake: FakeWiskey, command: str) -> list[dict[str, Any]]:
    return [m for m in fake.received if m.get("type") == PREFIX + command]


def rows(settings: Any, *actions: str) -> list[dict[str, Any]]:
    marks = ",".join("?" for _ in actions)
    with Database(settings.db_path).connection() as conn:
        out = [dict(r) for r in conn.execute(f"SELECT * FROM audit_log WHERE action IN ({marks}) ORDER BY id", actions).fetchall()]
    for r in out:
        r["details"] = json.loads(r["details_json"]) if r["details_json"] else {}
    return out


def review(c: TestClient, station: str = "entry-a", person: str = "u1", kind: str = "person", user: str = "root") -> Any:
    return c.post(f"{API}/stations/{station}/conflicts/{person}/review", json={"kind": kind}, headers=as_user(user))


def resolve(c: TestClient, review_id: str, direction: str = "central", user: str = "root", **body: Any) -> Any:
    return c.post(f"{API}/triage/reviews/{review_id}/resolve", json=env(**{"direction": direction, "confirmed": True, **body}), headers=as_user(user))


def alert(c: TestClient, station: str, kind: str, action: str, user: str = "root", **body: Any) -> Any:
    payload = {"confirmed": True, **({"duration_minutes": 60, "reason": "investigating"} if action == "snooze" else {}), **body}
    return c.post(f"{API}/stations/{station}/alerts/{kind}/{action}", json=env(**payload), headers=as_user(user))


# ---------------------------------------------------------------- the channel

def test_the_triage_channel_is_exactly_the_four_commands_and_nothing_else_carries_them():
    assert wiskey_channels.TRIAGE == tr.COMMANDS == {"conflicts/review", "conflicts/resolve", "conflicts/resolve_deletion", "fleet/alerts_action"}
    assert "triage" in wiskey_channels.ADAPTER_CHANNELS and wiskey_channels.HA_FRAMES["triage"] == frozenset()
    for channel in wiskey_channels.ALLOWLISTS:
        for command in tr.COMMANDS:
            assert wiskey_channels.allowed(channel, PREFIX + command) == (channel == "triage"), (channel, command)
    for other in ("conflicts/list", "fleet/alerts", "users/delete", "users/update", "stations/test_unlock", "sync/all", "users/delete_unmanaged"):
        assert not wiskey_channels.allowed("triage", PREFIX + other), other
    assert not (wiskey_channels.TRIAGE & wiskey_channels.SERVICE_WRITES)


def test_the_four_commands_are_in_both_pinned_catalogs_with_the_keys_arx_sends():
    from pathlib import Path

    root = Path(__file__).resolve().parents[3] / "docs" / "integrations" / "wiskey" / "catalog"
    sent_keys = {"conflicts/review": {"station_id", "user_id"}, "conflicts/resolve": {"station_id", "user_id", "review_token", "revision", "direction"},
                 "conflicts/resolve_deletion": {"station_id", "user_id", "review_token"},
                 "fleet/alerts_action": {"revision", "station_id", "kind", "action", "duration_minutes", "reason"}}
    for pin in ("rc37-contract.4", "rc10-extract"):
        commands = json.loads((root / pin / "commands.static.json").read_text(encoding="utf-8"))["commands"]
        for name, keys in sent_keys.items():
            spec = commands[name]
            assert set(spec["request"]["required"]) == {"id", "type", *keys}, (pin, name)
            assert "api_contract" in spec["request"]["properties"], (pin, name)
            assert spec["permission"]["read_command_for_security_guard_and_api_contract"] is False, (pin, name)


# ---------------------------------------------------------------- preview -> confirm -> apply

def test_review_is_a_preview_whose_token_stays_on_the_server(wx):
    fake, c, s = wx
    r = review(c)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["review_id"].startswith("rv_") and body["kind"] == "person" and body["station_id"] == "entry-a"
    impact = body["impact"]
    assert impact["differences"] == ["door_rights", "cards", "pin"] and impact["plan"]["cards_remove"] == 1 and impact["plan"]["pin"] == "remove"
    assert impact["device"]["card_count"] == 1 and impact["central"]["card_count"] == 0 and impact["affected_stations"] == ["entry-a", "entry-b"]
    assert impact["actions"]["central"]["allowed"] is True and impact["actions"]["delete"] == {"allowed": False, "reason": "deletion_not_pending"}
    text = json.dumps(body)
    assert "fp-entry-a" not in text and "review_token" not in text and "_token" not in text and "4321" not in text
    frames = sent(fake, "conflicts/review")
    assert len(frames) == 1 and set(frames[0]) == {"id", "type", "station_id", "user_id", "api_contract"} and frames[0]["api_contract"] == 1
    assert not sent(fake, "conflicts/resolve")
    with Database(s.db_path).connection() as conn:
        row = conn.execute("SELECT * FROM wiskey_conflict_reviews WHERE id = ?", (body["review_id"],)).fetchone()
    assert row["review_token"] == "fp-entry-a-u1-1" and row["actor_user_id"] == "dev-root" and row["revision"] == 3 and row["used_at"] is None
    trail = rows(s, tr.AUDIT_REVIEW)
    assert [t["details"]["phase"] for t in trail] == ["attempt", "outcome"] and trail[1]["details"]["person_id"] == "u1"
    assert "Dana" not in json.dumps(trail)


def test_resolve_sends_the_stored_token_once_and_is_acknowledged_not_done(wx):
    fake, c, s = wx
    rid = review(c).json()["review_id"]
    r = resolve(c, rid, "central")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "acknowledged" and body["direction"] == "central" and body["data"]["revision"] == 4
    assert body["data"]["station_states"] == {"entry-a": "pending"} and body["affected_stations"] == ["entry-a", "entry-b"]
    frames = sent(fake, "conflicts/resolve")
    assert len(frames) == 1
    f = frames[0]
    assert set(f) == {"id", "type", "station_id", "user_id", "review_token", "revision", "direction", "api_contract"}
    assert (f["station_id"], f["user_id"], f["review_token"], f["revision"], f["direction"]) == ("entry-a", "u1", "fp-entry-a-u1-1", 3, "central")
    again = resolve(c, rid, "central")
    assert again.status_code == 409 and again.json()["code"] == "review_used" and again.json()["details"]["outcome"] == "not_sent"
    assert len(sent(fake, "conflicts/resolve")) == 1
    with Database(s.db_path).connection() as conn:
        row = conn.execute("SELECT * FROM wiskey_conflict_reviews WHERE id = ?", (rid,)).fetchone()
    assert row["used_direction"] == "central" and row["outcome"] == "ok" and row["review_token"] == ""
    trail = rows(s, tr.AUDIT_RESOLVE)
    assert [(t["details"]["phase"], t["details"].get("outcome")) for t in trail] == [("attempt", None), ("outcome", "ok"), ("refused", "not_sent")]


def test_device_direction_and_continuing_a_deletion(wx):
    fake, c, s = wx
    rid = review(c).json()["review_id"]
    assert resolve(c, rid, "device").json()["data"]["revision"] == 4
    assert sent(fake, "conflicts/resolve")[0]["direction"] == "device"
    tomb = review(c, "entry-c", "u8", "removal")
    assert tomb.status_code == 200, tomb.text
    assert tomb.json()["impact"]["deletion_pending"] is True and tomb.json()["impact"]["actions"]["delete"]["allowed"] is True
    wrong = resolve(c, tomb.json()["review_id"], "central")
    assert wrong.status_code == 422 and wrong.json()["code"] == "resolution_kind_mismatch"
    done = resolve(c, tomb.json()["review_id"], "delete")
    assert done.status_code == 200, done.text
    assert done.json()["status"] == "acknowledged" and done.json()["data"] == {"accepted": True}
    frames = sent(fake, "conflicts/resolve_deletion")
    assert len(frames) == 1 and set(frames[0]) == {"id", "type", "station_id", "user_id", "review_token", "api_contract"}
    assert [t["details"].get("outcome") for t in rows(s, tr.AUDIT_DELETION) if t["details"]["phase"] == "outcome"] == ["ok"]


def test_a_direction_wiskey_did_not_allow_and_no_confirmation_are_refused(wx):
    fake, c, _s = wx
    fake.allowed = {"central": True, "device": False, "delete": False}
    rid = review(c).json()["review_id"]
    no = resolve(c, rid, "device")
    assert no.status_code == 409 and no.json()["code"] == "resolution_not_allowed" and no.json()["details"]["wiskey_reason"] == "deletion_not_pending"
    unconfirmed = c.post(f"{API}/triage/reviews/{rid}/resolve", json=env(direction="central"), headers=as_user("root"))
    assert unconfirmed.status_code == 409 and unconfirmed.json()["code"] == "confirmation_required"
    assert not sent(fake, "conflicts/resolve")
    assert resolve(c, rid, "central").status_code == 200  # the review was not used by the refusals


def test_a_review_is_the_operators_own_and_expires(wx, monkeypatch):
    fake, c, s = wx
    rid = review(c, user="root").json()["review_id"]
    other = resolve(c, rid, "central", user="mgr")
    assert other.status_code == 404 and other.json()["code"] == "review_not_found"
    assert resolve(c, "rv_doesnotexist000", "central").status_code == 404
    with Database(s.db_path).connection() as conn:
        conn.execute("UPDATE wiskey_conflict_reviews SET expires_at = '2000-01-01T00:00:00Z' WHERE id = ?", (rid,))
    old = resolve(c, rid, "central")
    assert old.status_code == 409 and old.json()["code"] == "review_expired"
    assert not sent(fake, "conflicts/resolve")


def test_a_changed_device_or_person_is_triage_stale_and_never_retried(wx):
    fake, c, s = wx
    rid = review(c).json()["review_id"]
    fake.device_version = 2
    r = resolve(c, rid, "central")
    assert r.status_code == 409 and r.json()["code"] == "triage_stale" and r.json()["details"]["wiskey_code"] == "review_stale"
    assert r.json()["details"]["outcome"] == "refused" and len(sent(fake, "conflicts/resolve")) == 1
    rid2 = review(c).json()["review_id"]
    fake.user_revision = 9
    r2 = resolve(c, rid2, "central")
    assert r2.status_code == 409 and r2.json()["details"]["wiskey_code"] == "revision_conflict"
    with Database(s.db_path).connection() as conn:
        outcomes = [row[0] for row in conn.execute("SELECT outcome FROM wiskey_conflict_reviews ORDER BY created_at, id").fetchall()]
    assert sorted(outcomes) == ["refused", "refused"]


def test_other_refusals_and_unclear_answers_are_honest(wx):
    fake, c, _s = wx
    rid = review(c).json()["review_id"]
    fake.fail_with["conflicts/resolve"] = "device_unavailable"
    r = resolve(c, rid, "central")
    assert r.status_code == 502 and r.json()["code"] == "triage_failed" and r.json()["details"]["wiskey_code"] == "device_unavailable"
    rid2 = review(c).json()["review_id"]
    fake.fail_with["conflicts/resolve"] = "storage_write_failed"
    r2 = resolve(c, rid2, "central")
    assert r2.status_code == 504 and r2.json()["code"] == "triage_outcome_unknown" and r2.json()["details"]["outcome"] == "unknown"
    fake.fail_with["conflicts/review"] = "user_not_found"
    r3 = review(c)
    assert r3.status_code == 502 and r3.json()["details"]["wiskey_code"] == "user_not_found"


def test_an_offline_station_gets_no_review_and_a_down_feed_sends_nothing(wx):
    fake, c, _s = wx
    off = review(c, "entry-b")
    assert off.status_code == 409 and off.json()["code"] == "intercom_station_offline" and off.json()["details"]["outcome"] == "not_sent"
    assert review(c, "no-such").status_code == 404
    rid = review(c).json()["review_id"]
    intercom_sync.SYNC.shutdown()
    if intercom_sync.SYNC.thread is not None:
        intercom_sync.SYNC.thread.join(timeout=5)
    r = resolve(c, rid, "central")
    assert r.status_code in (409, 503) and r.json()["details"]["outcome"] == "not_sent"
    assert len(sent(fake, "conflicts/review")) == 1 and not sent(fake, "conflicts/resolve")


# ---------------------------------------------------------------- the manage rule

def test_the_manage_rule_is_installation_wide_and_refuses_before_the_body(wx):
    fake, c, s = wx
    assert review(c, user="mgr").status_code == 200  # access.stations.manage unrestricted
    for user in ("otto", "local", "denied"):
        r = c.post(f"{API}/stations/entry-a/conflicts/u1/review", content=b"not json", headers={**as_user(user), "content-type": "text/plain"})
        assert r.status_code == 403, (user, r.text)
        a = c.post(f"{API}/stations/entry-a/alerts/offline/snooze", content=b"x", headers={**as_user(user), "content-type": "text/plain"})
        assert a.status_code == 403, (user, a.text)
    assert len(sent(fake, "conflicts/review")) == 1 and not sent(fake, "fleet/alerts_action")
    with Database(s.db_path).connection() as conn:
        denied = conn.execute("SELECT reason FROM audit_log WHERE action = ? AND decision = 'denied' ORDER BY id", (ia.STATIONS_MANAGE,)).fetchall()
    assert len(denied) == 6 and {r[0] for r in denied} >= {"station_scoped"}


def test_the_page_facts_say_who_may_act(wx):
    _fake, c, _s = wx
    root = c.get(f"{API}/triage", headers=as_user("root")).json()
    assert root["may_resolve"] is True and root["notify"] == {"enabled": False, "can_edit": True, "last": tr.FEED.last} and root["durations"] == [15, 60, 240, 1440, 10080]
    local = c.get(f"{API}/triage", headers=as_user("local")).json()
    assert local["may_resolve"] is False and local["may_act_alerts"] is False and local["notify"]["can_edit"] is False
    mgr = c.get(f"{API}/triage", headers=as_user("mgr")).json()
    assert mgr["may_resolve"] is True and mgr["notify"]["can_edit"] is False
    assert c.get(f"{API}/triage", headers=as_user("otto")).status_code == 403


def test_names_follow_the_people_rules(wx):
    _fake, c, _s = wx
    impact = review(c, user="mgr").json()["impact"]  # mgr holds no access.people.read
    assert impact["names_hidden"] is True and impact["device"]["display_name"] is None and impact["central"]["display_name"] is None
    full = review(c, user="root").json()["impact"]
    assert full["names_hidden"] is False and full["device"]["display_name"] == "Dana (device)"


# ---------------------------------------------------------------- fleet alerts

def items(**over: Any) -> list[dict[str, Any]]:
    base = fixture("fleet_alerts.json")["items"]
    return [{**it, **over.get(it["id"], {})} for it in base]


def test_snooze_reads_fresh_then_sends_the_revision_once(wx):
    fake, c, s = wx
    fake.alert_items = items()
    r = alert(c, "entry-a", "clock_drift", "snooze", duration_minutes=240, reason="network_work")
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "completed" and r.json()["data"] == {"revision": 5}
    frames = sent(fake, "fleet/alerts_action")
    assert len(frames) == 1
    assert {k: frames[0][k] for k in ("revision", "station_id", "kind", "action", "duration_minutes", "reason", "api_contract")} == {
        "revision": 4, "station_id": "entry-a", "kind": "clock_drift", "action": "suppress", "duration_minutes": 240, "reason": "network_work", "api_contract": 1}
    assert set(frames[0]) == {"id", "type", "revision", "station_id", "kind", "action", "duration_minutes", "reason", "api_contract"}
    trail = rows(s, tr.AUDIT_ALERT)
    assert [t["details"]["phase"] for t in trail] == ["attempt", "outcome"] and trail[0]["details"]["alert_kind"] == "clock_drift"
    assert trail[0]["details"]["duration_minutes"] == 240 and trail[0]["resource_id"] == "entry-a"


def test_restore_and_maintenance(wx):
    fake, c, _s = wx
    fake.alert_items = items()
    r = alert(c, "entry-c", "sync_error", "restore")
    assert r.status_code == 200, r.text
    assert sent(fake, "fleet/alerts_action")[0]["action"] == "restore"
    not_snoozed = alert(c, "entry-a", "clock_drift", "restore")
    assert not_snoozed.status_code == 409 and not_snoozed.json()["code"] == "alert_not_snoozed"
    m = alert(c, "entry-b", "maintenance", "snooze", duration_minutes=10080, reason="planned_maintenance")
    assert m.status_code == 200 and sent(fake, "fleet/alerts_action")[-1]["kind"] == "maintenance"


def test_alert_actions_are_validated_and_refused_before_sending(wx):
    fake, c, _s = wx
    fake.alert_items = items()
    assert alert(c, "entry-a", "clock_drift", "snooze", duration_minutes=30).status_code == 422
    assert alert(c, "entry-a", "clock_drift", "snooze", reason="because").status_code == 422
    assert alert(c, "entry-a", "clock_drift", "acknowledge").status_code == 404  # WisKey has no acknowledge
    assert alert(c, "entry-a", "door_open", "snooze").status_code == 404
    gone = alert(c, "entry-a", "offline", "snooze")
    assert gone.status_code == 409 and gone.json()["code"] == "alert_not_active"
    already = alert(c, "entry-c", "sync_error", "snooze")
    assert already.status_code == 409 and already.json()["code"] == "alert_not_active"
    unconfirmed = c.post(f"{API}/stations/entry-a/alerts/clock_drift/snooze", json=env(duration_minutes=60, reason="investigating"), headers=as_user("root"))
    assert unconfirmed.status_code == 409 and unconfirmed.json()["code"] == "confirmation_required"
    assert not sent(fake, "fleet/alerts_action")


def test_a_concurrent_change_is_a_revision_conflict(wx):
    fake, c, _s = wx
    fake.alert_items = items()
    orig = fake._answer

    def bump(command: str, msg: dict[str, Any], auth: dict[str, Any]) -> list[Any]:
        if command == "fleet/alerts_action":
            fake.alert_revision = 7  # someone in WisKey's panel changed a snooze between Arx's read and its action
        return orig(command, msg, auth)

    fake._answer = bump  # type: ignore[method-assign]
    r = alert(c, "entry-a", "clock_drift", "snooze")
    assert r.status_code == 409 and r.json()["code"] == "triage_stale" and r.json()["details"]["wiskey_code"] == "revision_conflict"


# ---------------------------------------------------------------- Arx's limits

def test_the_cooldown_and_the_operator_window(wx, monkeypatch):
    fake, c, _s = wx
    fake.alert_items = items()
    monkeypatch.setattr(tr, "COOLDOWN_SCALE", 1.0)
    assert alert(c, "entry-a", "clock_drift", "snooze").status_code == 200
    again = alert(c, "entry-a", "clock_drift", "restore")
    assert again.status_code == 429 and again.json()["code"] == "triage_cooldown" and again.json()["details"]["outcome"] == "not_sent"
    monkeypatch.setattr(tr, "COOLDOWN_SCALE", 0.0)
    monkeypatch.setattr(tr, "USER_MAX", {"review": 2, "write": 10})
    assert review(c).status_code == 200 and review(c).status_code == 200
    third = review(c)
    assert third.status_code == 429 and third.json()["code"] == "triage_rate_limited"
    tr.LIMITS._inflight["write"] = tr.MAX_INFLIGHT["write"]
    busy = alert(c, "entry-c", "sync_error", "restore")
    assert busy.status_code == 429 and busy.json()["code"] == "triage_busy"


# ---------------------------------------------------------------- the notification feed

def _feed(s: Any) -> tr.AlertFeed:
    feed = tr.AlertFeed()
    feed._db, feed._settings = Database(s.db_path), s
    return feed


def _open(s: Any) -> list[tuple[str, str]]:
    with Database(s.db_path).connection() as conn:
        return sorted((r[0], r[1]) for r in conn.execute("SELECT dedupe_key, state FROM notifications WHERE source = ?", (tr.NOTIFY_SOURCE,)).fetchall())


def test_the_feed_is_off_by_default_and_reads_nothing(wx):
    _fake, c, s = wx
    feed = _feed(s)
    called = []
    out = feed.tick(read=lambda: called.append(1) or {"items": items(), "fetched_all": True})
    assert out["state"] == "off" and called == [] and _open(s) == []
    with Database(s.db_path).connection() as conn:
        from smplwise.services import notify_policy

        assert "wiskey.fleet_alert" not in [p["source"] for p in notify_policy.list_policies(conn)]


def test_the_feed_announces_active_alerts_and_resolves_gone_ones(wx):
    _fake, c, s = wx
    assert c.put(f"{API}/triage/settings", json={"notify": True}, headers=as_user("mgr")).status_code == 403
    r = c.put(f"{API}/triage/settings", json={"notify": True}, headers=as_user("root"))
    assert r.status_code == 200 and r.json()["notify"]["enabled"] is True
    feed = _feed(s)
    page = {"items": tr.ad.project_alerts(fixture("fleet_alerts.json"))["items"], "fetched_all": True}
    out = feed.tick(read=lambda: page)
    assert out["state"] == "ready" and out["emitted"] == 2
    keys = [k for k, _ in _open(s)]
    assert keys == ["wiskey.fleet_alert:entry-a:clock_drift", "wiskey.fleet_alert:entry-b:offline"]  # the snoozed entry-c alert is not announced
    with Database(s.db_path).connection() as conn:
        n = conn.execute("SELECT * FROM notifications WHERE dedupe_key = 'wiskey.fleet_alert:entry-b:offline'").fetchone()
        from smplwise.services import notify_policy

        assert "wiskey.fleet_alert" in [p["source"] for p in notify_policy.list_policies(conn)]
    assert n["subject_kind"] == "system" and n["severity"] == "alert" and "Side door" in (n["title"] or "") + (n["body"] or "")
    again = feed.tick(read=lambda: page)
    assert again["emitted"] == 0  # one notification per open condition
    page2 = {"items": [i for i in page["items"] if i["station_id"] != "entry-b"], "fetched_all": True}
    gone = feed.tick(read=lambda: page2)
    assert gone["resolved"] == 1 and dict(_open(s))["wiskey.fleet_alert:entry-b:offline"] == "resolved"
    partial = feed.tick(read=lambda: {"items": [], "fetched_all": False})
    assert partial["resolved"] == 0  # an incomplete page resolves nothing
    assert feed.tick(read=lambda: None)["state"] == "unavailable"
    assert c.put(f"{API}/triage/settings", json={"notify": False}, headers=as_user("root")).status_code == 200
    off = feed.tick(read=lambda: page)
    assert off["state"] == "off" and off["resolved"] == 1 and all(state == "resolved" for _, state in _open(s))
    changed = rows(s, "settings.changed")
    assert [r["details"]["after"] for r in changed if r["details"].get("key") == tr.NOTIFY_KEY] == [True, False]


# ---------------------------------------------------------------- the projections

def test_projections_are_closed_and_tolerate_junk():
    raw = TriageFake("admin", token="t").review("entry-a", "u1")
    raw["device"]["display_name"] = "x\u0007y"
    raw["differences"].append("secret_field")
    raw["plan"]["pin"] = "explode"
    p = tr.project_review(raw)
    assert p["device"]["display_name"] is None and p["differences"][-1] == "other" and p["plan"]["pin"] == "unknown"
    assert "cards" not in p["device"] and p["_token"] == "fp-entry-a-u1-1"
    with pytest.raises(ValueError):
        tr.project_review({"no": "token"})
    with pytest.raises(ValueError):
        tr.project_resolved({"accepted": True})
    with pytest.raises(ValueError):
        tr.project_alert_action({"revision": "5"})
    assert tr.project_alert_page({**fixture("fleet_alerts.json"), "revision": 9})["revision"] == 9


def test_result_of_reads_failures_honestly():
    from smplwise.services.intercom_client import IntercomError, UnclearAnswer

    assert tr.result_of({"success": True, "result": {"a": 1}}, "x") == {"a": 1}
    with pytest.raises(IntercomError):
        tr.result_of({"success": False, "error": {"code": "review_stale"}}, "x")
    for code in ("storage_write_failed", "", "action_failed", "not a code!"):
        with pytest.raises(UnclearAnswer):
            tr.result_of({"success": False, "error": {"code": code}}, "x")
    with pytest.raises(UnclearAnswer):
        tr.result_of({"type": "event"}, "x")
