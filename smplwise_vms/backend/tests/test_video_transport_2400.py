"""VIDEO-TRANSPORT-2400 (owner decisions 2026-11-04): one server-side decision of the live-video transport.

- the pure policy (services/video_transport.py): every installation choice x personal choice x channel x remote.mse_fallback x
  profile x surface - an explicit choice plans its one transport only, `auto` is the only choice with two, the personal choice wins
  over the installation's; the case table the frontend's mirror is checked against (contracts/fixtures/video_transport/
  policy_cases.json) is exactly what the module computes;
- GET /media/video-policy and the personal `video.transport` of /me/prefs (precedence, reset, per-user isolation, closed values);
- the stations drawer's read carries the same decision per offered profile (`video.transport.plans`);
- the live session's stop row explains a session that ended at once (services/live_diag.py: the transport go2rtc answered, the first
  media byte, go2rtc's error frame - sanitized, never the source);
- the WisKey leased stream stays idle for the re-open grace after the station's last viewer and a re-open within it renews the
  registration from a fresh lease without a new go2rtc registration; a refused lease retires the idle stream.

Fakes only (go2rtc's HTTP mock and a scripted relay as in test_intercom_media); nothing contacts a station, WisKey or go2rtc."""
from __future__ import annotations

import itertools
import json
import pathlib
import time

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from test_intercom import camera_feed, fake_go2rtc, feed  # noqa: F401 - fixtures
from test_intercom_media import LIVE, MEDIA, SECRETS, audit_rows, fake_provider, mode, scripted_relay  # noqa: F401 - fixtures

from smplwise.main import create_app
from smplwise.routers import media
from smplwise.services import intercom_media as im
from smplwise.services import live_diag
from smplwise.services import video_transport as vt

FIXTURE = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "fixtures" / "video_transport" / "policy_cases.json"
POLICY = "/api/v1/media/video-policy"
CHOICES = ("auto", "webrtc", "mse")


# ---------------------------------------------------------------- the pure policy

@pytest.mark.parametrize("installation,personal", list(itertools.product((*CHOICES, None, "bogus"), (None, *CHOICES, "bogus"))))
def test_the_personal_choice_wins_then_the_installation_then_auto(installation, personal):
    choice, source = vt.effective_choice(installation, personal)
    if personal in CHOICES:
        assert (choice, source) == (personal, "personal")
    elif installation in CHOICES:
        assert (choice, source) == (installation, "installation")
    else:
        assert (choice, source) == ("auto", "default")


def _all_plans():
    surfaces = [
        {},
        {"auto_profile": True},
        {"single_profile": True},
        {"single_profile": True, "offered": {"main": ["mse", "webrtc"], "sub": ["mse", "webrtc"]}},
        {"webrtc_ok": {"main": False, "sub": True}},
        {"webrtc_ok": {"main": True, "sub": True}},
    ]
    for choice, channel, fallback, profile, opts in itertools.product(CHOICES, vt.CHANNELS, (True, False), vt.PROFILES, surfaces):
        yield choice, channel, fallback, profile, opts, vt.plan_steps(choice, channel, profile, mse_fallback=fallback, **opts)


def test_an_explicit_choice_plans_its_one_transport_on_every_channel_and_surface():
    seen = 0
    for choice, channel, fallback, profile, opts, steps in _all_plans():
        kinds = {s["transport"] for s in steps}
        if choice != "auto":
            assert kinds <= {choice}, (choice, channel, fallback, profile, opts, steps)
            if not opts.get("webrtc_ok"):
                assert steps and steps[0] == {"profile": profile, "transport": choice}, "the viewer's profile first, on the chosen transport"
        else:
            assert steps[0]["transport"] == "webrtc" or (channel == "remote" and opts.get("webrtc_ok", {}).get(profile) is False)
        seen += 1
    assert seen == 3 * 2 * 2 * 2 * 6


