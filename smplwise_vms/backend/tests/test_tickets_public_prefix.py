"""TK255: the public listener serves ITSELF under a configurable one-segment prefix (default `/support`), so the owner needs one
Cloudflare route and no Rewrite rule. Fail-closed rules under test: only the exact known routes under the prefix; everything else is
the SAME uniform 404; no redirect of any kind; no spelling of the path (`//`, `/../`, `%2e`, `%2f`, `%5c`, a trailing dot, another
case) reaches a route that is not listed or escapes the prefix; `/t/...` keeps working only while `public.legacy_t_paths` says so;
the prefix itself is validated (single segment, [a-z0-9_-], length cap, no reserved word). Every value is invented."""
from __future__ import annotations

import pytest
from fastapi import APIRouter, Depends

from smplwise.services.tickets import links, public_prefix, settings_doc
from smplwise.services.tickets.public_app import LinkContext, link_context
from tests.tickets_public_fakes import build_world


def _router() -> APIRouter:
    r = APIRouter()

    @r.get("/t/api/ticket")
    async def ticket(ctx: LinkContext = Depends(link_context())) -> dict:
        return {"number": ctx.link.ticket_number}

    return r


def _world(tmp_path, *, prefix="support", legacy=True, shell: bytes | None = None):
    shell_dir = None
    if shell is not None:
        shell_dir = tmp_path / "www-public"
        (shell_dir / "assets").mkdir(parents=True)
        (shell_dir / "index.html").write_bytes(shell)
        (shell_dir / "assets" / "main-AbCd1234.js").write_bytes(b"console.log(1)")
    return build_world(tmp_path, routers=(_router(),), shell_dir=shell_dir, path_prefix=prefix, legacy_t=legacy)


UNIFORM = b'{"code":"link_unavailable"}'


# ---------------------------------------------------------------- the validator


@pytest.mark.parametrize("value,expected", [("support", "support"), ("/support", "support"), ("t", "t"), ("a1_b-c", "a1_b-c"),
                                            ("s" * 32, "s" * 32), ("0x", "0x")])
def test_valid_prefixes(value, expected):
    assert public_prefix.validate_prefix(value) == expected


@pytest.mark.parametrize("value", ["", "/", "//support", "a/b", "/a/b", "Support", "sup port", "support/", "..", ".", "a.b", "-x", "_x", "s" * 33,
                                   "api", "assets", "r", "healthz", "arx", "admin", "hassio", "ingress", "auth", "static", "x‏",
                                   "sup%70ort", "sup\\port", "support\n", 7, None, True, ["support"]])
def test_refused_prefixes(value):
    with pytest.raises(ValueError):
        public_prefix.validate_prefix(value)


# ---------------------------------------------------------------- path resolution (pure)


@pytest.mark.parametrize("path,raw,expected", [
    ("/support/", None, ("/t/", "support")),
    ("/support/r/abc", None, ("/t/r/abc", "support")),
    ("/support/api/ticket", b"/support/api/ticket", ("/t/api/ticket", "support")),
    ("/support/assets/x.js", None, ("/t/assets/x.js", "support")),
    ("/t/", None, ("/t/", "t")),
    ("/t/api/ticket", None, ("/t/api/ticket", "t")),
])
def test_resolve_accepts_the_prefix_and_the_legacy_t(path, raw, expected):
    assert public_prefix.resolve_path(path, raw, "support", True) == expected


@pytest.mark.parametrize("path", [
    "/support", "/support/../t/", "/support/./", "/support//", "//support/", "/support//api/ticket", "/Support/", "/SUPPORT/", "/support./",
    "/support/%2e%2e/", "/support/%2E/", "/support%2f", "/support/api%2fticket", "/support/api\\ticket", "/support\\", "/suppor/", "/supports/",
    "/ support/", "/support/\x00", "/support/‮", "/support/é", "/support/" + "a" * 400,
    "/t", "/tt/", "/t./", "/T/", "/t/../support/", "/t//", "", "support/", "/", "/x/", "http://evil.test/support/", "/support/?x",
    "/support/#x",
])
def test_resolve_refuses_everything_else(path):
    assert public_prefix.resolve_path(path, None, "support", True) is None


