"""CR-028 phase 1: the cast relay (services/cast_relay.py) - the add-on's only unauthenticated listener. A fake go2rtc answers the HLS
paths; nothing here reaches a real device, a real go2rtc or the network beyond 127.0.0.1. Every name and id is invented."""
from __future__ import annotations

import time

import httpx
import pytest

from smplwise.services import cast_relay as cr

TOKEN = "a" * 32
STREAM = "smplwise_nvr-1_ch1_sub"
MASTER = b"#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,CODECS=\"avc1.640029\"\nhls/playlist.m3u8?id=Gx01\n"
MEDIA = b"#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-TARGETDURATION:2\n#EXT-X-MAP:URI=\"init.mp4?id=Gx01\"\n#EXTINF:1.0,\nsegment.m4s?id=Gx01&n=1\n"


class FakeGo2rtc:
    def __init__(self, master: bytes = MASTER, media: bytes = MEDIA) -> None:
        self.master, self.media, self.calls = master, media, []

    def __call__(self, path: str, params: dict[str, str]) -> tuple[int, bytes]:
        self.calls.append((path, dict(params)))
        if path == "/api/stream.m3u8":
            return 200, self.master
        if path == "/api/hls/playlist.m3u8":
            return 200, self.media
        if path in ("/api/hls/init.mp4", "/api/hls/segment.m4s", "/api/hls/segment.ts"):
            return 200, b"\x00\x00\x00\x18ftypmp42"
        return 404, b""


@pytest.fixture()
def idx():
    index = cr.Index()
    index.put(TOKEN, "s" * 32, STREAM, time.time() + 600)
    first: list[str] = []
    abuse: list[str] = []
    cr.ON_FIRST_SEGMENT[:] = [first.append]
    cr.ON_ABUSE[:] = [abuse.append]
    yield index, first, abuse
    cr.ON_FIRST_SEGMENT[:] = []
    cr.ON_ABUSE[:] = []


def get(index, path: str, fetch=None, method: str = "GET"):
    return cr.handle(method, path, fetch or FakeGo2rtc(), index=index)


def test_the_whole_hls_chain_is_served_and_the_first_segment_is_the_honest_playing_signal(idx):
    index, first, _ = idx
    g = FakeGo2rtc()
    r = cr.handle("GET", f"/cast/{TOKEN}/index.m3u8", g, index=index)
    assert (r.status, r.content_type) == (200, "application/vnd.apple.mpegurl") and r.body == MASTER
    # the stream name comes from the session, never from the request; fMP4 HLS
    assert g.calls[0] == ("/api/stream.m3u8", {"src": STREAM, "mp4": ""})
    assert cr.handle("GET", f"/cast/{TOKEN}/hls/playlist.m3u8?id=Gx01", g, index=index).status == 200
    assert cr.handle("GET", f"/cast/{TOKEN}/hls/init.mp4?id=Gx01", g, index=index).status == 200
    assert first == [], "init is not a segment"
    r = cr.handle("GET", f"/cast/{TOKEN}/hls/segment.m4s?id=Gx01&n=1", g, index=index)
    assert (r.status, r.content_type) == (200, "video/mp4")
    assert first == ["s" * 32]
    cr.handle("GET", f"/cast/{TOKEN}/hls/segment.m4s?id=Gx01&n=2", g, index=index)
    assert first == ["s" * 32], "reported once"
    assert g.calls[-1] == ("/api/hls/segment.m4s", {"id": "Gx01", "n": "2"})


def test_a_forged_or_revoked_or_expired_token_is_403_and_nothing_is_fetched(idx):
    index, _, _ = idx
    g = FakeGo2rtc()
    assert cr.handle("GET", f"/cast/{'b' * 32}/index.m3u8", g, index=index).status == 403
    index.put("c" * 32, "t" * 32, STREAM, time.time() - 1)  # expired
    assert cr.handle("GET", f"/cast/{'c' * 32}/index.m3u8", g, index=index).status == 403
    index.drop("s" * 32)  # revoked (a stop)
    assert cr.handle("GET", f"/cast/{TOKEN}/index.m3u8", g, index=index).status == 403
    assert g.calls == []
    index.put("d" * 32, "u" * 32, STREAM, None)  # permanent
    assert cr.handle("GET", f"/cast/{'d' * 32}/index.m3u8", g, index=index, now=time.time() + 10 ** 7).status == 200


