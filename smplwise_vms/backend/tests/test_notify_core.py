"""CR-018 core: the store and the pipeline - emit / fold / resolve / supersede, recipients per subject kind and per policy rule, visibility at every
read, read / snooze / acknowledge, escalation, action tokens, retention, the migration, and the 403 on every /notify/* route."""
from __future__ import annotations

import datetime as dt
import json
import re
import sqlite3

import pytest
from conftest import as_user
from notify_world import API, NOW, REAL_NOW, World, fake_push  # noqa: F401 - fake_push is a fixture

pytestmark = pytest.mark.usefixtures("daytime_clock")  # the wall clock must not decide quiet hours (see conftest.daytime_clock)

from smplwise import db as dbmod
from smplwise.services import notify
from smplwise.services import notify_policy as policies
from smplwise.services import notify_settings as nsettings


@pytest.fixture()
def w(settings, fake_push) -> World:
    return World(settings)


# ---------------------------------------------------------------- migration and defaults

def test_migration_tables_defaults_and_push_prefs_left_readable(w):
    with w.db.connection(mode="read") as conn:
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        assert {"notifications", "notification_recipients", "notification_events", "notification_deliveries", "notify_action_tokens", "notify_outbox", "notify_settings", "notify_policies", "push_prefs"} <= tables
        assert "notification_id" in {r[1] for r in conn.execute("PRAGMA table_info(rule_alerts)")}
        assert "kind" in {r[1] for r in conn.execute("PRAGMA table_info(push_subscriptions)")}
        st = nsettings.load(conn)
        assert st["quiet"] == {"enabled": True, "from": "22:00", "to": "07:00", "days": list(nsettings.DAYS_SUN_FIRST)} and st["lockscreen"] == "type_place"
        assert st["pass_through"]["critical"]["webpush"] is True and st["pass_through"]["alert"]["webpush"] is False and st["pass_through"]["info"]["email"] is False
        assert st["escalation"] == {"enabled": True, "after_min": 5, "steps": 2, "to": "managers"} and st["retention_days"] == 30 and st["deliveries_retention_days"] == 14
        assert st["center_layout"] == "sheet" and st["failures_audience"] == "admins" and st["image_in_push"] is False and st["email"]["configured"] is False
        pols = policies.list_policies(conn)
    assert {p["source"] for p in pols} == {s.key for s in policies.SOURCES} and len(pols) >= 28
    by = {p["source"]: p for p in pols}
    assert by["sensor.leak"]["severity"] == "critical" and by["sensor.leak"]["category"] == "safety" and by["sensor.leak"]["resolve_notice"] is True
    assert by["alarm.state"]["enabled"] is False and by["camera.motion"]["enabled"] is False and by["update.available"]["channels"]["webpush"] is False and by["update.available"]["channels"]["email"] is True
    assert by["schedule.not_confirmed"]["recipients"]["rule"] == "managers" and by["security.lockout"]["recipients"]["rule"] == "scope" and by["bulk.partial"]["recipients"]["rule"] == "initiator"
    assert all(p["channels"]["ha_mobile"] is False and p["channels"]["whatsapp"] is False and p["channels"]["inbox"] is True for p in pols)
    # the legacy per-user push preferences still work for one more release
    assert w.c.get(f"{API}/push/prefs").status_code == 200


def test_new_permission_is_system_admin_only_and_sensitive():
    from smplwise.rbac import ROLES

    assert [r for r, perms in ROLES.items() if "notify.manage" in perms] == ["system_admin"]
    from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE

    assert "notify.manage" in PERMISSION_LABELS and "notify.manage" in SENSITIVE


# ---------------------------------------------------------------- emit, fold, resolve, supersede

def test_emit_fold_resolve_and_supersede(w, monkeypatch):
    w.set_policy("camera.offline", dedupe_window_s=0)
    r = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי", "place": "לובי"})
    assert r.action == "created" and r.id
    nid = r.id
    row = w.row(nid)
    assert row["severity"] == "alert" and row["category"] == "device_faults" and row["state"] == "open" and row["count"] == 1 and row["title"] == "מצלמה לא זמינה"
    # the same condition folds (count, last_at) - and `emit` itself answers None for a fold, the id only for a created row
    with w.db.connection() as conn:
        again = notify.emit(conn, notify.Signal("camera.offline", "camera", w.cam, params={"name": "לובי"}))
    assert again is None
    for _ in range(3):
        assert w.emit("camera.offline", "camera", w.cam).action == "folded"
    row = w.row(nid)
    assert row["count"] == 5
    with w.db.connection(mode="read") as conn:
        kinds = [(e["kind"], e["count"]) for e in conn.execute("SELECT kind, count FROM notification_events WHERE notification_id = ? ORDER BY id", (nid,))]
        assert conn.execute("SELECT COUNT(*) FROM notifications").fetchone()[0] == 1
    assert kinds == [("created", None), ("folded", 5)], "a burst is ONE timeline entry that keeps counting"
    # severity rise re-notifies and puts the row back to unread
    w.c.post(f"{API}/notifications/{nid}/read", headers=as_user("joni"))
    assert w.emit("camera.offline", "camera", w.cam, severity="critical").action == "renotified"
    assert w.row(nid)["severity"] == "critical" and w.row(nid)["escalate_at"]
    assert [n for n in w.inbox("joni") if n["id"] == nid][0]["me"]["read_at"] is None
    # resolve closes it, the key is free again
    assert w.emit("camera.offline", "camera", w.cam, resolve=True).action == "resolved"
    assert w.row(nid)["state"] == "resolved" and w.row(nid)["resolved_at"] and w.row(nid)["escalate_at"] is None
    assert w.emit("camera.offline", "camera", w.cam, resolve=True).action == "nothing_to_resolve"
    second = w.emit("camera.offline", "camera", w.cam)
    assert second.action == "created" and second.id != nid

    # a fold WINDOW: after it the old open row is superseded (resolved) and a new one is made
    w.set_policy("door.ring", dedupe_window_s=60)
    a = w.emit("door.ring", "door", "st1", params={"name": "כניסה"})
    t0 = notify.now_utc()
    monkeypatch.setattr(notify, "now_utc", lambda: t0 + dt.timedelta(seconds=30))
    assert w.emit("door.ring", "door", "st1").action == "folded"
    monkeypatch.setattr(notify, "now_utc", lambda: t0 + dt.timedelta(seconds=300))
    b = w.emit("door.ring", "door", "st1")
    assert b.action == "created" and b.id != a.id
    assert w.row(a.id)["state"] == "resolved" and dict(w.row(a.id))["resolution"] == "superseded"


def test_disabled_source_makes_nothing_and_unknown_source_is_ignored(w):
    assert w.emit("alarm.state", "alarm_panel", "alarm_control_panel.x").action == "disabled"
    assert w.emit("no.such.source", "system", None).action == "unknown_source"
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notifications").fetchone()[0] == 0


