"""CAL-ATTENDEES-2343 (owner 2026-11-02, answers 6C + 7B): named attendees of a calendar entry through the real API on a temporary database -
the migration, who may add / remove whom (organizer and managers; a resident only himself and, when the calendar allows it, guests), the
privacy rules (a viewer gets the count; contacts only for the organizer and managers; nothing personal in audit, notices or notifications),
the notices (invite, change, cancel after the undo window, removal), the guest channel selection (the installation's order, the first
configured channel with the guest's address; SMS and e-mail are `soon` until registered), the real WhatsApp path on the fake ha-whatsapp,
and the guest-contact retention. Fakes only: no Home Assistant, no phone, no network."""
from __future__ import annotations

import datetime as dt
import json
from dataclasses import dataclass, field

import pytest
from fastapi.testclient import TestClient

from conftest import as_user, bind
from smplwise.config import Settings
from smplwise.db import Database, now_iso
from smplwise.main import create_app
from smplwise.routers import calendar as cal_router
from smplwise.routers import calendar_attendees as ca
from smplwise.services.calendar import attendee_notices as notices
from smplwise.services.calendar import attendees as att

API = "/api/v1"
UTC = dt.timezone.utc
NOW = dt.datetime(2026, 10, 5, 9, 0, tzinfo=UTC)
PHONE = "050-555-0142"
PHONE_E164 = "+972505550142"
EMAIL = "guest.person@example.test"


def T(day: int, hh: int, mm: int = 0, month: int = 11) -> str:
    return f"2026-{month:02d}-{day:02d}T{hh:02d}:{mm:02d}:00Z"


@pytest.fixture(scope="module")
def _app(tmp_path_factory):
    st = Settings(data_dir=tmp_path_factory.mktemp("calatt2343") / "data", www_dir=None, in_addon=False, trusted_proxies=("172.30.32.2",), dev_user="joni",
                  bootstrap_admin_username="joni", nvr_host="nvr-placeholder.test", nvr_http_port=80, nvr_user=None, nvr_password=None, go2rtc_url=None,
                  log_level="warning", max_upload_bytes=5 * 1024 * 1024, max_pdf_pages=5, max_render_px=800, preview_px=300)
    c = TestClient(create_app(st))
    c.settings_obj = st
    c.get(f"{API}/me")
    return c


@dataclass
class FakeChannel:
    key: str
    address: str
    state: str = "live"
    up: bool = True
    sent: list[tuple[str, str]] = field(default_factory=list)

    def available(self, db):  # noqa: ARG002
        return self.up

    def send(self, db, notice_id, address, text, now):  # noqa: ARG002
        self.sent.append((address, text))
        return "sent", None


@pytest.fixture()
def cc(_app, monkeypatch):
    monkeypatch.setattr(cal_router, "_now", lambda: NOW)
    with Database(_app.settings_obj.db_path).connection() as c:
        for t in ("cal_attendee_notices", "cal_attendee_policy", "cal_attendees", "cal_occurrences", "cal_guest_details", "cal_approvals", "cal_event_rooms", "cal_events",
                  "cal_members", "cal_sync_map", "cal_sync_bindings", "cal_calendars", "notification_recipients", "notification_events", "notify_outbox"):
            c.execute(f"DELETE FROM {t}")
        c.execute("DELETE FROM notifications")
        c.execute("DELETE FROM bindings WHERE assigned_by = 'test'")
        c.execute("DELETE FROM settings WHERE key LIKE 'calendar.%'")
        c.execute("DELETE FROM ticket_contacts WHERE created_by = 'test'")
        c.execute("DELETE FROM audit_log WHERE action LIKE 'calendar.attendee%'")
    wa = FakeChannel("whatsapp", "phone")
    monkeypatch.setitem(notices.CHANNELS, "whatsapp", wa)
    monkeypatch.setitem(notices.CHANNELS, "sms", notices.SoonChannel("sms", "phone"))
    monkeypatch.setitem(notices.CHANNELS, "email", notices.SoonChannel("email", "email"))
    _app.wa = wa
    return _app


def ok(r, code=200):
    assert r.status_code == code, r.text
    return r.json()


def db(c):
    return Database(c.settings_obj.db_path)


def enable(c):
    ok(c.put(f"{API}/calendar/settings", json={"enabled": True}))


def user(c, name, role="operator"):
    bind(c, c.settings_obj, name, role, "installation", "*")
    return as_user(name)


def room(c, name="חדר א", **kw):
    return ok(c.post(f"{API}/calendar/calendars", json={"name": name, "type": "room", "color": "blue", "capacity": 20, "buffer_after_min": 0, **kw}), 201)["calendar"]


def members(c, cal, rows):
    cur = ok(c.get(f"{API}/calendar/calendars/{cal['id']}"))["calendar"]
    ok(c.put(f"{API}/calendar/calendars/{cal['id']}/members", json={"revision": cur["revision"], "members": rows}))


