"""CR-018 S2, the product's own sources: camera and NVR faults, system health, backups, the update check, the WisKey doorbell, schedule runs,
automation failures, bulk and scene results, new remote sign-ins and code lockouts - and the monitor thread that runs them. Each source fires, folds,
resolves, reaches only who may see it, and never carries a person into a payload. Quiet hours are decided by the pipeline, not by the source."""
from __future__ import annotations

import copy
import datetime as dt
import json
import os
import time

import pytest
from conftest import as_user
from notify_src_world import API, Clock, World, clock, fake_push, iso  # noqa: F401 - fixtures
from test_intercom import OFFLINE, OVERVIEW, STATION

from smplwise.services import backup as backup_svc
from smplwise.services import notify, notify_policy, notify_sources
from smplwise.services import intercom_sync


@pytest.fixture()
def w(settings, clock) -> World:  # noqa: F811
    return World(settings, clock)


def healthy(**override):
    items = {"nvr": None, "ha": None, "go2rtc": None, "discovery": None, "thumbnails": None, **override}
    return {"status": "ok", "items": [{"id": k, "status": v, "label": k} for k, v in items.items() if v]}


NO_BACKUP_ISSUE = {"known": True, "none": False, "age_s": 3600.0}


# ---------------------------------------------------------------- the catalogue defaults of CR section 5

def test_every_v1_source_has_a_policy_and_the_defaults_of_the_cr(w):
    with w.db.connection() as conn:
        pols = {p["source"]: p for p in notify_policy.list_policies(conn)}
    wanted = ["sensor.leak", "sensor.smoke", "sensor.gas", "sensor.co", "alarm.triggered", "alarm.arm_failed", "alarm.state", "camera.offline", "nvr.offline", "nvr.storage", "backup.failed",
              "backup.stale", "system.health", "update.available", "opening.left_open", "door.ring", "schedule.not_confirmed", "automation.failed", "automation.notify", "device.battery_low",
              "device.unavailable", "security.new_signin", "security.lockout", "bulk.partial"]
    assert all(s in pols for s in wanted)
    off = sorted(s for s in wanted if not pols[s]["enabled"])
    assert off == ["alarm.state"], "every source is on by default except alarm.state (and the NVR smart events, which only rules turn into notifications)"
    assert all(not pols[s]["enabled"] for s in ("camera.motion", "camera.person", "camera.vehicle"))
    assert pols["update.available"]["channels"] == {"inbox": True, "webpush": False, "email": True, "ha_mobile": False, "whatsapp": False}
    assert (pols["opening.left_open"]["after_s"], pols["camera.offline"]["after_s"], pols["nvr.offline"]["after_s"], pols["system.health"]["after_s"], pols["device.unavailable"]["after_s"]) == (600, 120, 120, 300, 900)


# ---------------------------------------------------------------- camera.offline

def test_camera_offline_is_held_then_announced_once_and_resolves_when_discovery_finds_it_online(w, clock):
    w.camera_status("offline", clock.now)
    w.tick()
    assert w.rows("camera.offline") == [], "held for the policy's 120 s"
    clock.advance(seconds=100)
    w.tick()
    assert w.rows("camera.offline") == []
    clock.advance(seconds=30)
    w.tick()
    n = w.one("camera.offline")
    assert (n["severity"], n["category"], n["subject_kind"], n["subject_id"], n["place"]) == ("alert", "device_faults", "camera", w.cam, "לובי")
    assert json.loads(n["origin_json"])["camera_id"] == w.cam
    for _ in range(3):
        clock.advance(minutes=2)
        w.tick()
    assert w.one("camera.offline")["count"] == 1, "folded forever: one row for one open condition"
    assert w.recipients(n["id"]) == {"joni", "ops2"}, "the floor-2 operator sees the floor-2 camera (events.read); the floor-3 operator, a viewer without events.read and a user with no binding do not"
    w.camera_status("online", clock.now)
    w.tick()
    assert w.one("camera.offline")["state"] == "resolved"


def test_a_video_loss_event_counts_until_a_later_discovery_says_online(w, clock):
    w.camera_status("online", clock.now - dt.timedelta(minutes=5))
    w.event("offline", "videoloss", "active", at=clock.now - dt.timedelta(minutes=3), camera=w.cam)
    w.tick()
    clock.advance(seconds=130)
    w.tick()
    assert w.one("camera.offline")["state"] == "open"
    w.camera_status("online", clock.now)  # a discovery after the loss: the channel is back (the device never closes the loss event)
    w.tick()
    assert w.one("camera.offline")["state"] == "resolved"


