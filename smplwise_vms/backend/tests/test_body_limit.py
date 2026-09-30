"""Request body limits enforced while the body streams (smplwise/body_limit.py; round-10 §6.1 and CR-008 §9 open item,
closed 2026-09-30): an oversized Content-Length is refused before a byte is read, a chunked body is cut at the limit,
nothing is left in the temp directory, every upload route still takes its own maximum, and the remote channel caps
anonymous callers."""
from __future__ import annotations

import asyncio
import dataclasses
import json
import tempfile

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from conftest import png_bytes, seed_tree
from smplwise import body_limit as bl
from smplwise.main import create_app
from smplwise.services import ha_user_auth as hua
from test_remote_access import ORIGIN, Arx

MiB = 1024 * 1024


def _run(app, scope: dict, chunks: list[bytes]) -> tuple[list[dict], dict]:
    """Drive an ASGI app with a chunked body (no Content-Length unless the scope has one); returns the messages sent and
    how many body messages were pulled from the client."""
    pulled = {"n": 0, "bytes": 0}
    queue = list(chunks)

    async def receive():
        if not queue:  # the whole body was sent: the client waits for the answer, then goes away
            await state["done"].wait()
            return {"type": "http.disconnect"}
        chunk = queue.pop(0)
        pulled["n"] += 1
        pulled["bytes"] += len(chunk)
        return {"type": "http.request", "body": chunk, "more_body": bool(queue)}

    sent: list[dict] = []
    state: dict = {}

    async def send(message):
        sent.append(message)
        if message["type"] == "http.response.body" and not message.get("more_body"):
            state["done"].set()

    async def main():
        state["done"] = asyncio.Event()
        await asyncio.wait_for(app(full, receive, send), 30)


    full = {"type": "http", "http_version": "1.1", "method": "POST", "scheme": "http", "path": "/api/v1/x", "raw_path": b"/api/v1/x",
            "root_path": "", "query_string": b"", "headers": [], "client": ("127.0.0.1", 5000), "server": ("testserver", 80), **scope}
    asyncio.run(main())
    return sent, pulled


def _status(sent: list[dict]) -> int:
    return next(m["status"] for m in sent if m["type"] == "http.response.start")


def _json(sent: list[dict]) -> dict:
    return json.loads(b"".join(m.get("body", b"") for m in sent if m["type"] == "http.response.body"))


# ---------------------------------------------------------------- the table

def test_the_limits_table(settings):
    from smplwise.routers import catalog, remote
    from smplwise.routers.settings import SettingsPatch
    from smplwise.services import backup
    from smplwise.services.skins import store

    slack = bl.MULTIPART_SLACK
    expect = {
        ("POST", "/api/v1/floors/f1/plan-assets"): settings.max_upload_bytes + slack,
        ("POST", "/api/v1/sites/s1/image"): catalog.IMAGE_MAX_BYTES + slack,
        ("POST", "/api/v1/buildings/b1/image"): catalog.IMAGE_MAX_BYTES + slack,
        ("POST", "/api/v1/floors/f1/skins/control-image"): store.CONTROL_MAX_BYTES + slack,
        ("POST", "/api/v1/backups/upload"): backup.MAX_UPLOAD + slack,
        ("POST", "/api/v1/cases/bundles/verify"): 4096 * MiB + slack,
        ("POST", "/api/v1/cases/bundles/import"): 4096 * MiB + slack,
        ("PUT", "/api/v1/plan-versions/v1/geometry"): 16 * MiB,
        ("POST", "/api/v1/plan-versions/v1/detect/accept"): 16 * MiB,
        ("POST", "/api/v1/catalog/import"): 8 * MiB,
        ("POST", "/api/v1/csp-report"): remote.CSP_BODY_MAX,
        ("POST", "/api/v1/sites"): 1 * MiB,
        ("PUT", "/api/v1/intercom/people/u1"): 1 * MiB,
        ("POST", "/api/v1/backups/b.zip/restore"): 1 * MiB,
        ("GET", "/api/v1/floors/f1/plan-assets"): 1 * MiB,  # the upload limit is for the upload method only
    }
    for (method, path), limit in expect.items():
        assert bl.route_limit(method, path, settings)[0] == limit, (method, path)
    # the bundle ceiling is the largest value the cases.import_max_mb setting accepts
    le = [m.le for m in SettingsPatch.model_fields["cases_import_max_mb"].metadata if getattr(m, "le", None) is not None]
    assert le == [4096]
    # the plan limit follows the add-on option
    assert bl.route_limit("POST", "/api/v1/floors/f1/plan-assets", dataclasses.replace(settings, max_upload_bytes=3 * MiB))[0] == 3 * MiB + slack