def test_a_switch_kills_the_old_token_of_the_same_session(idx):
    index, _, _ = idx
    index.put("e" * 32, "s" * 32, "smplwise_nvr-1_ch2_sub", time.time() + 600)
    assert get(index, f"/cast/{TOKEN}/index.m3u8").status == 403
    g = FakeGo2rtc()
    assert cr.handle("GET", f"/cast/{'e' * 32}/index.m3u8", g, index=index).status == 200 and g.calls[0][1]["src"] == "smplwise_nvr-1_ch2_sub"


def test_only_smplwise_streams_can_ever_be_indexed():
    with pytest.raises(ValueError):
        cr.Index().put(TOKEN, "s" * 32, "intercom_door1", None)


@pytest.mark.parametrize("path", [
    "/cast/{t}/index.m3u8?src=intercom_door1",       # no stream-name parameter, ever
    "/cast/{t}/index.m3u8?id=Gx01",                  # the master takes no query
    "/cast/{t}/hls/playlist.m3u8?id=Gx01&src=x",     # unknown key
    "/cast/{t}/hls/segment.m4s?id=Gx01&id=Gx02&n=1",  # a key twice
    "/cast/{t}/hls/segment.m4s?id=Gx%2F01&n=1",      # a value that is not plain
    "/cast/{t}/hls/playlist.m3u8?id=Gx01&n=1",       # the media playlist has no segment number
])
def test_queries_outside_the_allow_list_are_refused(idx, path):
    index, _, _ = idx
    get(index, f"/cast/{TOKEN}/index.m3u8")
    g = FakeGo2rtc()
    assert cr.handle("GET", path.format(t=TOKEN), g, index=index).status == 400
    assert g.calls == []


@pytest.mark.parametrize("path", ["/cast/{t}/../api/streams", "/cast/{t}/hls/../../api/streams", "/api/streams", "/cast/{t}/stream.mp4", "/cast/{t}/hls/frame.jpeg",
                                  "/cast/{t}/index.m3u8/", "/cast/{T}/index.m3u8", "/healthz", "http://evil.test/cast/{t}/index.m3u8", "/cast/{t}/index.m3u8#x"])
def test_paths_outside_the_relay_shape_are_404(idx, path):
    index, _, _ = idx
    g = FakeGo2rtc()
    assert cr.handle("GET", path.format(t=TOKEN, T=TOKEN.upper()), g, index=index).status == 404
    assert g.calls == []


def test_an_hls_session_id_the_master_did_not_name_is_403(idx):
    """A token holder cannot read another HLS session of the shared go2rtc (an intercom stream someone watches over HLS)."""
    index, _, _ = idx
    g = FakeGo2rtc()
    assert cr.handle("GET", f"/cast/{TOKEN}/hls/playlist.m3u8?id=Gx01", g, index=index).status == 403, "before the master named it"
    cr.handle("GET", f"/cast/{TOKEN}/index.m3u8", g, index=index)
    assert cr.handle("GET", f"/cast/{TOKEN}/hls/segment.m4s?id=Other9&n=1", g, index=index).status == 403
    assert all(c[1].get("id") != "Other9" for c in g.calls)


@pytest.mark.parametrize("master", [
    b"#EXTM3U\nhttp://192.0.2.5:1984/api/hls/playlist.m3u8?id=Gx01\n",
    b"#EXTM3U\n/api/hls/playlist.m3u8?id=Gx01\n",
    b"#EXTM3U\nhls/../stream.m3u8?src=intercom\n",
    b"#EXTM3U\nhls/playlist.m3u8?id=Gx01&src=other\n",
    b"#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,URI=\"http://192.0.2.5/x.m3u8\"\nhls/playlist.m3u8?id=Gx01\n",
    b"#EXTM3U\n",
])
def test_a_master_playlist_naming_anything_unexpected_is_a_502(idx, master):
    index, _, _ = idx
    assert get(index, f"/cast/{TOKEN}/index.m3u8", FakeGo2rtc(master=master)).status == 502


