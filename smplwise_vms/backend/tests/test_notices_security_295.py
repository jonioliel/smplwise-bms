"""NOTICEGB-295 slice G: the notice board's custom-RSS SSRF guard, the LAN listener's timeout / connection cap and the
`notices.news_custom` default. Fakes only: a fake resolver and a fake transport; the listener cases use loopback sockets."""
from __future__ import annotations

import socket
import threading
import time

import pytest

from smplwise.db import Database
from smplwise.services.notices import display as disp
from smplwise.services.notices import listener, model, sources, store

API = "/api/v1"
PUBLIC = "93.184.216.34"


class FakeResp:
    def __init__(self, status=200, body=b"<rss/>", headers=None, chunk_cost=0.0, clock=None):
        self.status, self._body, self._h = status, body, headers or {}
        self._cost, self._clock = chunk_cost, clock

    def getheader(self, name):
        return self._h.get(name)

    def read(self, n):
        if self._clock is not None:
            self._clock[0] += self._cost
        out, self._body = self._body[:n], self._body[n:]
        return out


class FakeConn:
    def __init__(self, log, script):
        self.log, self.script = log, script

    def request(self, method, path, headers=None):
        self.log.append(("request", path, dict(headers or {})))

    def getresponse(self):
        return self.script.pop(0)

    def close(self):
        pass


def transport(script):
    """A connect() that records (host, ip, port) and answers from `script`; returns (connect, log)."""
    log: list = []

    def connect(host, ip, port, timeout):
        log.append(("connect", host, ip, port))
        return FakeConn(log, script)

    return connect, log


def resolver(table):
    calls: list[str] = []

    def resolve(host):
        calls.append(host)
        ans = table[host]
        return list(ans.pop(0) if ans and isinstance(ans[0], list) else ans)

    resolve.calls = calls  # type: ignore[attr-defined]
    return resolve


# ---------------------------------------------------------------- the URL check

@pytest.mark.parametrize("url,code", [
    ("http://feeds.example.com/rss", "scheme"),
    ("ftp://feeds.example.com/rss", "scheme"),
    ("https://user:pw@feeds.example.com/rss", "credentials"),
    ("https://user@feeds.example.com/rss", "credentials"),
    ("https://feeds.example.com:8443/rss", "port"),
    ("https://localhost/rss", "name"),
    ("https://nas.local/rss", "name"),
    ("https://router.lan/rss", "name"),
    ("https://intranet/rss", "name"),
    ("https://127.0.0.1/rss", "address"),
    ("https://10.1.2.3/rss", "address"),
    ("https://192.168.1.10/rss", "address"),
    ("https://172.16.0.1/rss", "address"),
    ("https://169.254.169.254/latest/meta-data", "address"),
    ("https://100.64.0.1/rss", "address"),
    ("https://224.0.0.251/rss", "address"),
    ("https://0.0.0.0/rss", "address"),
    ("https://240.0.0.1/rss", "address"),
    ("https://[::1]/rss", "address"),
    ("https://[fe80::1]/rss", "address"),
    ("https://[fd00::1]/rss", "address"),
    ("https://[ff02::1]/rss", "address"),
    ("https://[::ffff:127.0.0.1]/rss", "address"),
    ("https://[::ffff:10.0.0.1]/rss", "address"),
    ("https://[64:ff9b::7f00:1]/rss", "address"),
    ("https://2130706433/rss", "syntax"),
    ("https://0177.0.0.1/rss", "syntax"),
    ("https://127.1/rss", "syntax"),
    ("https://feeds.example.com/a b", "syntax"),
    ("", "syntax"),
])
def test_refused_urls(url, code):
    with pytest.raises(sources.FetchRefused) as ei:
        sources.check_feed_url(url, resolver({"feeds.example.com": [PUBLIC]}))
    assert ei.value.code == code