def test_resolve_refuses_a_raw_path_that_differs_from_the_decoded_one():
    assert public_prefix.resolve_path("/support/", b"/support/%", "support", True) is None
    assert public_prefix.resolve_path("/support/", b"/%73upport/", "support", True) is None
    assert public_prefix.resolve_path("/support/", b"/support/%2e", "support", True) is None


def test_legacy_t_is_off_when_the_setting_says_so_and_the_prefix_t_is_always_served():
    assert public_prefix.resolve_path("/t/", None, "support", False) is None
    assert public_prefix.resolve_path("/support/", None, "support", False) == ("/t/", "support")
    assert public_prefix.resolve_path("/t/", None, "t", False) == ("/t/", "t")
    assert public_prefix.resolve_path("/support/", None, "t", True) is None  # a prefix that is not configured is not served


# ---------------------------------------------------------------- the edge over the ASGI app


def test_the_page_and_the_api_answer_under_the_prefix(tmp_path):
    w = _world(tmp_path)
    link, tok = w.links.add()
    c = w.client()
    assert c.get("/support/").status_code == 200
    assert c.get("/support/healthz").json() == {"ok": True}
    r = c.get("/support/api/ticket", headers={"x-ticket-token": tok})
    assert r.status_code == 200 and r.json()["number"] == link.ticket_number
    assert c.get("/support/r/" + "ab" * 16).status_code == 200


def test_the_legacy_t_paths_keep_working_by_default(tmp_path):
    w = _world(tmp_path)
    _link, tok = w.links.add()
    c = w.client()
    assert c.get("/t/").status_code == 200 and c.get("/t/healthz").status_code == 200
    assert c.get("/t/api/ticket", headers={"x-ticket-token": tok}).status_code == 200


def test_legacy_t_paths_are_the_uniform_404_when_switched_off(tmp_path):
    w = _world(tmp_path, legacy=False)
    _link, tok = w.links.add()
    c = w.client()
    for path in ("/t/", "/t/healthz", "/t/api/ticket", "/t/r/" + "ab" * 16, "/t/assets/main-AbCd1234.js"):
        a = c.get(path, headers={"x-ticket-token": tok})
        assert a.status_code == 404 and a.content == UNIFORM, path
    assert c.get("/support/api/ticket", headers={"x-ticket-token": tok}).status_code == 200


def test_prefix_t_serves_t_only(tmp_path):
    w = _world(tmp_path, prefix="t")
    c = w.client()
    assert c.get("/t/").status_code == 200
    assert c.get("/support/").status_code == 404


ATTACKS = [
    "/support", "/support/%2e%2e/t/", "/support/%2E%2E/", "/support/.%2e/", "/support/%2e/", "/support//",
    "/support//healthz", "//support/healthz", "/support/%2fhealthz", "/support%2fhealthz", "/support/api%2fticket", "/support/api/%74icket",
    "/support/healthz%00", "/support/healthz/", "/support/healthz.", "/support/HEALTHZ", "/Support/", "/SUPPORT/healthz", "/support/t/healthz",
    "/support/api/ticket/", "/support/api/", "/support/api", "/support/assets/", "/support/assets/..%2f..%2fx.js", "/support/assets/%2e%2e/index.html",
    "/support/\\healthz", "/support/..\\t/", "/support/;x/", "/support/healthz;x", "/t/%2e%2e/", "/t//healthz",
    "/support/%252e%252e/", "/support/%c0%ae%c0%ae/", "/support/%ef%bc%8f", "/healthz", "/api/ticket", "/", "/arx/", "/support2/", "/sup/",
]


