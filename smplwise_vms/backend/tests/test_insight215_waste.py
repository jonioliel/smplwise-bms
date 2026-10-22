"""CR-INSIGHT215 part 3: the waste detector - on in an empty room, on at night where emptiness cannot be judged, night consumption anomalies.

Negative first (switch off 404, no permission 403, unknown presence is never "empty", a protected switch is never listed, a short stretch is
not waste, an uncovered night is not an anomaly), then the numbers over an invented day with an injected clock, and the scope rule.
Fakes only: an invented state history and an energy store in the test's own directory; no Home Assistant, meter or device."""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient
from insight215_fixtures import API, area, audit_rows, entity, hist, iso, save_settings, switch

from smplwise.db import Database, now_iso
from smplwise.services import energy_store as st
from smplwise.services import insights_common as ic
from smplwise.services import insights_waste

UTC = dt.timezone.utc
D = dt.datetime(2026, 10, 12, tzinfo=UTC).timestamp()  # Monday, 00:00 UTC = 03:00 local (UTC+3)
NOW = D + 2 * 86400
RANGE = f"range=custom&from={iso(D)}&to={iso(D + 86400)}"
ERANGE = f"range=custom&from={iso(D + 12 * 3600)}&to={iso(D + 36 * 3600)}"  # holds the end of the night that starts on D


def h(hours: float) -> float:
    return D + hours * 3600


@pytest.fixture()
def w(settings, monkeypatch):
    from smplwise.main import create_app
    from smplwise.routers import insights as ir

    monkeypatch.setattr(ir, "now_ts", lambda: NOW)
    c = TestClient(create_app(settings))
    c.get(f"{API}/me")
    db = Database(settings.db_path)
    with db.connection() as conn:
        for a, n in (("meet", "חדר ישיבות"), ("lobby", "לובי"), ("store", "מחסן")):
            area(conn, a, n)
        entity(conn, "binary_sensor.meet_motion", "תנועה ישיבות", device_class="motion", area="meet")
        entity(conn, "light.meet", "תאורת ישיבות", area="meet")
        entity(conn, "climate.meet_ac", "מזגן ישיבות", area="meet")
        entity(conn, "light.lobby", "תאורת לובי", area="lobby")
        entity(conn, "switch.server", "שרת", area="lobby")
        entity(conn, "binary_sensor.store_motion", "תנועה מחסן", device_class="occupancy", area="store")
        entity(conn, "light.store", "תאורת מחסן", area="store")
        # meeting room: motion 09:00-09:10 local (06:00-06:10 UTC), the light on 06:00-09:00 UTC, the AC 06:00-06:40 UTC
        hist(conn, "binary_sensor.meet_motion", "off", h(0))
        hist(conn, "binary_sensor.meet_motion", "on", h(6))
        hist(conn, "binary_sensor.meet_motion", "off", h(6 + 10 / 60))
        hist(conn, "light.meet", "off", h(0))
        hist(conn, "light.meet", "on", h(6))
        hist(conn, "light.meet", "off", h(9))
        hist(conn, "climate.meet_ac", "off", h(0))
        hist(conn, "climate.meet_ac", "cool", h(6))
        hist(conn, "climate.meet_ac", "off", h(6 + 40 / 60))
        # lobby (no presence sensor): the light 23:00-02:30 local = 20:00-23:30 UTC; the protected server switch on all day
        hist(conn, "light.lobby", "off", h(0))
        hist(conn, "light.lobby", "on", h(20))
        hist(conn, "light.lobby", "off", h(23.5))
        hist(conn, "switch.server", "on", h(-1))
        conn.execute("INSERT INTO device_bulk_protected (entity_id, source, marked_at, reviewed) VALUES ('switch.server', 'manual', ?, 1)", (now_iso(),))
        # store room: the presence sensor is unavailable the whole time - the light on for hours is NOT waste (unknown is not empty)
        hist(conn, "binary_sensor.store_motion", "unavailable", h(0))
        hist(conn, "light.store", "on", h(1))
        hist(conn, "light.store", "off", h(10))
    return {"c": c, "db": db, "settings": settings}


