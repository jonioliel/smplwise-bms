"""CR-036 S12 (section 6.2): the parity report - GET /api/v1/access-control/parity - against the fake WisKey
(tests/fake_wiskey.py). Nothing here contacts a device, a station, Home Assistant or WisKey.

The three-identity matrix of CR-036 6.2 step 2 is run through the report itself: the system administrator (every screen the
same as the unfiltered read), an operator on ONE station (filtered, by the station-scope rule), a viewer (only the stations;
the rest not permitted) - plus the gates, the audit, the digests that never carry a name, a detected mismatch and a feature
the installed WisKey does not list."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import pytest
from conftest import as_user, bind
from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from test_intercom_adapter import ac, audit_rows, sent, wait_for  # noqa: F401 - ac is a fixture

from smplwise.services import intercom_adapter, intercom_parity

URL = "/api/v1/access-control/parity"
NAMES = ("Dana", "Avi", "Noa", "Lior", "Dan Avraham", "entry-a", "entry-b", "entry-c", "ev-7", "sch-1", "staff")


@pytest.fixture()
def pc(ac, monkeypatch):  # noqa: F811
    """`ac` plus sue (site_admin, installation: the status page without system.configure), and the entry-log window placed over
    the fake's seven events (2026-09-27 08:00-09:00 UTC)."""
    fake, c, s = ac
    bind(c, s, "sue", "site_admin", "installation", "*")
    monkeypatch.setattr(intercom_parity, "_now", lambda: datetime(2026, 9, 27, 12, 0, tzinfo=timezone.utc))
    return fake, c, s


def report(c: Any, user: str, **params: Any) -> dict[str, Any]:
    r = c.get(URL, headers=as_user(user), params=params)
    assert r.status_code == 200, (user, r.status_code, r.text)
    return r.json()


