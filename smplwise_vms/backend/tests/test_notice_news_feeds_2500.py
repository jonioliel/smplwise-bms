"""NOTICE-NEWS-FEEDS-2500: compressed feed bodies (gzip / deflate, by header or by magic bytes, with a hard inflated-size cap), the
retired Calcalist address read as its replacement (stored lists and boards, custom addresses untouched), and each source's health
(`last_ok_at`, `last_error`) on the managers' list. Fakes only: no network."""
from __future__ import annotations

import gzip
import json
import logging
import ssl
import zlib

import pytest

from smplwise.db import Database, get_setting, set_setting
from smplwise.services.notices import model, news_sources, sources, store
from smplwise.services.xmlsafe import UnsafeXml

API = "/api/v1"
PUBLIC = "93.184.216.34"
RSS = "<?xml version='1.0' encoding='utf-8'?><rss><channel><item><title>כותרת ראשונה</title></item><item><title>second</title></item></channel></rss>".encode()
OLD = "https://www.calcalist.co.il/GeneralRSS/0,16335,L-8,00.xml"
NEW = "https://www.calcalist.co.il/Integration/StoryRss3674.xml"


class FakeResp:
    def __init__(self, body: bytes, headers: dict[str, str] | None = None, status: int = 200) -> None:
        self.status, self._body, self._h = status, body, headers or {}

    def getheader(self, name):
        return self._h.get(name)

    def read(self, n):
        out, self._body = self._body[:n], self._body[n:]
        return out


class FakeConn:
    def __init__(self, resp: FakeResp) -> None:
        self.resp = resp

    def request(self, method, path, headers=None):
        self.headers = dict(headers or {})

    def getresponse(self):
        return self.resp

    def close(self):
        pass


def _fetch(body: bytes, headers: dict[str, str] | None = None) -> bytes:
    return sources.fetch_feed("https://feeds.example.com/rss", resolve=lambda _h: [PUBLIC], connect=lambda *_a: FakeConn(FakeResp(body, headers)))


def _refused(body: bytes, headers: dict[str, str] | None = None) -> str:
    with pytest.raises(sources.FetchRefused) as ei:
        _fetch(body, headers)
    return ei.value.code


# ---------------------------------------------------------------- compressed bodies

def test_a_gzip_body_with_its_header_is_inflated_and_parsed():
    got = _fetch(gzip.compress(RSS), {"Content-Encoding": "gzip"})
    assert got == RSS
    assert sources.parse_feed(got) == ["כותרת ראשונה", "second"]


def test_gzip_magic_without_a_header_is_inflated_too():
    """The lab case (Walla): `Accept-Encoding: identity` is sent, the server compresses anyway and does not say so."""
    raw = gzip.compress(RSS)
    assert raw[:2] == b"\x1f\x8b"
    with pytest.raises(UnsafeXml):
        sources.parse_feed(raw)  # what the board saw before: the gzip bytes reached the XML parser
    assert sources.parse_feed(_fetch(raw)) == ["כותרת ראשונה", "second"]
    assert _fetch(raw, {"Content-Encoding": "x-gzip"}) == RSS


def test_a_declared_deflate_body_zlib_wrapped_or_raw_is_inflated():
    assert _fetch(zlib.compress(RSS), {"Content-Encoding": "deflate"}) == RSS
    c = zlib.compressobj(9, zlib.DEFLATED, -zlib.MAX_WBITS)  # a raw deflate stream declared as deflate (a common server mistake)
    assert _fetch(c.compress(RSS) + c.flush(), {"Content-Encoding": "deflate"}) == RSS


def test_a_zlib_stream_without_a_header_is_recognised():
    assert _fetch(zlib.compress(RSS)) == RSS


def test_a_plain_body_is_untouched_whatever_the_header_says():
    assert _fetch(RSS) == RSS
    assert _fetch(RSS, {"Content-Encoding": "identity"}) == RSS
    assert _fetch(RSS, {"Content-Encoding": "gzip"}) == RSS  # a gzip header over a plain body: the XML parser judges it


