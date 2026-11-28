"""FIX-CALENDAR-2570 - the calendar findings of the second deep review of 2.57 (docs/review/DEEP-REVIEW-2570-COMMS-UTILITIES.md):

* CU2-01 a full re-sync (lost sync token) cancelled every mapped entry outside the provider's listing window (past bookings; Graph: far future);
* CU2-02 a recurring series on a two-way binding: the returning instances replaced the series' map row (edits / deletes hit one instance);
* CU2-03 any `calendar.connect` holder could bind his calendar to ANOTHER person's connection (read / write that person's account);
* CU2-12 a sync in flight overwrote a pause; the lease was not renewed during a long run;
* CU2-13 a rotated refresh token could be written back after a disconnect / a client change;
* CU2-30 the settings PUT replaced the whole document (one administrator's save reverted another's).

No network: the provider data below are fixtures in the shapes the providers document (Google Calendar API v3 `events.list` with
`singleEvents=true`: instances carry `recurringEventId`; Microsoft Graph `calendarView/delta`: occurrences carry `seriesMasterId`)."""
from __future__ import annotations

import datetime as dt

import httpx
import pytest

from conftest import as_user, bind
from smplwise.services import calendar_sync_store as store
from smplwise.services.calendar import model
from smplwise.services.calendar_sync import credentials, engine, google, ics, microsoft, registry
from smplwise.services.calendar_sync.adapter import Binding, ConnectionInfo, ExtCalendar, ExtDeletion, Health, PullResult, PushResult
from smplwise.services.calendar_sync.fake import FakeAdapter
from test_calendar_sync_2300 import (API, NOW, D, T, _app, bind_cal, book, cc, conn_row, connect, db, enable, ev_row, ext_events, fake, ok,  # noqa: F401 - fixtures
                                     room, sync)

UTC = dt.timezone.utc


def cancel_audits(c) -> int:
    with db(c).connection() as x:
        return x.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'calendar.sync.cancel'").fetchone()[0]


def two_way(c):
    enable(c)
    cal = room(c)
    cid = connect(c)
    ok(bind_cal(c, cal, cid, direction="two_way", detail="titles", dedicated=True))
    return cal, cid


def map_rows(c):
    with db(c).connection() as x:
        return [dict(r) for r in x.execute("SELECT * FROM cal_sync_map ORDER BY ext_uid").fetchall()]


# ---------------------------------------------------------------- CU2-01: a full re-sync reads only its window

def test_full_resync_never_cancels_entries_older_than_the_listing_window(cc, fake):  # noqa: F811
    cal, cid = two_way(cc)
    ours = ok(book(cc, cal, T(3, 10), T(3, 11), title="הזמנה ישנה"), 201)["event"]
    fake.user_create("ext-1", "מיובא ישן", D(4, 10), D(4, 11))
    inside = fake.user_create("ext-1", "מיובא בחלון", D(15, 10, month=12), D(15, 11, month=12))
    rep = sync(cc, cid)
    assert rep["pushed"] == 1 and rep["created"] == 2
    cc.clock["now"] = later = D(20, 9, month=12)  # about seven weeks on: 3-4.11 are more than 30 days back
    fake.user_delete("ext-1", inside)  # deleted at the provider while the token is lost: only the full listing can tell
    fake.invalidate_tokens("ext-1")
    fake.window = (later - dt.timedelta(days=30), None)  # Google: timeMin = now - 30 days, no upper bound
    rep = sync(cc, cid)
    assert rep["resync"] == 1 and rep["cancelled"] == 1, rep  # only the entry inside the listed window that is missing
    assert ev_row(cc, ours["id"])["state"] == "confirmed"
    states = {e["title"]: e["state"] for e in ext_events(cc)}
    assert states == {"מיובא ישן": "confirmed", "מיובא בחלון": "cancelled"}
    assert cancel_audits(cc) == 1
    assert len(map_rows(cc)) == 2  # the links outside the window stay (a later incremental delete still reaches them)