def test_every_rule_names_a_real_route():
    """A renamed route must not silently fall back to the 1 MiB default (or keep a stale large limit)."""
    from test_plan_routes_unique import _routers

    routes = [(m, "/api/v1" + r.path) for router in _routers().values() for r in router.routes if isinstance(r, APIRoute) for m in r.methods]
    assert len(routes) > 200
    for methods, pattern, _limit, name in bl.LIMITS:
        hits = [(m, p) for m, p in routes if m in methods and pattern.fullmatch("/".join("x" if s.startswith("{") else s for s in p.split("/")))]
        assert hits, name


# ---------------------------------------------------------------- the middleware on its own

def _reader(record: dict):
    """An app that reads the whole body through Starlette's stream and answers 200."""
    from starlette.requests import Request

    async def app(scope, receive, send):
        record["called"] = True
        got = 0
        async for chunk in Request(scope, receive).stream():
            got += len(chunk)
            record["got"] = got
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    return app


def test_an_oversized_content_length_is_refused_before_any_byte_is_read(settings):
    record: dict = {}
    mw = bl.BodyLimit(_reader(record), settings)
    sent, pulled = _run(mw, {"headers": [(b"content-length", str(MiB + 1).encode()), (b"x-correlation-id", b"abc")]}, [b"x" * (MiB + 1)])
    assert _status(sent) == 413 and pulled["n"] == 0 and "called" not in record
    body = _json(sent)
    assert body == {"code": "payload_too_large", "user_message": body["user_message"], "retryable": False, "correlation_id": "abc",
                    "details": {"max_bytes": MiB, "stage": "request_body", "rule": "default"}}
    assert "1 MB" in body["user_message"]
    headers = dict(sent[0]["headers"])
    assert headers[b"connection"] == b"close" and headers[b"content-type"] == b"application/json"
    # exactly the limit passes
    record.clear()
    sent, pulled = _run(mw, {"headers": [(b"content-length", str(MiB).encode())]}, [b"x" * MiB])
    assert _status(sent) == 200 and record["got"] == MiB


def test_a_chunked_body_is_cut_at_the_limit(settings):
    record: dict = {}
    mw = bl.BodyLimit(_reader(record), settings)
    chunk = 64 * 1024
    sent, pulled = _run(mw, {}, [b"x" * chunk] * 40)  # 2.5 MiB, no Content-Length
    assert _status(sent) == 413 and _json(sent)["details"]["stage"] == "request_body"
    assert pulled["n"] == MiB // chunk + 1  # the crossing chunk is the last one pulled ...
    assert record["got"] <= MiB  # ... and never handed to the application
    assert len([m for m in sent if m["type"] == "http.response.start"]) == 1  # the application's own answer was dropped
    record.clear()
    sent, _ = _run(mw, {}, [b"x" * chunk] * 16)  # exactly 1 MiB
    assert _status(sent) == 200 and record["got"] == MiB


def test_websockets_and_streaming_responses_pass_untouched(settings):
    seen: dict = {}

    async def ws_app(scope, receive, send):
        seen["receive"], seen["send"] = receive, send

    async def recv():
        return {"type": "websocket.connect"}

    async def snd(_m):
        return None

    asyncio.run(bl.BodyLimit(ws_app, settings)({"type": "websocket", "path": "/api/v1/media/live/c/ws", "headers": []}, recv, snd))
    assert seen["receive"] is recv and seen["send"] is snd

    async def streamer(scope, receive, send):
        await send({"type": "http.response.start", "status": 200, "headers": []})
        for i in range(5):
            await send({"type": "http.response.body", "body": b"%d" % i, "more_body": True})
        await send({"type": "http.response.body", "body": b"", "more_body": False})

    sent, _ = _run(bl.BodyLimit(streamer, settings), {"method": "GET"}, [b""])
    assert [m.get("body") for m in sent[1:]] == [b"0", b"1", b"2", b"3", b"4", b""]


# ---------------------------------------------------------------- the real application

