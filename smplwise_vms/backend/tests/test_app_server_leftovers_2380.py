"""APP-SERVER-LEFTOVERS-2380 (A3 of the display + mobile plan, app-team notes L-2 and Q-3).

Part 1 - a quiet window silences ONLY the push to phones and browsers (the `webpush` channel and the phone app). E-mail, WhatsApp and the spoken
announcement run as if no window existed unless the administrator sets `quiet.windows.channels` = `all`. Critical / safety / door / escalation are
never held (unchanged, see test_quiet103.py), the inbox keeps every notification, and quiet HOURS still hold what they held before.
Part 2 - `GET /brand/app` + `GET /brand/app/logo/{variant}`: the company name and logo for the app's splash / "about" screen, read-only, device token
or session, only the public company branding, ETag / 304, the SVG sandbox headers, nothing from the installer / project / uploader.

Fakes only: the fake web-push service, a fake relay (httpx.MockTransport). No push is sent anywhere, no device, no Home Assistant."""
from __future__ import annotations

import datetime as dt
import io

import pytest
from conftest import as_user
from notify_world import API, World, fake_push  # noqa: F401 - fixture
from PIL import Image
from test_mobile_push import bearer, register, relay  # noqa: F401 - fixtures / helpers: the fake relay and a registered phone

pytestmark = pytest.mark.usefixtures("daytime_clock")

from smplwise.services import brand_assets as ba
from smplwise.services import notify, notify_channels
from smplwise.services import quiet_windows as qw

T0 = dt.datetime(2026, 10, 5, 9, 0, 0, tzinfo=dt.timezone.utc)  # 12:00 in Asia/Jerusalem: outside the installation quiet hours


@pytest.fixture()
def w(settings, fake_push) -> World:
    world = World(settings)
    with world.db.connection() as conn:
        for area, name, floor in (("kitchen", "מטבח", world.ids["floor2"]), ("hall", "אולם", world.ids["floor2"])):
            conn.execute("INSERT INTO ha_areas(area_id, name, floor_id, position, updated_at) VALUES (?,?,?,0,'2026-10-01T08:00:00Z')", (area, name, floor))
    world.subscribe("ops2")
    return world


def _clock(monkeypatch, at: dt.datetime) -> None:
    monkeypatch.setattr(notify, "now_utc", lambda: at)


def _put(w: World, **changes):
    return w.c.put(f"{API}/quiet/settings", json={"changes": changes, "confirmed": True})


def _on(w: World, **extra) -> None:
    r = _put(w, **{"quiet.windows.enabled": "on", **extra})
    assert r.status_code == 200, r.text


_n = [0]


def _emit(w: World, severity: str, area: str | None, **kw):
    _n[0] += 1
    res = w.emit("camera.offline", "camera", w.cam, severity=severity, area_id=area, dedupe_key=f"2380:{_n[0]}", params={"name": "לובי"}, **kw)
    assert res.action == "created", res
    return res.id


ALL_FIVE = ("webpush", "email", "app", "announce", "whatsapp")


class Spy(notify_channels.Channel):
    """Records, per planned dispatch, what the real Dispatch rules say about this channel; plans nothing (nothing is sent)."""

    log: list[tuple[str, str, bool, str]] = []

    def __init__(self, name: str) -> None:
        self.name = name

    def plan(self, d, conn):
        Spy.log.append((self.name, d.n["category"], d.held(self.name), d.held_reason(self.name)))
        return []


def _spy_all_channels(monkeypatch) -> None:
    Spy.log = []
    monkeypatch.setattr(notify_channels, "CHANNELS", {n: Spy(n) for n in ALL_FIVE})
    real = notify_channels.get_policy

    def every_channel(conn, source):
        p = real(conn, source)
        return None if p is None else {**p, "channels": {n: True for n in ALL_FIVE}}

    monkeypatch.setattr(notify_channels, "get_policy", every_channel)


# ---------------------------------------------------------------- part 1: which channels a window holds

