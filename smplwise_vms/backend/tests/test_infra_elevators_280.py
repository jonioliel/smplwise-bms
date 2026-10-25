"""CR-INFRA-ELEVATORS 2.8.0: the state history (migration 0119), the per-role sensor lights, and the notification mechanism (sources
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


ALERTS = f"{API}/alerts"


def enable(c, states=("fire_service", "fault", "out_of_service"), recipients=None, master=True, channels=None):
    """Turns elevator alerts on through the settings route (joni is system_admin): master + the given states, the given recipients (default:
    the system administrators role, so a notification has someone to reach)."""
    rec = recipients if recipients is not None else {"roles": ["system_admin"]}
    body = {"enabled": master, "states": {s: {"enabled": True, "recipients": rec, **({"channels": channels} if channels is not None else {})} for s in states}}
    r = c.put(ALERTS, json=body)
    assert r.status_code == 200, r.text
    return r.json()


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
    enable(owner[0])
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
    enable(owner[0])
    set_state(db, OWNER["out_of_service"], "on")
    tick(db, T0)
    set_state(db, OWNER["out_of_service"], "off")
    tick(db, T0 + 15)
    set_state(db, OWNER["out_of_service"], "on")
    assert tick(db, T0 + 30)["raised"] == 0  # the hold restarted
    assert notes(db) == []


def test_dead_sensor_and_disconnected_mirror_change_nothing(owner):
    _, db, _, _ = owner
    enable(owner[0])
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
    enable(owner[0])
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
    enable(owner[0])
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
    enable(owner[0])
    set_state(db, OWNER["fire_service"], "on")
    tick(db, T0)
    rt.reset()  # the process restarts: the hold timers are gone, the memory row is not
    assert tick(db, T0 + 15)["raised"] == 0
    assert len(notes(db)) == 1 and notes(db)[0]["count"] == 1


def _recipients(db, nid):
    with db.connection(mode="read") as conn:
        return {r["username"] for r in conn.execute("SELECT u.username FROM notification_recipients r JOIN users u ON u.id = r.user_id WHERE r.notification_id = ?", (nid,)).fetchall()}


def _uid(db, username):
    with db.connection(mode="read") as conn:
        return conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()[0]


def test_nothing_selected_means_nobody_is_notified(owner):
    c, db, _, _ = owner
    enable(c, states=("fire_service",), recipients={})
    set_state(db, OWNER["fire_service"], "on")
    tick(db, T0)
    n = notes(db)
    assert len(n) == 1 and _recipients(db, n[0]["id"]) == set()


def test_recipients_roles_users_and_groups_intersected_with_visibility(owner):
    """Recipients as chosen (owner 2026-10-18, the generator's routing pattern): a role (direct bindings and bindings through a group), a named
    user, a group's members - then only those who may see the elevator."""
    c, db, settings, _ = owner
    for u, role in (("vera", "viewer"), ("adm", "site_admin"), ("ops", "operator"), ("kio", "kiosk")):
        bind(c, settings, u, role, "installation", "*")
        c.get("/api/v1/me", headers=as_user(u))
    with db.connection() as conn:
        now = "2026-10-18T00:00:00Z"
        conn.execute("INSERT INTO groups (id, name, created_at) VALUES ('g1', 'שומרים', ?)", (now,))
        conn.execute("INSERT INTO group_members (group_id, user_id) VALUES ('g1', ?)", (_uid(db, "kio"),))  # a kiosk: in the group, but cannot see
        conn.execute("INSERT INTO group_members (group_id, user_id) VALUES ('g1', ?)", (_uid(db, "ops"),))
    enable(c, states=("fire_service",), recipients={"roles": ["site_admin"], "users": [_uid(db, "vera")], "groups": ["g1"]})
    set_state(db, OWNER["fire_service"], "on")
    tick(db, T0)
    got = _recipients(db, notes(db)[0]["id"])
    assert got == {"adm", "vera", "ops"}  # joni (system_admin) not chosen; the kiosk cannot see the elevator
    with db.connection(mode="read") as conn:
        pol = dict(conn.execute("SELECT enabled, recipients_json, channels_json FROM notify_policies WHERE source = 'elevator.fire_service'").fetchone())
    assert pol["enabled"] == 1 and '"elevator"' in pol["recipients_json"] and '"whatsapp": false' in pol["channels_json"] and '"email": false' in pol["channels_json"]


def test_alerts_are_off_by_default_and_a_condition_is_tracked_silently(owner):
    c, db, _, eid = owner
    got = c.get(ALERTS).json()
    assert got["enabled"] is False and all(not s["enabled"] for s in got["states"].values())
    assert all(s["recipients"] == {"roles": [], "users": [], "groups": []} and s["channels"] == [] for s in got["states"].values())
    set_state(db, OWNER["fire_service"], "on")
    out = tick(db, T0)
    assert (out["tracked"], out["raised"]) == (1, 0)
    assert notes(db) == []
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT notification_id FROM infra_elevator_alerts WHERE elevator_id = ?", (eid,)).fetchone()[0] is None


def test_turning_on_never_notifies_a_condition_that_already_held(owner):
    c, db, _, _ = owner
    set_state(db, OWNER["fault"], "on")
    tick(db, T0)
    tick(db, T0 + 30)  # the fault holds while alerts are off
    enable(c)
    assert tick(db, T0 + 45)["raised"] == 0  # no retroactive notification
    set_state(db, OWNER["fault"], "off")
    assert tick(db, T0 + 60)["cleared"] == 0  # nothing was open
    set_state(db, OWNER["fault"], "on")
    tick(db, T0 + 75)
    assert tick(db, T0 + 105)["raised"] == 1  # a NEW transition after turning on
    assert len(notes(db)) == 1


def test_master_switch_overrides_the_state_switch(owner):
    c, db, _, _ = owner
    enable(c, master=False)
    set_state(db, OWNER["fire_service"], "on")
    assert tick(db, T0)["raised"] == 0
    assert notes(db) == []


def test_turning_off_closes_open_notifications_with_a_clear_resolution(owner):
    """The documented rule: turning a state (or the master) off resolves its open elevator notifications at once (resolution alerts_disabled);
    the condition stays tracked, so turning on again does not re-notify it."""
    c, db, _, _ = owner
    enable(c)
    set_state(db, OWNER["fire_service"], "on")
    set_state(db, OWNER["fault"], "on")
    tick(db, T0)
    tick(db, T0 + 30)
    assert {n["source"]: n["state"] for n in notes(db)} == {"elevator.fire_service": "open", "elevator.fault": "open"}
    r = c.put(ALERTS, json={"states": {"fault": {"enabled": False}}})
    assert r.status_code == 200
    got = {n["source"]: (n["state"], n["resolution"]) for n in notes(db)}
    assert got == {"elevator.fire_service": ("open", None), "elevator.fault": ("resolved", "alerts_disabled")}
    assert c.put(ALERTS, json={"enabled": False}).status_code == 200
    assert all(n["state"] == "resolved" and n["resolution"] == "alerts_disabled" for n in notes(db))
    assert c.put(ALERTS, json={"enabled": True, "states": {"fault": {"enabled": True}}}).status_code == 200
    assert tick(db, T0 + 45)["raised"] == 0  # still the same conditions: never re-notified
    with db.connection(mode="read") as conn:
        audit = conn.execute("SELECT details_json FROM audit_log WHERE action = 'infra.elevator.alerts.update' ORDER BY rowid").fetchall()
    assert len(audit) == 4 and all("binary_sensor" not in (a[0] or "") for a in audit)


def test_alert_settings_permissions_and_validation(owner):
    c, db, settings, _ = owner
    bind(c, settings, "adm", "site_admin", "installation", "*")
    bind(c, settings, "ops", "operator", "installation", "*")
    a, o = as_user("adm"), as_user("ops")
    assert c.get(ALERTS, headers=a).status_code == 200 and c.get(ALERTS, headers=a).json()["can_edit"] is False  # an elevator manager reads
    assert c.put(ALERTS, json={"enabled": True}, headers=a).status_code == 403  # changing needs system.configure
    assert c.get(ALERTS, headers=o).status_code == 403
    assert c.put(ALERTS, json={"enabled": True}, headers=o).status_code == 403
    for body, code in (
        ({"states": {"moving_up": {"enabled": True}}}, "validation"),
        ({"states": {"fault": {"recipients": {"roles": ["kiosk"]}}}}, "recipient_role"),
        ({"states": {"fault": {"recipients": {"users": ["nobody"]}}}}, "recipient_user"),
        ({"states": {"fault": {"recipients": {"groups": ["nogroup"]}}}}, "recipient_group"),
        ({"states": {"fault": {"channels": ["email"]}}}, "channel"),
        ({"states": {"fault": {"channels": ["sms"]}}}, "channel"),  # GENELEV-295: whatsapp became a channel (it needs notify.manage to add)
    ):
        r = c.put(ALERTS, json=body)
        assert r.status_code == 422 and r.json()["code"] == code, (body, r.text)
        assert r.json()["details"]["message_en"]
    assert c.get(ALERTS).json()["enabled"] is False  # nothing was saved
    v = c.put(ALERTS, json={"states": {"fault": {"channels": ["push", "app"]}}}).json()
    assert v["states"]["fault"]["channels"] == ["push", "app"] and v["row_version"] == 1
    r = c.put(ALERTS, json={"enabled": True, "row_version": 0})
    assert r.status_code == 409 and r.json()["code"] == "revision_conflict"


def test_generic_policy_switch_cannot_bypass_the_master_switch(owner):
    """An administrator flipping the CR-018 policy on in the generic notification settings does not start elevator alerts: the evaluator
    asks the elevator settings."""
    _, db, _, _ = owner
    with db.connection() as conn:
        from smplwise.services import notify_policy

        notify_policy.ensure_defaults(conn)
        conn.execute("UPDATE notify_policies SET enabled = 1 WHERE source LIKE 'elevator.%'")
    set_state(db, OWNER["fire_service"], "on")
    assert tick(db, T0)["raised"] == 0 and notes(db) == []


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

    # owner decision 2026-10-18: OFF, nobody, inbox only until an administrator chooses otherwise
    for role, sev in (("fire_service", "critical"), ("fault", "alert"), ("out_of_service", "info")):
        s = p.BY_KEY[f"elevator.{role}"]
        assert (s.severity, s.enabled, s.push, s.who, s.subject, s.category) == (sev, False, False, "elevator", "elevator", "device_faults")
        assert [k for k, v in p.default_row(s)["channels"].items() if v] == ["inbox"]
    assert "elevator" in p.SUBJECT_KINDS and "elevator" in p.RECIPIENT_RULES


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


# ---------------------------------------------------------------- independent review 2026-10-19 (regression tests)

def test_review_h1_a_notification_needs_its_own_state_sensor_visible(owner, monkeypatch):
    """H1 (D3): a floor-scoped viewer who sees only the WAITING sensor must not see the FAULT notification of that elevator; who sees the fault
    sensor does. An unknown elevator source needs every sensor visible."""
    from smplwise.services import ha_scope
    from smplwise.services.notify_visibility import Reach, principal_of

    c, db, settings, eid = owner
    bind(c, settings, "flo", "viewer", "installation", "*")
    c.get("/api/v1/me", headers=as_user("flo"))
    real = ha_scope.visible_floors
    monkeypatch.setattr(ha_scope, "visible_floors", lambda conn, p, perm: (False, {"f1"}) if p.username == "flo" else real(conn, p, perm))
    monkeypatch.setattr(ha_scope, "placements", lambda conn: {OWNER["waiting"]: [{"floor_id": "f1", "floor_name": "1"}]})
    fault = {"subject_kind": "elevator", "subject_id": eid, "origin_json": "{}", "source": "elevator.fault"}
    with db.connection() as conn:
        p = principal_of(conn, _uid(db, "flo"))
        assert Reach(conn, p).can_see(fault) is False  # the leak the review reproduced
        assert Reach(conn, p).can_see({**fault, "source": "elevator.something_new"}) is False
    monkeypatch.setattr(ha_scope, "placements", lambda conn: {OWNER["waiting"]: [{"floor_id": "f1", "floor_name": "1"}], OWNER["fault"]: [{"floor_id": "f1", "floor_name": "1"}]})
    with db.connection() as conn:
        p = principal_of(conn, _uid(db, "flo"))
        assert Reach(conn, p).can_see(fault) is True
        assert Reach(conn, p).can_see({**fault, "source": "elevator.fire_service"}) is False  # the fire sensor is still off his floors
    # as a recipient too: with the role chosen, the floor-scoped viewer is not a recipient of the fault notification
    monkeypatch.setattr(ha_scope, "placements", lambda conn: {OWNER["waiting"]: [{"floor_id": "f1", "floor_name": "1"}]})
    enable(c, states=("fault",), recipients={"roles": ["viewer", "system_admin"]})
    set_state(db, OWNER["fault"], "on")
    tick(db, T0)
    tick(db, T0 + 30)
    assert _recipients(db, notes(db)[0]["id"]) == {"joni"}


def test_review_m1_nothing_opened_means_no_memory_and_a_retry(owner, monkeypatch):
    """M1: with alerts on, a refused emit (the generic policy switched off) or a failing emit writes no memory row; the next tick retries."""
    c, db, _, _ = owner
    enable(c, states=("fire_service",))
    with db.connection() as conn:
        conn.execute("UPDATE notify_policies SET enabled = 0 WHERE source = 'elevator.fire_service'")
    set_state(db, OWNER["fire_service"], "on")
    assert tick(db, T0)["raised"] == 0
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM infra_elevator_alerts").fetchone()[0] == 0
    with db.connection() as conn:
        conn.execute("UPDATE notify_policies SET enabled = 1 WHERE source = 'elevator.fire_service'")
    assert tick(db, T0 + 15)["raised"] == 1  # retried, while the condition still holds
    # scenario B: the centre raises once
    from smplwise.services import notify

    set_state(db, OWNER["fault"], "on")
    enable(c, states=("fire_service", "fault"))
    real = notify.emit_full
    calls = {"n": 0}

    def flaky(conn, s):
        if s.source == "elevator.fault" and not s.resolve and calls["n"] == 0:
            calls["n"] += 1
            raise RuntimeError("locked")
        return real(conn, s)

    monkeypatch.setattr(notify, "emit_full", flaky)
    tick(db, T0 + 30)
    assert tick(db, T0 + 60)["raised"] == 0 and calls["n"] == 1  # the failed attempt
    assert tick(db, T0 + 75)["raised"] == 1  # retried
    assert {n["source"] for n in notes(db)} == {"elevator.fire_service", "elevator.fault"}


def test_review_m2_a_disabled_elevator_is_unknown_in_the_history(owner):
    c, db, _, eid = owner
    set_state(db, OWNER["fault"], "on")
    tick(db, T0)
    assert c.put(f"{API}/{eid}", json={"name": "מעלית ראשית", "sensors": OWNER, "enabled": False}).status_code == 200
    tick(db, T0 + 15)
    with db.connection(mode="read") as conn:
        states = [r[0] for r in conn.execute("SELECT state FROM infra_elevator_states WHERE elevator_id = ? ORDER BY at", (eid,)).fetchall()]
    assert states == ["fault", "unknown"]


def test_review_m3_the_policy_delay_adds_to_the_hold(owner):
    c, db, _, _ = owner
    enable(c, states=("fire_service",))
    with db.connection() as conn:
        conn.execute("UPDATE notify_policies SET after_s = 60 WHERE source = 'elevator.fire_service'")
    set_state(db, OWNER["fire_service"], "on")
    assert tick(db, T0)["raised"] == 0  # 0 s built in + 60 s set by the administrator
    assert tick(db, T0 + 45)["raised"] == 0
    assert tick(db, T0 + 60)["raised"] == 1


def test_review_l2_the_hold_restarts_after_a_disconnect(owner):
    c, db, _, _ = owner
    enable(c, states=("fault",))
    set_state(db, OWNER["fault"], "on")
    tick(db, T0)
    tick(db, T0 + 15, connected=False)
    assert tick(db, T0 + 600)["raised"] == 0  # the first observation after the reconnect starts the hold again
    assert tick(db, T0 + 630)["raised"] == 1


def test_review_l3_a_removed_or_long_dead_sensor_closes_its_notification(owner):
    c, db, _, eid = owner
    enable(c, states=("fire_service", "out_of_service"))
    set_state(db, OWNER["fire_service"], "on")
    set_state(db, OWNER["out_of_service"], "on")
    tick(db, T0)
    tick(db, T0 + 30)
    assert len([n for n in notes(db) if n["state"] == "open"]) == 2
    set_state(db, OWNER["out_of_service"], "unavailable")
    assert tick(db, T0 + 45)["closed"] == 0  # dead, not yet long
    assert tick(db, T0 + 45 + rt.DEAD_CLOSE_S)["closed"] == 1
    with db.connection() as conn:
        conn.execute("UPDATE ha_entities SET removed_at = ? WHERE entity_id = ?", ("2027-01-15T00:00:00Z", OWNER["fire_service"]))
    assert tick(db, T0 + 60 + rt.DEAD_CLOSE_S)["closed"] == 1  # removed: at once
    got = {n["source"]: (n["state"], n["resolution"]) for n in notes(db)}
    assert got == {"elevator.fire_service": ("resolved", "sensor_unavailable"), "elevator.out_of_service": ("resolved", "sensor_unavailable")}
    # the condition stays tracked: the sensor coming back still on does not re-notify
    with db.connection() as conn:
        conn.execute("UPDATE ha_entities SET removed_at = NULL WHERE entity_id = ?", (OWNER["fire_service"],))
    assert tick(db, T0 + 75 + rt.DEAD_CLOSE_S)["raised"] == 0


def test_review_l9_orphan_notifications_are_resolved_by_the_janitor(owner):
    c, db, _, eid = owner
    enable(c, states=("fire_service",))
    set_state(db, OWNER["fire_service"], "on")
    tick(db, T0)
    with db.connection() as conn:  # a delete that bypasses the route (e.g. after a rollback)
        conn.execute("DELETE FROM infra_elevators WHERE id = ?", (eid,))
    assert rt.janitor(db, T0 + 10_000) is not None
    assert notes(db)[0]["state"] == "resolved" and notes(db)[0]["resolution"] == "elevator_removed"

# ---------------------------------------------------------------- 2.9.1: the restart heartbeat (a stop is "not monitored", never the last state carried on)

def _states(db, eid):
    with db.connection(mode="read") as conn:
        return [(r[0], r[1]) for r in conn.execute("SELECT at, state FROM infra_elevator_states WHERE elevator_id = ? ORDER BY at", (eid,)).fetchall()]


def test_gap_after_a_stop_is_unknown_not_the_last_state(owner):
    _, db, _, eid = owner
    tick(db, T0)
    tick(db, T0 + 15)  # heartbeat at T0 + 15
    assert [s for _, s in _states(db, eid)] == ["active"]
    out = tick(db, T0 + 15 + 3600)  # the add-on was down for an hour
    assert out["gap"] == 1 and out["recorded"] == 1
    rows = _states(db, eid)
    assert [s for _, s in rows] == ["active", "unknown", "active"]
    assert rows[1][0] == "2027-01-15T08:00:15Z"  # the unknown stretch starts at the last heartbeat
    with db.connection(mode="read") as conn:
        hist = el.history(conn, [eid], "2027-01-15T08:00:00Z", "2027-01-15T09:01:00Z")[eid]
    assert [(s["state"], s["from"]) for s in hist] == [("active", "2027-01-15T08:00:00Z"), ("unknown", "2027-01-15T08:00:15Z"), ("active", "2027-01-15T09:00:15Z")]


def test_normal_ticks_and_a_short_silence_write_no_gap(owner):
    _, db, _, eid = owner
    tick(db, T0)
    for i in range(1, 6):
        assert tick(db, T0 + 15 * i)["gap"] == 0
    assert tick(db, T0 + 75 + el.GAP_S)["gap"] == 0  # exactly at the threshold: still a normal pass
    assert [s for _, s in _states(db, eid)] == ["active"]


def test_gap_does_not_repeat_when_already_unknown_and_first_pass_has_none(owner):
    _, db, _, eid = owner
    assert tick(db, T0)["gap"] == 0  # no heartbeat yet
    tick(db, T0 + 15, connected=False)  # unknown (mirror down)
    assert tick(db, T0 + 15 + 7200, connected=False)["gap"] == 0  # last row already unknown
    assert [s for _, s in _states(db, eid)] == ["active", "unknown"]


def test_gap_marks_the_stretch_even_when_the_state_changed_meanwhile(owner):
    _, db, _, eid = owner
    tick(db, T0)
    set_state(db, OWNER["fault"], "on")  # changed while the add-on was not running
    tick(db, T0 + 600)
    assert [s for _, s in _states(db, eid)] == ["active", "unknown", "fault"]