def test_full_resync_never_cancels_entries_beyond_the_window_end(cc, fake):  # noqa: F811
    cal, cid = two_way(cc)
    far = ok(book(cc, cal, T(3, 10), T(3, 11), title="רחוק"), 201)["event"]
    series = ok(book(cc, cal, T(10, 16), T(10, 17), title="סדרה", rrule="FREQ=WEEKLY;BYDAY=TU;COUNT=3"), 201)["event"]
    assert sync(cc, cid)["pushed"] == 2
    fake.invalidate_tokens("ext-1")
    fake.window = (NOW - dt.timedelta(days=30), NOW + dt.timedelta(days=20))  # Graph: [now - 30, now + 400] - here the end falls before 3.11
    fake.user_delete("ext-1", next(u for u, e in fake.events("ext-1").items() if e.arx_id == far["id"]))
    fake.user_delete("ext-1", next(u for u, e in fake.events("ext-1").items() if e.arx_id == series["id"]))
    rep = sync(cc, cid)
    assert rep["cancelled"] == 0, rep  # both lie beyond the listed window: not listed is not "deleted"
    assert ev_row(cc, far["id"])["state"] == "confirmed" and ev_row(cc, series["id"])["state"] == "confirmed"
    assert cancel_audits(cc) == 0


def test_a_listing_without_a_window_still_cancels_what_it_misses(cc, fake):  # noqa: F811
    cal, cid = two_way(cc)
    ours = ok(book(cc, cal, T(3, 10), T(3, 11)), 201)["event"]
    sync(cc, cid)
    (uid,) = fake.events("ext-1")
    fake.user_delete("ext-1", uid)
    fake.invalidate_tokens("ext-1")
    assert fake.window is None  # the reference fake lists everything: the old contract stays
    assert sync(cc, cid)["cancelled"] == 1
    assert ev_row(cc, ours["id"])["state"] == "cancelled"


def _response(body, url="https://x.test/"):
    return httpx.Response(200, json=body, request=httpx.Request("GET", url))


def test_the_adapters_report_the_window_of_a_full_listing(monkeypatch):
    now = dt.datetime(2026, 12, 20, 9, 0, tzinfo=UTC)
    info, b = ConnectionInfo("con_1", "google", "x", "read_write"), Binding("bnd_1", "cal_1", "primary", "two_way", "titles", True)
    seen = []
    monkeypatch.setattr(google, "CLOCK", lambda: now)
    monkeypatch.setattr(google.rest, "call", lambda *a, **k: (seen.append(k.get("params")), _response({"items": [], "nextSyncToken": "s1"}))[1])
    res = google.GoogleAdapter().pull(info, b, None)
    assert res.window == (now - dt.timedelta(days=30), None) and seen[-1]["timeMin"] == "2026-11-20T09:00:00Z"
    assert google.GoogleAdapter().pull(info, b, "s1").window is None  # an incremental pull has no window (it reports deletions itself)
    monkeypatch.setattr(microsoft, "CLOCK", lambda: now)
    monkeypatch.setattr(microsoft.rest, "call", lambda *a, **k: _response({"value": [], "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta?x=1"}))
    res = microsoft.MicrosoftAdapter().pull(ConnectionInfo("con_2", "microsoft", "x", "read_write"), b, None)
    assert res.window == (now - dt.timedelta(days=30), now + dt.timedelta(days=400))
    monkeypatch.setattr(ics, "CLOCK", lambda: now)
    monkeypatch.setattr(ics, "FETCH", lambda url: b"BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n")
    monkeypatch.setattr(ics.IcsInAdapter, "_url", lambda self, cid: "https://feed.test/x.ics")
    res = ics.IcsInAdapter().pull(ConnectionInfo("con_3", "ics_in", "x", "read"), b, None)
    assert res.window == (now - dt.timedelta(days=30), now + dt.timedelta(days=400))


# ---------------------------------------------------------------- CU2-02: a series keeps its master identity

def g_instance(master, day, arx, *, status="confirmed"):
    """One instance of a Google recurring event as events.list(singleEvents=true) returns it."""
    start = f"2026-11-{day:02d}T18:00:00+02:00"
    item = {"kind": "calendar#event", "id": f"{master}_202611{day:02d}T160000Z", "etag": f'"i{day}"', "status": status, "recurringEventId": master,
            "originalStartTime": {"dateTime": start, "timeZone": "Asia/Jerusalem"}}
    if status != "cancelled":
        item.update(summary="שיעור", start={"dateTime": start, "timeZone": "Asia/Jerusalem"},
                    end={"dateTime": f"2026-11-{day:02d}T19:00:00+02:00", "timeZone": "Asia/Jerusalem"}, extendedProperties={"private": {"arx_id": arx}})
    return item


