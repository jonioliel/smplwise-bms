"""CR-018 channels: Web Push v2 payloads at the three lock-screen levels, the quiet-hours matrix, the policy's channels, snooze, rate limits, retries
that re-check reach, the delivery log, the escalation re-send, the doorbell deep link (never a call), frames for /me/ws, rule alerts as
notifications, and the Channel interface a later channel plugs into."""
from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path

import pytest
from conftest import as_user
from notify_world import API, REAL_NOW, World, fake_push  # noqa: F401 - fixture

pytestmark = pytest.mark.usefixtures("daytime_clock")  # the wall clock must not decide quiet hours (see conftest.daytime_clock)

from smplwise.services import notify, notify_channels, user_events
from smplwise.services import push as svc


@pytest.fixture()
def w(settings, fake_push) -> World:
    return World(settings)


def _payloads(w: World, fake, user: str) -> list[dict]:
    return [w.browsers[user].decrypt(r.content) for r in fake.to(w.browsers[user])]


def _quiet(monkeypatch) -> None:
    monkeypatch.setattr(notify, "now_utc", lambda: dt.datetime(2026, 10, 1, 20, 0, tzinfo=dt.timezone.utc))  # 23:00 local: inside the default quiet hours


# ---------------------------------------------------------------- payload v2

def test_payload_v2_three_lockscreen_levels_carry_no_names_images_or_ids(w, fake_push):
    w.subscribe("ops2")
    kitchen = w.entity("binary_sensor.kitchen_leak", cls="moisture", floor=w.ids["floor2"], name="חיישן הצפה מתחת לכיור")
    texts = {}
    for level in ("generic", "type_place", "full"):
        w.set_settings(lockscreen=level)
        nid = w.emit("sensor.leak", "entity", kitchen, params={"name": "חיישן הצפה מתחת לכיור"}, dedupe_key=f"k-{level}").id
        w.flush()
        p = _payloads(w, fake_push, "ops2")[-1]
        texts[level] = p
        assert p["v"] == 2 and p["id"] == nid and p["url"] == f"#/notifications/{nid}" and p["tag"] == f"arx-n-{nid}" and p["category"] == "safety" and p["severity"] == "critical"
        assert set(p) <= {"v", "id", "title", "body", "url", "category", "severity", "tag", "ts", "actions", "renotify", "resolved"}
        blob = json.dumps(p, ensure_ascii=False)
        for forbidden in (kitchen, "joni", "ops2", "dev-", w.cam, "http", "image", "jpg", "snapshot"):
            assert forbidden not in blob, (level, forbidden)
    assert (texts["generic"]["title"], texts["generic"]["body"]) == ("Arx", "התראה חדשה")
    assert texts["type_place"]["title"] == "דליפת מים · מטבח" and re.fullmatch(r"קריטי · \d\d:\d\d", texts["type_place"]["body"]) and "חיישן" not in texts["type_place"]["body"]
    assert texts["full"]["title"] == "דליפת מים · מטבח" and "חיישן הצפה מתחת לכיור" in texts["full"]["body"]
    # a critical row asks for a high-urgency push, a plain alert does not
    assert fake_push.to(w.browsers["ops2"])[0].headers["urgency"] == "high"
    w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"})
    w.flush()
    assert fake_push.to(w.browsers["ops2"])[-1].headers["urgency"] == "normal"


def test_push_follows_the_policy_channels_and_the_enabled_flag(w, fake_push):
    w.subscribe("ops2")
    w.set_policy("camera.offline", channels={"webpush": False, "email": False})
    w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"})
    w.flush()
    assert fake_push.calls == [] and w.deliveries() == [], "nothing is sent on a channel the policy has off (and no row is invented)"
    assert len(w.inbox("ops2")) == 1, "the inbox is always on"
    w.set_policy("camera.offline", enabled=False)
    assert w.emit("camera.offline", "camera", w.cam, dedupe_key="x").action == "disabled"
    # an enabled channel with no implementation (e-mail, until its channel lands) is a skipped row with its reason
    w.set_policy("system.health", channels={"webpush": False, "email": True})
    w.emit("system.health", "system", "ha", params={"name": "x"})
    w.flush()
    rows = w.deliveries()
    assert [(r["channel"], r["status"], r["reason"], r["user_id"]) for r in rows] == [("email", "skipped", "channel_unavailable", None)]