def _multipart(boundary: str, name: str, filename: str, payload_chunks: list[bytes], fields: dict[str, str] | None = None) -> list[bytes]:
    head = b""
    for k, v in (fields or {}).items():
        head += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    head += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{filename}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode()
    return [head, *payload_chunks, f"\r\n--{boundary}--\r\n".encode()]


def test_a_cut_multipart_upload_leaves_the_temp_dir_empty(settings, tmp_path, monkeypatch):
    """The plan upload over the limit: the multipart parser had spooled past 1 MiB (a temp FILE) when the body was cut;
    it is closed and gone, and nothing reached the plans folder."""
    spool = tmp_path / "spool"
    spool.mkdir()
    monkeypatch.setattr(tempfile, "tempdir", str(spool))
    s = dataclasses.replace(settings, max_upload_bytes=2 * MiB)
    app = create_app(s)
    floor = seed_tree(TestClient(app))["floor2"]
    boundary = "swBodyLimit"
    chunks = _multipart(boundary, "file", "plan.png", [b"\x89PNG" + b"\x00" * (256 * 1024 - 4)] + [b"\x00" * (256 * 1024)] * 23)  # 6 MiB
    path = f"/api/v1/floors/{floor}/plan-assets"
    sent, pulled = _run(app, {"path": path, "raw_path": path.encode(),
                              "headers": [(b"content-type", f"multipart/form-data; boundary={boundary}".encode()), (b"host", b"testserver")]}, chunks)
    assert _status(sent) == 413 and _json(sent)["details"] == {"max_bytes": 2 * MiB + bl.MULTIPART_SLACK, "stage": "request_body", "rule": "plan_upload"}
    assert pulled["bytes"] <= 2 * MiB + bl.MULTIPART_SLACK + 256 * 1024 and pulled["bytes"] > 1 * MiB  # past the spool size
    assert list(spool.iterdir()) == []
    assert not any(s.plans_dir.rglob("source.*"))
    # and a declared oversized body: refused at the headers, nothing spooled either
    r = TestClient(app).post(path, files={"file": ("plan.png", b"\x89PNG" + b"\x00" * (3 * MiB), "image/png")})
    assert r.status_code == 413 and r.json()["details"]["stage"] == "request_body"
    assert list(spool.iterdir()) == []


def _padded_png(size: int) -> bytes:
    data = png_bytes(64, 48)
    return data + b"\x00" * (size - len(data))  # trailing bytes after IEND: still a readable PNG of exactly `size`


def test_each_upload_route_still_takes_its_maximum(settings, monkeypatch):
    from smplwise.routers import catalog
    from smplwise.services import backup
    from smplwise.services.skins import store

    cap = 2 * MiB
    monkeypatch.setattr(catalog, "IMAGE_MAX_BYTES", cap)
    monkeypatch.setattr(backup, "MAX_UPLOAD", cap)
    monkeypatch.setattr(store, "CONTROL_MAX_BYTES", cap)
    app = create_app(dataclasses.replace(settings, max_upload_bytes=cap))
    c = TestClient(app)
    tree = seed_tree(c)

    def over(path: str, **form) -> None:
        r = c.post(path, files={"file": ("x.bin", b"\x00" * (cap + bl.MULTIPART_SLACK), "application/octet-stream")}, **form)
        assert r.status_code == 413 and r.json()["details"]["stage"] == "request_body", (path, r.text)

    # plan upload: a PNG of exactly the cap is stored
    path = f"/api/v1/floors/{tree['floor2']}/plan-assets"
    r = c.post(path, files={"file": ("plan.png", _padded_png(cap), "image/png")})
    assert r.status_code == 201, r.text
    over(path)
    # site / building image: exactly the cap is stored
    for kind, oid in (("sites", tree["site"]), ("buildings", tree["building"])):
        r = c.post(f"/api/v1/{kind}/{oid}/image", files={"file": ("p.png", _padded_png(cap), "image/png")})
        assert r.status_code == 200, r.text
        over(f"/api/v1/{kind}/{oid}/image")
    # backup upload: exactly the cap reaches the route in full (not a backup, so the route itself refuses it: 422)
    r = c.post("/api/v1/backups/upload", files={"file": ("b.zip", b"\x00" * cap, "application/zip")})
    assert r.status_code == 422 and r.json()["code"] == "invalid_backup", r.text
    over("/api/v1/backups/upload")
    # skins control image: exactly the cap reaches the route (no published structure yet: the route's own 409)
    path = f"/api/v1/floors/{tree['floor2']}/skins/control-image"
    form = {"state": store.STATES[0], "geometry_key": "0" * 64}
    r = c.post(path, data=form, files={"file": ("c.png", _padded_png(cap), "image/png")})
    assert r.status_code == 409 and r.json()["code"] == "no_geometry", r.text
    over(path, data=form)
    # a large JSON document route takes more than the 1 MiB default; an ordinary JSON route does not
    big = {"doc": {"pad": "x" * (2 * MiB)}, "base_revision": 0}
    r = c.put("/api/v1/plan-versions/nope/geometry", json=big)
    assert r.status_code != 413, r.text
    r = c.post("/api/v1/sites", json={"name": "x" * (2 * MiB)})
    assert r.status_code == 413 and r.json()["details"]["rule"] == "default"