# ---------------------------------------------------------------- recipients: subject kind x policy rule

def test_recipients_per_subject_kind(w):
    kitchen = w.entity("binary_sensor.kitchen_leak", cls="moisture", floor=w.ids["floor2"])
    panel = w.entity("alarm_control_panel.home", domain="alarm_control_panel", state="armed_away", floor=w.ids["floor2"])
    hall = w.entity("sensor.hall_temp", domain="sensor", cls="temperature", state="21", area="hall")  # not placed on any floor
    hidden = w.entity("sensor.hidden_probe", domain="sensor", state="1")
    with w.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET hidden = 1 WHERE entity_id = 'sensor.hidden_probe'")

    def who(source, kind, subject, **kw) -> set[str]:
        return w.recipients(w.emit(source, kind, subject, **kw).id)

    # camera: row_scope(events.read) - the system administrator and the floor-2 operator; a viewer has no events.read
    assert who("camera.offline", "camera", w.cam) == {"joni", "ops2"}
    # entity: devices.read at the entity's placement (catalogued entities only)
    assert who("sensor.leak", "entity", kitchen) == {"joni", "ops2", "vera"}
    assert who("sensor.leak", "entity", hall) == {"joni", "ops2", "ops3", "vera"} - {"ops2", "ops3"}, "an unplaced entity is only for installation-wide holders"
    assert who("sensor.leak", "entity", hidden) == set(), "a hidden entity is not in the catalogue"
    assert who("sensor.leak", "entity", "binary_sensor.never_synced") == set()
    # alarm panel: alarm.view on its own placement
    assert who("alarm.triggered", "alarm_panel", panel) == {"joni", "ops2", "vera"}
    # area: devices.read - installation-wide holders, or a floor holder with an entity of the area placed there
    assert who("device.unavailable", "area", "kitchen", dedupe_key="a1") == {"joni", "ops2", "vera"}
    # door (a WisKey station): access.read at installation scope
    assert who("door.ring", "door", "station-1", params={"name": "כניסה"}) == {"joni", "vera"}
    # system: system.configure
    assert who("system.health", "system", "ha") == {"joni"}
    # bulk job: the initiator only, and only if they may see it
    assert who("bulk.partial", "bulk_job", "b1", initiator_user_id="dev-ops3") == {"ops3"}
    # schedule: its owner of record, or schedule.view
    assert who("schedule.not_confirmed", "schedule", "s1", origin={"owner_user_id": "dev-ops3"}) == {"joni"} | set(), "failures go to administrators by default"
    w.set_settings(failures_audience="visible")
    assert who("schedule.not_confirmed", "schedule", "s2", origin={"owner_user_id": "dev-ops3"}) == {"joni", "ops3"}
    # session: the account's own user; a lockout ONLY the system administrators (the locked-out user is not told and cannot acknowledge it)
    assert who("security.new_signin", "session", "dev-ops2", initiator_user_id="dev-ops2") == {"ops2"}
    lock = w.emit("security.lockout", "session", "dev-ops2", initiator_user_id="dev-ops2")
    assert w.recipients(lock.id) == {"joni"}
    assert w.inbox("ops2") == [] or all(n["id"] != lock.id for n in w.inbox("ops2"))
    assert w.c.post(f"{API}/notifications/{lock.id}/ack", headers=as_user("ops2")).status_code == 404
    w.set_policy("security.lockout", recipients={"rule": "initiator"})
    assert w.recipients(w.emit("security.lockout", "session", "dev-ops2", initiator_user_id="dev-ops2", dedupe_key="l2").id) == set(), "even a rule that names the user cannot raise visibility"


def test_recipient_rules_are_a_ceiling_on_visibility(w):
    kitchen = w.entity("binary_sensor.kitchen_leak", cls="moisture", floor=w.ids["floor2"])
    w.set_policy("sensor.leak", recipients={"rule": "managers"})
    assert w.recipients(w.emit("sensor.leak", "entity", kitchen).id) == {"joni"}
    w.set_policy("sensor.smoke", recipients={"rule": "users", "user_ids": ["dev-ops2", "dev-ops3", "dev-nobody"]})
    smoke = w.entity("binary_sensor.kitchen_smoke", cls="smoke", floor=w.ids["floor2"])
    assert w.recipients(w.emit("sensor.smoke", "entity", smoke).id) == {"ops2"}, "named users still need to see the subject: ops3 (floor 3) and nobody do not"
    w.set_policy("sensor.gas", recipients={"rule": "initiator"})
    gas = w.entity("binary_sensor.kitchen_gas", cls="gas", floor=w.ids["floor2"])
    assert w.recipients(w.emit("sensor.gas", "entity", gas, initiator_user_id="dev-vera").id) == {"vera"}
    assert w.recipients(w.emit("sensor.co", "entity", gas, initiator_user_id="dev-ops3", dedupe_key="co1").id) == {"joni", "ops2", "vera"}, "scope rule = everyone who may see it"


def test_inactive_user_never_receives(w):
    kitchen = w.entity("binary_sensor.kitchen_leak", cls="moisture", floor=w.ids["floor2"])
    with w.db.connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = 'dev-ops2'")
    assert w.recipients(w.emit("sensor.leak", "entity", kitchen).id) == {"joni", "vera"}


# ---------------------------------------------------------------- the inbox and visibility at every read

def test_revoked_scope_hides_old_rows_at_once(w):
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}).id
    assert [n["id"] for n in w.inbox("ops2")] == [nid]
    assert w.c.get(f"{API}/notifications/summary", headers=as_user("ops2")).json()["unread"] == 1
    with w.db.connection() as conn:
        conn.execute("UPDATE bindings SET revoked_at = '2026-10-01T00:00:00Z' WHERE subject_id = 'dev-ops2'")
    assert w.inbox("ops2") == []
    s = w.c.get(f"{API}/notifications/summary", headers=as_user("ops2")).json()
    assert s["unread"] == 0 and s["open_critical"] == 0
    for call in (lambda: w.c.get(f"{API}/notifications/{nid}", headers=as_user("ops2")), lambda: w.c.post(f"{API}/notifications/{nid}/read", headers=as_user("ops2")),
                 lambda: w.c.post(f"{API}/notifications/{nid}/ack", headers=as_user("ops2")), lambda: w.c.post(f"{API}/notifications/{nid}/snooze", json={"minutes": 60}, headers=as_user("ops2")),
                 lambda: w.c.get(f"{API}/notifications/{nid}/snapshot", headers=as_user("ops2"))):
        r = call()
        assert r.status_code == 404 and r.json()["code"] == "notification_not_found"
    # a user who was never a recipient gets the same answer as a missing row
    assert w.c.get(f"{API}/notifications/{nid}", headers=as_user("ops3")).json()["code"] == "notification_not_found"
    assert w.c.get(f"{API}/notifications/{nid}", headers=as_user("joni")).status_code == 200


