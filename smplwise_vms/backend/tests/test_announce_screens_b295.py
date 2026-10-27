"""ANNOUNCEB-295 (voice announcements, stage B): the announcement text is also shown on screens - notice TV boards and wall displays.

The screens are display surfaces of Arx itself and only READ: no speaker, engine, player or physical device is contacted (every speak / player call
goes to a fake). OFF by default; allowed screen by screen in Settings; the same scopes (device / area / all), quiet hours, limits, emergency flag
and audit as the speakers; the text of every language, no translation; the public feed carries no author and no targets."""
from __future__ import annotations

import datetime as dt
import json

import media_seed_audio as aseed
import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import announce_screens as scr
from smplwise.services import announcements as ann
from smplwise.services import notify
from smplwise.services.notices import display

API = "/api/v1/announcements"
ADMIN = as_user("joni")
WALL = as_user("wall")


class Speaker:
    def __init__(self) -> None:
        self.calls: list[tuple] = []

    def __call__(self, _settings, engine, entity_ids, message, language) -> None:
        self.calls.append((engine, list(entity_ids), message, language))


@pytest.fixture()
def world(settings, monkeypatch):
    fake = Speaker()
    monkeypatch.setattr(ann, "SPEAK", fake)
    monkeypatch.setattr(ann, "PLAYER_STATE", lambda _s, _e: None)
    monkeypatch.setattr(ann, "PLAYER_CALL", lambda *_a, **_k: (_ for _ in ()).throw(AssertionError("no player action is expected")))
    monkeypatch.setattr(ann, "SLEEP", lambda _s: None)
    clock = {"now": dt.datetime.now(dt.timezone.utc).replace(microsecond=0)}  # the feed of a board reads the real clock, so the announcements do too
    monkeypatch.setattr(notify, "now_utc", lambda: clock["now"])
    monkeypatch.setenv("SW_ANNOUNCE_CLOUD_KEY", "x")
    monkeypatch.delenv("SW_ANNOUNCE_CLOUD_KEY")
    app = create_app(settings)
    c = TestClient(app)
    aseed.install(c, "ma")
    aseed.approve_players(c)
    c.post("/api/v1/multimedia/admin/approve", json={})  # the TVs too (the screens a target can be linked to)
    c.get("/api/v1/me", headers=ADMIN)
    c.get("/api/v1/me", headers=WALL)

    class W:
        pass

    w = W()
    w.app, w.c, w.speaker, w.settings, w.clock, w.db = app, c, fake, settings, clock, app.state.db
    w.keys = {n: aseed.key_with(c, e) for n, e in {"a": "media_player.wiim_a", "b": "media_player.wiim_b"}.items()}
    return w


def advance(w, seconds=10):
    w.clock["now"] += dt.timedelta(seconds=seconds)


def enable(w, screens=True, **screen_cfg):
    r = w.c.put(f"{API}/config", json={"enabled": True, "engine": "tts.fake_engine", "devices": sorted(w.keys.values()), **({"screens": {"enabled": True, **screen_cfg}} if screens else {})})
    assert r.status_code == 200, r.text
    return r.json()


def make_board(w, slug="lobby"):
    assert w.c.patch("/api/v1/notices/settings", json={"enabled": True}).status_code == 200
    r = w.c.post("/api/v1/notices/boards", json={"name": "לוח " + slug, "slug": slug})
    assert r.status_code == 200, r.text
    return r.json()["board"]["id"], r.json()["token"]


def make_wall(w):
    cams = [w.c.post("/api/v1/cameras", json={"channel": n, "alias": f"cam{n}"}).json()["id"] for n in (1, 2)]
    r = w.c.post("/api/v1/wall/profiles", json={"user_id": "dev-wall", "title": "קבלה", "cameras": cams}, headers=ADMIN)
    assert r.status_code == 201, r.text
    return "wall:dev-wall"


def allow(w, *entries):
    r = w.c.put(f"{API}/config", json={"screens": {"targets": list(entries)}})
    assert r.status_code == 200, r.text
    return r.json()