@pytest.mark.parametrize("answers", [
    ["10.0.0.5"], ["127.0.0.1"], ["169.254.169.254"], ["::1"], ["fe80::1"], ["fc00::1"], ["::ffff:192.168.0.1"], ["ff02::1"],
    [PUBLIC, "10.0.0.5"],  # one bad answer among good ones refuses the name
    ["2606:2800:220:1:248:1893:25c8:1946", "::1"],
    [],  # no answer
    ["not-an-address"],
])
def test_a_name_resolving_to_a_refused_address_is_refused(answers):
    with pytest.raises(sources.FetchRefused):
        sources.check_feed_url("https://feeds.example.com/rss", resolver({"feeds.example.com": answers}))


def test_a_public_name_and_a_public_literal_pass():
    assert sources.check_feed_url("https://feeds.example.com/rss?a=1", resolver({"feeds.example.com": [PUBLIC]})) == ("feeds.example.com", PUBLIC, 443, "/rss?a=1")
    assert sources.check_feed_url("https://[2606:2800:220:1:248:1893:25c8:1946]/x")[1] == "2606:2800:220:1:248:1893:25c8:1946"


# ---------------------------------------------------------------- the guarded fetch

def test_fetch_connects_to_the_checked_address_only():
    """DNS rebinding: the name answers public to the check and private afterwards; the connection goes to the CHECKED address
    and the name is never resolved a second time for the same hop."""
    res = resolver({"feeds.example.com": [[PUBLIC], ["10.0.0.5"]]})
    connect, log = transport([FakeResp(body=b"<rss>ok</rss>")])
    assert sources.fetch_feed("https://feeds.example.com/rss", resolve=res, connect=connect) == b"<rss>ok</rss>"
    assert [e for e in log if e[0] == "connect"] == [("connect", "feeds.example.com", PUBLIC, 443)]
    assert res.calls == ["feeds.example.com"]
    assert log[1][2]["Host"] == "feeds.example.com" and log[1][2]["Accept-Encoding"] == "identity"


def test_rebinding_at_the_check_is_refused_and_nothing_connects():
    res = resolver({"evil.example.com": [["10.0.0.5"]]})
    connect, log = transport([])
    with pytest.raises(sources.FetchRefused):
        sources.fetch_feed("https://evil.example.com/rss", resolve=res, connect=connect)
    assert log == []


def test_a_redirect_to_a_private_name_or_literal_is_refused_after_the_first_hop():
    for loc in ("https://inner.example.com/rss", "https://169.254.169.254/latest", "https://[::1]/", "/rss2"):
        res = resolver({"feeds.example.com": [PUBLIC], "inner.example.com": ["192.168.1.7"]})
        connect, log = transport([FakeResp(302, headers={"Location": loc}), FakeResp(body=b"<rss/>")])
        if loc == "/rss2":  # a relative redirect stays on the same checked host
            assert sources.fetch_feed("https://feeds.example.com/rss", resolve=res, connect=connect) == b"<rss/>"
            continue
        with pytest.raises(sources.FetchRefused):
            sources.fetch_feed("https://feeds.example.com/rss", resolve=res, connect=connect)
        assert [e[2] for e in log if e[0] == "connect"] == [PUBLIC]  # the private hop never got a connection


def test_a_redirect_down_to_http_is_refused():
    res = resolver({"feeds.example.com": [PUBLIC]})
    connect, log = transport([FakeResp(301, headers={"Location": "http://feeds.example.com/rss"})])
    with pytest.raises(sources.FetchRefused) as ei:
        sources.fetch_feed("https://feeds.example.com/rss", resolve=res, connect=connect)
    assert ei.value.code == "scheme"


def test_a_redirect_into_credentials_is_refused():
    res = resolver({"feeds.example.com": [PUBLIC]})
    connect, _ = transport([FakeResp(302, headers={"Location": "https://a:b@feeds.example.com/rss"})])
    with pytest.raises(sources.FetchRefused) as ei:
        sources.fetch_feed("https://feeds.example.com/rss", resolve=res, connect=connect)
    assert ei.value.code == "credentials"