def _on(w, doc=None) -> None:
    save_settings(w["db"], doc or {"waste": {"domains": ["light", "climate", "switch"]}})
    switch(w["db"], ic.SW_WASTE)


# ---------------------------------------------------------------- negative first

def test_off_is_404_and_no_permission_is_403(w):
    c, s = w["c"], w["settings"]
    assert c.get(f"{API}/insights/waste?{RANGE}").status_code == 404
    _on(w)
    bind(c, s, "otto", "operator", "installation", "*")
    assert c.get(f"{API}/insights/waste?{RANGE}", headers=as_user("otto")).status_code == 403
    assert any(r["decision"] == "denied" for r in audit_rows(w["db"], "insights.read"))


def test_unknown_presence_protected_switches_and_short_stretches_are_not_waste(w):
    _on(w)
    items = w["c"].get(f"{API}/insights/waste?{RANGE}").json()["devices"]["items"]
    names = {i["name"] for i in items}
    assert "תאורת מחסן" not in names, "a room whose sensor is unavailable is not empty"
    assert "שרת" not in names, "a protected switch is never listed"
    assert "מזגן ישיבות" not in names, "10 empty minutes is under min_waste_min (30)"


# ---------------------------------------------------------------- the numbers

def test_empty_room_and_after_hours(w):
    c, db = w["c"], w["db"]
    _on(w)
    body = c.get(f"{API}/insights/waste?{RANGE}").json()
    items = {i["name"]: i for i in body["devices"]["items"]}
    meet = items["תאורת ישיבות"]
    # occupied until 06:10 + the 20-minute decay = 06:30; on until 09:00 -> 150 empty minutes
    assert (meet["kind"], meet["minutes"], meet["segments"], meet["first_at"], meet["area"]) == ("empty_room", 150, 1, iso(h(6.5)), "חדר ישיבות")
    lobby = items["תאורת לובי"]
    assert (lobby["kind"], lobby["minutes"]) == ("after_hours", 210)
    assert body["devices"]["minutes"] == {"empty_room": 150, "after_hours": 210}
    assert [i["name"] for i in body["devices"]["items"]] == ["תאורת לובי", "תאורת ישיבות"], "most minutes first"
    text = json.dumps(body, ensure_ascii=False)
    assert "light." not in text and "binary_sensor." not in text and "climate." not in text
    assert json.loads(audit_rows(db, "insights.waste.read")[-1]["details_json"])["items"] == 2
    # the thresholds are settings: a longer decay leaves less waste; a later night start drops the lobby
    _on(w, {"waste": {"empty_after_min": 120, "night_from": "23:30"}})
    items = {i["name"]: i for i in c.get(f"{API}/insights/waste?{RANGE}").json()["devices"]["items"]}
    assert items["תאורת ישיבות"]["minutes"] == 50 and items["תאורת לובי"]["minutes"] == 180


def _energy(w, nights: dict[int, int], cover: int = 900) -> None:
    """Quarter-hour energy for the nights (22:00-06:00 local) that START on D + k days: {k: Wh per quarter hour}."""
    with w["db"].connection() as conn:
        conn.execute("""INSERT INTO energy_meters (id, source_kind, source_ref, display_name, unit, unit_factor, status, created_at, updated_at)
                        VALUES ('m1', 'ha_entity', 'sensor.main_energy', 'מונה ראשי', 'kWh', 1000, 'active', ?, ?)""", (now_iso(), now_iso()))
    store = st.store_at(Path(w["settings"].data_dir) / st.FILE_NAME)
    with store.db.connection() as conn:
        mid = conn.execute("INSERT INTO meter_map(ext_id) VALUES ('m1')").lastrowid
        for k, wh in nights.items():
            a = D + k * 86400 + 19 * 3600  # 22:00 local = 19:00 UTC
            for q in range(32):
                conn.execute("INSERT INTO intervals (meter_id, bucket, wh, covered_s, quality) VALUES (?, ?, ?, ?, 0)", (mid, int(a + q * 900), wh, cover))
    store.forget_ids()


