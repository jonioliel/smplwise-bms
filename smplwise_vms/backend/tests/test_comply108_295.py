"""COMPLY108-295 (docs/changes/CR-COMPLY108.md), FAKES ONLY: the compliance export - who COULD enter which door, and when.

Over the same identity-matrix harness as tests/test_intercom_adapter.py (the fake WisKey directory, tests/fake_wiskey.py): nothing here
contacts a device, a station, a door, Home Assistant or WisKey. Times are explicit (`at=` / `start=` `end=`) so no clock is needed.
Reference calendar: 2026-11-01 is a Sunday (Asia/Jerusalem is UTC+2 then): Dana (u1) may enter entry-a Sunday and Monday 08:00-17:00
local = 06:00-15:00Z."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from conftest import as_user, bind
from fake_wiskey import FakeWiskey
from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from test_intercom_adapter import ac, audit_rows, set_policy  # noqa: F401 - `ac` is a fixture

from smplwise.db import Database, new_id, now_iso
from smplwise.services import access_grants as ag
from smplwise.services import compliance_export as ce

API = "/api/v1/compliance/access"
SUN = "2026-11-01"
Z = timezone.utc


@pytest.fixture(autouse=True)
def _fresh_rate():
    ce.reset_rate()
    yield
    ce.reset_rate()


def person(fake: FakeWiskey, uid: str) -> dict[str, Any]:
    return next(p for p in fake.directory or [] if p["id"] == uid)


def on(s: Any) -> None:
    set_policy(s, ce.FLAG_KEY, "on")


def matrix(c: Any, user: str = "root", **params: Any) -> dict[str, Any]:
    r = c.get(f"{API}/matrix", headers=as_user(user), params=params)
    assert r.status_code == 200, (user, params, r.status_code, r.text)
    return r.json()


def pairs(m: dict[str, Any]) -> set[tuple[str, str]]:
    return {(r["person_id"], r["station_id"]) for r in m["rows"] if r["could_enter"]}


def spans(m: dict[str, Any], uid: str, sid: str) -> list[tuple[str, str]]:
    return [(i["from"], i["to"]) for r in m["rows"] if (r["person_id"], r["station_id"]) == (uid, sid) for i in r["intervals"]]


def insert(s: Any, sql: str, args: tuple) -> None:
    db = Database(s.db_path)
    with db.connection() as conn:
        conn.execute(sql, args)


# ---------------------------------------------------------------- the evaluator (pure)

def test_schedule_intervals_weekly_dst_and_midnight():
    sched = {"mode": "weekly", "timezone": "Asia/Jerusalem", "days": ["Sunday"], "dates": [], "periods": [{"start": "22:00", "end": "24:00"}]}
    got = ce.schedule_intervals(sched, (datetime(2026, 11, 1, 0, 0, tzinfo=Z), datetime(2026, 11, 3, 0, 0, tzinfo=Z)))
    assert got == [(datetime(2026, 11, 1, 20, 0, tzinfo=Z), datetime(2026, 11, 1, 22, 0, tzinfo=Z))], "22:00-24:00 local winter time"
    summer = ce.schedule_intervals({**sched, "days": ["saturday"]}, (datetime(2026, 7, 4, 0, 0, tzinfo=Z), datetime(2026, 7, 6, 0, 0, tzinfo=Z)))
    assert summer == [(datetime(2026, 7, 4, 19, 0, tzinfo=Z), datetime(2026, 7, 4, 21, 0, tzinfo=Z))], "UTC+3 in summer, weekday names in any case"


def test_schedule_intervals_dates_mode_and_unreadable():
    dates = {"mode": "dates", "timezone": "UTC", "days": [], "dates": ["2026-11-02"], "periods": [{"start": "09:00", "end": "10:30"}]}
    got = ce.schedule_intervals(dates, (datetime(2026, 11, 1, 0, 0, tzinfo=Z), datetime(2026, 11, 4, 0, 0, tzinfo=Z)))
    assert got == [(datetime(2026, 11, 2, 9, 0, tzinfo=Z), datetime(2026, 11, 2, 10, 30, tzinfo=Z))]
    for bad in ({**dates, "timezone": "Not/AZone"}, {**dates, "mode": "monthly"}, {**dates, "periods": []}, {**dates, "periods": [{"start": "10:00", "end": "09:00"}]}):
        with pytest.raises(ce.ScheduleUnreadable):
            ce.schedule_intervals(bad, (datetime(2026, 11, 1, tzinfo=Z), datetime(2026, 11, 4, tzinfo=Z)))


def test_merge_and_intersect():
    a, b, c = (datetime(2026, 1, 1, h, tzinfo=Z) for h in (1, 2, 3))
    assert ce.merge([(a, b), (b, c)]) == [(a, c)] and ce.intersect([(a, c)], [(b, c)]) == [(b, c)] and ce.intersect([(a, b)], [(c, c + timedelta(hours=1))]) == []


# ---------------------------------------------------------------- the gate

def test_denied_without_the_export_permission_and_audited(ac):
    _fake, c, s = ac
    on(s)
    for user in ("vera", "otto", "sara", "nobody"):
        r = c.get(f"{API}/matrix", headers=as_user(user), params={"at": f"{SUN}T07:00:00Z"})
        assert r.status_code == 403 and r.json()["code"] == "forbidden", user
        assert c.get(f"{API}/matrix.csv", headers=as_user(user)).status_code == 403
    rows = audit_rows(s, "access.events.export")
    assert rows and rows[-1]["decision"] == "denied"


def test_off_by_default_and_the_switch_is_for_the_system_administrator(ac):
    _fake, c, s = ac
    r = c.get(f"{API}/matrix", headers=as_user("root"))
    assert r.status_code == 404 and r.json()["code"] == "compliance_export_off"
    assert audit_rows(s, "compliance.access_matrix.export")[-1]["reason"] == "feature_off"
    assert c.get(f"{API}/settings", headers=as_user("root")).json() == {"compliance_export": "off"}
    assert c.put(f"{API}/settings", headers=as_user("sam"), json={"compliance_export": "on"}).status_code == 403, "a site administrator cannot switch it"
    assert c.put(f"{API}/settings", headers=as_user("root"), json={"compliance_export": "on"}).json() == {"compliance_export": "on"}
    assert audit_rows(s, "settings.changed")[-1]["decision"] == "allowed"
    assert c.get(f"{API}/matrix", headers=as_user("root"), params={"at": f"{SUN}T07:00:00Z"}).status_code == 200


def test_a_non_interactive_client_is_refused(ac, monkeypatch):
    _fake, c, s = ac
    on(s)
    monkeypatch.setattr(ag, "_interactive", lambda p: False)
    r = c.get(f"{API}/matrix", headers=as_user("root"))
    assert r.status_code == 403 and r.json()["code"] == "compliance_interactive_required"
    assert audit_rows(s, "compliance.access_matrix.export")[-1]["reason"] == "not_interactive"


def test_one_export_a_minute_per_user(ac):
    _fake, c, s = ac
    on(s)
    assert c.get(f"{API}/matrix", headers=as_user("root"), params={"at": f"{SUN}T07:00:00Z"}).status_code == 200
    r = c.get(f"{API}/matrix.csv", headers=as_user("root"), params={"at": f"{SUN}T07:00:00Z"})
    assert r.status_code == 429 and r.json()["code"] == "export_rate"


def test_the_range_is_validated(ac):
    _fake, c, s = ac
    on(s)
    ce.reset_rate()
    bad = [{"start": f"{SUN}T00:00:00Z"}, {"at": f"{SUN}T00:00:00Z", "start": f"{SUN}T00:00:00Z", "end": "2026-11-02T00:00:00Z"},
           {"start": "2026-11-02T00:00:00Z", "end": f"{SUN}T00:00:00Z"}, {"start": "2026-01-01T00:00:00Z", "end": "2026-12-31T00:00:00Z"},
           {"at": "2026-11-01T07:00:00"}, {"at": "yesterday"}]
    codes = []
    for params in bad:
        r = c.get(f"{API}/matrix", headers=as_user("root"), params=params)
        assert r.status_code == 422, (params, r.text)
        codes.append(r.json()["code"])
    assert codes[:4] == ["compliance_period_incomplete", "compliance_range_ambiguous", "compliance_period_invalid", "compliance_period_too_long"]


# ---------------------------------------------------------------- time windows, validity, revocation

def test_a_person_with_a_daily_hours_schedule_appears_only_inside_it(ac):
    _fake, c, s = ac
    on(s)
    inside = matrix(c, at=f"{SUN}T07:00:00Z")  # 09:00 local, Sunday
    assert ("u1", "entry-a") in pairs(inside) and inside["kind"] == "point" and inside["notice"]
    ce.reset_rate()
    after = matrix(c, at=f"{SUN}T16:00:00Z")  # 18:00 local
    assert ("u1", "entry-a") not in pairs(after)
    ce.reset_rate()
    tuesday = matrix(c, at="2026-11-03T07:00:00Z")
    assert ("u1", "entry-a") not in pairs(tuesday), "not a scheduled weekday"
    ce.reset_rate()
    why = matrix(c, at=f"{SUN}T16:00:00Z", include_excluded=True)
    row = next(r for r in why["rows"] if r["person_id"] == "u1" and r["station_id"] == "entry-a")
    assert row["could_enter"] is False and row["reason"] == "outside_schedule" and row["schedule"]["mode"] == "weekly"


def test_the_period_view_gives_the_exact_intervals(ac):
    _fake, c, s = ac
    on(s)
    m = matrix(c, start=f"{SUN}T00:00:00Z", end="2026-11-04T00:00:00Z")
    assert m["kind"] == "period" and m["from"] == f"{SUN}T00:00:00Z"
    assert spans(m, "u1", "entry-a") == [(f"{SUN}T06:00:00Z", f"{SUN}T15:00:00Z"), ("2026-11-02T06:00:00Z", "2026-11-02T15:00:00Z")]
    # a person without a schedule can enter for the whole asked period
    assert spans(m, "u2", "entry-b") == [(f"{SUN}T00:00:00Z", "2026-11-04T00:00:00Z")]
    # a period clipped by the person's validity
    ce.reset_rate()
    person(_fake, "u2")["valid_until"] = "2026-11-02T12:00:00+00:00"
    person(_fake, "u2")["valid_from"] = "2026-11-01T10:00:00+00:00"
    clipped = matrix(c, start=f"{SUN}T00:00:00Z", end="2026-11-04T00:00:00Z")
    assert spans(clipped, "u2", "entry-b") == [(f"{SUN}T10:00:00Z", "2026-11-02T12:00:00Z")]


def test_expired_revoked_inactive_and_archived_are_excluded(ac):
    fake, c, s = ac
    on(s)
    person(fake, "u2")["valid_until"] = "2026-10-01T00:00:00+00:00"       # expired
    person(fake, "u5")["active"] = False                                    # revoked / switched off
    person(fake, "u1")["assignments"]["entry-a"]["enabled"] = False         # the station revoked
    person(fake, "u4")["archived_at"] = "2026-10-02T00:00:00+00:00"        # archived
    m = matrix(c, at=f"{SUN}T07:00:00Z")
    assert pairs(m) == set(), "nobody is left who could enter"
    ce.reset_rate()
    why = matrix(c, at=f"{SUN}T07:00:00Z", include_excluded=True)
    reasons = {(r["person_id"], r["station_id"]): r["reason"] for r in why["rows"]}
    assert reasons[("u2", "entry-b")] == "expired" and reasons[("u5", "entry-a")] == "inactive" and reasons[("u4", "entry-c")] == "archived"
    assert ("u1", "entry-a") not in reasons, "a disabled assignment is no assignment"
    assert ("u3", "entry-a") not in reasons and not [k for k in reasons if k[0] == "u3"], "nobody with no station appears"


def test_a_validity_that_starts_later_is_not_yet_valid(ac):
    fake, c, s = ac
    on(s)
    person(fake, "u2")["valid_from"] = "2026-12-01T00:00:00+00:00"
    m = matrix(c, at=f"{SUN}T07:00:00Z", include_excluded=True)
    assert next(r for r in m["rows"] if r["person_id"] == "u2")["reason"] == "not_yet_valid"


def test_a_draft_schedule_is_not_in_force_and_an_unreadable_one_never_narrows(ac):
    fake, c, s = ac
    on(s)
    u1 = person(fake, "u1")
    u1["access_timing_draft"], u1["access_timing_policy"] = u1["access_timing_policy"]["schedule"], None  # a proposal only
    m = matrix(c, at=f"{SUN}T16:00:00Z")
    row = next(r for r in m["rows"] if r["person_id"] == "u1")
    assert row["could_enter"] and "schedule_draft_ignored" in row["flags"]
    ce.reset_rate()
    u1["access_timing_policy"] = {"mode": "ha", "schedule": {"mode": "weekly", "timezone": "Nowhere/Land", "days": ["sunday"], "dates": [], "periods": [{"start": "08:00", "end": "09:00"}]}, "bindings": {}}
    row = next(r for r in matrix(c, at=f"{SUN}T16:00:00Z")["rows"] if r["person_id"] == "u1")
    assert row["could_enter"] and "schedule_unreadable" in row["flags"], "an audit export must not under-report"


# ---------------------------------------------------------------- group inheritance, personal allow, sync flags

def test_group_inheritance_and_personal_allow_are_labelled(ac):
    fake, c, s = ac
    on(s)
    insert(s, "INSERT INTO access_station_permissions(id, wiskey_person_id, station_id, effect, relays_json, sync_state, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
           (new_id(), "u5", "entry-c", "allow", "[1]", "applied", now_iso(), now_iso()))
    m = matrix(c, at=f"{SUN}T07:00:00Z")
    by = {(r["person_id"], r["station_id"]): r for r in m["rows"]}
    assert by[("u2", "entry-b")]["source"] == "group" and by[("u2", "entry-b")]["groups"] == ["Staff"]
    assert by[("u1", "entry-a")]["source"] == "group"
    assert by[("u5", "entry-c")]["source"] == "personal"
    assert by[("u5", "entry-a")]["source"] == "direct" and by[("u5", "entry-a")]["groups"] == []
    assert by[("u1", "entry-a")]["doors"] == [1, 2]


def test_an_arx_deny_that_wiskey_still_enables_is_flagged_not_resolved(ac):
    fake, c, s = ac
    on(s)
    insert(s, "INSERT INTO access_station_permissions(id, wiskey_person_id, station_id, effect, relays_json, sync_state, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
           (new_id(), "u2", "entry-b", "deny", "[]", "pending", now_iso(), now_iso()))
    row = next(r for r in matrix(c, at=f"{SUN}T07:00:00Z")["rows"] if r["person_id"] == "u2")
    assert row["could_enter"] and "arx_deny_recorded_but_enabled" in row["flags"]


def test_a_station_still_syncing_is_flagged(ac):
    _fake, c, s = ac
    on(s)
    row = next(r for r in matrix(c, at=f"{SUN}T07:00:00Z")["rows"] if (r["person_id"], r["station_id"]) == ("u4", "entry-c"))
    assert "device_sync_pending" in row["flags"]


# ---------------------------------------------------------------- station scope

def test_a_station_scoped_exporter_sees_only_that_station(ac, station_scope):  # noqa: F811
    fake, c, s = ac
    on(s)
    c.get("/api/v1/me", headers=as_user("sita"))
    station_scope.bind("dev-sita", "site_admin", "entry-a")
    m = matrix(c, "sita", at=f"{SUN}T07:00:00Z")
    assert {r["station_id"] for r in m["rows"]} == {"entry-a"}
    assert {r["person_id"] for r in m["rows"]} == {"u1", "u5"}, "only the people of the station she can see"
    ce.reset_rate()
    r = c.get(f"{API}/matrix", headers=as_user("sita"), params={"station_id": "entry-b"})
    assert r.status_code == 404 and r.json()["code"] == "compliance_station_not_found", "a station she cannot export looks like a missing one"


def test_a_deny_on_a_station_removes_its_rows(ac):
    fake, c, s = ac
    on(s)
    m = matrix(c, "sam", at=f"{SUN}T07:00:00Z")  # site_admin everywhere, DENIED on entry-b
    assert "entry-b" not in {r["station_id"] for r in m["rows"]}
    assert {"entry-a", "entry-c"} <= {r["station_id"] for r in m["rows"]}


def test_the_station_and_group_filters_narrow(ac):
    _fake, c, s = ac
    on(s)
    m = matrix(c, station_id="entry-b", at=f"{SUN}T07:00:00Z")
    assert {r["station_id"] for r in m["rows"]} == {"entry-b"} and "u2" in {r["person_id"] for r in m["rows"]}
    ce.reset_rate()
    g = matrix(c, group="night", at=f"{SUN}T07:00:00Z")
    assert {r["person_id"] for r in g["rows"]} == {"u4"}


# ---------------------------------------------------------------- external grant, door windows

def _grant(s: Any, person_id: str, valid_from: str, valid_until: str, state: str = "active") -> None:
    link = new_id()
    insert(s, "INSERT INTO access_person_links(id, subject_kind, subject_id, wiskey_person_id, origin, linked_by, linked_at) VALUES (?,?,?,?,?,?,?)",
           (link, "contact", "contact-1", person_id, "matched", "test", now_iso()))
    insert(s, """INSERT INTO access_grants(id, subject_kind, subject_id, link_id, source_kind, doors_json, valid_from, valid_until, credential, state, requested_by,
                 created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
           (new_id(), "contact", "contact-1", link, "manual", json.dumps({"entry-a": [1]}), valid_from, valid_until, "pin", state, "test", now_iso(), now_iso()))


