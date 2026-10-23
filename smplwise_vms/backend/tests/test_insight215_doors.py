"""CR-INSIGHT215 part 2: "door opened without a matching entry event" and the insights settings.

Negative first: a switched-off part is the uniform 404 for everyone; no permission is the audited 403; the settings need insights.manage and a
switch needs system.configure as well; invalid settings name their fields. Then the classification over an invented state history (lock,
held unlocked, command, exit button, door window, unknown lock, chatter, an opening after a gap), the scope rule (a floor-scoped manager sees
only the doors placed on his floor) and the range rules - with an injected clock. Fakes only: no Home Assistant, door system or device."""
from __future__ import annotations

import json

import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient
from insight215_fixtures import API, NOW, T0, area, audit_rows, entity, hist, iso, save_settings, switch

from smplwise.db import Database, now_iso
from smplwise.services import insights_common as ic
from smplwise.services import insights_doors

FRONT, BACK, LOCK, REX = "binary_sensor.front_door", "binary_sensor.back_door", "lock.front", "binary_sensor.front_exit"
PAIRS = [{"sensor_entity_id": FRONT, "lock_entity_id": LOCK, "rex_entity_ids": [REX]}, {"sensor_entity_id": BACK}]


@pytest.fixture()
def w(settings, monkeypatch):
    from smplwise.main import create_app
    from smplwise.routers import insights as ir

    monkeypatch.setattr(ir, "now_ts", lambda: NOW)
    c = TestClient(create_app(settings))
    c.get(f"{API}/me")  # joni: the bootstrap system administrator
    db = Database(settings.db_path)
    with db.connection() as conn:
        area(conn, "lobby", "לובי")
        entity(conn, FRONT, "דלת כניסה", device_class="door", area="lobby")
        entity(conn, BACK, "דלת אחורית", device_class="door", area="lobby")
        entity(conn, LOCK, "מנעול כניסה", area="lobby", state="locked")
        entity(conn, REX, "לחצן יציאה", area="lobby")
        _history(conn)
    return {"c": c, "db": db, "settings": settings}


def _history(conn) -> None:
    """The invented day (seconds after T0):
    A 100   lock unlocked at 95 (relocked 110)          -> explained: lock
    B 1000  nothing, the lock known locked              -> UNEXPLAINED
    C 2000  exit button at 1995                          -> explained: rex
    D 3000  unlock command from the system at 2990       -> explained: command
    E 4000  the lock unavailable 3900..4100              -> unverifiable (lock unknown)
    F 5000  open for 1 s                                 -> chatter, not an opening
    G 6000  lock held unlocked since 5500 (until 6100)   -> explained: unlocked
    H 6500  the sensor unavailable before it went on     -> not an opening (no known closed state before)
    I 7000  a door window of the lock's relay 6900..7200 -> explained: window"""
    hist(conn, FRONT, "off", T0 - 3600)
    hist(conn, LOCK, "locked", T0 - 3600)
    hist(conn, REX, "off", T0 - 3600)
    for at, dur in ((100, 30), (1000, 20), (2000, 10), (3000, 15), (4000, 40), (5000, 1), (6000, 20), (7000, 10)):
        hist(conn, FRONT, "on", T0 + at)
        hist(conn, FRONT, "off", T0 + at + dur)
    hist(conn, FRONT, "unavailable", T0 + 6400)
    hist(conn, FRONT, "on", T0 + 6500)
    hist(conn, FRONT, "off", T0 + 6520)
    hist(conn, LOCK, "unlocked", T0 + 95)
    hist(conn, LOCK, "locked", T0 + 110)
    hist(conn, REX, "on", T0 + 1995)
    hist(conn, REX, "off", T0 + 1996)
    conn.execute("INSERT INTO ha_actions (id, entity_id, action_id, principal_user_id, client_request_id, status, requested_at) VALUES "
                 "('a1', ?, 'lock.unlock', 'u', 'r1', 'confirmed', ?)", (LOCK, iso(T0 + 2990)))
    conn.execute("INSERT INTO ha_actions (id, entity_id, action_id, principal_user_id, client_request_id, status, requested_at) VALUES "
                 "('a2', ?, 'lock.unlock', 'u', 'r2', 'denied', ?)", (LOCK, iso(T0 + 995)))  # a refused command explains nothing
    hist(conn, LOCK, "unavailable", T0 + 3900)
    hist(conn, LOCK, "locked", T0 + 4100)
    hist(conn, LOCK, "unlocked", T0 + 5500)
    hist(conn, LOCK, "locked", T0 + 6100)
    conn.execute("INSERT INTO intercom_door_map (entity_id, config_entry_id, physical_index, source, mapped_at) VALUES (?, 'cfg1', 1, 'manual', ?)", (LOCK, now_iso()))
    conn.execute("""INSERT INTO door_window_occurrences (id, rule_id, station_id, relay, start_at, end_at, zone, token, origin, tier, state, created_at, updated_at)
                    VALUES ('o1', NULL, 'cfg1', 1, ?, ?, 'Asia/Jerusalem', 't1', 'once', 'program', 'active', ?, ?)""", (iso(T0 + 6900), iso(T0 + 7200), now_iso(), now_iso()))
    # the back door: no lock, no exit input - its openings cannot be judged
    hist(conn, BACK, "off", T0 - 3600)
    hist(conn, BACK, "on", T0 + 500)
    hist(conn, BACK, "off", T0 + 530)