def test_inbox_shape_filters_pagination_and_pinned_critical(w):
    kitchen = w.entity("binary_sensor.kitchen_leak", cls="moisture", floor=w.ids["floor2"], name="חיישן הצפה")
    t0 = notify.now_utc()
    ids = []
    import itertools

    clock = itertools.count()
    orig = notify.now_utc
    notify.now_utc = lambda: t0 + dt.timedelta(minutes=next(clock))
    try:
        ids.append(w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}).id)                        # alert, device_faults
        ids.append(w.emit("device.battery_low", "entity", kitchen, params={"name": "חיישן", "level": "9%"}).id)    # info
        ids.append(w.emit("sensor.leak", "entity", kitchen, params={"name": "חיישן הצפה"}).id)                      # critical safety
        ids.append(w.emit("opening.left_open", "entity", kitchen, params={"name": "דלת", "minutes": 10}).id)       # alert, doors
    finally:
        notify.now_utc = orig
    rows = w.inbox("joni")
    assert rows[0]["id"] == ids[2], "an open critical safety row is pinned on top"
    assert [r["id"] for r in rows[1:]] == [ids[3], ids[1], ids[0]], "then newest first"
    leak = rows[0]
    assert leak["category"] == "safety" and leak["severity"] == "critical" and leak["title"] == "דליפת מים" and leak["place_name"] == "מטבח" and "חיישן הצפה" in leak["body"]
    assert leak["subject"] == {"kind": "entity", "id": kitchen, "area_id": "kitchen"} and leak["state"] == "open" and leak["count"] == 1
    assert leak["me"] == {"read_at": None, "snoozed_until": None} and leak["can_ack"] is True and leak["has_snapshot"] is False and leak["door"] is None
    assert leak["timeline"][0]["kind"] == "created" and leak["my_deliveries"] == []
    assert set(leak) >= {"id", "source", "category", "severity", "title", "body", "place_name", "subject", "link", "count", "first_at", "last_at", "state", "acked_at", "acked_by_display", "resolved_at", "me",
                         "can_ack", "has_snapshot", "door", "timeline", "my_deliveries"}
    assert [r["id"] for r in w.inbox("joni", category="doors")] == [ids[3]]
    assert {r["id"] for r in w.inbox("joni", severity_min="alert")} == {ids[0], ids[2], ids[3]}
    page = w.c.get(f"{API}/notifications", params={"limit": 2}, headers=as_user("joni")).json()
    assert len(page["notifications"]) == 2 and page["next_before"]
    rest = w.c.get(f"{API}/notifications", params={"limit": 2, "before": page["next_before"]}, headers=as_user("joni")).json()
    assert {r["id"] for r in page["notifications"]} | {r["id"] for r in rest["notifications"]} == set(ids)
    assert w.c.get(f"{API}/notifications", params={"category": "nope"}, headers=as_user("joni")).status_code == 422
    # open filter hides resolved rows
    w.emit("camera.offline", "camera", w.cam, resolve=True)
    assert ids[0] not in {r["id"] for r in w.inbox("joni", state="open")} and ids[0] in {r["id"] for r in w.inbox("joni", state="all")}


# ---------------------------------------------------------------- read, snooze, acknowledge

def test_read_snooze_summary_and_ack_marks_read(w, monkeypatch):
    kitchen = w.entity("binary_sensor.kitchen_leak", cls="moisture", floor=w.ids["floor2"])
    a = w.emit("sensor.leak", "entity", kitchen).id
    b = w.emit("device.unavailable", "entity", kitchen, dedupe_key="b1", params={"name": "x"}).id
    h = as_user("ops2")
    s = w.c.get(f"{API}/notifications/summary", headers=h).json()
    assert s["unread"] == 2 and s["open_critical"] == 1 and s["by_category"] == {"safety": 1, "device_faults": 1}
    assert s["center_layout"] == "sheet" and s["quiet_active"] is False and s["quiet_until"] is None
    r = w.c.post(f"{API}/notifications/{b}/read", headers=h)
    assert r.status_code == 200 and r.json()["id"] == b and r.json()["me"]["read_at"]
    assert w.c.get(f"{API}/notifications/summary", headers=h).json()["unread"] == 1
    # read-all
    assert w.c.post(f"{API}/notifications/read-all", headers=h).status_code == 200
    assert w.c.get(f"{API}/notifications/summary", headers=h).json()["unread"] == 0
    # snooze: only the two choices; per user; hides from the unread count until the time; answers the row
    c = w.emit("camera.offline", "camera", w.cam).id
    assert w.c.post(f"{API}/notifications/{c}/snooze", json={"minutes": 30}, headers=h).status_code == 422
    r = w.c.post(f"{API}/notifications/{c}/snooze", json={"minutes": 60}, headers=h).json()
    until = dt.datetime.fromisoformat(r["me"]["snoozed_until"].replace("Z", "+00:00"))
    assert 3500 < (until - notify.now_utc()).total_seconds() <= 3600
    assert w.c.get(f"{API}/notifications/summary", headers=h).json()["by_category"].get("device_faults", 0) == 0, "snoozed = not unread"
    assert w.c.get(f"{API}/notifications/summary", headers=as_user("joni")).json()["by_category"].get("device_faults", 0) >= 1, "joni's own state is untouched"
    # "until the morning" = the next end of the quiet window, in the installation zone
    t = dt.datetime(2026, 10, 1, 20, 0, tzinfo=dt.timezone.utc)  # 23:00 local, inside 22:00-07:00
    monkeypatch.setattr(notify, "now_utc", lambda: t)
    r = w.c.post(f"{API}/notifications/{c}/snooze", json={"minutes": "until_morning"}, headers=h).json()
    assert r["me"]["snoozed_until"] == "2026-10-02T04:00:00Z"  # 07:00 Asia/Jerusalem (UTC+3)
    s = w.c.get(f"{API}/notifications/summary", headers=h).json()
    assert s["quiet_active"] is True and s["quiet_until"] == "2026-10-02T04:00:00Z"
    monkeypatch.setattr(notify, "now_utc", REAL_NOW)
    # acknowledge (shared): marks it read for the one who did it, stops escalation, answers the row
    unread_row = [n for n in w.inbox("joni") if n["id"] == a][0]
    assert unread_row["me"]["read_at"] is None
    r = w.c.post(f"{API}/notifications/{a}/ack", headers=as_user("joni"))
    assert r.status_code == 200 and r.json()["state"] == "acknowledged" and r.json()["acked_by_display"] and r.json()["me"]["read_at"] and r.json()["can_ack"] is True
    assert w.row(a)["escalate_at"] is None
    assert w.c.post(f"{API}/notifications/{a}/ack", headers=as_user("joni")).status_code == 200, "idempotent"
    seen_by_other = [n for n in w.inbox("vera") if n["id"] == a][0]
    assert seen_by_other["state"] == "acknowledged" and seen_by_other["acked_at"]
    rows = w.c.get(f"{API}/audit", params={"prefix": "notify.ack"}).json()["rows"]
    assert rows and rows[0]["decision"] == "allowed"
    # a sensor condition that can end resolves by itself; an acknowledged row resolves with it
    assert w.emit("sensor.leak", "entity", kitchen, resolve=True).action == "resolved" and w.row(a)["state"] == "resolved"


