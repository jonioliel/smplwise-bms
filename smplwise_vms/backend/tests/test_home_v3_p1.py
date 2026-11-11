"""HOME-V3-P1-2430: the home interface mockup v3, phase 1 (security and intercom) - the server side.

* the per-person guest mark (migration 0213): default off, set by the administrator, never a grant; the visitor routes reach a home-only
  person only with the mark, and the visitor settings / revoke-all / entrance flag never;
* the home-only gate's new routes: recordings, playback sessions, the events (read only), the intercom people (read only), the personal
  alarm code;
* the administrator's room wallpaper for everyone (owner decision 16b) and the doors a guest may be given."""
from __future__ import annotations

import sqlite3
from dataclasses import replace
from pathlib import Path

import pytest
from conftest import as_user, bind, png_bytes
from fastapi.testclient import TestClient

from smplwise.db import set_setting
from smplwise.services import home_interface as hi
from smplwise.services import home_v3


@pytest.fixture()
def client(settings):
    hi.reset_state_for_tests()
    from smplwise.main import create_app

    a = create_app(replace(settings))
    c = TestClient(a)
    assert c.get("/api/v1/me").status_code == 200  # joni: the bootstrap system administrator
    yield c, a, settings
    hi.reset_state_for_tests()


def _policy(c: TestClient, user: str, **body):
    return c.put(f"/api/v1/home/policies/dev-{user}", json=body)


def _gate(c: TestClient, method: str, path: str, user: str = "dana", **kw):
    r = c.request(method, path, headers=as_user(user), **kw)
    return r.status_code == 403 and r.json().get("code") == "home_interface_only"


# ---------------------------------------------------------------- migration 0213 and the guest mark

def test_migration_0213_adds_the_guest_mark_off_by_default(tmp_path: Path):
    mig = Path(hi.__file__).resolve().parents[1] / "migrations"
    conn = sqlite3.connect(tmp_path / "m.db")
    conn.executescript((mig / "0211_home_interface.sql").read_text(encoding="utf-8").split("INSERT INTO")[0])
    conn.execute("INSERT INTO home_interface_policy (user_id, default_interface, updated_at) VALUES ('u1', 'full', 'x')")
    conn.executescript((mig / "0213_home_v3_p1.sql").read_text(encoding="utf-8"))
    cols = [r[1] for r in conn.execute("PRAGMA table_info(home_interface_policy)").fetchall()]
    assert cols[-1] == "guests"
    assert conn.execute("SELECT guests FROM home_interface_policy WHERE user_id = 'u1'").fetchone()[0] == 0


def test_guest_mark_is_set_by_the_administrator_and_shown_with_the_permission_hint(client):
    c, _a, s = client
    bind(c, s, "dana", "operator", "installation", "*")
    assert c.get("/api/v1/home/interface", headers=as_user("dana")).json()["guests"] is False
    r = _policy(c, "dana", guests=True)
    assert r.status_code == 200 and r.json()["guests"] is True
    assert c.get("/api/v1/home/interface", headers=as_user("dana")).json()["guests"] is True
    row = next(u for u in c.get("/api/v1/home/policies").json()["users"] if u["user_id"] == "dev-dana")
    assert row["guests"] is True and row["can_invite"] is False  # an operator holds no access.visitor.invite: the mark alone grants nothing
    # only the administrator sets it
    assert c.put("/api/v1/home/policies/dev-dana", headers=as_user("dana"), json={"guests": False}).status_code == 403
    with _a.state.db.connection(mode="read") as conn:
        d = conn.execute("SELECT details_json FROM audit_log WHERE action = 'home_interface.policy.set' ORDER BY rowid DESC LIMIT 1").fetchone()[0]
    assert '"guests": true' in d


