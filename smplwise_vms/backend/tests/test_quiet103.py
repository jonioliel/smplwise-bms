"""CR-QUIET103 slice 1: quiet windows per floor / area. Negative first: shipped OFF, nothing critical or safety ever held, only the window's place
and time, permission and scope per floor, exact expiry decided by the clock (not by the janitor), restart persistence, audit.
Fakes only (the fake push service of notify_world); no Home Assistant, no scene, no device command."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from conftest import as_user
from notify_world import API, World, fake_push  # noqa: F401 - fixture

pytestmark = pytest.mark.usefixtures("daytime_clock")  # the wall clock must not decide quiet hours (see conftest.daytime_clock)

from smplwise.services import notify
from smplwise.services import quiet_windows as qw

T0 = dt.datetime(2026, 10, 5, 9, 0, 0, tzinfo=dt.timezone.utc)  # 12:00 in Asia/Jerusalem: outside the installation quiet hours


@pytest.fixture()
def w(settings, fake_push) -> World:
    world = World(settings)
    with world.db.connection() as conn:
        for area, name, floor in (("kitchen", "מטבח", world.ids["floor2"]), ("hall", "אולם", world.ids["floor2"]), ("garage", "מוסך", world.ids["floor3"]), ("yard", "חצר", None)):
            conn.execute("INSERT INTO ha_areas(area_id, name, floor_id, position, updated_at) VALUES (?,?,?,0,'2026-10-01T08:00:00Z')", (area, name, floor))
    world.subscribe("ops2")
    return world


def _clock(monkeypatch, at: dt.datetime) -> None:
    monkeypatch.setattr(notify, "now_utc", lambda: at)  # the one seam: the routes, the janitor and the dispatch all read it


def _on(w: World, **extra) -> None:
    changes = {"quiet.windows.enabled": "on", **extra}
    r = w.c.put(f"{API}/quiet/settings", json={"changes": changes, "confirmed": True})
    assert r.status_code == 200, r.text


def _start(w: World, user: str, scope_type: str, scope_id: str, **body):
    return w.c.post(f"{API}/quiet/windows", json={"scope_type": scope_type, "scope_id": scope_id, **body}, headers=as_user(user))


_n = [0]


def _emit(w: World, severity: str, area: str | None, **kw):
    """One camera.offline notification (visible to ops2, pushed on webpush by default) in `area`, never folded into another."""
    _n[0] += 1
    res = w.emit("camera.offline", "camera", w.cam, severity=severity, area_id=area, dedupe_key=f"q103:{_n[0]}", params={"name": "לובי"}, **kw)
    assert res.action == "created", res
    return res.id


def _pushes(w: World, fake) -> int:
    return len(fake.to(w.browsers["ops2"]))


def _reasons(w: World, nid: str) -> set[tuple[str, str, str | None]]:
    return {(d["channel"], d["status"], d["reason"]) for d in w.deliveries(nid)}


def _audit(w: World, action: str) -> list[dict]:
    with w.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


# ---------------------------------------------------------------- shipped off

def test_ships_off_and_a_stored_window_is_ignored_while_off(w, fake_push, monkeypatch):
    _clock(monkeypatch, T0)
    assert w.c.get(f"{API}/quiet/settings").json()["settings"]["quiet.windows.enabled"] == "off"
    r = _start(w, "ops2", "floor", w.ids["floor2"])
    assert r.status_code == 409 and r.json()["code"] == "quiet_mode_off"
    with w.db.connection() as conn:  # a row that exists anyway (a restored archive) holds nothing back while the switch is off
        conn.execute("INSERT INTO quiet_windows(id, scope_type, scope_id, floor_id, label, started_at, ends_at, started_by, created_at) VALUES ('w1','area','kitchen',?, 'x','2026-10-05T08:00:00Z','2026-10-05T11:00:00Z','u','2026-10-05T08:00:00Z')", (w.ids["floor2"],))
    nid = _emit(w, "info", "kitchen")
    w.flush()
    assert _pushes(w, fake_push) == 1 and any(s == "sent" for _, s, _ in _reasons(w, nid))


def test_settings_need_system_configure_and_a_confirmation_and_validate(w):
    assert w.c.put(f"{API}/quiet/settings", json={"changes": {"quiet.windows.enabled": "on"}, "confirmed": True}, headers=as_user("ops2")).status_code == 403
    assert w.c.put(f"{API}/quiet/settings", json={"changes": {"quiet.windows.enabled": "on"}}).status_code == 409
    assert w.c.put(f"{API}/quiet/settings", json={"changes": {"quiet.windows.enabled": "maybe"}, "confirmed": True}).status_code == 422
    assert w.c.put(f"{API}/quiet/settings", json={"changes": {"quiet.windows.default_minutes": "300"}, "confirmed": True}).status_code == 422  # above the 240 maximum
    assert w.c.put(f"{API}/quiet/settings", json={"changes": {"quiet.windows.nope": "1"}, "confirmed": True}).status_code == 422
    _on(w)
    row = _audit(w, "settings.changed")[-1]
    assert json.loads(row["details_json"]) == {"key": "quiet.windows.enabled", "before": "off", "after": "on"}


# ---------------------------------------------------------------- what is held: the place and the time only

def test_info_in_the_area_is_held_elsewhere_and_without_an_area_it_is_not(w, fake_push, monkeypatch):
    _clock(monkeypatch, T0)
    _on(w)
    r = _start(w, "ops2", "area", "kitchen")
    assert r.status_code == 201, r.text
    held = _emit(w, "info", "kitchen")
    other_area = _emit(w, "info", "hall")      # another area of the same floor: an AREA window is only that area
    other_floor = _emit(w, "info", "garage")
    no_area = _emit(w, "info", None)
    w.flush()
    assert ("webpush", "skipped", "quiet_window") in _reasons(w, held)
    for nid in (other_area, other_floor, no_area):
        assert any(s == "sent" for _, s, _ in _reasons(w, nid)), nid
    assert _pushes(w, fake_push) == 3
    assert len(w.inbox("ops2")) == 4, "the inbox keeps every notification, held or not"


def test_a_floor_window_covers_every_area_of_the_floor_only(w, fake_push, monkeypatch):
    _clock(monkeypatch, T0)
    _on(w)
    assert _start(w, "ops2", "floor", w.ids["floor2"]).status_code == 201
    a, b, c = _emit(w, "info", "kitchen"), _emit(w, "info", "hall"), _emit(w, "info", "garage")
    w.flush()
    assert all(("webpush", "skipped", "quiet_window") in _reasons(w, n) for n in (a, b))
    assert any(s == "sent" for _, s, _ in _reasons(w, c)) and _pushes(w, fake_push) == 1


def test_critical_and_safety_are_never_held(w, fake_push, monkeypatch):
    _clock(monkeypatch, T0)
    _on(w, **{"quiet.windows.mute_alerts": "on"})  # even the widest setting
    assert _start(w, "ops2", "floor", w.ids["floor2"]).status_code == 201
    leak = w.entity("binary_sensor.kitchen_leak", cls="moisture", floor=w.ids["floor2"], area="kitchen")
    rows = [
        w.emit("sensor.leak", "entity", leak).id,                                  # safety + critical
        _emit(w, "critical", "kitchen"),                                           # critical severity in another category
        _emit(w, "info", "kitchen", category="safety"),                            # safety category at info severity (contract 7.3: the category decides)
    ]
    held = _emit(w, "alert", "kitchen")                                            # alert IS held once mute_alerts is on
    w.flush()
    for nid in rows:
        assert ("webpush", "skipped", "quiet_window") not in _reasons(w, nid), nid
        assert any(s == "sent" for _, s, _ in _reasons(w, nid)), nid
    assert ("webpush", "skipped", "quiet_window") in _reasons(w, held)
    # the same alert with the default setting (info only) is not held
    w.c.put(f"{API}/quiet/settings", json={"changes": {"quiet.windows.mute_alerts": "off"}, "confirmed": True})
    alert = _emit(w, "alert", "kitchen")
    w.flush()
    assert any(s == "sent" for _, s, _ in _reasons(w, alert))


def test_an_escalation_is_never_held(w, monkeypatch):
    _clock(monkeypatch, T0)
    _on(w)
    assert _start(w, "ops2", "area", "kitchen").status_code == 201
    n = {"severity": "info", "category": "device_faults", "area_id": "kitchen"}
    with w.db.connection(mode="read") as conn:
        assert qw.suppresses(conn, n, "new", T0) is not None
        assert qw.suppresses(conn, n, "escalate", T0) is None
        assert qw.suppresses(conn, {**n, "severity": "critical"}, "new", T0) is None
        assert qw.suppresses(conn, {**n, "category": "safety"}, "new", T0) is None


# ---------------------------------------------------------------- REL2140 review M-5: door and entry notifications are never muted

def test_m5_door_and_security_notifications_are_never_held_even_with_mute_alerts(w, fake_push, monkeypatch):
    """The doorbell (doors / alert), a door window that did not open, a denied external access (security / info) - never held, at any
    severity, with `mute_alerts` on; an ordinary alert in the same place still is (the switch keeps its meaning)."""
    _clock(monkeypatch, T0)
    _on(w, **{"quiet.windows.mute_alerts": "on"})
    assert _start(w, "ops2", "floor", w.ids["floor2"]).status_code == 201
    protected_rows = [_emit(w, sev, "kitchen", category=cat) for cat in ("doors", "security") for sev in ("info", "alert")]
    held = _emit(w, "alert", "kitchen")
    w.flush()
    for nid in protected_rows:
        assert ("webpush", "skipped", "quiet_window") not in _reasons(w, nid), nid
        assert any(s == "sent" for _, s, _ in _reasons(w, nid)), nid
    assert ("webpush", "skipped", "quiet_window") in _reasons(w, held)


def test_m5_the_rule_covers_every_door_and_entry_source_of_the_catalogue(w, monkeypatch):
    from smplwise.services import notify_policy

    _clock(monkeypatch, T0)
    _on(w, **{"quiet.windows.mute_alerts": "on"})
    assert _start(w, "ops2", "area", "kitchen").status_code == 201
    door_sources = [s for s in notify_policy.SOURCES if s.key.startswith(("door.", "access."))]
    assert {"door.ring", "door.window_not_started", "door.windows.storm", "door.emergency.released", "access.grant_attention",
            "access.denied_attempt"} <= {s.key for s in door_sources}
    with w.db.connection(mode="read") as conn:
        for s in door_sources:
            for sev in ("info", "alert"):
                for mode in ("new", "renotify"):
                    n = {"source": s.key, "category": s.category, "severity": sev, "area_id": "kitchen"}
                    assert qw.suppresses(conn, n, mode, T0) is None, (s.key, sev, mode)
                    # also when a category was overridden: the source prefix alone protects it
                    assert qw.suppresses(conn, {**n, "category": "device_faults"}, mode, T0) is None, (s.key, "override")
        assert qw.suppresses(conn, {"source": "camera.offline", "category": "device_faults", "severity": "alert", "area_id": "kitchen"}, "new", T0) is not None


def test_m5_every_channel_path_sees_a_door_notification_as_not_held(w, monkeypatch):
    """All five channels decide on Dispatch.quiet_window (set once by `suppresses`), WhatsApp re-checks with `suppresses` in still_wanted:
    a spy on every channel's plan sees no window for the doorbell, and the window for an ordinary info notification."""
    from smplwise.services import notify_channels as nc

    _clock(monkeypatch, T0)
    _on(w, **{"quiet.windows.mute_alerts": "on"})
    assert _start(w, "ops2", "area", "kitchen").status_code == 201
    seen: list[tuple[str, str, str | None]] = []

    class Spy(nc.Channel):
        def __init__(self, name: str) -> None:
            self.name = name

        def plan(self, d, conn):
            seen.append((self.name, d.n["category"], d.quiet_window))
            return []

    names = ("webpush", "email", "app", "announce", "whatsapp")
    monkeypatch.setattr(nc, "CHANNELS", {n: Spy(n) for n in names})
    real = nc.get_policy

    def all_channels(conn, source):
        p = real(conn, source)
        return None if p is None else {**p, "channels": {n: True for n in names}}

    monkeypatch.setattr(nc, "get_policy", all_channels)
    door = _emit(w, "alert", "kitchen", category="doors")
    plain = _emit(w, "info", "kitchen")
    w.flush()
    assert sorted(x[0] for x in seen if x[1] == "doors") == sorted(names) and all(x[2] is None for x in seen if x[1] == "doors")
    assert sorted(x[0] for x in seen if x[1] != "doors") == sorted(names) and all(x[2] for x in seen if x[1] != "doors")
    assert door and plain