def test_ack_permission_per_subject_and_a_source_without_resolve_closes_on_ack(w):
    # a viewer may see a device row but acknowledges it as the recipient; a camera row needs events.ack at the camera
    cust = _custom_role(w, "צופה אירועים", ["map.read", "events.read", "video.live"])
    from conftest import bind

    bind(w.c, w.settings, "eve", cust, "installation", "*")
    nid = w.emit("camera.offline", "camera", w.cam).id
    row = [n for n in w.inbox("eve") if n["id"] == nid][0]
    assert row["can_ack"] is False
    r = w.c.post(f"{API}/notifications/{nid}/ack", headers=as_user("eve"))
    assert r.status_code == 403 and r.json()["code"] == "ack_not_allowed"
    assert w.row(nid)["state"] == "open"
    assert w.c.post(f"{API}/notifications/{nid}/ack", headers=as_user("ops2")).status_code == 200
    # rule alerts cannot tell when they end: the acknowledge resolves them
    n2 = w.emit("bulk.partial", "bulk_job", "b9", initiator_user_id="dev-ops2", params={"name": "כיבוי", "detail": "1 מתוך 3"}).id
    assert w.c.post(f"{API}/notifications/{n2}/ack", headers=as_user("ops2")).json()["state"] == "resolved"
    assert w.c.get(f"{API}/audit", params={"prefix": "notify.ack"}).json()["rows"][0]["details"]["source"] in ("bulk.partial", "camera.offline")


def _custom_role(w: World, name: str, perms: list[str]) -> str:
    r = w.c.post(f"{API}/access/roles", json={"name": name, "description": "", "permissions": perms, "sensitive": []})
    assert r.status_code == 201, r.text
    return r.json()["id"]


# ---------------------------------------------------------------- escalation

def test_escalation_steps_stop_on_ack_and_are_configurable(w, monkeypatch):
    kitchen = w.entity("binary_sensor.kitchen_leak", cls="moisture", floor=w.ids["floor2"])
    nid = w.emit("sensor.leak", "entity", kitchen).id
    t0 = notify.now_utc()
    assert w.row(nid)["escalate_at"] is not None and w.row(nid)["escalation_step"] == 0
    # nothing before the time
    with w.db.connection() as conn:
        assert notify.escalation_tick(conn, t0 + dt.timedelta(minutes=4)) == 0
    # step 1 after 5 minutes: the administrators (notify.manage) - recorded as recipients, a timeline entry, an outbox dispatch
    with w.db.connection() as conn:
        assert notify.escalation_tick(conn, t0 + dt.timedelta(minutes=5, seconds=1)) == 1
    row = w.row(nid)
    assert row["escalation_step"] == 1 and row["escalate_at"] is not None
    with w.db.connection(mode="read") as conn:
        tl = [(e["kind"], e["step"], e["count"]) for e in conn.execute("SELECT * FROM notification_events WHERE notification_id = ? ORDER BY id", (nid,))]
        out = [json.loads(r["payload_json"]) for r in conn.execute("SELECT * FROM notify_outbox WHERE kind = 'dispatch'")]
    assert ("escalated", 1, 1) in tl and {"mode": "escalate", "step": 1, "users": ["dev-joni"]} in out
    # step 2, the last: no further timer
    with w.db.connection() as conn:
        assert notify.escalation_tick(conn, t0 + dt.timedelta(minutes=11)) == 1
    assert w.row(nid)["escalation_step"] == 2 and w.row(nid)["escalate_at"] is None
    with w.db.connection() as conn:
        assert notify.escalation_tick(conn, t0 + dt.timedelta(hours=1)) == 0, "at most `steps` steps"
    assert [e for e in w.inbox("joni")[0]["timeline"] if e["kind"] == "escalated"][-1]["step"] == 2

    # configurable minutes and steps; an acknowledge stops it at once; rows below critical never escalate
    w.set_settings(escalation={"after_min": 2, "steps": 3, "to": "managers"})
    n2 = w.emit("sensor.smoke", "entity", w.entity("binary_sensor.kitchen_smoke", cls="smoke", floor=w.ids["floor2"])).id
    t1 = notify.now_utc()
    with w.db.connection() as conn:
        assert notify.escalation_tick(conn, t1 + dt.timedelta(minutes=2, seconds=1)) == 1
    assert w.c.post(f"{API}/notifications/{n2}/ack", headers=as_user("ops2")).status_code == 200
    with w.db.connection() as conn:
        assert notify.escalation_tick(conn, t1 + dt.timedelta(hours=1)) == 0
    assert w.row(n2)["escalate_at"] is None
    n3 = w.emit("camera.offline", "camera", w.cam).id
    assert w.row(n3)["escalate_at"] is None, "an alert never escalates"
    w.set_settings(escalation={"enabled": False})
    n4 = w.emit("sensor.gas", "entity", w.entity("binary_sensor.kitchen_gas", cls="gas", floor=w.ids["floor2"])).id
    assert w.row(n4)["escalate_at"] is None
    # validation
    for bad in ({"after_min": 0}, {"after_min": 61}, {"steps": 0}, {"steps": 4}, {"to": []}, {"after_min": True}):
        r = w.c.put(f"{API}/notify/settings", json={"escalation": bad})
        assert r.status_code == 422 and r.json()["code"] == "escalation_invalid", bad


# ---------------------------------------------------------------- action tokens

