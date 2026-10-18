"""CR-INFRA-ELEVATORS 2.8.0: the state history (migration 0120), the per-role sensor lights, and the notification mechanism (sources
elevator.fire_service / elevator.fault / elevator.out_of_service, one default recipient policy). Negative cases first: no notification before
the hold time, none twice, none from a dead sensor or a disconnected mirror, none for a viewer who cannot see the elevator, no history for a
viewer who sees only part of it. A fake mirror only; the evaluator is driven with explicit instants (no thread)."""
from __future__ import annotations

import pytest
from conftest import as_user, bind
from test_infra_elevators import API, add_entity, app, create, set_state  # noqa: F401 - `app` is the shared fixture

from smplwise.services import elevators as el
from smplwise.services import elevators_runtime as rt

OWNER = {"waiting": "binary_sensor.el3_wait", "fault": "binary_sensor.el3_fault", "fire_service": "binary_sensor.el3_fire", "out_of_service": "binary_sensor.el3_shut"}
T0 = 1_800_000_000.0  # a fixed instant (2027-01-15)


@pytest.fixture()
def owner(app):  # noqa: F811
    c, db, settings = app
    for e in OWNER.values():
        add_entity(db, e, "off")
    rt.reset()
    eid = create(c, name="מעלית ראשית", sensors=OWNER).json()["id"]
    yield c, db, settings, eid
    rt.reset()


def tick(db, t, connected=True):
    with db.connection() as conn:
        return rt.evaluate(conn, t, connected=connected)


def notes(db, eid=None):
    with db.connection(mode="read") as conn:
        sql = "SELECT * FROM notifications WHERE source LIKE 'elevator.%'" + (" AND subject_id = ?" if eid else "") + " ORDER BY first_at, source"
        return [dict(r) for r in conn.execute(sql, (eid,) if eid else ()).fetchall()]


# ---------------------------------------------------------------- notifications (negative first)

def test_no_notification_before_the_hold_time_and_none_twice(owner):
    c, db, _, eid = owner
    set_state(db, OWNER["fault"], "on")
    assert tick(db, T0)["raised"] == 0  # a fault must hold 30 s
    assert tick(db, T0 + 15)["raised"] == 0
    assert notes(db) == []
    assert tick(db, T0 + 30)["raised"] == 1
    assert tick(db, T0 + 45)["raised"] == 0  # memory: never twice
    n = notes(db)
    assert len(n) == 1 and n[0]["source"] == "elevator.fault" and n[0]["subject_kind"] == "elevator" and n[0]["subject_id"] == eid
    assert n[0]["count"] == 1 and n[0]["state"] == "open" and "מעלית ראשית" in n[0]["body"] and n[0]["link"] == "#/infra/elevators"


def test_a_blip_shorter_than_the_hold_is_not_a_notification(owner):
    _, db, _, _ = owner
    set_state(db, OWNER["out_of_service"], "on")
    tick(db, T0)
    set_state(db, OWNER["out_of_service"], "off")
    tick(db, T0 + 15)
    set_state(db, OWNER["out_of_service"], "on")
    assert tick(db, T0 + 30)["raised"] == 0  # the hold restarted
    assert notes(db) == []


def test_dead_sensor_and_disconnected_mirror_change_nothing(owner):
    _, db, _, _ = owner
    set_state(db, OWNER["fire_service"], "on")
    assert tick(db, T0)["raised"] == 1  # fire service: at once
    set_state(db, OWNER["fire_service"], "unavailable")
    assert tick(db, T0 + 15)["cleared"] == 0
    set_state(db, OWNER["fire_service"], "off")
    assert tick(db, T0 + 30, connected=False)["cleared"] == 0  # no reading: still open
    assert notes(db)[0]["state"] == "open"
    assert tick(db, T0 + 45)["cleared"] == 1
    assert notes(db)[0]["state"] == "resolved"