def policy(c, cal, **kw):
    return ok(c.put(f"{API}/calendar/calendars/{cal['id']}/attendee-policy", json=kw))["policy"]


def book(c, cal, start=None, end=None, who=None, **kw):
    body = {"calendar_id": cal["id"], "title": kw.pop("title", "ישיבת דיירים"), "start": start or T(3, 10), "end": end or T(3, 11), **kw}
    return c.post(f"{API}/calendar/events", json=body, headers=who or {})


def resident(c, cid="res-1", name="רות דיירת", user_id=None, phone="972505550199", email=None):
    now = now_iso()
    with db(c).connection() as conn:
        conn.execute("INSERT INTO ticket_contacts(id, kind, user_id, display_name, phone_e164, email, preferred_channel, lang, created_by, created_at, updated_at) "
                     "VALUES (?, 'person', ?, ?, ?, ?, 'whatsapp', 'he', 'test', ?, ?)", (cid, user_id, name, phone, email, now, now))
    return cid


def notices_of(c, eid=None):
    with db(c).connection(mode="read") as conn:
        sql = "SELECT n.*, a.kind AS akind, a.ref_id FROM cal_attendee_notices n JOIN cal_attendees a ON a.id = n.attendee_id"
        return [dict(r) for r in conn.execute(sql + (" WHERE n.event_id = ?" if eid else "") + " ORDER BY n.created_at, n.rowid", (eid,) if eid else ()).fetchall()]


def dispatch(c, at=NOW):
    return notices.dispatch(db(c), c.settings_obj.data_dir, at)


def guest(name="אורחת חיצונית", phone=PHONE, email="", role="required"):
    return {"kind": "guest", "name": name, "phone": phone, "email": email, "role": role}


def setup_team(c):
    """joni (admin, owner) owns the room; oren (operator, book member) organizes; bob (operator, book member) is another resident; vera views."""
    enable(c)
    a = room(c)
    oren, bob, dana, vera = user(c, "oren"), user(c, "bob"), user(c, "dana"), user(c, "vera", "viewer")
    members(c, a, [{"subject_kind": "user", "subject_id": "dev-oren", "cal_role": "book"}, {"subject_kind": "user", "subject_id": "dev-bob", "cal_role": "book"},
                   {"subject_kind": "user", "subject_id": "dev-dana", "cal_role": "book"}, {"subject_kind": "user", "subject_id": "dev-vera", "cal_role": "view"}])
    return a, {"oren": oren, "bob": bob, "dana": dana, "vera": vera}


# ---------------------------------------------------------------- migration

def test_migration_0190_tables_constraints_and_sequence(cc):
    from smplwise.db import MIGRATIONS_DIR

    nums = sorted(int(p.name[:4]) for p in MIGRATIONS_DIR.glob("*.sql"))
    assert nums == list(range(nums[0], nums[-1] + 1)) and 190 in nums  # contiguous, no gap, no duplicate
    assert (MIGRATIONS_DIR / "0190_calendar_attendees.sql").exists()
    with db(cc).connection() as c:
        names = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cal_attendee%'")}
        assert names == {"cal_attendees", "cal_attendee_policy", "cal_attendee_notices"}
        assert c.execute("SELECT 1 FROM schema_migrations WHERE version = 190").fetchone()
        import sqlite3

        with pytest.raises(sqlite3.IntegrityError):  # a guest never references a directory row; a user always does
            c.execute("INSERT INTO cal_attendees(id, event_id, kind, ref_id, added_by, added_at) VALUES ('x', 'e', 'guest', 'dev-joni', 't', 't')")
        with pytest.raises(sqlite3.IntegrityError):
            c.execute("INSERT INTO cal_attendees(id, event_id, kind, ref_id, added_by, added_at) VALUES ('y', 'e', 'user', NULL, 't', 't')")


# ---------------------------------------------------------------- create, validation, permissions

def test_create_with_attendees_queues_invites_and_skips_the_organizer(cc):
    a, u = setup_team(cc)
    out = ok(book(cc, a, who=u["oren"], attendees=[{"kind": "user", "ref_id": "dev-dana"}, {"kind": "user", "ref_id": "dev-oren"}, guest()]), 201)
    v = out["attendees"]
    assert v["count"] == 3 and v["list_visible"] is True and v["can"]["manage"] is True
    by = {x["name"]: x for x in v["attendees"]}
    assert by["אורחת חיצונית"]["contact"] == {"phone": PHONE_E164, "email": ""}  # the organizer sees the guest's contact
    you = [x for x in v["attendees"] if x["you"]]
    assert len(you) == 1 and you[0]["status"] == "accepted"  # the organizer listing himself is a yes
    kinds = sorted((n["akind"], n["ref_id"] or "", n["kind"]) for n in notices_of(cc))
    assert kinds == [("guest", "", "invite"), ("user", "dev-dana", "invite")]  # nobody invites himself