def ms_occurrence(master, day):
    """One occurrence of a Graph series as calendarView/delta returns it (delta carries no extended property)."""
    return {"@odata.etag": f'W/"o{day}"', "id": f"AAMkOcc{day}", "type": "occurrence", "seriesMasterId": master, "subject": "שיעור", "isAllDay": False,
            "isCancelled": False, "start": {"dateTime": f"2026-11-{day:02d}T16:00:00.0000000", "timeZone": "UTC"},
            "end": {"dateTime": f"2026-11-{day:02d}T17:00:00.0000000", "timeZone": "UTC"}}


class Scripted:
    """A provider that returns the fixture items queued in `items` on the next pull, through the REAL to_ext of the adapter."""

    def __init__(self, provider: str, master: str) -> None:
        self.provider, self.master = provider, master
        self.items: list[dict] = []
        self.pushes: list[tuple[str, str | None, str | None]] = []
        self.deletes: list[str] = []
        self.n = 0

    def health(self, connection):
        return Health("ok")

    def list_calendars(self, connection):
        return [ExtCalendar("ext-1", "Ext one", True)]

    def pull(self, connection, binding, since_token):
        items, self.items = self.items, []
        conv = (lambda i: google.to_ext(i, "Asia/Jerusalem")) if self.provider == "google" else microsoft.to_ext
        self.n += 1
        return PullResult([x for x in map(conv, items) if x is not None], f"t{self.n}")

    def push(self, connection, binding, event, ext_uid, etag):
        self.pushes.append((event.arx_id, ext_uid, event.rrule))
        self.n += 1
        return PushResult(ext_uid or self.master, f"m{self.n}")

    def delete(self, connection, binding, ext_uid, etag):
        self.deletes.append(ext_uid)

    def revoke(self, connection):
        return None


@pytest.fixture()
def scripted():
    holder = {}

    def make(provider="google", master="srs1"):
        s = Scripted(provider, master)
        registry.clear()
        registry.register("google", lambda: s)
        holder["s"] = s
        return s
    yield make
    registry.clear()


def series_on_two_way(c, sc):
    cal, cid = two_way(c)
    ev = ok(book(c, cal, T(3, 16), T(3, 17), title="שיעור", rrule="FREQ=WEEKLY;BYDAY=TU;COUNT=4"), 201)["event"]
    rep = sync(c, cid)
    assert rep["pushed"] == 1 and sc.pushes == [(ev["id"], None, "FREQ=WEEKLY;BYDAY=TU;COUNT=4")]
    return cal, cid, ev


def test_google_instances_of_our_series_never_replace_the_series_link(cc, scripted):  # noqa: F811
    sc = scripted("google", "srs1")
    cal, cid, ev = series_on_two_way(cc, sc)
    sc.items = [g_instance("srs1", d, ev["id"]) for d in (3, 10, 17, 24)]
    rep = sync(cc, cid)
    assert rep["created"] == 0 and rep["echo"] == 4, rep
    assert [(m["event_id"], m["ext_uid"]) for m in map_rows(cc)] == [(ev["id"], "srs1")]  # 2.56: the last instance's id replaced it
    cur = ok(cc.get(f"{API}/calendar/events/{ev['id']}"))["event"]
    ok(cc.patch(f"{API}/calendar/events/{ev['id']}", json={"revision": cur["revision"], "scope": "series", "title": "שיעור (שונה)"}))
    sync(cc, cid)
    assert sc.pushes[-1][:2] == (ev["id"], "srs1")  # the series edit goes to the series, never to one instance
    cur = ok(cc.get(f"{API}/calendar/events/{ev['id']}"))["event"]
    ok(cc.post(f"{API}/calendar/events/{ev['id']}/cancel", json={"revision": cur["revision"], "scope": "series"}))
    sync(cc, cid)
    assert sc.deletes == ["srs1"]  # the whole series is removed at the provider