def test_action_tokens_single_use_expiry_user_scope_and_no_door_action(w, fake_push, monkeypatch):
    w.subscribe("ops2", "joni")
    kitchen = w.entity("binary_sensor.kitchen_leak", cls="moisture", floor=w.ids["floor2"])
    nid = w.emit("sensor.leak", "entity", kitchen).id
    w.flush()
    pushes = w.browsers["ops2"].decrypt(fake_push.to(w.browsers["ops2"])[-1].content)
    acts = {a["a"]: a for a in pushes["actions"]}
    assert set(acts) == {"ack", "snooze"} and acts["ack"]["t"] != acts["snooze"]["t"]
    assert all(set(a) <= {"a", "title", "t"} for a in acts.values())
    # the token authorises exactly its action on its row - and only once
    ack = acts["ack"]["t"]
    assert w.c.post(f"{API}/notifications/action", json={"t": ack, "a": "snooze"}).status_code == 401, "an ack token cannot snooze"
    r = w.c.post(f"{API}/notifications/action", json={"t": ack, "a": "ack"})
    assert r.status_code == 200 and r.json() == {"ok": True, "result": "acknowledged", "notification_id": nid}
    assert w.row(nid)["state"] == "acknowledged" and w.row(nid)["acked_by"] == "dev-ops2"
    again = w.c.post(f"{API}/notifications/action", json={"t": ack, "a": "ack"})
    assert again.status_code == 401 and again.json()["code"] == "action_token_invalid", "single use"
    r = w.c.post(f"{API}/notifications/action", json={"t": acts["snooze"]["t"], "a": "snooze"})
    assert r.status_code == 200 and r.json()["result"] == "snoozed"
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT snoozed_until FROM notification_recipients WHERE notification_id = ? AND user_id = 'dev-ops2'", (nid,)).fetchone()[0], "one hour, for that user only"
        assert conn.execute("SELECT snoozed_until FROM notification_recipients WHERE notification_id = ? AND user_id = 'dev-joni'", (nid,)).fetchone()[0] is None
    # the audit row names the channel and the action, never the token
    rows = w.c.get(f"{API}/audit", params={"prefix": "notify.action"}).json()["rows"]
    assert len(rows) == 2 and rows[0]["details"] in ({"channel": "push", "action": "snooze"}, {"channel": "push", "action": "ack"}) and acts["ack"]["t"] not in json.dumps(rows)
    # nothing but ack / snooze is an action (the door-open rule): a door action is refused before any lookup, a made-up token is the same 401
    for body in ({"t": "x" * 22, "a": "open_door"}, {"t": "x" * 22, "a": "unlock"}, {"t": ack, "a": "disarm"}):
        assert w.c.post(f"{API}/notifications/action", json=body).status_code == 422
    assert w.c.post(f"{API}/notifications/action", json={"t": "x" * 22, "a": "ack"}).json()["code"] == "action_token_invalid"
    with pytest.raises(ValueError):
        with w.db.connection() as conn:
            notify.mint_tokens(conn, nid, "dev-ops2", ["open_door"])

    # expiry, and a user who lost reach between the push and the tap
    n2 = w.emit("camera.offline", "camera", w.cam).id
    w.flush()
    toks = {a["a"]: a["t"] for a in w.browsers["ops2"].decrypt(fake_push.to(w.browsers["ops2"])[-1].content)["actions"]}
    t = notify.now_utc() + dt.timedelta(hours=2)
    monkeypatch.setattr(notify, "now_utc", lambda: t)
    assert w.c.post(f"{API}/notifications/action", json={"t": toks["ack"], "a": "ack"}).status_code == 401, "expired with the push TTL"
    monkeypatch.setattr(notify, "now_utc", REAL_NOW)
    with w.db.connection() as conn:
        conn.execute("UPDATE bindings SET revoked_at = '2026-10-01T00:00:00Z' WHERE subject_id = 'dev-ops2'")
    assert w.c.post(f"{API}/notifications/action", json={"t": toks["ack"], "a": "ack"}).status_code == 401, "lost reach"
    assert w.row(n2)["state"] == "open"
    # only the hash is stored
    with w.db.connection(mode="read") as conn:
        assert toks["ack"] not in json.dumps([dict(r) for r in conn.execute("SELECT * FROM notify_action_tokens")])


# ---------------------------------------------------------------- retention

