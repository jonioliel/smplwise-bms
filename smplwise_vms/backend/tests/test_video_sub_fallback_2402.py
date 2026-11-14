"""VIDEO-SUB-FALLBACK-2402 (owner round 20, Q3 = a): a tile with the automatic quality whose SUB stream gives nothing moves to the MAIN
stream on the same transport (the player decides; frontend/src/components/sw-live-player.ts). The server's part:
- the remote plan of an automatic-quality tile holds the main twin of each planned transport (services/video_transport.py `auto_profile`,
  never a transport of its own; the case-table fixture follows);
- the main socket names why (`fallback=`), from a closed set, and the session's audit rows carry it as `profile_fallback` next to the
  2.40.0 `transport` / `upstream_error` fields; anything else is refused; a sub socket never carries it.
Fakes only (the go2rtc fake and the scripted relay of test_live_h265)."""
from __future__ import annotations

import json

import pytest
from starlette.websockets import WebSocketDisconnect
from test_live_h265 import live  # noqa: F401 - the fixture

from smplwise.routers import media
from smplwise.services import video_transport as vt


def test_the_remote_plan_of_an_automatic_quality_tile_holds_the_main_twin_of_each_transport():
    enc = vt.encode
    assert enc(vt.plan_steps("mse", "remote", "sub", auto_profile=True)) == "sub:mse,main:mse"
    assert enc(vt.plan_steps("auto", "remote", "sub", mse_fallback=True, auto_profile=True)) == "sub:webrtc,sub:mse,main:webrtc,main:mse"
    assert enc(vt.plan_steps("auto", "remote", "sub", mse_fallback=False, auto_profile=True)) == "sub:webrtc,main:webrtc"
    assert enc(vt.plan_steps("webrtc", "remote", "sub", auto_profile=True)) == "sub:webrtc,main:webrtc"
    # an explicit quality (no auto_profile) never gains a profile step it did not have
    assert enc(vt.plan_steps("mse", "remote", "sub")) == "sub:mse"
    # never another transport: every main step's transport is one the sub steps already had
    for choice in vt.CHOICES:
        for fb in (True, False):
            steps = vt.plan_steps(choice, "remote", "sub", mse_fallback=fb, auto_profile=True)
            sub_t = {s["transport"] for s in steps if s["profile"] == "sub"}
            assert {s["transport"] for s in steps if s["profile"] == "main"} <= sub_t


def test_fallback_details_are_a_closed_set_on_a_main_socket_only():
    assert media.profile_fallback_details("main", "sub_no_media") == {"profile_fallback": {"from": "sub", "to": "main", "reason": "sub_no_media"}}
    for r in media.PROFILE_FALLBACKS:
        assert media.profile_fallback_details("main", r)["profile_fallback"]["reason"] == r
    assert media.profile_fallback_details("sub", "sub_no_media") is None
    assert media.profile_fallback_details("main", None) is None
    assert media.profile_fallback_details("main", "anything") is None


def _stop_rows(lv) -> list[dict]:
    with lv.app.state.db.connection(mode="read") as conn:
        return [json.loads(r["details_json"] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action IN ('video.live.start', 'video.live.stop') ORDER BY rowid").fetchall()]


def _open(lv, query: str) -> int | None:
    try:
        with lv.c.websocket_connect(f"/api/v1/media/live/{lv.cam['id']}/ws?{query}") as ws:
            while True:
                ws.receive_text()
    except WebSocketDisconnect as exc:
        return exc.code
    return None


def test_the_main_socket_of_a_fallback_is_audited_with_its_reason(live):  # noqa: F811
    live.codecs("H.264", "H.264")
    _open(live, "profile=main&fallback=sub_no_media")
    rows = _stop_rows(live)
    assert len(rows) == 2, rows
    for row in rows:
        assert row["profile_fallback"] == {"from": "sub", "to": "main", "reason": "sub_no_media"}
    assert "transport" in rows[1], "next to the 2.40.0 fields of the stop row"
    _open(live, "profile=sub")
    assert all("profile_fallback" not in r for r in _stop_rows(live)[2:]), "an ordinary socket names no fallback"


@pytest.mark.parametrize("bad", ["main", "sub_no_media;drop", "x" * 40])
def test_an_unknown_fallback_value_is_refused(live, bad):  # noqa: F811
    live.codecs("H.264", "H.264")
    before = len(_stop_rows(live))
    _open(live, f"profile=main&fallback={bad}")
    assert len(_stop_rows(live)) == before, "no session was started"