def test_an_external_grant_limits_the_person_to_its_window(ac):
    _fake, c, s = ac
    on(s)
    _grant(s, "u5", "2026-11-05T08:00:00Z", "2026-11-05T12:00:00Z")
    m = matrix(c, start="2026-11-05T00:00:00Z", end="2026-11-06T00:00:00Z")
    assert spans(m, "u5", "entry-a") == [("2026-11-05T08:00:00Z", "2026-11-05T12:00:00Z")]
    row = next(r for r in m["rows"] if r["person_id"] == "u5")
    assert row["source"] == "external_grant" and row["external_grant"]["state"] == "active"
    ce.reset_rate()
    assert "u5" not in {r["person_id"] for r in matrix(c, at="2026-11-05T13:00:00Z")["rows"]}


def test_a_grant_that_is_only_requested_does_not_let_anyone_in_or_narrow(ac):
    _fake, c, s = ac
    on(s)
    _grant(s, "u5", "2026-11-05T08:00:00Z", "2026-11-05T12:00:00Z", state="requested")
    row = next(r for r in matrix(c, at="2026-11-05T13:00:00Z")["rows"] if r["person_id"] == "u5")
    assert row["could_enter"] and row["external_grant"] is None and row["source"] != "external_grant"


def test_hold_open_windows_are_listed_per_visible_station(ac, station_scope):  # noqa: F811
    _fake, c, s = ac
    on(s)
    for sid in ("entry-a", "entry-b"):
        insert(s, """INSERT INTO door_window_occurrences(id, station_id, relay, start_at, end_at, zone, token, origin, tier, state, created_at, updated_at)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""", (new_id(), sid, 1, f"{SUN}T05:00:00Z", f"{SUN}T06:00:00Z", "Asia/Jerusalem", f"{SUN}/07:00/08:00", "weekly", "prepared", "planned", now_iso(), now_iso()))
    insert(s, """INSERT INTO door_window_occurrences(id, station_id, relay, start_at, end_at, zone, token, origin, tier, state, created_at, updated_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""", (new_id(), "entry-a", 2, f"{SUN}T05:00:00Z", f"{SUN}T06:00:00Z", "Asia/Jerusalem", f"{SUN}/07:00/08:30", "weekly", "prepared", "cancelled", now_iso(), now_iso()))
    c.get("/api/v1/me", headers=as_user("sita"))
    station_scope.bind("dev-sita", "site_admin", "entry-a")
    root = matrix(c, start=f"{SUN}T00:00:00Z", end="2026-11-02T00:00:00Z")
    assert sorted((w["station_id"], w["door"], w["state"]) for w in root["door_windows"]) == [("entry-a", 1, "planned"), ("entry-b", 1, "planned")], "a cancelled window is not free passage"
    ce.reset_rate()
    sita = matrix(c, "sita", start=f"{SUN}T00:00:00Z", end="2026-11-02T00:00:00Z")
    assert [w["station_id"] for w in sita["door_windows"]] == ["entry-a"]


