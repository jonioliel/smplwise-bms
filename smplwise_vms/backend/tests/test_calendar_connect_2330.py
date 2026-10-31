"""CALCONNECT-2330: the connect flow for external calendars, end to end, against fake provider servers (tests/fake_calendar_providers.py;
nothing reaches Google, Microsoft or any feed host). Covers: the owner's own client (sealed secret, flags only in answers), Google's
installed-app flow (PKCE + state, loopback paste-back, minimal scopes by setting, partial consent refused), Microsoft's device-code flow
(pending / slow_down / connected, rotating refresh tokens resealed), re-authorisation after an expired grant, rate-limit / quota statuses,
binding and sync through the real adapters with NO write lock held while a provider is asked, disconnect (revoke + secrets gone), iCal IN
(guarded fetch, parsing, RRULE expansion, change detection) and iCal OUT feeds (token shown once, busy / titles, 404 when off)."""
from __future__ import annotations

import datetime as dt
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from conftest import as_user, bind
from fake_calendar_providers import (G_CLIENT_ID, G_CLIENT_SECRET, G_REFRESH, MS_CLIENT_ID, MS_REFRESH_1, MS_REFRESH_2, MS_USER_CODE, FakeGoogle, FakeMicrosoft,
                                     Router)
from smplwise.config import Settings
from smplwise.db import Database
from smplwise.main import create_app
from smplwise.routers import calendar as cal_router
from smplwise.routers import calendar_feeds
from smplwise.services.calendar_sync import credentials, engine, google, ics, microsoft, oauth, registry
from smplwise.services.calendar_sync.adapter import OutEvent, SyncError

API = "/api/v1"
UTC = dt.timezone.utc
NOW = dt.datetime(2026, 11, 2, 9, 0, tzinfo=UTC)


@pytest.fixture(scope="module")
def _app(tmp_path_factory):
    st = Settings(data_dir=tmp_path_factory.mktemp("calconnect") / "data", www_dir=None, in_addon=False, trusted_proxies=("172.30.32.2",), dev_user="joni",
                  bootstrap_admin_username="joni", nvr_host="nvr-placeholder.test", nvr_http_port=80, nvr_user=None, nvr_password=None, go2rtc_url=None,
                  log_level="warning", max_upload_bytes=5 * 1024 * 1024, max_pdf_pages=5, max_render_px=800, preview_px=300)
    c = TestClient(create_app(st))
    c.settings_obj = st
    c.get(f"{API}/me")
    return c


@pytest.fixture()
def cc(_app, monkeypatch):
    monkeypatch.setattr(cal_router, "_now", lambda: NOW)
    monkeypatch.setattr(google, "CLOCK", lambda: NOW)
    monkeypatch.setattr(microsoft, "CLOCK", lambda: NOW)
    monkeypatch.setattr(ics, "CLOCK", lambda: NOW)
    registry.clear()
    registry.install_builtin()
    credentials.RUNTIME.configure(_app.app.state.db, _app.settings_obj.data_dir)
    with credentials._LOCK:
        credentials._ACCESS.clear()
    with oauth._LOCK:
        oauth._PENDING.clear()
    with Database(_app.settings_obj.db_path).connection() as c:
        for t in ("cal_occurrences", "cal_guest_details", "cal_approvals", "cal_event_rooms", "cal_events", "cal_members", "cal_sync_map", "cal_sync_bindings", "cal_connections",
                  "cal_feeds", "cal_calendars"):
            c.execute(f"DELETE FROM {t}")
        c.execute("DELETE FROM bindings WHERE assigned_by = 'test'")
        c.execute("DELETE FROM settings WHERE key LIKE 'calendar.%'")
        c.execute("DELETE FROM audit_log WHERE action LIKE 'calendar.%'")
    with calendar_feeds._RATE_LOCK:
        calendar_feeds._RATE.clear()
    yield _app
    monkeypatch.setattr(oauth, "HTTP", None)


def wire(monkeypatch, *fakes):
    r = Router(*fakes)
    monkeypatch.setattr(oauth, "HTTP", r.client)
    return r


def ok(r, code=200):
    assert r.status_code == code, r.text
    return r.json()


def db(c):
    return Database(c.settings_obj.db_path)


def enable(c, **over):
    return ok(c.put(f"{API}/calendar/settings", json={"enabled": True, "sync_manual_min_interval_s": 0, **over}))


def room(c, name="חדר א"):
    return ok(c.post(f"{API}/calendar/calendars", json={"name": name, "type": "room", "color": "blue", "capacity": 10, "buffer_after_min": 0}), 201)["calendar"]


def connect(c, provider, scope="read_write", who=None):
    return ok(c.post(f"{API}/calendar/connections", json={"provider": provider, "label": "חשבון", "scope": scope}, headers=who or {}), 201)["connection"]["id"]


def settings_rows(c, cid):
    with db(c).connection() as x:
        return {r[0]: r[1] for r in x.execute("SELECT key, value FROM settings WHERE key LIKE ?", (f"calendar.conn.{cid}.%",)).fetchall()}


