"""TKFRIGLIVE - live video for Frigate cameras through Frigate's own restream, the NVR system card answering a Frigate recorder
cleanly, and the visible facts of the Frigate event path. FAKE Frigate only (`fixtures/fake_frigate.py`) and a fake go2rtc
(monkeypatched client methods): nothing here talks to a real Frigate, a real go2rtc or a lab device.

What is pinned:
- stream choice uses only names Frigate lists and that belong to the camera (key, `<key>_sub` / `<key>_main`, `live.streams`);
- Arx writes ONLY `smplwise_` streams, never touches a foreign stream, refuses a Frigate stream whose name is also a foreign go2rtc
  stream, refuses go2rtc's own host on 8554, removes its own stale streams by exact name, and is gated by the feature flag and the
  recorder's `restream` switch;
- Frigate stays read-only (only the login is a non-GET);
- `/nvr/system` for a Frigate recorder is 200 `supported: false` with no request to the device;
- the poll is not slowed by a WebSocket that never delivered a review item; `events_health` reports the newest item and staleness."""
from __future__ import annotations

import dataclasses
import sys
import time
from pathlib import Path

import pytest

from smplwise.errors import ApiError
from smplwise.services import autosync
from smplwise.services import go2rtc as g2
from smplwise.services.recorders import frigate as fr
from smplwise.services.recorders import frigate_events as fe
from smplwise.services.recorders import frigate_restream as frs

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_frigate import HOST, PASSWORD, USER, camera_config, settings_for  # noqa: E402
from test_frigate_api import BASE, world  # noqa: E402,F401  (the shared fake-Frigate world fixture)

GO2RTC = "http://go2rtc.test:1984"


# ---------------------------------------------------------------------------------------------- pure choice

def test_pick_uses_only_listed_names_tied_to_the_camera():
    cam = {"key": "cam_front", "enabled": True, "live_streams": []}
    assert frs.pick(cam, {"cam_front"}) == {"main": "cam_front", "sub": "cam_front"}
    assert frs.pick(cam, {"cam_front", "cam_front_sub"}) == {"main": "cam_front", "sub": "cam_front_sub"}
    assert frs.pick(cam, {"cam_front_sub"}) == {"main": "cam_front_sub", "sub": "cam_front_sub"}
    assert frs.pick(cam, {"cam_yard", "intercom_door_1"}) is None, "another camera's or project's stream is never borrowed"
    live = {"key": "cam_front", "enabled": True, "live_streams": ["front_hd", "front_low"]}
    assert frs.pick(live, {"front_hd", "front_low"}) == {"main": "front_hd", "sub": "front_low"}
    assert frs.pick({**cam, "enabled": False}, {"cam_front"}) is None
    assert frs.pick({"key": "..", "enabled": True}, {".."}) is None
    assert frs.pick({**live, "live_streams": ["bad name/../x"]}, {"bad name/../x"}) is None


def test_plan_and_summary_reasons(settings, monkeypatch):
    doc = {"version_ok": True, "restream_streams": ["cam_front"], "summary": {"cameras": [{"key": "cam_front", "enabled": True}, {"key": "cam_yard", "enabled": True}]}}
    s = dataclasses.replace(settings_for(settings), go2rtc_url=GO2RTC)
    # 2.27.3: the add-on flag does not gate live video of an existing Frigate recorder
    monkeypatch.setattr(frs, "flag_on", lambda: False)
    assert frs.live_plan(s, doc) == {"cam_front": {"main": "cam_front", "sub": "cam_front"}}
    assert frs.summary(s, doc)["reason"] == "partial" and frs.summary(s, doc)["flag"] is False
    nogo = dataclasses.replace(s, go2rtc_url=None)
    assert frs.live_plan(nogo, doc) == {} and frs.summary(nogo, doc)["reason"] == "no_go2rtc_url" and frs.summary(nogo, doc)["mode"] == "still"
    monkeypatch.setattr(frs, "flag_on", lambda: True)
    assert frs.live_plan(s, doc) == {"cam_front": {"main": "cam_front", "sub": "cam_front"}}
    sm = frs.summary(s, doc)
    assert (sm["mode"], sm["cameras_live"], sm["cameras_total"], sm["reason"], sm["port"], sm["auth"]) == ("restream", 1, 2, "partial", 8554, "none")
    assert frs.summary(s, {**doc, "restream_streams": []})["reason"] == "no_streams"
    assert frs.summary(s, {**doc, "restream_streams": ["other"]})["reason"] == "no_match"
    off = settings_for(settings, restream="off")
    assert frs.live_plan(off, doc) == {} and frs.summary(off, doc)["reason"] == "off"


