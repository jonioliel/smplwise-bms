"""WISKEY-ACCESS-DIAG-2400 (plan 2026-11-03 T10): the "אבחון הרשאות" views end to end over the add-on's live service session against the
fake WisKey (tests/fake_wiskey.py, answered here with rc.10's shapes for the ten diagnostics commands): nothing contacts a device, a
station, Home Assistant or WisKey.

What is proven:
- the exact frames: every command with the pinned catalog's keys, `api_contract` only on the two non-READ commands, the reads on the closed
  `diagnostics` channel and the decision on the `access_review` channel (and neither guard lets the other's command through);
- the gates: `access.read` unrestricted at the installation (a station-scoped caller: audited 403 `station_scoped`), people views also
  `access.people.read` unrestricted; the decision `access.people.manage` anywhere (before the body) and on the station;
- the answers: WisKey's reason and the grant's source in the scenario, the comparisons (people, doors), the review list with the Arx actor
  of a decision taken in Arx, quality, lifecycle, sync and the permission audit, each a closed projection;
- privacy: no PIN, card number or card digits, phone, WisKey actor id or user pseudonym reaches any reply; the employee number follows the
  administrator's setting; the "no credentials" list needs `access.people.sensitive`;
- the decision: confirmation required, envelope checks, a stale review refused (409, WisKey's code), WisKey not offering it -> not sent,
  WisKey refusing the identity -> 403 with the deep-link wording; attempt + outcome audit rows and Arx's own record;
- the permission audit's limits (one per station, cool-down) and its audit row; an offline station is not asked."""
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
from fake_wiskey import PIN_DIR, FakeWiskey, fail, ok
from fastapi.testclient import TestClient
from intercom_station_scope import station_scope  # noqa: F401 - a fixture

from smplwise.db import Database
from smplwise.services import intercom_authority as ia
from smplwise.services import intercom_client, intercom_sync, wiskey_channels
from smplwise.services import wiskey_access_diag as diag

API = "/api/v1/access-control/diag"
FP = "f" * 64
OLD = "a" * 32
SECRETS = ("+972500000001", "•••• 4321", "ha-supervisor-user-id", "uref00000000", "PIN-SENTINEL", "secret-host")


def person_side(source: str = "inherited", granted: bool = True, groups: list | None = None, override: Any = None) -> dict[str, Any]:
    return {"granted": granted, "configured": True, "source": source, "groups": groups if groups is not None else [{"id": "staff", "name": "צוות"}],
            "override": override, "sources_known": True}