def test_retention_janitor_uses_the_configured_days(w):
    a = w.emit("camera.offline", "camera", w.cam).id
    with w.db.connection() as conn:
        old = (notify.now_utc() - dt.timedelta(days=40)).strftime("%Y-%m-%dT%H:%M:%SZ")
        conn.execute("UPDATE notifications SET last_at = ?, first_at = ?, state = 'resolved', resolved_at = ? WHERE id = ?", (old, old, old, a))
        conn.execute("INSERT INTO notification_deliveries(id, notification_id, channel, status, created_at) VALUES ('d-old', ?, 'webpush', 'sent', ?)", (a, old))
    b = w.emit("sensor.leak", "entity", w.entity("binary_sensor.kitchen_leak", cls="moisture", floor=w.ids["floor2"])).id
    with w.db.connection() as conn:
        res = notify.retention_sweep(conn)
    assert res["notifications"] == 1
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT id FROM notifications").fetchall()[0][0] == b
        assert conn.execute("SELECT COUNT(*) FROM notification_recipients WHERE notification_id = ?", (a,)).fetchone()[0] == 0, "recipients, timeline and deliveries go with the row"
        assert conn.execute("SELECT COUNT(*) FROM notification_deliveries WHERE id = 'd-old'").fetchone()[0] == 0
    # 7 days (a setting) is stricter, 90 keeps it
    c = w.emit("camera.offline", "camera", w.cam).id
    with w.db.connection() as conn:
        d10 = (notify.now_utc() - dt.timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
        conn.execute("UPDATE notifications SET last_at = ?, state = 'resolved', resolved_at = ? WHERE id = ?", (d10, d10, c))
    w.set_settings(retention_days=90)
    with w.db.connection() as conn:
        assert notify.retention_sweep(conn)["notifications"] == 0
    w.set_settings(retention_days=7)
    with w.db.connection() as conn:
        assert notify.retention_sweep(conn)["notifications"] == 1
    assert w.c.put(f"{API}/notify/settings", json={"retention_days": 45}).status_code == 422


# ---------------------------------------------------------------- settings, policies and the 403 wall

ADMIN_ROUTES = [("GET", "/notify/settings", None), ("PUT", "/notify/settings", {"lockscreen": "full"}), ("GET", "/notify/policies", None), ("GET", "/notify/policies/sensor.leak", None),
                ("PUT", "/notify/policies/sensor.leak", {"enabled": True}), ("GET", "/notify/deliveries", None), ("GET", "/notify/stats", None)]


def test_every_notify_route_is_403_without_notify_manage(w):
    for user in ("ops2", "vera", "nobody"):
        for method, path, body in ADMIN_ROUTES:
            r = w.c.request(method, API + path, json=body, headers=as_user(user))
            assert r.status_code == 403 and r.json()["code"] == "forbidden", (user, method, path, r.status_code)
    # a site administrator does not hold it either (only system_admin does)
    from conftest import bind

    bind(w.c, w.settings, "sally", "site_admin", "installation", "*")
    assert w.c.get(f"{API}/notify/settings", headers=as_user("sally")).status_code == 403
    assert w.c.get(f"{API}/notify/settings").status_code == 200
    rows = w.c.get(f"{API}/audit", params={"prefix": "notify.manage"}).json()["rows"]
    assert rows and all(r["decision"] == "denied" for r in rows), "the refusals are audited"
    # a custom role names it among its SENSITIVE permissions to grant it to one person
    r = w.c.post(f"{API}/access/roles", json={"name": "מנהל התראות", "description": "", "permissions": ["map.read"], "sensitive": ["notify.manage"]})
    assert r.status_code == 201, r.text
    bind(w.c, w.settings, "nora", r.json()["id"], "installation", "*")
    assert w.c.get(f"{API}/notify/settings", headers=as_user("nora")).status_code == 200


def test_settings_roundtrip_validation_and_revision(w):
    st = w.c.get(f"{API}/notify/settings").json()
    assert st["revision"] == 1 and st["email"]["password_set"] is False and "\"password\"" not in json.dumps(st)
    # the whole GET body may be sent back (read-only fields are ignored)
    r = w.c.put(f"{API}/notify/settings", json={**st, "base_revision": 1, "lockscreen": "full"}, headers={"If-Match": "1"})
    assert r.status_code == 200 and r.json()["lockscreen"] == "full" and r.json()["revision"] == 2
    # a stale revision, by header or by base_revision
    for kw in ({"headers": {"If-Match": '"1"'}, "json": {"lockscreen": "generic"}}, {"json": {"lockscreen": "generic", "base_revision": 1}}):
        r = w.c.put(f"{API}/notify/settings", **kw)
        assert r.status_code == 412 and r.json()["code"] == "settings_conflict" and r.json()["details"]["current_revision"] == 2
    assert w.c.put(f"{API}/notify/settings", json={"lockscreen": "generic", "base_revision": 2}).status_code == 200
    # quiet hours
    for bad in ({"from": "22:00", "to": "22:00"}, {"from": "25:00"}, {"days": ["xyz"]}):
        r = w.c.put(f"{API}/notify/settings", json={"quiet": bad})
        assert r.status_code == 422 and r.json()["code"] == "quiet_invalid", bad
    ok = w.set_settings(quiet={"enabled": True, "from": "23:00", "to": "06:30", "days": ["sun", "mon"]}, pass_through={"alert": {"webpush": True}})
    assert ok["quiet"] == {"enabled": True, "from": "23:00", "to": "06:30", "days": ["sun", "mon"]} and ok["pass_through"]["alert"]["webpush"] is True and ok["pass_through"]["info"]["webpush"] is False
    # the rest of the validation
    assert w.c.put(f"{API}/notify/settings", json={"lockscreen": "nope"}).status_code == 422
    assert w.c.put(f"{API}/notify/settings", json={"image_in_push": True}).status_code == 422, "no camera image in a push in v1"
    assert w.set_settings(image_in_push=False)["image_in_push"] is False
    assert w.c.put(f"{API}/notify/settings", json={"pass_through": {"nope": {}}}).status_code == 422
    assert w.set_settings(companion={"critical_sound_safety": True})["companion"] == {"critical_sound_safety": True}
    # the owner's two 2026-10-01 settings
    assert w.set_settings(center_layout="page", failures_audience="visible")["center_layout"] == "page"
    assert w.c.get(f"{API}/notify/settings").json()["failures_audience"] == "visible"
    for bad in ({"center_layout": "wide"}, {"failures_audience": "everyone"}):
        assert w.c.put(f"{API}/notify/settings", json=bad).status_code == 422
    # every user's center learns the layout (the settings themselves are administrator-only)
    s = w.c.get(f"{API}/notifications/summary", headers=as_user("vera")).json()
    assert s["center_layout"] == "page"
    # audited, field names only
    rows = w.c.get(f"{API}/audit", params={"prefix": "notify.settings.update"}).json()["rows"]
    assert rows and all(set(r["details"]) == {"changed"} for r in rows)
    assert "lockscreen" in rows[-1]["details"]["changed"] or any("lockscreen" in r["details"]["changed"] for r in rows)


def test_policies_edit_revision_reserved_channels_and_failure_audience(w):
    lst = w.c.get(f"{API}/notify/policies").json()
    assert len(lst["policies"]) >= 28 and lst["policies"][0]["label"] and lst["categories"] == list(policies.CATEGORIES)
    p = w.c.get(f"{API}/notify/policies/sensor.leak").json()
    assert p["revision"] == 1 and p["channels"]["webpush"] is True
    r = w.c.put(f"{API}/notify/policies/sensor.leak", json={"enabled": True, "severity": "alert", "after_s": 30, "dedupe_window_s": 120, "resolve_notice": False,
                                                           "recipients": {"rule": "managers"}, "channels": {"inbox": True, "webpush": False, "email": True, "ha_mobile": False, "whatsapp": False}, "base_revision": 1},
                headers={"If-Match": "1"})
    assert r.status_code == 200, r.text
    q = r.json()
    assert (q["severity"], q["after_s"], q["dedupe_window_s"], q["recipients"], q["channels"]["webpush"], q["channels"]["email"], q["revision"]) == ("alert", 30, 120, {"rule": "managers"}, False, True, 2)
    assert w.c.put(f"{API}/notify/policies/sensor.leak", json={"enabled": False, "base_revision": 1}).json()["code"] == "settings_conflict"
    for ch in ("ha_mobile", "whatsapp"):
        r = w.c.put(f"{API}/notify/policies/sensor.leak", json={"channels": {ch: True}})
        assert r.status_code == 422 and r.json()["code"] == "channel_reserved", ch
    assert w.c.put(f"{API}/notify/policies/sensor.leak", json={"channels": {"inbox": False}}).status_code == 422
    assert w.c.put(f"{API}/notify/policies/sensor.leak", json={"severity": "urgent"}).status_code == 422
    assert w.c.put(f"{API}/notify/policies/sensor.leak", json={"recipients": {"rule": "users"}}).status_code == 422
    assert w.c.put(f"{API}/notify/policies/sensor.leak", json={"after_s": -1}).status_code == 422
    assert w.c.put(f"{API}/notify/policies/no.such", json={"enabled": True}).status_code == 404
    # the failure sources follow the one failures_audience setting; saving the whole body back does not break it
    f = w.c.get(f"{API}/notify/policies/schedule.not_confirmed").json()
    assert f["recipients"] == {"rule": "managers", "locked_by": "failures_audience"}
    w.set_settings(failures_audience="visible")
    f = w.c.get(f"{API}/notify/policies/schedule.not_confirmed").json()
    assert f["recipients"] == {"rule": "scope", "locked_by": "failures_audience"}
    body = {k: f[k] for k in ("enabled", "severity", "after_s", "dedupe_window_s", "resolve_notice", "recipients", "channels")}
    r = w.c.put(f"{API}/notify/policies/schedule.not_confirmed", json={**body, "recipients": {"rule": "managers"}, "after_s": 5, "base_revision": f["revision"]})
    assert r.status_code == 200 and r.json()["after_s"] == 5 and r.json()["recipients"]["rule"] == "scope"
    rows = w.c.get(f"{API}/audit", params={"prefix": "notify.policy.update"}).json()["rows"]
    assert rows and rows[-1]["resource_id"] in ("sensor.leak", "schedule.not_confirmed")


# ---------------------------------------------------------------- quiet hours (the pure rule)

def test_quiet_hours_across_midnight_days_and_zone():
    q = {"enabled": True, "from": "22:00", "to": "07:00", "days": ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]}
    tz = "Asia/Jerusalem"

    def at(utc: str):
        return dt.datetime.fromisoformat(utc.replace("Z", "+00:00"))

    f = nsettings.in_quiet_hours
    assert f(q, at("2026-10-01T09:00:00Z"), tz) is False  # 12:00 local
    assert f(q, at("2026-10-01T19:30:00Z"), tz) is True   # 22:30 local, before midnight
    assert f(q, at("2026-10-01T23:30:00Z"), tz) is True   # 02:30 local, after midnight
    assert f(q, at("2026-10-02T03:59:00Z"), tz) is True   # 06:59 local
    assert f(q, at("2026-10-02T04:00:00Z"), tz) is False  # 07:00 local: the window ends
    assert f({**q, "enabled": False}, at("2026-10-01T23:30:00Z"), tz) is False
    # a day names the day the window STARTS: Thursday 2026-10-01 22:00 -> Friday 07:00
    thu_only = {**q, "days": ["thu"]}
    assert f(thu_only, at("2026-10-01T19:30:00Z"), tz) is True   # Thursday 22:30
    assert f(thu_only, at("2026-10-01T23:30:00Z"), tz) is True   # Friday 02:30 still belongs to Thursday's window
    assert f(thu_only, at("2026-10-02T19:30:00Z"), tz) is False  # Friday 22:30: Friday is not listed
    assert f(thu_only, at("2026-10-02T23:30:00Z"), tz) is False  # Saturday 02:30
    # a window inside one day
    day = {"enabled": True, "from": "13:00", "to": "15:00", "days": ["thu"]}
    assert f(day, at("2026-10-01T11:00:00Z"), tz) is True and f(day, at("2026-10-01T13:00:00Z"), tz) is False and f(day, at("2026-10-02T11:00:00Z"), tz) is False
    # DST: Asia/Jerusalem leaves summer time on 2026-10-25 (UTC+3 -> UTC+2)
    assert f(q, at("2026-10-24T19:30:00Z"), tz) is True    # 22:30 local (UTC+3)
    assert f(q, at("2026-10-25T20:30:00Z"), tz) is True    # 22:30 local (UTC+2)
    assert f(q, at("2026-10-25T19:30:00Z"), tz) is False   # 21:30 local