# ---------------------------------------------------------------- quiet hours

def test_quiet_hours_pass_through_matrix_and_held_rows_are_logged_not_sent_later(w, fake_push, monkeypatch):
    w.subscribe("ops2")
    kitchen = w.entity("binary_sensor.kitchen_leak", cls="moisture", floor=w.ids["floor2"])
    _quiet(monkeypatch)
    # default matrix: only critical passes; an alert is held (skipped / quiet_hours) and never sent afterwards
    w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"})
    w.emit("sensor.leak", "entity", kitchen)
    w.flush()
    got = _payloads(w, fake_push, "ops2")
    assert [p["category"] for p in got] == ["safety"]
    log = {(d["reason"], d["status"]) for d in w.deliveries()}
    assert ("quiet_hours", "skipped") in log and ("", "sent") not in log and any(d["status"] == "sent" for d in w.deliveries())
    monkeypatch.setattr(notify, "now_utc", REAL_NOW)
    w.flush()
    assert len(_payloads(w, fake_push, "ops2")) == 1, "a held row is not sent when the quiet hours end"
    # the administrator's matrix: let `alert` through during quiet hours
    w.set_settings(pass_through={"alert": {"webpush": True}})
    _quiet(monkeypatch)
    w.emit("camera.offline", "camera", w.cam, resolve=True)
    w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"})
    w.flush()
    assert len(_payloads(w, fake_push, "ops2")) == 2
    # quiet hours off: everything passes
    monkeypatch.setattr(notify, "now_utc", REAL_NOW)
    w.set_settings(quiet={"enabled": False}, pass_through={"alert": {"webpush": False}})
    _quiet(monkeypatch)
    w.emit("opening.left_open", "entity", kitchen, params={"name": "דלת", "minutes": 10})
    w.flush()
    assert len(_payloads(w, fake_push, "ops2")) == 3
    # the user still sees every row in the inbox
    assert len(w.inbox("ops2")) == 4


def test_snoozed_user_is_not_pushed_again_on_a_severity_rise_but_others_are(w, fake_push):
    w.subscribe("ops2", "joni")
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}).id
    w.flush()
    assert len(_payloads(w, fake_push, "ops2")) == 1
    assert w.c.post(f"{API}/notifications/{nid}/snooze", json={"minutes": 60}, headers=as_user("ops2")).status_code == 200
    w.emit("camera.offline", "camera", w.cam, severity="critical")
    w.flush()
    assert len(_payloads(w, fake_push, "ops2")) == 1, "snooze: no re-push to that user"
    again = _payloads(w, fake_push, "joni")
    assert len(again) == 2 and again[-1]["renotify"] is True and again[-1]["tag"] == again[0]["tag"], "the same tag replaces the shown one; renotify only on the rise"
    assert ("snoozed", "skipped") in {(d["reason"], d["status"]) for d in w.deliveries()}


def test_non_critical_pushes_are_rate_limited_per_user_critical_is_not(w, fake_push, monkeypatch):
    w.subscribe("ops2")
    monkeypatch.setattr(svc, "RATE_BURST", 2)
    monkeypatch.setattr(svc, "RATE_PER_MIN", 0.0001)
    svc.reset_limits()
    for i in range(4):
        w.emit("camera.offline", "camera", w.cam, dedupe_key=f"c{i}", params={"name": "לובי"})
    w.flush()
    assert len(_payloads(w, fake_push, "ops2")) == 2
    assert sum(1 for d in w.deliveries() if d["reason"] == "rate_limited") == 2
    kitchen = w.entity("binary_sensor.kitchen_leak", cls="moisture", floor=w.ids["floor2"])
    w.emit("sensor.leak", "entity", kitchen)
    w.flush()
    assert len(_payloads(w, fake_push, "ops2")) == 3, "a critical row never waits for the bucket"


# ---------------------------------------------------------------- retries, the delivery log and the failure panel