# ---------------------------------------------------------------- time: exactly at the end, by the clock

def test_expiry_is_exact_and_does_not_wait_for_the_janitor(w, fake_push, monkeypatch):
    _clock(monkeypatch, T0)
    _on(w)
    r = _start(w, "ops2", "area", "kitchen")
    assert r.status_code == 201 and r.json()["ends_at"] == "2026-10-05T11:00:00Z", "the one-button default is two hours"
    wid = r.json()["id"]
    last = T0 + dt.timedelta(hours=2) - dt.timedelta(seconds=1)
    _clock(monkeypatch, last)
    inside = _emit(w, "info", "kitchen")
    w.flush()
    assert ("webpush", "skipped", "quiet_window") in _reasons(w, inside)
    end = T0 + dt.timedelta(hours=2)
    _clock(monkeypatch, end)  # the janitor has NOT run
    after = _emit(w, "info", "kitchen")
    w.flush()
    assert ("webpush", "skipped", "quiet_window") not in _reasons(w, after) and any(s == "sent" for _, s, _ in _reasons(w, after))
    listed = w.c.get(f"{API}/quiet/windows", headers=as_user("ops2")).json()["windows"]
    assert [x for x in listed if x["id"] == wid][0]["active"] is False
    from smplwise.main import janitor_tick

    janitor_tick(w.db, w.settings)
    with w.db.connection(mode="read") as conn:
        row = dict(conn.execute("SELECT * FROM quiet_windows WHERE id = ?", (wid,)).fetchone())
    assert row["end_reason"] == "expired" and row["ended_at"] == "2026-10-05T11:00:00Z" and row["ended_by"] is None
    assert [a["resource_id"] for a in _audit(w, "quiet.window.expired")] == [wid]
    janitor_tick(w.db, w.settings)
    assert len(_audit(w, "quiet.window.expired")) == 1, "idempotent"
    # a new window may start at the same place once the old one is over
    assert _start(w, "ops2", "area", "kitchen").status_code == 201