def rows(body: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {r["screen"]: r for r in body["parity"]["screens"]}


def test_the_system_administrator_sees_what_the_panel_shows(pc):
    _fake, c, _s = pc
    body = report(c, "root")
    assert body["state"] == "ready" and body["parity"]["subject"]["self"] is True
    by = rows(body)
    assert list(by) == ["stations", "people", "events", "groups", "schedules", "alerts"]
    for screen, row in by.items():
        assert row["outcome"] == "match", (screen, row)
        assert row["source"]["count"] == row["native"]["count"] == row["expected_count"], screen
        assert row["source"]["digest"] == row["native"]["digest"] and row["source"]["digest"], screen
    assert by["stations"]["source"]["count"] == 3 and by["people"]["source"]["count"] == 5 and by["events"]["source"]["count"] == 7
    assert by["groups"]["source"]["count"] == 3 and by["schedules"]["source"]["count"] == 1 and by["alerts"]["source"]["count"] == 3
    assert body["parity"]["summary"]["match"] == 6


def test_an_operator_on_one_station_is_filtered_by_the_station_scope(pc):
    _fake, c, _s = pc
    by = rows(report(c, "root", as_user="dev-sara"))
    assert by["stations"]["outcome"] == "filtered" and by["stations"]["rule"] == "station_scope"
    assert (by["stations"]["source"]["count"], by["stations"]["native"]["count"]) == (3, 1)
    # Dana (entry-a + entry-b) and Dan Avraham (entry-a + entry-c) are visible through entry-a; Noa (no station) is not
    assert by["people"]["outcome"] == "filtered" and by["people"]["native"]["count"] == by["people"]["expected_count"] == 2
    assert by["events"]["outcome"] == "filtered" and by["events"]["native"]["count"] == 2  # ev-7 and ev-4 on entry-a
    assert by["groups"]["outcome"] in ("filtered", "match") and by["groups"]["native"]["count"] == by["groups"]["expected_count"]
    assert by["schedules"]["outcome"] == "filtered" and by["schedules"]["rule"] == "installation_wide" and by["schedules"]["native"]["count"] == 0
    assert by["alerts"]["outcome"] == "not_permitted" and by["alerts"]["rule"] == "permission" and by["alerts"]["native"] is None
    assert all(r["outcome"] != "mismatch" for r in by.values())


def test_a_viewer_gets_the_stations_only(pc):
    _fake, c, _s = pc
    by = rows(report(c, "root", as_user="dev-vera"))
    assert by["stations"]["outcome"] == "match"
    for screen in ("people", "events", "groups", "schedules", "alerts"):
        assert by[screen]["outcome"] == "not_permitted" and by[screen]["native"] is None, screen


def test_gates(pc):
    _fake, c, s = pc
    for user in ("otto", "vera", "sara"):  # no access.admin.read at all
        r = c.get(URL, headers=as_user(user))
        assert r.status_code == 403 and r.json()["code"] == "forbidden", user
    r = c.get(URL, headers=as_user("sam"))  # site_admin with a deny on entry-b: the unfiltered side is installation-wide
    assert r.status_code == 403 and r.json()["details"]["reason"] == "station_scoped"
    assert report(c, "sue")["parity"]["subject"]["user_id"] == "dev-sue", "a site administrator of every station may run their own report"
    r = c.get(URL, headers=as_user("sue"), params={"as_user": "dev-sara"})
    assert r.status_code == 403 and r.json()["details"]["permission"] == "system.configure", "another user's view needs system.configure"
    assert c.get(URL, headers=as_user("root"), params={"as_user": "dev-nobody-here"}).status_code == 404
    assert c.get(URL, headers=as_user("root"), params={"hours": 0}).status_code == 422
    assert c.get(URL, headers=as_user("root"), params={"as_user": "bad/id"}).status_code == 422
    denied = [r for r in audit_rows(s, "system.configure") if r["actor_user_id"] == "dev-sue"]
    assert denied and denied[-1]["decision"] == "denied"


def test_counts_and_keyed_digests_only_and_an_audit_row_without_names(pc):
    _fake, c, s = pc
    body = report(c, "root", as_user="dev-sara")
    text = json.dumps(body, ensure_ascii=False)
    for marker in NAMES:
        assert marker not in text, marker
    row = audit_rows(s, "intercom.parity.report")[-1]
    assert row["actor_user_id"] == "dev-root" and row["decision"] == "allowed"
    details = json.loads(row["details_json"])
    assert details["subject"] == "dev-sara" and details["hours"] == 24 and details["outcomes"]["stations"] == "filtered"
    for marker in NAMES:
        assert marker not in json.dumps(details, ensure_ascii=False), marker
    # a digest is keyed: it is not the plain hash of the ids, so it cannot be matched against a guessed id list
    import hashlib

    plain = hashlib.sha256("\n".join(sorted(["entry-a", "entry-b", "entry-c"])).encode()).hexdigest()[:20]
    assert rows(report(c, "root"))["stations"]["source"]["digest"] != plain


def test_a_native_view_that_drops_a_row_is_a_mismatch(pc, monkeypatch):
    _fake, c, _s = pc
    real = intercom_adapter.ADAPTER.groups

    def lossy(settings, auth):
        reply = real(settings, auth)
        reply["groups"]["groups"] = reply["groups"]["groups"][1:]
        return reply

    monkeypatch.setattr(intercom_adapter.ADAPTER, "groups", lossy)
    by = rows(report(c, "root"))
    assert by["groups"]["outcome"] == "mismatch" and by["groups"]["native"]["count"] == 2 and by["groups"]["source"]["count"] == 3
    assert by["stations"]["outcome"] == "match"


def test_a_command_the_installed_wiskey_does_not_list_is_unsupported_and_not_sent(pc):
    fake, c, _s = pc
    fake.unlist("schedules/list")
    fake.push("refresh")
    wait_for(lambda: c.get("/api/v1/access-control/features", headers=as_user("root")).json()["features"]["schedules"]["available"] is False)
    before = len(sent(fake, "schedules/list"))
    by = rows(report(c, "root"))
    assert by["schedules"]["outcome"] == "unsupported" and by["schedules"]["reason"] == "not_listed"
    assert len(sent(fake, "schedules/list")) == before


def test_one_report_at_a_time(pc):
    _fake, c, _s = pc
    assert intercom_parity._RUNNING.acquire(blocking=False)
    try:
        r = c.get(URL, headers=as_user("root"))
        assert r.status_code == 409 and r.json()["code"] == "intercom_parity_busy"
    finally:
        intercom_parity._RUNNING.release()


def test_wiskey_not_answering_is_reported_per_screen_not_guessed(pc):
    fake, c, _s = pc
    fake.errors_once["users/query"] = "unauthorized"
    by = rows(report(c, "root"))
    assert by["people"]["outcome"] == "unavailable" and by["people"]["source"] is None and by["people"]["reason"]
    assert by["stations"]["outcome"] == "match"