def test_one_occurrence_removed_outside_never_cancels_the_series(cc, scripted):  # noqa: F811
    sc = scripted("google", "srs1")
    cal, cid, ev = series_on_two_way(cc, sc)
    sc.items = [g_instance("srs1", d, ev["id"]) for d in (3, 10, 17, 24)]
    sync(cc, cid)
    sc.items = [g_instance("srs1", 24, ev["id"], status="cancelled")]  # one occurrence deleted in Google Calendar
    rep = sync(cc, cid)
    assert rep["cancelled"] == 0, rep
    assert ev_row(cc, ev["id"])["state"] == "confirmed"
    assert [m["ext_uid"] for m in map_rows(cc)] == ["srs1"]
    sc.items = [{"kind": "calendar#event", "id": "srs1", "etag": '"x"', "status": "cancelled"}]  # the whole series deleted there
    assert sync(cc, cid)["cancelled"] == 1
    assert ev_row(cc, ev["id"])["state"] == "cancelled"


def test_a_series_link_broken_by_2_56_is_repaired_on_the_next_pull(cc, scripted):  # noqa: F811
    sc = scripted("google", "srs1")
    cal, cid, ev = series_on_two_way(cc, sc)
    with db(cc).connection() as x:  # the state 2.56 left behind: the series row holds one instance's id
        x.execute("UPDATE cal_sync_map SET ext_uid = 'srs1_20261124T160000Z'")
    sc.items = [g_instance("srs1", 3, ev["id"])]
    sync(cc, cid)
    assert [(m["event_id"], m["ext_uid"]) for m in map_rows(cc)] == [(ev["id"], "srs1")]


def test_graph_occurrences_of_our_series_are_not_imported_as_new_entries(cc, scripted):  # noqa: F811
    sc = scripted("google", "AAMkMaster")  # registered under the binding's provider; the fixtures are Graph-shaped
    sc.provider = "microsoft"
    cal, cid, ev = series_on_two_way(cc, sc)
    sc.items = [ms_occurrence("AAMkMaster", d) for d in (3, 10, 17, 24)]
    rep = sync(cc, cid)
    assert rep["created"] == 0, rep  # 2.56: four "external" copies of our own series
    assert ext_events(cc) == []
    assert [m["ext_uid"] for m in map_rows(cc)] == ["AAMkMaster"]


def test_a_second_copy_at_the_provider_never_replaces_the_known_link(cc, scripted):  # noqa: F811
    sc = scripted("google", "one1")
    cal, cid = two_way(cc)
    ev = ok(book(cc, cal, T(3, 10), T(3, 11)), 201)["event"]
    sync(cc, cid)
    sc.items = [{"id": "copy2", "etag": '"c"', "status": "confirmed", "summary": "ישיבה", "start": {"dateTime": "2026-11-03T10:00:00Z"},
                 "end": {"dateTime": "2026-11-03T11:00:00Z"}, "extendedProperties": {"private": {"arx_id": ev["id"]}}}]
    sync(cc, cid)
    assert [m["ext_uid"] for m in map_rows(cc)] == ["one1"]


def test_the_adapters_read_the_series_id_from_the_documented_fields():
    i = google.to_ext(g_instance("srs1", 3, "evt_1"), "Asia/Jerusalem")
    assert i.series_uid == "srs1" and i.ext_uid == "srs1_20261103T160000Z" and i.arx_id == "evt_1"
    d = google.to_ext(g_instance("srs1", 3, "evt_1", status="cancelled"), "Asia/Jerusalem")
    assert isinstance(d, ExtDeletion) and d.series_uid == "srs1"
    single = google.to_ext({"id": "a", "etag": "e", "summary": "s", "start": {"dateTime": "2026-11-03T10:00:00Z"}, "end": {"dateTime": "2026-11-03T11:00:00Z"}}, "UTC")
    assert single.series_uid is None
    o = microsoft.to_ext(ms_occurrence("AAMkMaster", 3))
    assert o.series_uid == "AAMkMaster" and o.ext_uid == "AAMkOcc3"
    assert microsoft.to_ext({**ms_occurrence("AAMkMaster", 3), "type": "singleInstance", "seriesMasterId": None}).series_uid is None


# ---------------------------------------------------------------- CU2-03: a binding uses only the caller's own connection