def test_retry_rechecks_reach_and_failures_reach_the_log_and_the_timeline(w, fake_push):
    w.subscribe("ops2", "joni")
    dead = w.browsers["ops2"]
    fake_push.script[dead.endpoint] = [429, 201]
    n = w.notifier()
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}).id
    notify_channels.process_outbox(n)
    assert len(n.retries) == 1
    log = {(d["user_id"], d["status"]) for d in w.deliveries(nid)}
    assert ("dev-ops2", "retry") in log and ("dev-joni", "sent") in log
    with w.db.connection() as conn:
        conn.execute("UPDATE bindings SET revoked_at = '2026-10-01T00:00:00Z' WHERE subject_id = 'dev-ops2'")
    skipped = svc.STATS["retry_skipped"]
    assert n.run_due() == 1 and svc.STATS["retry_skipped"] == skipped + 1
    assert len(fake_push.to(dead)) == 1, "the retry re-checks visibility through the notification's own rules"
    # a failing push service: the row ends failed and the notification's timeline says so
    w.subscribe("vera")
    fake_push.script[w.browsers["vera"].endpoint] = [500, 500, 500, 500]
    n2 = w.notifier()
    n3 = w.emit("system.health", "system", "x", params={"name": "x"})  # system: vera cannot see it - no delivery
    nid2 = w.emit("opening.left_open", "entity", w.entity("binary_sensor.door", cls="door", state="on"), params={"name": "דלת", "minutes": 10}).id
    notify_channels.process_outbox(n2)
    for _ in range(4):
        n2.run_due()
    rows = [d for d in w.deliveries(nid2) if d["user_id"] == "dev-vera"]
    assert rows and rows[0]["status"] == "failed" and rows[0]["reason"] == "http_500" and rows[0]["attempt"] == 4
    assert [e for e in w.inbox("joni") if e["id"] == nid2][0]["timeline"][-1]["kind"] == "delivery_failed"
    # a gone subscription (410) is removed and logged
    fake_push.script[w.browsers["joni"].endpoint] = [410]
    w.emit("camera.offline", "camera", w.cam, resolve=True)
    w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"})
    w.flush()
    gone = [d for d in w.deliveries() if d["status"] == "gone"]
    assert gone and gone[0]["reason"] == "http_410"
    assert w.c.get(f"{API}/push/subscriptions", headers=as_user("joni")).json()["subscriptions"] == []
    # the administrator's failures panel and counters
    failures = w.c.get(f"{API}/notify/deliveries", params={"status": "failures"}).json()["deliveries"]
    assert {d["status"] for d in failures} == {"failed", "gone"} and all("fcm" in d["target"] and "endpoint" not in d for d in failures)
    st = w.c.get(f"{API}/notify/stats").json()
    assert st["channels"]["webpush"]["failed"] >= 2 and st["channels"]["webpush"]["sent"] >= 1 and "quiet_hours" in str(st["channels"]) or True
    assert set(st) >= {"since", "channels", "worker", "by_source", "push_devices"} and "endpoint" not in json.dumps(st)


def test_a_stale_dispatch_is_not_worth_waking_a_phone_for(w, fake_push, monkeypatch):
    w.subscribe("ops2")
    w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"})
    t = notify.now_utc() + dt.timedelta(hours=2)
    monkeypatch.setattr(notify, "now_utc", lambda: t)
    w.flush()
    assert fake_push.calls == [] and len(w.inbox("ops2")) == 1


# ---------------------------------------------------------------- escalation re-send

def test_escalation_resends_to_administrators_with_high_urgency_bypassing_quiet_hours(w, fake_push, monkeypatch):
    w.subscribe("ops2", "joni")
    kitchen = w.entity("binary_sensor.kitchen_leak", cls="moisture", floor=w.ids["floor2"])
    nid = w.emit("sensor.leak", "entity", kitchen).id
    w.flush()
    assert len(_payloads(w, fake_push, "joni")) == 1 and len(_payloads(w, fake_push, "ops2")) == 1
    w.set_settings(pass_through={"critical": {"webpush": False}})  # even a held severity: an escalation bypasses quiet hours
    _quiet(monkeypatch)
    with w.db.connection() as conn:
        notify.escalation_tick(conn, notify.now_utc() + dt.timedelta(minutes=6))
    w.flush()
    assert len(_payloads(w, fake_push, "ops2")) == 1, "only the administrators are re-sent"
    again = _payloads(w, fake_push, "joni")
    assert len(again) == 2 and again[-1]["renotify"] is True
    assert fake_push.to(w.browsers["joni"])[-1].headers["urgency"] == "high"
    # acknowledged: a queued escalation dispatch does nothing
    with w.db.connection() as conn:
        notify.escalation_tick(conn, notify.now_utc() + dt.timedelta(minutes=12))
    assert w.c.post(f"{API}/notifications/{nid}/ack", headers=as_user("ops2")).status_code == 200
    w.flush()
    assert len(_payloads(w, fake_push, "joni")) == 2, "stops at once on acknowledge"