def test_the_config_summary_carries_live_stream_names_only():
    cfg = {"cameras": {"cam_front": {**camera_config("cam_front"), "live": {"streams": {"Main": "front_hd", "Sub": "rtsp://user:pw@x/y"}}},
                       "cam_yard": {**camera_config("cam_yard"), "live": {"stream_name": "yard"}}}}
    cams = {c["key"]: c for c in fr.summarize_config(cfg)["cameras"]}
    assert cams["cam_front"]["live_streams"] == ["front_hd"], "a value that is not a plain name (a URL) is dropped"
    assert cams["cam_yard"]["live_streams"] == ["yard"]


# ---------------------------------------------------------------------------------------------- the source URL and its policy

def test_source_url_default_port_and_no_credentials(settings):
    s = dataclasses.replace(settings_for(settings), go2rtc_url=GO2RTC)
    assert frs.source_url(s, "cam_front") == f"rtsp://{HOST}:8554/cam_front"
    s2 = dataclasses.replace(settings_for(settings, restream_port=18554, restream_auth="account"), go2rtc_url=GO2RTC)
    assert frs.source_url(s2, "cam_front") == f"rtsp://{USER}:{PASSWORD}@{HOST}:18554/cam_front"


def test_source_url_refuses_go2rtc_itself_and_bad_names(settings):
    s = dataclasses.replace(settings_for(settings), nvr_host="192.0.2.50", go2rtc_url="http://192.0.2.50:1984")
    with pytest.raises(ApiError) as e:
        frs.source_url(s, "cam_front")
    assert e.value.code == "frigate_restream_refused" and e.value.details["reason"] == "source_not_allowed", "go2rtc's own host on 8554 is its restream"
    ok = dataclasses.replace(s, nvr_extra={**s.nvr_extra, "restream_port": 18554})
    assert frs.source_url(ok, "cam_front").endswith(":18554/cam_front"), "another port on that host (Frigate's mapped restream) is allowed"
    loop = dataclasses.replace(settings_for(settings), nvr_host="127.0.0.1", go2rtc_url=GO2RTC)
    with pytest.raises(ApiError):
        frs.source_url(loop, "cam_front")
    with pytest.raises(ApiError):
        frs.source_url(dataclasses.replace(settings_for(settings), go2rtc_url=GO2RTC), "a/b")


def test_a_name_that_is_also_a_foreign_go2rtc_stream_is_refused():
    check = frs.refuse_foreign("Door_1")
    check({"smplwise_nvr-1_ch1_sub": None, "other": None})
    with pytest.raises(ApiError) as e:
        check({"door_1": None})
    assert e.value.code == "frigate_restream_ambiguous"


def test_turning_on_account_auth_is_a_new_password_destination():
    from smplwise.routers.nvr_connection import _transport

    base = {"scheme": "https", "tls_mode": "pin"}
    assert _transport(base) == _transport({**base, "restream": "auto"})
    assert _transport(base) != _transport({**base, "restream_auth": "account"})
    assert _transport({**base, "restream_auth": "account", "restream_port": 8554}) != _transport({**base, "restream_auth": "account", "restream_port": 9554})


# ---------------------------------------------------------------------------------------------- end to end on the app