def conn_row(c, cid):
    with db(c).connection() as x:
        return dict(x.execute("SELECT * FROM cal_connections WHERE id = ?", (cid,)).fetchone())


def audit_text(c):
    with db(c).connection() as x:
        return json.dumps([dict(r) for r in x.execute("SELECT * FROM audit_log WHERE action LIKE 'calendar.%'").fetchall()], ensure_ascii=False, default=str)


def google_connected(c, fg, scope="read_write"):
    enable(c)
    cid = connect(c, "google", scope)
    ok(c.put(f"{API}/calendar/connections/{cid}/client", json={"client_id": G_CLIENT_ID, "client_secret": G_CLIENT_SECRET}))
    start = ok(c.post(f"{API}/calendar/connections/{cid}/authorize"))
    q = fg.note_authorize_url(start["authorize_url"])
    done = ok(c.post(f"{API}/calendar/connections/{cid}/authorize/complete", json={"redirect_url": f"http://127.0.0.1:8749/?state={q['state']}&code={fg.code}&scope=x"}))
    assert done["state"] == "connected"
    return cid


# ---------------------------------------------------------------- the owner's client and Google's installed-app flow

def test_google_client_is_sealed_and_answers_carry_flags_only(cc, monkeypatch):
    fg = FakeGoogle()
    wire(monkeypatch, fg)
    enable(cc)
    cid = connect(cc, "google")
    r = cc.put(f"{API}/calendar/connections/{cid}/client", json={"client_id": "not-a-google-client", "client_secret": "x"})
    assert r.status_code == 422 and r.json()["code"] == "client_id_invalid"
    assert cc.put(f"{API}/calendar/connections/{cid}/client", json={"client_id": G_CLIENT_ID, "password": "p"}).status_code == 422
    out = ok(cc.put(f"{API}/calendar/connections/{cid}/client", json={"client_id": G_CLIENT_ID, "client_secret": G_CLIENT_SECRET}))["connection"]
    assert out["setup"] == {"client_id_set": True, "client_secret_set": True, "authorized": False, "feed_url_set": False, "tenant": None, "ready": False, "pending_flow": None}
    rows = settings_rows(cc, cid)
    sealed = rows[f"calendar.conn.{cid}.secret.client_secret"]
    assert sealed.startswith("v1:") and G_CLIENT_SECRET not in sealed
    listing = cc.get(f"{API}/calendar/connections").text
    assert G_CLIENT_SECRET not in listing and G_CLIENT_SECRET not in audit_text(cc)
    assert fg.calls == []  # saving a client asks nobody


def test_google_flow_pkce_state_and_minimal_scope(cc, monkeypatch):
    fg = FakeGoogle()
    wire(monkeypatch, fg)
    enable(cc)
    cid = connect(cc, "google")
    assert cc.post(f"{API}/calendar/connections/{cid}/authorize").json()["code"] == "client_missing"
    ok(cc.put(f"{API}/calendar/connections/{cid}/client", json={"client_id": G_CLIENT_ID, "client_secret": G_CLIENT_SECRET}))
    start = ok(cc.post(f"{API}/calendar/connections/{cid}/authorize"))
    assert start["flow"] == "paste" and start["authorize_url"].startswith("https://accounts.google.com/o/oauth2/v2/auth?")
    q = fg.note_authorize_url(start["authorize_url"])
    assert q["scope"] == "https://www.googleapis.com/auth/calendar"  # owner answer C8: the full calendar scope by default
    assert q["code_challenge_method"] == "S256" and q["redirect_uri"] == "http://127.0.0.1:8749/" and q["access_type"] == "offline"
    assert "code_verifier" not in start["authorize_url"] and "verifier" not in json.dumps(start)
    assert ok(cc.get(f"{API}/calendar/connections"))["connections"][0]["setup"]["pending_flow"] == "google"
    # a stranger's paste, a foreign address and a wrong state never complete it
    bad = cc.post(f"{API}/calendar/connections/{cid}/authorize/complete", json={"redirect_url": f"https://evil.example/?state={q['state']}&code=x"})
    assert bad.status_code == 422 and bad.json()["code"] == "paste_invalid"
    bad = cc.post(f"{API}/calendar/connections/{cid}/authorize/complete", json={"redirect_url": "http://127.0.0.1:8749/?state=nope&code=x"})
    assert bad.status_code == 409 and bad.json()["code"] == "state_mismatch"
    bind(cc, cc.settings_obj, "cora", "calendar_connect", "installation", "*")
    other = cc.post(f"{API}/calendar/connections/{cid}/authorize/complete", json={"redirect_url": f"http://127.0.0.1:8749/?state={q['state']}&code={fg.code}"},
                    headers=as_user("cora"))
    assert other.status_code == 403  # owner answer 19: the connection owner or an administrator
    done = ok(cc.post(f"{API}/calendar/connections/{cid}/authorize/complete", json={"redirect_url": f"http://127.0.0.1:8749/?state={q['state']}&code={fg.code}&scope=x"}))
    assert done["state"] == "connected" and done["connection"]["setup"]["authorized"] is True and done["connection"]["state"] == "ok"
    sealed = settings_rows(cc, cid)[f"calendar.conn.{cid}.secret.refresh_token"]
    assert sealed.startswith("v1:") and G_REFRESH not in sealed
    assert G_REFRESH not in cc.get(f"{API}/calendar/connections").text and G_REFRESH not in audit_text(cc) and "g-access" not in audit_text(cc)
    again = cc.post(f"{API}/calendar/connections/{cid}/authorize/complete", json={"redirect_url": f"http://127.0.0.1:8749/?state={q['state']}&code={fg.code}"})
    assert again.status_code == 409 and again.json()["code"] == "grant_expired"  # single use
    assert fg.foreign == []


