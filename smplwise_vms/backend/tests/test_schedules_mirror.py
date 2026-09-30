"""CR-014 schedules - the mirror of the component's definitions (docs/architecture/SCHEDULER_API.md §6): the full pull, the three
refresh layers (subscription in both frame shapes and with none, the schedule switches' state events, the periodic pull), the
debounce, `schedules_changed` without ids, the component missing twice, Home Assistant down (stale, cache kept), the
`changed_outside` audit of a sensitive schedule, the transport seam (`HaSync.ws_call`, `call_bridge_schedule`), the ATTR_ALLOW
additions and the extracted helpers (`is_jewish_calendar`, `schedule_panel_check`). The component is the FAKE; no Home
Assistant is contacted."""
from __future__ import annotations

import asyncio
import datetime as dt
import json
import queue
import threading
import time

import httpx
import pytest
from schedules_fixture import *  # noqa: F401,F403
from schedules_fixture import sched_app  # noqa: F401

from smplwise.errors import ApiError
from smplwise.services import ha_client, ha_sync, schedules

API = "/api/v1"


def _rows(app):
    with app.state.db.connection(mode="read") as conn:
        return {r["schedule_id"]: dict(r) for r in conn.execute("SELECT * FROM schedule_cache").fetchall()}


def _names(c):
    return sorted(s["name"] for s in c.get(f"{API}/schedules", params={"limit": 500}).json()["items"])


def _switch_event(fake, sid, old=None):
    """The `state_changed` data HA would push for a schedule's switch."""
    st = fake.states[sid]
    new = {"entity_id": st["entity_id"], "state": st["state"], "attributes": dict(st["attributes"]), "last_changed": "2026-09-30T10:10:00+00:00", "last_updated": "2026-09-30T10:10:00+00:00"}
    return {"entity_id": st["entity_id"], "new_state": new, "old_state": old}


def _pull(app):
    return schedules.MIRROR.pull(None, "test")


# ---------------------------------------------------------------- pull

def test_the_first_request_pulls_and_later_ones_read_the_cache(sched_app):
    app, s, c, fake, tr = sched_app
    assert _rows(app) == {}
    assert len(_names(c)) == 12
    assert "scheduler" in tr.ws_calls and len(_rows(app)) == 12
    n = tr.ws_calls.count("scheduler")
    _names(c)
    c.get(f"{API}/schedules/status")
    assert tr.ws_calls.count("scheduler") == n  # the cache answers
    with app.state.db.connection(mode="read") as conn:
        st = schedules.MIRROR.state(conn)
        assert st["last_sync_at"] == "2026-09-30T10:00:00Z" and st["component_version"] == "3.3.8" and st["missing_confirmed"] is False
        meta = conn.execute("SELECT created_via, created_by FROM schedule_meta").fetchall()
        assert len(meta) == 12 and {(m[0], m[1]) for m in meta} == {("external", None)}


def test_a_pull_keeps_revisions_stable_and_records_changes(sched_app):
    app, s, c, fake, tr = sched_app
    _names(c)
    before = _rows(app)
    q = ha_sync.subscribe()
    try:
        assert _pull(app)["changed"] is False
        assert q.empty()  # nothing changed: nothing is announced
        after = _rows(app)
        assert {k: v["revision"] for k, v in before.items()} == {k: v["revision"] for k, v in after.items()}
        assert {k: v["changed_at"] for k, v in before.items()} == {k: v["changed_at"] for k, v in after.items()}
        sid = next(iter(fake.items))
        fake.call_service("scheduler", "edit", {"entity_id": fake.items[sid]["entity_id"], "name": "Edited in the card"})
        assert _pull(app)["changed"] is True
        msg = q.get(timeout=1)
        assert msg == {"type": "schedules_changed"}  # no ids: screens refetch
    finally:
        ha_sync.unsubscribe(q)
    assert _rows(app)[sid]["revision"] != before[sid]["revision"] and "Edited in the card" in _names(c)


def test_a_pull_drops_what_the_component_no_longer_has_and_keeps_the_meta(sched_app):
    app, s, c, fake, tr = sched_app
    _names(c)
    sid = next(i for i, it in fake.items.items() if it["name"] == "Gym shutter")
    fake.call_service("scheduler", "remove", {"entity_id": fake.items[sid]["entity_id"]})
    _pull(app)
    assert sid not in _rows(app) and "Gym shutter" not in _names(c)
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT gone_at FROM schedule_meta WHERE schedule_id = ?", (sid,)).fetchone()[0]  # kept, marked gone


