"""HOME-V3-FOLLOWUP-B-2431 (owner answers 2026-11-11).

q1: a wall panel locked to its room adds an event to the FAMILY calendar (POST /home/wall/events) and nothing else of the calendar:
no room booking, no availability search, no cancel / withdraw through the module's own routes (403 `kiosk_calendar_add_only`), no
notice posting. A home-only person who is not a wall panel keeps the module's calendar routes; the wall route is the panel's only.
q2: a photo on the person's own NEW ticket from the home interface (POST /home/tickets/{id}/photos): the module's own pipeline (EXIF
stripped), JPEG / PNG only, only the creator, only while the ticket is new, at most three; the tickets module off -> 404 everywhere.
q3 (no change): an open ticket keeps "add note" only - the photo route refuses a ticket that is no longer new."""
from __future__ import annotations

import datetime as dt
import io

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from PIL import Image
from tickets_world import build as tickets_build
from tickets_world import rid

from smplwise.db import Database
from smplwise.routers import calendar as cal_router
from smplwise.routers import home_ticket_photo as htp
from smplwise.services import home_interface as hi
from smplwise.services.tickets import attachments

API = "/api/v1"
NOW = dt.datetime(2026, 11, 2, 9, 0, tzinfo=dt.timezone.utc)
START, END = "2026-11-03T16:00:00Z", "2026-11-03T17:00:00Z"


@pytest.fixture(autouse=True)
def _reset():
    hi.reset_state_for_tests()
    attachments.forget_size_cache()
    yield
    hi.reset_state_for_tests()
    attachments.forget_size_cache()


# ---------------------------------------------------------------- q1: the gate (pure)

def test_wall_route_is_allowlisted_and_the_module_calendar_writes_are_kiosk_refused():
    assert hi.home_allowed(f"{API}/home/wall/events", method="POST")
    for p in ("/calendar/events", "/calendar/availability", "/calendar/events/preview", "/calendar/events/evt_1/cancel", "/calendar/events/evt_1/withdraw",
              "/calendar/events/evt_1"):
        assert hi.kiosk_refused_write(API + p, method="POST" if not p.endswith("evt_1") else "PATCH"), p
    for p in ("/calendar/occurrences", "/calendar/calendars", "/calendar/rooms/day", "/calendar/events/evt_1"):
        assert not hi.kiosk_refused_write(API + p, method="GET"), p  # the panel still READS the calendar
    for p in ("/home/wall/events", "/home/tickets", "/notices/n1/read", "/automations/scene"):
        assert not hi.kiosk_refused_write(API + p, method="POST"), p
    # notice posting is never allowlisted for a home-only person (a wall panel included)
    assert not hi.home_allowed(f"{API}/notices", method="POST") and not hi.home_allowed(f"{API}/notices/n1/publish", method="POST")


# ---------------------------------------------------------------- q1: the routes

@pytest.fixture()
def cw(settings, monkeypatch):
    """The calendar module on, a family calendar (team), a shared room, the wall panel `wall` (kiosk, locked to `living`) and a
    home-only resident `vera`; both hold `book` on the family calendar and on the room."""
    from smplwise.main import create_app

    monkeypatch.setattr(cal_router, "_now", lambda: NOW)
    c = TestClient(create_app(settings))
    c.settings_obj = settings
    assert c.get(f"{API}/me").status_code == 200  # joni: the bootstrap administrator
    assert c.put(f"{API}/calendar/settings", json={"enabled": True}).status_code == 200
    for u in ("wall", "vera", "nobook"):
        bind(c, settings, u, "operator", "installation", "*")
    fam = c.post(f"{API}/calendar/calendars", json={"name": "משפחה", "type": "team", "color": "cyan"})
    assert fam.status_code == 201, fam.text
    room = c.post(f"{API}/calendar/calendars", json={"name": "חדר כושר", "type": "room", "color": "blue", "capacity": 10, "buffer_after_min": 0})
    assert room.status_code == 201, room.text
    ids = {"fam": fam.json()["calendar"]["id"], "room": room.json()["calendar"]["id"]}
    for k in ids.values():
        cal = c.get(f"{API}/calendar/calendars/{k}").json()["calendar"]
        rows = [{"subject_kind": "user", "subject_id": f"dev-{u}", "cal_role": "book"} for u in ("wall", "vera")]
        r = c.put(f"{API}/calendar/calendars/{k}/members", json={"revision": cal["revision"], "members": rows})
        assert r.status_code == 200, r.text
    assert c.put(f"{API}/home/policies/dev-wall", json={"kiosk": True, "kiosk_area_id": "living"}).status_code == 200
    assert c.put(f"{API}/home/policies/dev-vera", json={"home_only": True}).status_code == 200
    assert c.put(f"{API}/home/policies/dev-nobook", json={"kiosk": True, "kiosk_area_id": "living"}).status_code == 200
    return c, ids