def test_explicit_stop_ends_it_now_and_is_audited(w, fake_push, monkeypatch):
    _clock(monkeypatch, T0)
    _on(w)
    wid = _start(w, "ops2", "area", "kitchen", minutes=30).json()["id"]
    assert _start(w, "ops2", "area", "kitchen").json()["code"] == "already_active"
    _clock(monkeypatch, T0 + dt.timedelta(minutes=10))
    r = w.c.post(f"{API}/quiet/windows/{wid}/stop", headers=as_user("ops2"))
    assert r.status_code == 200 and r.json()["active"] is False and r.json()["end_reason"] == "stopped"
    assert w.c.post(f"{API}/quiet/windows/{wid}/stop", headers=as_user("ops2")).json()["code"] == "not_active"
    nid = _emit(w, "info", "kitchen")
    w.flush()
    assert any(s == "sent" for _, s, _ in _reasons(w, nid))
    assert [a["resource_id"] for a in _audit(w, "quiet.window.started")] == [wid] and [a["resource_id"] for a in _audit(w, "quiet.window.stopped")] == [wid]
    assert _audit(w, "quiet.window.stopped")[0]["actor_user_id"] == "dev-ops2"


def test_duration_limits(w, monkeypatch):
    _clock(monkeypatch, T0)
    _on(w)
    assert _start(w, "ops2", "area", "kitchen", minutes=4).status_code == 422
    assert _start(w, "ops2", "area", "kitchen", minutes=241).json()["code"] == "invalid_duration"
    assert _start(w, "ops2", "area", "kitchen", minutes=240).status_code == 201