def test_validation_of_items(cc):
    a, u = setup_team(cc)
    bad = [
        [{"kind": "user", "ref_id": "dev-nobody"}],
        [{"kind": "robot", "ref_id": "x"}],
        [{"kind": "guest", "name": "בלי קשר"}],  # name + phone OR e-mail
        [guest(phone="12")],
        [guest(phone="", email="not-an-email")],
        [{"kind": "user", "ref_id": "dev-dana"}, {"kind": "user", "ref_id": "dev-dana"}],
        [{"kind": "user", "ref_id": "dev-dana", "role": "boss"}],
        [{"kind": "user", "ref_id": "dev-dana", "phone": "x"}],
    ]
    for items in bad:
        r = book(cc, a, who=u["oren"], attendees=items)
        assert r.status_code == 422, (items, r.text)
    with db(cc).connection(mode="read") as c:  # a refused create left no entry behind (an API error still commits)
        assert c.execute("SELECT COUNT(*) FROM cal_events").fetchone()[0] == 0
    r = ok(book(cc, a, who=u["oren"], attendees=[guest(phone="", email=EMAIL.upper())]), 201)
    assert r["attendees"]["attendees"][0]["contact"]["email"] == EMAIL


def test_resident_adds_only_himself_and_guests_when_the_calendar_allows(cc):
    a, u = setup_team(cc)
    ev = ok(book(cc, a, who=u["oren"]), 201)["event"]
    url = f"{API}/calendar/events/{ev['id']}/attendees"
    # bob is not the organizer: he may not invite dana, may not join (self_join off), may not bring guests
    assert cc.post(url, json={"attendees": [{"kind": "user", "ref_id": "dev-dana"}]}, headers=u["bob"]).status_code == 403
    assert cc.post(url, json={"attendees": [{"kind": "user", "ref_id": "dev-bob"}]}, headers=u["bob"]).status_code == 403
    assert cc.post(url, json={"attendees": [guest()]}, headers=u["bob"]).status_code == 403
    with db(cc).connection(mode="read") as c:
        assert c.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'calendar.attendees' AND decision = 'denied'").fetchone()[0] == 3
    # the policy is the calendar manager's (bob cannot change it)
    assert cc.put(f"{API}/calendar/calendars/{a['id']}/attendee-policy", json={"self_join": True}, headers=u["bob"]).status_code == 403
    policy(cc, a, self_join=True)
    v = ok(cc.post(url, json={"attendees": [{"kind": "user", "ref_id": "@me"}]}, headers=u["bob"]), 201)  # the drawer's "join"
    assert v["me"]["status"] == "accepted" and v["can"]["manage"] is False
    assert cc.post(url, json={"attendees": [guest()]}, headers=u["bob"]).status_code == 403  # guests_mode `organizer`
    policy(cc, a, guests_mode="anyone")
    v = ok(cc.post(url, json={"attendees": [guest("האורח של בוב")]}, headers=u["bob"]), 201)
    mine = [x for x in v["attendees"] if x.get("added_by_you")]
    assert [x["name"] for x in mine] == ["האורח של בוב"] and "contact" not in mine[0]  # even his own guest's phone is the organizer's only
    # the organizer adds dana; bob may remove his own guest and himself, never dana
    v = ok(cc.post(url, json={"attendees": [{"kind": "user", "ref_id": "dev-dana"}]}, headers=u["oren"]), 201)
    full = ok(cc.get(url, headers=u["oren"]))["attendees"]
    dana_id = next(x["id"] for x in full if x["ref_id"] == "dev-dana")
    guest_id = next(x["id"] for x in full if x["name"] == "האורח של בוב")
    assert cc.delete(f"{url}/{dana_id}", headers=u["bob"]).status_code == 403
    assert cc.patch(f"{url}/{dana_id}", json={"role": "optional"}, headers=u["bob"]).status_code == 403
    ok(cc.delete(f"{url}/{guest_id}", headers=u["bob"]))
    assert ok(cc.patch(f"{url}/{dana_id}", json={"role": "optional"}, headers=u["oren"]))["count"] == 2
    policy(cc, a, guests_mode="off")
    r = cc.post(url, json={"attendees": [guest()]}, headers=u["oren"])
    assert r.status_code == 422 and r.json()["code"] == "guests_not_allowed"


def test_max_attendees_and_closed_entries(cc):
    a, u = setup_team(cc)
    policy(cc, a, max_attendees=2)
    r = book(cc, a, who=u["oren"], attendees=[{"kind": "user", "ref_id": "dev-dana"}, {"kind": "user", "ref_id": "dev-bob"}, guest()])
    assert r.status_code == 422 and r.json()["code"] == "too_many_attendees"
    ev = ok(book(cc, a, who=u["oren"], attendees=[{"kind": "user", "ref_id": "dev-dana"}, {"kind": "user", "ref_id": "dev-bob"}]), 201)["event"]
    url = f"{API}/calendar/events/{ev['id']}/attendees"
    assert cc.post(url, json={"attendees": [guest()]}, headers=u["oren"]).json()["code"] == "too_many_attendees"
    ok(cc.post(f"{API}/calendar/events/{ev['id']}/cancel", json={"revision": ev["revision"]}, headers=u["oren"]))
    assert cc.post(url, json={"attendees": [guest()]}, headers=u["oren"]).status_code == 409  # a cancelled entry is closed