def test_the_new_setting_ships_as_push_and_validates(w):
    with w.db.connection(mode="read") as conn:
        assert qw.settings_view(conn)["quiet.windows.channels"] == "push"
    assert w.c.get(f"{API}/quiet/settings").json()["settings"]["quiet.windows.channels"] == "push"
    for bad in ("", "email", "ALL", "everything", 1):
        assert _put(w, **{"quiet.windows.channels": bad}).status_code == 422, bad
    assert _put(w, **{"quiet.windows.channels": "all"}).json()["changed"] == ["quiet.windows.channels"]
    assert w.c.get(f"{API}/quiet/settings").json()["settings"]["quiet.windows.channels"] == "all"
    assert _put(w, **{"quiet.windows.channels": "push"}).json()["changed"] == ["quiet.windows.channels"]


def test_by_default_a_window_holds_phone_and_browser_push_only(w, monkeypatch):
    _clock(monkeypatch, T0)
    _on(w)
    assert w.c.post(f"{API}/quiet/windows", json={"scope_type": "area", "scope_id": "kitchen"}, headers=as_user("ops2")).status_code == 201
    _spy_all_channels(monkeypatch)
    _emit(w, "info", "kitchen")
    w.flush()
    got = {name: (held, reason) for name, _, held, reason in Spy.log}
    assert set(got) == set(ALL_FIVE)
    assert got["webpush"] == (True, "quiet_window") and got["app"] == (True, "quiet_window")
    for other in ("email", "whatsapp", "announce"):
        assert got[other][0] is False, f"{other} must run as if no window existed"


def test_channels_all_restores_the_earlier_behaviour(w, monkeypatch):
    _clock(monkeypatch, T0)
    _on(w, **{"quiet.windows.channels": "all"})
    assert w.c.post(f"{API}/quiet/windows", json={"scope_type": "area", "scope_id": "kitchen"}, headers=as_user("ops2")).status_code == 201
    _spy_all_channels(monkeypatch)
    _emit(w, "info", "kitchen")
    w.flush()
    assert {name: (held, reason) for name, _, held, reason in Spy.log} == {n: (True, "quiet_window") for n in ALL_FIVE}


def test_other_places_and_protected_notifications_are_untouched(w, monkeypatch):
    """The narrowing never widens the hold: another area, a critical severity, the doors category and an escalation are held on no channel."""
    _clock(monkeypatch, T0)
    _on(w, **{"quiet.windows.channels": "all", "quiet.windows.mute_alerts": "on"})
    assert w.c.post(f"{API}/quiet/windows", json={"scope_type": "area", "scope_id": "kitchen"}, headers=as_user("ops2")).status_code == 201
    _spy_all_channels(monkeypatch)
    _emit(w, "info", "hall")
    _emit(w, "critical", "kitchen")
    _emit(w, "alert", "kitchen", category="doors")
    w.flush()
    assert Spy.log and not any(held for _, _, held, _ in Spy.log)


def test_window_holds_never_covers_an_escalation_or_a_channel_outside_the_set():
    d = notify_channels.Dispatch("n1", "new", {"severity": "info", "category": "alerts", "source": "camera.offline"}, {}, {"pass_through": {"info": {}}}, "UTC",
                                 T0, False, [], quiet_window="w1")
    assert [c for c in ALL_FIVE if d.window_holds(c)] == ["webpush", "app"]
    d.quiet_window_channels = qw.ALL_CHANNELS
    assert [c for c in ALL_FIVE if d.window_holds(c)] == list(ALL_FIVE)
    d.mode = "escalate"
    assert not any(d.window_holds(c) for c in ALL_FIVE) and not any(d.held(c) for c in ALL_FIVE)
    d.mode = "new"
    d.quiet_window = None
    assert not any(d.window_holds(c) for c in ALL_FIVE)


def test_quiet_hours_still_hold_the_other_channels_with_their_own_reason():
    """A window that does not hold e-mail must not make e-mail skip the quiet-hours rule: the reason stays `quiet_hours` there."""
    d = notify_channels.Dispatch("n1", "new", {"severity": "info", "category": "alerts", "source": "camera.offline"}, {}, {"pass_through": {"info": {"email": False, "webpush": False}}},
                                 "UTC", T0, True, [], quiet_window="w1")
    assert d.held("email") and d.held_reason("email") == "quiet_hours"
    assert d.held("webpush") and d.held_reason("webpush") == "quiet_window"
    # with no window at all both are quiet hours, as before
    d.quiet_window = None
    assert d.held("email") and d.held_reason("email") == "quiet_hours" and d.held_reason("webpush") == "quiet_hours" and d.held_reason() == "quiet_hours"


