"""CAST-RELAY-HARDEN-2540 (deep review V-05): a running cast - a permanent one in particular - ends when its user loses the rights it
was started with. Every janitor round re-checks `video.live` on the camera, `media.cast` at the screen's anchor, the camera itself
(gone / disabled) and the user (disabled on either side, a Home Assistant user dropped from the directory included); a failure ends
the session `access_lost` with ONE stop and the token revoked. Against the fakes of test_cast_sessions.py (the synthetic media
installation, a fake go2rtc behind the real relay on 127.0.0.1, a fake bridge); nothing real is contacted."""
from __future__ import annotations

import httpx
import pytest
from conftest import as_user, bind
from test_cast_sessions import API, World

from smplwise.db import new_id, now_iso, permission_revision
from smplwise.services import cast_relay as cr
from smplwise.services import cast_sessions as cs

QUIET = {"timeout": 0, "target_gone": 0, "not_confirmed": 0}


@pytest.fixture()
def w(settings, monkeypatch):
    world = World(settings, monkeypatch)
    world.ready()
    world.allow(world.living, permanent=True)
    bind(world.c, world.settings, "olga", "operator", "installation", "*")
    yield world
    cr.SERVER.stop()
    cr.INDEX.clear()


def _permanent(w, camera: str = "cam1") -> tuple[str, str]:
    r = w.start(w.living, camera=camera, duration="permanent", headers=as_user("olga"))
    assert r.status_code == 202, r.text
    s = r.json()["session"]
    assert s["permanent"] is True
    return s["session_id"], w.plays()[-1]["url"]


def _sql(w, sql: str, args: tuple = ()) -> None:
    with w.app.state.db.connection() as conn:
        conn.execute(sql, args)


def _deny_camera(w, user: str, camera: str) -> None:
    with w.app.state.db.connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES (?, 'user', ?, 'operator', 'camera', ?, 'deny', ?, 'test', ?)", (new_id(), f"dev-{user}", camera, permission_revision(conn), now_iso()))


def _stopped(w, sid: str) -> dict:
    return w.c.get(f"{API}/sessions/{sid}").json()


def _lost(w) -> list[str]:
    return [a["details"].get("lost") for a in w.audit("media.cast.stop") if a["reason"] == "access_lost"]


def test_a_cast_whose_user_still_holds_everything_keeps_running(w):
    sid, url = _permanent(w)
    assert w.janitor() == QUIET and w.janitor() == QUIET
    assert [p["op"] for p in w.calls] == ["play"]
    assert httpx.get(url, timeout=5).status_code == 200
    assert _stopped(w, sid)["stopped_at"] is None


def test_the_camera_taken_out_of_the_users_scope_ends_a_permanent_cast(w):
    sid, url = _permanent(w)
    _deny_camera(w, "olga", "cam1")
    counts = w.janitor()
    assert counts.get("access_lost") == 1, counts
    st = _stopped(w, sid)
    assert (st["state"], st["stop_reason"]) == ("stopped", "access_lost")
    assert [p["op"] for p in w.calls] == ["play", "stop"], "ONE stop"
    assert httpx.get(url, timeout=5).status_code == 403, "the token died"
    assert _lost(w) == ["video_live"]
    assert w.janitor() == QUIET and len(w.calls) == 2, "never twice"


def test_losing_media_cast_at_the_screen_ends_the_cast(w):
    sid, _url = _permanent(w)
    _sql(w, "UPDATE bindings SET revoked_at = ? WHERE subject_id = 'dev-olga'", (now_iso(),))
    bind(w.c, w.settings, "olga", "viewer", "installation", "*")  # still watches live video, may no longer cast
    assert w.janitor().get("access_lost") == 1
    assert _stopped(w, sid)["stop_reason"] == "access_lost"
    assert _lost(w) == ["media_cast"]


def test_a_disabled_camera_ends_the_cast(w):
    sid, _url = _permanent(w)
    _sql(w, "UPDATE cameras SET enabled = 0 WHERE id = 'cam1'")
    assert w.janitor().get("access_lost") == 1
    assert _lost(w) == ["camera_disabled"]


def test_a_starter_dropped_from_the_home_directory_ends_the_cast(w):
    """A Home Assistant user absent from the directory push is marked inactive there (ha_store): they hold nothing, their cast ends."""
    sid, _url = _permanent(w)
    _sql(w, "INSERT INTO ha_users(id, name, username, is_active, is_admin, group_ids_json, synced_at) VALUES ('dev-olga', 'olga', 'olga', 0, 0, '[]', ?)", (now_iso(),))
    assert w.janitor().get("access_lost") == 1
    assert _lost(w) == ["user_inactive"]


def test_after_a_switch_the_camera_is_judged_for_whoever_chose_it(w):
    sid, _url = _permanent(w)
    # the administrator (the bootstrap user) switches olga's cast to a camera olga may not watch: it is the administrator's choice
    _deny_camera(w, "olga", "cam2")
    r = w.c.post(f"{API}/sessions/{sid}/switch", json={"camera_id": "cam2"})
    assert r.status_code == 202, r.text
    assert w.janitor() == QUIET, "the switcher holds video.live on cam2"
    # the screen stays the starter's: olga losing media.cast still ends it
    _sql(w, "UPDATE bindings SET revoked_at = ? WHERE subject_id = 'dev-olga'", (now_iso(),))
    assert w.janitor().get("access_lost") == 1
    assert _lost(w) == ["media_cast"]


def test_a_failing_re_check_keeps_the_cast_for_the_next_round(w, monkeypatch):
    sid, url = _permanent(w)

    def boom(conn, row):
        raise RuntimeError("database is busy")

    monkeypatch.setattr(cs, "access_lost", boom)
    assert w.janitor() == QUIET
    assert _stopped(w, sid)["stopped_at"] is None and httpx.get(url, timeout=5).status_code == 200


def test_the_administrators_test_cast_is_judged_by_the_camera_only(w):
    r = w.c.post(f"{API}/test", json={"target_key": w.living, "camera_id": "cam1"})
    assert r.status_code == 202, r.text
    sid = r.json()["session"]["session_id"]
    assert w.janitor() == QUIET
    _sql(w, "UPDATE cameras SET enabled = 0 WHERE id = 'cam1'")
    assert w.janitor().get("access_lost") == 1
    assert _stopped(w, sid)["stop_reason"] == "access_lost"