def test_patch_with_a_desired_list_adds_removes_and_changes_roles(cc):
    a, u = setup_team(cc)
    out = ok(book(cc, a, who=u["oren"], attendees=[{"kind": "user", "ref_id": "dev-dana"}, guest("א")]), 201)
    ev, cur = out["event"], out["attendees"]["attendees"]
    g = next(x for x in cur if x["kind"] == "guest")
    body = {"revision": ev["revision"], "attendees": [{"kind": "user", "ref_id": "dev-dana", "role": "optional"}, {"kind": "user", "ref_id": "dev-bob"}, guest("ב")],
            "keep_attendee_ids": [g["id"]]}
    r = ok(cc.patch(f"{API}/calendar/events/{ev['id']}", json=body, headers=u["oren"]))
    names = sorted((x["name"], x["role"]) for x in r["attendees"]["attendees"])
    assert names == sorted([("dana", "optional"), ("bob", "required"), ("א", "required"), ("ב", "required")])
    assert r["event"]["revision"] == ev["revision"]  # an attendee-only PATCH does not touch the entry
    # dropping bob (not kept) and the guest א (not in keep)
    r = ok(cc.patch(f"{API}/calendar/events/{ev['id']}", json={"revision": ev["revision"], "attendees": [{"kind": "user", "ref_id": "dev-dana"}]}, headers=u["oren"]))
    assert [x["name"] for x in r["attendees"]["attendees"]] == ["dana"]
    # a non-organizer may not send a list that removes others
    assert cc.patch(f"{API}/calendar/events/{ev['id']}", json={"revision": ev["revision"], "attendees": []}, headers=u["bob"]).status_code == 403


# ---------------------------------------------------------------- privacy

def test_viewers_get_the_count_only_and_contacts_never_leak(cc):
    a, u = setup_team(cc)
    ev = ok(book(cc, a, who=u["oren"], attendees=[{"kind": "user", "ref_id": "dev-dana"}, guest(email=EMAIL)]), 201)["event"]
    url = f"{API}/calendar/events/{ev['id']}/attendees"
    v = ok(cc.get(url, headers=u["vera"]))
    assert v["count"] == 2 and v["list_visible"] is False and v["attendees"] == [] and v["can"]["contacts"] is False
    d = ok(cc.get(url, headers=u["dana"]))  # an attendee sees himself only under `organizer` visibility
    assert d["count"] == 2 and [x["name"] for x in d["attendees"]] == ["dana"] and d["me"]["status"] == "invited"
    policy(cc, a, list_visibility="attendees")
    d = ok(cc.get(url, headers=u["dana"]))
    assert len(d["attendees"]) == 2 and all("contact" not in x for x in d["attendees"])
    assert ok(cc.get(url, headers=u["vera"]))["attendees"] == []
    policy(cc, a, list_visibility="viewers")
    vv = ok(cc.get(url, headers=u["vera"]))
    assert len(vv["attendees"]) == 2 and all("contact" not in x and "last_notice" not in x for x in vv["attendees"])
    assert PHONE_E164 not in json.dumps(vv) and EMAIL not in json.dumps(vv)
    # outside the calendar's reach: the uniform 404; a busy-only calendar gives not even the count
    stranger = user(cc, "sam", "viewer")
    assert cc.get(url, headers=stranger).status_code == 404
    cur = ok(cc.get(f"{API}/calendar/calendars/{a['id']}"))["calendar"]
    ok(cc.patch(f"{API}/calendar/calendars/{a['id']}", json={"revision": cur["revision"], "visibility": "busy_to_all"}))
    assert ok(cc.get(url, headers=stranger))["count"] is None
    # nothing personal at rest outside the seal, in the audit or in the notice rows
    dispatch(cc)
    with db(cc).connection(mode="read") as c:
        rows = json.dumps([dict(r) for r in c.execute("SELECT * FROM cal_attendees").fetchall()], ensure_ascii=False)
        assert PHONE_E164 not in rows and EMAIL not in rows and "אורחת חיצונית" not in rows
        aud = json.dumps([dict(r) for r in c.execute("SELECT * FROM audit_log WHERE action LIKE 'calendar.attendee%'").fetchall()], ensure_ascii=False)
        assert PHONE_E164 not in aud and EMAIL not in aud and "אורחת חיצונית" not in aud and "dana" not in aud
        nrows = json.dumps([dict(r) for r in c.execute("SELECT * FROM notifications").fetchall()] + [dict(r) for r in c.execute("SELECT * FROM notify_outbox").fetchall()], ensure_ascii=False)
        assert PHONE_E164 not in nrows and EMAIL not in nrows and "אורחת חיצונית" not in nrows
        out = json.dumps([dict(r) for r in c.execute("SELECT * FROM cal_attendee_notices").fetchall()])
        assert PHONE_E164 not in out and EMAIL not in out