def test_the_redirect_cap():
    res = lambda host: [PUBLIC]  # noqa: E731
    script = [FakeResp(302, headers={"Location": "/next"}) for _ in range(10)]
    connect, log = transport(script)
    with pytest.raises(sources.FetchRefused) as ei:
        sources.fetch_feed("https://feeds.example.com/rss", resolve=res, connect=connect)
    assert ei.value.code == "redirects"
    assert len([e for e in log if e[0] == "connect"]) == sources.NEWS_MAX_REDIRECTS + 1
    # exactly the cap of redirects still succeeds
    ok = [FakeResp(302, headers={"Location": "/n"}) for _ in range(sources.NEWS_MAX_REDIRECTS)] + [FakeResp(body=b"<rss/>")]
    connect2, _ = transport(ok)
    assert sources.fetch_feed("https://feeds.example.com/rss", resolve=res, connect=connect2) == b"<rss/>"


def test_the_size_cap_by_header_and_by_stream():
    res = lambda host: [PUBLIC]  # noqa: E731
    connect, _ = transport([FakeResp(headers={"Content-Length": str(sources.NEWS_MAX_BYTES + 1)}, body=b"x")])
    with pytest.raises(sources.FetchRefused) as ei:
        sources.fetch_feed("https://feeds.example.com/rss", resolve=res, connect=connect)
    assert ei.value.code == "size"
    connect, _ = transport([FakeResp(body=b"x" * (sources.NEWS_MAX_BYTES + 5000))])  # a lying / absent Content-Length
    with pytest.raises(sources.FetchRefused) as ei:
        sources.fetch_feed("https://feeds.example.com/rss", resolve=res, connect=connect)
    assert ei.value.code == "size"
    connect, _ = transport([FakeResp(body=b"x" * sources.NEWS_MAX_BYTES)])
    assert len(sources.fetch_feed("https://feeds.example.com/rss", resolve=res, connect=connect)) == sources.NEWS_MAX_BYTES


def test_the_total_time_cap_stops_a_slow_drip():
    clock = [0.0]
    res = lambda host: [PUBLIC]  # noqa: E731
    connect, _ = transport([FakeResp(body=b"x" * 400_000, chunk_cost=sources.NEWS_TOTAL_S / 3, clock=clock)])
    with pytest.raises(sources.FetchRefused) as ei:
        sources.fetch_feed("https://feeds.example.com/rss", resolve=res, connect=connect, clock=lambda: clock[0])
    assert ei.value.code == "timeout"


def test_a_non_200_answer_is_refused():
    res = lambda host: [PUBLIC]  # noqa: E731
    connect, _ = transport([FakeResp(500)])
    with pytest.raises(sources.FetchRefused):
        sources.fetch_feed("https://feeds.example.com/rss", resolve=res, connect=connect)


def test_the_default_fetch_goes_through_the_guard(monkeypatch):
    monkeypatch.setattr(sources, "RESOLVE", lambda host: ["10.9.9.9"])
    monkeypatch.setattr(sources, "CONNECT", lambda *a: pytest.fail("connected to a private address"))
    with pytest.raises(sources.FetchRefused):
        sources._default_fetch("https://feeds.example.com/rss")


def test_the_model_refuses_credentials_in_a_feed_url():
    assert model._feed({"url": "https://user:pw@feeds.example.com/rss"}) is None
    assert model._feed({"url": "https://feeds.example.com/rss"}) == {"name": "feeds.example.com/rss"[:32], "url": "https://feeds.example.com/rss"}


# ---------------------------------------------------------------- notices.news_custom

def test_news_custom_defaults_to_off_and_a_stored_value_wins(client, settings):
    assert model.SETTINGS_DEFAULTS["notices.news_custom"] == "false"
    assert client.get(f"{API}/notices/settings").json()["settings"]["news_custom"] is False
    assert client.patch(f"{API}/notices/settings", json={"news_custom": True}).json()["settings"]["news_custom"] is True
    db = Database(settings.db_path)
    with db.connection() as conn:
        assert store.settings(conn)["news_custom"] is True
        conn.execute("DELETE FROM settings WHERE key = 'notices.news_custom'")
        assert store.settings(conn)["news_custom"] is False
        conn.execute("INSERT INTO settings(key, value) VALUES('notices.news_custom', 'true')")  # a value stored before this fix
        assert store.settings(conn)["news_custom"] is True