def test_each_role_is_judged_on_its_own_sensor(owner):
    """A fault masked by fire service on the screen keeps its own notification; fire service ending does not end the fault."""
    _, db, _, _ = owner
    set_state(db, OWNER["fault"], "on")
    set_state(db, OWNER["fire_service"], "on")
    tick(db, T0)
    tick(db, T0 + 30)
    assert sorted(n["source"] for n in notes(db)) == ["elevator.fault", "elevator.fire_service"]
    set_state(db, OWNER["fire_service"], "off")
    tick(db, T0 + 45)
    states = {n["source"]: n["state"] for n in notes(db)}
    assert states == {"elevator.fault": "open", "elevator.fire_service": "resolved"}
    sev = {n["source"]: n["severity"] for n in notes(db)}
    assert sev == {"elevator.fault": "alert", "elevator.fire_service": "critical"}


def test_unmapping_disabling_and_deleting_resolve(owner):
    c, db, _, eid = owner
    set_state(db, OWNER["fault"], "on")
    set_state(db, OWNER["out_of_service"], "on")
    tick(db, T0)
    tick(db, T0 + 30)
    assert len([n for n in notes(db) if n["state"] == "open"]) == 2
    # the fault sensor is unlinked -> its notification ends at the next pass
    body = {"name": "מעלית ראשית", "sensors": {k: v for k, v in OWNER.items() if k != "fault"}}
    assert c.put(f"{API}/{eid}", json=body).status_code == 200
    tick(db, T0 + 45)
    assert {n["source"]: n["state"] for n in notes(db)} == {"elevator.fault": "resolved", "elevator.out_of_service": "open"}
    # disabled -> everything ends
    assert c.put(f"{API}/{eid}", json={**body, "enabled": False}).status_code == 200
    tick(db, T0 + 60)
    assert all(n["state"] == "resolved" for n in notes(db))
    # enabled again and raised again, then deleted -> resolved by the delete route itself, memory and history gone
    assert c.put(f"{API}/{eid}", json=body).status_code == 200
    tick(db, T0 + 75)
    tick(db, T0 + 105)
    assert any(n["state"] == "open" for n in notes(db))
    assert c.delete(f"{API}/{eid}").status_code == 204
    assert all(n["state"] == "resolved" for n in notes(db))
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM infra_elevator_alerts").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM infra_elevator_states").fetchone()[0] == 0


def test_memory_survives_a_restart(owner):
    _, db, _, _ = owner
    set_state(db, OWNER["fire_service"], "on")
    tick(db, T0)
    rt.reset()  # the process restarts: the hold timers are gone, the memory row is not
    assert tick(db, T0 + 15)["raised"] == 0
    assert len(notes(db)) == 1 and notes(db)[0]["count"] == 1


def test_recipients_default_policy_is_the_administrators_who_see_it(owner):
    """One default recipient policy (owner 2026-10-18): the notify.manage holders, intersected with who may see the elevator."""
    c, db, settings, eid = owner
    bind(c, settings, "vera", "viewer", "installation", "*")
    bind(c, settings, "adm", "site_admin", "installation", "*")
    c.get("/api/v1/me", headers=as_user("vera"))
    c.get("/api/v1/me", headers=as_user("adm"))
    set_state(db, OWNER["fire_service"], "on")
    tick(db, T0)
    nid = notes(db)[0]["id"]
    with db.connection(mode="read") as conn:
        users = {r["username"] for r in conn.execute("SELECT u.username FROM notification_recipients r JOIN users u ON u.id = r.user_id WHERE r.notification_id = ?", (nid,)).fetchall()}
        policy = conn.execute("SELECT recipients_json FROM notify_policies WHERE source = 'elevator.fire_service'").fetchone()[0]
    assert "vera" not in users and "joni" in users
    assert '"managers"' in policy