def test_a_decompression_bomb_is_refused_as_size_and_never_inflated_past_the_cap(monkeypatch):
    bomb = gzip.compress(b"\0" * (20 * 1024 * 1024))  # 20 MB of zeros, about 20 KB on the wire
    assert len(bomb) < sources.NEWS_MAX_BYTES
    produced: list[int] = []
    real = zlib.decompressobj

    class Spy:
        def __init__(self, wbits):
            self._d = real(wbits)

        def decompress(self, data, max_length=0):
            assert max_length > 0, "every inflate step is bounded"
            out = self._d.decompress(data, max_length)
            produced.append(len(out))
            return out

        def flush(self, length=zlib.DEF_BUF_SIZE):
            return self._d.flush(length)

        def __getattr__(self, name):
            return getattr(self._d, name)

    monkeypatch.setattr(sources.zlib, "decompressobj", Spy)
    assert _refused(bomb, {"Content-Encoding": "gzip"}) == "size"
    assert _refused(bomb) == "size"  # magic bytes alone
    assert max(produced) <= sources.NEWS_MAX_BYTES + 1


def test_the_inflated_cap_is_inclusive():
    body = b"<rss>" + b"x" * (sources.NEWS_MAX_BYTES - 11) + b"</rss>"
    assert len(body) == sources.NEWS_MAX_BYTES
    assert _fetch(gzip.compress(body)) == body
    assert _refused(gzip.compress(body + b" ")) == "size"


@pytest.mark.parametrize("body,headers", [
    (gzip.compress(RSS)[:-12], None),                      # truncated gzip
    (b"\x1f\x8b" + b"garbage" * 10, None),                 # gzip magic, not gzip
    (RSS, {"Content-Encoding": "br"}),                     # a coding we cannot read
    (RSS, {"Content-Encoding": "zstd"}),
    (gzip.compress(gzip.compress(RSS)), {"Content-Encoding": "gzip, gzip"}),  # more than one layer
    (b"not deflate at all", {"Content-Encoding": "deflate"}),
])
def test_broken_or_unknown_encodings_are_refused(body, headers):
    assert _refused(body, headers) == "encoding"


def test_the_compressed_body_keeps_the_wire_cap_and_the_other_guards():
    big = gzip.compress(bytes(range(256)) * 4096, compresslevel=0)  # incompressible-ish, > 512 KB on the wire
    assert len(big) > sources.NEWS_MAX_BYTES
    assert _refused(big) == "size"
    with pytest.raises(sources.FetchRefused) as ei:  # the SSRF guard still runs before any connection
        sources.fetch_feed("https://feeds.example.com/rss", resolve=lambda _h: ["10.0.0.5"], connect=lambda *_a: pytest.fail("connected"))
    assert ei.value.code == "address"


def test_the_request_still_asks_for_identity():
    seen: dict[str, str] = {}

    def connect(*_a):
        c = FakeConn(FakeResp(RSS))
        orig = c.request

        def request(method, path, headers=None):
            orig(method, path, headers)
            seen.update(headers or {})

        c.request = request
        return c

    sources.fetch_feed("https://feeds.example.com/rss", resolve=lambda _h: [PUBLIC], connect=connect)
    assert seen["Accept-Encoding"] == "identity"


# ---------------------------------------------------------------- the retired Calcalist address

def test_the_curated_seed_has_the_working_calcalist_address():
    cal = next(f for f in model.CURATED_NEWS if f["id"] == "calcalist")
    assert cal["url"] == NEW
    assert OLD not in {f["url"] for f in model.CURATED_NEWS}
    assert model.RETIRED_NEWS_URLS[OLD] == NEW
    assert news_sources._static_check(NEW, "url") == NEW