# ---------------------------------------------------------------- output, audit, privacy

NEVER = ("+9725", "1234", "card-u", "masked", "pin_configured", "Engineering", "phone", "credentials", "photo", "profile", "192.0.2.10", "last_access")


def test_no_secret_or_credential_in_json_or_csv(ac):
    fake, c, s = ac
    on(s)
    m = c.get(f"{API}/matrix", headers=as_user("root"), params={"start": f"{SUN}T00:00:00Z", "end": "2026-11-04T00:00:00Z", "include_excluded": "true"})
    assert m.status_code == 200
    ce.reset_rate()
    csv_r = c.get(f"{API}/matrix.csv", headers=as_user("root"), params={"start": f"{SUN}T00:00:00Z", "end": "2026-11-04T00:00:00Z", "include_excluded": "true"})
    assert csv_r.status_code == 200
    for text in (m.text, csv_r.content.decode("utf-8")):
        for marker in NEVER:
            assert marker not in text, marker
    keys = {k for r in m.json()["rows"] for k in r}
    assert keys == {"person_id", "display_name", "employee_no", "category", "station_id", "station", "doors", "source", "groups", "schedule", "valid_from",
                    "valid_until", "external_grant", "could_enter", "intervals", "reason", "flags"}, "minimal fields only"


def test_csv_format_header_bom_and_formula_guard(ac):
    fake, c, s = ac
    on(s)
    person(fake, "u2")["display_name"] = "=HYPERLINK(1)"
    r = c.get(f"{API}/matrix.csv", headers=as_user("root"), params={"start": f"{SUN}T00:00:00Z", "end": "2026-11-03T00:00:00Z"})
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv") and r.headers["cache-control"] == "private, no-store"
    raw = r.content
    assert raw.startswith(b"\xef\xbb\xbf")
    lines = raw.decode("utf-8-sig").split("\r\n")
    assert lines[0] == ",".join(f'"{col}"' for col in ce.COLUMNS)
    assert int(r.headers["x-export-rows"]) <= len(lines) - 2
    assert any('"\'=HYPERLINK(1)"' in line for line in lines), "a formula cell is neutralised"
    dana = [ln for ln in lines if '"u1"' in ln]
    assert len(dana) == 2 and all('"entry-a"' in ln and '"true"' in ln for ln in dana), "one line per interval"