def test_visibility_rule_of_the_elevator_subject(owner, monkeypatch):
    from smplwise.rbac import Principal  # noqa: F401 - the principal comes from the mirror of users
    from smplwise.services import ha_scope
    from smplwise.services.notify_visibility import Reach, principal_of

    c, db, settings, eid = owner
    bind(c, settings, "flo", "viewer", "installation", "*")
    c.get("/api/v1/me", headers=as_user("flo"))
    real = ha_scope.visible_floors
    monkeypatch.setattr(ha_scope, "visible_floors", lambda conn, p, perm: (False, {"f9"}) if p.username == "flo" else real(conn, p, perm))
    monkeypatch.setattr(ha_scope, "placements", lambda conn: {})
    n = {"subject_kind": "elevator", "subject_id": eid, "origin_json": "{}", "source": "elevator.fault"}
    with db.connection() as conn:
        uid = conn.execute("SELECT id FROM users WHERE username = 'flo'").fetchone()[0]
        joni = conn.execute("SELECT id FROM users WHERE username = 'joni'").fetchone()[0]
        assert Reach(conn, principal_of(conn, uid)).can_see(n) is False  # none of its sensors on his floor
        assert Reach(conn, principal_of(conn, joni)).can_see(n) is True
        assert Reach(conn, principal_of(conn, joni)).can_see({**n, "subject_id": "nope"}) is False
    monkeypatch.setattr(ha_scope, "placements", lambda conn: {OWNER["fault"]: [{"floor_id": "f9", "floor_name": "9"}]})
    with db.connection() as conn:
        assert Reach(conn, principal_of(conn, uid)).can_see(n) is True


def test_sources_are_in_the_catalogue_with_their_defaults():
    from smplwise.services import notify_policy as p

    for role, sev, push in (("fire_service", "critical", True), ("fault", "alert", True), ("out_of_service", "info", False)):
        s = p.BY_KEY[f"elevator.{role}"]
        assert (s.severity, s.push, s.who, s.subject, s.category) == (sev, push, "managers", "elevator", "device_faults")
        assert "whatsapp" not in [k for k, v in p.default_row(s)["channels"].items() if v]
    assert "elevator" in p.SUBJECT_KINDS


# ---------------------------------------------------------------- history

def test_history_records_transitions_only(owner):
    _, db, _, eid = owner
    assert tick(db, T0)["recorded"] == 1  # active (waiting off, no movement sensors)
    assert tick(db, T0 + 15)["recorded"] == 0
    set_state(db, OWNER["waiting"], "on")
    assert tick(db, T0 + 30)["recorded"] == 1
    tick(db, T0 + 45, connected=False)  # disconnected: unknown, never the old state
    with db.connection(mode="read") as conn:
        states = [r[0] for r in conn.execute("SELECT state FROM infra_elevator_states WHERE elevator_id = ? ORDER BY at", (eid,)).fetchall()]
    assert states == ["active", "waiting", "unknown"]


def test_history_instant_is_the_sensor_change_normalised(owner):
    _, db, _, eid = owner
    with db.connection() as conn:
        conn.execute("UPDATE ha_entities SET state = 'on', last_changed = '2027-01-15T07:59:50.123456+00:00' WHERE entity_id = ?", (OWNER["fault"],))
        el.record_state(conn, eid, "fault", "2027-01-15T08:00:00Z", "2027-01-15T07:59:50.123456+00:00")
        el.record_state(conn, eid, "fault", "2027-01-15T08:00:15Z", None)  # same state: nothing
        el.record_state(conn, eid, "waiting", "2027-01-15T08:01:00Z", "2030-01-01T00:00:00+00:00")  # a future stamp: now
        el.record_state(conn, eid, "active", "2027-01-15T08:02:00Z", "2027-01-15T07:00:00+00:00")  # older than the last row: now
        rows = [tuple(r) for r in conn.execute("SELECT at, state FROM infra_elevator_states WHERE elevator_id = ? ORDER BY at", (eid,)).fetchall()]
    assert rows == [("2027-01-15T07:59:50Z", "fault"), ("2027-01-15T08:01:00Z", "waiting"), ("2027-01-15T08:02:00Z", "active")]