def test_deliveries_listing_is_own_for_users_and_everyones_for_managers(w, fake_push):
    w.subscribe("ops2")
    nid = w.emit("camera.offline", "camera", w.cam).id
    w.flush()
    mine = w.c.get(f"{API}/notifications/deliveries", headers=as_user("ops2")).json()["deliveries"]
    assert [d["notification_id"] for d in mine] == [nid] and mine[0]["channel"] == "webpush" and mine[0]["target"] == "fcm.googleapis.com" and mine[0]["status"] == "sent"
    assert w.c.get(f"{API}/notifications/deliveries", headers=as_user("joni")).json()["deliveries"] == []
    everyone = w.c.get(f"{API}/notify/deliveries").json()["deliveries"]
    assert len(everyone) == 1 and everyone[0]["user_display"] and "fcm" in everyone[0]["target"]
    assert w.c.get(f"{API}/notify/deliveries", params={"status": "failures"}).json()["deliveries"] == []
    assert w.c.get(f"{API}/notify/deliveries", params={"status": "nope"}).status_code == 422
    assert [n for n in w.inbox("ops2") if n["id"] == nid][0]["my_deliveries"][0]["status"] == "sent"


# ---------------------------------------------------------------- migration on an existing database

def test_migration_up_on_a_0_1_149_database_keeps_push_prefs_and_subscriptions(settings, tmp_path, monkeypatch):
    import shutil

    from fastapi.testclient import TestClient

    from smplwise.main import create_app
    from smplwise.services import push as push_svc

    real = dbmod.MIGRATIONS_DIR
    older = tmp_path / "older"
    older.mkdir()
    for f in real.glob("*.sql"):
        if int(f.name.split("_", 1)[0]) < 45:
            shutil.copy(f, older / f.name)
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", older)
    database = dbmod.Database(settings.db_path)
    database.migrate()
    with database.connection() as conn:
        conn.execute("INSERT INTO push_prefs(user_id, categories_json, quiet_json, updated_at) VALUES ('dev-old', '{\"alerts\": false}', '{\"enabled\": true, \"from\": \"21:00\", \"to\": \"06:00\"}', '2026-09-01T00:00:00Z')")
        conn.execute("INSERT INTO push_subscriptions(id, user_id, endpoint, p256dh, auth, created_at, last_seen_at) VALUES ('s1', 'dev-old', 'https://fcm.googleapis.com/x', 'a', 'b', 't', 't')")
        conn.execute("INSERT INTO rules(id, name, enabled, owner, trigger_json, scope_json, window_json, cooldown_s, actions_json, revision, created_at, updated_at) VALUES ('r1', 'r', 1, 'local', '{}', '{}', '{}', 0, '[]', 1, 't', 't')")
        conn.execute("INSERT INTO rule_alerts(id, rule_id, event_id, fired_at, occurred_at, reasons_json, message) VALUES ('a1', 'r1', 'e1', 't', 't', '[]', 'm')")
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", real)
    assert dbmod.Database(settings.db_path).migrate() == [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60]  # 0060 (CR-028 cast sessions); 0059 (M047 review window groups); 0058 (EL6 manual meter readings); 0057: CR-027 phone app; 0056: K88; 0053-0054: CR-023 meters, billing; 0055: CR-024
    c = TestClient(create_app(settings))  # start-up seeds the policies
    with database.connection(mode="read") as conn:
        assert conn.execute("SELECT categories_json FROM push_prefs WHERE user_id = 'dev-old'").fetchone()[0] == '{"alerts": false}'
        assert conn.execute("SELECT kind FROM push_subscriptions WHERE id = 's1'").fetchone()[0] == "webpush"
        assert conn.execute("SELECT notification_id FROM rule_alerts WHERE id = 'a1'").fetchone()[0] is None
        assert conn.execute("SELECT COUNT(*) FROM notify_policies").fetchone()[0] == len(policies.SOURCES)
        assert push_svc.get_prefs(conn, "dev-old")["quiet"]["from"] == "21:00", "the old planner can still read the preferences"
    assert c.get(f"{API}/notify/settings").json()["revision"] == 1 and c.get(f"{API}/push/prefs", headers=as_user("dev-old")).status_code == 200


def test_notify_migrations_are_0045_to_0047_and_unique():
    """Released 0.1.151 applied CR-018 as 0045-0047; CR-017's automations follow as 0048 (renumbered at the 0.1.152 merge)."""
    names = sorted(f.name for f in dbmod.MIGRATIONS_DIR.glob("*.sql"))
    assert [n for n in names if n.startswith(("0045_", "0046_", "0047_", "0048_"))] == ["0045_notifications.sql", "0046_notify_settings.sql", "0047_notify_policies.sql", "0048_automations.sql"]
    allnums = [int(n.split("_", 1)[0]) for n in names]
    assert all(allnums.count(n) == 1 for n in (45, 46, 47, 48))