def test_the_export_is_audited_with_counts_only(ac):
    _fake, c, s = ac
    on(s)
    m = matrix(c, start=f"{SUN}T00:00:00Z", end="2026-11-03T00:00:00Z", station_id="entry-a")
    rows = audit_rows(s, "compliance.access_matrix.export")
    assert len(rows) == 1 and rows[0]["decision"] == "allowed" and rows[0]["actor_user_id"] == "dev-root"
    details = json.loads(rows[0]["details_json"])
    assert details["rows"] == len(m["rows"]) and details["kind"] == "period" and details["station_filter"] is True and details["format"] == "json"
    blob = json.dumps(rows[0])
    for name in ("Dana", "Avi", "Noa", "Lior"):
        assert name not in blob, "ids and counts only: never a name or a row"


def test_an_unreadable_source_refuses_instead_of_returning_a_short_list(ac):
    fake, c, s = ac
    on(s)
    fake.forbidden = {"users/query"}
    r = c.get(f"{API}/matrix", headers=as_user("root"), params={"at": f"{SUN}T07:00:00Z"})
    assert r.status_code == 503 and r.json()["code"].startswith("compliance_source_"), r.text
    assert not [a for a in audit_rows(s, "compliance.access_matrix.export") if a["decision"] == "allowed"]