def test_history_segments_and_window():
    """Pure: the state at the window start comes from the last earlier row; equal neighbours merge; nothing before the first row is guessed."""
    import sqlite3

    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE infra_elevator_states (elevator_id TEXT, at TEXT, state TEXT, PRIMARY KEY (elevator_id, at))")
    conn.executemany("INSERT INTO infra_elevator_states VALUES (?,?,?)", [
        ("a", "2027-01-14T00:00:00Z", "waiting"), ("a", "2027-01-15T02:00:00Z", "fault"), ("a", "2027-01-15T03:00:00Z", "fault"), ("a", "2027-01-15T04:00:00Z", "active"),
        ("b", "2027-01-15T06:00:00Z", "out_of_service"),
    ])
    h = el.history(conn, ["a", "b", "c"], "2027-01-15T00:00:00Z", "2027-01-15T08:00:00Z")
    assert h["a"] == [{"state": "waiting", "from": "2027-01-15T00:00:00Z", "to": "2027-01-15T02:00:00Z"}, {"state": "fault", "from": "2027-01-15T02:00:00Z", "to": "2027-01-15T04:00:00Z"},
                      {"state": "active", "from": "2027-01-15T04:00:00Z", "to": "2027-01-15T08:00:00Z"}]
    assert h["b"] == [{"state": "out_of_service", "from": "2027-01-15T06:00:00Z", "to": "2027-01-15T08:00:00Z"}]
    assert h["c"] == []
    # prune keeps each elevator's last row before the cutoff
    assert el.prune_history(conn, "2027-01-15T03:30:00Z") == 2
    left = [tuple(r) for r in conn.execute("SELECT elevator_id, at FROM infra_elevator_states ORDER BY elevator_id, at").fetchall()]
    assert left == [("a", "2027-01-15T03:00:00Z"), ("a", "2027-01-15T04:00:00Z"), ("b", "2027-01-15T06:00:00Z")]


def test_list_with_history_and_its_refusals(owner):
    c, db, _, eid = owner
    import time

    tick(db, time.time() - 600)
    set_state(db, OWNER["fault"], "on")
    tick(db, time.time())
    assert c.get(f"{API}?history=5").status_code == 422
    assert "history" not in c.get(API).json()["elevators"][0]  # only on request
    got = c.get(f"{API}?history=24").json()["elevators"][0]
    assert [s["state"] for s in got["history"]] == ["active", "fault"]
    assert "binary_sensor" not in c.get(f"{API}?history=24").text


def test_history_hidden_from_a_viewer_who_sees_part_of_the_elevator(owner, monkeypatch):
    from smplwise.services import ha_scope

    c, db, settings, eid = owner
    import time

    tick(db, time.time())
    bind(c, settings, "flo", "viewer", "installation", "*")
    real = ha_scope.visible_floors
    monkeypatch.setattr(ha_scope, "visible_floors", lambda conn, p, perm: (False, {"f1"}) if p.username == "flo" else real(conn, p, perm))
    monkeypatch.setattr(ha_scope, "placements", lambda conn: {OWNER["waiting"]: [{"floor_id": "f1", "floor_name": "1"}]})
    got = c.get(f"{API}?history=24", headers=as_user("flo")).json()["elevators"][0]
    assert got["history"] is None and got["roles"] == ["waiting"] and got["flags"] == {"waiting": False}
    assert c.get(f"{API}?history=24").json()["elevators"][0]["history"]  # the installation-wide caller sees it


def test_flags_are_the_visible_roles_live_values(owner):
    c, db, _, _ = owner
    set_state(db, OWNER["fire_service"], "on")
    set_state(db, OWNER["fault"], "unavailable")
    got = c.get(API).json()["elevators"][0]
    assert got["flags"] == {"fault": None, "fire_service": True, "out_of_service": False, "waiting": False}


def test_tick_skips_without_elevators(app):  # noqa: F811
    _, db, _ = app
    assert rt.tick(db, T0, connected=True) == {"skipped": "no_elevators"}