def _wall(c, who="wall", **body):
    return c.post(f"{API}/home/wall/events", json={"title": "ארוחת ערב", "start": START, "end": END, **body}, headers=as_user(who))


def test_wall_panel_adds_an_event_to_the_family_calendar(cw):
    c, ids = cw
    r = _wall(c)
    assert r.status_code == 201, r.text
    ev = r.json()["event"]
    assert ev["calendar_id"] == ids["fam"] and ev["kind"] == "event" and r.json()["state"] == "confirmed"
    # it is on the family's day for everyone
    occ = c.get(f"{API}/calendar/occurrences?from=2026-11-03T00:00:00Z&to=2026-11-04T00:00:00Z&calendars={ids['fam']}", headers=as_user("vera"))
    assert occ.status_code == 200 and [o["title"] for o in occ.json()["occurrences"]] == ["ארוחת ערב"]
    # audited as the module's own create, marked as the wall panel's
    with Database(c.settings_obj.db_path).connection() as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'calendar.event.create' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert row is not None and "wall_panel" in row[0]
    # the explicit family calendar works too
    assert _wall(c, calendar_id=ids["fam"]).status_code == 201


def test_wall_panel_cannot_book_a_room_or_cancel_through_any_route(cw):
    c, ids = cw
    h = as_user("wall")
    r = _wall(c, calendar_id=ids["room"])
    assert r.status_code == 403 and r.json()["code"] == "wall_family_calendar_only"
    for path, body in (("/calendar/events", {"calendar_id": ids["room"], "kind": "booking", "title": "x", "start": START, "end": END}),
                       ("/calendar/events", {"calendar_id": ids["fam"], "kind": "event", "title": "x", "start": START, "end": END}),
                       ("/calendar/availability", {}), ("/calendar/events/evt_x/cancel", {}), ("/calendar/events/evt_x/withdraw", {})):
        r = c.post(API + path, json=body, headers=h)
        assert r.status_code == 403 and r.json()["code"] == "kiosk_calendar_add_only", (path, r.text)
    # the wall route takes nothing but an event: no rooms, series, guests or another kind
    for extra in ({"rooms": [ids["room"]]}, {"kind": "booking"}, {"rrule": "FREQ=DAILY"}, {"guests": []}, {"attendees": []}):
        assert _wall(c, **extra).status_code == 422, extra
    # notice posting stays refused
    assert c.post(f"{API}/notices", json={"title": "x"}, headers=h).status_code == 403
    # reads still work
    assert c.get(f"{API}/calendar/calendars", headers=h).status_code == 200


def test_a_home_only_resident_keeps_the_module_routes_but_not_the_wall_route(cw):
    c, ids = cw
    h = as_user("vera")
    r = c.post(f"{API}/calendar/events", json={"calendar_id": ids["room"], "kind": "booking", "title": "אימון", "start": START, "end": END}, headers=h)
    assert r.status_code == 201, r.text
    r = _wall(c, who="vera")
    assert r.status_code == 403 and r.json()["code"] == "wall_panel_only"


def test_wall_route_needs_the_calendar_role_the_module_and_the_category(cw):
    c, ids = cw
    r = _wall(c, who="nobook")  # a wall panel without a role on any family calendar
    assert r.status_code == 403
    r = _wall(c, who="nobook", calendar_id=ids["fam"])
    assert r.status_code in (403, 404)
    assert c.put(f"{API}/home/policies/dev-wall", json={"modules": ["lights"]}).status_code == 200
    r = _wall(c)
    assert r.status_code == 403 and r.json()["code"] == "home_module_off"
    assert c.put(f"{API}/calendar/settings", json={"enabled": False}).status_code == 200
    r = _wall(c)
    assert r.status_code == 404 and r.json()["code"] == "feature_disabled"


def test_wall_route_validates_the_title_and_times(cw):
    c, _ids = cw
    assert _wall(c, title="   ").status_code == 422
    assert _wall(c, start="not-a-time").status_code == 422
    assert _wall(c, start=END, end=START).status_code == 422


# ---------------------------------------------------------------- q2: a photo on a new ticket

def _img(fmt="JPEG", exif: bytes | None = None) -> bytes:
    buf = io.BytesIO()
    kw = {"exif": exif} if exif is not None else {}
    Image.new("RGB", (640, 400), (30, 140, 200)).save(buf, format=fmt, **kw)
    return buf.getvalue()