def test_guest_doors_hidden_while_visitors_off_or_unmarked(client):
    c, _a, s = client
    bind(c, s, "dana", "operator", "installation", "*")
    # the visitor switch is off by default: hidden for everyone, even the administrator
    assert c.get("/api/v1/home/guest-doors").status_code == 404
    from smplwise.services import access_grants as ag
    from smplwise.services import access_visitors as av

    with _a.state.db.connection() as conn:
        set_setting(conn, av.FLAG_KEY, 'on')
    orig = ag.enabled
    ag.enabled = lambda _conn: True
    try:
        assert c.get("/api/v1/home/guest-doors", headers=as_user("dana")).status_code == 404  # not marked
        _policy(c, "dana", guests=True)
        r = c.get("/api/v1/home/guest-doors", headers=as_user("dana"))
        assert r.status_code == 200 and r.json()["doors"] == []  # no station where dana holds the invite permission
    finally:
        ag.enabled = orig


# ---------------------------------------------------------------- the home-only gate: phase 1 routes

def test_gate_rules_for_the_phase_1_routes():
    ok = lambda p, m="GET": hi.home_allowed("/api/v1" + p, method=m)  # noqa: E731
    for p in ("/cameras/cam1/recordings", "/cameras/cam1/recordings/days", "/cameras/cam1/events", "/playback/sessions", "/playback/sessions/s1/seek",
              "/playback/sessions/s1/ws", "/alarm/me", "/alarm/me/pin", "/events", "/events/e1/thumbnail", "/intercom/people", "/intercom/calls"):
        assert ok(p), p
    assert ok("/playback/sessions", "POST") and ok("/alarm/me/pin", "PUT")
    # read-only: the same paths' writes stay refused
    for p, m in (("/events/e1/ack", "POST"), ("/events/ack-many", "POST"), ("/events/windows/groups", "POST"), ("/intercom/people", "POST")):
        assert not ok(p, m), (p, m)
    # people management under the people prefix is not opened
    assert not ok("/intercom/people/u1/editor") and not ok("/intercom/people-editor/context")
    # the visitor routes are not in the allowlist: they need the person's guest mark
    assert not ok("/access/visitors") and hi.flag_route("/api/v1/access/visitors") == "guests"
    assert hi.flag_route("/api/v1/access/visitors/abc/verify/send") == "guests"
    for p in ("/access/visitors/settings", "/access/visitors/revoke-all", "/access/visitors/entrances/st1", "/access/visitorsx", "/alarm/config"):
        assert hi.flag_route("/api/v1" + p) is None, p


def test_home_only_person_reaches_phase_1_routes_and_visitors_only_when_marked(client):
    c, _a, s = client
    bind(c, s, "dana", "operator", "installation", "*")
    assert _policy(c, "dana", home_only=True).status_code == 200
    for path in ("/api/v1/events", "/api/v1/alarm/me", "/api/v1/intercom/people", "/api/v1/playback/sessions", "/api/v1/cameras/x/recordings?date=2026-11-11"):
        assert not _gate(c, "GET", path), path
    assert _gate(c, "POST", "/api/v1/events/ack-many", json={"ids": []})
    assert _gate(c, "POST", "/api/v1/intercom/people", json={})
    # visitors: refused by the home gate until the administrator marks the person
    assert _gate(c, "GET", "/api/v1/access/visitors")
    _policy(c, "dana", guests=True)
    assert not _gate(c, "GET", "/api/v1/access/visitors")  # the visitor route answers itself (404 while the switch is off)
    assert c.get("/api/v1/access/visitors", headers=as_user("dana")).status_code == 404
    assert _gate(c, "GET", "/api/v1/access/visitors/settings")
    assert _gate(c, "POST", "/api/v1/access/visitors/revoke-all", json={"confirm": "x"})
    # a person who is not home-only is never refused by the gate (the mark only steers the home interface's screens)
    bind(c, s, "eli", "operator", "installation", "*")
    assert not _gate(c, "GET", "/api/v1/access/visitors", user="eli")


# ---------------------------------------------------------------- owner decision 16b: the administrator's room wallpaper for everyone