def test_remote_mse_only_is_mse_only_whatever_the_remote_fallback():
    """Lab audit finding 1: on /arx/ the explicit MSE choice was planned WebRTC first."""
    for fallback in (True, False):
        for profile in vt.PROFILES:
            assert vt.plan_steps("mse", "remote", profile, mse_fallback=fallback) == [{"profile": profile, "transport": "mse"}]
            assert vt.transport_order("mse", "remote", fallback) == ["mse"]


def test_the_documented_order_of_auto():
    assert vt.transport_order("auto", "local") == ["webrtc", "mse"]
    assert vt.transport_order("auto", "remote", "true") == ["webrtc", "mse"]
    assert vt.transport_order("auto", "remote", "false") == ["webrtc"]
    assert vt.encode(vt.plan_steps("auto", "local", "sub")) == "sub:webrtc,sub:mse"
    assert vt.encode(vt.plan_steps("auto", "local", "sub", auto_profile=True)) == "sub:webrtc,sub:mse,main:mse,main:webrtc"
    assert vt.encode(vt.plan_steps("auto", "remote", "main", mse_fallback=True)) == "main:webrtc,main:mse"
    assert vt.encode(vt.plan_steps("auto", "remote", "main", mse_fallback=False)) == "main:webrtc,sub:webrtc"
    assert vt.encode(vt.plan_steps("webrtc", "remote", "main", webrtc_ok={"main": False, "sub": True})) == "sub:webrtc"
    assert vt.encode(vt.plan_steps("webrtc", "remote", "main", webrtc_ok={"main": False, "sub": False})) == "none"


def test_a_station_never_changes_profile_and_never_substitutes_a_transport():
    offered = {"main": ["mse"]}
    assert vt.plan_steps("auto", "local", "main", single_profile=True, offered=offered) == [{"profile": "main", "transport": "mse"}]
    assert vt.plan_steps("webrtc", "local", "main", single_profile=True, offered=offered) == [], "WebRTC only, not offered: nothing"
    assert vt.plan_steps("webrtc", "remote", "main", single_profile=True) == [{"profile": "main", "transport": "webrtc"}]
    both = {"main": ["mse", "webrtc"], "sub": ["webrtc", "mse"]}
    for choice in ("mse", "webrtc"):
        for channel in vt.CHANNELS:
            assert vt.plan_steps(choice, channel, "sub", single_profile=True, offered=both) == [{"profile": "sub", "transport": choice}]


def test_the_case_table_fixture_is_what_the_policy_computes():
    """The frontend's mirror (api/video-policy.ts planSteps) is checked against the same file (tests/unit-video-transport-2400.spec.ts).
    Regenerate: one compact JSON object per line of `video_transport.case_table()` (the file's own layout)."""
    table = vt.case_table()
    assert len(table) == 4 * 4 * 3 * 2 * 5
    assert json.loads(FIXTURE.read_text(encoding="utf-8")) == table
    for row in table:
        if row["choice"] != "auto" and row["plan"] != "none":
            assert {p.split(":")[1] for p in row["plan"].split(",")} == {row["choice"]}, row


def test_the_policy_shape():
    p = vt.policy("mse", None, "remote", {"remote.mse_fallback": "false", "remote.default_profile": "sub"})
    assert p == {"choice": "mse", "source": "installation", "explicit": True, "installation": "mse", "personal": None, "channel": "remote",
                 "order": ["mse"], "label": "MSE בלבד", "remote": {"default_profile": "sub", "mse_fallback": False}}
    assert vt.policy(None, "webrtc", "local")["remote"] is None and vt.policy(None, "webrtc", "elsewhere")["channel"] == "local"


# ---------------------------------------------------------------- the route and the personal choice