def test_directory_names_only_and_residents_for_organizers_who_may(cc):
    a, u = setup_team(cc)
    resident(cc, "res-1", "רות דיירת", email="ruth@example.test")
    resident(cc, "res-2", "דנה הדיירת", user_id="dev-dana")  # linked to dana's account: listed once, as the user
    r = ok(cc.get(f"{API}/calendar/attendees/directory?q=ד", headers=u["oren"]))  # an operator: users only
    assert r["residents"] is False and all(x["kind"] == "user" for x in r["results"])
    r = ok(cc.get(f"{API}/calendar/attendees/directory?q=ד"))  # the administrator: residents too
    kinds = {(x["kind"], x["ref_id"]) for x in r["results"]}
    assert ("resident", "res-1") in kinds and ("resident", "res-2") not in kinds and ("user", "dev-dana") in kinds
    assert all(set(x) == {"kind", "ref_id", "name"} for x in r["results"])
    assert "ruth@example.test" not in json.dumps(r) and "972505550199" not in json.dumps(r)
    assert cc.get(f"{API}/calendar/attendees/directory?q=ד", headers=u["vera"]).status_code == 403


# ---------------------------------------------------------------- notices

def test_invite_reaches_the_user_in_app_and_the_guest_by_the_messaging_channel(cc):
    a, u = setup_team(cc)
    ev = ok(book(cc, a, who=u["oren"], attendees=[{"kind": "user", "ref_id": "dev-dana"}, guest()]), 201)["event"]
    res = dispatch(cc)
    assert res["sent"] == 2
    with db(cc).connection(mode="read") as c:
        n = c.execute("SELECT * FROM notifications WHERE source = 'calendar.attendee.invite'").fetchall()
        assert len(n) == 1 and n[0]["subject_kind"] == "calendar_event" and n[0]["subject_id"] == ev["id"]
        rec = [r[0] for r in c.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (n[0]["id"],)).fetchall()]
        assert rec == ["dev-dana"]  # exactly the attendee
        assert "ישיבת דיירים" in n[0]["body"]
        assert all(r["notified_at"] for r in c.execute("SELECT notified_at FROM cal_attendees").fetchall())
    assert [x[0] for x in cc.wa.sent] == [PHONE_E164] and "ישיבת דיירים" in cc.wa.sent[0][1] and "dana" not in cc.wa.sent[0][1]
    st = {(x["akind"], x["state"], x["channel"]) for x in notices_of(cc)}
    assert st == {("user", "sent", "inapp"), ("guest", "sent", "whatsapp")}
    assert dispatch(cc)["sent"] == 0  # each notice once


def test_guest_channel_selection_follows_the_order_and_the_address(cc):
    avail = {"whatsapp": True, "sms": False, "email": False}
    pick = lambda order, ph, em: notices.choose_channel(order, {"phone": ph, "email": em}, lambda k: avail[k])  # noqa: E731
    assert pick(["email", "sms", "whatsapp"], True, True) == ("whatsapp", None)  # e-mail and SMS are not configured yet
    assert pick(["email", "whatsapp"], False, True) == (None, "channel_unavailable")
    assert pick(["whatsapp"], False, False) == (None, "no_address")
    a, u = setup_team(cc)
    ok(book(cc, a, who=u["oren"], attendees=[guest("רק מייל", phone="", email=EMAIL), guest("טלפון")]), 201)
    dispatch(cc)
    st = {x["state"] + ":" + str(x["reason"] or x["channel"]) for x in notices_of(cc)}
    assert st == {"skipped:channel_unavailable", "sent:whatsapp"}
    with db(cc).connection(mode="read") as c:
        assert c.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'calendar.attendee.notice'").fetchone()[0] == 2
    # the e-mail plug point: a registered live channel is chosen in the installation's order
    em = FakeChannel("email", "email")
    notices.register_channel(em)
    ok(cc.put(f"{API}/calendar/attendee-settings", json={"guest_channel_order": ["email", "whatsapp"]}))
    ok(book(cc, a, T(4, 10), T(4, 11), who=u["oren"], attendees=[guest("מייל ושוב", phone=PHONE, email=EMAIL)]), 201)
    dispatch(cc)
    assert em.sent and em.sent[0][0] == EMAIL
    with pytest.raises(ValueError):
        notices.register_channel(FakeChannel("pigeon", "phone"))