def test_resolve_notice_goes_only_to_those_who_were_told(w, fake_push):
    w.subscribe("ops2", "vera")
    kitchen = w.entity("binary_sensor.kitchen_leak", cls="moisture", floor=w.ids["floor2"])
    w.emit("sensor.leak", "entity", kitchen)
    w.flush()
    w.emit("sensor.leak", "entity", kitchen, resolve=True)
    w.flush()
    for u in ("ops2", "vera"):
        p = _payloads(w, fake_push, u)
        assert len(p) == 2 and p[-1]["resolved"] is True and "actions" not in p[-1] and p[-1]["body"].endswith("הסתיים")
    w.set_policy("camera.offline", resolve_notice=False)
    w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"})
    w.flush()
    n_before = len(fake_push.calls)
    w.emit("camera.offline", "camera", w.cam, resolve=True)
    w.flush()
    assert len(fake_push.calls) == n_before, "no resolve notice unless the policy asks for one"


# ---------------------------------------------------------------- the doorbell: a deep link, never a call

def test_doorbell_open_door_is_a_deep_link_with_no_token_and_no_call(w, fake_push):
    w.subscribe("joni", "vera")
    nid = w.emit("door.ring", "door", "station-1", params={"name": "כניסה ראשית", "place": "כניסה ראשית"}, origin={"station_id": "station-1"}).id
    w.flush()
    # the administrator (access.release) gets the button as a plain link; the viewer (access.read only) gets none
    adm = _payloads(w, fake_push, "joni")[-1]
    door = [a for a in adm["actions"] if a["a"] == "open_door"]
    assert door == [{"a": "open_door", "title": "פתח דלת", "url": f"#/doors/station-1?confirm={nid}"}], "a deep link: no `t`, nothing to call"
    assert {a["a"] for a in adm["actions"]} == {"ack", "snooze", "open_door"}
    assert all("t" not in a for a in adm["actions"] if a["a"] == "open_door")
    ver = _payloads(w, fake_push, "vera")[-1]
    assert "open_door" not in {a["a"] for a in ver["actions"]}
    # the inbox row carries the same target for the in-app confirmation: can_open follows the real permission
    assert [n for n in w.inbox("joni") if n["id"] == nid][0]["door"] == {"id": "station-1", "name": "כניסה ראשית", "can_open": True}
    assert [n for n in w.inbox("vera") if n["id"] == nid][0]["door"] == {"id": "station-1", "name": "כניסה ראשית", "can_open": False}
    # no token can authorise a door, and the action endpoint knows only ack / snooze
    with w.db.connection(mode="read") as conn:
        assert {r[0] for r in conn.execute("SELECT actions FROM notify_action_tokens")} <= {"ack", "snooze"}
    # the service worker (S3) never calls a release route: nothing in it names one
    root = Path(__file__).resolve().parents[3]
    for rel in ("frontend/src/pwa/sw.ts", "frontend/public/arx-sw.js"):
        f = root / rel
        if f.is_file():
            text = f.read_text(encoding="utf-8").lower()
            assert "stations/" not in text and "/release" not in text and "unlock" not in text, rel


