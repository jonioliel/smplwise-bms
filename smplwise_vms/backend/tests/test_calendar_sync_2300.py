"""CALENDARS-298 phase 2 (server): the provider-neutral external-sync interface, the sync engine against an in-memory fake provider, the
connection / binding / manual-sync routes and the scheduler step. No real provider, no credentials, no network: the FakeAdapter is the only
adapter ever registered. Owner rules pinned here (contract C8/C9): external changes are accepted in both directions; a collision keeps
BOTH entries and flags them; the first confirmed entry holds the slot (an external entry too); every behaviour is a setting."""
from __future__ import annotations

import datetime as dt

import pytest
from fastapi.testclient import TestClient

from conftest import as_user, bind
from smplwise.config import Settings
from smplwise.db import Database
from smplwise.main import create_app
from smplwise.routers import calendar as cal_router
from smplwise.services.calendar import jobs, model
from smplwise.services.calendar_sync import engine, registry
from smplwise.services.calendar_sync.adapter import NeedsReauth, RateLimited, SyncError
from smplwise.services.calendar_sync.fake import FakeAdapter

API = "/api/v1"
UTC = dt.timezone.utc
NOW = dt.datetime(2026, 10, 5, 9, 0, tzinfo=UTC)  # a Monday


def T(day: int, hh: int, mm: int = 0, month: int = 11) -> str:
    return f"2026-{month:02d}-{day:02d}T{hh:02d}:{mm:02d}:00Z"  # 2026-11-03 is a Tuesday


def D(day: int, hh: int, mm: int = 0, month: int = 11) -> dt.datetime:
    return dt.datetime(2026, month, day, hh, mm, tzinfo=UTC)


@pytest.fixture(scope="module")
def _app(tmp_path_factory):
    st = Settings(data_dir=tmp_path_factory.mktemp("cal2300s") / "data", www_dir=None, in_addon=False, trusted_proxies=("172.30.32.2",), dev_user="joni",
                  bootstrap_admin_username="joni", nvr_host="nvr-placeholder.test", nvr_http_port=80, nvr_user=None, nvr_password=None, go2rtc_url=None,
                  log_level="warning", max_upload_bytes=5 * 1024 * 1024, max_pdf_pages=5, max_render_px=800, preview_px=300)
    c = TestClient(create_app(st))
    c.settings_obj = st
    c.get(f"{API}/me")
    return c


@pytest.fixture()
def cc(_app, monkeypatch):
    clock = {"now": NOW}
    monkeypatch.setattr(cal_router, "_now", lambda: clock["now"])
    _app.clock = clock
    with Database(_app.settings_obj.db_path).connection() as c:
        for t in ("cal_occurrences", "cal_guest_details", "cal_approvals", "cal_event_rooms", "cal_events", "cal_members", "cal_sync_map", "cal_sync_bindings", "cal_connections",
                  "cal_calendars"):
            c.execute(f"DELETE FROM {t}")
        c.execute("DELETE FROM bindings WHERE assigned_by = 'test'")
        c.execute("DELETE FROM settings WHERE key LIKE 'calendar.%'")
        c.execute("DELETE FROM audit_log WHERE action LIKE 'calendar.%'")
    return _app


@pytest.fixture()
def fake():
    f = FakeAdapter("google")
    f.add_calendar("ext-1", "Ext one")
    registry.register("google", lambda: f)
    yield f
    registry.clear()


def db(c):
    return Database(c.settings_obj.db_path)


def ok(r, code=200):
    assert r.status_code == code, r.text
    return r.json()


def enable(c, **over):
    return ok(c.put(f"{API}/calendar/settings", json={"enabled": True, "sync_manual_min_interval_s": 0, **over}))


def room(c, name="חדר א", **kw):
    r = c.post(f"{API}/calendar/calendars", json={"name": name, "type": "room", "color": "blue", "capacity": 10, "buffer_after_min": 0, **kw})
    return ok(r, 201)["calendar"]


def book(c, cal, start, end, who=None, **kw):
    return c.post(f"{API}/calendar/events", json={"calendar_id": cal["id"], "title": kw.pop("title", "ישיבה"), "start": start, "end": end, **kw}, headers=who or {})


def connect(c, provider="google", scope="read_write", who=None):
    r = c.post(f"{API}/calendar/connections", json={"provider": provider, "label": "חשבון בדיקה", "scope": scope}, headers=who or {})
    return ok(r, 201)["connection"]["id"]


def bind_cal(c, cal, cid, who=None, **kw):
    body = {"connection_id": cid, "external_calendar_ref": "ext-1", "direction": "export", "detail": "busy", **kw}
    return c.put(f"{API}/calendar/calendars/{cal['id']}/binding", json=body, headers=who or {})


def sync(c, cid):
    return ok(c.post(f"{API}/calendar/connections/{cid}/sync"))["report"]


def conn_row(c, cid):
    with db(c).connection() as x:
        return dict(x.execute("SELECT * FROM cal_connections WHERE id = ?", (cid,)).fetchone())


def ev_row(c, eid):
    with db(c).connection() as x:
        return dict(x.execute("SELECT * FROM cal_events WHERE id = ?", (eid,)).fetchone())


def ext_events(c, kind="external"):
    with db(c).connection() as x:
        return [dict(r) for r in x.execute("SELECT * FROM cal_events WHERE kind = ? ORDER BY starts_at", (kind,)).fetchall()]