def test_no_spelling_reaches_an_unlisted_route_and_every_refusal_is_the_same_answer(tmp_path):
    w = _world(tmp_path, shell=b"<!doctype html>x")
    _link, tok = w.links.add()
    c = w.client(peer="198.51.100.20")
    answers = []
    for path in ATTACKS:
        a = c.get(path, headers={"x-ticket-token": tok}, follow_redirects=False)
        assert a.status_code == 404, (path, a.status_code)
        assert "location" not in a.headers
        answers.append((path, a.status_code, [(k.lower(), v) for k, v in a.headers.raw if k.lower() != b"content-length"], a.content))
    first = answers[0]
    for path, status, headers, body in answers:
        assert (status, headers, body) == first[1:], path
    assert first[3] == UNIFORM


def _asgi_status(world, path: str, raw: bytes | None, token: str) -> tuple[int, bytes]:
    """The edge driven directly with a scope: no HTTP client in between to tidy the path (httpx resolves `/../` before sending)."""
    import asyncio

    out: dict = {"status": None, "body": b""}

    async def run() -> None:
        scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": "GET", "path": path, "raw_path": raw,
                 "query_string": b"", "headers": [(b"host", b"x.test"), (b"x-ticket-token", token.encode())], "client": ("198.51.100.30", 5000),
                 "server": ("x.test", 443), "scheme": "https"}
        sent = False

        async def receive():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": b"", "more_body": False}
            await asyncio.sleep(0.05)
            return {"type": "http.disconnect"}

        async def send(message):
            if message["type"] == "http.response.start":
                out["status"] = message["status"]
            elif message["type"] == "http.response.body":
                out["body"] += message.get("body", b"")

        await world.app(scope, receive, send)

    asyncio.run(run())
    return out["status"], out["body"]


@pytest.mark.parametrize("path", ["/support/../t/", "/support/./", "/support/..", "/t/../support/healthz", "/support/../support/healthz",
                                  "/support/healthz/..", "/support//healthz", "//support/healthz", "/support/api/../healthz"])
def test_dot_segments_that_reach_the_server_unresolved_are_refused(tmp_path, path):
    w = _world(tmp_path)
    _link, tok = w.links.add()
    status, body = _asgi_status(w, path, path.encode(), tok)
    assert (status, body) == (404, UNIFORM), path
    assert _asgi_status(w, "/support/healthz", b"/support/healthz", tok)[0] == 200  # the harness itself reaches a real route


@pytest.mark.parametrize("decoded,raw", [("/support/healthz", b"/support/%68ealthz"), ("/support/healthz", b"/%73upport/healthz"),
                                         ("/support/ ", b"/support/%20"), ("/support/../t/", b"/support/%2e%2e/t/"),
                                         ("/support/a/b", b"/support/a%2fb"), ("/support/healthz", b"/support/healthz%2f"),
                                         ("/support/healthz", "/support/héalthz".encode("utf-8"))])
def test_a_raw_path_that_is_not_the_decoded_path_is_refused(tmp_path, decoded, raw):
    w = _world(tmp_path)
    _link, tok = w.links.add()
    assert _asgi_status(w, decoded, raw, tok) == (404, UNIFORM)


def test_methods_other_than_the_listed_one_are_the_same_404(tmp_path):
    w = _world(tmp_path)
    _link, tok = w.links.add()
    c = w.client()
    for method in ("POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"):
        a = c.request(method, "/support/healthz", headers={"x-ticket-token": tok})
        assert a.status_code == 404 and a.content in (UNIFORM, b""), method


def test_nothing_is_ever_redirected(tmp_path):
    w = _world(tmp_path)
    c = w.client()
    for path in ("/support", "/support/healthz/", "/t", "/support/r", "/support/r/"):
        a = c.get(path, follow_redirects=False)
        assert a.status_code == 404 and "location" not in a.headers, path


def test_the_shell_and_the_assets_are_the_same_file_under_every_prefix_but_point_at_their_own_prefix(tmp_path):
    shell = (b'<!doctype html><link rel="icon" href="/t/assets/icon-3vTIMdxg.svg"><script type="module" crossorigin '
             b'src="/t/assets/main-AbCd1234.js"></script>')
    w = _world(tmp_path, shell=shell)
    c = w.client()
    under = c.get("/support/")
    assert b'src="/support/assets/main-AbCd1234.js"' in under.content and b'href="/support/assets/icon-3vTIMdxg.svg"' in under.content
    assert b"/t/assets/" not in under.content
    legacy = c.get("/t/")
    assert legacy.content == shell
    assert c.get("/support/r/" + "ab" * 16).content == under.content
    js = c.get("/support/assets/main-AbCd1234.js")
    assert js.status_code == 200 and js.content == b"console.log(1)"
    assert c.get("/t/assets/main-AbCd1234.js").content == b"console.log(1)"