def test_a_flapping_camera_makes_no_row_and_a_disabled_camera_is_ignored(w, clock):
    w.camera_status("offline", clock.now)
    w.tick()
    clock.advance(seconds=60)
    w.camera_status("online", clock.now)
    w.tick()
    clock.advance(seconds=200)
    w.tick()
    assert w.rows("camera.offline") == []
    w.camera_status("offline", clock.now)
    with w.db.connection() as conn:
        conn.execute("UPDATE cameras SET enabled = 0 WHERE id = ?", (w.cam,))
    w.tick()
    clock.advance(seconds=300)
    w.tick()
    assert w.rows("camera.offline") == []


# ---------------------------------------------------------------- nvr.storage

def test_nvr_storage_fault_reaches_the_administrators_and_clears_when_the_device_stops_reporting(w, clock):
    w.event("storage", "diskfull", "active", at=clock.now - dt.timedelta(minutes=1))
    w.tick()
    n = w.one("nvr.storage")
    assert (n["severity"], n["category"], n["subject_kind"]) == ("critical", "device_faults", "system") and "מלא" in n["body"]
    assert w.recipients(n["id"]) == {"joni"}, "system subjects: system.configure holders only"
    clock.advance(minutes=10)
    w.tick()
    assert w.one("nvr.storage")["count"] == 1 and w.one("nvr.storage")["state"] == "open"
    clock.advance(hours=3)
    w.tick()
    assert w.one("nvr.storage")["state"] == "resolved"


# ---------------------------------------------------------------- health, NVR, backups

def test_nvr_offline_is_held_two_minutes_critical_for_managers_and_resolves(w, clock):
    def run(**items):
        with w.db.connection() as conn:
            return notify_sources.health_tick(conn, healthy(**items), NO_BACKUP_ISSUE, clock.now)

    run(nvr="error")
    clock.advance(seconds=100)
    run(nvr="error")
    assert w.rows("nvr.offline") == []
    clock.advance(seconds=30)
    run(nvr="error")
    n = w.one("nvr.offline")
    assert (n["severity"], n["category"], n["subject_kind"], n["subject_id"]) == ("critical", "device_faults", "system", "nvr")
    assert w.recipients(n["id"]) == {"joni"}
    clock.advance(minutes=5)
    run(nvr="error")
    assert w.one("nvr.offline")["count"] == 1
    run(nvr=None)
    assert w.one("nvr.offline")["state"] == "resolved"


def test_a_restart_in_the_middle_of_an_outage_resolves_nothing(w, clock):
    def run(**items):
        with w.db.connection() as conn:
            return notify_sources.health_tick(conn, healthy(**items), NO_BACKUP_ISSUE, clock.now)

    run(nvr="error")
    clock.advance(seconds=130)
    run(nvr="error")
    assert w.one("nvr.offline")["state"] == "open"
    notify_sources.reset()  # the process restarted: the timers are gone, the row is not
    clock.advance(seconds=10)
    run(nvr="error")
    assert w.one("nvr.offline")["state"] == "open", "an active condition that is not yet re-held keeps its row"


def test_system_health_covers_ha_go2rtc_discovery_and_thumbnails_after_five_minutes(w, clock):
    def run(**items):
        with w.db.connection() as conn:
            return notify_sources.health_tick(conn, healthy(**items), NO_BACKUP_ISSUE, clock.now)

    run(ha="warn", go2rtc="warn")
    clock.advance(seconds=290)
    run(ha="warn", go2rtc="warn")
    assert w.rows("system.health") == []
    clock.advance(seconds=20)
    run(ha="warn", go2rtc="warn")
    rows = w.rows("system.health")
    assert sorted(r["subject_id"] for r in rows) == ["go2rtc", "ha"] and all(r["severity"] == "alert" and r["category"] == "system" for r in rows)
    assert not any("Home Assistant" in r["body"] or "HA" in r["body"].split() for r in rows), "operator wording: the system's own infrastructure, never the product's name"
    run(ha="warn")
    assert {r["subject_id"]: r["state"] for r in w.rows("system.health")} == {"ha": "open", "go2rtc": "resolved"}
    assert w.recipients(rows[0]["id"]) == {"joni"}