def test_change_notice_follows_the_time_and_the_calendar_switch(cc):
    a, u = setup_team(cc)
    ev = ok(book(cc, a, who=u["oren"], attendees=[{"kind": "user", "ref_id": "dev-dana"}]), 201)["event"]
    dispatch(cc)
    ok(cc.patch(f"{API}/calendar/events/{ev['id']}", json={"revision": ev["revision"], "title": "כותרת חדשה"}, headers=u["oren"]))
    assert [n["kind"] for n in notices_of(cc)] == ["invite"]  # a title change is not a change of time or room
    cur = ok(cc.get(f"{API}/calendar/events/{ev['id']}"))["event"]
    ok(cc.patch(f"{API}/calendar/events/{ev['id']}", json={"revision": cur["revision"], "start": T(3, 12), "end": T(3, 13)}, headers=u["oren"]))
    assert [n["kind"] for n in notices_of(cc)] == ["invite", "change"]
    dispatch(cc)
    with db(cc).connection(mode="read") as c:
        assert c.execute("SELECT COUNT(*) FROM notifications WHERE source = 'calendar.attendee.change'").fetchone()[0] == 1
    policy(cc, a, notify_on_change=False)
    cur = ok(cc.get(f"{API}/calendar/events/{ev['id']}"))["event"]
    ok(cc.patch(f"{API}/calendar/events/{ev['id']}", json={"revision": cur["revision"], "start": T(3, 14), "end": T(3, 15)}, headers=u["oren"]))
    assert len(notices_of(cc)) == 2


def test_cancel_waits_the_undo_window_and_an_undo_tells_nobody(cc):
    a, u = setup_team(cc)
    ev = ok(book(cc, a, who=u["oren"], attendees=[{"kind": "user", "ref_id": "dev-dana"}, guest()]), 201)["event"]
    dispatch(cc)
    ok(cc.post(f"{API}/calendar/events/{ev['id']}/cancel", json={"revision": ev["revision"]}, headers=u["oren"]))
    cancels = [n for n in notices_of(cc) if n["kind"] == "cancel"]
    assert len(cancels) == 2 and all(n["not_before"] == "2026-10-05T09:00:06Z" for n in cancels)  # the approved ~6 s
    assert dispatch(cc, NOW + dt.timedelta(seconds=3))["sent"] == 0  # inside the window nothing leaves
    # the undo (pilot/CAL-GRID-EDIT-2343 restores the entry, then calls the hook)
    with db(cc).connection() as c:
        c.execute("UPDATE cal_events SET state = 'confirmed' WHERE id = ?", (ev["id"],))
        assert ca.on_restore(c, ev["id"], NOW) == 2
    assert dispatch(cc, NOW + dt.timedelta(seconds=10))["sent"] == 0
    assert {n["state"] + ":" + n["reason"] for n in notices_of(cc) if n["kind"] == "cancel"} == {"retracted:undone"}
    # a restore without the hook is caught at send time too; a real cancel goes out after the window
    cur = ok(cc.get(f"{API}/calendar/events/{ev['id']}"))["event"]
    ok(cc.post(f"{API}/calendar/events/{ev['id']}/cancel", json={"revision": cur["revision"]}, headers=u["oren"]))
    sent_before = len(cc.wa.sent)
    assert dispatch(cc, NOW + dt.timedelta(seconds=7))["sent"] == 2
    assert len(cc.wa.sent) == sent_before + 1 and "בוטל" in cc.wa.sent[-1][1]
    ok(cc.put(f"{API}/calendar/attendee-settings", json={"cancel_notice_delay_s": 0}))
    assert cc.put(f"{API}/calendar/attendee-settings", json={"cancel_notice_delay_s": 999}).status_code == 422


def test_pending_requests_hold_invites_and_removal_rules(cc):
    a, u = setup_team(cc)
    cur = ok(cc.get(f"{API}/calendar/calendars/{a['id']}"))["calendar"]
    ok(cc.patch(f"{API}/calendar/calendars/{a['id']}", json={"revision": cur["revision"], "approval_mode": "always"}))
    out = ok(book(cc, a, who=u["oren"], attendees=[{"kind": "user", "ref_id": "dev-dana"}, {"kind": "user", "ref_id": "dev-bob"}]), 201)
    assert out["state"] == "pending"
    assert dispatch(cc)["waiting"] == 2  # a request waits; nobody is invited to something that may be refused
    ok(cc.post(f"{API}/calendar/requests/{out['event']['id']}/decide", json={"decision": "approve", "revision": out["event"]["revision"]}))
    assert dispatch(cc, NOW + dt.timedelta(minutes=3))["sent"] == 2
    url = f"{API}/calendar/events/{out['event']['id']}/attendees"
    rows = ok(cc.get(url, headers=u["oren"]))["attendees"]
    dana = next(x for x in rows if x["ref_id"] == "dev-dana")
    ok(cc.delete(f"{url}/{dana['id']}", headers=u["oren"]))  # dana was told before, so she is told about the removal (after the window)
    assert [n["kind"] for n in notices_of(cc) if n["ref_id"] == "dev-dana"] == ["invite", "removed"]
    ok(cc.post(url, json={"attendees": [guest()]}, headers=u["oren"]), 201)
    g = next(x for x in ok(cc.get(url, headers=u["oren"]))["attendees"] if x["kind"] == "guest")
    ok(cc.delete(f"{url}/{g['id']}", headers=u["oren"]))  # never told -> the invite is retracted, no removal notice
    gn = [n for n in notices_of(cc) if n["akind"] == "guest"]
    assert [(n["kind"], n["state"]) for n in gn] == [("invite", "retracted")]