def _store(conn, rows) -> None:
    set_setting(conn, news_sources.KEY, json.dumps(rows, ensure_ascii=False))


def test_a_saved_list_with_the_dead_address_reads_the_new_one_and_customs_are_untouched(settings):
    db = Database(settings.db_path)
    custom = "https://www.calcalist.co.il/GeneralRSS/0,16335,L-3674,00.xml"  # a manager's own (also dead) address: never rewritten
    rows = [{"id": "calcalist", "name": "כלכליסט", "url": OLD, "enabled": True},
            {"id": "mine", "name": "שלי", "url": custom, "enabled": False},
            {"id": "ynet", "name": "ynet", "url": "https://www.ynet.co.il/Integration/StoryRss2.xml", "enabled": True}]
    with db.connection() as conn:
        _store(conn, rows)
        first = news_sources.load(conn)
        second = news_sources.load(conn)
        stored = json.loads(get_setting(conn, news_sources.KEY, ""))
    assert first == second  # idempotent
    assert [s["url"] for s in first] == [NEW, custom, "https://www.ynet.co.il/Integration/StoryRss2.xml"]
    assert [s["id"] for s in first] == ["calcalist", "mine", "ynet"] and first[1]["enabled"] is False
    assert stored == rows  # reading never writes


def test_saving_the_list_stores_the_new_address(settings, client):
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200
    db = Database(settings.db_path)
    with db.connection() as conn:
        _store(conn, [{"id": "calcalist", "name": "כלכליסט", "url": OLD, "enabled": True}])
    got = client.get(f"{API}/notices/news-sources").json()["sources"]
    assert [s["url"] for s in got] == [NEW]
    assert client.put(f"{API}/notices/news-sources", json={"sources": [{k: got[0][k] for k in ("id", "name", "url", "enabled")}]}).status_code == 200
    with db.connection() as conn:
        assert json.loads(get_setting(conn, news_sources.KEY, ""))[0]["url"] == NEW


def test_when_the_list_already_has_the_new_address_the_retired_row_is_left_out(settings):
    db = Database(settings.db_path)
    with db.connection() as conn:
        _store(conn, [{"id": "calcalist", "name": "כלכליסט", "url": OLD, "enabled": True},
                      {"id": "cal2", "name": "כלכליסט 24/7", "url": NEW, "enabled": True}])
        got = news_sources.load(conn)
    assert [(s["id"], s["url"]) for s in got] == [("cal2", NEW)]  # never the same address twice (the editor would refuse to save)


def test_a_board_feed_with_the_dead_address_reads_the_new_one():
    d = model.load_display(json.dumps({"news": {"feeds": [{"id": "calcalist", "name": "כלכליסט", "url": OLD},
                                                          {"name": "raw", "url": "https://feeds.example.com/rss"}]}}))
    assert [f["url"] for f in d["news"]["feeds"]] == [NEW, "https://feeds.example.com/rss"]


def test_a_board_that_stored_the_dead_address_without_an_id_is_not_listed_as_custom(settings, client):
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200
    r = client.post(f"{API}/notices/boards", json={"name": "לובי", "slug": "lobby", "display": {"blocks": {"news": True}, "news": {"feeds": [{"name": "כלכליסט", "url": OLD}]}}})
    assert r.status_code == 200, r.text
    db = Database(settings.db_path)
    with db.connection() as conn:
        stored = model.load_display(store.board_by_slug(conn, "lobby")["display_json"])
    assert stored["news"]["feeds"][0]["url"] == NEW  # stored as the working address
    rows = client.get(f"{API}/notices/news-sources").json()["sources"]
    assert not [s for s in rows if s["custom"]]
    with db.connection() as conn:
        feeds = news_sources.resolve_board_feeds(conn, [{"name": "כלכליסט", "url": NEW}], allow_custom=False)
    assert feeds == [{"name": "כלכליסט", "url": NEW}]


# ---------------------------------------------------------------- health

