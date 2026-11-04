"""WISKEY-PEOPLE-COMPLETE-2390 (plan task T9, owner decision Q3 "a" of 03.11): people on door stations only, their adopt / ignore /
delete, the duplicate list and the PIN check - end to end over the add-on's live service session against a STATEFUL fake WisKey
(tests/fake_wiskey.py, extended here with the station inventories). Nothing here contacts a device, a station, Home Assistant or
WisKey; the station users are synthetic.

What is proven:
- the view: only users no WisKey person is bound to on the station; the name and user number as the station reports them; PIN /
  card / face presence only with `access.people.sensitive` on the station, never a value; the review token never leaves the server;
  first seen kept across reads; an offline station is a state, never an empty list; the station scope (a station outside it = 404);
- adopt: WisKey's exact frame; several stations of one user number become ONE person (the second station links to the first's id and
  revision); an existing WisKey person with the same number is linked, not duplicated; nothing is created on the station (no
  users/create); a possible duplicate under another number refuses unless the operator accepted it;
- partial failure: one result per station (ok / refused / unknown / not_sent); after an unknown the rest is not sent;
- refusals: no confirmation, an expired or repeated command, no permission, the field level for a credential, a stale inventory, a
  user WisKey cannot import - each audited, nothing sent;
- ignore: stored in Arx and mirrored to WisKey, reversible; a refused mirror leaves the Arx decision and says so;
- delete from the station: the typed confirmation; WisKey's delete_unmanaged frame; `pending: true`;
- duplicates: WisKey's data-quality groups for an unrestricted manager, `restricted` for a station-scoped one;
- the PIN check: the value reaches WisKey's frame only - not a reply, an audit row, a log line or the database; a per-user budget."""
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
from smplwise.services import intercom_authority as ia
from smplwise.services import intercom_sync
from smplwise.services import station_people as sp

API = "/api/v1"
SENTINEL_PIN = "80706050"  # a fake sentinel - never a real PIN