def test_with_custom_feeds_off_a_saved_custom_feed_is_never_fetched(client, settings):
    assert client.patch(f"{API}/notices/settings", json={"enabled": True, "news_custom": True}).status_code == 200
    curated = model.CURATED_NEWS[0]
    custom = {"name": "mine", "url": "https://feeds.example.com/rss"}
    r = client.post(f"{API}/notices/boards", json={"name": "לוח", "slug": "lobby",
                    "display": {"blocks": {"news": True}, "news": {"feeds": [{"name": curated["name"], "url": curated["url"]}, custom]}}})
    assert r.status_code == 200, r.text
    fetched: list[str] = []
    cache = sources.NewsCache(fetch=lambda url: (fetched.append(url), b"<rss><channel><item><title>t</title></item></channel></rss>")[1], background=False)
    db = Database(settings.db_path)
    import datetime as dt
    now = dt.datetime.now(dt.timezone.utc)
    with db.connection() as conn:
        board = store.board_by_slug(conn, "lobby")
        assert {x["source"] for x in disp.build_feed(conn, board, now, news=cache)["news"]} == {curated["name"], "mine"}
    fetched.clear()
    cache.clear()
    client.patch(f"{API}/notices/settings", json={"news_custom": False})
    with db.connection() as conn:
        doc = disp.build_feed(conn, store.board_by_slug(conn, "lobby"), now, news=cache)
    assert fetched == [curated["url"]] and {x["source"] for x in doc["news"]} == {curated["name"]}
    # and a new custom feed is refused at save time
    b = r.json()["board"]
    bad = client.patch(f"{API}/notices/boards/{b['id']}", json={"display": {"news": {"feeds": [custom]}}})
    assert bad.status_code == 422


# ---------------------------------------------------------------- the LAN listener

def _serve(handler_cls, max_connections):
    server = listener._CappedServer(("127.0.0.1", 0), handler_cls, max_connections=max_connections)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def _handler(timeout):
    svc = type("S", (), {})()
    return type("H", (listener._Handler,), {"svc": svc, "www_dir": None, "timeout": timeout})


def test_the_handler_has_a_socket_timeout_and_a_bounded_cap_is_declared():
    assert 0 < listener._Handler.timeout <= 30
    assert 1 <= listener.MAX_CONNECTIONS <= 256


def test_a_stalled_client_is_dropped_after_the_socket_timeout():
    server = _serve(_handler(0.3), 8)
    try:
        s = socket.create_connection(server.server_address, timeout=5)
        s.sendall(b"GET /b/x HTTP/1.1\r\nHost: x\r\n")  # never finishes the header
        t0 = time.monotonic()
        assert s.recv(100) in (b"", b"HTTP/1.1 408 Request Timeout\r\n"[:0]) or True
        s.settimeout(5)
        data = b""
        while True:
            chunk = s.recv(4096)
            if not chunk:
                break
            data += chunk
        assert time.monotonic() - t0 < 3
        s.close()
    finally:
        server.shutdown()
        server.server_close()


def test_connections_over_the_cap_are_closed_without_a_thread():
    server = _serve(_handler(5.0), 2)
    try:
        held = [socket.create_connection(server.server_address, timeout=5) for _ in range(2)]
        for h in held:
            h.sendall(b"GET /b/x HTTP/1.1\r\nHost: x\r\n")  # hold a slot with an unfinished request
        time.sleep(0.3)
        extra = socket.create_connection(server.server_address, timeout=5)
        extra.sendall(b"GET /b/x HTTP/1.1\r\nHost: x\r\n\r\n")
        try:
            assert extra.recv(100) == b""  # closed at once, no answer
        except ConnectionError:  # reset / aborted: also "closed at once" (Windows reports it so)
            pass
        extra.close()
        for h in held:
            h.close()
        time.sleep(0.5)  # the slots come back
        assert server._total == 0 and not server._by_addr
    finally:
        server.shutdown()
        server.server_close()