def test_backup_stale_for_an_old_backup_or_none_after_two_days(w, clock):
    def run(facts):
        with w.db.connection() as conn:
            return notify_sources.health_tick(conn, healthy(), facts, clock.now)

    run({"known": True, "none": True, "age_s": None, "uptime_s": 3600})
    assert w.rows("backup.stale") == [], "a fresh installation has not had time to make its first backup"
    run({"known": True, "none": False, "age_s": 3 * 86400})
    n = w.one("backup.stale")
    assert (n["severity"], n["category"]) == ("info", "system") and w.recipients(n["id"]) == {"joni"}
    run({"known": True, "none": False, "age_s": 3 * 86400 + 60})
    assert w.one("backup.stale")["count"] == 1
    run({"known": True, "none": False, "age_s": 100})
    assert w.one("backup.stale")["state"] == "resolved"
    run({"known": True, "none": True, "age_s": None, "uptime_s": 3 * 86400})
    assert len(w.rows("backup.stale", "open")) == 1


def test_backup_failed_resolves_with_the_next_good_backup(w, clock, settings):
    notify_sources.backup_failed(w.db)
    n = w.one("backup.failed")
    assert (n["severity"], n["category"]) == ("alert", "system") and w.recipients(n["id"]) == {"joni"}
    d = backup_svc.backups_dir(settings)
    d.mkdir(parents=True, exist_ok=True)
    old = d / "daily-old.zip"
    old.write_bytes(b"x")
    os.utime(old, (clock.now.timestamp() - 3600, clock.now.timestamp() - 3600))
    with w.db.connection() as conn:
        assert notify_sources.backup_resolution(conn, notify_sources._backup_facts(settings)) == {"backup_resolved": 0}, "a backup older than the failure resolves nothing"
    clock.advance(minutes=1)
    new = d / "daily-new.zip"
    new.write_bytes(b"x")
    os.utime(new, (clock.now.timestamp() + 5, clock.now.timestamp() + 5))
    with w.db.connection() as conn:
        assert notify_sources.backup_resolution(conn, notify_sources._backup_facts(settings)) == {"backup_resolved": 1}
    assert w.one("backup.failed")["state"] == "resolved"


def test_the_backup_loop_signals_a_failure_without_stopping(w, monkeypatch, settings):
    import asyncio

    def boom(*a, **k):
        raise RuntimeError("disk full")

    monkeypatch.setattr(backup_svc, "create_standalone", boom)

    async def one_round():
        task = asyncio.create_task(backup_svc.daily_loop(w.db, settings, interval_s=0))
        for _ in range(100):
            await asyncio.sleep(0.05)
            if w.rows("backup.failed"):
                break
        task.cancel()

    asyncio.run(one_round())
    assert w.one("backup.failed")["state"] == "open"


# ---------------------------------------------------------------- the update check

def test_update_available_once_per_version_then_resolved_when_installed(w, clock, settings):
    answers = [{"update_available": True, "version_latest": "0.1.150"}]
    calls = []
    notify_sources.UPDATE_FETCHER = lambda s: (calls.append(1), answers[0])[1]
    try:
        assert notify_sources.update_tick(w.db, settings, clock.now.timestamp()) == "available"
        n = w.one("update.available")
        assert (n["severity"], n["category"], n["subject_kind"]) == ("info", "system", "system") and "0.1.150" in n["body"] and w.recipients(n["id"]) == {"joni"}
        assert notify_sources.update_tick(w.db, settings, clock.now.timestamp() + 60) == "skipped" and len(calls) == 1, "the Supervisor is asked every six hours at most"
        clock.advance(hours=7)
        assert notify_sources.update_tick(w.db, settings, clock.now.timestamp()) == "available" and len(w.rows("update.available")) == 1
        answers[0] = {"update_available": True, "version_latest": "0.1.151"}
        clock.advance(hours=7)
        notify_sources.update_tick(w.db, settings, clock.now.timestamp())
        assert {r["dedupe_key"].rsplit(":", 1)[1]: r["state"] for r in w.rows("update.available")} == {"0.1.150": "resolved", "0.1.151": "open"}
        answers[0] = {"update_available": False, "version_latest": "0.1.151"}
        clock.advance(hours=7)
        assert notify_sources.update_tick(w.db, settings, clock.now.timestamp()) == "current"
        assert w.rows("update.available", "open") == []
        answers[0] = {"update_available": True, "version_latest": "bad version; drop table"}
        clock.advance(hours=7)
        assert notify_sources.update_tick(w.db, settings, clock.now.timestamp()) == "current", "a version string that is not a version is never turned into a notification"
    finally:
        notify_sources.UPDATE_FETCHER = None


def test_a_developer_backend_never_asks_the_supervisor(settings, w, clock):
    assert notify_sources.update_tick(w.db, settings, clock.now.timestamp()) == "unknown"


# ---------------------------------------------------------------- WisKey doorbell

def _stations(ringing: bool = False, name: str = "שער ראשי") -> list[dict]:
    s = copy.deepcopy(STATION)
    s["name"] = name
    s["call_state"] = "ringing" if ringing else "idle"
    return [s, copy.deepcopy(OFFLINE)]