class DiagFake(FakeWiskey):
    """The fake WisKey with rc.10's answers to the diagnostics commands. Sensitive bait (a phone, card digits, WisKey's actor, user
    pseudonyms, a PIN plan) is planted in the answers so the tests can prove the projections drop it."""

    def __init__(self, *a: Any, **kw: Any) -> None:
        super().__init__(*a, **kw)
        self.fail_with: dict[str, str] = {}
        self.receipts: list[dict[str, Any]] = []
        self.revision = 4
        self.fingerprint = FP
        self.scenario_reason = "outside_schedule"

    def latest(self) -> str:
        return self.receipts[-1]["id"] if self.receipts else ""

    def _answer(self, command: str, msg: dict[str, Any], auth: dict[str, Any]) -> list[Any]:
        if command not in diag.READS and command != diag.DECIDE:
            return super()._answer(command, msg, auth)
        if command in self.fail_with:
            return [fail(msg, self.fail_with[command])]
        sid = msg.get("station_id")
        if sid is not None and sid not in {s["id"] for s in self.overview["stations"]}:
            return [fail(msg, "station_not_found")]
        if command == diag.OPTIONS:
            people = [{"id": "u1", "name": "דנה כהן", "archived": False}, {"id": "u2", "name": "יוסי לוי", "archived": False}, {"id": "u3", "name": "רון בר", "archived": True}]
            groups = [{"id": "staff", "name": "צוות", "archived": False}, {"id": "night", "name": "לילה", "archived": False}]
            rows = [r for r in (people if msg["kind"] == "person" else groups) if msg["query"] in r["name"]]
            return [ok(msg, {"records": rows[msg["offset"]: msg["offset"] + msg["limit"]], "total": len(rows), "offset": msg["offset"], "limit": msg["limit"],
                             "next_offset": None, "previous_offset": None, "read_only": True, "phone": "+972500000001"})]
        if command == diag.SCENARIO:
            reason = self.scenario_reason
            return [ok(msg, {
                "read_only": True, "person_revision": self.revision, "station_id": sid, "lock_id": msg["lock_id"], "at": msg["at"],
                "desired": {"allowed": reason == "allowed", "reason": reason, "timing_mode": "ha", "draft_ignored": False, "pin": "PIN-SENTINEL"},
                "observed": {"source": "cached_sync_metadata", "sync_state": "synced", "last_sync_at": "2026-11-03T08:00:00+00:00", "revision_matches": True,
                             "timing": {"status": "historical", "mode": "ha", "checked_at": "2026-11-03T08:00:00+00:00", "valid_from": "2026-11-03T06:00:00+02:00",
                                        "valid_until": "2026-11-03T17:00:00+02:00", "interval_contains_target": False, "fingerprint": "secret-host"}},
                "station_status": "online", "physical_result": "not_verified",
            })]
        if command == diag.COMPARE:
            label = lambda k, i: {"kind": k, "id": i, "name": {"u1": "דנה כהן", "u2": "יוסי לוי", "staff": "צוות", "night": "לילה"}.get(i, i), "active": True, "archived": False,
                                  "valid_from": None, "valid_until": "2026-12-01T00:00:00+00:00", "timing_mode": "ha", "phone": "+972500000001"} if k == "person" else \
                {"kind": k, "id": i, "name": i, "enabled": True}
            rows = [
                {"station_id": "entry-a", "station_name": "Main gate", "lock_id": 1, "relation": "shared", "left": person_side(), "right": person_side()},
                {"station_id": "entry-c", "station_name": "Loading dock", "lock_id": 1, "relation": "left_only",
                 "left": person_side("personal_allow", groups=[], override="allow"), "right": person_side("none", granted=False, groups=[])},
                {"station_id": "entry-c", "station_name": "Loading dock", "lock_id": 2, "relation": "neither",
                 "left": person_side("personal_deny", granted=False, groups=[], override="deny"), "right": person_side("none", granted=False, groups=[])},
            ]
            return [ok(msg, {"left": label(msg["left_kind"], msg["left_id"]), "right": label(msg["right_kind"], msg["right_id"]), "rows": rows,
                             "summary": {"shared": 1, "left_only": 1, "right_only": 0, "neither": 1}, "read_only": True, "scope": "caller_projected", "physical_result": "not_verified"})]
        central = lambda granted=True: {"active": True, "archived": False, "valid_from": None, "valid_until": None, "assignment_enabled": True, "granted": granted,
                                        "timing_mode": "ha", "schedule": {"mode": "weekly", "timezone": "Asia/Jerusalem", "days": ["sunday", "monday"], "dates": [],
                                                                          "periods": [{"start": "08:00", "end": "17:00"}], "bindings": {"x": "secret-host"}}}
        receipt = lambda r: {**r, "actor": "ha-supervisor-user-id", "fingerprint": self.fingerprint}
        if command == diag.REVIEWS:
            granted_u2 = not (sid == "entry-c" and msg["lock_id"] == 2)
            rows = [
                {"user_id": "u1", "display_name": "דנה כהן", "person_revision": self.revision, "status": "completed" if self.receipts else "pending",
                 "central": central(sid == "entry-a"), "latest": receipt(self.receipts[-1]) if self.receipts else None, "sync_state": "synced"},
                {"user_id": "u2", "display_name": "יוסי לוי", "person_revision": 2, "status": "due", "central": central(granted_u2), "latest": None, "sync_state": "pending"},
            ]
            if sid == "entry-c":
                rows = rows[1:]
            filtered = [r for r in rows if msg["state"] == "all" or r["status"] == msg["state"]]
            return [ok(msg, {"snapshot": "b" * 64, "stale": False, "total": len(filtered), "offset": msg["offset"], "limit": msg["limit"], "next_offset": None,
                             "previous_offset": None, "records": filtered[msg["offset"]: msg["offset"] + msg["limit"]],
                             "summary": {"pending": 0 if self.receipts else 1, "due": 1, "stale": 0, "completed": 1 if self.receipts else 0, "followup": 0, "archived": 0},
                             "scope": "selected_door", "access_changed": False})]
        if command == diag.PREVIEW:
            return [ok(msg, {"user_id": msg["user_id"], "station_id": sid, "lock_id": msg["lock_id"], "person_revision": self.revision, "fingerprint": self.fingerprint,
                             "latest_id": self.latest(), "central": central(), "history": [receipt(r) for r in reversed(self.receipts)], "scope": "selected_door",
                             "access_changed": False})]
        if command == diag.DECIDE:
            if msg["confirmed"] is not True:
                return [fail(msg, "confirmation_required")]
            if msg["person_revision"] != self.revision or msg["fingerprint"] != self.fingerprint or msg["latest_id"] != self.latest():
                return [fail(msg, "access_review_stale")]
            at = datetime(2026, 11, 4, 9, 0, tzinfo=timezone.utc)
            row = {"id": uuid.uuid4().hex, "user_id": msg["user_id"], "station_id": sid, "lock_id": msg["lock_id"], "person_revision": msg["person_revision"],
                   "decision": msg["decision"], "reason": msg["reason"], "cadence_days": msg["cadence_days"], "at": at.isoformat(timespec="seconds"),
                   "due_at": (at + timedelta(days=msg["cadence_days"])).isoformat(timespec="seconds")}
            self.receipts.append(row)
            return [ok(msg, {"receipt": receipt(row), "access_changed": False, "scope": "selected_door"})]
        if command == diag.QUALITY:
            return [ok(msg, {
                "format": "wiskey.people-data-quality.v1", "snapshot": "c" * 24, "stale": False,
                "coverage": {"scope": "all", "scanned": 3, "archived": 1, "unknown_fields": 0},
                "summary": {"people": 2, "missing": 1, "invalid": 0, "duplicate": 2},
                "total": 2, "offset": msg["offset"], "limit": msg["limit"], "next_offset": None, "previous_offset": None, "read_only": True,
                "records": [
                    {"id": "u1", "display_name": "דנה כהן", "employee_no": "1001", "revision": 4, "archived": False, "operator_editable": True,
                     "issues": [{"kind": "missing", "code": "missing_phone", "field_id": "", "label": ""},
                                {"kind": "duplicate", "code": "duplicate_display_name", "field_id": "", "label": "", "related_ids": ["u2"], "related_count": 1,
                                 "related_people": [{"id": "u2", "display_name": "יוסי לוי", "employee_no": "1002", "archived": False}]}]},
                    {"id": "u2", "display_name": "יוסי לוי", "employee_no": "1002", "revision": 2, "archived": False, "operator_editable": True,
                     "issues": [{"kind": "duplicate", "code": "duplicate_display_name", "field_id": "", "label": "", "related_ids": ["u1"], "related_count": 1,
                                 "related_people": [{"id": "u1", "display_name": "דנה כהן", "employee_no": "1001", "archived": False}]}]},
                ],
            })]
        if command == diag.LIFECYCLE:
            row = lambda i, n, **kw: {"id": i, "display_name": n, "employee_no": "100" + i[-1], "phone": "+972500000001", "access_category": "visitor", "responsible_person": "x",
                                      "access_purpose": "y", "active": True, "valid_from": None, "valid_until": "2026-11-10T00:00:00+00:00", "pin_configured": True,
                                      "card_count": 2, "enabled_card_count": 1, "assignment_count": 2, "group_ids": ["staff"], **kw}
            return [ok(msg, {
                "format": "hikvision_intercom.identity_lifecycle", "generated_at": "2026-11-04T09:00:00+00:00", "warning_days": msg["warning_days"],
                "summary": {"total": 3, "active": 2, "scheduled": 0, "expired": 1, "expiring": 1, "without_credentials": 1, "duplicate_groups": 1, "duplicate_users": 2},
                "expirations": [row("u1", "דנה כהן", state="expiring", seconds_remaining=518400), row("u3", "רון בר", state="expired", seconds_remaining=-3600)],
                "duplicates": [{"reason": "card_last4", "match": "•••• 4321", "users": [row("u1", "דנה כהן"), row("u2", "יוסי לוי")]}],
                "without_credentials": [row("u2", "יוסי לוי")],
                "temporary_access": {"summary": {"total": 1, "active": 1, "upcoming": 0, "expired": 0, "inactive": 0, "expiring": 1},
                                     "users": [row("u1", "דנה כהן", state="active", expiring_soon=True, revision=4, timing_policy_configured=True,
                                                   assignment_states={"entry-a": {"sync_state": "synced", "last_error": "secret-host"}})]},
                "truncated": {"expirations": False, "duplicates": False, "without_credentials": False, "temporary_access": False},
                "privacy": "no_pin_or_complete_card_values",
            })]
        if command == diag.SYNC_DIAG:
            return [ok(msg, {
                "integration_version": "2.0.1-rc.10", "retention": "last_200_stages_since_start",
                "stations": [{"station_ref": "0123456789ab", "state": "synced", "last_error": None, "loaded": True, "managed_lock": True, "worker_active": False,
                              "pending_request": False, "reconciliation_targets": 0},
                             {"station_ref": "ba9876543210", "state": "error", "last_error": "authentication_failed", "loaded": True, "managed_lock": True,
                              "worker_active": True, "pending_request": True, "reconciliation_targets": 3}],
                "recent": [{"timestamp": "2026-11-04T08:00:00+00:00", "station_ref": "ba9876543210", "user_ref": "uref00000000", "step": "inventory", "outcome": "failed",
                            "error": "authentication_failed", "status_code": 4, "sub_status": "unauthorized"},
                           {"timestamp": "2026-11-04T08:05:00+00:00", "station_ref": "0123456789ab", "user_ref": None, "step": "complete", "outcome": "succeeded"}],
            })]
        if command == diag.AUDIT:
            return [ok(msg, {
                "station_id": sid, "checked_at": "2026-11-04T09:00:00+00:00", "device_writes": 0, "complete": True, "total_candidates": 3,
                "counts": {"matched": 1, "drift": 1, "unmanaged": 1, "unverified": 0},
                "rows": [
                    {"user_id": "u1", "display_name": "דנה כהן", "employee_no": "1001", "revision": 4, "status": "matched", "differences": [], "error": None,
                     "plan": {"person": "none", "pin": "none", "cards_add": 0, "cards_remove": 0, "cards_update": 0}},
                    {"user_id": "u2", "display_name": "יוסי לוי", "employee_no": "1002", "revision": 2, "status": "drift", "differences": ["validity", "pin", "cards"],
                     "error": None, "plan": {"person": "update", "pin": "change", "cards_add": 1, "cards_remove": 0, "cards_update": 0}},
                    {"user_id": None, "employee_no": "9999", "display_name": None, "revision": None, "status": "unmanaged", "differences": [], "error": None},
                ],
            })]
        return [ok(msg, {})]