def test_failure_codes():
    assert sources.failure_code(sources.FetchRefused("status")) == "status"
    assert sources.failure_code(UnsafeXml("x")) == "xml"
    assert sources.failure_code(TimeoutError()) == "timeout"
    assert sources.failure_code(ssl.SSLError()) == "tls"
    assert sources.failure_code(ConnectionResetError()) == "network"
    assert sources.failure_code(RuntimeError("https://secret.example.com/x")) == "error"


def test_the_cache_keeps_the_last_success_and_the_last_failure_reason(caplog):
    clock = [1_800_000_000.0]
    script: list = []

    def fetch(url):
        step = script.pop(0)
        if isinstance(step, Exception):
            raise step
        return step

    cache = sources.NewsCache(fetch=fetch, clock=lambda: clock[0], background=False)
    url = "https://feeds.example.com/private-path?token=abc"
    assert cache.health(url) == {"last_ok_at": None, "last_error": None}  # never fetched
    script.append(sources.FetchRefused("status"))
    with caplog.at_level(logging.INFO, logger=sources.__name__):
        assert cache.titles(url) == []
    assert cache.health(url) == {"last_ok_at": None, "last_error": "status"}
    assert "status" in caplog.text and "feeds.example.com" not in caplog.text and "token" not in caplog.text
    clock[0] += sources.NEWS_TTL_S + 1
    script.append(RSS)
    assert cache.titles(url) == ["כותרת ראשונה", "second"]
    assert cache.health(url) == {"last_ok_at": "2027-01-15T08:15:01Z", "last_error": None}
    clock[0] += sources.NEWS_TTL_S + 1
    script.append(b"<rss><channel></channel></rss>")  # no titles: reported, the last good titles stay
    assert cache.titles(url) == ["כותרת ראשונה", "second"]
    assert cache.health(url) == {"last_ok_at": "2027-01-15T08:15:01Z", "last_error": "empty"}
    clock[0] += sources.NEWS_TTL_S + 1
    script.append(gzip.compress(b"\0" * 10) + b"x")  # not XML at all
    cache.titles(url)
    assert cache.health(url)["last_error"] == "xml" and cache.health(url)["last_ok_at"] == "2027-01-15T08:15:01Z"
    cache.clear()
    assert cache.health(url) == {"last_ok_at": None, "last_error": None}


def test_the_sources_list_and_the_settings_carry_the_health(client, monkeypatch):
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200
    script = {NEW: sources.FetchRefused("status"), "https://rss.walla.co.il/feed/1": RSS}

    def fetch(url):
        step = script.get(url, RSS)
        if isinstance(step, Exception):
            raise step
        return step

    cache = sources.NewsCache(fetch=fetch, clock=lambda: 1_800_000_000.0, background=False)
    monkeypatch.setattr(sources, "NEWS", cache)
    before = client.get(f"{API}/notices/news-sources").json()["sources"]
    assert all(s["last_ok_at"] is None and s["last_error"] is None for s in before)  # asking never fetches
    for f in model.CURATED_NEWS[2:]:
        cache.titles(f["url"])
    got = {s["id"]: s for s in client.get(f"{API}/notices/news-sources").json()["sources"]}
    assert got["calcalist"]["last_error"] == "status" and got["calcalist"]["last_ok_at"] is None
    assert got["walla"]["last_error"] is None and got["walla"]["last_ok_at"] == "2027-01-15T08:00:00Z"
    assert got["ynet"]["last_ok_at"] is None and got["ynet"]["last_error"] is None
    doc = client.get(f"{API}/notices/settings").json()["settings"]["news_sources"]
    assert {s["id"]: s["last_error"] for s in doc}["calcalist"] == "status"
    put = client.put(f"{API}/notices/news-sources", json={"sources": [{k: got["calcalist"][k] for k in ("id", "name", "url", "enabled")}]})
    assert put.status_code == 200 and put.json()["sources"][0]["last_error"] == "status"