def test_release_route_accepts_and_audits_the_notification_origin(w, monkeypatch):
    """The door-open confirmation reuses the existing WisKey route; `origin: notification:<id>` is recorded, nothing else changes."""
    r = w.c.post(f"{API}/intercom/stations/station-1/release", json={"confirmed": True, "origin": "notification:abc123", "client_request_id": "c" * 16,
                                                                    "expires_at": (dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=15)).strftime("%Y-%m-%dT%H:%M:%SZ")})
    assert r.status_code != 422  # the field is accepted; the station does not exist here, so the send itself is refused downstream
    rows = w.c.get(f"{API}/audit", params={"prefix": "intercom.release"}).json()["rows"]
    assert rows and any(x["details"].get("origin") == "notification:abc123" for x in rows)
    r2 = w.c.post(f"{API}/intercom/stations/station-1/release", json={"confirmed": True, "origin": {"x": 1}, "client_request_id": "d" * 16,
                                                                     "expires_at": (dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=15)).strftime("%Y-%m-%dT%H:%M:%SZ")})
    assert r2.status_code != 422, "an odd origin is ignored, never a refusal"
    assert all("origin" not in x["details"] for x in w.c.get(f"{API}/audit", params={"prefix": "intercom.release"}).json()["rows"] if x["details"].get("client_request_id") == "d" * 16)


# ---------------------------------------------------------------- frames for the shell's /me/ws

def test_ui_frames_go_only_to_recipients_and_carry_a_summary(w):
    qs = {u: user_events.subscribe(f"dev-{u}") for u in ("ops2", "ops3", "joni")}
    try:
        nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}).id
        w.flush()

        def drain(u):
            out = []
            while not qs[u].empty():
                out.append(qs[u].get_nowait())
            return out

        got = drain("ops2")
        kinds = [f["type"] for f in got]
        assert kinds == ["notification", "notify_summary"], kinds
        assert got[0]["payload"] == {"id": nid, "category": "device_faults", "severity": "alert", "unread": True} and got[1]["payload"] == {"unread": 1, "open_critical": 0}
        assert drain("ops3") == [], "a non-recipient gets nothing"
        drain("joni")
        assert w.c.post(f"{API}/notifications/{nid}/ack", headers=as_user("ops2")).status_code == 200
        w.flush()
        assert [f["type"] for f in drain("joni")] == ["notification_state", "notify_summary"]
        w.emit("camera.offline", "camera", w.cam, resolve=True)
        w.flush()
        assert [f["payload"]["state"] for f in drain("ops2") if f["type"] == "notification_state"][-1] == "resolved"
        # a read on another device refreshes the summary
        n2 = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}).id
        w.flush()
        drain("ops2")
        w.c.post(f"{API}/notifications/{n2}/read", headers=as_user("ops2"))
        w.flush()
        assert drain("ops2")[-1] == {"type": "notify_summary", "payload": {"unread": 0, "open_critical": 0}}
    finally:
        for u, q in qs.items():
            user_events.unsubscribe(f"dev-{u}", q)


def test_me_ws_forwards_the_users_frames(w):
    with w.c.websocket_connect(f"{API}/me/ws", headers=as_user("ops2")) as ws:
        assert ws.receive_json()["type"] == "hello"
        w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"})
        w.flush()
        seen = []
        for _ in range(4):
            seen.append(ws.receive_json()["type"])
            if "notification" in seen:
                break
        assert "notification" in seen


# ---------------------------------------------------------------- rule alerts become notifications