# ---------------------------------------------------------------- the remote channel

@pytest.fixture()
def arx(settings, tmp_path, monkeypatch):
    a = Arx(settings, tmp_path, monkeypatch)
    a.flag("u-owner")
    a.bind("u-owner", "system_admin")
    yield a
    hua.reset_for_tests()


def test_remote_unauthenticated_cap(arx):
    anon = TestClient(arx.app, headers=ORIGIN)
    # the sign-in endpoints take 4 KiB, and the 413 carries the remote channel's security headers
    r = anon.post("/arx/api/v1/auth/session", content=b"x" * (4 * 1024 + 1), headers={"Content-Type": "application/json"})
    assert r.status_code == 413 and r.json()["details"]["rule"] == "remote_public"
    assert "frame-ancestors 'self'" in r.headers["content-security-policy"] and r.headers["cache-control"] == "no-store"
    assert anon.get("/arx/api/v1/auth/remote-config").status_code == 200
    # an upload route, no credential: 64 KiB at most - refused before the body is spooled (it used to be read in full,
    # then refused 401 by the authentication that runs after it)
    files = {"file": ("plan.png", b"\x00" * (100 * 1024), "image/png")}
    r = anon.post("/arx/api/v1/floors/f1/plan-assets", files=files)
    assert r.status_code == 413 and r.json()["details"] == {"max_bytes": 64 * 1024, "stage": "request_body", "rule": "remote_anonymous"}
    assert anon.post("/arx/api/v1/floors/f1/plan-assets", files={"file": ("p.png", b"\x00" * 1024, "image/png")}).status_code == 401
    # a cookie of no live session is anonymous too
    fake = TestClient(arx.app, headers=ORIGIN)
    fake.cookies.set("arx_session", "0" * 20)
    assert fake.post("/arx/api/v1/floors/f1/plan-assets", files=files).status_code == 413
    # the same upload with a live session reaches the route (which answers for the unknown floor)
    assert arx.login(arx.owner).status_code == 200
    r = arx.client.post("/arx/api/v1/floors/f1/plan-assets", files=files)
    assert r.status_code == 404, r.text
    # a bearer token: anonymous until its first (small) request made it a known bearer session
    token = arx.token(arx.owner)
    bearer = TestClient(arx.app, headers={"Authorization": f"Bearer {token}"})
    assert bearer.post("/arx/api/v1/floors/f1/plan-assets", files=files).status_code == 413
    assert bearer.get("/arx/api/v1/me").status_code == 200
    assert bearer.post("/arx/api/v1/floors/f1/plan-assets", files=files).status_code == 404
    # the CSP sink keeps its own 16 KiB bound, now before the body is read
    r = anon.post("/arx/api/v1/csp-report", content=b"{" + b" " * (17 * 1024) + b"}", headers={"Content-Type": "application/json"})
    assert r.status_code == 413 and r.json()["details"]["rule"] == "csp_report"
    # the Ingress channel is not capped as anonymous (its identity comes from the Supervisor, not from a session)
    local = TestClient(arx.app)
    assert local.post("/api/v1/floors/f1/plan-assets", files=files).status_code == 404


# ---------------------------------------------------------------- odd spellings never bypass a limit (review)

def _scope(path: str, method: str = "POST", root_path: str = "", remote: bool = False) -> dict:
    from smplwise.remote_channel import CHANNEL_KEY, REMOTE

    return {"type": "http", "method": method, "path": path, "root_path": root_path, "headers": [], "query_string": b"",
            "state": {CHANNEL_KEY: REMOTE} if remote else {}}