def test_the_real_webpush_row_is_still_skipped_and_the_inbox_keeps_it(w, fake_push, monkeypatch):
    _clock(monkeypatch, T0)
    _on(w)
    assert w.c.post(f"{API}/quiet/windows", json={"scope_type": "area", "scope_id": "kitchen"}, headers=as_user("ops2")).status_code == 201
    held, free = _emit(w, "info", "kitchen"), _emit(w, "info", "hall")
    w.flush()
    assert ("webpush", "skipped", "quiet_window") in {(d["channel"], d["status"], d["reason"]) for d in w.deliveries(held)}
    assert any(d["status"] == "sent" for d in w.deliveries(free)) and len(fake_push.to(w.browsers["ops2"])) == 1
    assert len(w.inbox("ops2")) == 2


def test_the_phone_app_push_is_held_in_the_window_and_sent_elsewhere(w, relay, monkeypatch):
    """The `app` channel through the fake relay: held with reason quiet_window in the window's place; a notification elsewhere reaches the relay."""
    _clock(monkeypatch, T0)
    register(w, "ops2")
    w.set_policy("camera.offline", channels={"webpush": False, "email": False, "app": True})
    _on(w)
    assert w.c.post(f"{API}/quiet/windows", json={"scope_type": "area", "scope_id": "kitchen"}, headers=as_user("ops2")).status_code == 201
    held, free = _emit(w, "info", "kitchen"), _emit(w, "info", "hall")
    crit = _emit(w, "critical", "kitchen")
    w.flush()
    assert [(r["status"], r["reason"]) for r in w.deliveries(held) if r["channel"] == "app"] == [("skipped", "quiet_window")]
    assert [r["status"] for r in w.deliveries(free) if r["channel"] == "app"] == ["sent"]
    assert [r["status"] for r in w.deliveries(crit) if r["channel"] == "app"] == ["sent"], "a critical notification is never held"
    assert len(relay.calls) == 2 and {c["notification_id"] for c in relay.calls}.isdisjoint({held})


def test_whatsapp_recheck_follows_the_channel_set(w, monkeypatch):
    """still_wanted re-checks the window with the same rule: by default WhatsApp is not held, with `all` it is."""
    from smplwise.services import notify_whatsapp as nw

    _clock(monkeypatch, T0)
    _on(w)
    assert w.c.post(f"{API}/quiet/windows", json={"scope_type": "area", "scope_id": "kitchen"}, headers=as_user("ops2")).status_code == 201
    nid = _emit(w, "info", "kitchen")
    with w.db.connection(mode="read") as conn:
        n = notify._row_note(conn.execute("SELECT * FROM notifications WHERE id = ?", (nid,)).fetchone())
        assert qw.suppresses(conn, n, "new", T0) and nw.CHANNEL not in qw.held_channels(conn) and {"webpush", "app"} == set(qw.held_channels(conn))
    assert _put(w, **{"quiet.windows.channels": "all"}).status_code == 200
    with w.db.connection(mode="read") as conn:
        assert nw.CHANNEL in qw.held_channels(conn) and qw.held_channels(conn) == qw.ALL_CHANNELS


# ---------------------------------------------------------------- part 2: the app's brand route