def _on(w, pairs=PAIRS) -> None:
    save_settings(w["db"], {"doors": {"pairs": pairs}})
    switch(w["db"], ic.SW_DOORS)


RANGE = f"range=custom&from={iso(T0 - 600)}&to={iso(T0 + 8000)}"


# ---------------------------------------------------------------- negative first

def test_switched_off_is_the_uniform_404_for_everyone(w):
    c = w["c"]
    for hdr in ({}, as_user("nobody")):
        for path in ("/insights/doors", "/insights/waste", "/reports/building/preview", "/reports/building.pdf"):
            r = c.get(f"{API}{path}", headers=hdr)
            assert r.status_code == 404, (path, hdr)
            assert r.json()["code"] == "not_found"
    with w["db"].connection(mode="read") as conn:
        assert ic.switches(conn) == {ic.SW_DOORS: False, ic.SW_WASTE: False, ic.SW_REPORT: False}, "every part ships OFF"


def test_a_garbage_switch_value_reads_as_off(w):
    with w["db"].connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES (?, 'yes')", (ic.SW_DOORS,))
    assert w["c"].get(f"{API}/insights/doors").status_code == 404


def test_no_permission_is_the_audited_403(w):
    c, s = w["c"], w["settings"]
    _on(w)
    bind(c, s, "vera", "viewer", "installation", "*")
    bind(c, s, "otto", "operator", "installation", "*")
    for u in ("vera", "otto", "nobody"):
        assert c.get(f"{API}/insights/doors?{RANGE}", headers=as_user(u)).status_code == 403, u
    denied = [r for r in audit_rows(w["db"], "insights.read") if r["decision"] == "denied"]
    assert {r["actor_username"] for r in denied} >= {"vera", "otto"}


def test_settings_need_manage_and_a_switch_needs_configure(w):
    c, s, db = w["c"], w["settings"], w["db"]
    bind(c, s, "otto", "operator", "installation", "*")
    bind(c, s, "sam", "site_admin", "installation", "*")
    assert c.get(f"{API}/insights/settings", headers=as_user("otto")).status_code == 403
    assert c.put(f"{API}/insights/settings", json={"settings": {"doors": {"before_s": 40}}}, headers=as_user("otto")).status_code == 403
    got = c.get(f"{API}/insights/settings", headers=as_user("sam")).json()
    assert got["can_switch"] is False and got["switches"] == {ic.SW_DOORS: False, ic.SW_WASTE: False, ic.SW_REPORT: False}
    # a site administrator may tune the thresholds, never flip a switch (system.configure)
    assert c.put(f"{API}/insights/settings", json={"settings": {"doors": {"before_s": 40}}}, headers=as_user("sam")).status_code == 200
    r = c.put(f"{API}/insights/settings", json={"switches": {ic.SW_DOORS: True}}, headers=as_user("sam"))
    assert r.status_code == 403
    with db.connection(mode="read") as conn:
        assert ic.switch_on(conn, ic.SW_DOORS) is False and ic.load(conn)["doors"]["before_s"] == 40
    r = c.put(f"{API}/insights/settings", json={"switches": {ic.SW_DOORS: True}})
    assert r.status_code == 200 and r.json()["switches"][ic.SW_DOORS] is True
    rows = audit_rows(db, "insights.settings.update")
    assert [r["decision"] for r in rows] == ["allowed", "allowed"] and json.loads(rows[-1]["details_json"])["switches"] == {ic.SW_DOORS: True}
    assert c.put(f"{API}/insights/settings", json={"switches": {"something.else": True}}).status_code == 422