def test_rsvp_by_the_attendee_only(cc):
    a, u = setup_team(cc)
    ev = ok(book(cc, a, who=u["oren"], attendees=[{"kind": "user", "ref_id": "dev-dana"}]), 201)["event"]
    url = f"{API}/calendar/events/{ev['id']}/attendees/me"
    assert ok(cc.put(url, json={"status": "declined"}, headers=u["dana"]))["me"]["status"] == "declined"
    assert cc.put(url, json={"status": "maybe"}, headers=u["dana"]).status_code == 422
    assert cc.put(url, json={"status": "accepted"}, headers=u["bob"]).status_code == 404
    # a resident linked to an account answers as himself
    resident(cc, "res-9", "בוב הדייר", user_id="dev-bob")
    ok(cc.post(f"{API}/calendar/events/{ev['id']}/attendees", json={"attendees": [{"kind": "resident", "ref_id": "res-9"}]}, headers=u["oren"]), 201)
    assert ok(cc.put(url, json={"status": "tentative"}, headers=u["bob"]))["me"]["status"] == "tentative"


def test_resident_without_account_by_messaging_and_with_account_in_app(cc):
    a, u = setup_team(cc)
    resident(cc, "res-a", "דייר בלי חשבון", phone="972505550111")
    resident(cc, "res-b", "דיירת עם חשבון", user_id="dev-dana", phone="972505550122")
    ok(book(cc, a, who=u["oren"], attendees=[{"kind": "resident", "ref_id": "res-a"}, {"kind": "resident", "ref_id": "res-b"}]), 201)
    dispatch(cc)
    assert [x[0] for x in cc.wa.sent] == ["+972505550111"]
    assert {(n["ref_id"], n["channel"]) for n in notices_of(cc)} == {("res-a", "whatsapp"), ("res-b", "inapp")}


def test_settings_and_policy_documents(cc):
    enable(cc)
    s = ok(cc.get(f"{API}/calendar/attendee-settings"))
    assert s["settings"] == att.SETTINGS_DEFAULTS
    assert {c["key"]: c["state"] for c in s["channels"]} == {"whatsapp": "live", "sms": "soon", "email": "soon"}
    for bad in ({"guest_channel_order": []}, {"guest_channel_order": ["fax"]}, {"guest_channel_order": ["sms", "sms"]}, {"nope": 1}, {"notify_guests": "yes"}):
        assert cc.put(f"{API}/calendar/attendee-settings", json=bad).status_code == 422
    vera = user(cc, "vera", "viewer")
    assert cc.put(f"{API}/calendar/attendee-settings", json={"notify_guests": False}, headers=vera).status_code == 403
    a = room(cc)
    p = ok(cc.get(f"{API}/calendar/calendars/{a['id']}/attendee-policy"))
    assert p["policy"] == {**att.POLICY_DEFAULTS, "revision": 0} and p["can_edit"] is True
    for bad in ({"guests_mode": "all"}, {"max_attendees": 0}, {"list_visibility": "x"}, {"self_join": 1}, {"zzz": True}):
        assert cc.put(f"{API}/calendar/calendars/{a['id']}/attendee-policy", json=bad).status_code == 422
    p = policy(cc, a, max_attendees=10, revision=0)
    assert p["max_attendees"] == 10 and p["revision"] == 1
    assert cc.put(f"{API}/calendar/calendars/{a['id']}/attendee-policy", json={"max_attendees": 11, "revision": 0}).status_code == 409
    with db(cc).connection(mode="read") as c:
        assert c.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'calendar.attendee.policy'").fetchone()[0] == 1


def test_guest_contacts_are_erased_on_the_guest_retention(cc):
    a, u = setup_team(cc)
    ok(cc.put(f"{API}/calendar/settings", json={"enabled": True, "guest_retention_days": 0}))
    ev = ok(book(cc, a, who=u["oren"], attendees=[guest()]), 201)["event"]
    assert notices.erase_due(db(cc), NOW) == 0
    assert notices.erase_due(db(cc), dt.datetime(2026, 11, 3, 11, 1, tzinfo=UTC)) == 1
    with db(cc).connection(mode="read") as c:
        r = c.execute("SELECT * FROM cal_attendees").fetchone()
        assert r["name_sealed"] is None and r["phone_sealed"] is None and r["erased_at"]
    v = ok(cc.get(f"{API}/calendar/events/{ev['id']}/attendees", headers=u["oren"]))
    assert v["attendees"][0]["name"] == "אורח" and v["attendees"][0]["contact"] == {"phone": "", "email": ""}