class FakeGo2rtc:
    def __init__(self) -> None:
        self.streams: dict[str, list[str]] = {"intercom_door_1": ["rtsp://door"]}
        self.writes: list[str] = []

    def install(self, monkeypatch) -> None:
        store = self

        def list_streams(self):
            return {n: g2.StreamInfo(name=n, sources=list(src), online=False) for n, src in store.streams.items()}

        def ensure_stream(self, name, src, check=None):
            if not name.startswith(g2.STREAM_PREFIX):
                raise ValueError(name)
            listing = list_streams(self)
            if check is not None:
                check(listing)
            existing = store.streams.get(name)
            if existing == [src]:
                return "unchanged"
            store.streams[name] = [src]
            store.writes.append(f"put {name}")
            return "updated" if existing else "created"

        def delete_stream(self, name):
            if not name.startswith(g2.STREAM_PREFIX):
                raise ValueError(name)
            store.streams.pop(name, None)
            store.writes.append(f"delete {name}")

        monkeypatch.setattr(g2.Go2rtc, "list_streams", list_streams)
        monkeypatch.setattr(g2.Go2rtc, "ensure_stream", ensure_stream)
        monkeypatch.setattr(g2.Go2rtc, "delete_stream", delete_stream)


def _on(world, monkeypatch, *, restream=True):
    monkeypatch.setattr(frs, "flag_on", lambda: True)
    world.app.state.settings = dataclasses.replace(world.app.state.settings, go2rtc_url=GO2RTC)  # live video needs Arx's own go2rtc
    world.fake.restream = restream
    assert world.c.get(f"{BASE}/status?refresh=true").status_code == 200  # re-read Frigate: the go2rtc stream list is part of discovery
    go = FakeGo2rtc()
    go.install(monkeypatch)
    return go, dataclasses.replace(world.s, go2rtc_url=GO2RTC)


def _cam(world, key):
    with world.app.state.db.connection(mode="read") as conn:
        return dict(conn.execute("SELECT * FROM cameras WHERE source_ref = ?", (key,)).fetchone())


def test_a_listed_restream_becomes_our_smplwise_stream_and_nothing_else_moves(world, monkeypatch):
    go, s = _on(world, monkeypatch)
    with world.app.state.db.connection() as conn:
        r = autosync.ensure_streams(s, conn, reason="manual")
    front = _cam(world, "cam_front")
    names = [g2.stream_name("nvr-1", front["channel"], p) for p in ("sub", "main")]
    assert r["created"] == 2 and sorted(r["streams"]) == sorted(names) and r["foreign_streams_untouched"] == 1
    assert go.streams[names[0]] == [f"rtsp://{HOST}:8554/cam_front"], "no credential unless restream_auth = account"
    assert go.streams["intercom_door_1"] == ["rtsp://door"] and all(w.split(" ")[1].startswith("smplwise_") for w in go.writes)
    yard = _cam(world, "cam_yard")
    assert g2.stream_name("nvr-1", yard["channel"], "sub") not in go.streams, "a camera without a listed restream stays a still"
    assert world.fake.non_get == ["POST /api/login"], "Frigate stays read-only"
    # the media route: the player gets our stream for the camera with a restream, the still fallback for the other
    from smplwise.routers import media

    assert media.ensure_camera_stream(s, front, "main") == names[1]
    with pytest.raises(ApiError) as e:
        media.ensure_camera_stream(s, yard, "sub")
    assert e.value.code == "live_not_available" and e.value.details["fallback"] == "still"
    # the camera list marks each camera, so the screens open a stream only where one exists
    cams = {c["id"]: c for c in world.get("/api/v1/cameras").json()["cameras"]}
    assert cams[front["id"]]["live_kind"] == "stream" and cams[yard["id"]]["live_kind"] == "still"
    st = world.get(f"{BASE}/status").json()["live"]
    assert (st["mode"], st["cameras_live"], st["cameras_total"], st["reason"]) == ("restream", 1, 2, "partial")