def env(ttl: float = 15.0, **fields: Any) -> dict[str, Any]:
    return {"client_request_id": uuid.uuid4().hex, "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=ttl)).strftime("%Y-%m-%dT%H:%M:%SZ"), **fields}


def wait_for(pred: Any, timeout: float = 5.0) -> None:
    end = time.time() + timeout
    while time.time() < end:
        if pred():
            return
        time.sleep(0.02)
    raise AssertionError(f"condition not met; feed state {intercom_sync.STATE.as_dict()}")


def role(c: TestClient, name: str, permissions: list[str], sensitive: list[str] | None = None) -> str:
    r = c.post("/api/v1/access/roles", json={"name": name, "description": "T10 test", "permissions": permissions, "sensitive": sensitive or []})
    assert r.status_code == 201, r.text
    return r.json()["id"]


@pytest.fixture()
def dx(settings, monkeypatch, station_scope):  # noqa: F811
    """The app with DiagFake as its WisKey and these principals: root (system_admin, installation) - reader (access.read only) - viewer
    (access.read + access.people.read, installation) - decider (viewer + access.people.manage; DENIED on entry-c) - mia (site_admin on
    entry-a only: station-scoped)."""
    import websockets

    fake = DiagFake("admin", token="t")
    monkeypatch.setattr(websockets, "connect", fake.connect)
    monkeypatch.setattr(intercom_sync, "RETRY_S", 0.05)
    monkeypatch.setattr(intercom_sync, "RETRY_MAX_S", 0.2)
    for name in ("USER_BURST", "GLOBAL_BURST"):
        monkeypatch.setattr(intercom_sync, name, 1000.0)
    diag.reset()
    intercom_sync.SYNC.reset()
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t", ha_core_url="http://ha.local:8123")
    from smplwise.main import create_app

    c = TestClient(create_app(s))
    bind(c, s, "root", "system_admin", "installation", "*")
    bind(c, s, "reader", role(c, "access reader", ["access.read"]), "installation", "*")
    bind(c, s, "viewer", role(c, "diag viewer", ["access.read", "access.people.read"]), "installation", "*")
    bind(c, s, "decider", role(c, "diag decider", ["access.read", "access.people.read"], [ia.PEOPLE_MANAGE]), "installation", "*")
    station_scope.bind("dev-decider", role(c, "no people manage", [], [ia.PEOPLE_MANAGE]), "entry-c", effect="deny")
    c.get("/api/v1/me", headers=as_user("mia"))
    station_scope.bind("dev-mia", "site_admin", "entry-a")
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    yield fake, c, s
    intercom_sync.SYNC.shutdown()
    if intercom_sync.SYNC.thread is not None:
        intercom_sync.SYNC.thread.join(timeout=5)
    intercom_sync.SYNC.reset()
    diag.reset()


def get(c: TestClient, path: str, user: str = "root", **params: Any) -> Any:
    return c.get(f"{API}{path}", params=params, headers=as_user(user))


def sent(fake: DiagFake, command: str) -> list[dict[str, Any]]:
    return [m for m in fake.received if m.get("type") == intercom_client.command_type(command)]


def no_secrets(body: Any) -> None:
    text = json.dumps(body, ensure_ascii=False)
    for marker in SECRETS:
        assert marker not in text, marker
    assert '"phone"' not in text and '"pin_configured"' not in text and '"plan"' not in text and '"actor"' not in text and '"user_ref"' not in text


def audit_rows(s: Any, action: str) -> list[dict[str, Any]]:
    with Database(s.db_path).connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


# ---------------------------------------------------------------- the channels and the frames

def test_the_channels_hold_exactly_the_view_commands_and_the_one_decision():
    catalog = json.loads((PIN_DIR / "commands.static.json").read_text(encoding="utf-8"))["commands"]
    assert wiskey_channels.DIAGNOSTICS == diag.READS and wiskey_channels.ACCESS_REVIEW == {diag.DECIDE}
    for command in diag.READS:
        is_read = catalog[command]["permission"]["read_command_for_security_guard_and_api_contract"]
        assert is_read is (command not in diag.NON_READ), command
    assert catalog[diag.DECIDE]["permission"]["read_command_for_security_guard_and_api_contract"] is False
    assert not wiskey_channels.allowed("diagnostics", wiskey_channels.PREFIX + diag.DECIDE)
    assert not wiskey_channels.allowed("access_review", wiskey_channels.PREFIX + diag.SCENARIO)
    for other in ("read", "technical", "service", "background", "messaging"):
        assert not wiskey_channels.allowed(other, wiskey_channels.PREFIX + diag.DECIDE), other
    assert not (wiskey_channels.DIAGNOSTICS & wiskey_channels.SERVICE_WRITES)


def test_every_frame_carries_exactly_the_catalog_keys(dx):
    fake, c, _s = dx
    assert get(c, "/options", kind="person", query="").status_code == 200
    assert get(c, "/scenario", user_id="u1", station_id="entry-a", lock_id=1, at="2026-11-04T10:00:00+02:00").status_code == 200
    assert get(c, "/compare", left_kind="person", left_id="u1", right_kind="person", right_id="u2").status_code == 200
    assert get(c, "/compare-doors", left="entry-a:1", right="entry-c:2").status_code == 200
    assert get(c, "/reviews", station_id="entry-a", lock_id=1).status_code == 200
    assert get(c, "/reviews/preview", user_id="u1", station_id="entry-a", lock_id=1).status_code == 200
    assert get(c, "/quality").status_code == 200
    assert get(c, "/lifecycle", days=14).status_code == 200
    assert get(c, "/sync").status_code == 200
    assert get(c, "/stations/entry-a/permission-audit").status_code == 200
    catalog = json.loads((PIN_DIR / "commands.static.json").read_text(encoding="utf-8"))["commands"]
    seen = set()
    for msg in fake.received:
        command = str(msg.get("type", "")).removeprefix("hikvision_intercom/")
        if command not in diag.READS:
            continue
        seen.add(command)
        props = set(catalog[command]["request"]["properties"])
        required = set(catalog[command]["request"]["required"])
        assert required <= set(msg) <= props, (command, sorted(msg))
        assert ("api_contract" in msg) is (command in diag.NON_READ), command
    assert seen == diag.READS
    scen = sent(fake, diag.SCENARIO)[0]
    assert scen["at"] == "2026-11-04T08:00:00+00:00" and scen["lock_id"] == 1, "an instant with an offset is sent as UTC"
    assert {m["left_id"] for m in sent(fake, diag.COMPARE)} >= {"u1"}
    doors = sent(fake, diag.REVIEWS)
    assert {(m["station_id"], m["lock_id"]) for m in doors} == {("entry-a", 1), ("entry-c", 2)}
    assert intercom_sync.SYNC._channel_calls["diagnostics"].channel == "diagnostics"


# ---------------------------------------------------------------- the gates

def test_the_views_need_access_read_unrestricted_and_people_views_people_read(dx):
    fake, c, s = dx
    home = get(c, "", user="reader")
    assert home.status_code == 200 and home.json()["can"] == {"people": False, "decide": False, "sensitive": False, "employee_no": False}
    assert get(c, "/sync", user="reader").status_code == 200
    before = len(fake.received)
    for path, params in (("/scenario", {"user_id": "u1", "station_id": "entry-a"}), ("/quality", {}), ("/lifecycle", {}), ("/options", {}),
                         ("/reviews", {"station_id": "entry-a"}), ("/stations/entry-a/permission-audit", {})):
        r = get(c, path, user="reader", **params)
        assert r.status_code == 403 and r.json()["details"]["permission"] == "access.people.read", path
    assert len(fake.received) == before, "nothing is sent for a refused caller"
    # a station-scoped site manager: WisKey answers these installation-wide -> refused, audited `station_scoped`
    r = get(c, "/sync", user="mia")
    assert r.status_code == 403 and r.json()["details"]["reason"] == "station_scoped"
    assert any(row["reason"] == "station_scoped" and row["actor_user_id"] == "dev-mia" for row in audit_rows(s, "access.read"))
    assert get(c, "", user="nobody-at-all").status_code == 403
    viewer = get(c, "", user="viewer").json()
    assert viewer["can"]["people"] is True and viewer["can"]["decide"] is False
    assert get(c, "", user="decider").json()["can"]["decide"] is True


def test_the_home_lists_features_and_doors_without_calling_wiskey(dx):
    fake, c, _s = dx
    before = len(fake.received)
    body = get(c, "").json()
    assert len(fake.received) == before
    assert all(v == {"available": True, "reason": None} for v in body["features"].values())
    doors = {d["id"]: d for d in body["doors"]}
    assert [x["lock_id"] for x in doors["entry-c"]["doors"]] == [1, 2] and doors["entry-c"]["doors"][1]["name"] == "Barrier"
    assert doors["entry-b"]["doors"] == [{"lock_id": 1, "name": None}] and doors["entry-b"]["online"] is False


def test_a_view_wiskey_does_not_list_is_unsupported_and_nothing_is_sent(dx):
    fake, c, _s = dx
    fake.unlist(diag.LIFECYCLE, diag.DECIDE)
    intercom_sync.SYNC.reset()
    intercom_sync.SYNC.start(c.app.state.settings)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    home = get(c, "").json()
    assert home["features"]["lifecycle"] == {"available": False, "reason": "not_listed"} and home["features"]["review_decide"]["available"] is False
    r = get(c, "/lifecycle")
    assert r.status_code == 409 and r.json()["code"] == "diag_unsupported"
    assert not sent(fake, diag.LIFECYCLE)


# ---------------------------------------------------------------- the scenario and the comparisons

def test_the_scenario_answers_with_wiskeys_reason_and_the_source_of_the_grant(dx):
    fake, c, _s = dx
    body = get(c, "/scenario", user="viewer", user_id="u1", station_id="entry-c", lock_id=1).json()
    assert body["state"] == "ready"
    sc = body["scenario"]
    assert sc["desired"] == {"allowed": False, "reason": "outside_schedule", "timing_mode": "ha", "draft_ignored": False}
    assert sc["source"]["source"] == "personal_allow" and sc["source"]["override"] == "allow"
    assert sc["person"]["name"] == "דנה כהן" and sc["person"]["valid_until"] == "2026-12-01T00:00:00+00:00"
    assert sc["observed"]["timing"]["status"] == "historical" and sc["physical_result"] == "not_verified"
    assert body["station"] == {"id": "entry-c", "name": "Loading dock", "online": True, "door_name": "Gate"}
    no_secrets(body)
    # the source comes from the person compared with themselves
    assert sent(fake, diag.COMPARE)[-1] == {**sent(fake, diag.COMPARE)[-1], "left_kind": "person", "left_id": "u1", "right_kind": "person", "right_id": "u1"}
    # a door the person has no row for reads "none"; groups come through
    a = get(c, "/scenario", user_id="u1", station_id="entry-a", lock_id=2).json()["scenario"]["source"]
    assert a == {"granted": False, "configured": False, "source": "none", "groups": [], "override": None, "sources_known": True}
    a = get(c, "/scenario", user_id="u1", station_id="entry-a", lock_id=1).json()["scenario"]["source"]
    assert a["source"] == "inherited" and a["groups"] == [{"id": "staff", "name": "צוות"}]
    # an unknown reason from a newer WisKey reads unknown; a bad instant, an unknown station
    fake.scenario_reason = "holiday_closed"
    assert get(c, "/scenario", user_id="u1", station_id="entry-a").json()["scenario"]["desired"]["reason"] == "unknown"
    assert get(c, "/scenario", user_id="u1", station_id="entry-a", at="2026-11-04T10:00:00").status_code == 422
    assert get(c, "/scenario", user_id="u1", station_id="nowhere").status_code == 404


def test_compare_people_groups_and_doors(dx):
    _fake, c, _s = dx
    people = get(c, "/compare", left_id="u1", right_id="u2").json()["compare"]
    assert people["summary"] == {"shared": 1, "left_only": 1, "right_only": 0, "neither": 1}
    assert [r["relation"] for r in people["rows"]] == ["shared", "left_only", "neither"] and people["left"]["kind"] == "person"
    no_secrets(people)
    groups = get(c, "/compare", left_kind="group", left_id="staff", right_kind="group", right_id="night").json()["compare"]
    assert groups["left"] == {"kind": "group", "id": "staff", "name": "staff", "enabled": True}
    assert get(c, "/compare", left_kind="group", left_id="staff", right_kind="person", right_id="u1").status_code == 422
    doors = get(c, "/compare-doors", left="entry-a:1", right="entry-c:2").json()["doors"]
    assert doors["complete"] is True and doors["summary"] == {"shared": 0, "left_only": 2, "right_only": 0, "neither": 0}
    assert {r["user_id"]: (r["left"], r["right"], r["right_assigned"]) for r in doors["rows"]} == {"u1": (True, False, False), "u2": (True, False, True)}
    assert get(c, "/compare-doors", left="entry-a:1", right="entry-a:1").status_code == 422
    assert get(c, "/compare-doors", left="entry-a:3", right="entry-a:1").status_code == 422


# ---------------------------------------------------------------- reviews and the decision

def decide(c: TestClient, user: str = "decider", **over: Any) -> Any:
    body = env(user_id="u1", station_id="entry-a", lock_id=1, person_revision=4, fingerprint=FP, latest_id="", decision="keep",
               reason="נבדק מול רשימת העובדים", cadence_days=90, confirmed=True)
    body.update(over)
    return c.post(f"{API}/reviews/decide", json=body, headers=as_user(user))


def test_the_review_list_and_preview(dx):
    _fake, c, _s = dx
    page = get(c, "/reviews", station_id="entry-a", lock_id=1).json()["reviews"]
    assert [r["status"] for r in page["records"]] == ["pending", "due"] and page["summary"]["due"] == 1
    assert page["records"][0]["central"]["schedule"] == {"mode": "weekly", "timezone": "Asia/Jerusalem", "days": ["sunday", "monday"], "dates": [],
                                                         "periods": [{"start": "08:00", "end": "17:00"}]}
    pre = get(c, "/reviews/preview", user="viewer", user_id="u1", station_id="entry-a", lock_id=1).json()
    assert pre["preview"]["fingerprint"] == FP and pre["preview"]["latest_id"] == "" and pre["decide"] == {"available": True, "reason": None, "allowed": False}
    assert get(c, "/reviews/preview", user="decider", user_id="u1", station_id="entry-a", lock_id=1).json()["decide"]["allowed"] is True
    assert get(c, "/reviews/preview", user="decider", user_id="u1", station_id="entry-c", lock_id=1).json()["decide"]["allowed"] is False
    no_secrets(page)


def test_a_decision_is_confirmed_sent_once_audited_and_attributed_to_the_arx_operator(dx):
    fake, c, s = dx
    r = decide(c, confirmed=None)
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required" and not sent(fake, diag.DECIDE)
    r = decide(c)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["status"] == "saved" and out["access_changed"] is False and out["receipt"]["decision"] == "keep" and out["receipt"]["arx_actor"]
    frames = sent(fake, diag.DECIDE)
    assert len(frames) == 1 and frames[0]["confirmed"] is True and frames[0]["api_contract"] == intercom_client.API_CONTRACT
    assert frames[0]["reason"] == "נבדק מול רשימת העובדים" and frames[0]["cadence_days"] == 90
    rows = audit_rows(s, "intercom.access_review_decide")
    phases = [json.loads(x["details_json"])["phase"] for x in rows]
    assert phases == ["refused", "attempt", "outcome"] and rows[-1]["actor_user_id"] == "dev-decider"
    with Database(s.db_path).connection(mode="read") as conn:
        saved = [dict(x) for x in conn.execute("SELECT * FROM wiskey_access_review_decisions").fetchall()]
    assert len(saved) == 1 and saved[0]["actor_user_id"] == "dev-decider" and saved[0]["receipt_id"] == out["receipt"]["id"]
    # the list now says who in Arx decided (WisKey's own receipt names only the add-on's identity, which is never shown)
    page = get(c, "/reviews", station_id="entry-a", lock_id=1).json()["reviews"]
    latest = page["records"][0]["latest"]
    assert latest["id"] == out["receipt"]["id"] and latest["arx_actor"] == (saved[0]["actor_name"] or "dev-decider")
    no_secrets(page)
    # the same envelope again: a duplicate, not sent
    again = c.post(f"{API}/reviews/decide", json={**env(), "client_request_id": json.loads(rows[1]["details_json"])["client_request_id"],
                                                  "user_id": "u1", "station_id": "entry-a", "lock_id": 1, "person_revision": 4, "fingerprint": FP,
                                                  "latest_id": out["receipt"]["id"], "decision": "keep", "reason": "x", "cadence_days": 30, "confirmed": True},
                   headers=as_user("decider"))
    assert again.status_code == 409 and again.json()["code"] == "intercom_duplicate_command" and len(sent(fake, diag.DECIDE)) == 1


def test_a_stale_review_is_refused_with_wiskeys_reason(dx):
    fake, c, s = dx
    r = decide(c, latest_id=OLD)
    assert r.status_code == 409 and r.json()["code"] == "diag_review_stale" and r.json()["details"]["outcome"] == "refused"
    assert len(sent(fake, diag.DECIDE)) == 1
    outcome = json.loads(audit_rows(s, "intercom.access_review_decide")[-1]["details_json"])
    assert outcome["phase"] == "outcome" and outcome["wiskey_code"] == "access_review_stale"


def test_the_decision_gates(dx):
    fake, c, _s = dx
    assert decide(c, user="viewer").status_code == 403, "no people.manage anywhere: refused before the body"
    r = decide(c, station_id="entry-c")
    assert r.status_code == 403 and r.json()["details"]["outcome"] == "not_sent", "people.manage denied on the station"
    assert decide(c, reason="   ").status_code == 422
    assert decide(c, decision="revoke").status_code == 422 and decide(c, cadence_days=0).status_code == 422
    assert decide(c, fingerprint="xyz").status_code == 422
    assert not sent(fake, diag.DECIDE)
    # WisKey refuses the add-on's identity: 403 with the deep-link wording, the outcome audited
    fake.fail_with[diag.DECIDE] = "unauthorized"
    r = decide(c)
    assert r.status_code == 403 and r.json()["code"] == "diag_decide_not_allowed" and len(sent(fake, diag.DECIDE)) == 1


def test_a_decision_wiskey_does_not_offer_is_not_sent(dx):
    fake, c, s = dx
    fake.unlist(diag.DECIDE)
    intercom_sync.SYNC.reset()
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    r = decide(c)
    assert r.status_code == 409 and r.json()["code"] == "diag_decide_unsupported" and r.json()["details"]["outcome"] == "not_sent"
    assert not sent(fake, diag.DECIDE)


# ---------------------------------------------------------------- quality, lifecycle, sync, permission audit

def test_quality_names_the_problem_never_the_value_and_the_employee_number_follows_the_setting(dx):
    _fake, c, s = dx
    body = get(c, "/quality", user="viewer").json()["quality"]
    assert body["summary"] == {"people": 2, "missing": 1, "invalid": 0, "duplicate": 2}
    first = body["records"][0]
    assert [i["code"] for i in first["issues"]] == ["missing_phone", "duplicate_display_name"] and first["employee_no"] == "1001"
    assert first["issues"][1]["related_people"] == [{"id": "u2", "display_name": "יוסי לוי", "archived": False, "employee_no": "1002"}]
    with Database(s.db_path).connection() as conn:
        conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES (?, 'true')", (ia.EMPLOYEE_NO_SENSITIVE,))
    hidden = get(c, "/quality", user="viewer").json()["quality"]
    assert hidden["records"][0]["employee_no"] is None and hidden["records"][0]["issues"][1]["related_people"][0]["employee_no"] is None
    assert get(c, "/quality", user="root").json()["quality"]["records"][0]["employee_no"] == "1001", "people.sensitive shows it"
    assert get(c, "/quality", offset=50).status_code == 422, "a continuation page needs the first page's snapshot"


def test_lifecycle_lists_who_loses_access_without_phones_pins_or_card_digits(dx):
    fake, c, _s = dx
    body = get(c, "/lifecycle", user="viewer", days=7).json()["lifecycle"]
    assert sent(fake, diag.LIFECYCLE)[-1]["warning_days"] == 7
    assert [(r["id"], r["state"]) for r in body["expirations"]] == [("u1", "expiring"), ("u3", "expired")]
    assert body["expirations"][0]["seconds_remaining"] == 518400 and body["summary"]["expiring"] == 1
    assert body["duplicates"] == [{"reason": "card_last4", "users": [{"id": "u1", "display_name": "דנה כהן"}, {"id": "u2", "display_name": "יוסי לוי"}]}]
    assert body["without_credentials"] is None, "credential kinds are sensitive"
    assert body["temporary"]["users"][0]["expiring_soon"] is True
    no_secrets(body)
    assert get(c, "/lifecycle", user="root").json()["lifecycle"]["without_credentials"][0]["id"] == "u2"
    assert get(c, "/lifecycle", days=0).status_code == 422 and get(c, "/lifecycle", days=366).status_code == 422


def test_sync_diagnostics_drop_the_person_references(dx):
    _fake, c, _s = dx
    body = get(c, "/sync", user="reader").json()["diagnostics"]
    assert body["integration_version"] == "2.0.1-rc.10" and [x["state"] for x in body["stations"]] == ["synced", "error"]
    assert body["recent"][0]["outcome"] == "succeeded" and body["failures"] == {"authentication_failed": 1}
    no_secrets(body)


def test_the_permission_audit_reads_the_station_once_and_never_shows_values(dx):
    fake, c, s = dx
    body = get(c, "/stations/entry-a/permission-audit", user="viewer").json()
    rep = body["audit"]
    assert rep["counts"] == {"drift": 1, "matched": 1, "unmanaged": 1, "unverified": 0} and rep["device_writes"] == 0
    assert rep["rows"][1]["differences"] == ["cards", "pin", "validity"] and rep["rows"][2]["employee_no"] == "9999"
    text = json.dumps(body)
    assert '"plan"' not in text and "change" not in text
    rows = audit_rows(s, "intercom.permission_audit")
    assert len(rows) == 1 and rows[0]["resource_id"] == "entry-a" and json.loads(rows[0]["details_json"])["counts"]["drift"] == 1
    again = get(c, "/stations/entry-a/permission-audit")
    assert again.status_code == 429 and again.json()["code"] == "diag_audit_cooldown" and len(sent(fake, diag.AUDIT)) == 1
    off = get(c, "/stations/entry-b/permission-audit")
    assert off.status_code == 409 and off.json()["code"] == "intercom_station_offline" and len(sent(fake, diag.AUDIT)) == 1
    fake.fail_with[diag.AUDIT] = "device_busy"
    busy = get(c, "/stations/entry-c/permission-audit").json()
    assert busy["state"] != "ready" and busy["audit"] is None


def test_unknown_values_and_extra_fields_are_dropped():
    raw = {"left": {"kind": "person", "id": "u1", "name": "a", "phone": "+972500000001", "x": 1}, "right": {"kind": "alien", "id": "bad id!", "name": 5},
           "rows": [{"station_id": "entry-a", "station_name": "A", "lock_id": 3, "relation": "shared", "left": {}, "right": {}},
                    {"station_id": "entry-a", "station_name": "A", "lock_id": 1, "relation": "telepathy", "left": {"source": "magic", "override": "maybe"}, "right": {}}],
           "summary": {"shared": "many"}}
    out = diag.project_compare(raw)
    assert out["right"] == {"kind": "unknown", "id": None, "name": "", "enabled": False}
    assert len(out["rows"]) == 1 and out["rows"][0]["relation"] == "unknown" and out["rows"][0]["left"]["source"] == "unknown" and out["rows"][0]["left"]["override"] == "unknown"
    assert "phone" not in json.dumps(out) and out["summary"]["shared"] == 0
    with pytest.raises(ValueError):
        diag.project_scenario({"desired": None})
    with pytest.raises(ValueError):
        diag.project_preview({"fingerprint": "short"})
    assert diag.project_sync({"stations": [{"station_ref": "not-a-ref"}], "recent": "x"})["stations"] == []


def test_the_audit_gate_limits_one_station_at_a_time():
    gate = diag.AuditGate()
    assert gate.admit("a") is None
    assert gate.admit("a")[0] == "diag_audit_busy"
    assert gate.admit("b") is None and gate.admit("c")[0] == "diag_audit_busy", "at most two at once"
    gate.done("a")
    assert gate.admit("a")[0] == "diag_audit_cooldown"