def test_room_wallpaper_for_everyone(client):
    c, _a, s = client
    bind(c, s, "dana", "operator", "installation", "*")
    # only the administrator
    assert c.put("/api/v1/home/room-wallpapers/living", headers=as_user("dana"), json={"value": "g:dusk"}).status_code == 403
    assert c.get("/api/v1/home/room-wallpapers", headers=as_user("dana")).status_code == 403
    # off while the installation offers no wallpaper
    r = c.put("/api/v1/home/room-wallpapers/living", json={"value": "g:dusk"})
    assert r.status_code == 403 and r.json()["code"] == "wallpaper_off"
    assert c.put("/api/v1/home/settings", json={"wallpaper": "gallery"}).status_code == 200
    assert c.put("/api/v1/home/room-wallpapers/living", json={"value": "g:nope"}).status_code == 422
    assert c.put("/api/v1/home/room-wallpapers/../x", json={"value": "g:dusk"}).status_code in (404, 422)
    r = c.put("/api/v1/home/room-wallpapers/living", json={"value": "g:dusk"})
    assert r.status_code == 200 and r.json()["walls"] == {"living": "g:dusk"}
    # everyone reads the applied set with their interface
    assert c.get("/api/v1/home/interface", headers=as_user("dana")).json()["room_wallpapers"] == {"living": "g:dusk"}
    # a picture needs pictures on
    files = {"file": ("w.png", png_bytes(), "image/png")}
    r = c.put("/api/v1/home/room-wallpapers/living/image", files=files)
    assert r.status_code == 403 and r.json()["code"] == "wallpaper_image_off"
    c.put("/api/v1/home/settings", json={"wallpaper": "gallery_image"})
    assert c.put("/api/v1/home/room-wallpapers/living/image", headers=as_user("dana"), files={"file": ("w.png", png_bytes(), "image/png")}).status_code == 403
    r = c.put("/api/v1/home/room-wallpapers/living/image", files={"file": ("w.png", png_bytes(), "image/png")})
    assert r.status_code == 200 and r.json()["walls"] == {"living": "img"}
    got = c.get("/api/v1/home/room-wallpapers/living/image", headers=as_user("dana"))  # served to anyone signed in
    assert got.status_code == 200 and got.headers["content-type"] in ("image/png", "image/jpeg") and got.headers["x-content-type-options"] == "nosniff"
    # the shared picture is not anyone's personal picture
    assert c.get("/api/v1/home/wallpaper/living", headers=as_user("dana")).status_code == 404
    # turning pictures off hides it again; the gallery choice of other rooms stays
    c.put("/api/v1/home/room-wallpapers/bed", json={"value": "g:moss"})
    c.put("/api/v1/home/settings", json={"wallpaper": "gallery"})
    assert c.get("/api/v1/home/interface").json()["room_wallpapers"] == {"bed": "g:moss"}
    assert c.get("/api/v1/home/room-wallpapers/living/image").status_code == 404
    c.put("/api/v1/home/settings", json={"wallpaper": "gallery_image"})
    assert c.delete("/api/v1/home/room-wallpapers/living/image").json()["walls"] == {"bed": "g:moss"}
    assert c.put("/api/v1/home/room-wallpapers/bed", json={"value": ""}).json()["walls"] == {}
    with _a.state.db.connection(mode="read") as conn:
        acts = {r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'home_interface.room_wallpaper%'").fetchall()}
    assert acts == {"home_interface.room_wallpaper.set", "home_interface.room_wallpaper.image", "home_interface.room_wallpaper.image_delete"}


def test_room_wallpapers_ignore_unknown_stored_values(client):
    _c, a, _s = client
    with a.state.db.connection() as conn:
        set_setting(conn, home_v3.WALLS_KEY, '{"a": "g:dusk", "b": "g:evil", "c": "img", "d": 5}')
        assert home_v3.room_wallpapers(conn, "gallery_image") == {"a": "g:dusk"}  # no picture row for c
        assert home_v3.room_wallpapers(conn, "none") == {}