def setup_import(c, fake, detail="titles", direction="import", scope="read", **cal_kw):
    enable(c)
    cal = room(c, **cal_kw)
    cid = connect(c, scope=scope)
    ok(bind_cal(c, cal, cid, direction=direction, detail=detail, **({"dedicated": True} if direction == "two_way" else {})))
    return cal, cid


# ---------------------------------------------------------------- settings (every behaviour is a setting with the owner's default)

def test_sync_settings_defaults_and_validation(cc):
    s = ok(cc.get(f"{API}/calendar/settings"))["settings"]
    assert s["sync_enabled"] is True and s["sync_poll_min"] == 5 and s["sync_accept_external"] is True
    assert s["sync_external_delete"] == "cancel" and s["sync_google_scope"] == "full" and s["sync_manual_min_interval_s"] == 60
    for bad in ({"sync_poll_min": 1}, {"sync_poll_min": 61}, {"sync_external_delete": "x"}, {"sync_google_scope": "narrow"}, {"sync_enabled": "yes"}, {"sync_manual_min_interval_s": -1}):
        assert cc.put(f"{API}/calendar/settings", json=bad).status_code == 422
    ok(cc.put(f"{API}/calendar/settings", json={"sync_google_scope": "events", "sync_poll_min": 15, "sync_external_delete": "flag", "sync_accept_external": False}))
    s = ok(cc.get(f"{API}/calendar/settings"))["settings"]
    assert (s["sync_google_scope"], s["sync_poll_min"], s["sync_external_delete"], s["sync_accept_external"]) == ("events", 15, "flag", False)


# ---------------------------------------------------------------- connections: RBAC, validation, audit

def test_connections_need_calendar_connect_and_the_module(cc, fake):
    assert cc.get(f"{API}/calendar/connections").status_code == 404  # module off
    enable(cc)
    bind(cc, cc.settings_obj, "carl", "operator", "installation", "*")
    carl = as_user("carl")
    r = cc.post(f"{API}/calendar/connections", json={"provider": "google", "label": "x", "scope": "read"}, headers=carl)
    assert r.status_code == 403
    with db(cc).connection() as x:
        assert x.execute("SELECT 1 FROM audit_log WHERE action = 'calendar.connect' AND decision = 'denied'").fetchone()
    assert cc.get(f"{API}/calendar/connections", headers=carl).status_code == 403
    bind(cc, cc.settings_obj, "cora", "calendar_connect", "installation", "*")
    cora = as_user("cora")
    cid = connect(cc, who=cora)
    listing = ok(cc.get(f"{API}/calendar/connections", headers=cora))
    assert [c["id"] for c in listing["connections"]] == [cid] and listing["connections"][0]["adapter_available"] is True
    assert {p["provider"]: p["adapter_available"] for p in listing["providers"]} == {"ics_out": False, "ics_in": False, "google": True, "microsoft": False}
    # another connect holder cannot pause or delete his connection; the administrator can
    bind(cc, cc.settings_obj, "dana", "calendar_connect", "installation", "*")
    assert cc.post(f"{API}/calendar/connections/{cid}/pause", headers=as_user("dana")).status_code == 403
    assert cc.delete(f"{API}/calendar/connections/{cid}", headers=as_user("dana")).status_code == 403
    assert ok(cc.post(f"{API}/calendar/connections/{cid}/pause"))["connection"]["state"] == "paused"


def test_connection_body_is_validated_and_never_takes_a_password(cc):
    enable(cc)
    for bad in ({"provider": "dropbox", "label": "x"}, {"provider": "google", "label": ""}, {"provider": "google", "label": "x", "scope": "admin"},
                {"provider": "google", "label": "x", "password": "hunter2"}, {"provider": "google", "label": "x", "client_secret": "s"}):
        assert cc.post(f"{API}/calendar/connections", json=bad).status_code == 422, bad
    r = ok(cc.post(f"{API}/calendar/connections", json={"provider": "google", "label": "LABEL-PRIVATE"}), 201)
    assert r["connection"]["scope"] == "read" and r["connection"]["state"] == "ok" and r["setup_steps"]
    with db(cc).connection() as x:
        a = x.execute("SELECT details_json FROM audit_log WHERE action = 'calendar.connection.add'").fetchone()
        assert a is not None and "LABEL-PRIVATE" not in (a[0] or "") and "google" in a[0]  # ids and provider only, not the label


def test_unknown_connection_is_a_404_and_listing_calendars_uses_the_adapter(cc, fake):
    enable(cc)
    assert cc.post(f"{API}/calendar/connections/con_nope/sync").status_code == 404
    cid = connect(cc)
    assert ok(cc.get(f"{API}/calendar/connections/{cid}/calendars"))["calendars"] == [{"id_ref": "ext-1", "name": "Ext one", "can_write": True, "is_primary": False}]
    registry.clear()
    r = cc.get(f"{API}/calendar/connections/{cid}/calendars")
    assert r.status_code == 409 and r.json()["code"] == "adapter_unavailable"


def test_provider_without_an_adapter_never_reaches_a_network(cc):
    enable(cc)
    cal = room(cc)
    cid = connect(cc)
    ok(bind_cal(cc, cal, cid))
    rep = sync(cc, cid)
    assert rep == {"skipped": "adapter_unavailable"}
    row = conn_row(cc, cid)
    assert row["state"] == "error" and row["error_code"] == "adapter_unavailable"


# ---------------------------------------------------------------- bindings