def test_google_scope_setting_and_read_connections_ask_for_less(cc, monkeypatch):
    fg = FakeGoogle()
    wire(monkeypatch, fg)
    enable(cc, sync_google_scope="events")
    cid = connect(cc, "google", "read_write")
    ok(cc.put(f"{API}/calendar/connections/{cid}/client", json={"client_id": G_CLIENT_ID, "client_secret": G_CLIENT_SECRET}))
    q = fg.note_authorize_url(ok(cc.post(f"{API}/calendar/connections/{cid}/authorize"))["authorize_url"])
    assert q["scope"].split() == ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.calendarlist.readonly"]
    rid = connect(cc, "google", "read")
    ok(cc.put(f"{API}/calendar/connections/{rid}/client", json={"client_id": G_CLIENT_ID, "client_secret": G_CLIENT_SECRET}))
    q = fg.note_authorize_url(ok(cc.post(f"{API}/calendar/connections/{rid}/authorize"))["authorize_url"])
    assert "calendar.events.readonly" in q["scope"] and "auth/calendar.events " not in q["scope"] + " "
    enable(cc)
    q = fg.note_authorize_url(ok(cc.post(f"{API}/calendar/connections/{rid}/authorize"))["authorize_url"])
    assert q["scope"] == "https://www.googleapis.com/auth/calendar.readonly"


def test_google_partial_consent_is_refused_and_nothing_is_stored(cc, monkeypatch):
    fg = FakeGoogle(granted_scope="openid")
    wire(monkeypatch, fg)
    enable(cc)
    cid = connect(cc, "google")
    ok(cc.put(f"{API}/calendar/connections/{cid}/client", json={"client_id": G_CLIENT_ID, "client_secret": G_CLIENT_SECRET}))
    q = fg.note_authorize_url(ok(cc.post(f"{API}/calendar/connections/{cid}/authorize"))["authorize_url"])
    r = cc.post(f"{API}/calendar/connections/{cid}/authorize/complete", json={"redirect_url": f"http://127.0.0.1:8749/?state={q['state']}&code={fg.code}"})
    assert r.status_code == 409 and r.json()["code"] == "scope_refused"
    assert f"calendar.conn.{cid}.secret.refresh_token" not in settings_rows(cc, cid)
    q = fg.note_authorize_url(ok(cc.post(f"{API}/calendar/connections/{cid}/authorize"))["authorize_url"])
    r = cc.post(f"{API}/calendar/connections/{cid}/authorize/complete", json={"redirect_url": f"http://127.0.0.1:8749/?state={q['state']}&error=access_denied"})
    assert r.status_code == 409 and r.json()["code"] == "denied"


def test_a_new_client_id_drops_the_old_authorisation(cc, monkeypatch):
    fg = FakeGoogle()
    wire(monkeypatch, fg)
    cid = google_connected(cc, fg)
    out = ok(cc.put(f"{API}/calendar/connections/{cid}/client", json={"client_id": "999-other.apps.googleusercontent.com"}))["connection"]
    assert out["setup"]["authorized"] is False


# ---------------------------------------------------------------- binding and syncing through the real Google adapter