# ---------------------------------------------------------------- review fixes

def test_retention_never_deletes_a_row_whose_condition_is_still_open(w):
    kitchen = w.entity("binary_sensor.kitchen_leak", cls="moisture", floor=w.ids["floor2"])
    open_id = w.emit("sensor.leak", "entity", kitchen).id
    acked = w.emit("camera.offline", "camera", w.cam).id
    assert w.c.post(f"{API}/notifications/{acked}/ack", headers=as_user("ops2")).json()["state"] == "acknowledged"
    old = (notify.now_utc() - dt.timedelta(days=100)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with w.db.connection() as conn:
        conn.execute("UPDATE notifications SET last_at = ?, first_at = ? WHERE id IN (?, ?)", (old, old, open_id, acked))
    with w.db.connection() as conn:
        assert notify.retention_sweep(conn)["notifications"] == 0
    assert w.row(open_id) and w.row(acked), "an open or acknowledged-but-active row is the live state of something"
    with w.db.connection() as conn:
        conn.execute("UPDATE notifications SET state = 'resolved', resolved_at = ? WHERE id = ?", (old, open_id))
        assert notify.retention_sweep(conn)["notifications"] == 1
    assert w.row(open_id) is None and w.row(acked)


def test_the_settings_row_is_recreated_when_a_restore_left_none(w, settings):
    with w.db.connection() as conn:
        conn.execute("DELETE FROM notify_settings")
    assert w.c.get(f"{API}/notify/settings").json()["revision"] == 0  # the defaults are served
    r = w.c.put(f"{API}/notify/settings", json={"lockscreen": "full"})
    assert r.status_code == 200 and r.json()["lockscreen"] == "full", "the row is created before the update: the settings can be saved"
    assert w.c.get(f"{API}/notify/settings").json()["lockscreen"] == "full"
    # a replace-restore of a backup made before the tables existed
    import zipfile

    b = w.c.post(f"{API}/backups", json={"note": "t"})
    assert b.status_code == 201, b.text
    src = settings.data_dir / "backups" / b.json()["name"]
    old = settings.data_dir / "backups" / "auto-pre-notify.zip"
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(old, "w") as zout:
        for item in zin.infolist():
            if item.filename not in ("data/notify_settings.json", "data/notify_policies.json"):
                zout.writestr(item, zin.read(item.filename))
    from smplwise.services import backup as backup_svc

    with w.db.connection() as conn:
        backup_svc.restore(settings, conn, old, mode="replace")
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notify_settings").fetchone()[0] == 1
    assert w.c.put(f"{API}/notify/settings", json={"lockscreen": "generic"}).json()["lockscreen"] == "generic"
    assert w.c.get(f"{API}/notify/policies").status_code == 200 and w.c.put(f"{API}/notify/policies/sensor.leak", json={"enabled": True}).status_code == 200


def test_booleans_must_be_real_booleans(w):
    for body in ({"enabled": "false"}, {"resolve_notice": "no"}, {"channels": {"webpush": "false"}}, {"channels": {"ha_mobile": "false"}}, {"enabled": 0}):
        r = w.c.put(f"{API}/notify/policies/sensor.leak", json=body)
        assert r.status_code == 422, (body, r.status_code)
    for body in ({"quiet": {"enabled": "false"}}, {"escalation": {"enabled": "no"}}, {"pass_through": {"alert": {"webpush": "true"}}}, {"image_in_push": "false"}, {"companion": {"critical_sound_safety": "yes"}}):
        r = w.c.put(f"{API}/notify/settings", json=body)
        assert r.status_code == 422, (body, r.status_code)
    assert w.get_policy_enabled("sensor.leak") is True
    assert w.c.put(f"{API}/notify/policies/sensor.leak", json={"enabled": False}).json()["enabled"] is False


def test_emit_is_atomic_a_failure_part_way_leaves_nothing(w, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("enqueue failed")

    with w.db.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES ('probe', '1') ON CONFLICT(key) DO UPDATE SET value = '1'")
        real = notify._enqueue
        monkeypatch.setattr(notify, "_enqueue", boom)
        with pytest.raises(RuntimeError):
            notify.emit_full(conn, notify.Signal("camera.offline", "camera", w.cam))
        monkeypatch.setattr(notify, "_enqueue", real)
        conn.execute("UPDATE settings SET value = '2' WHERE key = 'probe'")  # the caller's own transaction is intact
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notifications").fetchone()[0] == 0 and conn.execute("SELECT COUNT(*) FROM notification_recipients").fetchone()[0] == 0
        assert conn.execute("SELECT value FROM settings WHERE key = 'probe'").fetchone()[0] == "2"
    assert w.emit("camera.offline", "camera", w.cam).action == "created"


def test_action_throttle_counts_only_guesses_per_token_and_stale_buttons_never_block(w, fake_push):
    from smplwise.routers import notifications as router

    router.ACTION_FAILURES.hits.clear()
    router.ACTION_GLOBAL.hits.clear()
    guess = "g" * 22
    codes = [w.c.post(f"{API}/notifications/action", json={"t": guess, "a": "ack"}).status_code for _ in range(22)]
    assert codes[:20] == [401] * 20 and codes[20:] == [429, 429], "the same unknown token is throttled"
    assert w.c.post(f"{API}/notifications/action", json={"t": "h" * 22, "a": "ack"}).status_code == 401, "another token is not behind the same bucket (no shared peer address)"
    # an expired button is not an attack: any number of them never blocks
    w.subscribe("ops2")
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "x"}).id
    with w.db.connection() as conn:
        tok = notify.mint_tokens(conn, nid, "dev-ops2", ["ack"])["ack"]
        conn.execute("UPDATE notify_action_tokens SET expires_at = '2020-01-01T00:00:00Z'")
    assert [w.c.post(f"{API}/notifications/action", json={"t": tok, "a": "ack"}).status_code for _ in range(30)] == [401] * 30
    router.ACTION_FAILURES.hits.clear()


def test_deliveries_of_a_row_the_caller_may_no_longer_see_are_hidden(w, fake_push):
    w.subscribe("ops2")
    w.emit("camera.offline", "camera", w.cam, params={"name": "x"})
    w.flush()
    assert len(w.c.get(f"{API}/notifications/deliveries", headers=as_user("ops2")).json()["deliveries"]) == 1
    with w.db.connection() as conn:
        conn.execute("UPDATE bindings SET revoked_at = '2026-10-01T00:00:00Z' WHERE subject_id = 'dev-ops2'")
    assert w.c.get(f"{API}/notifications/deliveries", headers=as_user("ops2")).json()["deliveries"] == []