def test_binding_rules(cc, fake):
    enable(cc)
    cal = room(cc)
    ro = connect(cc, scope="read")
    rw = connect(cc, scope="read_write")
    ics_in = connect(cc, provider="ics_in", scope="read")
    ics_out = connect(cc, provider="ics_out", scope="read_write")
    cases = [
        (bind_cal(cc, cal, rw, direction="two_way"), "two_way_requires_dedicated"),
        (bind_cal(cc, cal, ro, direction="export"), "connection_read_only"),
        (bind_cal(cc, cal, ics_in, direction="export"), "direction_unsupported"),
        (bind_cal(cc, cal, ics_out, direction="import"), "direction_unsupported"),
        (bind_cal(cc, cal, rw, direction="sideways"), "validation"),
        (bind_cal(cc, cal, rw, detail="everything"), "validation"),
        (bind_cal(cc, cal, rw, dedicated="yes"), "validation"),
    ]
    for r, code in cases:
        assert r.status_code == 422 and r.json()["code"] == code, (r.text, code)
    assert bind_cal(cc, cal, "con_missing").status_code == 404
    b = ok(bind_cal(cc, cal, rw, direction="two_way", detail="titles", dedicated=True))["binding"]
    assert b["direction"] == "two_way" and b["dedicated"] is True
    got = ok(cc.get(f"{API}/calendar/calendars/{cal['id']}"))["calendar"]
    assert got["sync"] == {"state": "ok", "provider": "google", "direction": "two_way", "detail": "titles", "dedicated": True}
    with db(cc).connection() as x:  # the external reference is sealed at rest
        sealed = x.execute("SELECT external_calendar_id_sealed FROM cal_sync_bindings").fetchone()[0]
        assert sealed.startswith("v1:") and "ext-1" not in sealed
        assert x.execute("SELECT 1 FROM audit_log WHERE action = 'calendar.binding.set'").fetchone()
    ok(bind_cal(cc, cal, rw, direction="export", detail="busy"))  # replacing is allowed (one binding per calendar)
    r = ok(cc.put(f"{API}/calendar/calendars/{cal['id']}/binding", json={"connection_id": None}))
    assert r["binding"] is None and ok(cc.get(f"{API}/calendar/calendars/{cal['id']}"))["calendar"]["sync"] is None


def test_binding_needs_an_edit_role_in_the_calendar(cc, fake):
    enable(cc)
    cal = room(cc)
    cid = connect(cc)
    bind(cc, cc.settings_obj, "cora", "calendar_connect", "installation", "*")
    bind(cc, cc.settings_obj, "cora", "operator", "installation", "*")
    cora = as_user("cora")
    assert bind_cal(cc, cal, cid, who=cora).status_code == 404  # members-only calendar: absent for him
    cur = ok(cc.get(f"{API}/calendar/calendars/{cal['id']}"))["calendar"]
    ok(cc.put(f"{API}/calendar/calendars/{cal['id']}/members", json={"revision": cur["revision"], "members": [{"subject_kind": "user", "subject_id": "dev-cora", "cal_role": "view"}]}))
    assert bind_cal(cc, cal, cid, who=cora).status_code == 403  # he sees it but may not publish it
    cur = ok(cc.get(f"{API}/calendar/calendars/{cal['id']}"))["calendar"]
    ok(cc.put(f"{API}/calendar/calendars/{cal['id']}/members", json={"revision": cur["revision"], "members": [{"subject_kind": "user", "subject_id": "dev-cora", "cal_role": "edit"}]}))
    assert bind_cal(cc, cal, cid, who=cora).status_code == 200


# ---------------------------------------------------------------- export (Arx -> provider)

def test_export_busy_blocks_then_updates_then_deletes_without_echo(cc, fake):
    enable(cc)
    cal = room(cc)
    cid = connect(cc)
    ok(bind_cal(cc, cal, cid, direction="export", detail="busy"))
    ev = ok(book(cc, cal, T(3, 10), T(3, 11), title="סודי", notes="הערה פרטית"), 201)["event"]
    assert sync(cc, cid)["pushed"] == 1
    (uid, out), = fake.pushed.items()
    assert out.title == "תפוס" and out.notes == "" and out.location == "" and out.arx_id == ev["id"]  # the busy mapper hides everything
    assert fake.events("ext-1")[uid].arx_id == ev["id"]
    assert ok(cc.get(f"{API}/calendar/connections"))["connections"][0]["state"] == "ok"
    assert sync(cc, cid)["pushed"] == 0  # nothing changed: nothing sent
    cur = ok(cc.get(f"{API}/calendar/events/{ev['id']}"))["event"]
    ok(cc.patch(f"{API}/calendar/events/{ev['id']}", json={"revision": cur["revision"], "scope": "series", "start": T(3, 12), "end": T(3, 13)}))
    first_etag = fake.events("ext-1")[uid].etag
    assert sync(cc, cid)["pushed"] == 1
    assert fake.events("ext-1")[uid].etag != first_etag and fake.events("ext-1")[uid].start == D(3, 12)
    cur = ok(cc.get(f"{API}/calendar/events/{ev['id']}"))["event"]
    ok(cc.post(f"{API}/calendar/events/{ev['id']}/cancel", json={"revision": cur["revision"], "scope": "series"}))
    rep = sync(cc, cid)
    assert rep["deleted_out"] == 1 and fake.events("ext-1") == {}
    with db(cc).connection() as x:
        assert x.execute("SELECT COUNT(*) FROM cal_sync_map").fetchone()[0] == 0