def test_google_bind_export_import_without_holding_the_write_lock(cc, monkeypatch):
    fg = FakeGoogle()
    d = db(cc)
    held = []

    def probe(_req):  # a write must get through at once while a provider is asked: nobody holds the write lock
        try:
            with d.write_aside(label="probe", wait_s=0.5) as x:
                x.execute("SELECT 1")
        except Exception as exc:  # noqa: BLE001
            held.append(type(exc).__name__)

    fg.on_request = probe
    wire(monkeypatch, fg)
    cid = google_connected(cc, fg)
    cals = ok(cc.get(f"{API}/calendar/connections/{cid}/calendars"))["calendars"]
    assert {c["id_ref"]: c["can_write"] for c in cals} == {"primary@x": True, "rooms@x": True, "ro@x": False}
    cal = room(cc)
    ok(cc.put(f"{API}/calendar/calendars/{cal['id']}/binding", json={"connection_id": cid, "external_calendar_ref": "rooms@x", "direction": "two_way", "detail": "titles",
                                                                     "dedicated": True}))
    mine = ok(cc.post(f"{API}/calendar/events", json={"calendar_id": cal["id"], "title": "ישיבת צוות", "notes": "סודי", "start": "2026-11-03T10:00:00Z",
                                                      "end": "2026-11-03T11:00:00Z"}), 201)["event"]
    fg.user_create("rooms@x", "ext-a", "הרצאה", "2026-11-04T12:00:00Z", "2026-11-04T13:00:00Z")
    rep = ok(cc.post(f"{API}/calendar/connections/{cid}/sync"))["report"]
    assert rep["state"] == "ok" and rep["created"] == 1 and rep["pushed"] == 1, rep
    pushed = [e for e in fg.events["rooms@x"].values() if e.get("extendedProperties")]
    assert len(pushed) == 1 and pushed[0]["extendedProperties"]["private"]["arx_id"] == mine["id"] and pushed[0]["summary"] == "ישיבת צוות"
    assert pushed[0]["description"] == ""  # titles: no notes leave
    rep = ok(cc.post(f"{API}/calendar/connections/{cid}/sync"))["report"]
    assert rep["pushed"] == 0 and rep["created"] == 0 and rep["echo"] >= 1  # our own push comes back and is ignored
    fg.user_delete("rooms@x", "ext-a")
    assert ok(cc.post(f"{API}/calendar/connections/{cid}/sync"))["report"]["cancelled"] == 1
    assert held == [] and fg.foreign == []


def test_google_expired_grant_needs_reauth_then_reconnects(cc, monkeypatch):
    fg = FakeGoogle()
    wire(monkeypatch, fg)
    cid = google_connected(cc, fg)
    cal = room(cc)
    ok(cc.put(f"{API}/calendar/calendars/{cal['id']}/binding", json={"connection_id": cid, "external_calendar_ref": "rooms@x", "direction": "export", "detail": "busy"}))
    with credentials._LOCK:
        credentials._ACCESS.clear()
    fg.refresh_revoked = True
    rep = ok(cc.post(f"{API}/calendar/connections/{cid}/sync"))["report"]
    assert rep["state"] == "needs_reauth" and rep["code"] == "auth_expired"
    row = conn_row(cc, cid)
    assert row["state"] == "needs_reauth" and row["error_code"] == "auth_expired"
    fg.refresh_revoked = False
    q = fg.note_authorize_url(ok(cc.post(f"{API}/calendar/connections/{cid}/authorize"))["authorize_url"])  # "הרשאה מחדש"
    ok(cc.post(f"{API}/calendar/connections/{cid}/authorize/complete", json={"redirect_url": f"http://127.0.0.1:8749/?state={q['state']}&code={fg.code}"}))
    assert conn_row(cc, cid)["state"] == "ok"
    assert ok(cc.post(f"{API}/calendar/connections/{cid}/sync"))["report"]["state"] == "ok"


@pytest.mark.parametrize("status,body,headers,code", [
    (429, {"error": {"code": 429}}, {"Retry-After": "120"}, "rate_limited"),
    (403, {"error": {"code": 403, "errors": [{"reason": "rateLimitExceeded"}]}}, {}, "rate_limited"),
    (403, {"error": {"code": 403, "errors": [{"reason": "quotaExceeded"}]}}, {}, "quota_exceeded"),
    (503, {"error": {"code": 503}}, {}, "provider_unavailable"),
])
def test_google_provider_limits_become_connection_statuses(cc, monkeypatch, status, body, headers, code):
    fg = FakeGoogle()
    wire(monkeypatch, fg)
    cid = google_connected(cc, fg, scope="read")
    cal = room(cc)
    ok(cc.put(f"{API}/calendar/calendars/{cal['id']}/binding", json={"connection_id": cid, "external_calendar_ref": "rooms@x", "direction": "import", "detail": "titles"}))
    fg.fail_next.append((status, body, headers))
    rep = ok(cc.post(f"{API}/calendar/connections/{cid}/sync"))["report"]
    assert rep["state"] == "error" and rep["code"] == code
    assert conn_row(cc, cid)["error_code"] == code
    assert ok(cc.post(f"{API}/calendar/connections/{cid}/sync"))["report"]["state"] == "ok"  # recovers on the next run


def test_google_gone_sync_token_resyncs_the_window(cc, monkeypatch):
    fg = FakeGoogle()
    wire(monkeypatch, fg)
    cid = google_connected(cc, fg, scope="read")
    cal = room(cc)
    ok(cc.put(f"{API}/calendar/calendars/{cal['id']}/binding", json={"connection_id": cid, "external_calendar_ref": "rooms@x", "direction": "import", "detail": "titles"}))
    fg.user_create("rooms@x", "e1", "א", "2026-11-04T12:00:00Z", "2026-11-04T13:00:00Z")
    fg.user_create("rooms@x", "e2", "ב", "2026-11-05T12:00:00Z", "2026-11-05T13:00:00Z")
    assert ok(cc.post(f"{API}/calendar/connections/{cid}/sync"))["report"]["created"] == 2
    fg.events["rooms@x"].pop("e2")  # vanished without a tombstone
    fg.gone_tokens = True
    rep = ok(cc.post(f"{API}/calendar/connections/{cid}/sync"))["report"]
    assert rep["resync"] == 1 and rep["cancelled"] == 1