def test_pull_does_nothing_while_the_feature_is_off(sched_app):
    app, s, c, fake, tr = sched_app
    assert c.patch(f"{API}/settings", json={"schedules.enabled": "false"}).status_code == 200
    n = len(tr.ws_calls)
    assert schedules.MIRROR.pull(None, "t") == {"skipped": "feature_disabled"}
    c.get(f"{API}/schedules/status")
    assert len(tr.ws_calls) == n  # not even a read of the component
    assert c.get(f"{API}/schedules").json()["items"] == []


# ---------------------------------------------------------------- events

@pytest.mark.parametrize("mode", ["subscription", "bus"])
def test_component_events_update_the_cache(sched_app, mode):
    app, s, c, fake, tr = sched_app
    fake.event_mode = mode
    _names(c)
    fake.ws({"id": 77, "type": "scheduler_updated"})
    sid = fake._add({"name": "Created in the card", "repeat_type": "repeat", "timeslots": [{"start": "09:00:00", "stop": None, "actions": [{"service": "light.turn_on", "entity_id": "light.office", "service_data": {}}]}]})
    assert "Created in the card" not in [r["item_json"] and json.loads(r["item_json"])["name"] for r in _rows(app).values()]
    for frame in fake.pop_events():
        schedules.MIRROR.on_component_event(frame)
    assert "Created in the card" in _names(c)
    assert tr.ws_calls[-1] == "scheduler/item" if mode == "subscription" else "scheduler" in tr.ws_calls[-3:]  # an item fetch; the id-less bus signal is a full pull
    fake.call_service("scheduler", "edit", {"entity_id": fake.items[sid]["entity_id"], "name": "Renamed in the card"})
    for frame in fake.pop_events():
        schedules.MIRROR.on_component_event(frame)
    assert "Renamed in the card" in _names(c) and "Created in the card" not in _names(c)
    fake.call_service("scheduler", "remove", {"entity_id": fake.items[sid]["entity_id"]})
    for frame in fake.pop_events():
        schedules.MIRROR.on_component_event(frame)
    if mode == "bus":
        assert sid in _rows(app)  # the bus event is not sent on remove: only the next pull notices
        _pull(app)
    assert sid not in _rows(app) and "Renamed in the card" not in _names(c)


def test_without_events_the_state_layer_and_the_periodic_pull_catch_up(sched_app):
    app, s, c, fake, tr = sched_app
    fake.event_mode = "none"
    _names(c)
    fake.ws({"id": 1, "type": "scheduler_updated"})
    sid = fake._add({"name": "Silent create", "repeat_type": "repeat", "timeslots": [{"start": "09:00:00", "stop": None, "actions": [{"service": "light.turn_on", "entity_id": "light.office", "service_data": {}}]}]})
    assert fake.pop_events() == [] and "Silent create" not in _names(c)
    # layer 2: the new schedule's switch reports a state; an unknown switch queues a pull
    ha_sync.handle_state_event(app.state.db, _switch_event(fake, sid))
    assert "Silent create" in _names(c)
    # a known switch whose next_trigger moved queues an item fetch
    fake.call_service("scheduler", "edit", {"entity_id": fake.items[sid]["entity_id"], "name": "Silent rename"})
    old = _switch_event(fake, sid)["new_state"]
    fake._t += dt.timedelta(days=1)
    fake._refresh(sid)
    ev = _switch_event(fake, sid, old={**old, "attributes": {**old["attributes"], "next_trigger": "1999-01-01T00:00:00+00:00"}})
    ha_sync.handle_state_event(app.state.db, ev)
    assert "Silent rename" in _names(c)
    # layer 3: the periodic pull sees anything else
    other = fake._add({"name": "Silent again", "repeat_type": "repeat", "timeslots": []})
    assert "Silent again" not in _names(c)
    _pull(app)
    assert "Silent again" in _names(c) and other in _rows(app)