def test_export_detail_levels_and_guests_are_never_sent(cc, fake):
    enable(cc)
    cal = room(cc, "חדר ישיבות")
    cid = connect(cc)
    ok(bind_cal(cc, cal, cid, direction="export", detail="titles"))
    ok(book(cc, cal, T(3, 10), T(3, 11), title="חוג קרמיקה", notes="סודי", on_behalf={"kind": "class", "label": "קרמיקה"}, guests=[{"name": "דנה כהן", "phone": "0501234567"}]), 201)
    sync(cc, cid)
    (out,) = fake.pushed.values()
    assert out.title == "חוג קרמיקה" and out.location == "חדר ישיבות" and out.notes == ""  # titles + room, no notes
    assert "דנה" not in repr(out) and "0501234567" not in repr(out)
    ok(bind_cal(cc, cal, cid, direction="export", detail="details"))
    sync(cc, cid)
    (out,) = list(fake.pushed.values())[-1:]
    assert out.notes == "סודי" and "דנה" not in repr(out)


def test_only_confirmed_entries_are_exported(cc, fake):
    enable(cc)
    cal = room(cc)
    cid = connect(cc)
    ok(bind_cal(cc, cal, cid))
    ok(book(cc, cal, T(3, 10), T(3, 11)), 201)
    waiting = ok(book(cc, cal, T(3, 10), T(3, 11), title="מתחרה"), 201)
    assert waiting["state"] == "pending"
    assert sync(cc, cid)["pushed"] == 1  # the contested request is not published until the manager approves it


# ---------------------------------------------------------------- import (provider -> Arx): accepted in both directions

def test_import_creates_edits_and_cancels_external_entries(cc, fake):
    cal, cid = setup_import(cc, fake, detail="titles")
    uid = fake.user_create("ext-1", "פגישת ספק", D(3, 10), D(3, 11), notes="סוד")
    rep = sync(cc, cid)
    assert rep["created"] == 1 and rep["pulled"] == 1
    (e,) = ext_events(cc)
    assert e["title"] == "פגישת ספק" and e["notes"] == "" and e["state"] == "confirmed" and e["source"] == "google" and e["source_ref"] == uid
    assert e["on_behalf_label"] == "מיומן חיצוני" and e["calendar_id"] == cal["id"] and e["sync_flag"] is None
    occ = ok(cc.get(f"{API}/calendar/occurrences", params={"from": T(1, 0), "to": T(30, 0)}))["occurrences"]
    assert [(o["kind"], o["title"], o["start"]) for o in occ] == [("external", "פגישת ספק", T(3, 10))]
    assert sync(cc, cid)["pulled"] == 0  # nothing new
    fake.user_edit("ext-1", uid, title="פגישת ספק (הוזז)", start=D(3, 14), end=D(3, 15))
    rep = sync(cc, cid)
    assert rep["updated"] == 1
    (e,) = ext_events(cc)
    assert e["title"] == "פגישת ספק (הוזז)" and e["starts_at"] == T(3, 14) and e["revision"] > 1
    fake.user_delete("ext-1", uid)
    assert sync(cc, cid)["cancelled"] == 1
    assert ext_events(cc)[0]["state"] == "cancelled"
    assert ok(cc.get(f"{API}/calendar/occurrences", params={"from": T(1, 0), "to": T(30, 0)}))["occurrences"] == []


def test_import_detail_busy_keeps_only_a_block_and_details_keeps_notes(cc, fake):
    cal, cid = setup_import(cc, fake, detail="busy")
    fake.user_create("ext-1", "פרטי מאוד", D(3, 10), D(3, 11), notes="סוד גדול")
    sync(cc, cid)
    (e,) = ext_events(cc)
    assert e["title"] == "תפוס" and e["notes"] == ""
    fake.user_create("ext-1", "פתוח", D(4, 10), D(4, 11), notes="הערה")
    ok(bind_cal(cc, cal, cid, direction="import", detail="details"))
    sync(cc, cid)
    by_title = {r["title"]: r for r in ext_events(cc)}
    assert by_title["תפוס"]["notes"] == "" and by_title["פתוח"]["notes"] == "הערה"  # the new level applies from now on; what was stored as a block stays a block
    assert len(by_title) == 2


def test_invalid_and_hostile_inbound_events_are_contained(cc, fake):
    cal, cid = setup_import(cc, fake)
    fake.user_create("ext-1", "הפוך", D(3, 11), D(3, 10))  # ends before it starts
    fake.user_create("ext-1", "x" * 500 + "\x00\x07", D(5, 10), D(5, 11), notes="n" * 5000)
    fake.user_create("ext-1", "   ", D(6, 10), D(6, 11))
    sync(cc, cid)
    rows = ext_events(cc)
    assert [r["starts_at"] for r in rows] == [T(5, 10), T(6, 10)]
    assert len(rows[0]["title"]) == 120 and "\x00" not in rows[0]["title"] and rows[1]["title"] == "(ללא כותרת)"


def test_accept_external_off_skips_every_pull(cc, fake):
    cal, cid = setup_import(cc, fake)
    enable(cc, sync_accept_external=False)
    fake.user_create("ext-1", "לא נקלט", D(3, 10), D(3, 11))
    rep = sync(cc, cid)
    assert rep["pulled"] == 0 and ext_events(cc) == [] and not [c for c in fake.calls if c[0] == "pull"]
    enable(cc, sync_accept_external=True)
    assert sync(cc, cid)["created"] == 1


# ---------------------------------------------------------------- collisions: keep BOTH and flag (C9), first holds (C2)