def test_a_wiskey_station_that_starts_ringing_signals_door_ring_with_the_place_only(w, clock):
    idle = _stations(False)
    ring = _stations(True)
    assert notify_sources.on_stations(idle, ring) == 1
    assert notify_sources.on_stations(ring, ring) == 0, "no edge, no signal"
    assert w.rows("door.ring") == [], "queued for the notifier's thread, never written on the feed's loop"
    assert notify_sources.flush_signals(w.db) == 1
    n = w.one("door.ring")
    assert (n["category"], n["severity"], n["subject_kind"], n["subject_id"], n["state"]) == ("doors", "alert", "door", "entry-a", "open")
    assert n["title"] == "צלצול בדלת" and "שער ראשי" in n["body"]
    blob = json.dumps(n, ensure_ascii=False)
    for forbidden in ("Dana", "1001", "person_name", "employee_no", "last_access", "card", "192.0.2", "DS-KV6113"):
        assert forbidden not in blob, f"{forbidden!r} must never reach a notification row"
    # who is told: the holders of access.read; the inbox row carries the deep-link target - a name and whether the caller may open it, never a token
    assert "joni" in w.recipients(n["id"]) and not ({"nobody", "ops3"} & w.recipients(n["id"]))
    door = w.inbox("joni")[0]["door"]
    assert door == {"id": "entry-a", "name": "שער ראשי", "can_open": True}
    # the ring ends (answered, rejected, hung up): the row is resolved
    notify_sources.on_stations(ring, idle)
    notify_sources.flush_signals(w.db)
    assert w.one("door.ring")["state"] == "resolved"


def test_wiskey_ringing_on_an_offline_station_and_the_first_overview_after_a_reconnect(w, clock):
    off = _stations(False)
    off[0]["online"] = False
    off[0]["call_state"] = "ringing"
    assert notify_sources.on_stations([], off) == 0, "an offline station is not ringing"
    assert notify_sources.on_stations([], _stations(True)) == 1, "a ring already in progress when the feed connects is a ring"
    notify_sources.flush_signals(w.db)
    assert len(w.rows("door.ring")) == 1


def test_a_second_ring_inside_a_minute_folds_and_a_lost_end_is_swept(w, clock):
    idle, ring = _stations(False), _stations(True)
    notify_sources.on_stations(idle, ring)
    notify_sources.flush_signals(w.db)
    clock.advance(seconds=20)
    notify_sources.on_stations(idle, ring)
    notify_sources.flush_signals(w.db)
    assert w.one("door.ring")["count"] == 2
    clock.advance(minutes=14)
    with w.db.connection() as conn:
        assert notify_sources.ring_expiry(conn, clock.now) == {"rings_expired": 0}
    clock.advance(minutes=2)
    with w.db.connection() as conn:
        assert notify_sources.ring_expiry(conn, clock.now) == {"rings_expired": 1}
    assert w.one("door.ring")["state"] == "resolved"


def test_the_real_intercom_cache_store_signals_a_ring(w, clock):
    sync = intercom_sync.IntercomSync()
    ov = copy.deepcopy(OVERVIEW)
    sync._store(ov)
    assert notify_sources._SIGNALS.qsize() == 0
    ov["stations"][0]["call_state"] = "ringing"
    assert sync._store(ov) is True
    assert notify_sources.flush_signals(w.db) == 1 and w.one("door.ring")["subject_id"] == "entry-a"
    ov["stations"][0]["call_state"] = "idle"
    sync._store(ov)
    notify_sources.flush_signals(w.db)
    assert w.one("door.ring")["state"] == "resolved"


def test_the_doorbell_row_offers_no_action_only_a_deep_link_target(w, clock):
    notify_sources.on_stations(_stations(False), _stations(True))
    notify_sources.flush_signals(w.db)
    n = w.one("door.ring")
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notify_action_tokens").fetchone()[0] == 0
    row = w.inbox("joni")[0]
    assert set(row["door"]) == {"id", "name", "can_open"} and row["id"] == n["id"]
    assert "unlock" not in json.dumps(row).lower()


# ---------------------------------------------------------------- schedules (CR-014) and automations (CR-017)

def _schedule_row(w, sid="sch1", name="דריכת הבית", owner="ops2", entities=("alarm_control_panel.home_panel",)):
    return dict(conn=None, schedule_id=sid, name=name, entity_ids=list(entities), owner_user_id=f"dev-{owner}")