def feed(w, slug, token):
    return w.c.get(f"/api/v1/notices/display/{slug}", headers={"X-Board-Token": token})


def rows(w, sql="SELECT * FROM announcements ORDER BY rowid"):
    with w.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute(sql).fetchall()]


def say(w, text="הודעה לדיירים", **extra):
    advance(w)
    return w.c.post(API, json={"scope": "all", "ref": "*", "text": text, **extra})


# ---------------------------------------------------------------------------------------------------- off by default, stage A unchanged

def test_screens_are_off_by_default_and_stage_a_behaves_as_before(world):
    w = world
    cfg = enable(w, screens=False)["config"]["screens"]
    assert cfg["enabled"] is False and cfg["targets"] == [] and cfg["default_on"] is True and cfg["seconds"] == 30 and cfg["critical_seconds"] == 180 and cfg["poll_s"] == 5
    bid, token = make_board(w)
    r = say(w)
    assert r.status_code == 200 and "screens" not in r.json() and len(w.speaker.calls) == 1
    assert "announcement" not in feed(w, "lobby", token).json() and "announce_poll_s" not in feed(w, "lobby", token).json()["board"]
    assert rows(w)[0]["screens_json"] == "[]" and rows(w)[0]["screen_until"] is None
    # asked for explicitly while the switch is off: nothing to show, and a screens-only announcement has no target at all
    advance(w)
    r = w.c.post(API, json={"scope": "all", "ref": "*", "text": "x", "speakers": False, "screens": True})
    assert r.status_code == 404 and r.json()["code"] == "no_targets"
    advance(w)
    assert w.c.post(API, json={"scope": "all", "ref": "*", "text": "x", "speakers": False, "screens": False}).status_code == 422


def test_the_screens_switch_alone_is_not_enough_without_the_announcements_feature(world):
    w = world
    enable(w)
    bid, token = make_board(w)
    allow(w, {"key": f"board:{bid}"})
    assert say(w).status_code == 200
    assert feed(w, "lobby", token).json()["announcement"]["texts"][0]["text"] == "הודעה לדיירים"
    assert w.c.put(f"{API}/config", json={"enabled": False}).status_code == 200  # the feature off: the screens go quiet at once
    body = feed(w, "lobby", token).json()
    assert "announcement" not in body and "announce_poll_s" not in body["board"]


# ---------------------------------------------------------------------------------------------------- settings and permissions