@pytest.mark.parametrize("doc, field", [
    ({"doors": {"before_s": 1}}, "doors.before_s"),
    ({"doors": {"after_s": "5"}}, "doors.after_s"),
    ({"doors": {"min_open_s": True}}, "doors.min_open_s"),
    ({"doors": {"pairs": [{"sensor_entity_id": "lock.front"}]}}, "doors.pairs[0].sensor_entity_id"),
    ({"doors": {"pairs": [{"sensor_entity_id": FRONT, "lock_entity_id": "switch.x"}]}}, "doors.pairs[0].lock_entity_id"),
    ({"doors": {"pairs": [{"sensor_entity_id": FRONT, "rex_entity_ids": ["light.x"]}]}}, "doors.pairs[0].rex_entity_ids"),
    ({"doors": {"pairs": [{"sensor_entity_id": "binary_sensor.not_there"}]}}, "doors.pairs[0].unknown_entity"),
    ({"doors": {"pairs": [{"sensor_entity_id": FRONT}, {"sensor_entity_id": FRONT}]}}, "doors.pairs.duplicate_sensor"),
    ({"doors": {"pairs": [{"sensor_entity_id": FRONT, "extra": 1}]}}, "doors.pairs[0]"),
    ({"waste": {"night_from": "25:00"}}, "waste.night_from"),
    ({"waste": {"night_from": "22:00", "night_to": "22:00"}}, "waste.night_to"),
    ({"waste": {"domains": ["lock"]}}, "waste.domains"),
    ({"waste": {"energy_factor": 0.5}}, "waste.energy_factor"),
    ({"report": {"sections": ["tickets", "bogus"]}}, "report.sections"),
    ({"unknown": {}}, "settings"),
])
def test_invalid_settings_name_the_field(w, doc, field):
    r = w["c"].put(f"{API}/insights/settings", json={"settings": doc})
    assert r.status_code == 422 and field in r.json()["details"]["fields"], r.json()
    with w["db"].connection(mode="read") as conn:
        assert ic.load(conn) == ic.code_defaults(), "nothing saved"


def test_bad_ranges_are_422(w):
    c = w["c"]
    _on(w)
    for q in ("range=bogus", "range=custom&from=2026-10-01T00:00", f"range=custom&from={iso(NOW - 40 * 86400)}&to={iso(NOW)}",
              f"range=custom&from={iso(NOW)}&to={iso(NOW - 60)}"):
        assert c.get(f"{API}/insights/doors?{q}").status_code == 422, q


# ---------------------------------------------------------------- the classification

def test_the_openings_are_classified_door_and_time_only(w):
    c, db = w["c"], w["db"]
    _on(w)
    r = c.get(f"{API}/insights/doors?{RANGE}")
    assert r.status_code == 200
    body = r.json()
    front = next(d for d in body["doors"] if d["name"] == "דלת כניסה")
    assert (front["openings"], front["explained"], front["unexplained"], front["unverifiable"]) == (7, 5, 1, 1)
    assert front["by_reason"] == {"lock": 1, "unlocked": 1, "command": 1, "rex": 1, "window": 1}
    listed = {(i["at"], i["verdict"], i["why"]) for i in front["items"]}
    assert listed == {(iso(T0 + 1000), "unexplained", None), (iso(T0 + 4000), "unverifiable", "lock_unknown")}
    back = next(d for d in body["doors"] if d["name"] == "דלת אחורית")
    assert back["judgeable"] is False and back["unverifiable"] == 1 and back["unexplained"] == 0 and back["items"][0]["why"] == "no_lock_or_exit"
    assert body["total"] == {"openings": 8, "explained": 5, "unexplained": 1, "unverifiable": 2}
    assert body["ranking"] == [{"key": front["key"], "name": "דלת כניסה", "unexplained": 1}]
    assert body["doors"][0]["name"] == "דלת כניסה", "the door with the most unexplained openings first"
    text = json.dumps(body, ensure_ascii=False)
    assert "binary_sensor." not in text and "lock." not in text and "cfg1" not in text, "names and opaque keys only"
    row = audit_rows(db, "insights.doors.read")[-1]
    assert row["decision"] == "allowed" and json.loads(row["details_json"])["unexplained"] == 1


def test_a_wider_window_explains_more_and_the_clock_bounds_the_range(w):
    c, db = w["c"], w["db"]
    _on(w)
    # the unexplained opening at +1000 is 5 s after nothing; a refused command at +995 never explains it
    save_settings(db, {"doors": {"pairs": PAIRS, "before_s": 300}})
    front = next(d for d in c.get(f"{API}/insights/doors?{RANGE}").json()["doors"] if d["name"] == "דלת כניסה")
    assert front["unexplained"] == 1
    # the injected clock: "24h" ends at NOW, so nothing after NOW is ever judged
    lo, hi = ic.parse_range("24h", None, None, NOW)
    assert (lo, hi) == (int(NOW) - 86400, int(NOW))
    lo, hi = ic.parse_range("custom", iso(NOW - 3600), iso(NOW + 7200), NOW)
    assert hi == int(NOW)