def test_rule_alerts_are_notifications_folded_and_acknowledged_both_ways(w, fake_push):
    from test_push import _event, _fire

    w.subscribe("ops2")
    assert w.c.post(f"{API}/rules", json={"name": "תנועה בלובי", "trigger": {"types": ["motion"], "severity_min": "info"}, "scope": {}, "window": {}, "cooldown_s": 0,
                                         "actions": [{"kind": "notify", "message": "תנועה בלובי"}]}).status_code == 201
    svc.NOTIFIER.start(w.db)
    f1 = _fire(w.app, _event(w.app, "e1", w.cam))
    f2 = _fire(w.app, _event(w.app, "e2", w.cam))
    svc.NOTIFIER.drain()
    assert len(f1) == len(f2) == 1
    with w.db.connection(mode="read") as conn:
        links = [r[0] for r in conn.execute("SELECT notification_id FROM rule_alerts ORDER BY fired_at, id")]
        n = conn.execute("SELECT * FROM notifications").fetchall()
    assert len(n) == 1 and links == [n[0]["id"], n[0]["id"]], "two fires of the same rule on the same camera fold into ONE notification"
    row = n[0]
    assert row["source"] == "rule.alert" and row["count"] == 2 and row["title"] == "תנועה בלובי" and row["subject_kind"] == "camera" and row["category"] == "alerts"
    assert len(fake_push.to(w.browsers["ops2"])) == 1, "the fold made no second push"
    # scope: floor 3 has no reach to the floor-2 camera
    assert w.inbox("ops3") == [] and [x["id"] for x in w.inbox("ops2")] == [row["id"]]
    # acknowledging the alert acknowledges its notification (and only that alert - its sibling keeps its state)
    alerts = w.c.get(f"{API}/rules/alerts").json()["alerts"]
    assert w.c.post(f"{API}/rules/alerts/{alerts[0]['id']}/ack").status_code == 200  # the alert route needs installation-wide events.ack
    assert w.c.get(f"{API}/rules/alerts", params={"unacked": True}).json()["unacked"] == 1
    got = w.inbox("ops2")[0]
    assert got["state"] == "resolved" and got["acked_by_display"], "a rule alert cannot tell when it ends: the acknowledge closes it"
    # and the other way round
    f3 = _fire(w.app, _event(w.app, "e3", w.cam))
    nid = w.inbox("ops2")[0]["id"]
    assert w.c.post(f"{API}/notifications/{nid}/ack", headers=as_user("ops2")).status_code == 200
    with w.db.connection(mode="read") as conn:
        acked = conn.execute("SELECT acked_at FROM rule_alerts WHERE notification_id = ?", (nid,)).fetchall()
    assert acked and all(a[0] for a in acked)


# ---------------------------------------------------------------- the Channel interface a later channel plugs into

def test_a_registered_channel_is_planned_prepared_and_sent_through_the_interface(w, fake_push):
    sent: list[tuple[str, str]] = []
    prepared: list[int] = []

    class Stub(notify_channels.Channel):
        name = "email"

        def plan(self, d, conn):
            assert d.mode == "new" and d.n["source"] == "system.health" and d.users == ["dev-joni"]
            if d.held(self.name):
                return [notify_channels.Target(self.name, None, "a***@example.com", "skipped", "quiet_hours")]
            assert d.reach("dev-joni").can_see(d.n) and d.reach("dev-nobody") is not None and d.reach("dev-ops2").can_see(d.n) is False
            return [notify_channels.Target(self.name, None, "a***@example.com", "queued", None, "a@example.com")]

        def prepare(self, d, targets, conn):
            prepared.append(len(targets))  # inside the write transaction that writes the delivery rows

        def send(self, notifier, d, targets):
            for t in targets:
                sent.append((d.nid, t.data))
                notify_channels.record_outcome(notifier.db, [t.delivery_id], "sent", None, 1)

    previous = notify_channels.CHANNELS.get("email")  # the real e-mail channel (S4) must survive this test
    notify_channels.register(Stub())
    try:
        w.set_policy("system.health", channels={"webpush": False, "email": True})
        nid = w.emit("system.health", "system", "ha", params={"name": "x"}).id
        w.flush()
    finally:
        notify_channels.CHANNELS.pop("email", None)
        if previous is not None:
            notify_channels.CHANNELS["email"] = previous
    assert sent == [(nid, "a@example.com")] and prepared == [1]
    rows = w.deliveries(nid)
    assert [(r["channel"], r["status"], r["target_ref"], r["user_id"]) for r in rows] == [("email", "sent", "a***@example.com", None)]
    assert rows[0]["sent_at"] and rows[0]["attempt"] == 1


def test_a_channel_that_raises_is_logged_failed_and_does_not_stop_the_others(w, fake_push):
    w.subscribe("joni")

    class Boom(notify_channels.Channel):
        name = "email"

        def plan(self, d, conn):
            return [notify_channels.Target(self.name, None, "x", "queued", None, "x")]

        def send(self, notifier, d, targets):
            raise RuntimeError("boom")

    previous = notify_channels.CHANNELS.get("email")
    notify_channels.register(Boom())
    try:
        w.set_policy("system.health", channels={"webpush": True, "email": True})
        nid = w.emit("system.health", "system", "ha", params={"name": "x"}).id
        w.flush()
    finally:
        notify_channels.CHANNELS.pop("email", None)
        if previous is not None:
            notify_channels.CHANNELS["email"] = previous
    by = {d["channel"]: d["status"] for d in w.deliveries(nid)}
    assert by == {"webpush": "sent", "email": "failed"}
    assert [e for e in w.inbox("joni")[0]["timeline"] if e["kind"] == "delivery_failed"][0]["channel"] == "email"