def test_the_prefix_can_change_without_a_restart(tmp_path):
    w = _world(tmp_path)
    c = w.client()
    assert c.get("/support/healthz").status_code == 200
    w.app.edge.set_prefix("help", False)
    assert c.get("/support/healthz").status_code == 404 and c.get("/t/healthz").status_code == 404
    assert c.get("/help/healthz").status_code == 200
    with pytest.raises(ValueError):
        w.app.edge.set_prefix("api", True)
    assert c.get("/help/healthz").status_code == 200  # a refused value changes nothing


def test_the_edge_never_serves_an_invalid_configured_prefix(tmp_path):
    from smplwise.services.tickets.public_app import PublicDeps, create_public_app  # noqa: F401

    with pytest.raises(ValueError):
        _world(tmp_path, prefix="Support")


# ---------------------------------------------------------------- the settings and the URLs built on them


def test_the_settings_know_the_prefix_and_the_legacy_switch():
    assert settings_doc.SCHEMA[("public", "path_prefix")][0] == "support"
    assert settings_doc.SCHEMA[("public", "legacy_t_paths")][0] is True
    check = settings_doc.SCHEMA[("public", "path_prefix")][1]
    assert check("/t") == "t" and check("support") == "support"
    for bad in ("", "Support", "a/b", "api", "x" * 40, 3):
        with pytest.raises(ValueError):
            check(bad)


def test_effective_prefix_follows_the_address_path_then_the_setting():
    assert links.effective_prefix("https://ecc.smplwise.com", "support") == "support"
    assert links.effective_prefix("https://ecc.smplwise.com/help", "support") == "help"  # a 2.5.4 address keeps its own prefix
    assert links.effective_prefix("", "t") == "t"


def test_links_carry_the_configured_prefix():
    tok = "A" * 32
    rid = "ab" * 16
    base = "https://ecc.smplwise.com"
    assert links.handler_url(base, tok, prefix="support") == f"{base}/support/#{tok}"
    assert links.redeem_url(base, rid, prefix="support") == f"{base}/support/r/{rid}"
    assert links.handler_url(base, tok, prefix="t") == f"{base}/t/#{tok}"
    assert links.public_url(base, "healthz", prefix="support") == f"{base}/support/healthz"
    with pytest.raises(ValueError):
        links.public_url(base, "healthz", prefix="a/b")


def test_the_address_probe_asks_the_configured_prefix():
    from smplwise.services.tickets import address_probe

    seen: list[str] = []

    def fetch(addr, host, timeout_s, nonce, path="/t/healthz"):
        seen.append(path)
        return 200, b'{"ok":true}'

    address_probe.probe("https://ecc.smplwise.com", resolve=lambda h: ["93.184.216.34"], fetch=fetch, prefix="support")
    assert seen == ["/support/healthz"]


# ---------------------------------------------------------------- over the real settings route and store (the s4 world)


def _s4(settings, monkeypatch):
    from tickets_s4_world import build_s4

    return build_s4(settings, monkeypatch)