def test_timer_events_are_ignored_and_bursts_coalesce_into_one_fetch(sched_app):
    app, s, c, fake, tr = sched_app
    _names(c)
    n = len(tr.ws_calls)
    schedules.MIRROR.on_component_event({"id": 5, "type": "event", "event": {"event": "timer_started", "schedule_id": "abcdef"}})
    assert len(tr.ws_calls) == n
    schedules.MIRROR.debounce_s = 0.15
    sid = next(iter(fake.items))
    for _ in range(5):
        schedules.MIRROR.on_component_event({"id": 5, "type": "event", "event": {"event": "item_updated", "schedule_id": sid}})
    assert len(tr.ws_calls) == n  # debounced: nothing yet
    deadline = time.time() + 3
    while time.time() < deadline and tr.ws_calls.count("scheduler/item") < 1:
        time.sleep(0.05)
    time.sleep(0.4)
    assert tr.ws_calls.count("scheduler/item") == 1  # five frames, one fetch
    schedules.MIRROR.debounce_s = 0


# ---------------------------------------------------------------- availability

def test_component_missing_needs_two_answers_five_minutes_apart(sched_app):
    app, s, c, fake, tr = sched_app
    _names(c)
    fake.installed = False
    _pull(app)
    st = c.get(f"{API}/schedules/status").json()
    assert st["available"] == "ok" and len(_names(c)) == 12  # one answer proves nothing
    fake._t += dt.timedelta(minutes=2)
    _pull(app)
    assert c.get(f"{API}/schedules/status").json()["available"] == "ok"
    fake._t += dt.timedelta(minutes=4)
    _pull(app)
    st = c.get(f"{API}/schedules/status").json()
    assert st["available"] == "component_missing" and st["write_block"] == "component_missing" and st["counts"]["visible"] == 0 and st["admin"]["component"] == "missing"
    assert _names(c) == [] and len(_rows(app)) == 12  # hidden, never deleted
    sid = next(iter(fake.items))
    assert c.get(f"{API}/schedules/{sid}").status_code == 404
    fake.installed = True
    _pull(app)
    assert c.get(f"{API}/schedules/status").json()["available"] == "ok" and len(_names(c)) == 12


def test_home_assistant_down_serves_the_cache_stale_and_refuses_writes(sched_app):
    app, s, c, fake, tr = sched_app
    _names(c)
    tr.up = False
    st = c.get(f"{API}/schedules/status").json()
    assert st["available"] == "ha_unavailable" and st["stale"] is True and st["writable"] is False and st["write_block"] == "ha_unavailable"
    body = c.get(f"{API}/schedules", params={"limit": 500}).json()
    assert body["total"] == 12 and body["status"] == {"available": "ha_unavailable", "stale": True, "last_sync_at": body["status"]["last_sync_at"]}
    sid = body["items"][0]["id"]
    d = c.get(f"{API}/schedules/{sid}").json()
    assert d["can"]["edit"] is False and d["read_only"]["reasons"][0]["code"] == "ha_unavailable"
    r = post_json(c, f"/schedules/{sid}/disable", {"client_request_id": rid()})
    assert r.status_code == 503 and r.json()["code"] == "ha_unavailable" and r.json()["user_message"] == "תשתית המערכת אינה זמינה כרגע."
    assert _pull(app) == {"error": "ha_unavailable"}
    tr.up = True
    assert c.get(f"{API}/schedules/status").json()["available"] == "error"  # the failed pull is remembered until a good one
    _pull(app)
    assert c.get(f"{API}/schedules/status").json()["available"] == "ok"


def test_another_component_failure_is_an_error_with_the_cache_kept(sched_app):
    app, s, c, fake, tr = sched_app
    _names(c)
    orig = fake.ws

    def broken(msg):
        if msg.get("type") == "scheduler":
            return [{"id": msg.get("id"), "type": "result", "success": False, "error": {"code": "home_assistant_error", "message": "boom"}}]
        return orig(msg)

    fake.ws = broken
    assert _pull(app) == {"error": "home_assistant_error"}
    st = c.get(f"{API}/schedules/status").json()
    assert st["available"] == "error" and st["stale"] is True and len(_names(c)) == 12
    fake.ws = orig


def test_not_configured_and_never_synced_states(sched_app):
    app, s, c, fake, tr = sched_app
    tr.configured_flag = False
    assert c.get(f"{API}/schedules/status").json()["available"] == "not_configured"
    tr.configured_flag = True


# ---------------------------------------------------------------- audit of outside changes