def test_a_restream_that_disappears_removes_only_our_streams(world, monkeypatch):
    go, s = _on(world, monkeypatch)
    with world.app.state.db.connection() as conn:
        autosync.ensure_streams(s, conn, reason="manual")
    world.fake.restream = False
    assert world.c.get(f"{BASE}/status?refresh=true").status_code == 200
    with world.app.state.db.connection() as conn:
        r = autosync.ensure_streams(s, conn, reason="manual")
    assert r["removed"] == 2 and [n for n in go.streams if n.startswith("smplwise_")] == [] and "intercom_door_1" in go.streams


def test_flag_off_does_not_block_an_existing_frigate_recorder(world, monkeypatch):
    go, s = _on(world, monkeypatch)
    monkeypatch.setattr(frs, "flag_on", lambda: False)
    with world.app.state.db.connection() as conn:
        r = autosync.ensure_streams(s, conn, reason="manual")
    assert r["created"] > 0 and any(n.startswith("smplwise_") for n in go.streams)


def test_recorder_switch_off_creates_nothing(world, monkeypatch):
    go, s = _on(world, monkeypatch)
    s = dataclasses.replace(s, nvr_extra={**(s.nvr_extra or {}), "restream": "off"})
    with world.app.state.db.connection() as conn:
        r = autosync.ensure_streams(s, conn, reason="manual")
    assert r["created"] == 0 and go.writes == []


def test_a_colliding_name_is_refused_and_the_run_goes_on(world, monkeypatch):
    go, s = _on(world, monkeypatch)
    go.streams["cam_front"] = ["rtsp://somewhere"]  # the other project has a stream with the same name in Arx's go2rtc
    with world.app.state.db.connection() as conn:
        r = autosync.ensure_streams(s, conn, reason="manual")
    assert r["created"] == 0 and go.writes == [] and go.streams["cam_front"] == ["rtsp://somewhere"]
    from smplwise.routers import media

    with pytest.raises(ApiError) as e:
        media.ensure_camera_stream(s, _cam(world, "cam_front"), "sub")
    assert e.value.code == "frigate_restream_ambiguous"


# ---------------------------------------------------------------------------------------------- the NVR system card

def test_nvr_system_answers_a_frigate_recorder_without_asking_it(world):
    before = len(world.fake.hits)
    r = world.get("/api/v1/nvr/system")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["supported"] is False and d["reason"] == "not_supported_for_recorder" and d["vendor"] == "frigate"
    assert not any(d["can"].values()) and d["disks"] == [] and d["time"] is None
    assert len(world.fake.hits) == before, "nothing was sent to Frigate"
    recs = world.get("/api/v1/cameras").json()["recorders"]
    assert recs == [{"id": "nvr-1", "name": recs[0]["name"], "vendor": "frigate"}]


# ---------------------------------------------------------------------------------------------- events

def test_the_poll_is_not_slowed_by_a_socket_without_review_frames():
    st = fe.FrigateState(ws_state="connected")
    assert fe.poll_interval(st, 10.0) == 10.0
    st.ws_review_frames = 1
    assert fe.poll_interval(st, 10.0) == fe.WS_HEALTHY_POLL_S
    st.ws_state = "down"
    assert fe.poll_interval(st, 10.0) == 10.0


def test_status_shows_the_last_event_seen_and_staleness(world):
    d = world.get(f"{BASE}/status").json()["events"]
    assert d["last_event_seen_at"] is None and d["stored_24h"] == 0 and d["stale"] is False
    world.poll()
    with world.app.state.db.connection(mode="read") as conn:
        h = fe.events_health(conn, "nvr-1", now=fe.state_of("nvr-1").last_poll_ts or time.time())
    assert h["last_event_seen_at"] is not None and h["stored_24h"] == 3 and h["stale"] is False
    stale = fe.events_health(None, "nvr-1", {"last_poll_at": "2026-01-01T00:00:00Z", "poll_interval_s": 10}, now=time.time())  # type: ignore[arg-type]
    assert stale["stale"] is True and stale["last_event_seen_at"] is None
    failed = fe.events_health(None, "nvr-1", {"last_poll_error": "source_unavailable"})  # type: ignore[arg-type]
    assert failed["stale"] is True


