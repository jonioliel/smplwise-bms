"""DOORWIN2-295 (CR-039 9, slice W4): event-triggered door windows, end to end on the W0 fakes - the three sources, simulate vs armed, the caps
(day / cooldown / storm / hours), the extension rule, the forged-event table (T4), the loop table (T5), the fail-closed gate (T16) and SR-1.

The product runs against `FakeProgramEngine` (WisKey's hold-open program executor as Arx understands it) on one fake clock; nothing reaches
WisKey, Home Assistant, a station or a door. The go-live permit is switched on INSIDE a test only (monkeypatch). Negative cases first."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
from pathlib import Path

import pytest
from fake_doorwin_adapters import ProductWorld
from fake_doorwin_asserts import assert_no_secrets
from fake_doorwin_events import DOOR_WINDOW_EVENT
from fake_doorwin_world import DoorwinWorld

from smplwise.services import door_window_triggers as dwt

UTC = dt.timezone.utc
T0 = dt.datetime(2026, 11, 2, 5, 0, tzinfo=UTC)  # Monday 07:00 in Asia/Jerusalem (UTC+2 after 25.10)


@pytest.fixture()
def pw(settings, monkeypatch):
    world = DoorwinWorld(start=T0)
    p = ProductWorld(settings, monkeypatch, world=world)
    p.windows_on()
    monkeypatch.setattr(dwt, "_now", p.now)
    monkeypatch.setattr(dwt, "DISPATCH", lambda run: run())
    dwt.reset_budget()
    return p


@pytest.fixture()
def tier_d(settings, monkeypatch):
    p = ProductWorld(settings, monkeypatch, go_live=False)
    p.windows_on()
    dwt.reset_budget()
    return p


def event_rule(p, *, source="ha_event", doors=None, user=None, enable=True, name="משלוחים", **trigger):
    t = {"source": source, "duration_s": 7200, "max_per_day": 3, "cooldown_s": 0, **trigger}
    return p.post("/doors/windows/rules", user, name=name, kind="event", doors=[{"station_id": s, "relay": r} for s, r in (doors or [(p.ENTRY, 1)])],
                  trigger=t, enable=enable, confirmed=True)


def made(p, **kw):
    r = event_rule(p, **kw)
    assert r.status_code == 201, r.text
    return r.json()["rule"]["id"], r.json().get("token")


def fire(p, rid, token, ref=None, **kw):
    return dwt.fire_rule(p.db, p.settings, p.now(), rule_id=rid, source="ha_event", trigger_ref=ref, token=token, **kw)


def armed(p, monkeypatch, rid):
    monkeypatch.setattr(p.dw, "AUTOMATION_ACTOR_PROBE", lambda: True)
    assert p.put("/doors/windows/settings", changes={"doors.automation_actor": "on"}, confirmed=True).status_code == 200
    r = p.post(f"/doors/windows/rules/{rid}/arm", armed=True, confirmed=True)
    assert r.status_code == 200 and r.json()["rule"]["trigger"]["arm_state"] == "armed", r.text


def events(p):
    return p.occurrences(origin="event")


def program_requests(p, kind):
    return [r for r in p.world.programs.requests if r["command"].endswith(f"technical_program_{kind}")]


# ================================================================ the rule: definition, token, validation

def test_an_event_rule_returns_its_token_once_and_stores_only_the_hash(pw):
    r = event_rule(pw)
    assert r.status_code == 201, r.text
    body = r.json()
    token, rid = body["token"], body["rule"]["id"]
    assert len(token) >= 24 and rid in body["snippet"] and token in body["snippet"] and DOOR_WINDOW_EVENT in body["snippet"]
    assert "lock.unlock" not in body["snippet"], "an HA automation fires an event; it never calls lock.unlock on a WisKey lock (CR-039 9.5)"
    row = pw.rows("SELECT * FROM door_window_triggers WHERE rule_id = ?", rid)[0]
    assert row["token_sha256"] == hashlib.sha256(token.encode()).hexdigest() and row["arm_state"] == "simulate"
    assert token not in json.dumps(pw.rows("SELECT * FROM door_window_triggers")) and token not in json.dumps(pw.rows("SELECT document FROM door_window_rule_versions"))
    assert_no_secrets(pw.rows("SELECT details_json FROM audit_log"), pw.rows("SELECT * FROM door_window_rule_versions"), secrets=[token])
    again = pw.get("/doors/windows/state").json()
    view = next(x for x in again["rules"] if x["id"] == rid)
    assert view["trigger"]["has_token"] is True and token not in json.dumps(again) and view["trigger"]["can_arm"] is False
    assert view["periods"] == [] and view["kind"] == "event" and view["snippet"].count("<TOKEN>") == 1


@pytest.mark.parametrize("trigger, code", [
    ({"source": "mqtt"}, "invalid_trigger_source"),
    ({"duration_s": 59}, "invalid_duration"),
    ({"duration_s": 5 * 3600}, "invalid_duration"),                       # above doors.windows.max_hours (4)
    ({"allowed_from": "08:00"}, "invalid_allowed_hours"),
    ({"allowed_from": "10:00", "allowed_to": "09:00"}, "invalid_allowed_hours"),
    ({"allowed_from": "05:00", "allowed_to": "09:00"}, "quiet_hours"),    # touches 22:00-06:00
    ({"max_per_day": 4}, "invalid_cap"),
    ({"cooldown_s": -1}, "invalid_cooldown"),
    ({"source": "arx_automation"}, "invalid_automation"),
    ({"source": "arx_automation", "automation_id": "automation.nowhere"}, "automation_unknown"),
])
def test_the_trigger_is_validated(pw, trigger, code):
    r = event_rule(pw, **trigger)
    assert r.status_code == 422 and r.json()["code"] == code, r.text


def test_an_event_rule_has_no_periods_and_needs_the_permission_per_door(pw):
    r = pw.post("/doors/windows/rules", name="x", kind="event", doors=[{"station_id": pw.ENTRY, "relay": 1}], periods=[{"weekday": 1, "start": "08:00", "end": "09:00"}],
                trigger={"source": "ha_event", "duration_s": 600}, confirmed=True)
    assert r.status_code == 422 and r.json()["code"] == "invalid_periods"
    pw.bind("u1", "operator")
    assert event_rule(pw, user="u1").status_code == 403
    role = pw.role("מנהל חלונות עמדה", ["access.windows.manage"])
    pw.bind("stan", role, "access_control_station", pw.ENTRY)
    assert event_rule(pw, user="stan", doors=[(pw.ENTRY, 1), (pw.SIDE, 1)]).status_code == 403
    assert event_rule(pw, user="stan", doors=[(pw.ENTRY, 1)]).status_code == 201


def test_a_saved_edit_returns_the_rule_to_simulation_and_keeps_the_token(pw, monkeypatch):
    rid, token = made(pw)
    armed(pw, monkeypatch, rid)
    r = pw.put(f"/doors/windows/rules/{rid}", name="משלוחים", kind="event", doors=[{"station_id": pw.ENTRY, "relay": 1}],
               trigger={"source": "ha_event", "duration_s": 3600, "max_per_day": 3, "cooldown_s": 0}, confirmed=True)
    assert r.status_code == 200 and "token" not in r.json() and r.json()["rule"]["trigger"]["arm_state"] == "simulate"
    assert fire(pw, rid, token)["decision"] == "simulated", "the old token still works after an edit that did not ask for a new one"
    new = pw.post(f"/doors/windows/rules/{rid}/token", confirmed=True).json()["token"]
    assert fire(pw, rid, token)["reason"] == "bad_token" and fire(pw, rid, new)["decision"] in ("simulated", "refused")


# ================================================================ simulate by default (T16): nothing is sent

def test_a_ha_event_is_simulated_until_a_person_arms_it_and_nothing_reaches_the_engine(pw):
    rid, token = made(pw)
    res = fire(pw, rid, token, "ctx-1")
    assert res["decision"] == "simulated" and res["doors"][0]["door"] == f"{pw.ENTRY}:1"
    assert events(pw) == [], "a simulated trigger creates no occurrence: there is nothing for the engine to hold"
    pw.sync()
    assert program_requests(pw, "save") == [] and program_requests(pw, "action") == []
    log = pw.rows("SELECT * FROM door_window_trigger_log")
    assert [(x["source"], x["decision"], x["rule_id"], x["trigger_ref"]) for x in log] == [("ha_event", "simulated", rid, "ctx-1")]
    n = pw.rows("SELECT * FROM notifications WHERE source = 'door.windows.simulated'")
    assert len(n) == 1 and "מצב הדגמה" in n[0]["body"]
    a = [x for x in pw.rows("SELECT * FROM audit_log WHERE action = 'door.window.trigger'")]
    assert a and json.loads(a[-1]["details_json"])["simulated"] is True


def test_arming_is_refused_while_the_contract_has_no_automation_actor(pw):
    rid, _ = made(pw)
    r = pw.post(f"/doors/windows/rules/{rid}/arm", armed=True, confirmed=True)
    assert r.status_code == 409 and r.json()["code"] == "automation_actor_unavailable"
    assert pw.put("/doors/windows/settings", changes={"doors.automation_actor": "on"}, confirmed=True).json()["code"] == "automation_actor_unavailable"
    assert pw.get("/doors/windows/settings").json()["settings"]["doors.automation_actor"] == "off"
    assert pw.rows("SELECT arm_state FROM door_window_triggers")[0]["arm_state"] == "simulate"
    assert any(x["decision"] == "denied" for x in pw.rows("SELECT decision FROM audit_log WHERE action = 'door.window.rule_armed'"))


def test_armed_in_the_database_but_no_capability_is_still_simulated(pw):
    """T16: the arm flag alone never opens anything - the capability probe is consulted at fire time."""
    rid, token = made(pw)
    with pw.db.connection() as conn:
        conn.execute("UPDATE door_window_triggers SET arm_state = 'armed' WHERE rule_id = ?", (rid,))
    assert fire(pw, rid, token)["decision"] == "simulated" and events(pw) == []


def test_the_master_switch_off_ignores_every_trigger(pw):
    rid, token = made(pw)
    pw.put("/doors/windows/settings", changes={"doors.windows.enabled": "off"}, confirmed=True)
    assert fire(pw, rid, token)["decision"] == "ignored"
    assert pw.rows("SELECT * FROM door_window_trigger_log") == []


# ================================================================ forged events (T4)

def test_forged_events_do_nothing(pw):
    rid, token = made(pw)
    assert fire(pw, rid, "not-the-rule-token")["reason"] == "bad_token"
    assert fire(pw, "00000000-0000-4000-8000-000000000000", token)["reason"] == "unknown_rule"
    assert fire(pw, rid, "{{ states('input_text.door_token') }}")["reason"] == "bad_token"
    assert fire(pw, 7, ["x"])["decision"] == "ignored"
    assert fire(pw, rid, token + "x")["reason"] == "bad_token"
    assert events(pw) == [] and pw.rows("SELECT * FROM door_window_trigger_log") == []
    assert all(x["decision"] == "denied" for x in pw.rows("SELECT decision FROM audit_log WHERE action = 'door.window.trigger'"))
    assert_no_secrets(pw.rows("SELECT * FROM audit_log"), secrets=[token])


def test_refusal_audits_are_bounded(pw):
    rid, _ = made(pw)
    for i in range(dwt.MAX_REFUSAL_AUDITS_PER_HOUR + 40):
        fire(pw, rid, f"guess-number-{i}")
    assert len(pw.rows("SELECT * FROM audit_log WHERE action = 'door.window.trigger'")) == dwt.MAX_REFUSAL_AUDITS_PER_HOUR, "a flood of forgeries is not a write storm"


def test_the_home_assistant_frame_path_checks_shape_and_never_renders_templates(pw):
    rid, token = made(pw)
    pw.world.events.subscribe(DOOR_WINDOW_EVENT, lambda frame: dwt.on_door_window_event(pw.db, pw.settings, frame))
    pw.world.events.forged_types()
    pw.world.events.forged_template(rid)
    pw.world.events.forged_wrong_token(rid)
    pw.world.events.forged_unknown_rule()
    assert pw.rows("SELECT * FROM door_window_trigger_log") == []
    pw.world.events.forged_extra_keys(rid, token)  # extra keys are ignored: the rule's own duration applies, never the payload's
    log = pw.rows("SELECT * FROM door_window_trigger_log")
    assert [x["decision"] for x in log] == ["simulated"] and pw.world.events.subscribed_types() == {DOOR_WINDOW_EVENT}


def test_a_redelivered_event_is_one_trigger(pw):
    rid, token = made(pw, cooldown_s=0)
    pw.world.events.deliver_twice = True
    pw.world.events.subscribe(DOOR_WINDOW_EVENT, lambda frame: dwt.on_door_window_event(pw.db, pw.settings, frame))
    pw.world.events.door_window(rid, token)
    assert [x["decision"] for x in pw.rows("SELECT decision FROM door_window_trigger_log")] == ["simulated"], "the context id is the key"


# ================================================================ armed: the whole life of an event window (fakes)

@pytest.fixture()
def live(pw, monkeypatch):
    rid, token = made(pw)
    armed(pw, monkeypatch, rid)
    pw.rid, pw.token = rid, token
    pw.job = pw.world.scheduler.every(15, pw.watch, owner="arx", name="watchdog")
    return pw


def test_an_armed_event_holds_the_door_through_the_engine_and_is_confirmed_closed(live):
    res = fire(live, live.rid, live.token, "ctx-a")
    assert res["decision"] == "started"
    (o,) = events(live)
    assert (o["start_at"], o["end_at"], o["token"], o["state"], o["tier"], o["origin"]) == (
        "2026-11-02T05:01:00Z", "2026-11-02T07:01:00Z", "2026-11-02/07:01/09:01", "planned", "program", "event")
    assert o["rule_id"] == live.rid and o["trigger_ref"] == "ctx-a"
    live.sync()
    prog = live.world.programs.program(live.ENTRY, 1)
    assert prog["enabled"] and any(h["start"] == "2026-11-02" and h["periods"] == [{"start": "07:01", "end": "09:01"}] for h in prog["policy"]["schedule"]["holidays"])
    assert events(live)[0]["state"] == "armed"
    live.world.run_until(dt.datetime(2026, 11, 2, 5, 2, 0, tzinfo=UTC))
    assert events(live)[0]["state"] == "active" and live.world.bank.truth_open((live.ENTRY, 1))
    live.world.run_until(dt.datetime(2026, 11, 2, 7, 3, 0, tzinfo=UTC))
    o = events(live)[0]
    assert o["state"] == "closed_confirmed" and o["resolution"] == "engine_idle" and not live.world.bank.truth_open((live.ENTRY, 1))
    live.sync()
    assert not live.world.programs.program(live.ENTRY, 1)["enabled"], "with the hold over the compile leaves no enabled Arx program"
    assert [x["decision"] for x in live.rows("SELECT decision FROM door_window_trigger_log")] == ["started"]


def test_an_event_that_never_reached_the_engine_is_not_started_the_safe_direction(live):
    fire(live, live.rid, live.token)  # no sync: the compile never wrote the program
    live.world.run_until(dt.datetime(2026, 11, 2, 5, 3, 0, tzinfo=UTC))
    o = events(live)[0]
    assert o["state"] in ("not_started", "ending", "closed_confirmed") and not live.world.bank.truth_open((live.ENTRY, 1))
    assert live.rows("SELECT * FROM notifications WHERE source = 'door.window_not_started'")


def test_a_second_event_extends_a_waiting_hold_once(live, monkeypatch):
    fire(live, live.rid, live.token, "a")
    live.world.advance(30)
    r = fire(live, live.rid, live.token, "b")
    assert r["doors"][0]["decision"] == "extended", r
    (o,) = events(live)
    assert o["end_at"] == "2026-11-02T07:02:00Z" and o["token"] == "2026-11-02/07:01/09:02"
    live.world.advance(15)
    r = fire(live, live.rid, live.token, "c")
    assert r["doors"][0]["decision"] == "refused" and r["doors"][0]["reason"] in ("extended_already", "already_covered")
    live.sync()
    assert len(events(live)) == 1 and live.world.programs.program(live.ENTRY, 1)["enabled"]


def test_a_running_hold_is_not_extended_by_default_and_the_refusal_is_audited(live):
    fire(live, live.rid, live.token, "a")
    live.sync()
    live.world.run_until(dt.datetime(2026, 11, 2, 5, 20, 0, tzinfo=UTC))
    assert events(live)[0]["state"] == "active"
    r = fire(live, live.rid, live.token, "b")
    assert r["doors"][0]["reason"] == "would_extend_running" and events(live)[0]["end_at"] == "2026-11-02T07:01:00Z"
    assert any(json.loads(a["details_json"])["reason"] == "would_extend_running" for a in live.rows("SELECT details_json FROM audit_log WHERE action = 'door.window.trigger'"))


def test_a_running_hold_is_extended_when_the_owner_accepts_the_blink(live):
    live.put("/doors/windows/settings", changes={"doors.windows.event_extend_owned": "true"}, confirmed=True)
    fire(live, live.rid, live.token, "a")
    live.sync()
    live.world.run_until(dt.datetime(2026, 11, 2, 5, 20, 0, tzinfo=UTC))
    r = fire(live, live.rid, live.token, "b")
    assert r["doors"][0]["decision"] == "extended"
    o = events(live)[0]
    assert o["state"] == "active" and o["end_at"] > "2026-11-02T07:01:00Z"
    live.sync()  # pause, then save-and-activate (WisKey refuses an edit of an enabled program)
    assert program_requests(live, "action"), "the extension needs the pause step (the door blinks)"
    live.world.run_until(dt.datetime(2026, 11, 2, 5, 21, 0, tzinfo=UTC))
    assert live.world.bank.truth_open((live.ENTRY, 1)) and events(live)[0]["state"] == "active"
    live.world.run_until(dt.datetime(2026, 11, 2, 7, 10, 0, tzinfo=UTC))
    assert events(live)[0]["state"] == "closed_confirmed"


# ================================================================ refusals: hours, caps, blocks

def test_allowed_hours_quiet_hours_and_closed_days(pw, monkeypatch):
    rid, token = made(pw, allowed_from="08:00", allowed_to="18:00")
    assert fire(pw, rid, token)["doors"][0]["reason"] == "outside_hours"   # 07:00 local
    pw.world.run_until(dt.datetime(2026, 11, 2, 7, 0, tzinfo=UTC))           # 09:00 local
    assert fire(pw, rid, token)["doors"][0]["decision"] == "simulated"
    pw.world.run_until(dt.datetime(2026, 11, 2, 20, 30, tzinfo=UTC))         # 22:30 local, inside the quiet hours
    rid2, token2 = made(pw, name="לילה", duration_s=1800)
    assert fire(pw, rid2, token2)["doors"][0]["reason"] == "quiet_hours"
    pw.world.run_until(dt.datetime(2026, 11, 3, 5, 0, tzinfo=UTC))
    pw.put("/doors/windows/calendar", days=[{"on_date": "2026-11-03", "day_type": "closed", "label": "סגור"}], confirmed=True)
    assert fire(pw, rid2, token2)["doors"][0]["reason"] == "closed_day"


def test_a_window_never_crosses_local_midnight(pw):
    pw.put("/doors/windows/settings", changes={"doors.windows.quiet_from": "22:00", "doors.windows.quiet_to": "22:00"}, confirmed=True)  # no quiet hours
    rid, token = made(pw)
    pw.world.run_until(dt.datetime(2026, 11, 2, 21, 30, tzinfo=UTC))         # 23:30 local
    assert fire(pw, rid, token)["doors"][0]["reason"] == "crosses_midnight"


def test_caps_cooldown_and_the_installation_day(pw):
    rid, token = made(pw, max_per_day=1, cooldown_s=0)
    assert fire(pw, rid, token, "1")["doors"][0]["decision"] == "simulated"
    assert fire(pw, rid, token, "2")["doors"][0]["reason"] == "rule_daily_cap"
    rid2, token2 = made(pw, name="שניה", max_per_day=3, cooldown_s=900)
    assert fire(pw, rid2, token2, "3")["doors"][0]["reason"] == "cooldown", "the door was triggered a moment ago"


def test_the_installation_day_cap_counts_every_origin(pw):
    rid, token = made(pw, source="ha_event")
    pw.rule(periods=[{"weekday": 1, "start": "12:00", "end": "13:00"}, {"weekday": 1, "start": "14:00", "end": "15:00"}, {"weekday": 1, "start": "16:00", "end": "17:00"}])
    pw.sync()
    assert fire(pw, rid, token)["doors"][0]["reason"] == "daily_cap", "three weekly windows already planned for today (doors.windows.max_per_day_per_door = 3)"


def test_the_storm_cap_stops_a_loop_and_alerts_once(pw):
    rid, token = made(pw, cooldown_s=0, max_per_day=3)
    with pw.db.connection() as conn:
        for i in range(dwt.STORM_PER_HOUR):
            conn.execute("INSERT INTO door_window_trigger_log(id, at, source, rule_id, station_id, relay, decision) VALUES (?, ?, 'ha_event', ?, ?, 1, 'simulated')",
                         (f"l{i}", pw.dw.iso(pw.now() - dt.timedelta(minutes=5)), rid, pw.SIDE))
    r = fire(pw, rid, token)
    assert r["doors"][0]["reason"] == "storm"
    fire(pw, rid, token)
    assert len(pw.rows("SELECT * FROM notifications WHERE source = 'door.windows.storm'")) == 1, "one alert an hour"


def test_sr5_an_unconfirmed_relock_an_override_and_an_emergency_block_a_trigger(live):
    for blocker, setup in (("relock_unconfirmed", lambda c: c.execute("""INSERT INTO door_window_occurrences(id, station_id, relay, start_at, end_at, zone, token, origin, tier, state, created_at, updated_at)
                                    VALUES ('u1', ?, 1, '2026-11-02T01:00:00Z', '2026-11-02T02:00:00Z', 'Asia/Jerusalem', '2026-11-02/03:00/04:00', 'weekly', 'program',
                                    'relock_unconfirmed', 'x', 'x')""", (live.ENTRY,))),
                           ("paused", lambda c: c.execute("INSERT INTO door_window_engine(station_id, relay, tier, paused_until) VALUES (?, 1, 'program', '2026-11-02T09:00:00Z')", (live.ENTRY,)))):
        with live.db.connection() as conn:
            setup(conn)
        assert fire(live, live.rid, live.token)["doors"][0]["reason"] == blocker
        with live.db.connection() as conn:
            conn.execute("DELETE FROM door_window_occurrences")
            conn.execute("DELETE FROM door_window_engine")
    live.emergency_on()
    r = live.press("lock_secure")
    assert r.status_code == 201, r.text
    assert fire(live, live.rid, live.token)["doors"][0]["reason"] in ("emergency", "paused")
    assert events(live) == []


def test_the_authorising_actor_is_rechecked_at_fire_time(pw):
    role = pw.role("מנהל חלונות עמדה", ["access.windows.manage"])
    pw.bind("stan", role, "access_control_station", pw.ENTRY)
    rid, token = made(pw, user="stan")
    assert fire(pw, rid, token)["doors"][0]["decision"] == "simulated"
    with pw.db.connection() as conn:
        conn.execute("DELETE FROM bindings WHERE subject_id = 'dev-stan'")
    r = fire(pw, rid, token)
    assert r["decision"] == "refused" and r["reason"] == "authorising_actor_lost"
    assert pw.rows("SELECT reason FROM door_window_trigger_log ORDER BY at DESC LIMIT 1")[0]["reason"] == "authorising_actor_lost"
    assert events(pw) == []


def test_an_exterior_door_is_never_held_by_an_event(pw):
    rid, token = made(pw, doors=[(pw.DOCK, 2)])
    pw.put(f"/doors/windows/doors/{pw.DOCK}/2/flags", exterior=True, confirmed=True)
    assert fire(pw, rid, token)["doors"][0]["reason"] == "exterior_not_allowed"


# ================================================================ the Arx automation source

def seed_automation(p, revision="rev-1"):
    with p.db.connection() as conn:
        conn.execute("""INSERT INTO ha_config_items(kind, item_id, config_id, entity_id, source, revision, config_json, masked, reason, seen_at, changed_at)
                        VALUES ('automation', 'cfg1', 'cfg1', 'automation.lobby_motion', 'ui', ?, '{}', 0, NULL, 'x', 'x')""", (revision,))


def test_an_arx_automation_trigger_is_matched_by_entity_and_live_revision(pw, monkeypatch):
    seed_automation(pw)
    rid, _ = made(pw, source="arx_automation", automation_id="automation.lobby_motion")
    frame = lambda: {"id": 1, "type": "event", "event": {"event_type": "automation_triggered", "data": {"entity_id": "automation.lobby_motion"}, "context": {"id": "run-1"}}}
    dwt.on_automation_event(pw.db, pw.settings, frame())
    assert [x["decision"] for x in pw.rows("SELECT decision FROM door_window_trigger_log")] == ["simulated"]
    other = frame()
    other["event"]["data"]["entity_id"] = "automation.other"
    dwt.on_automation_event(pw.db, pw.settings, other)
    assert len(pw.rows("SELECT * FROM door_window_trigger_log")) == 1
    with pw.db.connection() as conn:
        conn.execute("UPDATE ha_config_items SET revision = 'rev-2'")
    dwt.on_automation_event(pw.db, pw.settings, {**frame(), "event": {**frame()["event"], "context": {"id": "run-2"}}})
    assert len(pw.rows("SELECT * FROM door_window_trigger_log")) == 1, "an edited automation is not the one the approver saw: refused, not logged as a trigger"
    assert any(json.loads(a["details_json"]).get("trigger_ref") == "run-2" for a in pw.rows("SELECT details_json FROM audit_log WHERE action = 'door.window.trigger'"))


# ================================================================ the person's click: "open for N hours"

def test_open_for_needs_manage_a_confirmation_and_a_person(pw):
    pw.bind("op", "operator")                       # operators hold access.windows.cancel only
    url = f"/doors/windows/doors/{pw.ENTRY}/1/open-for"
    assert pw.post(url, "op", duration_s=3600, confirmed=True).status_code == 403
    assert pw.post(url, duration_s=3600).json()["code"] == "confirmation_required"
    assert pw.post(url, duration_s=30, confirmed=True).status_code == 422
    pw.bind("wall1", "site_admin")
    pw.bind("wall1", "kiosk")
    assert pw.post(url, "wall1", duration_s=3600, confirmed=True).json()["details"]["reason"] == "wall_account"
    pw.put("/doors/windows/settings", changes={"doors.windows.enabled": "off"}, confirmed=True)
    assert pw.post(url, duration_s=3600, confirmed=True).json()["code"] == "windows_off"
    assert events(pw) == []


def test_open_for_creates_a_hold_the_engine_executes(pw):
    pw.job = pw.world.scheduler.every(15, pw.watch, owner="arx", name="watchdog")
    r = pw.post(f"/doors/windows/doors/{pw.ENTRY}/1/open-for", duration_s=3600, confirmed=True)
    assert r.status_code == 200 and r.json()["decision"]["decision"] == "started", r.text
    (o,) = events(pw)
    assert o["rule_id"] is None and o["origin"] == "event" and o["end_at"] == "2026-11-02T06:01:00Z"
    pw.sync()
    pw.world.run_until(dt.datetime(2026, 11, 2, 5, 3, tzinfo=UTC))
    assert pw.world.bank.truth_open((pw.ENTRY, 1)) and events(pw)[0]["state"] == "active"
    pw.world.run_until(dt.datetime(2026, 11, 2, 6, 5, tzinfo=UTC))
    assert events(pw)[0]["state"] == "closed_confirmed"
    assert "door.window.open_for" in pw.audit_actions()


def test_open_for_refuses_a_door_inside_a_window_and_a_second_click_inside_the_first(pw):
    pw.rule(periods=[{"weekday": 1, "start": "07:30", "end": "09:00"}])
    pw.sync()
    r = pw.post(f"/doors/windows/doors/{pw.ENTRY}/1/open-for", duration_s=3600, confirmed=True)
    assert r.status_code == 409 and r.json()["details"]["reason"] in ("overlaps_window", "inside_window")
    r = pw.post(f"/doors/windows/doors/{pw.SIDE}/1/open-for", duration_s=3600, confirmed=True)
    assert r.status_code == 200
    again = pw.post(f"/doors/windows/doors/{pw.SIDE}/1/open-for", duration_s=1800, confirmed=True)
    assert again.status_code == 409 and again.json()["details"]["reason"] == "already_covered"


def test_open_for_in_tier_d_is_only_a_plan(tier_d):
    r = tier_d.post(f"/doors/windows/doors/{tier_d.ENTRY}/1/open-for", duration_s=1800, confirmed=True)
    assert r.status_code == 200, r.text
    (o,) = events(tier_d)
    assert o["state"] == "prepared" and o["tier"] == "prepared"
    tier_d.sync()
    assert events(tier_d)[0]["state"] == "prepared", "tier D keeps the plan; nothing is written anywhere"


# ================================================================ SR-1: this module can only plan

def test_the_trigger_module_cannot_send_anything():
    src = (Path(dwt.__file__)).read_text(encoding="utf-8")
    body = re.sub(r'""".*?"""', "", src, flags=re.S)
    for needle in (".save(", ".pause(", ".apply(", ".release(", "release_door", "alwaysOpen", "test_unlock", "intercom_client", "intercom_writes", "window_engine("):
        assert needle not in body.replace("dwe.window_engine(settings).tier", ""), needle
    assert "dwe.window_engine(settings).tier" in body, "the only engine contact is reading which tier is in use"