def test_external_collision_keeps_both_entries_and_flags_them(cc, fake):
    cal, cid = setup_import(cc, fake)
    mine = ok(book(cc, cal, T(3, 10), T(3, 11), title="שלי"), 201)["event"]
    fake.user_create("ext-1", "חיצוני", D(3, 10, 30), D(3, 11, 30))
    fake.user_create("ext-1", "בלי התנגשות", D(3, 14), D(3, 15))
    rep = sync(cc, cid)
    assert rep["created"] == 2 and rep["flagged"] == 2
    ext = next(r for r in ext_events(cc) if r["title"] == "חיצוני")
    free = next(r for r in ext_events(cc) if r["title"] == "בלי התנגשות")
    assert ext["state"] == "confirmed" and ext["sync_flag"] == "conflict" and free["sync_flag"] is None
    assert ev_row(cc, mine["id"])["state"] == "confirmed" and ev_row(cc, mine["id"])["sync_flag"] == "conflict"  # nothing reverted, nothing deleted
    got = ok(cc.get(f"{API}/calendar/events/{mine['id']}"))["event"]
    assert got["sync_flag"] == "conflict" and got["source"] == "arx"
    with db(cc).connection() as x:
        assert x.execute("SELECT 1 FROM audit_log WHERE action = 'calendar.sync.flag'").fetchone()


def test_resolve_keep_cancel_and_automatic_clear_when_one_side_moves(cc, fake):
    cal, cid = setup_import(cc, fake)
    mine = ok(book(cc, cal, T(3, 10), T(3, 11)), 201)["event"]
    uid = fake.user_create("ext-1", "חיצוני", D(3, 10, 30), D(3, 11, 30))
    sync(cc, cid)
    ext = ext_events(cc)[0]
    assert cc.post(f"{API}/calendar/events/{mine['id']}/sync-resolve", json={"revision": 99, "resolution": "keep"}).status_code == 409  # stale
    assert cc.post(f"{API}/calendar/events/{mine['id']}/sync-resolve", json={"revision": ev_row(cc, mine["id"])["revision"], "resolution": "burn"}).status_code == 422
    # the external side moves away: both flags clear on the next sync
    fake.user_edit("ext-1", uid, start=D(3, 15), end=D(3, 16))
    sync(cc, cid)
    assert ev_row(cc, mine["id"])["sync_flag"] is None and ev_row(cc, ext["id"])["sync_flag"] is None
    assert cc.post(f"{API}/calendar/events/{mine['id']}/sync-resolve", json={"revision": ev_row(cc, mine["id"])["revision"], "resolution": "keep"}).status_code == 409  # nothing to resolve
    # a new collision, resolved by cancelling the external entry
    fake.user_edit("ext-1", uid, start=D(3, 10, 15), end=D(3, 10, 45))
    sync(cc, cid)
    assert ev_row(cc, ext["id"])["sync_flag"] == "conflict"
    r = ok(cc.post(f"{API}/calendar/events/{ext['id']}/sync-resolve", json={"revision": ev_row(cc, ext["id"])["revision"], "resolution": "cancel"}))
    assert r["state"] == "cancelled" and r["sync_flag"] is None
    assert ev_row(cc, mine["id"])["sync_flag"] is None  # the peer lost its collision
    # and keep: the flag is simply cleared, both stay
    fake.user_edit("ext-1", uid, start=D(3, 10, 20), end=D(3, 10, 50))
    sync(cc, cid)
    with db(cc).connection() as x:
        x.execute("UPDATE cal_events SET sync_flag = 'conflict' WHERE id = ?", (mine["id"],))
    ok(cc.post(f"{API}/calendar/events/{mine['id']}/sync-resolve", json={"revision": ev_row(cc, mine["id"])["revision"], "resolution": "keep"}))
    assert ev_row(cc, mine["id"])["sync_flag"] is None and ev_row(cc, mine["id"])["state"] == "confirmed"


def test_resolve_needs_an_edit_role(cc, fake):
    cal, cid = setup_import(cc, fake)
    mine = ok(book(cc, cal, T(3, 10), T(3, 11)), 201)["event"]
    fake.user_create("ext-1", "חיצוני", D(3, 10, 30), D(3, 11, 30))
    sync(cc, cid)
    bind(cc, cc.settings_obj, "vera", "viewer", "installation", "*")
    cur = ok(cc.get(f"{API}/calendar/calendars/{cal['id']}"))["calendar"]
    ok(cc.put(f"{API}/calendar/calendars/{cal['id']}/members", json={"revision": cur["revision"], "members": [{"subject_kind": "user", "subject_id": "dev-vera", "cal_role": "view"}]}))
    r = cc.post(f"{API}/calendar/events/{mine['id']}/sync-resolve", json={"revision": ev_row(cc, mine["id"])["revision"], "resolution": "keep"}, headers=as_user("vera"))
    assert r.status_code == 403


def test_an_external_entry_holds_its_slot_first_and_a_later_request_waits(cc, fake):
    cal, cid = setup_import(cc, fake)
    fake.user_create("ext-1", "חיצוני", D(3, 10), D(3, 11))
    sync(cc, cid)
    r = ok(book(cc, cal, T(3, 10, 30), T(3, 11, 30), title="מאוחר"), 201)
    assert r["state"] == "pending" and r["event"]["contested"] is True  # not refused, not confirmed: the manager decides


# ---------------------------------------------------------------- two-way