def test_module_off_and_notification_visibility(cc):
    a, u = setup_team(cc)
    ev = ok(book(cc, a, who=u["oren"], attendees=[{"kind": "user", "ref_id": "dev-dana"}]), 201)["event"]
    dispatch(cc)
    from smplwise.services import notify
    from smplwise.services.notify_visibility import Reach, principal_of

    with db(cc).connection() as c:
        n = notify._row_note(c.execute("SELECT * FROM notifications WHERE source = 'calendar.attendee.invite'").fetchone())
        assert Reach(c, principal_of(c, "dev-dana")).can_see(n) is True
        assert Reach(c, principal_of(c, "dev-bob")).can_see(n) is False  # not his invitation
    ok(cc.put(f"{API}/calendar/settings", json={"enabled": False}))
    assert cc.get(f"{API}/calendar/events/{ev['id']}/attendees").status_code == 404
    with db(cc).connection() as c:
        assert Reach(c, principal_of(c, "dev-dana")).can_see(n) is False


# ---------------------------------------------------------------- the real WhatsApp path (fake ha-whatsapp)

def test_whatsapp_channel_through_the_shared_account_on_the_fake_adapter(cc, monkeypatch):
    from fake_ha_whatsapp import FakeHaWhatsapp, PairedAccount

    from smplwise.services import ha_sync
    from smplwise.services import messaging_accounts as ma
    from smplwise.services import messaging_runtime as mr
    from smplwise.services import notify_whatsapp as wa

    monkeypatch.setitem(notices.CHANNELS, "whatsapp", notices.WhatsAppChannel())
    monkeypatch.setattr(mr, "ws_connected", lambda: True)
    monkeypatch.setattr(ha_sync.STATE, "connected", True)
    entry = "01JFAKECALATT1"
    fake = FakeHaWhatsapp([PairedAccount(entry, "15555550191")])
    monkeypatch.setattr(wa, "TRANSPORT", fake)
    a, u = setup_team(cc)
    assert notices.CHANNELS["whatsapp"].available(db(cc)) is False  # no account mapped: not configured
    at = now_iso()
    with db(cc).connection() as conn:
        for r in fake.mirror_rows():
            conn.execute("INSERT OR REPLACE INTO ha_entities(entity_id, unique_id, platform, config_entry_id, domain, device_class, state, available, disabled, name, first_seen_at, updated_at) "
                         "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)",
                         (r.entity_id, r.unique_id, r.platform, r.config_entry_id, r.domain, r.device_class, r.state, int(r.available), int(r.disabled), at, at))
        mr.store_doc(conn, ma.MappingDoc(1, (ma.Account(f"entry:{entry}", "discovered", label="משרד"),), {wa.USE_KEY: f"entry:{entry}"}))
    assert notices.CHANNELS["whatsapp"].available(db(cc)) is True  # the attendee use inherits the notifications account
    ok(book(cc, a, who=u["oren"], attendees=[guest()]), 201)
    res = dispatch(cc, dt.datetime.now(UTC))
    assert res["sent"] == 1, (res, notices_of(cc))
    texts = fake.sent_texts()
    assert len(texts) == 1 and "ישיבת דיירים" in texts[0] and "http" not in texts[0]


def test_cancel_of_one_occurrence_and_of_the_following_reaches_the_attendees(cc):
    a, u = setup_team(cc)
    ev = ok(book(cc, a, who=u["oren"], rrule="FREQ=WEEKLY;COUNT=4", attendees=[{"kind": "user", "ref_id": "dev-dana"}]), 201)["event"]
    dispatch(cc)
    ok(cc.post(f"{API}/calendar/events/{ev['id']}/cancel", json={"revision": ev["revision"], "scope": "occurrence", "occurrence_start": "2026-11-10T12:00"}, headers=u["oren"]))
    c1 = [n for n in notices_of(cc) if n["kind"] == "cancel"]
    assert len(c1) == 1 and c1[0]["occurrence_start"] == "2026-11-10T12:00"
    assert dispatch(cc, NOW + dt.timedelta(seconds=7))["sent"] == 1
    cur = ok(cc.get(f"{API}/calendar/events/{ev['id']}"))["event"]
    ok(cc.post(f"{API}/calendar/events/{ev['id']}/cancel", json={"revision": cur["revision"], "scope": "following", "occurrence_start": "2026-11-17T12:00"}, headers=u["oren"]))
    assert dispatch(cc, NOW + dt.timedelta(seconds=14))["sent"] == 1  # the series now ends before that occurrence
    with db(cc).connection(mode="read") as c:
        bodies = [r[0] for r in c.execute("SELECT body FROM notifications WHERE source = 'calendar.attendee.cancel' ORDER BY first_at").fetchall()]
    assert len(bodies) == 2 and "10.11" in bodies[0] and "17.11" in bodies[1]