def test_a_sensitive_schedule_run_that_was_not_confirmed_tells_the_administrators_and_the_next_good_run_resolves_it(w, clock):
    def settle(result, sensitive=True):
        with w.db.connection() as conn:
            notify_sources.on_schedule_run(conn, "sch1", "דריכת הבית", result, sensitive, ["alarm_control_panel.home_panel"], "dev-ops2", f"run-{result}")

    settle("not_confirmed", sensitive=False)
    assert w.rows("schedule.not_confirmed") == [], "only SENSITIVE schedules notify"
    settle("unknown")
    assert w.rows("schedule.not_confirmed") == []
    settle("not_confirmed")
    n = w.one("schedule.not_confirmed")
    assert (n["severity"], n["category"], n["subject_kind"]) == ("alert", "automations", "schedule") and "דריכת הבית" in n["body"]
    assert "נכשל" not in n["body"], "the scheduler's wording is never 'failed'"
    assert w.recipients(n["id"]) == {"joni"}, "the setting notify.failures_audience defaults to the administrators"
    settle("skipped")
    assert w.one("schedule.not_confirmed")["count"] == 2
    settle("confirmed")
    assert w.one("schedule.not_confirmed")["state"] == "resolved"


def test_failures_audience_visible_adds_whoever_may_see_the_schedule(w, clock):
    with w.db.connection() as conn:
        notify_sources.on_schedule_run(conn, "sch1", "דריכת הבית", "not_confirmed", True, ["alarm_control_panel.home_panel"], "dev-ops2", "r1")
    admins_only = w.recipients(w.one("schedule.not_confirmed")["id"])
    assert admins_only == {"joni"}
    w.set_settings(failures_audience="visible")
    with w.db.connection() as conn:
        notify_sources.on_schedule_run(conn, "sch2", "תזמון שני", "not_confirmed", True, [], "dev-ops2", "r2")
    second = next(r for r in w.rows("schedule.not_confirmed") if r["subject_id"] == "sch2")
    assert {"joni", "ops2"} <= w.recipients(second["id"]), "the owner of record sees the schedule, so with 'visible' they are told"
    assert "ops3" not in w.recipients(second["id"])


def test_automation_failed_is_an_emit_able_hook_with_the_same_audience_rule(w, clock):
    with w.db.connection() as conn:
        nid = notify_sources.automation_failed(conn, "auto1", "כיבוי תאורה", "הצעד השלישי לא הושלם", owner_user_id="dev-ops2", entity_ids=["light.hall"], run_id="r9")
    assert nid
    n = w.one("automation.failed")
    assert (n["severity"], n["category"], n["subject_kind"], n["subject_id"]) == ("alert", "automations", "automation", "auto1") and w.recipients(nid) == {"joni"}
    with w.db.connection() as conn:
        assert notify_sources.automation_failed(conn, "auto1", "כיבוי תאורה", "שוב") is None
    assert w.one("automation.failed")["count"] == 2, "a failing automation folds inside ten minutes"
    with w.db.connection() as conn:
        assert notify_sources.automation_notify(conn, "auto1", "כיבוי תאורה", key="done")


# ---------------------------------------------------------------- bulk and scene results

def test_a_bulk_that_was_not_fully_confirmed_tells_only_its_initiator(w, clock):
    body = {"id": "bulk1", "kind": "lights_off", "kind_label": "כיבוי תאורה", "scope_name": "קומה 2", "principal_user_id": "dev-ops2", "counts": {"total": 5, "confirmed": 3, "sent": 0, "not_confirmed": 1, "refused": 1, "unknown": 0}}
    with w.db.connection() as conn:
        notify_sources.on_bulk_finished(conn, body)
        notify_sources.on_bulk_finished(conn, {**body, "id": "bulk2", "counts": {"total": 5, "confirmed": 5}})
        notify_sources.on_bulk_finished(conn, {**body, "id": "bulk3", "counts": {"total": 2, "confirmed": 0, "sent": 2}})
    n = w.one("bulk.partial")
    assert (n["severity"], n["category"], n["subject_kind"], n["subject_id"]) == ("info", "automations", "bulk_job", "bulk1") and "2 מתוך 5" in n["body"]
    assert w.recipients(n["id"]) == {"ops2"}, "not even the administrator: a bulk job is its initiator's"
    assert [x["id"] for x in w.inbox("ops2")] == [n["id"]] and w.inbox("joni") == []