def test_odd_spellings_of_a_route_never_get_more_than_the_route_itself(settings):
    canonical = {
        "/api/v1/floors/f1/plan-assets": "plan_upload", "/api/v1/backups/upload": "backup_upload", "/api/v1/catalog/import": "catalog_import",
        "/api/v1/plan-versions/v1/geometry": "geometry_document", "/api/v1/cases/bundles/import": "evidence_bundle",
    }
    for path, rule in canonical.items():
        method = "PUT" if path.endswith("/geometry") else "POST"
        limit, name = bl.limit_for(_scope(path, method), settings)
        assert name == rule
        head, tail = path.rsplit("/", 1)
        for odd in (path + "/", path + "//", path.replace("/api/v1/", "/api/v1//"), f"{head}/./{tail}", f"{head}/x/../{tail}",
                    f"{head}/%{ord(tail[0]):02x}{tail[1:]}", f"{head}/%25{ord(tail[0]):02x}{tail[1:]}", path.replace("/v1/", "/%76%31/", 1)):
            got, _ = bl.limit_for(_scope(odd, method), settings)
            assert got <= limit, (odd, got, limit)  # never larger; the spelling the router does not know falls to the strictest


def test_odd_spellings_of_a_tight_route_keep_its_tight_limit(settings):
    from smplwise.routers import remote

    for odd in ("/api/v1/csp-report", "/api/v1/csp-report/", "/api/v1//csp-report", "/api/v1/./csp-report", "/api/v1/x/../csp-report",
                "/api/v1/%63sp-report", "/api/v1/csp%2Dreport", "/api/v1/csp%252Dreport"):
        assert bl.limit_for(_scope(odd), settings) == (remote.CSP_BODY_MAX, "csp_report"), odd
    # the remote channel: the sign-in paths keep 4 KiB whether the scope carries a root_path (RemoteChannel) or the whole path
    for path, root in (("/arx/api/v1/auth/session", "/arx"), ("/arx/api/v1/auth/session/", "/arx"), ("/arx//api/v1/auth/session", "/arx"),
                       ("/arx/api/v1/auth/%73ession", "/arx"), ("/arx/api/v1/auth/session", ""), ("/arx/api/v1/auth/session/", ""),
                       ("/arx/.well-known/x", "/arx"), ("/arx/.well-known/x/", "/arx"), ("/api/v1/auth/session", "/arx")):
        assert bl.limit_for(_scope(path, root_path=root, remote=True), settings) == (bl.REMOTE_PUBLIC_MAX, "remote_public"), (path, root)


def test_the_limit_follows_the_routed_path_not_the_raw_one(settings):
    # RemoteChannel sets root_path; the router matches the path without it, so does the limit
    assert bl.routed_path({"path": "/arx/api/v1/backups/upload", "root_path": "/arx"}) == "/api/v1/backups/upload"
    assert bl.routed_path({"path": "/arx", "root_path": "/arx"}) == ""
    assert bl.routed_path({"path": "/arxiv/x", "root_path": "/arx"}) == "/arxiv/x"  # not a path segment boundary: untouched
    assert bl.routed_path({"path": "/api/v1/x"}) == "/api/v1/x"
    # an oddly spelled upload path on the remote channel, no credential: never above the anonymous cap
    limit, name = bl.limit_for(_scope("/arx/api/v1//backups/upload/", root_path="/arx", remote=True), settings)
    assert limit <= bl.REMOTE_ANONYMOUS_MAX and name in ("remote_anonymous", "default")


def test_the_real_app_cuts_an_oddly_spelled_upload_at_the_strictest_limit(settings):
    c = TestClient(create_app(settings))
    big = b"x" * (2 * MiB)  # between the 1 MiB default and the plan upload's 5 MiB + slack
    # the canonical spelling reaches the route (an unknown floor: 404, or 401/403 - anything but the body limit) ...
    assert c.post("/api/v1/floors/f1/plan-assets", files={"file": ("p.png", big, "image/png")}).status_code != 413
    # ... an odd spelling is judged at the strictest: cut at 1 MiB before it is parsed, never routed to the larger limit
    for odd in ("/api/v1/floors/f1/plan-assets/", "/api/v1//floors/f1/plan-assets"):  # (the HTTP client itself resolves dot segments; those are covered on the scope above)
        r = c.post(odd, files={"file": ("p.png", big, "image/png")}, follow_redirects=False)
        assert r.status_code == 413, (odd, r.status_code)