def test_a_sensitive_schedule_changed_outside_arx_is_audited(sched_app):
    app, s, c, fake, tr = sched_app
    _names(c)  # the baseline pull: existing schedules are not "changes"
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'schedule.changed_outside'").fetchone()[0] == 0
    gate = next(i for i, it in fake.items.items() if it["name"] == "Gate")
    light = next(i for i, it in fake.items.items() if it["name"] == "Office light on weekdays")
    fake.call_service("scheduler", "edit", {"entity_id": fake.items[gate]["entity_id"], "name": "Gate (edited in the card)"})
    fake.call_service("scheduler", "edit", {"entity_id": fake.items[light]["entity_id"], "name": "Light (edited in the card)"})
    new_alarm = fake._add({"name": "Alarm from the card", "repeat_type": "repeat", "timeslots": [{"start": "22:00:00", "stop": None, "actions": [{"service": "alarm_control_panel.alarm_arm_home", "entity_id": "alarm_control_panel.shed_panel", "service_data": {}}]}]})
    _pull(app)
    with app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT * FROM audit_log WHERE action = 'schedule.changed_outside' ORDER BY id").fetchall()
        assert {r["resource_id"] for r in rows} == {gate, new_alarm} and all(r["actor_user_id"] is None and r["decision"] == "allowed" for r in rows)
        d = {r["resource_id"]: json.loads(r["details_json"]) for r in rows}
        assert d[gate]["what"] == "updated" and d[gate]["classes"] == ["door"] and d[new_alarm]["what"] == "created" and d[gate]["revision_after"]
    # a change Arx itself just made is not "outside"
    r = post_json(c, f"/schedules/{gate}/disable", {"client_request_id": rid()})
    assert r.status_code == 200
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'schedule.changed_outside'").fetchone()[0] == 2


# ---------------------------------------------------------------- the transport seam and the small extractions

def test_writes_publish_schedules_changed_without_ids(sched_app):
    app, s, c, fake, tr = sched_app
    _names(c)
    q = ha_sync.subscribe()
    try:
        assert c.post(f"{API}/schedules", json={"draft": draft_of("Announced"), "enabled": True, "client_request_id": rid()}).status_code == 201
        msgs = []
        while not q.empty():
            msgs.append(q.get_nowait())
        assert {"type": "schedules_changed"} in msgs and all(set(m) == {"type"} for m in msgs if m["type"] == "schedules_changed")
    finally:
        ha_sync.unsubscribe(q)


def test_ws_call_runs_on_the_live_session_loop_from_a_request_thread():
    sync = ha_sync.HaSync()
    loop = asyncio.new_event_loop()
    t = threading.Thread(target=loop.run_forever, daemon=True)
    t.start()

    async def call(msg_type, **kw):
        await asyncio.sleep(0)
        return {"id": 1, "type": "result", "success": True, "result": {"echo": msg_type, **kw}}

    async def slow(msg_type, **kw):
        await asyncio.sleep(5)

    try:
        with pytest.raises(ApiError) as e:
            sync.ws_call("scheduler")  # not connected
        assert e.value.status == 503 and e.value.code == "ha_unavailable"
        ha_sync.STATE.connected = True
        sync._session_loop, sync._session_call = loop, call
        assert sync.ws_call("scheduler/item", schedule_id="abc123") == {"id": 1, "type": "result", "success": True, "result": {"echo": "scheduler/item", "schedule_id": "abc123"}}
        sync._session_call = slow
        with pytest.raises(ApiError) as e:
            sync.ws_call("scheduler", timeout=0.2)
        assert e.value.status == 503 and e.value.code == "scheduler_unavailable" and e.value.user_message == "התזמונים אינם זמינים כרגע."
    finally:
        ha_sync.STATE.connected = False
        loop.call_soon_threadsafe(loop.stop)
        t.join(2)