def test_two_way_accepts_an_outside_edit_without_echoing_it_back(cc, fake):
    cal, cid = setup_import(cc, fake, direction="two_way", scope="read_write")
    mine = ok(book(cc, cal, T(3, 10), T(3, 11), title="שלי"), 201)["event"]
    rep = sync(cc, cid)
    assert rep["pushed"] == 1
    (uid,) = fake.events("ext-1")
    fake.user_edit("ext-1", uid, start=D(3, 13), end=D(3, 14))  # someone moves it in the provider's own application
    rep = sync(cc, cid)
    assert rep["updated"] == 1 and rep["pushed"] == 0
    assert ev_row(cc, mine["id"])["starts_at"] == T(3, 13) and ev_row(cc, mine["id"])["title"] == "שלי"  # time adapted; busy export never overwrites the title
    assert sync(cc, cid)["pushed"] == 0  # stable: no ping-pong
    # and an Arx edit still goes out
    cur = ok(cc.get(f"{API}/calendar/events/{mine['id']}"))["event"]
    ok(cc.patch(f"{API}/calendar/events/{mine['id']}", json={"revision": cur["revision"], "scope": "series", "start": T(3, 15), "end": T(3, 16)}))
    assert sync(cc, cid)["pushed"] == 1 and fake.events("ext-1")[uid].start == D(3, 15)


def test_two_way_outside_delete_cancels_by_default(cc, fake):
    cal, cid = setup_import(cc, fake, direction="two_way", scope="read_write")
    mine = ok(book(cc, cal, T(3, 10), T(3, 11)), 201)["event"]
    sync(cc, cid)
    (uid,) = fake.events("ext-1")
    fake.user_delete("ext-1", uid)
    rep = sync(cc, cid)
    assert rep["cancelled"] == 1 and rep["pushed"] == 0 and ev_row(cc, mine["id"])["state"] == "cancelled"
    assert fake.events("ext-1") == {}  # not pushed back


def test_two_way_outside_delete_can_be_set_to_flag_and_keep(cc, fake):
    cal, cid = setup_import(cc, fake, direction="two_way", scope="read_write")
    enable(cc, sync_external_delete="flag")
    mine = ok(book(cc, cal, T(3, 10), T(3, 11)), 201)["event"]
    sync(cc, cid)
    (uid,) = fake.events("ext-1")
    fake.user_delete("ext-1", uid)
    rep = sync(cc, cid)
    row = ev_row(cc, mine["id"])
    assert rep["flagged"] == 1 and row["state"] == "confirmed" and row["sync_flag"] == "deleted_external"
    assert sync(cc, cid)["pushed"] == 0 and fake.events("ext-1") == {}  # waiting for the human, not re-created behind his back
    ok(cc.post(f"{API}/calendar/events/{mine['id']}/sync-resolve", json={"revision": row["revision"], "resolution": "keep"}))
    assert sync(cc, cid)["pushed"] == 1 and len(fake.events("ext-1")) == 1  # keep = publish it again


def test_two_way_cancelling_an_imported_entry_removes_it_at_the_provider(cc, fake):
    cal, cid = setup_import(cc, fake, direction="two_way", scope="read_write")
    uid = fake.user_create("ext-1", "חיצוני", D(3, 10), D(3, 11))
    sync(cc, cid)
    (e,) = ext_events(cc)
    cur = ok(cc.get(f"{API}/calendar/events/{e['id']}"))["event"]
    ok(cc.post(f"{API}/calendar/events/{e['id']}/cancel", json={"revision": cur["revision"], "scope": "series"}))
    assert sync(cc, cid)["deleted_out"] == 1 and uid not in fake.events("ext-1")


def test_imported_entries_are_not_exported_back(cc, fake):
    cal, cid = setup_import(cc, fake, direction="two_way", scope="read_write")
    fake.user_create("ext-1", "חיצוני", D(3, 10), D(3, 11))
    rep = sync(cc, cid)
    assert rep["created"] == 1 and rep["pushed"] == 0 and [c for c in fake.calls if c[0] == "push"] == []


# ---------------------------------------------------------------- tokens, resync, errors, back-off, lease

def test_sync_token_is_sealed_and_incremental(cc, fake):
    cal, cid = setup_import(cc, fake)
    fake.user_create("ext-1", "א", D(3, 10), D(3, 11))
    sync(cc, cid)
    with db(cc).connection() as x:
        sealed = x.execute("SELECT sync_token_sealed FROM cal_sync_bindings").fetchone()[0]
    assert sealed.startswith("v1:")
    pulls = [c[1] for c in fake.calls if c[0] == "pull"]
    sync(cc, cid)
    assert [c[1] for c in fake.calls if c[0] == "pull"][-1] == "t1" and pulls == [None]


def test_gone_token_triggers_a_full_resync_that_notices_deletions(cc, fake):
    cal, cid = setup_import(cc, fake)
    keep = fake.user_create("ext-1", "נשאר", D(3, 10), D(3, 11))
    gone = fake.user_create("ext-1", "יימחק", D(4, 10), D(4, 11))
    sync(cc, cid)
    assert len(ext_events(cc)) == 2
    fake.invalidate_tokens("ext-1")
    fake.user_delete("ext-1", gone)  # its tombstone is gone with the token: only a full listing reveals it
    fake._tombs["ext-1"].clear()
    fake.user_create("ext-1", "חדש", D(5, 10), D(5, 11))
    rep = sync(cc, cid)
    assert rep["resync"] == 1 and rep["created"] == 1 and rep["cancelled"] == 1
    states = {r["title"]: r["state"] for r in ext_events(cc)}
    assert states == {"נשאר": "confirmed", "יימחק": "cancelled", "חדש": "confirmed"} and keep in fake.events("ext-1")