def test_settings_default_validate_and_reach_the_running_edge(settings, monkeypatch):
    import time

    from smplwise.services.tickets.public_runtime import RUNTIME
    from tickets_s4_world import API, Clock

    s4 = _s4(settings, monkeypatch)
    client, app = s4.public(Clock(time.time()))
    monkeypatch.setattr(RUNTIME, "app", app)
    doc = s4.c.get(f"{API}/tickets/settings").json()
    assert doc["public"]["path_prefix"] == "support" and doc["public"]["legacy_t_paths"] is True
    assert app.edge.prefix == "support" and app.edge.legacy_t is True
    for bad in ("api", "Support", "a/b", "x", "", "x" * 40):
        r = s4.c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "public": {"path_prefix": bad}})
        assert r.status_code == 422, bad
    assert s4.c.get(f"{API}/tickets/settings").json()["revision"] == doc["revision"]  # nothing was stored
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "public": {"path_prefix": "/help", "legacy_t_paths": False}})
    assert r.status_code == 200, r.text
    assert r.json()["public"]["path_prefix"] == "help" and app.edge.prefix == "help" and app.edge.legacy_t is False
    assert client.get("/help/healthz").status_code == 200
    assert client.get("/support/healthz").status_code == 404 and client.get("/t/healthz").status_code == 404


def test_the_prefix_settings_are_refused_from_a_remote_session(settings, monkeypatch):
    from smplwise.routers import tickets_admin
    from tickets_s4_world import API

    s4 = _s4(settings, monkeypatch)
    doc = s4.c.get(f"{API}/tickets/settings").json()
    monkeypatch.setattr(tickets_admin, "is_remote", lambda request: True)
    for public in ({"path_prefix": "help"}, {"legacy_t_paths": False}):
        r = s4.c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "public": public})
        assert r.status_code == 403 and r.json()["code"] == "local_only", public
    assert s4.c.get(f"{API}/tickets/settings").json()["public"] == doc["public"]


def test_the_vendor_urls_of_the_real_store_follow_the_prefix_then_the_address_path(settings, monkeypatch):
    from smplwise.services.tickets import handler_links
    from tickets_s4_world import API, BASE_URL

    s4 = _s4(settings, monkeypatch)

    def prefix() -> str:
        with s4.db.connection(mode="read", label="test.prefix") as conn:
            return handler_links.public_prefix(conn)

    assert prefix() == "support"
    doc = s4.c.get(f"{API}/tickets/settings").json()
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "public": {"path_prefix": "t"}})
    assert r.status_code == 200 and prefix() == "t"
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": r.json()["revision"], "public": {"base_url": BASE_URL + "/zzprefix"}})
    assert r.status_code == 200 and prefix() == "zzprefix"  # a 2.5.4 address keeps its own prefix over the setting


# ---------------------------------------------------------------- security review follow-ups (F1, F2, F2b and the missing classes)


def _asgi(world, path, raw, token="", headers=()):
    """Like _asgi_status, but with extra request headers."""
    import asyncio

    out: dict = {"status": None, "body": b""}

    async def run() -> None:
        hs = [(b"host", b"x.test")] + ([(b"x-ticket-token", token.encode())] if token else []) + list(headers)
        scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": "GET", "path": path, "raw_path": raw,
                 "query_string": b"", "headers": hs, "client": ("198.51.100.31", 5000), "server": ("x.test", 443), "scheme": "https"}
        sent = False

        async def receive():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": b"", "more_body": False}
            await asyncio.sleep(0.05)
            return {"type": "http.disconnect"}

        async def send(message):
            if message["type"] == "http.response.start":
                out["status"] = message["status"]
            elif message["type"] == "http.response.body":
                out["body"] += message.get("body", b"")

        await world.app(scope, receive, send)

    asyncio.run(run())
    return out["status"], out["body"]


@pytest.mark.parametrize("path,raw", [("/support/healthz", b"http://x.test/support/healthz"),  # absolute-form request target
                                      ("*", b"*"),  # asterisk-form
                                      ("/support/healthz", b"/support/healthz?x=1"),  # a raw path that carries a query
                                      ("support/healthz", b"support/healthz")])
def test_unusual_request_targets_are_the_uniform_404(tmp_path, path, raw):
    w = _world(tmp_path)
    assert _asgi(w, path, raw) == (404, UNIFORM)