def _bulk_row(w, bulk_id, user="dev-ops2", fail=True):
    now = iso(w.clock.now)
    with w.db.connection() as conn:
        conn.execute(
            "INSERT INTO device_bulk_actions(id, scope, scope_id, scope_name, kind, principal_user_id, principal_username, client_request_id, entity_count, status, requested_at, not_after, origin) "
            "VALUES (?, 'floor', 'second', 'קומה 2', 'lights_off', ?, 'ops2', ?, 2, 'waiting', ?, ?, 'devices')", (bulk_id, user, bulk_id, now, now))
        for i, (status, error) in enumerate((("confirmed", None), ("failed", "ha_unavailable") if fail else ("confirmed", None))):
            conn.execute("INSERT INTO ha_actions(id, entity_id, action_id, arguments_json, principal_user_id, client_request_id, status, error, requested_at, expected_state, bulk_id) "
                         "VALUES (?, ?, 'light.turn_off', '{}', ?, ?, ?, ?, ?, 'off', ?)", (f"{bulk_id}-{i}", f"light.l{i}", user, f"{bulk_id}-{i}", status, error, now, bulk_id))


def test_device_bulk_finish_calls_the_hook(w, clock):
    from smplwise.services import device_bulk

    _bulk_row(w, "b-fail", fail=True)
    _bulk_row(w, "b-ok", fail=False)
    device_bulk.finish(w.db, "b-fail")
    device_bulk.finish(w.db, "b-ok")
    device_bulk.finish(w.db, "b-fail")  # exactly once, whoever gets there
    n = w.one("bulk.partial")
    assert n["subject_id"] == "b-fail" and w.recipients(n["id"]) == {"ops2"} and n["count"] == 1


def _action(w, aid, action_id, entity, status, error=None, user="dev-ops2", age_s=60):
    with w.db.connection() as conn:
        conn.execute(
            "INSERT INTO ha_actions(id, entity_id, action_id, arguments_json, principal_user_id, client_request_id, status, error, requested_at, expected_state) VALUES (?,?,?, '{}', ?, ?, ?, ?, ?, ?)",
            (aid, entity, action_id, user, aid, status, error, iso(w.clock.now - dt.timedelta(seconds=age_s)), "armed_away" if "arm" in action_id else None),
        )


def test_an_arm_request_the_panel_never_confirmed_and_a_failed_scene_are_told_once(w, clock):
    p = w.entity("alarm_control_panel.home", None, state="disarmed", floor=w.ids["floor2"], name="לוח אזעקה")
    w.entity("scene.evening", None, state="scening", floor=w.ids["floor2"], name="סצנת ערב")
    _action(w, "a-timeout", "alarm_control_panel.alarm_arm_away", p, "pending", age_s=60)  # nobody looked at it: the pass judges it
    _action(w, "a-badcode", "alarm_control_panel.alarm_arm_away", p, "failed", "invalid_code")
    _action(w, "a-unpaired", "alarm_control_panel.alarm_arm_away", p, "failed", "bridge_not_paired")
    _action(w, "a-refused", "alarm_control_panel.alarm_arm_home", p, "failed", "bridge_error")
    _action(w, "s-fail", "scene.turn_on", "scene.evening", "failed", "bridge_error")
    _action(w, "s-ok", "scene.turn_on", "scene.evening", "confirmed")
    with w.db.connection() as conn:
        first = notify_sources.action_results(conn, clock.now)
    assert first == {"arm_failed": 2, "scene_failed": 1}
    rows = w.rows("alarm.arm_failed")
    assert len(rows) == 2 and all(r["severity"] == "alert" and r["category"] == "safety" and r["subject_kind"] == "alarm_panel" for r in rows)
    assert "joni" in w.recipients(rows[0]["id"])
    scene = w.one("bulk.partial")
    assert w.recipients(scene["id"]) == {"ops2"} and "סצנת ערב" in scene["body"]
    with w.db.connection() as conn:
        assert notify_sources.action_results(conn, clock.now) == {"arm_failed": 0, "scene_failed": 0}
    notify_sources._HANDLED.clear()  # a restart forgets what it judged; the notification rows are the durable record
    with w.db.connection() as conn:
        assert notify_sources.action_results(conn, clock.now) == {"arm_failed": 0, "scene_failed": 0}


# ---------------------------------------------------------------- security