def test_rate_limit_backs_off_exponentially_and_recovers(cc, fake):
    cal, cid = setup_import(cc, fake)
    now = cc.clock["now"]
    fake.fail_next("pull", RateLimited(code="rate_limited"), times=3)
    r = sync(cc, cid)
    assert r["state"] == "error" and r["code"] == "rate_limited" and r["failures"] == 1 and r["retry_in_min"] == 10
    row = conn_row(cc, cid)
    assert row["state"] == "error" and row["error_code"] == "rate_limited" and row["next_sync_at"] == model.iso(now + dt.timedelta(minutes=10))
    assert sync(cc, cid)["retry_in_min"] == 20
    assert sync(cc, cid)["retry_in_min"] == 40
    fake.fail_next("pull", RateLimited(code="rate_limited", retry_after_s=7200))
    assert sync(cc, cid)["retry_in_min"] == 60  # capped at an hour
    assert sync(cc, cid)["state"] == "ok"
    row = conn_row(cc, cid)
    assert row["state"] == "ok" and row["error_code"] is None and row["error_text"] is None


def test_a_failed_pull_changes_nothing_and_does_not_move_the_token(cc, fake):
    cal, cid = setup_import(cc, fake)
    fake.user_create("ext-1", "א", D(3, 10), D(3, 11))
    sync(cc, cid)
    fake.user_create("ext-1", "ב", D(4, 10), D(4, 11))
    fake.fail_next("pull", SyncError("boom", code="provider_error"))
    assert sync(cc, cid)["state"] == "error"
    assert len(ext_events(cc)) == 1
    assert sync(cc, cid)["created"] == 1


def test_needs_reauth_stops_retrying_until_the_owner_acts(cc, fake):
    cal, cid = setup_import(cc, fake)
    fake.fail_next("pull", NeedsReauth())
    assert sync(cc, cid)["state"] == "needs_reauth"
    row = conn_row(cc, cid)
    assert row["state"] == "needs_reauth" and row["next_sync_at"] is None
    assert sync(cc, cid) == {"skipped": "needs_reauth"}
    assert cc.post(f"{API}/calendar/connections/{cid}/resume").status_code == 409  # a new authorisation is the only way out (OAuth phase)
    fake.health_state = type(fake.health_state)("needs_reauth", "token_revoked")
    with db(cc).connection() as x:
        x.execute("UPDATE cal_connections SET state = 'ok'")
    assert sync(cc, cid)["code"] == "token_revoked"


def test_one_sync_per_connection_at_a_time(cc, fake):
    cal, cid = setup_import(cc, fake)
    with db(cc).connection() as x:
        assert engine.acquire_lease(x, cid, NOW) is True
        assert engine.acquire_lease(x, cid, NOW + dt.timedelta(minutes=1)) is False
        assert engine.sync_connection(x, cc.settings_obj.data_dir, model.read_settings(x), cid, NOW + dt.timedelta(minutes=1)) == {"skipped": "busy"}
        assert engine.acquire_lease(x, cid, NOW + dt.timedelta(minutes=engine.LEASE_MIN + 1)) is True  # an expired lease is taken over
        engine.release_lease(x, cid)
        assert engine.acquire_lease(x, cid, NOW) is True


def test_manual_sync_is_rate_limited_to_the_setting(cc, fake):
    cal, cid = setup_import(cc, fake)
    enable(cc, sync_manual_min_interval_s=60)
    assert cc.post(f"{API}/calendar/connections/{cid}/sync").status_code == 200
    r = cc.post(f"{API}/calendar/connections/{cid}/sync")
    assert r.status_code == 429 and r.json()["code"] == "rate_limited"
    cc.clock["now"] = NOW + dt.timedelta(seconds=61)
    assert cc.post(f"{API}/calendar/connections/{cid}/sync").status_code == 200


# ---------------------------------------------------------------- scheduler

def test_scheduler_runs_only_what_is_due_and_respects_the_switches(cc, fake):
    cal, cid = setup_import(cc, fake)
    fake.user_create("ext-1", "א", D(3, 10), D(3, 11))
    d = db(cc)
    assert list(jobs.sync_run(d, cc.settings_obj.data_dir, NOW)) == [cid]  # never synced: due now
    assert len(ext_events(cc)) == 1
    nxt = model.parse_utc(conn_row(cc, cid)["next_sync_at"], "n")
    assert NOW + dt.timedelta(minutes=5) <= nxt <= NOW + dt.timedelta(minutes=6)  # poll_min plus a deterministic jitter of at most 20 percent
    assert jobs.sync_run(d, cc.settings_obj.data_dir, NOW + dt.timedelta(minutes=1)) == {}
    assert list(jobs.sync_run(d, cc.settings_obj.data_dir, nxt + dt.timedelta(seconds=1))) == [cid]
    ok(cc.post(f"{API}/calendar/connections/{cid}/pause"))
    assert jobs.sync_run(d, cc.settings_obj.data_dir, NOW + dt.timedelta(days=1)) == {}
    ok(cc.post(f"{API}/calendar/connections/{cid}/resume"))
    enable(cc, sync_enabled=False)
    assert jobs.sync_run(d, cc.settings_obj.data_dir, NOW + dt.timedelta(days=2)) == {}
    ok(cc.put(f"{API}/calendar/settings", json={"enabled": False}))
    assert jobs.sync_run(d, cc.settings_obj.data_dir, NOW + dt.timedelta(days=3)) == {}