def test_too_many_people_is_refused_not_truncated(ac, monkeypatch):
    _fake, c, s = ac
    on(s)
    monkeypatch.setattr(ce, "MAX_PEOPLE", 2)
    r = c.get(f"{API}/matrix", headers=as_user("root"), params={"at": f"{SUN}T07:00:00Z"})
    assert r.status_code == 413 and r.json()["code"] == "compliance_export_too_large"
    ce.reset_rate()
    monkeypatch.setattr(ce, "MAX_PEOPLE", 500)
    monkeypatch.setattr(ce, "MAX_ROWS", 2)
    assert c.get(f"{API}/matrix", headers=as_user("root"), params={"at": f"{SUN}T07:00:00Z"}).status_code == 413


def test_nothing_is_written_but_the_audit_row(ac):
    """Read-only: the export changes no person, grant, station permission or setting."""
    fake, c, s = ac
    on(s)
    db = Database(s.db_path)
    tables = ("access_grants", "access_person_links", "access_station_permissions", "door_window_rules", "door_window_occurrences", "settings")

    def counts() -> dict[str, int]:
        with db.connection(mode="read") as conn:
            return {t: conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in tables}

    before, sent_before = counts(), len(fake.received)
    matrix(c, start=f"{SUN}T00:00:00Z", end="2026-11-03T00:00:00Z")
    assert counts() == before
    writes = [m for m in fake.received[sent_before:] if str(m.get("type", "")).rsplit("/", 1)[-1] in ("update", "create", "delete", "set_station_access", "apply", "strip")]
    assert writes == [], "no write command reached WisKey"