def test_call_bridge_schedule_maps_transport_failures(monkeypatch):
    real = httpx.Client  # the genuine class, captured before any patching

    class S:
        ha_url = "http://ha.local:8123"
        ha_token = "secret-token-value"

    seen: list[httpx.Request] = []

    def make(handler):
        def factory(*a, **kw):
            return real(transport=httpx.MockTransport(handler), timeout=kw.get("timeout"))

        monkeypatch.setattr(ha_client.httpx, "Client", factory)

    def ok(request):
        seen.append(request)
        return httpx.Response(200, json={"service_response": {"ok": True, "schedule_id": "aaaaaa"}})

    make(ok)
    assert ha_client.call_bridge_schedule(S(), {"op": "add"}) == {"ok": True, "schedule_id": "aaaaaa"}
    assert seen[0].url.path == "/api/services/smplwise_bridge/schedule" and seen[0].url.query == b"return_response" and seen[0].headers["authorization"] == "Bearer secret-token-value"
    assert json.loads(seen[0].content) == {"op": "add"}

    def timeout(request):
        raise httpx.ReadTimeout("slow", request=request)

    make(timeout)
    with pytest.raises(ApiError) as e:
        ha_client.call_bridge_schedule(S(), {})
    assert (e.value.status, e.value.code) == (504, "scheduler_timeout") and e.value.user_message == "רכיב התזמונים לא ענה בזמן; ייתכן שהשינוי נשמר. רעננו לפני ניסיון נוסף."

    def refused(request):
        raise httpx.ConnectError("no route", request=request)

    make(refused)
    with pytest.raises(ApiError) as e:
        ha_client.call_bridge_schedule(S(), {})
    assert (e.value.status, e.value.code) == (503, "ha_unavailable")
    for status, body, expected in ((400, "Service smplwise_bridge.schedule not found", "bridge_too_old"), (403, "no", "ha_forbidden"), (500, "boom", "bridge_error")):
        make(lambda request, status=status, body=body: httpx.Response(status, text=body))
        with pytest.raises(ApiError) as e:
            ha_client.call_bridge_schedule(S(), {})
        assert e.value.code == expected and e.value.status == 503

    class Unconfigured:
        ha_url = None
        ha_token = None

    with pytest.raises(ApiError) as e:
        ha_client.call_bridge_schedule(Unconfigured(), {})
    assert e.value.code == "ha_not_configured"


def test_attr_allow_keeps_the_schedule_switch_and_sun_attributes_only():
    kept = json.loads(ha_sync.trim_attributes({"next_trigger": "2026-10-01T10:00:00+03:00", "current_slot": 2, "next_slot": 0, "next_rising": "x", "next_setting": "y",
                                                "actions": [{"service": "x"}], "timeslots": ["00:00:00 - 06:00:00"], "entities": ["light.a"], "tags": ["t"], "weekdays": ["daily"]}))
    assert set(kept) == {"next_trigger", "current_slot", "next_slot", "next_rising", "next_setting"}


def test_is_jewish_calendar_and_the_home_screen_still_uses_it():
    from smplwise.services import home_screen

    assert home_screen.is_jewish_calendar({"entity_id": "sensor.x", "platform": "jewish_calendar"}) and home_screen.is_jewish_calendar({"entity_id": "sensor.jewish_parsha", "platform": None})
    assert not home_screen.is_jewish_calendar({"entity_id": "sensor.temp", "platform": "generic"}) and not home_screen.is_jewish_calendar({})


def test_schedule_panel_check_reads_the_panel_view(sched_app):
    from smplwise.services import alarm as alarm_svc

    app, s, c, fake, tr = sched_app
    with app.state.db.connection(mode="read") as conn:
        home = alarm_svc.schedule_panel_check(conn, "alarm_control_panel.home_panel")
        assert home["discovered"] is True and home["arm_modes"] == ["arm_home", "arm_away", "arm_night"] and home["needs_code_arm"] is False and home["needs_code_disarm"] is True
        shed = alarm_svc.schedule_panel_check(conn, "alarm_control_panel.shed_panel")
        assert shed["arm_modes"] == ["arm_home", "arm_away"] and shed["needs_code_disarm"] is False
        assert alarm_svc.schedule_panel_check(conn, "light.office")["discovered"] is False and alarm_svc.schedule_panel_check(conn, "alarm_control_panel.nope")["arm_modes"] == []


def test_the_migration_created_the_tables(sched_app):
    app, s, c, fake, tr = sched_app
    with app.state.db.connection(mode="read") as conn:
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()}
        assert {"schedule_cache", "schedule_folders", "schedule_meta", "schedule_trash", "schedule_runs", "schedule_ops"} <= tables
        assert 39 in {r[0] for r in conn.execute("SELECT version FROM schema_migrations").fetchall()}
        idx = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'index'").fetchall()}
        assert {"idx_schedule_ops_client", "idx_schedule_trash_expires", "idx_schedule_runs_schedule", "idx_schedule_runs_started"} <= idx