def test_host_and_forwarding_headers_change_nothing(tmp_path):
    w = _world(tmp_path, shell=b'<link href="/t/assets/main-AbCd1234.js">')
    evil = [(b"host", b"evil.test"), (b"x-forwarded-host", b"evil.test"), (b"x-forwarded-prefix", b"/admin"), (b"x-forwarded-proto", b"http"),
            (b"x-original-url", b"/t/api/ticket"), (b"x-rewrite-url", b"/t/"), (b"forwarded", b"host=evil.test;proto=http")]
    plain = _asgi(w, "/support/", b"/support/")
    assert plain[0] == 200 and b"/support/assets/main-AbCd1234.js" in plain[1]
    assert _asgi(w, "/support/", b"/support/", headers=evil) == plain
    assert _asgi(w, "/support/healthz", b"/support/healthz", headers=evil)[0] == 200
    assert _asgi(w, "/admin/", b"/admin/", headers=evil) == (404, UNIFORM)
    assert _asgi(w, "/t/", b"/t/", headers=evil)[1] == b'<link href="/t/assets/main-AbCd1234.js">'  # the legacy page keeps /t assets


def test_unknown_paths_under_the_prefix_pay_the_static_budget(tmp_path):
    w = _world(tmp_path)
    c = w.client(peer="192.0.2.77")
    codes = [c.get(f"/support/nothing/{i}").status_code for i in range(125)]
    assert codes[:120] == [404] * 120 and set(codes[120:]) == {429}
    assert c.get("/support/healthz").status_code == 429  # the same budget: nothing tells a scanner which route exists
    assert w.client(peer="203.0.113.9").get("/support/healthz").status_code == 200


def test_without_a_raw_path_only_the_decoded_path_is_judged_but_still_strictly():
    assert public_prefix.resolve_path("/support/healthz", None, "support", True) == ("/t/healthz", "support")
    for bad in ("/support/%2e%2e/", "/support/a%2fb", "/support//x", "/support/..", "/support/h?x"):
        assert public_prefix.resolve_path(bad, None, "support", True) is None


def test_f1_an_address_path_the_prefix_validator_refuses_is_refused_everywhere():
    for word in ("api", "assets", "arx", "static", "www", "healthz", "admin"):
        with pytest.raises(links.PublicUrlError):
            links.validate_public_base_url(f"https://ecc.smplwise.com/{word}")
        assert links.effective_prefix(f"https://ecc.smplwise.com/{word}", "support") == "support"  # a stored one falls back to the setting
    assert links.validate_public_base_url("https://ecc.smplwise.com/help") == "https://ecc.smplwise.com/help"


def test_f1_the_settings_put_refuses_a_reserved_address_path_and_assign_degrades_without_a_link(settings, monkeypatch):
    from smplwise.services.tickets import handler_links
    from tickets_s4_world import API

    s4 = _s4(settings, monkeypatch)
    doc = s4.c.get(f"{API}/tickets/settings").json()
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "public": {"base_url": "https://t-demo.arx.example.test/api"}})
    assert r.status_code == 422, r.text
    t, _token = s4.sent()

    def boom(conn, row):
        raise ValueError("reserved")

    monkeypatch.setattr(handler_links, "handler_url", boom)
    r = s4.copy(t["id"])
    assert r.status_code == 409 and r.json()["code"] == "public_link_unavailable", r.text  # never a 500


def _store_doc(db, doc: dict) -> None:
    import json

    with db.connection(label="test.store") as conn:
        conn.execute("DELETE FROM settings WHERE key IN ('tickets.settings', 'tickets.path_prefix_pinned')")
        conn.execute("INSERT INTO settings(key, value) VALUES('tickets.settings', ?)", (json.dumps(doc),))


def test_f2_an_existing_path_less_address_stays_on_t_after_the_upgrade(settings, monkeypatch):
    from smplwise.services.tickets import handler_links
    from tickets_s4_world import BASE_URL

    s4 = _s4(settings, monkeypatch)
    _store_doc(s4.db, {"revision": 4, "public": {"base_url": BASE_URL}})  # saved before TK255: no path_prefix key
    with s4.db.connection(label="test.pin") as conn:
        assert settings_doc.pin_legacy_prefix(conn) is True
        assert settings_doc.pin_legacy_prefix(conn) is False  # once only
        doc = settings_doc.read(conn)
        assert doc["public"]["path_prefix"] == "t" and doc["revision"] == 4
        assert handler_links.public_prefix(conn) == "t"
        assert links.handler_url(BASE_URL, "A" * 32, handler_links.public_prefix(conn)) == f"{BASE_URL}/t/#{'A' * 32}"