def test_scheduler_skips_connections_without_a_binding_and_uses_the_poll_setting(cc, fake):
    enable(cc, sync_poll_min=30)
    connect(cc)
    assert jobs.sync_run(db(cc), cc.settings_obj.data_dir, NOW) == {}
    cal = room(cc)
    cid = connect(cc)
    ok(bind_cal(cc, cal, cid, direction="export"))
    out = jobs.sync_run(db(cc), cc.settings_obj.data_dir, NOW)
    assert list(out) == [cid]
    assert model.parse_utc(conn_row(cc, cid)["next_sync_at"], "n") >= NOW + dt.timedelta(minutes=30)


# ---------------------------------------------------------------- removing a connection

def test_removing_a_connection_revokes_unbinds_and_keeps_arx_entries(cc, fake):
    cal, cid = setup_import(cc, fake, direction="two_way", scope="read_write")
    mine = ok(book(cc, cal, T(3, 10), T(3, 11)), 201)["event"]
    fake.user_create("ext-1", "חיצוני", D(4, 10), D(4, 11))
    sync(cc, cid)
    assert cc.delete(f"{API}/calendar/connections/{cid}").status_code == 204
    assert fake.revoked == 1
    with db(cc).connection() as x:
        assert x.execute("SELECT COUNT(*) FROM cal_connections").fetchone()[0] == 0
        assert x.execute("SELECT COUNT(*) FROM cal_sync_bindings").fetchone()[0] == 0
        assert x.execute("SELECT COUNT(*) FROM cal_sync_map").fetchone()[0] == 0
        assert x.execute("SELECT COUNT(*) FROM settings WHERE key LIKE 'calendar.sync.lease.%'").fetchone()[0] == 0
        assert x.execute("SELECT 1 FROM audit_log WHERE action = 'calendar.connection.remove'").fetchone()
    assert ev_row(cc, mine["id"])["state"] == "confirmed" and len(ext_events(cc)) == 1  # Arx keeps every entry
    assert ok(cc.get(f"{API}/calendar/calendars/{cal['id']}"))["calendar"]["sync"] is None


def test_removal_survives_a_provider_that_refuses_to_revoke(cc, fake):
    cal, cid = setup_import(cc, fake)
    def boom(_c):
        raise SyncError("down")
    fake.revoke = boom  # type: ignore[method-assign]
    assert cc.delete(f"{API}/calendar/connections/{cid}").status_code == 204


# ---------------------------------------------------------------- the interface itself

def test_fake_adapter_contract_tokens_etags_and_failures():
    f = FakeAdapter()
    f.add_calendar("c")
    from smplwise.services.calendar_sync.adapter import Binding, ConnectionInfo, OutEvent

    ci, b = ConnectionInfo("con", "google", "l", "read_write"), Binding("bnd", "cal", "c", "two_way", "busy", True)
    p = f.push(ci, b, OutEvent("evt_1", "t", D(3, 10), D(3, 11), False, "UTC"), None, None)
    again = f.push(ci, b, OutEvent("evt_1", "t2", D(3, 10), D(3, 11), False, "UTC"), p.ext_uid, p.etag)
    assert again.ext_uid == p.ext_uid and again.etag != p.etag
    full = f.pull(ci, b, None)
    assert [c.ext_uid for c in full.changes] == [p.ext_uid] and full.next_token
    assert f.pull(ci, b, full.next_token).changes == []
    f.user_delete("c", p.ext_uid)
    assert [type(c).__name__ for c in f.pull(ci, b, full.next_token).changes] == ["ExtDeletion"]
    f.invalidate_tokens("c")
    assert f.pull(ci, b, full.next_token).full_resync_required is True
    f.fail_next("pull", RateLimited())
    with pytest.raises(RateLimited):
        f.pull(ci, b, None)
    assert f.pull(ci, b, None).changes == []
    ro = ConnectionInfo("con", "google", "l", "read")
    with pytest.raises(SyncError):
        f.push(ro, b, OutEvent("evt_2", "t", D(3, 10), D(3, 11), False, "UTC"), None, None)


def test_registry_is_empty_in_production_and_hands_out_the_registered_adapter():
    registry.clear()
    assert registry.available() == [] and registry.get("google") is None
    f = FakeAdapter()
    registry.register("google", lambda: f)
    assert registry.get("google") is f and registry.available() == ["google"]
    registry.unregister("google")
    assert registry.get("google") is None


def test_marker_without_a_map_row_relinks_instead_of_duplicating(cc, fake):
    cal, cid = setup_import(cc, fake, direction="two_way", scope="read_write")
    mine = ok(book(cc, cal, T(3, 10), T(3, 11)), 201)["event"]
    sync(cc, cid)
    assert len(fake.events("ext-1")) == 1
    with db(cc).connection() as x:  # the map is lost (binding recreated, restore from a backup ...)
        x.execute("DELETE FROM cal_sync_map")
        x.execute("UPDATE cal_sync_bindings SET sync_token_sealed = NULL")
    rep = sync(cc, cid)
    assert rep["created"] == 0 and ext_events(cc) == []  # no duplicate "external" copy of our own booking
    assert ev_row(cc, mine["id"])["state"] == "confirmed" and len(fake.events("ext-1")) == 1