@pytest.mark.parametrize("media", [
    b"#EXTM3U\n#EXTINF:1.0,\nhttp://192.0.2.5:1984/api/hls/segment.ts?id=Gx01&n=1\n",
    b"#EXTM3U\n#EXT-X-MAP:URI=\"/api/hls/init.mp4?id=Gx01\"\n",
    b"#EXTM3U\n#EXTINF:1.0,\nsegment.m4s?id=Other9&n=1\n",
    b"#EXTM3U\n#EXTINF:1.0,\n../stream.mp4?src=x\n",
])
def test_a_media_playlist_naming_anything_unexpected_is_a_502(idx, media):
    index, _, _ = idx
    g = FakeGo2rtc(media=media)
    cr.handle("GET", f"/cast/{TOKEN}/index.m3u8", g, index=index)
    assert cr.handle("GET", f"/cast/{TOKEN}/hls/playlist.m3u8?id=Gx01", g, index=index).status == 502


def test_only_get_and_a_bodiless_options_are_answered(idx):
    index, _, _ = idx
    for method in ("POST", "PUT", "DELETE", "PATCH", "HEAD"):
        assert get(index, f"/cast/{TOKEN}/index.m3u8", method=method).status == 405
    g = FakeGo2rtc()
    assert cr.handle("OPTIONS", f"/cast/{TOKEN}/index.m3u8", g, index=index).status == 204 and g.calls == []


def test_a_token_that_asks_too_fast_gets_429_and_a_hammering_one_ends_its_session(idx):
    index, _, abuse = idx
    g = FakeGo2rtc()
    statuses = [cr.handle("GET", f"/cast/{TOKEN}/index.m3u8", g, index=index).status for _ in range(10)]
    assert statuses[:6] == [200] * 6 and 429 in statuses
    for _ in range(cr.ABUSE_LIMIT + 5):
        cr.handle("GET", f"/cast/{TOKEN}/index.m3u8", g, index=index)
    assert abuse == ["s" * 32], "reported once"


def test_upstream_failures_never_pass_through(idx):
    index, _, _ = idx

    def down(path, params):
        return 503, b""

    assert get(index, f"/cast/{TOKEN}/index.m3u8", down).status == 502
    big = FakeGo2rtc(master=b"#EXTM3U\n" + b"#" * (cr.PLAYLIST_MAX + 10))
    assert get(index, f"/cast/{TOKEN}/index.m3u8", big).status == 502


def test_the_origin_probe_answers_once():
    token = cr.new_probe()
    assert cr.handle("GET", f"/cast/probe/{token}", FakeGo2rtc()).status == 204
    assert cr.handle("GET", f"/cast/probe/{token}", FakeGo2rtc()).status == 404
    assert cr.handle("GET", f"/cast/probe/{'f' * 32}", FakeGo2rtc()).status == 404


def test_the_real_listener_on_localhost_with_cors_and_no_store():
    """The threaded listener end to end on 127.0.0.1 (an ephemeral port): what a Cast receiver would see."""
    srv = cr.RelayServer()
    g = FakeGo2rtc()
    assert srv.start(g, host="127.0.0.1", port=0)
    cr.INDEX.put(TOKEN, "s" * 32, STREAM, time.time() + 60)
    try:
        base = f"http://127.0.0.1:{srv.port}"
        r = httpx.get(f"{base}/cast/{TOKEN}/index.m3u8", timeout=5)
        assert r.status_code == 200 and r.headers["access-control-allow-origin"] == "*" and r.headers["cache-control"] == "no-store"
        assert r.headers["content-type"] == "application/vnd.apple.mpegurl" and r.content == MASTER
        assert httpx.post(f"{base}/cast/{TOKEN}/index.m3u8", timeout=5).status_code == 405
        assert httpx.get(f"{base}/cast/{'b' * 32}/index.m3u8", timeout=5).status_code == 403
        assert "server" not in {k.lower() for k in r.headers} or "arx-cast" in r.headers.get("server", "")
    finally:
        cr.INDEX.drop("s" * 32)
        srv.stop()
    assert not srv.running