def test_the_route_follows_the_installation_then_the_personal_choice(client: TestClient):
    body = client.get(POLICY).json()
    assert (body["choice"], body["source"], body["order"], body["channel"]) == ("auto", "installation", ["webrtc", "mse"], "local")
    assert client.patch("/api/v1/settings", json={"media.transport_default": "mse"}).status_code == 200
    body = client.get(POLICY).json()
    assert (body["choice"], body["source"], body["order"], body["explicit"]) == ("mse", "installation", ["mse"], True)
    r = client.put("/api/v1/me/prefs", json={"video.transport": "webrtc"})
    assert r.status_code == 200 and r.json()["prefs"]["video.transport"] == "webrtc" and "video.transport" in r.json()["stored"]
    body = client.get(POLICY).json()
    assert (body["choice"], body["source"], body["personal"], body["installation"]) == ("webrtc", "personal", "webrtc", "mse")
    assert client.put("/api/v1/me/prefs", json={"video.transport": None}).json()["prefs"]["video.transport"] is None
    assert client.get(POLICY).json()["choice"] == "mse", "reset: back to the installation's choice"


def test_the_personal_choice_is_closed_and_per_user(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")  # the bootstrap administrator
    bind(c, settings, "dana", "viewer", "installation", "*")
    for bad in ("hls", "", "WEBRTC ONLY", 1, True):
        assert c.put("/api/v1/me/prefs", json={"video.transport": bad}).status_code == 422, bad
    assert c.put("/api/v1/me/prefs", headers=as_user("dana"), json={"video.transport": "mse"}).status_code == 200
    assert c.get(POLICY, headers=as_user("dana")).json()["choice"] == "mse"
    assert c.get(POLICY).json()["choice"] == "auto", "dana's choice is hers only"
    assert c.get(POLICY, headers=as_user("guest")).status_code == 200, "any signed-in caller reads its own policy (it grants nothing)"


def test_the_remote_policy_reads_the_remote_settings(settings):
    from smplwise.db import Database
    from smplwise.rbac import Principal

    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    assert c.patch("/api/v1/settings", json={"media.transport_default": "auto", "remote.mse_fallback": "false"}).status_code == 200
    with Database(settings.db_path).connection(mode="read") as conn:
        uid = conn.execute("SELECT id FROM users ORDER BY rowid LIMIT 1").fetchone()["id"]
        principal = Principal(user_id=uid, username="joni", display_name="Joni", source="remote")
        remote = media.video_policy_for(conn, principal, "remote")
        local = media.video_policy_for(conn, principal, "local")
    assert remote["order"] == ["webrtc"] and remote["remote"] == {"default_profile": "main", "mse_fallback": False}
    assert local["order"] == ["webrtc", "mse"] and local["remote"] is None, "remote.mse_fallback shapes the remote channel only"


# ---------------------------------------------------------------- the stations drawer

def test_the_station_read_carries_the_plan_of_each_profile(feed, fake_go2rtc, fake_provider):  # noqa: F811
    c, s = camera_feed(feed)
    mode(c, "video")
    t = c.get(MEDIA.format("entry-a")).json()["video"]["transport"]
    assert t["choice"] == "auto" and t["plans"] == {"sub": "sub:webrtc,sub:mse", "main": "main:webrtc,main:mse"}, "both profiles, both transports"
    assert c.patch("/api/v1/settings", json={"media.transport_default": "mse"}).status_code == 200
    t = c.get(MEDIA.format("entry-a")).json()["video"]["transport"]
    assert (t["choice"], t["source"], t["plans"]) == ("mse", "installation", {"sub": "sub:mse", "main": "main:mse"}), "MSE only, also the main profile"
    assert c.put("/api/v1/me/prefs", json={"video.transport": "webrtc"}).status_code == 200
    t = c.get(MEDIA.format("entry-a")).json()["video"]["transport"]
    assert (t["choice"], t["source"], t["plans"]) == ("webrtc", "personal", {"sub": "sub:webrtc", "main": "main:webrtc"}), "WebRTC only, also main"


def test_arx_own_station_source_offers_both_transports(feed, fake_go2rtc):  # noqa: F811
    im.set_provider(None)
    im.MEDIA.reset()
    c, s = camera_feed(feed)
    mode(c, "video")
    for choice in CHOICES:
        assert c.patch("/api/v1/settings", json={"media.transport_default": choice}).status_code == 200
        v = c.get(MEDIA.format("entry-a")).json()["video"]
        assert v["profiles"][0]["transports"] == ["mse", "webrtc"]
        assert v["transport"]["plans"]["main"] == ("main:webrtc,main:mse" if choice == "auto" else f"main:{choice}")


# ---------------------------------------------------------------- the session's stop row (lab audit finding 8)

def test_the_stop_row_names_go2rtc_error_sanitized(feed, fake_go2rtc, fake_provider, monkeypatch):  # noqa: F811
    c, s = camera_feed(feed)
    mode(c, "video")
    monkeypatch.setattr(media, "relay_ws", scripted_relay(['{"type":"mse","value":"video/mp4"}', '{"type":"error","value":"streams: dial tcp 192.0.2.10:554: i/o timeout rtsp://door:p@192.0.2.10/Streaming/Channels/101"}'], {}))
    with c.websocket_connect(LIVE.format("entry-a", "sub")) as ws:
        assert json.loads(ws.receive_text())["type"] == "mse"
        assert json.loads(ws.receive_text()) == {"type": "error", "value": "upstream_error"}, "still hidden from the viewer"
    stop = json.loads(audit_rows(s, "video.live.stop")[-1]["details_json"])
    assert stop["transport"] == "mse" and stop["upstream_error"] == "timeout"
    assert "<host>" in stop["upstream_error_text"] and "<url>" in stop["upstream_error_text"]
    assert not any(x in json.dumps(stop) for x in SECRETS)


@pytest.mark.parametrize("raw,code", [
    ("streams: wrong user/pass", "auth"),
    ("dial tcp 10.1.2.3:554: i/o timeout", "timeout"),
    ("dial tcp [fe80::1]:554: connection refused", "refused"),
    ("codecs not matched: video:H265 => video:H264", "codecs"),
    ("RTSP/1.0 453 Not Enough Bandwidth", "busy"),
    ("EOF", "eof"),
    ("something else", "other"),
])
def test_go2rtc_errors_are_classified_and_never_carry_an_address(raw, code):
    assert live_diag.classify(raw) == code
    text = live_diag.sanitize(raw + " rtsp://admin:secret@192.0.2.7/x aa:bb:cc:dd:ee:ff 01ABCDEFGHJKMNPQRSTVWXYZ00")
    for leak in ("192.0.2.7", "10.1.2.3", "fe80::1", "secret", "admin:", "aa:bb:cc", "01ABCDEF"):
        assert leak not in text, (leak, text)
    assert len(live_diag.sanitize("x" * 500)) == live_diag.MAX_TEXT


def test_live_diag_times_and_answers():
    d = live_diag.LiveDiag(now=100.0)
    d.down_text('{"type":"webrtc/answer","value":"v=0"}', now=100.25)
    d.down_bytes(now=101.0)
    d.down_text('{"type":"error","value":"a"}', now=102.0)
    d.down_text('{"type":"error","value":"b"}', now=102.0)
    assert d.details() == {"transport": "webrtc", "answer_ms": 250, "ttff_ms": 1000, "upstream_error": "other", "upstream_error_text": "a", "upstream_errors": 2}
    assert live_diag.LiveDiag().details() == {"transport": None}


# ---------------------------------------------------------------- the WisKey leased stream's re-open grace (lab audit finding 2)

class _Go2rtc:
    def __init__(self) -> None:
        self.registered: list[str] = []
        self.deleted: list[str] = []


@pytest.fixture()
def gset(settings):
    from dataclasses import replace

    return replace(settings, go2rtc_url="http://127.0.0.1:1984")  # never contacted: the go2rtc calls below are fakes


@pytest.fixture()
def go2(monkeypatch):
    from smplwise.services import go2rtc as g2

    box = _Go2rtc()

    def frame_jpeg(self, name, source):
        import hashlib

        with g2._REGISTERED_LOCK:
            g2._REGISTERED[name] = hashlib.sha256(source.encode()).hexdigest()
        box.registered.append(name)
        return b"jpg"

    def discard(self, name, digest=None):
        with g2._REGISTERED_LOCK:
            g2._REGISTERED.pop(name, None)
        box.deleted.append(name)
        return True

    monkeypatch.setattr(g2.Go2rtc, "frame_jpeg", frame_jpeg)
    monkeypatch.setattr(g2.Go2rtc, "discard_leased_stream", discard)
    im._LEASED.clear()
    im.MEDIA.reset()
    yield box
    for _name, rec in list(im._LEASED.items()):
        if rec.timer is not None:
            rec.timer.cancel()
    im._LEASED.clear()
    im.MEDIA.reset()


def test_a_reopen_within_the_grace_reuses_the_registration(go2, gset):
    owner = object()
    src = "rtsp://u:p@192.0.2.10:554/Streaming/Channels/101"
    name = im._register_lease(gset, "entry-a", "main", src, time.time() + 15, owner=owner)
    im.MEDIA.add_viewer("entry-a", "v1", 4)
    im.MEDIA.drop_viewer("entry-a", "v1")
    assert im.release_leased_streams(gset, "entry-a", grace_s=im.REOPEN_GRACE_S) == [], "nothing removed now"
    rec = im._LEASED[name]
    assert rec.idle_until is not None and rec.idle_until - time.time() <= im.REOPEN_GRACE_S and not go2.deleted
    again = im._register_lease(gset, "entry-a", "main", src, time.time() + 15, owner=owner)
    assert again == name and go2.registered == [name], "the fresh lease renewed the registration: no second frame grab"
    assert im._LEASED[name].idle_until is None, "watched again"


def test_the_grace_is_bounded_and_ends_in_a_removal(go2, gset, monkeypatch):
    monkeypatch.setattr(im, "REOPEN_GRACE_S", 0.2)
    name = im._register_lease(gset, "entry-a", "main", "rtsp://u:p@192.0.2.10/x", time.time() + 15, owner=object())
    im.release_leased_streams(gset, "entry-a", grace_s=999)
    assert im._LEASED[name].idle_until - time.time() <= 0.2 + 1e-3, "never longer than REOPEN_GRACE_S"
    deadline = time.time() + 5
    while name in im._LEASED and time.time() < deadline:
        time.sleep(0.05)
    assert name not in im._LEASED and go2.deleted == [name], "the timer retired it after the grace"


def test_a_viewer_keeps_the_stream_and_a_refused_lease_retires_the_idle_one(go2, gset):
    owner = object()
    name = im._register_lease(gset, "entry-a", "main", "rtsp://u:p@192.0.2.10/x", time.time() + 15, owner=owner)
    im.MEDIA.add_viewer("entry-a", "v1", 4)
    assert im.release_leased_streams(gset, "entry-a", grace_s=30) == [] and im._LEASED[name].idle_until is None, "a viewer: no grace, no removal"
    im.MEDIA.drop_viewer("entry-a", "v1")
    im.release_leased_streams(gset, "entry-a", grace_s=30)
    im.MEDIA.add_viewer("entry-a", "v2", 4)  # a new viewer whose lease WisKey refuses
    assert im.retire_idle_streams(gset, "entry-a") == [name] and go2.deleted == [name], "a source WisKey no longer grants is not kept"
    im.MEDIA.drop_viewer("entry-a", "v2")


def test_the_real_discard_refuses_a_name_outside_the_namespace(gset):
    from smplwise.services import go2rtc as g2

    with pytest.raises(ValueError):
        g2.Go2rtc(gset).discard_leased_stream("intercom_door_1", None)