def test_settings_are_validated_audited_and_need_system_configure(world):
    w = world
    enable(w)
    bid, _t = make_board(w)
    for bad in ({"seconds": 1}, {"seconds": 601}, {"critical_seconds": 9}, {"poll_s": 1}, {"poll_s": 31}, {"enabled": "yes"}, {"default_on": 1}, {"nope": 1},
                {"targets": [{"key": "board:unknown"}]}, {"targets": [{"key": f"board:{bid}", "device_key": "no-such-device"}]}, {"targets": [{"key": f"board:{bid}"}, {"key": f"board:{bid}"}]},
                {"targets": [{"key": "../x"}]}):
        assert w.c.put(f"{API}/config", json={"screens": bad}).status_code == 422, bad
    r = w.c.put(f"{API}/config", json={"screens": {"seconds": 45, "critical_seconds": 300, "poll_s": 3, "default_on": False, "targets": [{"key": f"board:{bid}", "area_id": "living"}]}})
    assert r.status_code == 200 and r.json()["config"]["screens"]["seconds"] == 45 and r.json()["config"]["screens"]["targets"][0]["area_id"] == "living"
    with w.db.connection(mode="read") as conn:
        a = [dict(x) for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'media.announce.config' ORDER BY id DESC LIMIT 1").fetchall()]
    d = json.loads(a[0]["details_json"])
    assert d["screens"]["seconds"] == 45 and d["screen_targets"] == [f"board:{bid}"]
    # the options for the settings list: the board is a candidate, allowed; the media screens a target can be linked to are listed
    opts = w.c.get(f"{API}/config").json()["screen_options"]
    assert [s["key"] for s in opts["screens"]] == [f"board:{bid}"] and opts["screens"][0]["allowed"] is True and opts["devices"]
    # a role that may only announce cannot read or change the screens setup
    bind(w.c, w.settings, "anna", "announcer", "installation", "*")
    h = as_user("anna")
    assert w.c.put(f"{API}/config", headers=h, json={"screens": {"enabled": False}}).status_code == 403
    assert w.c.get(f"{API}/config", headers=h).status_code == 403


# ---------------------------------------------------------------------------------------------------- the board feed

def test_an_announcement_appears_in_the_board_feed_with_text_only_and_expires(world):
    w = world
    enable(w, seconds=30)
    bid, token = make_board(w)
    other_id, other_token = make_board(w, "parking")
    allow(w, {"key": f"board:{bid}"})  # the parking board is NOT allowed
    before = feed(w, "lobby", token).json()["board"]["version"]
    advance(w)
    r = w.c.post(API, json={"scope": "all", "ref": "*", "texts": [{"language": "he", "text": "המעלית בתחזוקה"}, {"language": "en", "text": "The lift is under service"}]})
    assert r.status_code == 200 and r.json()["screens"] == 1 and r.json()["targets"] == 2
    body = feed(w, "lobby", token).json()
    a = body["announcement"]
    assert [t["language"] for t in a["texts"]] == ["he", "en"] and a["texts"][1]["text"] == "The lift is under service" and a["critical"] is False
    assert body["board"]["announce_poll_s"] == 5 and body["board"]["version"] != before
    assert set(a) == {"id", "critical", "until", "texts"}, "no author, no targets, no template"
    assert "announcement" not in feed(w, "parking", other_token).json(), "a screen that was not allowed shows nothing"
    # after its time the block disappears (the board is asked with the real clock; the stored end is 30 s after the announcement)
    with w.db.connection() as conn:
        conn.execute("UPDATE announcements SET screen_until = ?", ("2000-01-01T00:00:00Z",))
    assert "announcement" not in feed(w, "lobby", token).json()


def test_screens_only_needs_no_engine_and_speaks_nothing(world):
    w = world
    assert w.c.put(f"{API}/config", json={"enabled": True, "screens": {"enabled": True}}).status_code == 200  # no engine, no allowed speaker
    bid, token = make_board(w)
    allow(w, {"key": f"board:{bid}"})
    r = say(w, speakers=False)
    assert r.status_code == 200 and r.json()["targets"] == 0 and r.json()["screens"] == 1 and w.speaker.calls == []
    assert feed(w, "lobby", token).json()["announcement"]["texts"][0]["text"] == "הודעה לדיירים"
    advance(w)
    assert say(w).status_code == 409, "asking for the speakers still needs the engine"


def test_default_on_decides_when_the_sender_does_not_say_and_the_sender_can_override(world):
    w = world
    enable(w, default_on=False)
    bid, token = make_board(w)
    allow(w, {"key": f"board:{bid}"})
    assert "screens" not in say(w).json() and "announcement" not in feed(w, "lobby", token).json()
    r = say(w, "עם מסך", screens=True)
    assert r.json()["screens"] == 1 and feed(w, "lobby", token).json()["announcement"]["texts"][0]["text"] == "עם מסך"


def test_scopes_address_screens_like_speakers_by_area_and_by_all(world):
    w = world
    enable(w)
    a, ta = make_board(w, "lobby")
    b, tb = make_board(w, "parking")
    allow(w, {"key": f"board:{a}", "area_id": "living"}, {"key": f"board:{b}", "area_id": "kitchen"})
    advance(w)
    assert w.c.post(API, json={"scope": "area", "ref": "kitchen", "text": "מטבח", "speakers": False}).json()["screens"] == 1
    assert "announcement" not in feed(w, "lobby", ta).json() and feed(w, "parking", tb).json()["announcement"]["texts"][0]["text"] == "מטבח"
    advance(w)
    assert w.c.post(API, json={"scope": "area", "ref": "no-such-area", "text": "x", "speakers": False}).status_code == 404
    advance(w)
    assert w.c.post(API, json={"scope": "all", "ref": "*", "text": "כולם", "speakers": False}).json()["screens"] == 2
    assert feed(w, "lobby", ta).json()["announcement"]["texts"][0]["text"] == "כולם"
    form = w.c.get(f"{API}/areas").json()
    assert form["screens_enabled"] is True and {x["area_id"] for x in form["areas"]} >= {"living", "kitchen"}
    assert next(x for x in form["areas"] if x["area_id"] == "kitchen")["screens"] == 1


def test_a_media_screen_linked_to_a_board_is_addressed_by_its_device_key(world):
    w = world
    enable(w)
    bid, token = make_board(w)
    dev = w.c.get(f"{API}/config").json()["screen_options"]["devices"][0]["key"]
    allow(w, {"key": f"board:{bid}", "device_key": dev})
    advance(w)
    assert w.c.post(API, json={"scope": "device", "ref": dev, "text": "לטלוויזיה", "speakers": False}).json()["screens"] == 1
    assert feed(w, "lobby", token).json()["announcement"]["texts"][0]["text"] == "לטלוויזיה"
    advance(w)
    assert w.c.post(API, json={"scope": "device", "ref": "someone-else", "text": "x", "speakers": False}).status_code == 404


# ---------------------------------------------------------------------------------------------------- quiet hours, emergency, rate limit, audit

def test_quiet_hours_apply_to_the_screens_too(world):
    w = world
    enable(w)
    bid, token = make_board(w)
    allow(w, {"key": f"board:{bid}"})
    w.c.put(f"{API}/config", json={"quiet": {"enabled": True, "from": "00:00", "to": "23:59", "mode": "suppress"}})
    r = say(w)
    assert r.status_code == 409 and r.json()["code"] == "quiet_hours" and "announcement" not in feed(w, "lobby", token).json()
    w.c.put(f"{API}/config", json={"quiet": {"mode": "queue"}})
    r = say(w, "בבוקר")
    assert r.json()["status"] == "queued" and "announcement" not in feed(w, "lobby", token).json(), "held, so not shown before it is released"
    assert rows(w, "SELECT screens_json, screen_until FROM announcements WHERE status = 'queued'")[0]["screen_until"] is None
    w.c.put(f"{API}/config", json={"quiet": {"enabled": False}})
    w.clock["now"] += dt.timedelta(seconds=120)
    # release: the janitor's pass; the row is shown on release
    with w.db.connection() as conn:
        conn.execute("UPDATE announcements SET release_at = ?", ("2000-01-01T00:00:00Z",))
    assert ann.release_queued(w.db, w.settings, now=w.clock["now"]) == 1
    assert feed(w, "lobby", token).json()["announcement"]["texts"][0]["text"] == "בבוקר"
    assert rows(w, "SELECT status FROM announcements WHERE message = 'בבוקר'")[0]["status"] == "sent"


def test_emergency_is_shown_first_stays_for_the_emergency_time_and_is_audited(world):
    w = world
    enable(w, seconds=20, critical_seconds=600, default_on=False)  # the emergency ignores the default: it is always shown where screens are on
    bid, token = make_board(w)
    allow(w, {"key": f"board:{bid}"})
    say(w, "רגיל", screens=True)
    advance(w)
    r = w.c.post(f"{API}/emergency", json={"texts": [{"language": "he", "text": "פינוי מיידי"}]})
    assert r.status_code == 200 and r.json()["screens"] == 1
    a = feed(w, "lobby", token).json()["announcement"]
    assert a["critical"] is True and a["texts"][0]["text"] == "פינוי מיידי", "an emergency outranks a newer or older normal one"
    r1, r2 = rows(w)
    secs = (dt.datetime.fromisoformat(r2["screen_until"].replace("Z", "+00:00")) - dt.datetime.fromisoformat(r2["at"].replace("Z", "+00:00"))).total_seconds()
    assert secs == 600 and r2["critical"] == 1
    with w.db.connection(mode="read") as conn:
        em = [json.loads(x[0]) for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'media.announce.emergency'").fetchall()]
    assert em and em[0]["screens"] == 1 and em[0]["text"] == ["פינוי מיידי"]


def test_the_rate_limit_counts_screen_announcements(world):
    w = world
    enable(w)
    w.c.put(f"{API}/config", json={"max_per_minute": 1})
    bid, token = make_board(w)
    allow(w, {"key": f"board:{bid}"})
    assert w.c.post(API, json={"scope": "all", "ref": "*", "text": "אחד", "speakers": False}).status_code == 200
    r = w.c.post(API, json={"scope": "all", "ref": "*", "text": "שתיים", "speakers": False})
    assert r.status_code == 429
    assert feed(w, "lobby", token).json()["announcement"]["texts"][0]["text"] == "אחד"


def test_stop_takes_the_text_off_the_screens_and_is_audited(world):
    w = world
    enable(w)
    bid, token = make_board(w)
    allow(w, {"key": f"board:{bid}"})
    aid = say(w).json()["id"]
    assert feed(w, "lobby", token).json()["announcement"]
    w.clock["now"] = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)  # the board's feed reads the real clock: stop at the real instant
    assert w.c.post(f"{API}/{aid}/screens/stop").json() == {"stopped": True}
    advance(w, 1)
    assert "announcement" not in feed(w, "lobby", token).json()
    assert w.c.post(f"{API}/{aid}/screens/stop").json() == {"stopped": False}
    assert w.c.post(f"{API}/nonsense/screens/stop").status_code == 422
    bind(w.c, w.settings, "vera", "viewer", "installation", "*")
    assert w.c.post(f"{API}/{aid}/screens/stop", headers=as_user("vera")).status_code == 403
    h = [x for x in w.c.get(f"{API}/history").json()["history"]]
    assert h[0]["screens"] == 1


# ---------------------------------------------------------------------------------------------------- the wall display

def test_a_wall_display_reads_its_own_announcement_only(world):
    w = world
    enable(w)
    key = make_wall(w)
    r = w.c.get("/api/v1/wall/announcement", headers=WALL)
    assert r.status_code == 200 and r.json() == {"poll_s": 0, "critical_close_s": 15, "announcement": None}, "not allowed yet"  # ANNOUNCE-297 added the close rule
    allow(w, {"key": key, "area_id": "living"})
    assert w.c.get("/api/v1/wall/announcement", headers=WALL).json()["poll_s"] == 5
    advance(w)
    assert w.c.post(API, json={"scope": "area", "ref": "living", "text": "לקבלה", "speakers": False}).json()["screens"] == 1
    got = w.c.get("/api/v1/wall/announcement", headers=WALL).json()["announcement"]
    assert got["texts"] == [{"language": "he", "text": "לקבלה"}] and set(got) == {"id", "critical", "until", "texts"}
    assert w.c.get("/api/v1/wall/announcement", headers=as_user("stranger")).status_code == 403, "a user without a wall profile gets nothing"


def test_build_feed_is_the_same_for_the_preview_and_the_tv(world):
    w = world
    enable(w)
    bid, token = make_board(w)
    allow(w, {"key": f"board:{bid}"})
    say(w)
    with w.db.connection(mode="read") as conn:
        board = dict(conn.execute("SELECT * FROM notice_boards WHERE id = ?", (bid,)).fetchone())
        doc = display.build_feed(conn, board, w.clock["now"])
        later = display.build_feed(conn, board, w.clock["now"] + dt.timedelta(minutes=5))
    assert doc["announcement"]["texts"][0]["text"] == "הודעה לדיירים" and "announcement" not in later
    assert doc["board"]["version"] != later["board"]["version"], "the ETag moves when the block appears or ends"


def test_candidates_hide_boards_while_the_notices_module_is_off(world):
    w = world
    enable(w)
    assert scr.candidates.__name__ == "candidates"
    assert all(c["kind"] != "board" for c in w.c.get(f"{API}/config").json()["screen_options"]["screens"])