def test_a_sign_in_from_a_new_device_tells_the_account_owner_only(w, clock):
    chrome = {"user_agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36", "client_ip": "203.0.113.9"}
    iphone = {"user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1", "client_ip": "203.0.113.10"}
    assert notify_sources.remote_sign_in(w.db, "dev-ops2", chrome) is False, "the first device the system learns for an account is learned silently"
    assert w.rows("security.new_signin") == []
    chrome2 = {**chrome, "user_agent": chrome["user_agent"].replace("126.0", "127.0")}
    assert notify_sources.remote_sign_in(w.db, "dev-ops2", chrome2) is False, "a browser update is not a new device"
    assert notify_sources.remote_sign_in(w.db, "dev-ops2", iphone) is True
    n = w.one("security.new_signin")
    assert (n["severity"], n["category"], n["subject_kind"], n["subject_id"]) == ("alert", "security", "session", "dev-ops2") and "Safari" in n["place"] and "iOS" in n["place"]
    assert w.recipients(n["id"]) == {"ops2"}, "the account's own user; not the administrator"
    blob = json.dumps(n, ensure_ascii=False)
    assert "203.0.113" not in blob and "Mozilla" not in blob and "17_5" not in blob
    assert notify_sources.remote_sign_in(w.db, "dev-ops2", iphone) is False
    assert len(w.rows("security.new_signin")) == 1
    with w.db.connection(mode="read") as conn:
        assert [r["device_hash"] for r in conn.execute("SELECT device_hash FROM notify_known_devices WHERE user_id = 'dev-ops2'")] and "Mozilla" not in json.dumps([dict(r) for r in conn.execute("SELECT * FROM notify_known_devices")])


def test_the_real_remote_sign_in_record_calls_the_hook(w, clock):
    from smplwise.rbac import Principal
    from smplwise.services import ha_user_auth

    p = Principal(user_id="dev-vera", username="vera", display_name="vera", source="remote")
    ha_user_auth._record_sign_in(w.db, p, {"client_ip": "198.51.100.7", "country": "IL", "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"})
    ha_user_auth._record_sign_in(w.db, p, {"client_ip": "198.51.100.7", "country": "IL", "user_agent": "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0"})
    n = w.one("security.new_signin")
    assert w.recipients(n["id"]) == {"vera"} and "Firefox" in n["place"]


def test_a_code_lockout_tells_the_administrators_without_the_code(w, clock):
    with w.db.connection() as conn:
        notify_sources.code_lockout(conn, "dev-ops2")
        notify_sources.code_lockout(conn, "dev-ops2")
    n = w.one("security.lockout")
    assert (n["severity"], n["category"], n["subject_kind"]) == ("alert", "security", "session") and n["count"] == 2
    assert w.recipients(n["id"]) == {"joni"}


def test_the_alarm_gate_lockout_reaches_the_hook(w, clock, monkeypatch):
    from smplwise.rbac import Principal
    from smplwise.routers import alarm
    from smplwise.services import alarm_codes as codes

    codes.LOCKOUT.reset()
    p = Principal(user_id="dev-ops2", username="ops2", display_name="ops2", source="dev")
    plan = {"prompt": "pin", "send": "none"}
    from smplwise.errors import ApiError

    with w.db.connection() as conn:
        monkeypatch.setattr(codes, "pin_hash_of", lambda c, u: "x")
        monkeypatch.setattr(codes, "verify_pin", lambda typed, h: False)
        for i in range(5):
            with pytest.raises(ApiError):
                alarm.gate_code(conn, p, plan, "9999", {"entity_id": "alarm_control_panel.home"}, None, refuse=lambda e: e, audit_wrong=lambda locked: None)
    codes.LOCKOUT.reset()
    assert w.one("security.lockout")["subject_id"] == "dev-ops2"


# ---------------------------------------------------------------- the pipeline decides who is told when: quiet hours

def test_quiet_hours_hold_an_alert_but_a_safety_critical_passes(w, fake_push, clock, monkeypatch):
    from smplwise.services import notify_channels

    monkeypatch.setattr(notify_channels, "SENT_STALE_S", 10**9)  # the fake pipeline clock is hours away from the outbox rows' real stamps
    w.set_settings(quiet={"enabled": True, "from": "22:00", "to": "07:00", "days": ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]})
    w.subscribe("joni")
    clock.now = dt.datetime(2026, 10, 1, 20, 30, tzinfo=dt.timezone.utc)  # 23:30 local
    w.camera_status("offline", clock.now)
    w.tick()
    clock.advance(seconds=130)
    w.tick()
    leak = w.entity("binary_sensor.k_leak", "moisture", floor=w.ids["floor2"])
    w.push(leak, "off", "on", "moisture")
    w.flush()
    cam, lk = w.one("camera.offline"), w.one("sensor.leak")
    by = {(d["notification_id"], d["channel"]): d for d in w.deliveries() if d["user_id"] == "dev-joni"}
    assert by[(cam["id"], "webpush")]["status"] == "skipped" and by[(cam["id"], "webpush")]["reason"] == "quiet_hours"
    assert by[(lk["id"], "webpush")]["status"] == "sent", "critical passes the quiet-hours matrix by default"
    sent = [r for r in fake_push.to(w.browsers["joni"])]
    assert len(sent) == 1
    payload = w.browsers["joni"].decrypt(sent[0].content)
    assert payload["category"] == "safety" and payload["severity"] == "critical"
    # the inbox always has the held one
    assert {r["source"] for r in w.inbox("joni")} == {"camera.offline", "sensor.leak"}