def test_night_consumption_anomaly_against_the_same_weekday(w):
    c = w["c"]
    _on(w)
    _energy(w, {-7: 100, -14: 100, -21: 120, -28: 90, 0: 300})
    e = c.get(f"{API}/insights/waste?{ERANGE}").json()["energy"]
    assert e["available"] is True and e["meters"] == 1
    assert len(e["items"]) == 1
    a = e["items"][0]
    # baseline = median(3.2, 3.2, 3.84, 2.88) = 3.2 kWh; the night 9.6 kWh -> x3
    assert (a["name"], a["night"], a["kwh"], a["baseline_kwh"], a["ratio"], a["baseline_nights"]) == ("מונה ראשי", "2026-10-12", 9.6, 3.2, 3.0, 4)
    assert "sensor." not in json.dumps(e)


def test_no_anomaly_without_baseline_or_coverage_or_margin(w):
    c = w["c"]
    _on(w)
    _energy(w, {-7: 100, 0: 300})  # one baseline night only
    assert c.get(f"{API}/insights/waste?{ERANGE}").json()["energy"]["items"] == []


def test_uncovered_night_is_not_an_anomaly(w):
    c = w["c"]
    _on(w)
    _energy(w, {-7: 100, -14: 100, -21: 100, 0: 300}, cover=300)  # every quarter hour a third covered
    assert c.get(f"{API}/insights/waste?{ERANGE}").json()["energy"]["items"] == []


def test_the_margin_setting(w):
    c = w["c"]
    _on(w, {"waste": {"energy_min_kwh": 10}})
    _energy(w, {-7: 100, -14: 100, -21: 100, 0: 300})  # +6.4 kWh < 10
    assert c.get(f"{API}/insights/waste?{ERANGE}").json()["energy"]["items"] == []


def test_no_store_file_is_not_created_by_a_read(w):
    c, s = w["c"], w["settings"]
    _on(w)
    path = Path(s.data_dir) / st.FILE_NAME
    assert not path.exists()
    assert c.get(f"{API}/insights/waste?{ERANGE}").json()["energy"] == {"available": False, "items": [], "meters": 0}
    assert not path.exists()


# ---------------------------------------------------------------- scope

def test_floor_scope(w, monkeypatch):
    c, s = w["c"], w["settings"]
    _on(w)
    tree = seed_tree(c)
    bind(c, s, "fay", "site_admin", "floor", tree["floor2"])
    assert c.get(f"{API}/insights/waste?{RANGE}", headers=as_user("fay")).json()["devices"]["items"] == []
    from smplwise.services import ha_scope

    monkeypatch.setattr(ha_scope, "placements", lambda conn: {"light.meet": [{"floor_id": tree["floor2"], "floor_name": "קומה 2"}]})
    items = c.get(f"{API}/insights/waste?{RANGE}", headers=as_user("fay")).json()["devices"]["items"]
    assert [i["name"] for i in items] == ["תאורת ישיבות"]


def test_local_windows_cross_midnight_and_dst():
    tz = ic.zone("Asia/Jerusalem")
    # the autumn change night 2026-10-24/25: 22:00 local (UTC+3) to 06:00 local (UTC+2) is 9 hours
    a = dt.datetime(2026, 10, 24, 12, 0, tzinfo=UTC).timestamp()
    wins = ic.local_windows(a, a + 86400, tz, "22:00", "06:00")
    assert [(iso(x), iso(y)) for x, y in wins] == [("2026-10-24T19:00:00Z", "2026-10-25T04:00:00Z")]
    assert insights_waste._night_of(dt.date(2026, 10, 24), tz, "22:00", "06:00")[1] - insights_waste._night_of(dt.date(2026, 10, 24), tz, "22:00", "06:00")[0] == 9 * 3600