def test_disconnect_revokes_at_google_and_forgets_every_secret(cc, monkeypatch):
    fg = FakeGoogle()
    wire(monkeypatch, fg)
    cid = google_connected(cc, fg)
    assert cc.delete(f"{API}/calendar/connections/{cid}").status_code == 204
    assert fg.revoked == [G_REFRESH]
    assert settings_rows(cc, cid) == {}
    assert credentials.cached_access(cid) is None


# ---------------------------------------------------------------- Microsoft: device code

def test_microsoft_device_flow_and_rotating_refresh_tokens(cc, monkeypatch):
    fm = FakeMicrosoft()
    wire(monkeypatch, fm)
    clock = {"t": 1000.0}
    monkeypatch.setattr(oauth, "CLOCK", lambda: clock["t"])
    enable(cc)
    cid = connect(cc, "microsoft")
    assert cc.put(f"{API}/calendar/connections/{cid}/client", json={"client_id": MS_CLIENT_ID, "tenant": "bad tenant!"}).json()["code"] == "tenant_invalid"
    ok(cc.put(f"{API}/calendar/connections/{cid}/client", json={"client_id": MS_CLIENT_ID}))
    start = ok(cc.post(f"{API}/calendar/connections/{cid}/authorize"))
    assert start == {"flow": "device", "user_code": MS_USER_CODE, "verification_url": "https://microsoft.com/devicelogin", "expires_in": 900, "interval": 5}
    assert ok(cc.post(f"{API}/calendar/connections/{cid}/authorize/poll"))["state"] == "pending"
    assert ok(cc.post(f"{API}/calendar/connections/{cid}/authorize/poll")) == {"state": "pending", "interval": 5}  # too early: Microsoft is not asked
    clock["t"] += 6
    assert ok(cc.post(f"{API}/calendar/connections/{cid}/authorize/poll")) == {"state": "slow_down", "interval": 10}
    clock["t"] += 11
    done = ok(cc.post(f"{API}/calendar/connections/{cid}/authorize/poll"))
    assert done["state"] == "connected" and "refresh_token" not in done and done["connection"]["setup"]["authorized"] is True
    assert MS_REFRESH_1 not in cc.get(f"{API}/calendar/connections").text
    with credentials._LOCK:
        credentials._ACCESS.clear()
    cal = room(cc)
    ok(cc.put(f"{API}/calendar/calendars/{cal['id']}/binding", json={"connection_id": cid, "external_calendar_ref": "AAMk-cal-1", "direction": "two_way", "detail": "titles",
                                                                     "dedicated": True}))
    fm.user_create("x1", "פגישה", "2026-11-04T12:00:00.0000000", "2026-11-04T13:00:00.0000000")
    ok(cc.post(f"{API}/calendar/events", json={"calendar_id": cal["id"], "title": "אצלנו", "start": "2026-11-05T10:00:00Z", "end": "2026-11-05T11:00:00Z"}), 201)
    rep = ok(cc.post(f"{API}/calendar/connections/{cid}/sync"))["report"]
    assert rep["state"] == "ok" and rep["created"] == 1 and rep["pushed"] == 1, rep
    with db(cc).connection(mode="read") as x:  # the rotated refresh token was sealed at once
        blob = x.execute("SELECT value FROM settings WHERE key = ?", (f"calendar.conn.{cid}.secret.refresh_token",)).fetchone()[0]
        assert credentials.secret(x, cc.settings_obj.data_dir, cid, "refresh_token") == MS_REFRESH_2 and MS_REFRESH_2 not in blob
    ours = [e for e in fm.events.values() if e.get("singleValueExtendedProperties")]
    assert len(ours) == 1 and ours[0]["subject"] == "אצלנו" and ours[0]["start"]["timeZone"]
    fm.user_delete("x1")
    rep = ok(cc.post(f"{API}/calendar/connections/{cid}/sync"))["report"]
    assert rep["cancelled"] == 1 and rep["echo"] >= 1
    assert fm.foreign == []


def test_microsoft_declined_and_public_client_errors(cc, monkeypatch):
    fm = FakeMicrosoft(script=["authorization_declined"])
    wire(monkeypatch, fm)
    enable(cc)
    cid = connect(cc, "microsoft")
    ok(cc.put(f"{API}/calendar/connections/{cid}/client", json={"client_id": MS_CLIENT_ID}))
    ok(cc.post(f"{API}/calendar/connections/{cid}/authorize"))
    assert ok(cc.post(f"{API}/calendar/connections/{cid}/authorize/poll")) == {"state": "denied"}
    assert ok(cc.post(f"{API}/calendar/connections/{cid}/authorize/poll")) == {"state": "none"}
    ok(cc.put(f"{API}/calendar/connections/{cid}/client", json={"client_id": "11111111-2222-3333-4444-555555555555"}))
    r = cc.post(f"{API}/calendar/connections/{cid}/authorize")
    assert r.status_code == 409 and r.json()["code"] == "client_invalid"
    assert cc.post(f"{API}/calendar/connections/{cid}/authorize/complete", json={"redirect_url": "x"}).status_code == 409  # Google's step only