def test_service_without_a_lock_history_is_unverifiable_not_unexplained(w):
    db = w["db"]
    with db.connection() as conn:
        entity(conn, "binary_sensor.side_door", "דלת צד", device_class="door")
        entity(conn, "lock.side", "מנעול צד")  # no history at all for the lock
        hist(conn, "binary_sensor.side_door", "off", T0 - 60)
        hist(conn, "binary_sensor.side_door", "on", T0 + 10)
        hist(conn, "binary_sensor.side_door", "off", T0 + 20)
        out = insights_doors.judge_pair(conn, {"sensor_entity_id": "binary_sensor.side_door", "lock_entity_id": "lock.side"}, ic.code_defaults()["doors"],
                                        T0 - 600, T0 + 600)
    assert out["unverifiable"] == 1 and out["unexplained"] == 0 and out["items"][0]["why"] == "lock_unknown"


def test_inverted_sensor(w):
    db = w["db"]
    with db.connection() as conn:
        entity(conn, "binary_sensor.inv_door", "דלת הפוכה", device_class="door")
        hist(conn, "binary_sensor.inv_door", "on", T0 - 60)   # on = closed for this sensor
        hist(conn, "binary_sensor.inv_door", "off", T0 + 10)  # opened
        hist(conn, "binary_sensor.inv_door", "on", T0 + 40)
        cfg = ic.code_defaults()["doors"]
        inv = insights_doors.judge_pair(conn, {"sensor_entity_id": "binary_sensor.inv_door", "lock_entity_id": LOCK, "invert": True}, cfg, T0 - 600, T0 + 600)
        plain = insights_doors.judge_pair(conn, {"sensor_entity_id": "binary_sensor.inv_door", "lock_entity_id": LOCK}, cfg, T0 - 600, T0 + 600)
    assert inv["openings"] == 1 and inv["unexplained"] == 1 and inv["items"][0]["duration_s"] == 30
    # without invert the CLOSING at +40 reads as an opening (the pair's invert flag is what makes the insight right for such a sensor)
    assert plain["openings"] == 1 and plain["items"][0]["at"] == iso(T0 + 40) and plain["items"][0]["open_at_end"] is True


# ---------------------------------------------------------------- isolation by scope

def test_a_floor_scoped_manager_sees_only_the_doors_placed_on_his_floor(w, monkeypatch):
    c, s = w["c"], w["settings"]
    _on(w)
    tree = seed_tree(c)
    bind(c, s, "fay", "site_admin", "floor", tree["floor2"])
    body = c.get(f"{API}/insights/doors?{RANGE}", headers=as_user("fay")).json()
    assert body["doors"] == [] and body["total"]["openings"] == 0, "nothing placed on floor 2 yet"
    from smplwise.services import ha_scope

    monkeypatch.setattr(ha_scope, "placements", lambda conn: {FRONT: [{"floor_id": tree["floor2"], "floor_name": "קומה 2"}],
                                                              BACK: [{"floor_id": tree["floor3"], "floor_name": "קומה 3"}]})
    body = c.get(f"{API}/insights/doors?{RANGE}", headers=as_user("fay")).json()
    assert [d["name"] for d in body["doors"]] == ["דלת כניסה"]
    assert c.get(f"{API}/insights/settings", headers=as_user("fay")).status_code == 403, "the settings are installation-wide"


# ---------------------------------------------------------------- slice 2: the navigation status and the floor of a row

def test_status_is_403_without_any_insight_permission_and_follows_switch_and_permission(w):
    c, s, db = w["c"], w["settings"], w["db"]
    bind(c, s, "vera", "viewer", "installation", "*")
    assert c.get(f"{API}/insights/status", headers=as_user("vera")).status_code == 403
    assert c.get(f"{API}/insights/status").json() == {"doors": False, "waste": False, "report": False}  # all switches default off
    switch(db, ic.SW_DOORS)
    switch(db, ic.SW_REPORT)
    bind(c, s, "sam", "site_admin", "installation", "*")
    assert c.get(f"{API}/insights/status", headers=as_user("sam")).json() == {"doors": True, "waste": False, "report": True}
    assert audit_rows(db, "insights.doors.read") == []  # a status read computes and audits nothing


def test_a_door_row_carries_the_floor_name(w):
    db, c = w["db"], w["c"]
    with db.connection() as conn:
        conn.execute("INSERT INTO ha_floors (floor_id, name, level, position, updated_at) VALUES ('f1', 'קומה 1', 1, 0, ?)", (now_iso(),))
        conn.execute("UPDATE ha_areas SET floor_id = 'f1' WHERE area_id = 'lobby'")
    save_settings(db, {"doors": {"pairs": PAIRS}})
    switch(db, ic.SW_DOORS)
    body = c.get(f"{API}/insights/doors?range=24h").json()
    assert {d["floor"] for d in body["doors"]} == {"קומה 1"}