def _png(width=300, height=100, color=(30, 60, 120, 255)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGBA", (width, height), color).save(buf, format="PNG")
    return buf.getvalue()


SVG = (b'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100">'
       b'<g fill="#1e2e47"><rect x="0" y="0" width="80" height="80"/></g></svg>')


def _upload(w: World, variant: str, raw: bytes, name="logo.png"):
    r = w.c.post(f"{API}/brand/company-logo/{variant}", files={"file": (name, raw, "application/octet-stream")})
    assert r.status_code == 201, r.text
    return r.json()["stamp"]


def test_brand_app_with_no_logo_is_empty_but_answers(w):
    r = w.c.get(f"{API}/brand/app")
    assert r.status_code == 200 and r.json() == {"company": {"name": "", "logos": {"light": None, "dark": None}}, "version": "l-.d-"}
    assert w.c.get(f"{API}/brand/app/logo/light").status_code == 404
    assert w.c.get(f"{API}/brand/app/logo/sepia").status_code == 404, "an unknown variant"


def test_brand_app_carries_only_the_company_name_and_logos(w):
    assert w.c.put(f"{API}/brand", json={"company_name": "נווה הירדן", "company_kind": "management", "project_name": "מגדל A", "title_prefix": "פנימי"}).status_code == 200
    light, dark = _upload(w, "light", _png()), _upload(w, "dark", SVG, "logo.svg")
    body = w.c.get(f"{API}/brand/app").json()
    assert body["company"]["name"] == "נווה הירדן"
    assert body["company"]["logos"]["light"] == {"stamp": light, "mime": "image/png", "width": 300, "height": 100, "path": "brand/app/logo/light"}
    assert body["company"]["logos"]["dark"]["stamp"] == dark and body["company"]["logos"]["dark"]["mime"] == "image/svg+xml"
    assert set(body) == {"company", "version"} and set(body["company"]) == {"name", "logos"}
    text = str(body)
    for private in ("management", "מגדל A", "פנימי", "uploaded", "joni", "installer", "bytes"):
        assert private not in text, private
    assert body["version"] == f"l{light}.d{dark}"
    # the version changes when a logo is replaced
    light2 = _upload(w, "light", _png(300, 100, (200, 10, 10, 255)))
    assert light2 != light and w.c.get(f"{API}/brand/app").json()["version"] == f"l{light2}.d{dark}"


def test_brand_app_logo_bytes_etag_and_svg_sandbox(w):
    light, dark = _upload(w, "light", _png()), _upload(w, "dark", SVG, "logo.svg")
    r = w.c.get(f"{API}/brand/app/logo/light")
    assert r.status_code == 200 and r.headers["content-type"] == "image/png" and ba.stamp_of(r.content) == light
    assert r.headers["etag"] == f'"{light}"' and r.headers["cache-control"] == "private, no-cache" and r.headers["x-content-type-options"] == "nosniff"
    assert "set-cookie" not in r.headers
    assert w.c.get(f"{API}/brand/app/logo/light", headers={"If-None-Match": f'"{light}"'}).status_code == 304
    assert w.c.get(f"{API}/brand/app/logo/light", headers={"If-None-Match": f'"{dark}"'}).status_code == 200
    s = w.c.get(f"{API}/brand/app/logo/dark")
    assert s.status_code == 200 and s.headers["content-type"] == "image/svg+xml" and "sandbox" in s.headers["content-security-policy"]
    assert b"<script" not in s.content
    # removing the logo: the route answers 404 and the metadata forgets it
    assert w.c.delete(f"{API}/brand/company-logo/light").status_code == 200
    assert w.c.get(f"{API}/brand/app/logo/light").status_code == 404
    assert w.c.get(f"{API}/brand/app").json()["company"]["logos"]["light"] is None


def test_brand_app_is_for_a_device_token_or_a_session_and_is_read_only(w, relay):
    _upload(w, "light", _png())
    did, tok = register(w, "ops2")
    for h in (tok, as_user("ops2"), as_user("vera")):
        assert w.c.get(f"{API}/brand/app", headers=h).status_code == 200
        assert w.c.get(f"{API}/brand/app/logo/light", headers=h).status_code == 200
    bad = {"Authorization": "Bearer arxd_" + "x" * 43}  # the right shape, no such device
    assert w.c.get(f"{API}/brand/app", headers=bad).status_code == 401 and w.c.get(f"{API}/brand/app/logo/light", headers=bad).status_code == 401
    # revoking the device ends its access
    assert w.c.delete(f"{API}/presence/devices/{did}", headers=as_user("ops2")).status_code in (200, 204)
    assert w.c.get(f"{API}/brand/app", headers=tok).status_code == 401
    for method in ("post", "put", "patch", "delete"):
        assert getattr(w.c, method)(f"{API}/brand/app").status_code == 405, method
        assert getattr(w.c, method)(f"{API}/brand/app/logo/light").status_code == 405, method