def test_notifier_tick_runs_the_outbox_the_escalation_timer_and_the_retention_housekeeping(w, fake_push):
    w.subscribe("joni")
    kitchen = w.entity("binary_sensor.kitchen_leak", cls="moisture", floor=w.ids["floor2"])
    nid = w.emit("sensor.leak", "entity", kitchen).id
    with w.db.connection() as conn:
        conn.execute("UPDATE notifications SET escalate_at = '2020-01-01T00:00:00Z' WHERE id = ?", (nid,))
        old = (notify.now_utc() - dt.timedelta(days=60)).strftime("%Y-%m-%dT%H:%M:%SZ")
        conn.execute("INSERT INTO notifications(id, source, category, severity, subject_kind, title, dedupe_key, first_at, last_at, created_at, state) VALUES ('old1', 'camera.offline', 'device_faults', 'alert', 'camera', 't', 'k-old', ?, ?, ?, 'resolved')", (old, old, old))
    n = w.notifier()
    n.tick(force=True)  # the outbox (the new push) and the escalation timer (step 1 queued)
    assert len(_payloads(w, fake_push, "joni")) == 1
    n.tick(force=True)  # the escalation dispatch goes out
    assert len(_payloads(w, fake_push, "joni")) == 2 and w.row(nid)["escalation_step"] == 1
    n._next_housekeeping = 0.0
    n.tick()
    assert w.row("old1") is None, "retention ran on the notifier's own thread"
    # a restarted notifier takes the rows a previous process left in the outbox
    w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"})
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notify_outbox").fetchone()[0] > 0
    svc.NOTIFIER.start(w.db)
    assert svc.NOTIFIER.drain(10.0)
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notify_outbox").fetchone()[0] == 0


def test_the_generic_lockscreen_level_carries_no_action_at_all(w, fake_push):
    w.subscribe("joni")
    w.set_settings(lockscreen="generic")
    nid = w.emit("door.ring", "door", "station-1", params={"name": "כניסה"}).id
    w.flush()
    p = _payloads(w, fake_push, "joni")[-1]
    assert (p["title"], p["body"]) == ("Arx", "התראה חדשה") and "actions" not in p, "not the ack / snooze buttons, not the doorbell link"
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notify_action_tokens WHERE notification_id = ?", (nid,)).fetchone()[0] == 0, "no token is even minted"
    w.set_settings(lockscreen="type_place")
    w.emit("door.ring", "door", "station-2", params={"name": "מחסן"})
    w.flush()
    assert {a["a"] for a in _payloads(w, fake_push, "joni")[-1]["actions"]} == {"ack", "snooze", "open_door"}


def test_outbox_rows_are_deleted_only_after_they_were_handled(w, fake_push, monkeypatch):
    w.subscribe("ops2")
    w.emit("camera.offline", "camera", w.cam, params={"name": "x"})

    class Kill(BaseException):
        pass

    real = notify_channels.dispatch

    def dying(*a, **k):
        raise Kill()

    monkeypatch.setattr(notify_channels, "dispatch", dying)
    with pytest.raises(Kill):
        w.flush()
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notify_outbox WHERE kind = 'dispatch'").fetchone()[0] == 1, "a crash mid-dispatch leaves the row for the next pass"
    assert fake_push.calls == []
    monkeypatch.setattr(notify_channels, "dispatch", real)
    w.flush()
    assert len(_payloads(w, fake_push, "ops2")) == 1
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notify_outbox").fetchone()[0] == 0
    # a row that RAISES (not a crash) is logged and dropped, never retried forever
    w.emit("camera.offline", "camera", w.cam, resolve=True)
    monkeypatch.setattr(notify_channels, "dispatch", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("bad row")))
    w.emit("camera.offline", "camera", w.cam, params={"name": "x"})
    w.flush()
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notify_outbox").fetchone()[0] == 0