def test_a_connect_holder_cannot_use_another_persons_connection(cc, fake):  # noqa: F811
    enable(cc)
    cal = room(cc)
    admins = connect(cc)
    bind(cc, cc.settings_obj, "cora", "calendar_connect", "installation", "*")
    bind(cc, cc.settings_obj, "cora", "operator", "installation", "*")
    cora = as_user("cora")
    cur = ok(cc.get(f"{API}/calendar/calendars/{cal['id']}"))["calendar"]
    ok(cc.put(f"{API}/calendar/calendars/{cal['id']}/members", json={"revision": cur["revision"], "members": [{"subject_kind": "user", "subject_id": "dev-cora", "cal_role": "edit"}]}))
    for direction in ("import", "export"):
        r = bind_cal(cc, cal, admins, who=cora, direction=direction, detail="details")
        assert r.status_code == 403, r.text
    r = cc.get(f"{API}/calendar/connections/{admins}/calendars", headers=cora)
    assert r.status_code == 403  # the owner's calendars are not even listed for him
    with db(cc).connection() as x:
        rows = x.execute("SELECT resource_id, reason FROM audit_log WHERE action = 'calendar.connect' AND decision = 'denied'").fetchall()
        assert [tuple(r) for r in rows] == [(admins, "owner")] * 3
        assert x.execute("SELECT COUNT(*) FROM cal_sync_bindings").fetchone()[0] == 0
    mine = connect(cc, who=cora)
    assert ok(cc.get(f"{API}/calendar/connections/{mine}/calendars", headers=cora))["calendars"]
    assert ok(bind_cal(cc, cal, mine, who=cora))["binding"]["connection_id"] == mine
    assert ok(bind_cal(cc, cal, mine))["binding"]["connection_id"] == mine  # a system administrator may use any connection


# ---------------------------------------------------------------- CU2-12: the run never overwrites the owner's change; the lease is held

class Hooked(FakeAdapter):
    def __init__(self) -> None:
        super().__init__("google")
        self.on_pull = None
        self.on_push = None

    def pull(self, connection, binding, since_token):
        res = super().pull(connection, binding, since_token)
        if self.on_pull:
            self.on_pull()
        return res

    def push(self, connection, binding, event, ext_uid, etag):
        if self.on_push:
            self.on_push()
        return super().push(connection, binding, event, ext_uid, etag)


@pytest.fixture()
def hooked():
    h = Hooked()
    h.add_calendar("ext-1", "Ext one")
    registry.clear()
    registry.register("google", lambda: h)
    yield h
    registry.clear()


def test_a_pause_while_the_sync_waits_on_the_provider_stays(cc, hooked):  # noqa: F811
    cal, cid = two_way(cc)
    hooked.user_create("ext-1", "א", D(3, 10), D(3, 11))

    def pause():
        with db(cc).connection() as x:
            store.set_connection_state(x, cid, "paused", None)  # what POST .../pause does
    hooked.on_pull = pause
    rep = engine.run_connection(db(cc), cc.settings_obj.data_dir, cid, NOW)
    assert rep["state"] == "paused", rep
    row = conn_row(cc, cid)
    assert row["state"] == "paused" and row["next_sync_at"] is None


def test_a_run_whose_lease_was_taken_over_applies_nothing(cc, hooked):  # noqa: F811
    cal, cid = two_way(cc)
    hooked.user_create("ext-1", "א", D(3, 10), D(3, 11))

    def takeover():
        with db(cc).connection() as x:
            x.execute("UPDATE settings SET value = ? WHERE key = ?", (model.iso(NOW + dt.timedelta(minutes=30)) + "|other", f"calendar.sync.lease.{cid}"))
    hooked.on_pull = takeover
    rep = engine.run_connection(db(cc), cc.settings_obj.data_dir, cid, NOW)
    assert rep.get("skipped") == "lease_lost" and rep["created"] == 0, rep
    assert ext_events(cc) == []
    with db(cc).connection() as x:  # the other run's lease is left alone
        assert x.execute("SELECT value FROM settings WHERE key = ?", (f"calendar.sync.lease.{cid}",)).fetchone()[0].endswith("|other")


def test_a_long_run_renews_its_lease_so_nobody_takes_it_over(cc, hooked, monkeypatch):  # noqa: F811
    cal, cid = two_way(cc)
    for d in (3, 4, 5, 6, 9, 10):
        ok(book(cc, cal, T(d, 10), T(d, 11)), 201)
    clock = {"t": 1000.0}
    monkeypatch.setattr(engine, "MONO", lambda: clock["t"])
    taken = []

    def slow_push():
        clock["t"] += 200  # each push waits 200 s on the provider: six pushes = 20 minutes, twice the lease
        if len(hooked.pushed) == 4:
            with db(cc).connection() as x:
                taken.append(engine.acquire_lease(x, cid, NOW + dt.timedelta(seconds=clock["t"] - 1000.0), "other"))
    hooked.on_push = slow_push
    rep = engine.run_connection(db(cc), cc.settings_obj.data_dir, cid, NOW)
    assert taken == [False] and rep["pushed"] == 6 and rep["state"] == "ok", (taken, rep)