def env(ttl: float = 15.0, **fields: Any) -> dict[str, Any]:
    return {"client_request_id": uuid.uuid4().hex, "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=ttl)).strftime("%Y-%m-%dT%H:%M:%SZ"), **fields}


def station_user(number: str, name: str, *, pin: bool = False, cards: int = 0, import_error: str | None = None) -> dict[str, Any]:
    return {"employee_no": number, "display_name": name, "pin_configured": pin, "cards": [{"id": f"c{number}{i}", "masked_number": f"•••• 00{i}{i}"} for i in range(cards)],
            "import_error": import_error, "ver": 1}


class StationFake(FakeWiskey):
    """The fake WisKey plus what rc.10 keeps about station users: per station the users as the device holds them, WisKey's ignore flags,
    its bindings (a directory person with the station among their assignments is bound there), adopt / delete_unmanaged / ignore /
    duplicate_check / data_quality / pin_check answered statefully. `fail_at[(command, station)] = code` makes that one station's
    command answer `code` once."""

    def __init__(self) -> None:
        super().__init__("admin", token="t")
        self.use_directory()
        self.stations: dict[str, dict[str, dict[str, Any]]] = {
            "entry-a": {"1001": station_user("1001", "Dana", pin=True), "2001": station_user("2001", "Yossi Station", pin=True, cards=1),
                        "2002": station_user("2002", "Face User", import_error="unsupported_credentials"), "2003": station_user("2003", "")},
            "entry-c": {"2001": station_user("2001", "Yossi Station", pin=True, cards=1), "1002": station_user("1002", "Avi"),
                        "1004": station_user("1004", "Lior")},
        }
        self.wk_ignored: dict[str, set[str]] = {}
        self.pending_delete: dict[str, set[str]] = {}
        self.taken_pins = {SENTINEL_PIN}
        self.fail_at: dict[tuple[str, str], str] = {}

    def fp(self, station: str, number: str) -> str:
        return f"fp-{station}-{number}-v{self.stations[station][number]['ver']}"

    def bound(self, station: str, number: str) -> str | None:
        assert self.directory is not None
        return next((p["id"] for p in self.directory if p["employee_no"] == number and station in (p.get("assignments") or {})), None)

    def _answer(self, command: str, msg: dict[str, Any], auth: dict[str, Any]) -> list[Any]:
        station = msg.get("station_id")
        code = self.fail_at.pop((command, station), None) if isinstance(station, str) else None
        if code is not None:
            return [fail(msg, code)]
        if command == "stations/inventory":
            if station in self.offline:
                return [fail(msg, "station_offline")]
            users = self.stations.get(station)
            if users is None:
                return [fail(msg, "station_not_found")]
            rows = []
            for number, u in users.items():
                rows.append({"employee_no": number, "display_name": u["display_name"], "user_id": self.bound(station, number),
                             "ignored": number in self.wk_ignored.get(station, set()), "review_token": None if u["import_error"] else self.fp(station, number),
                             "import_error": u["import_error"], "pin_configured": u["pin_configured"], "cards": copy.deepcopy(u["cards"])})
            return [ok(msg, rows)]
        if command in ("users/adopt", "users/delete_unmanaged"):
            users = self.stations.get(station) or {}
            number = msg["employee_no"]
            if number not in users:
                return [fail(msg, "device_user_missing")]
            if msg["review_token"] != self.fp(station, number):
                return [fail(msg, "review_stale")]
            if self.bound(station, number):
                return [fail(msg, "already_managed")]
            assert self.directory is not None
            if command == "users/delete_unmanaged":
                self.pending_delete.setdefault(station, set()).add(number)
                self._serial += 1
                return [ok(msg, {"id": f"tomb-{self._serial}", "employee_no": number, "display_name": users[number]["display_name"], "revision": 1, "assignments": {}})]
            uid = msg.get("user_id")
            if uid is not None:
                person = next((p for p in self.directory if p["id"] == uid), None)  # the stored record itself (`_person` answers a copy)
                if person is None:
                    return [fail(msg, "user_not_found")]
                if msg.get("revision") != person["revision"]:
                    return [fail(msg, "revision_conflict")]
                if person["employee_no"] != number:
                    return [fail(msg, "identity_migration_required")]
            else:
                if any(p["employee_no"] == number for p in self.directory):
                    return [fail(msg, "employee_conflict")]
                template = copy.deepcopy(next(p for p in self.directory if p["id"] == "u3"))
                self._serial += 1
                person = {**template, "id": f"u-adopt-{self._serial}", "employee_no": number, "display_name": users[number]["display_name"], "revision": 0,
                          "assignments": {}, "pin_configured": users[number]["pin_configured"], "cards": copy.deepcopy(users[number]["cards"])}
                self.directory.append(person)
            person["revision"] += 1
            person["assignments"][station] = {"config_entry_id": station, "enabled": True, "allowed_locks": [1], "schedule_template": None, "desired_revision": person["revision"],
                                              "applied_revision": person["revision"], "sync_state": "synced", "last_sync_at": None, "last_error": None}
            return [ok(msg, self._public(person))]
        if command == "users/ignore":
            if station not in self.stations:
                return [fail(msg, "station_not_found")]
            flags = self.wk_ignored.setdefault(station, set())
            (flags.add if msg["ignored"] else flags.discard)(msg["employee_no"])
            return [ok(msg, {"accepted": True})]
        if command == "users/duplicate_check":
            assert self.directory is not None
            data = msg["data"]
            matches = []
            for p in self.directory:
                reasons = []
                if data.get("employee_no") and p["employee_no"] == data["employee_no"]:
                    reasons.append("employee_no")
                if data.get("display_name") and p["display_name"].casefold() == data["display_name"].casefold():
                    reasons.append("display_name")
                if reasons:
                    matches.append({"id": p["id"], "display_name": p["display_name"], "employee_no": p["employee_no"], "pin_configured": True, "reasons": reasons})
            return [ok(msg, {"matches": matches, "total": len(matches), "truncated": False, "blocking": any("employee_no" in m["reasons"] for m in matches),
                             "privacy": "no_pin_or_complete_card_values"})]
        if command == "users/data_quality":
            assert self.directory is not None
            by_name: dict[str, list[dict[str, Any]]] = {}
            for p in self.directory:
                by_name.setdefault(p["display_name"].casefold(), []).append(p)
            records = []
            for group in by_name.values():
                if len(group) < 2:
                    continue
                for p in group:
                    others = [o for o in group if o["id"] != p["id"]]
                    records.append({"id": p["id"], "display_name": p["display_name"], "employee_no": p["employee_no"], "revision": p["revision"], "archived": False,
                                    "issues": [{"kind": "duplicate", "code": "duplicate_display_name", "field_id": "", "label": "", "related_ids": [o["id"] for o in others],
                                                "related_count": len(others), "related_people": [{"id": o["id"], "display_name": o["display_name"], "employee_no": o["employee_no"],
                                                                                                  "archived": False} for o in others]},
                                               {"kind": "duplicate", "code": "duplicate_phone", "field_id": "", "label": "", "related_ids": [o["id"] for o in others],
                                                "related_count": len(others), "related_people": [{"id": o["id"], "display_name": o["display_name"], "employee_no": o["employee_no"],
                                                                                                  "archived": False} for o in others]}]})
            return [ok(msg, {"format": "wiskey.people-data-quality.v1", "snapshot": "snap1", "stale": False, "records": records, "total": len(records), "offset": 0,
                             "limit": 100, "next_offset": None, "summary": {"duplicate": len(records)}, "read_only": True})]
        if command == "users/pin_check":
            return [ok(msg, {"available": msg["pin"] not in self.taken_pins})]
        return super()._answer(command, msg, auth)


@pytest.fixture()
def wx(settings, monkeypatch, station_scope):  # noqa: F811
    """root (system_admin) - otto (operator: no people.manage) - mia (site_admin on entry-a only) - nina (people.manage on entry-a
    WITHOUT people.sensitive)."""
    import websockets

    fake = StationFake()
    monkeypatch.setattr(websockets, "connect", fake.connect)
    monkeypatch.setattr(intercom_sync, "RETRY_S", 0.05)
    monkeypatch.setattr(intercom_sync, "RETRY_MAX_S", 0.2)
    for name in ("CONFIG_USER_BURST", "CONFIG_GLOBAL_BURST", "USER_BURST", "GLOBAL_BURST"):
        monkeypatch.setattr(intercom_sync, name, 1000.0)
    intercom_sync.SYNC.reset()
    sp.CACHE.reset()
    sp.PIN_BUDGET.reset()
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t", ha_core_url="http://ha.local:8123")
    from smplwise.main import create_app

    c = TestClient(create_app(s))
    bind(c, s, "root", "system_admin", "installation", "*")
    bind(c, s, "otto", "operator", "installation", "*")
    for user in ("mia", "nina"):
        c.get("/api/v1/me", headers=as_user(user))
    station_scope.bind("dev-mia", "site_admin", "entry-a")
    names_only = c.post("/api/v1/access/roles", json={"name": "people manager without sensitive", "description": "2390 field-level test",
                                                      "permissions": ["access.read", "access.people.read"], "sensitive": [ia.PEOPLE_MANAGE]})
    assert names_only.status_code == 201, names_only.text
    station_scope.bind("dev-nina", names_only.json()["id"], "entry-a")
    intercom_sync.SYNC.start(s)
    end = time.time() + 5
    while intercom_sync.STATE.state != "ready" and time.time() < end:
        time.sleep(0.02)
    assert intercom_sync.STATE.state == "ready"
    yield fake, c, s
    intercom_sync.SYNC.shutdown()
    if intercom_sync.SYNC.thread is not None:
        intercom_sync.SYNC.thread.join(timeout=5)
    intercom_sync.SYNC.reset()
    sp.CACHE.reset()


def sent(fake: FakeWiskey, command: str) -> list[dict[str, Any]]:
    return [m for m in fake.received if m.get("type") == PREFIX + command]


def audit_rows(settings: Any, action: str) -> list[dict[str, Any]]:
    db = Database(settings.db_path)
    with db.connection() as conn:
        out = [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]
    for r in out:
        r["details"] = json.loads(r["details_json"]) if r["details_json"] else {}
    return out


def users(c: TestClient, station: str, user: str = "root", refresh: bool = False) -> Any:
    return c.get(f"{API}/access-control/station-people/stations/{station}" + ("?refresh=true" if refresh else ""), headers=as_user(user))


def post(c: TestClient, path: str, user: str = "root", **body: Any) -> Any:
    return c.post(f"{API}/intercom/station-people/{path}", json=env(**body), headers=as_user(user))


# ---------------------------------------------------------------- the view

def test_the_station_list_is_the_callers_station_scope(wx):
    _fake, c, _s = wx
    root = c.get(f"{API}/access-control/station-people/stations", headers=as_user("root")).json()["stations"]
    assert [s["id"] for s in root] == ["entry-a", "entry-b", "entry-c"] and all(s["credentials"] and s["numbers"] for s in root)
    assert [s["id"] for s in c.get(f"{API}/access-control/station-people/stations", headers=as_user("mia")).json()["stations"]] == ["entry-a"]
    nina = c.get(f"{API}/access-control/station-people/stations", headers=as_user("nina")).json()["stations"]
    assert [(s["id"], s["credentials"]) for s in nina] == [("entry-a", False)]
    assert c.get(f"{API}/access-control/station-people/stations", headers=as_user("otto")).status_code == 403


def test_a_station_lists_only_its_unmanaged_users_with_presence_never_values(wx):
    fake, c, s = wx
    r = users(c, "entry-a")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["state"] == "ready" and body["cached"] is False and body["station"] == {"id": "entry-a", "name": "Main gate"}
    people = {p["employee_no"]: p for p in body["people"]}
    assert set(people) == {"2001", "2002", "2003"}, "1001 is Dana's - bound on entry-a, not station-only"
    assert people["2001"]["pin"] is True and people["2001"]["cards"] == 1 and people["2001"]["biometric"] is None and people["2001"]["adoptable"] is True
    assert people["2002"]["biometric"] is True and people["2002"]["adoptable"] is False and people["2002"]["import_error"] == "unsupported_credentials"
    assert people["2003"]["display_name"] == "" and people["2003"]["pin"] is False
    text = r.text
    assert "fp-entry-a" not in text and "review_token" not in text and "•••• " not in text, "no token, no masked card number in the view"
    sent_frames = sent(fake, "stations/inventory")
    assert sent_frames == [{"id": sent_frames[0]["id"], "type": PREFIX + "stations/inventory", "station_id": "entry-a"}], "a READ: no api_contract"
    # first seen is kept; a second read within CACHE_S is served from memory, a refresh reads the station again
    first = people["2001"]["first_seen_at"]
    again = users(c, "entry-a").json()
    assert again["cached"] is True and len(sent(fake, "stations/inventory")) == 1
    time.sleep(1.1)
    fresh = users(c, "entry-a", refresh=True).json()
    assert fresh["cached"] is False and len(sent(fake, "stations/inventory")) == 2
    by = {p["employee_no"]: p for p in fresh["people"]}
    assert by["2001"]["first_seen_at"] == first and by["2001"]["last_seen_at"] >= first
    with Database(s.db_path).connection() as conn:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(wiskey_station_people)")]
        assert cols == ["station_id", "employee_no", "first_seen_at", "last_seen_at", "ignored_at", "ignored_by"], "no name, PIN or card column"


def test_credential_presence_needs_the_sensitive_level_on_the_station(wx):
    _fake, c, _s = wx
    people = users(c, "entry-a", "nina").json()["people"]
    assert people and all(p["pin"] is None and p["cards"] is None and p["biometric"] is None for p in people)
    assert users(c, "entry-a", "mia").json()["people"][0]["pin"] is not None


def test_station_scope_and_an_offline_station(wx):
    fake, c, _s = wx
    assert users(c, "entry-c", "mia").status_code == 404, "outside the caller's scope = the uniform 404"
    assert users(c, "nowhere").status_code == 404
    assert users(c, "entry-a", "otto").status_code == 403
    fake.set_offline("entry-b")
    off = users(c, "entry-b").json()
    assert off["people"] is None and off["state"] == "error" and off["last_error"] == "station_offline", "an unreadable station is a state, never an empty list"


# ---------------------------------------------------------------- adopt

def test_adopt_on_two_stations_is_one_person_and_nothing_is_created_on_a_station(wx):
    fake, c, s = wx
    users(c, "entry-a")
    users(c, "entry-c")
    r = post(c, "adopt", employee_no="2001", station_ids=["entry-a", "entry-c"], confirmed=True)
    assert r.status_code == 200, r.text
    body = r.json()
    assert [x["outcome"] for x in body["results"]] == ["ok", "ok"] and body["summary"]["ok"] == 2
    frames = sent(fake, "users/adopt")
    assert frames[0] == {"id": frames[0]["id"], "type": PREFIX + "users/adopt", "station_id": "entry-a", "employee_no": "2001", "review_token": "fp-entry-a-2001-v1", "api_contract": 1}
    person = body["person"]
    assert frames[1]["user_id"] == person["id"] and frames[1]["revision"] == 1 and frames[1]["station_id"] == "entry-c", "the second station links to the first"
    stored = next(p for p in fake.directory or [] if p["id"] == person["id"])
    assert set(stored["assignments"]) == {"entry-a", "entry-c"} and person["display_name"] == "Yossi Station"
    assert not sent(fake, "users/create") and not sent(fake, "users/update"), "adopt never creates anything on a station"
    rows = audit_rows(s, "intercom.station_people.adopt")
    phases = [(r["resource_id"], r["details"]["phase"], r["details"].get("outcome")) for r in rows]
    assert phases == [("entry-a", "attempt", None), ("entry-a", "outcome", "ok"), ("entry-c", "attempt", None), ("entry-c", "outcome", "ok")]
    assert all(r["details"]["employee_no"] == "2001" for r in rows)
    assert "fp-entry" not in json.dumps(rows), "the review token is never audited"
    # the adopted user left the station-only list
    assert "2001" not in {p["employee_no"] for p in users(c, "entry-a").json()["people"]}


def test_an_existing_person_with_the_same_number_is_linked_not_duplicated(wx):
    fake, c, _s = wx
    users(c, "entry-c")
    r = post(c, "adopt", employee_no="1002", station_ids=["entry-c"], confirmed=True)
    assert r.status_code == 200 and r.json()["results"][0]["outcome"] == "ok", r.text
    frame = sent(fake, "users/adopt")[0]
    assert frame["user_id"] == "u2" and frame["revision"] == next(p for p in fake.directory or [] if p["id"] == "u2")["revision"] - 1
    assert r.json()["person"]["id"] == "u2" and len([p for p in fake.directory or [] if p["employee_no"] == "1002"]) == 1


def test_partial_failure_one_honest_result_per_station(wx):
    fake, c, _s = wx
    users(c, "entry-a")
    users(c, "entry-c")
    fake.fail_at[("users/adopt", "entry-c")] = "review_stale"
    body = post(c, "adopt", employee_no="2001", station_ids=["entry-a", "entry-c"], confirmed=True).json()
    assert [(x["station_id"], x["outcome"], x["code"]) for x in body["results"]] == [("entry-a", "ok", None), ("entry-c", "refused", "review_stale")]
    assert body["summary"] == {"ok": 1, "refused": 1, "unknown": 0, "not_sent": 0}
    assert "רעננו" in body["results"][1]["message"]


def test_after_an_unknown_outcome_the_rest_is_not_sent(wx):
    fake, c, s = wx
    users(c, "entry-a")
    users(c, "entry-c")
    fake.fail_at[("users/adopt", "entry-a")] = "storage_write_failed"  # may have been saved: unknown
    body = post(c, "adopt", employee_no="2001", station_ids=["entry-a", "entry-c"], confirmed=True).json()
    assert [(x["outcome"], x["code"]) for x in body["results"]] == [("unknown", "storage_write_failed"), ("not_sent", "stopped_after_unknown")]
    assert len(sent(fake, "users/adopt")) == 1, "sent once; never retried, the next station not sent"
    outcomes = [r["details"].get("outcome") for r in audit_rows(s, "intercom.station_people.adopt") if r["details"]["phase"] == "outcome"]
    assert outcomes == ["unknown"]


def test_refusals_are_audited_and_send_nothing(wx):
    fake, c, s = wx
    users(c, "entry-a")
    assert post(c, "adopt", employee_no="2001", station_ids=["entry-a"]).status_code == 409, "no confirmation"
    assert post(c, "adopt", ttl=-5, employee_no="2001", station_ids=["entry-a"], confirmed=True).status_code == 409, "expired"
    assert post(c, "adopt", "otto", employee_no="2001", station_ids=["entry-a"], confirmed=True).status_code == 403
    # a user WisKey cannot import as is, a credential without the sensitive level, a station never read, a station outside the scope
    face = post(c, "adopt", employee_no="2002", station_ids=["entry-a"], confirmed=True).json()["results"][0]
    assert face["outcome"] == "not_sent" and face["code"] == "station_people_unsupported_credentials"
    nina = post(c, "adopt", "nina", employee_no="2001", station_ids=["entry-a"], confirmed=True).json()["results"][0]
    assert nina["outcome"] == "not_sent" and nina["code"] == "intercom_field_level"
    unread = post(c, "adopt", employee_no="2001", station_ids=["entry-c"], confirmed=True).json()["results"][0]
    assert unread["code"] == "station_people_rescan_required"
    users(c, "entry-c")
    mia = post(c, "adopt", "mia", employee_no="2001", station_ids=["entry-c"], confirmed=True).json()["results"][0]
    assert mia["code"] == "intercom_station_not_found"
    assert not sent(fake, "users/adopt"), "nothing was sent"
    denied = [r for r in audit_rows(s, "intercom.station_people.adopt") if r["decision"] == "denied"]
    assert len(denied) == 6 and all(r["details"]["outcome"] == "not_sent" for r in denied)


def test_a_repeated_command_is_refused(wx):
    fake, c, _s = wx
    users(c, "entry-a")
    body = env(employee_no="2003", station_ids=["entry-a"], confirmed=True, allow_possible_duplicate=True)
    first = c.post(f"{API}/intercom/station-people/adopt", json=body, headers=as_user("root"))
    assert first.status_code == 200 and first.json()["results"][0]["outcome"] == "ok", first.text
    second = c.post(f"{API}/intercom/station-people/adopt", json=body, headers=as_user("root"))
    assert second.status_code == 409 and second.json()["code"] == "intercom_duplicate_command"
    assert len(sent(fake, "users/adopt")) == 1


def test_a_possible_duplicate_needs_the_operators_acceptance(wx):
    fake, c, _s = wx
    fake.stations["entry-c"]["2004"] = station_user("2004", "dana")  # the same name as u1 (Dana, 1001) under another number
    users(c, "entry-c")
    check = c.post(f"{API}/intercom/station-people/check", json={"station_id": "entry-c", "employee_no": "2004"}, headers=as_user("root")).json()
    assert check["checked"] and check["same_number"] is None and [(m["id"], m["reasons"]) for m in check["matches"]] == [("u1", ["display_name"])]
    refused = post(c, "adopt", employee_no="2004", station_ids=["entry-c"], confirmed=True).json()["results"][0]
    assert refused["outcome"] == "not_sent" and refused["code"] == "station_people_possible_duplicate"
    assert not sent(fake, "users/adopt")
    accepted = post(c, "adopt", employee_no="2004", station_ids=["entry-c"], confirmed=True, allow_possible_duplicate=True).json()
    assert accepted["results"][0]["outcome"] == "ok" and accepted["person"]["id"] != "u1"


def test_the_check_hides_names_from_a_station_scoped_manager(wx):
    _fake, c, _s = wx
    users(c, "entry-a", "mia")
    check = c.post(f"{API}/intercom/station-people/check", json={"station_id": "entry-a", "employee_no": "2001"}, headers=as_user("mia")).json()
    assert check["restricted"] is True and check["matches"] == []


# ---------------------------------------------------------------- ignore

def test_ignore_is_stored_mirrored_and_reversible(wx):
    fake, c, s = wx
    users(c, "entry-a")
    r = post(c, "ignore", employee_no="2003", station_ids=["entry-a"], ignored=True, confirmed=True).json()
    assert r["results"][0]["outcome"] == "ok" and r["results"][0]["stored"] is True
    frame = sent(fake, "users/ignore")[0]
    assert {k: frame[k] for k in ("station_id", "employee_no", "ignored", "api_contract")} == {"station_id": "entry-a", "employee_no": "2003", "ignored": True, "api_contract": 1}
    row = next(p for p in users(c, "entry-a", refresh=True).json()["people"] if p["employee_no"] == "2003")
    assert row["ignored"] is True and row["ignored_in_wiskey"] is True
    assert c.get(f"{API}/access-control/station-people/stations", headers=as_user("root")).json()["stations"][0]["ignored"] == 1
    post(c, "ignore", employee_no="2003", station_ids=["entry-a"], ignored=False, confirmed=True)
    row = next(p for p in users(c, "entry-a", refresh=True).json()["people"] if p["employee_no"] == "2003")
    assert row["ignored"] is False and row["ignored_in_wiskey"] is False
    # a refused mirror keeps the Arx decision and says so
    fake.fail_at[("users/ignore", "entry-a")] = "invalid_identifier"
    r = post(c, "ignore", employee_no="2003", station_ids=["entry-a"], ignored=True, confirmed=True).json()["results"][0]
    assert r["stored"] is True and r["outcome"] == "refused"
    assert next(p for p in users(c, "entry-a").json()["people"] if p["employee_no"] == "2003")["ignored"] is True
    with Database(s.db_path).connection() as conn:
        assert conn.execute("SELECT ignored_by FROM wiskey_station_people WHERE station_id='entry-a' AND employee_no='2003'").fetchone()[0] == "dev-root"


# ---------------------------------------------------------------- delete from the station

def test_delete_needs_the_typed_number_and_is_pending(wx):
    fake, c, s = wx
    users(c, "entry-a")
    wrong = post(c, "delete", employee_no="2003", station_ids=["entry-a"], confirmed=True, typed="2001")
    assert wrong.status_code == 409 and wrong.json()["code"] == "station_people_typed_mismatch" and not sent(fake, "users/delete_unmanaged")
    r = post(c, "delete", employee_no="2003", station_ids=["entry-a"], confirmed=True, typed="2003")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["results"][0]["outcome"] == "ok" and body["pending"] is True and body["effect"] == "unknown_effect"
    frame = sent(fake, "users/delete_unmanaged")[0]
    assert {k: frame[k] for k in ("station_id", "employee_no", "review_token", "api_contract")} == {"station_id": "entry-a", "employee_no": "2003", "review_token": "fp-entry-a-2003-v1", "api_contract": 1}
    assert fake.pending_delete == {"entry-a": {"2003"}}
    assert [r["details"]["phase"] for r in audit_rows(s, "intercom.station_people.delete") if r["decision"] == "allowed"] == ["attempt", "outcome"]


# ---------------------------------------------------------------- duplicates and the PIN check

def test_duplicate_groups_for_an_unrestricted_manager_only(wx):
    fake, c, _s = wx
    assert fake.directory is not None
    twin = copy.deepcopy(next(p for p in fake.directory if p["id"] == "u5"))
    twin.update(id="u9", employee_no="1009")
    fake.directory.append(twin)
    body = c.get(f"{API}/access-control/people-duplicates", headers=as_user("root")).json()
    assert body["restricted"] is False and body["complete"] is True
    codes = [(g["code"], [p["id"] for p in g["people"]]) for g in body["groups"]]
    assert codes == [("duplicate_display_name", ["u5", "u9"]), ("duplicate_phone", ["u5", "u9"])]
    assert "1005" not in json.dumps(body), "never the shared value or a number"
    assert c.get(f"{API}/access-control/people-duplicates", headers=as_user("mia")).json() == {"state": "ready", "restricted": True, "groups": [], "complete": True}


def test_the_pin_check_never_keeps_the_value(wx, caplog):
    fake, c, s = wx
    caplog.set_level(logging.DEBUG)
    taken = c.post(f"{API}/intercom/people/pin-check", json={"user_id": "", "pin": SENTINEL_PIN}, headers=as_user("root"))
    assert taken.status_code == 200 and taken.json()["available"] is False and taken.headers["cache-control"] == "no-store"
    assert c.post(f"{API}/intercom/people/pin-check", json={"user_id": "", "pin": "13579"}, headers=as_user("root")).json()["available"] is True
    assert sent(fake, "users/pin_check")[0]["pin"] == SENTINEL_PIN, "the value reaches WisKey's frame"
    rows = audit_rows(s, "intercom.person.pin_check")
    assert [r["details"]["available"] for r in rows] == [False, True]
    assert SENTINEL_PIN not in json.dumps(rows) and SENTINEL_PIN not in caplog.text and SENTINEL_PIN not in taken.text
    db_bytes = b"".join(p.read_bytes() for p in s.db_path.parent.glob(s.db_path.name + "*"))
    assert SENTINEL_PIN.encode() not in db_bytes
    assert c.post(f"{API}/intercom/people/pin-check", json={"user_id": "", "pin": "1"}, headers=as_user("otto")).status_code == 403
    assert c.post(f"{API}/intercom/people/pin-check", json={"user_id": "", "pin": "1"}, headers=as_user("nina")).status_code == 403, "people.sensitive needed"
    for _ in range(sp.PIN_CHECKS_PER_MIN - 2):
        assert c.post(f"{API}/intercom/people/pin-check", json={"user_id": "", "pin": "24680"}, headers=as_user("root")).status_code == 200
    limited = c.post(f"{API}/intercom/people/pin-check", json={"user_id": "", "pin": "24680"}, headers=as_user("root"))
    assert limited.status_code == 429 and len(sent(fake, "users/pin_check")) == sp.PIN_CHECKS_PER_MIN


# ---------------------------------------------------------------- units of the service module

def test_projection_drops_rows_it_could_never_act_on_and_never_keeps_a_value():
    rows = sp.project_rows([
        {"employee_no": "bad no", "display_name": "x"},
        {"employee_no": "3001", "display_name": "  Long\u0007  name ", "user_id": None, "review_token": "t", "import_error": None, "pin_configured": True,
         "cards": [{"id": "a"}, "junk"]},
        {"employee_no": "3001", "display_name": "dup"},
        {"employee_no": "3002", "display_name": 5, "import_error": "Weird Code!", "cards": None},
    ])
    assert [(r.employee_no, r.display_name, r.cards, r.import_error) for r in rows] == [("3001", "Long name", 1, None), ("3002", "", 0, "unknown")]
    with pytest.raises(ValueError):
        sp.project_rows({"not": "a list"})


def test_refusal_table_is_conservative():
    from smplwise.services.intercom_client import IntercomError, UnclearAnswer

    with pytest.raises(IntercomError):
        sp._write_result({"success": False, "error": {"code": "review_stale"}}, "users/adopt")
    for code in ("storage_write_failed", "manager_closed", "action_failed", "something_new"):
        with pytest.raises(UnclearAnswer):
            sp._write_result({"success": False, "error": {"code": code}}, "users/adopt")
    with pytest.raises(UnclearAnswer):
        sp._write_result({"success": "yes"}, "users/delete_unmanaged")
    assert sp._write_result({"success": True, "result": {"accepted": True}}, "users/ignore") == {"accepted": True}