def test_microsoft_partial_consent_is_refused(cc, monkeypatch):
    fm = FakeMicrosoft(script=["ok"], granted="https://graph.microsoft.com/User.Read")
    wire(monkeypatch, fm)
    enable(cc)
    cid = connect(cc, "microsoft")
    ok(cc.put(f"{API}/calendar/connections/{cid}/client", json={"client_id": MS_CLIENT_ID}))
    ok(cc.post(f"{API}/calendar/connections/{cid}/authorize"))
    r = cc.post(f"{API}/calendar/connections/{cid}/authorize/poll")
    assert r.status_code == 409 and r.json()["code"] == "scope_refused"


def test_microsoft_rate_limit_is_a_status(cc, monkeypatch):
    fm = FakeMicrosoft(script=["ok"])
    wire(monkeypatch, fm)
    enable(cc)
    cid = connect(cc, "microsoft", "read")
    ok(cc.put(f"{API}/calendar/connections/{cid}/client", json={"client_id": MS_CLIENT_ID}))
    ok(cc.post(f"{API}/calendar/connections/{cid}/authorize"))
    ok(cc.post(f"{API}/calendar/connections/{cid}/authorize/poll"))
    cal = room(cc)
    ok(cc.put(f"{API}/calendar/calendars/{cal['id']}/binding", json={"connection_id": cid, "external_calendar_ref": "AAMk-cal-1", "direction": "import", "detail": "busy"}))
    fm.fail_next.append((429, {"error": {"code": "TooManyRequests"}}, {"Retry-After": "30"}))
    rep = ok(cc.post(f"{API}/calendar/connections/{cid}/sync"))["report"]
    assert rep["code"] == "rate_limited"


# ---------------------------------------------------------------- iCal IN

FEED = (b"BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-TIMEZONE:Asia/Jerusalem\r\n"
        b"BEGIN:VEVENT\r\nUID:one@x\r\nDTSTART;TZID=Asia/Jerusalem:20261104T100000\r\nDTEND;TZID=Asia/Jerusalem:20261104T110000\r\nSUMMARY:\xd7\x97\xd7\x95\xd7\x92 \r\n "
        b"\xd7\xa9\xd7\x97\xd7\x99\xd7\x99\xd7\x94\r\nDESCRIPTION:line1\\nline2\r\nBEGIN:VALARM\r\nTRIGGER:-PT15M\r\nEND:VALARM\r\nEND:VEVENT\r\n"
        b"BEGIN:VEVENT\r\nUID:weekly@x\r\nDTSTART:20261103T150000Z\r\nDURATION:PT1H\r\nRRULE:FREQ=WEEKLY;COUNT=3\r\nEXDATE:20261110T150000Z\r\nSUMMARY:weekly\r\nEND:VEVENT\r\n"
        b"BEGIN:VEVENT\r\nUID:allday@x\r\nDTSTART;VALUE=DATE:20261106\r\nSUMMARY:holiday\r\nEND:VEVENT\r\n"
        b"BEGIN:VEVENT\r\nUID:gone@x\r\nDTSTART:20261107T150000Z\r\nDTEND:20261107T160000Z\r\nSTATUS:CANCELLED\r\nSUMMARY:x\r\nEND:VEVENT\r\n"
        b"END:VCALENDAR\r\n")


def test_ics_parser_reads_folding_zones_rules_and_all_day():
    evs = {e.ext_uid: e for e in ics.events_of(FEED, NOW)}
    one = evs["one@x"]
    assert one.title == "חוג שחייה" and one.notes == "line1\nline2" and one.start == dt.datetime(2026, 11, 4, 8, 0, tzinfo=UTC)
    assert sorted(k for k in evs if k.startswith("weekly@x#")) == ["weekly@x#20261103T150000Z", "weekly@x#20261117T150000Z"]  # EXDATE honoured
    assert evs["allday@x"].all_day and evs["allday@x"].end - evs["allday@x"].start == dt.timedelta(days=1)
    assert "gone@x" not in evs
    with pytest.raises(SyncError):
        ics.parse(b"<html>not a calendar</html>")


@pytest.mark.parametrize("url", ["http://cal.example.com/a.ics", "https://localhost/a.ics", "https://10.0.0.5/a.ics", "https://user:pw@cal.example.com/a.ics",
                                 "https://cal.example.com:8443/a.ics", "https://printer.local/a.ics"])