def test_a_source_the_policy_has_off_for_push_sends_nothing_to_push(w, fake_push, clock):
    w.subscribe("joni")
    with w.db.connection() as conn:
        conn.execute("DELETE FROM notify_outbox")
    notify_sources.backup_failed(w.db)  # backup.failed: push is off by default (email only)
    w.flush()
    nid = w.one("backup.failed")["id"]
    rows = [d for d in w.deliveries(nid) if d["channel"] == "webpush"]
    assert rows == [] or all(d["status"] == "skipped" for d in rows)
    assert fake_push.to(w.browsers["joni"]) == []


# ---------------------------------------------------------------- the monitor and the signal writer

def test_submit_is_bounded_and_never_raises(w):
    notify_sources.reset()
    sig = notify.Signal("door.ring", "door", "entry-a", params={"name": "x", "place": "x"})
    assert all(notify_sources.submit(sig) for _ in range(1000))
    assert notify_sources.submit(sig) is False, "a full queue drops the signal and says so"
    assert notify_sources.flush_signals(w.db, limit=100) == 100
    notify_sources.reset()


def test_a_bad_signal_never_costs_the_others(w):
    notify_sources.submit(notify.Signal("no.such.source", "door", "x"))
    notify_sources.submit(notify.Signal("door.ring", "door", "entry-a", params={"name": "שער", "place": "שער"}))
    assert notify_sources.flush_signals(w.db) == 2
    assert w.one("door.ring")["subject_id"] == "entry-a"


def test_the_monitor_thread_writes_signals_at_once_and_stops(w, settings):
    mon = notify_sources.Monitor()
    mon.start(w.db, settings)
    try:
        notify_sources.submit(notify.Signal("door.ring", "door", "entry-a", params={"name": "שער", "place": "שער"}))
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline and not w.rows("door.ring"):
            time.sleep(0.05)
        assert w.one("door.ring")["subject_id"] == "entry-a"
    finally:
        mon.shutdown()
    assert not mon.running


def test_a_failing_group_never_stops_the_others(w, settings, clock, monkeypatch):
    from smplwise.services import health_report

    def boom(*a, **k):
        raise RuntimeError("summary failed")

    monkeypatch.setattr(health_report, "summary", boom)
    w.camera_status("offline", clock.now - dt.timedelta(minutes=5))
    notify_sources.reset()
    notify_sources.held("camera.offline:camera:" + w.cam, True, 0, clock.now.timestamp() - 600)
    out = w.tick()
    assert "health" not in out and "faults" in out and "sensors" in out


def test_the_app_starts_and_stops_the_monitor(settings):
    from fastapi.testclient import TestClient

    from smplwise.main import create_app

    with TestClient(create_app(settings)) as c:
        assert c.get("/healthz").status_code == 200
        assert notify_sources.MONITOR.running
    assert not notify_sources.MONITOR.running


def test_a_disabled_policy_silences_a_monitor_and_enabling_it_catches_up(w, clock):
    w.set_policy("camera.offline", enabled=False)
    w.camera_status("offline", clock.now)
    w.tick()
    clock.advance(seconds=200)
    w.tick()
    assert w.rows("camera.offline") == []
    w.set_policy("camera.offline", enabled=True)
    w.tick()
    assert w.one("camera.offline")["state"] == "open"


def test_nothing_in_any_source_row_carries_a_person_or_an_address(w, clock):
    """Every row this module's sources produced in this world: no `last_access`, no person field, no address, no user-agent string."""
    notify_sources.on_stations(_stations(False), _stations(True))
    notify_sources.flush_signals(w.db)
    notify_sources.remote_sign_in(w.db, "dev-ops2", {"user_agent": "Mozilla/5.0 (Linux; Android 14) Chrome/126.0", "client_ip": "203.0.113.9"})
    notify_sources.remote_sign_in(w.db, "dev-ops2", {"user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5) Safari/604.1", "client_ip": "203.0.113.10"})
    with w.db.connection() as conn:
        notify_sources.code_lockout(conn, "dev-ops2")
    blob = json.dumps(w.rows(), ensure_ascii=False)
    for needle in ("Dana", "person_name", "last_access", "203.0.113", "Mozilla", "employee_no", "password", "token"):
        assert needle not in blob