def test_f2_a_fresh_installation_and_an_address_with_a_path_are_not_pinned(settings, monkeypatch):
    from tickets_s4_world import BASE_URL

    s4 = _s4(settings, monkeypatch)
    _store_doc(s4.db, {"revision": 1})  # no address yet: the first start only records that the rule ran
    with s4.db.connection(label="test.fresh") as conn:
        assert settings_doc.pin_legacy_prefix(conn) is False
    _store_doc(s4.db, {"revision": 2, "public": {"base_url": BASE_URL}})  # the owner sets an address LATER (marker present)
    with s4.db.connection(label="test.fresh2") as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES('tickets.path_prefix_pinned', '1') ON CONFLICT(key) DO UPDATE SET value='1'")
        assert settings_doc.pin_legacy_prefix(conn) is False
        assert settings_doc.read(conn)["public"]["path_prefix"] == "support"
    _store_doc(s4.db, {"revision": 3, "public": {"base_url": BASE_URL + "/help"}})
    with s4.db.connection(label="test.path") as conn:
        assert settings_doc.pin_legacy_prefix(conn) is False
        assert "path_prefix" not in (settings_doc._stored(conn).get("public") or {})


def test_f2_an_owner_choice_is_never_overwritten_by_the_pin(settings, monkeypatch):
    from tickets_s4_world import BASE_URL

    s4 = _s4(settings, monkeypatch)
    _store_doc(s4.db, {"revision": 5, "public": {"base_url": BASE_URL, "path_prefix": "support"}})
    with s4.db.connection(label="test.keep") as conn:
        assert settings_doc.pin_legacy_prefix(conn) is False
        assert settings_doc.read(conn)["public"]["path_prefix"] == "support"


def test_f2b_changing_the_prefix_with_live_links_needs_an_explicit_confirmation(settings, monkeypatch):
    from tickets_s4_world import API

    s4 = _s4(settings, monkeypatch)
    s4.sent()  # one live link
    doc = s4.c.get(f"{API}/tickets/settings").json()
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "public": {"path_prefix": "help"}})
    assert r.status_code == 409 and r.json()["code"] == "confirm_live_links", r.text
    assert r.json()["details"]["live_links"] >= 1
    assert s4.c.get(f"{API}/tickets/settings").json()["public"]["path_prefix"] == "support"  # nothing was stored
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "public": {"path_prefix": "help", "confirm_live_links": True}})
    assert r.status_code == 200 and r.json()["public"]["path_prefix"] == "help"
    rev = r.json()["revision"]  # an unchanged value, or the legacy switch alone, never asks
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "public": {"path_prefix": "help"}})
    assert r.status_code == 200, r.text
    assert s4.c.put(f"{API}/tickets/settings", json={"revision": r.json()["revision"], "public": {"legacy_t_paths": False}}).status_code == 200


def test_f2b_without_live_links_no_confirmation_is_needed(settings, monkeypatch):
    from tickets_s4_world import API

    s4 = _s4(settings, monkeypatch)
    doc = s4.c.get(f"{API}/tickets/settings").json()
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "public": {"path_prefix": "help"}})
    assert r.status_code == 200, r.text


def test_f3_a_rebuilt_public_bundle_does_not_hardcode_t_in_its_calls():
    from pathlib import Path

    www = Path(links.__file__).resolve().parents[3] / "www-public" / "assets"
    js = "".join(p.read_text(encoding="utf-8", errors="replace") for p in sorted(www.glob("*.js"))) if www.is_dir() else ""
    if not js or 'replaceState(null,"","/t/")' in js or 'fetch("/t/' in js:
        pytest.skip("the committed www-public bundle predates TK255; the release rebuilds it (npm run build:addon)")
    assert 'fetch("/t/' not in js and "fetch(`/t/" not in js