def test_ics_address_rules(cc, url):
    enable(cc)
    cid = connect(cc, "ics_in", "read")
    r = cc.put(f"{API}/calendar/connections/{cid}/feed", json={"url": url})
    assert r.status_code == 422 and r.json()["code"] == "feed_refused"


def test_ics_subscription_imports_and_follows_changes(cc, monkeypatch):
    body = {"v": FEED}
    fetched = []
    monkeypatch.setattr(ics, "FETCH", lambda url: fetched.append(url) or body["v"])
    enable(cc)
    assert cc.post(f"{API}/calendar/connections", json={"provider": "ics_in", "label": "x", "scope": "read_write"}).status_code == 422
    cid = connect(cc, "ics_in", "read")
    out = ok(cc.put(f"{API}/calendar/connections/{cid}/feed", json={"url": "webcal://cal.example.com/private-abc123/basic.ics"}))["connection"]
    assert out["account_hint"] == "cal.example.com" and out["setup"]["feed_url_set"] is True and out["setup"]["ready"] is True
    assert "private-abc123" not in cc.get(f"{API}/calendar/connections").text and "private-abc123" not in audit_text(cc)
    assert ok(cc.get(f"{API}/calendar/connections/{cid}/calendars"))["calendars"] == [{"id_ref": "feed", "name": "חשבון", "can_write": False, "is_primary": True}]
    cal = room(cc)
    r = cc.put(f"{API}/calendar/calendars/{cal['id']}/binding", json={"connection_id": cid, "external_calendar_ref": "feed", "direction": "export", "detail": "busy"})
    assert r.status_code == 422  # iCal IN reads only
    ok(cc.put(f"{API}/calendar/calendars/{cal['id']}/binding", json={"connection_id": cid, "external_calendar_ref": "feed", "direction": "import", "detail": "titles"}))
    rep = ok(cc.post(f"{API}/calendar/connections/{cid}/sync"))["report"]
    assert rep["state"] == "ok" and rep["created"] == 4, rep
    assert fetched == ["https://cal.example.com/private-abc123/basic.ics"]
    assert ok(cc.post(f"{API}/calendar/connections/{cid}/sync"))["report"]["created"] == 0  # same body: nothing changes
    body["v"] = FEED.replace(b"BEGIN:VEVENT\r\nUID:allday@x\r\nDTSTART;VALUE=DATE:20261106\r\nSUMMARY:holiday\r\nEND:VEVENT\r\n", b"")
    rep = ok(cc.post(f"{API}/calendar/connections/{cid}/sync"))["report"]
    assert rep["resync"] == 1 and rep["cancelled"] == 1 and len(fetched) == 3  # the changed body is read once, whole


def test_ics_guarded_fetch_refuses_private_addresses_and_redirects(monkeypatch):
    from smplwise.services.notices import sources

    monkeypatch.setattr(sources, "RESOLVE", lambda host: ["192.168.1.20"] if host == "inside.example.com" else ["93.184.216.34"])
    with pytest.raises(SyncError) as e:
        ics.guarded_fetch("https://inside.example.com/cal.ics")
    assert e.value.code == "feed_refused"

    class Resp:
        def __init__(self, status, headers=None, body=b""):
            self.status, self._h, self._b = status, headers or {}, body

        def getheader(self, k):
            return self._h.get(k)

        def read(self, n):
            b, self._b = self._b[:n], self._b[n:]
            return b

    class Conn:
        def __init__(self, host, ip, port, timeout):
            self.host, self.ip = host, ip

        def request(self, *a, **k):
            pass

        def getresponse(self):
            return Resp(302, {"Location": "https://inside.example.com/x.ics"}) if self.host == "out.example.com" else Resp(200, {}, FEED)

        def close(self):
            pass

    monkeypatch.setattr(sources, "CONNECT", Conn)
    with pytest.raises(SyncError) as e:
        ics.guarded_fetch("https://out.example.com/cal.ics")
    assert e.value.code == "feed_refused"
    assert ics.guarded_fetch("https://cal.example.com/cal.ics") == FEED


# ---------------------------------------------------------------- iCal OUT feeds