# ---------------------------------------------------------------------------------------------- TKHARDEN (2.6.3 delta review F-1, F-3)

def test_f3_review_trust_resets_on_a_websocket_reconnect_and_stale_reads_true_before_the_first_poll():
    import threading
    from types import SimpleNamespace

    st = fe.FrigateState()
    st.ws_review_frames = 7  # trust earned on an earlier connection
    stop = threading.Event()
    seen: list[int] = []

    class Ws:
        def __call__(self, url, **kw):
            return self

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def recv(self, timeout=None):
            seen.append(st.ws_review_frames)
            stop.set()
            raise TimeoutError

    http = SimpleNamespace(websocket_url=lambda: "ws://x", websocket_headers=lambda: {}, websocket_ssl=lambda: None)
    feed = fe.WsFeed(SimpleNamespace(recorder_id="r", http=http), __import__("queue").Queue(), stop, st, Ws())
    feed.run()
    assert seen == [0] and st.ws_review_frames == 0, "a fresh connection starts untrusted"
    assert fe.poll_interval(fe.FrigateState(ws_state="connected", ws_review_frames=0), 10.0) == 10.0
    # a started reader that has not completed a poll yet is stale, not healthy; a stopped one stays "unknown" (not stale)
    assert fe.events_health(None, "r", {"loop_running": True})["stale"] is True  # type: ignore[arg-type]
    assert fe.events_health(None, "r", {"loop_running": False})["stale"] is False  # type: ignore[arg-type]
    fresh = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    assert fe.events_health(None, "r", {"loop_running": True, "last_poll_at": fresh, "poll_interval_s": 10})["stale"] is False  # type: ignore[arg-type]


def test_f1_an_unreachable_frigate_is_retried_with_backoff_once_per_recorder_and_deletes_nothing(world, monkeypatch):
    go, s = _on(world, monkeypatch)
    with world.app.state.db.connection() as conn:
        assert autosync.ensure_streams(s, conn, reason="manual")["created"] == 2
    live = sorted(n for n in go.streams if n.startswith("smplwise_"))
    assert live
    fr.clear_cache()  # a restart: no discovery in memory
    world.fake.down = True
    calls: list[int] = []
    orig = fr.FrigateAdapter.discover

    def counting(self, *a, **kw):
        calls.append(1)
        return orig(self, *a, **kw)

    sleeps: list[float] = []
    monkeypatch.setattr(fr.FrigateAdapter, "discover", counting)
    monkeypatch.setattr(autosync.time, "sleep", lambda x: sleeps.append(x))
    go.writes.clear()
    with world.app.state.db.connection() as conn:
        r = autosync.ensure_streams(s, conn, reason="startup")
    assert len(calls) == len(autosync.FRIGATE_DISCOVERY_BACKOFF_S) == 3, "one discovery sequence for the recorder, not one per camera and profile"
    assert sleeps == [2.0, 6.0]
    assert r["removed"] == 0 and go.writes == [] and sorted(n for n in go.streams if n.startswith("smplwise_")) == live
    # Frigate back: the same run works and a restream that really vanished is still removed
    world.fake.down = False
    with world.app.state.db.connection() as conn:
        assert autosync.ensure_streams(s, conn, reason="startup")["unchanged"] == 2


def test_status_says_why_there_is_no_live_video_when_go2rtc_is_missing(world, monkeypatch):
    monkeypatch.setattr(frs, "flag_on", lambda: False)  # the add-on flag is irrelevant for an existing Frigate recorder
    world.app.state.settings = dataclasses.replace(world.app.state.settings, go2rtc_url=None)
    world.fake.restream = True
    live = world.c.get(f"{BASE}/status?refresh=true").json()["live"]
    assert live["mode"] == "still" and live["reason"] == "no_go2rtc_url" and live["flag"] is False
    cams = world.get("/api/v1/cameras").json()["cameras"]
    assert {c.get("live_kind") for c in cams if c["recorder_id"] == "nvr-1" and c["enabled"]} == {"still"}