# ---------------------------------------------------------------- CU2-13: a rotated token never outlives a disconnect / a client change

def test_a_rotated_refresh_token_is_stored_only_over_the_token_it_replaces(cc, fake):  # noqa: F811
    enable(cc)
    credentials.RUNTIME.configure(cc.app.state.db, cc.settings_obj.data_dir)
    cid = connect(cc)
    d = cc.settings_obj.data_dir
    with db(cc).connection() as x:
        credentials.set_secret(x, d, cid, "refresh_token", "r1")
    assert credentials.RUNTIME.store_refresh(cid, "r2", replaces="r1") is True
    assert credentials.RUNTIME.store_refresh(cid, "r3", replaces="r1") is False  # a newer authorisation meanwhile: kept
    with db(cc).connection() as x:
        assert credentials.secret(x, d, cid, "refresh_token") == "r2"
        credentials.clear_secret(x, cid, "refresh_token")  # a client change drops the authorisation
    assert credentials.RUNTIME.store_refresh(cid, "r4", replaces="r2") is False
    with db(cc).connection() as x:
        assert credentials.secret(x, d, cid, "refresh_token") is None
        credentials.set_secret(x, d, cid, "refresh_token", "r5")
    assert cc.delete(f"{API}/calendar/connections/{cid}").status_code == 204
    assert credentials.RUNTIME.store_refresh(cid, "r6", replaces="r5") is False  # the connection is gone: nothing is written back
    with db(cc).connection() as x:
        assert x.execute("SELECT COUNT(*) FROM settings WHERE key LIKE ?", (f"calendar.conn.{cid}.%",)).fetchone()[0] == 0


def test_removing_a_connection_purges_credentials_left_by_an_older_race(cc, fake):  # noqa: F811
    enable(cc)
    a, b = connect(cc), connect(cc)
    with db(cc).connection() as x:  # what 2.56 could leave: a sealed token for a connection that no longer exists
        x.execute("INSERT INTO settings(key, value) VALUES ('calendar.conn.con_gone.secret.refresh_token', 'v1:x')")
    assert cc.delete(f"{API}/calendar/connections/{a}").status_code == 204
    with db(cc).connection() as x:
        assert x.execute("SELECT 1 FROM settings WHERE key = 'calendar.conn.con_gone.secret.refresh_token'").fetchone() is None
        assert x.execute("SELECT 1 FROM cal_connections WHERE id = ?", (b,)).fetchone() is not None


# ---------------------------------------------------------------- CU2-30: a save sends only its keys

def test_calendar_settings_merge_keeps_the_keys_another_admin_saved(cc):  # noqa: F811
    enable(cc, sync_poll_min=15)
    s = ok(cc.put(f"{API}/calendar/settings?merge=true", json={"reopen_days": 9}))["settings"]
    assert s["reopen_days"] == 9 and s["sync_poll_min"] == 15 and s["enabled"] is True
    assert cc.put(f"{API}/calendar/settings?merge=true", json={"no_such_key": 1}).status_code == 422
    assert cc.put(f"{API}/calendar/settings?merge=true", json={"sync_poll_min": 1}).status_code == 422
    with db(cc).connection() as x:
        a = x.execute("SELECT details_json FROM audit_log WHERE action = 'calendar.settings.update' ORDER BY id DESC LIMIT 1").fetchone()[0]
        assert '"reopen_days"' in a and "sync_poll_min" not in a  # the audit names only what changed
    s = ok(cc.put(f"{API}/calendar/settings", json={"enabled": True}))["settings"]
    assert s["sync_poll_min"] == 5  # without merge the old whole-document rule stays (missing keys are defaults)


def test_attendee_settings_merge_keeps_the_keys_another_admin_saved(cc):  # noqa: F811
    enable(cc)
    ok(cc.put(f"{API}/calendar/attendee-settings", json={"cancel_notice_delay_s": 20}))
    s = ok(cc.put(f"{API}/calendar/attendee-settings?merge=true", json={"notify_guests": False}))["settings"]
    assert s["cancel_notice_delay_s"] == 20 and s["notify_guests"] is False