def test_feeds_token_once_busy_titles_and_off_switches(cc):
    enable(cc)
    cal = room(cc)
    ok(cc.post(f"{API}/calendar/events", json={"calendar_id": cal["id"], "title": "ישיבת הנהלה", "notes": "פרטי", "start": "2026-11-03T10:00:00Z", "end": "2026-11-03T11:00:00Z"}), 201)
    r = cc.post(f"{API}/calendar/feeds", json={"calendar_ids": [cal["id"]], "detail": "busy"})
    assert r.status_code == 409 and r.json()["code"] == "feeds_disabled"  # off by default
    enable(cc, feeds_enabled=True)
    assert cc.post(f"{API}/calendar/feeds", json={"calendar_ids": [cal["id"]], "detail": "details"}).status_code == 422  # notes never leave via a feed
    made = ok(cc.post(f"{API}/calendar/feeds", json={"calendar_ids": [cal["id"]], "detail": "busy"}), 201)
    path = made["path"]
    token = path.rsplit("/", 1)[1][:-4]
    assert token not in json.dumps(ok(cc.get(f"{API}/calendar/feeds"))) and token not in audit_text(cc)
    with db(cc).connection() as x:
        assert x.execute("SELECT token_hash FROM cal_feeds").fetchone()[0] != token
    doc = cc.get(path, headers={"X-SW-Dev-User": ""})
    assert doc.status_code == 200 and doc.headers["content-type"].startswith("text/calendar") and "set-cookie" not in doc.headers
    assert "SUMMARY:תפוס" in doc.text and "ישיבת" not in doc.text and "פרטי" not in doc.text and "DTSTART:20261103T100000Z" in doc.text
    fid = made["feed"]["id"]
    rot = ok(cc.post(f"{API}/calendar/feeds/{fid}/rotate"))
    assert cc.get(path).status_code == 404 and cc.get(rot["path"]).status_code == 200
    titled = ok(cc.post(f"{API}/calendar/feeds", json={"calendar_ids": [cal["id"]], "detail": "titles"}), 201)
    t = cc.get(titled["path"]).text
    assert "SUMMARY:ישיבת הנהלה" in t and "פרטי" not in t
    ok(cc.post(f"{API}/calendar/feeds/{fid}/revoke"))
    assert cc.get(rot["path"]).status_code == 404
    assert cc.get(f"{API}/calendar/feed/not-a-token.ics").status_code == 404
    enable(cc, feeds_enabled=False)
    assert cc.get(titled["path"]).status_code == 404


def test_feed_needs_an_edit_role_and_is_rate_limited(cc):
    enable(cc, feeds_enabled=True)
    cal = room(cc)
    bind(cc, cc.settings_obj, "cora", "calendar_connect", "installation", "*")
    r = cc.post(f"{API}/calendar/feeds", json={"calendar_ids": [cal["id"]], "detail": "busy"}, headers=as_user("cora"))
    assert r.status_code in (403, 404)
    path = ok(cc.post(f"{API}/calendar/feeds", json={"calendar_ids": [cal["id"]], "detail": "busy"}), 201)["path"]
    codes = [cc.get(path).status_code for _ in range(calendar_feeds.RATE_PER_MIN + 1)]
    assert codes[:calendar_feeds.RATE_PER_MIN] == [200] * calendar_feeds.RATE_PER_MIN and codes[-1] == 429


# ---------------------------------------------------------------- pure mappers

def test_outgoing_mappers_all_day_and_recurrence():
    ev = OutEvent("evt_1", "תפוס", dt.datetime(2026, 11, 3, 22, 0, tzinfo=UTC), dt.datetime(2026, 11, 4, 22, 0, tzinfo=UTC), True, "Asia/Jerusalem",
                  rrule="FREQ=WEEKLY;BYDAY=TU,TH;COUNT=4", exdates=("2026-11-11T00:00",))
    g = google.to_body(ev)
    assert g["start"] == {"date": "2026-11-04"} and g["end"] == {"date": "2026-11-05"}
    assert g["recurrence"] == ["RRULE:FREQ=WEEKLY;BYDAY=TU,TH;COUNT=4", "EXDATE;TZID=Asia/Jerusalem:20261111T000000"]
    assert g["extendedProperties"] == {"private": {"arx_id": "evt_1"}}
    m = microsoft.to_body(ev)
    assert m["isAllDay"] and m["start"]["dateTime"] == "2026-11-04T00:00:00" and m["recurrence"]["pattern"]["daysOfWeek"] == ["tuesday", "thursday"]
    assert m["recurrence"]["range"] == {"startDate": "2026-11-04", "recurrenceTimeZone": "Asia/Jerusalem", "type": "numbered", "numberOfOccurrences": 4}
    odd = OutEvent("evt_2", "x", dt.datetime(2026, 11, 3, 10, tzinfo=UTC), dt.datetime(2026, 11, 3, 11, tzinfo=UTC), False, "UTC", rrule="FREQ=MONTHLY;BYDAY=2TU")
    assert microsoft.recurrence(odd) is None  # Graph cannot say it here: the first instance goes out alone


def test_the_builtin_registry_and_a_provider_link_on_another_host_is_not_followed(cc, monkeypatch):
    assert registry.available() == ["google", "ics_in", "microsoft"]

    def evil(req):
        if req.url.host == "graph.microsoft.com":
            return httpx.Response(200, json={"value": [], "@odata.nextLink": "https://attacker.example/steal"})
        return httpx.Response(599)

    monkeypatch.setattr(oauth, "HTTP", lambda: httpx.Client(transport=httpx.MockTransport(evil)))
    credentials.remember_access("con_x", "ms-access", 3600)
    with pytest.raises(SyncError) as e:
        microsoft.MicrosoftAdapter().list_calendars(engine.ConnectionInfo("con_x", "microsoft", "x", "read", "con_x"))
    assert e.value.code == "provider_error"