def test_switching_the_feature_off_ends_every_open_window(w, fake_push, monkeypatch):
    _clock(monkeypatch, T0)
    _on(w)
    wid = _start(w, "ops2", "floor", w.ids["floor2"]).json()["id"]
    w.c.put(f"{API}/quiet/settings", json={"changes": {"quiet.windows.enabled": "off"}, "confirmed": True})
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT end_reason FROM quiet_windows WHERE id = ?", (wid,)).fetchone()[0] == "switched_off"
    _on(w)  # switching back on never revives it
    nid = _emit(w, "info", "kitchen")
    w.flush()
    assert any(s == "sent" for _, s, _ in _reasons(w, nid))


# ---------------------------------------------------------------- permission and scope

def test_permission_and_scope(w, monkeypatch):
    _clock(monkeypatch, T0)
    _on(w)
    f2, f3 = w.ids["floor2"], w.ids["floor3"]
    assert _start(w, "ops3", "floor", f2).status_code == 403          # an operator of another floor
    assert _start(w, "ops3", "area", "kitchen").status_code == 403    # the area sits on floor 2
    assert _start(w, "vera", "floor", f2).status_code == 403          # a viewer reads, never controls
    assert _start(w, "nobody", "floor", f2).status_code == 403
    assert _start(w, "ops2", "area", "yard").status_code == 403       # an area on no floor needs the installation-wide permission
    assert _start(w, "ops2", "area", "garage").status_code == 403     # floor 3
    assert _start(w, "ops2", "area", "nowhere").status_code == 404
    assert _start(w, "ops2", "floor", "nofloor").status_code == 404
    denied = [a for a in _audit(w, "devices.control") if a["decision"] == "denied"]
    assert len(denied) >= 6, "every refused start is audited"
    ok = _start(w, "ops2", "floor", f2)
    assert ok.status_code == 201
    wid = ok.json()["id"]
    assert w.c.post(f"{API}/quiet/windows/{wid}/stop", headers=as_user("ops3")).status_code == 403
    assert w.c.post(f"{API}/quiet/windows/{wid}/stop", headers=as_user("vera")).status_code == 403
    assert w.c.post(f"{API}/quiet/windows/nope/stop", headers=as_user("ops2")).status_code == 404
    # who sees it: devices.read on the floor
    assert [x["id"] for x in w.c.get(f"{API}/quiet/windows", headers=as_user("vera")).json()["windows"]] == [wid]
    assert w.c.get(f"{API}/quiet/windows", headers=as_user("ops3")).json()["windows"] == []
    assert w.c.get(f"{API}/quiet/windows", headers=as_user("nobody")).json()["windows"] == []
    # the administrator (installation scope) may start an area that has no floor, and stop anyone's
    assert _start(w, "joni", "area", "yard").status_code == 201
    assert w.c.post(f"{API}/quiet/windows/{wid}/stop", headers=as_user("joni")).status_code == 200


# ---------------------------------------------------------------- persistence

def test_a_window_survives_a_restart(w, fake_push, settings, monkeypatch):
    from fastapi.testclient import TestClient

    from smplwise.main import create_app

    _clock(monkeypatch, T0)
    _on(w)
    wid = _start(w, "ops2", "area", "kitchen").json()["id"]
    c2 = TestClient(create_app(settings))  # a fresh process image on the same database file
    listed = c2.get(f"{API}/quiet/windows", headers=as_user("ops2")).json()
    assert listed["enabled"] is True and [x["id"] for x in listed["windows"] if x["active"]] == [wid]
    with c2.app.state.db.connection(mode="read") as conn:
        assert qw.suppresses(conn, {"severity": "info", "category": "device_faults", "area_id": "kitchen"}, "new", T0 + dt.timedelta(minutes=5)) == wid