def _gps_exif() -> bytes:
    ex = Image.Exif()
    ex[0x010F] = "PhoneMaker"
    ex[0x8825] = {1: "N", 2: (32.0, 4.0, 30.0), 3: "E", 4: (34.0, 46.0, 50.0)}
    return ex.tobytes()


def _new_ticket(w, user="nora"):
    r = w.c.post(f"{API}/home/tickets", json={"department_id": "dept-maintenance", "title": "נזילה", "where": "מטבח", "text": "מטפטף", "client_request_id": rid()},
                 headers=w.h(user))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _photo(w, tid, user="nora", data=None, ctype="image/jpeg", name="p.jpg"):
    return w.c.post(f"{API}/home/tickets/{tid}/photos", files={"file": (name, data if data is not None else _img(), ctype)}, headers=w.h(user))


def test_creator_attaches_a_photo_to_a_new_ticket_without_exif(settings):
    w = tickets_build(settings)
    tid = _new_ticket(w)
    r = _photo(w, tid, data=_img(exif=_gps_exif()))
    assert r.status_code == 201, r.text
    assert r.json()["ticket"]["id"] == tid
    with w.c.app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT path, uploaded_by FROM ticket_attachments WHERE ticket_id = ?", (tid,)).fetchall()
    assert len(rows) == 1 and rows[0]["uploaded_by"] == "dev-nora"
    stored = attachments.path_of(settings.data_dir, rows[0]["path"]).read_bytes()
    again = Image.open(io.BytesIO(stored))
    assert again.format == "JPEG" and not again.getexif() and "exif" not in again.info
    assert _photo(w, tid, data=_img("PNG"), ctype="image/png", name="p.png").status_code == 201


def test_photo_refuses_other_types_people_and_tickets(settings):
    w = tickets_build(settings)
    tid = _new_ticket(w)
    r = _photo(w, tid, data=b"<svg xmlns='http://www.w3.org/2000/svg'/>", ctype="image/svg+xml", name="x.svg")
    assert r.status_code == 415 and r.json()["code"] == "image_type"
    r = _photo(w, tid, data=b"<html>not an image</html>", ctype="image/jpeg")  # a lie about the type: the pipeline refuses it
    assert r.status_code in (415, 422) and r.json()["code"] != "image_type"  # refused by the pipeline itself
    assert _photo(w, tid, user="tom").status_code == 404  # a member who sees the ticket, but did not open it
    other = w.create("tom", "נורה שרופה")["id"]
    assert _photo(w, other).status_code == 404
    # the module's own attachment route stays out of a home-only person's reach
    assert w.c.put(f"{API}/home/policies/dev-nora", json={"home_only": True}).status_code == 200
    r = w.c.post(f"{API}/tickets/{tid}/attachments", files={"file": ("p.jpg", _img(), "image/jpeg")}, headers=w.h("nora"))
    assert r.status_code == 403 and r.json()["code"] == "home_interface_only"
    assert _photo(w, tid).status_code == 201  # ... while the home route is allowlisted for her


def test_photo_only_while_the_ticket_is_new_and_at_most_three(settings, monkeypatch):
    w = tickets_build(settings)
    tid = _new_ticket(w)
    for _ in range(htp.PHOTOS_MAX):
        assert _photo(w, tid).status_code == 201
    r = _photo(w, tid)
    assert r.status_code == 409 and r.json()["code"] == "too_many_photos"
    # after the window an open ticket keeps "add note" only (owner answer q3)
    t2 = _new_ticket(w)
    monkeypatch.setattr(htp, "PHOTO_WINDOW_S", -1)
    r = _photo(w, t2)
    assert r.status_code == 409 and r.json()["code"] == "ticket_not_new"
    assert w.c.post(f"{API}/home/tickets/{t2}/notes", json={"text": "עוד פרט"}, headers=w.h("nora")).status_code == 201


def test_photo_refused_once_the_ticket_is_taken(settings):
    w = tickets_build(settings)
    tid = _new_ticket(w)
    with w.c.app.state.db.connection() as conn:
        conn.execute("UPDATE tickets SET status = 'in_progress' WHERE id = ?", (tid,))
    r = _photo(w, tid)
    assert r.status_code == 409 and r.json()["code"] == "ticket_not_new"


def test_tickets_module_off_means_no_photo_route(settings):
    w = tickets_build(settings)
    tid = _new_ticket(w)
    assert w.c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    r = _photo(w, tid)
    assert r.status_code == 404 and r.json()["code"] == "feature_disabled"
