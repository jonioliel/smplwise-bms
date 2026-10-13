"""CR-038 public app + edge (services/tickets/public_app.py, public_http.py) at the ASGI level, over in-memory fakes: only /t/*
routes, the spec 10.4 headers on every answer, no cookies, no CORS, the uniform 404 (byte-identical for unknown / expired /
revoked / past grace / module off / malformed / missing token / unknown path / wrong method), the rate gate BEFORE any lookup,
the trusted-proxy rule, JSON-only bodies with size caps and the input-free 422 envelope, read-only grace, the code session,
the code / redeem / photo routes, idempotency, the 500 path. A small router below plays the routes slice 4 will add, built
only from the helpers this branch exports. Every value is invented; addresses are documentation ranges."""
from __future__ import annotations

import io
import json
import uuid

import pytest
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel, ConfigDict

from smplwise.services.tickets import codes as cd
from smplwise.services.tickets import links
from smplwise.services.tickets.public_app import (FALLBACK_SHELL, Idempotency, LinkContext, PublicError, link_context,
                                                  parse_client_request_id, parse_json_object, read_json)
from smplwise.services.tickets.public_http import CSP, JSON_MAX, ROUTES, SECURITY_HEADERS, RouteRule
from smplwise.services.tickets.text_hygiene import clean_str
from tests.tickets_public_fakes import KEY, build_world

PHONE = "972501234567"


# ---------------------------------------------------------------- the routes slice 4 adds, as a test double


class NoteIn(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    text: clean_str(2000, multiline=True)
    client_request_id: str


def slice4_router(world_box: dict) -> APIRouter:
    r = APIRouter()
    notes: list[str] = world_box.setdefault("notes", [])

    @r.get("/t/api/ticket")
    async def ticket(ctx: LinkContext = Depends(link_context())) -> dict:
        if not ctx.code_ok:
            return {"number": ctx.link.ticket_number, "code_required": True}
        return {"number": ctx.link.ticket_number, "title": "מזגן חדר 102", "read_only": ctx.read_only, "code_required": ctx.link.require_code}

    @r.post("/t/api/note")
    async def note(request: Request, ctx: LinkContext = Depends(link_context(write=True))) -> JSONResponse:
        body: NoteIn = await read_json(request, NoteIn)
        crid = parse_client_request_id(body.client_request_id)

        async def work():
            notes.append(body.text)
            return 200, {"ok": True, "text": body.text}

        return await world_box["idem"].run(f"link:{ctx.link.link_id}", crid, "/t/api/note", work)

    @r.post("/t/api/test-crash")
    async def crash(ctx: LinkContext = Depends(link_context(write=True))) -> dict:
        raise ValueError(f"secret {PHONE} in an exception message")

    @r.get("/t/api/test-cookie")
    async def cookie(request: Request, ctx: LinkContext = Depends(link_context())) -> JSONResponse:
        resp = JSONResponse({"saw_cookie": "cookie" in request.headers})
        resp.set_cookie("arx_session", "stolen")
        resp.headers["access-control-allow-origin"] = "*"
        resp.headers["server"] = "evil/1.0"
        return resp

    return r


TEST_RULES = ROUTES + (
    RouteRule("POST", r"/t/api/test-crash", "/t/api/test-crash", "token_write", "json", JSON_MAX),
    RouteRule("GET", r"/t/api/test-cookie", "/t/api/test-cookie", "token_read"),
)


@pytest.fixture()
def w(tmp_path):
    box: dict = {}
    world = build_world(tmp_path, routers=(slice4_router(box),), rules=TEST_RULES)
    box["idem"] = Idempotency(world.requests)
    world.notes = box["notes"]  # type: ignore[attr-defined]
    return world


def crid() -> str:
    return str(uuid.uuid4())


def note(client, token, text="בוצע", rid=None, session=None, **kw):
    headers = {"x-ticket-token": token}
    if session:
        headers["x-ticket-session"] = session
    return client.post("/t/api/note", json={"text": text, "client_request_id": crid() if rid is None else rid, **kw}, headers=headers)


def raw(resp) -> tuple:
    return resp.status_code, [(k.lower(), v) for k, v in resp.headers.raw], resp.content


# ---------------------------------------------------------------- surface, headers, cookies, CORS


def _paths(routes) -> list[str]:
    out: list[str] = []
    for r in routes:
        if hasattr(r, "original_router"):  # FastAPI 0.141 includes a router lazily (no prefix is used here)
            out += _paths(r.original_router.routes)
        else:
            out.append(getattr(r, "path", ""))
    return out


def test_the_app_and_the_edge_know_only_t_routes(w):
    paths = _paths(w.app.api.routes)
    assert len(paths) >= 12 and all(p.startswith("/t/") for p in paths), paths
    assert all(rule.template.startswith("/t/") for rule in ROUTES)
    assert w.app.api.openapi_url is None and w.app.api.docs_url is None


def test_every_answer_carries_the_spec_10_4_headers(w):
    link, tok = w.links.add()
    c = w.client()
    answers = [c.get("/t/"), c.get("/t/healthz"), c.get("/t/api/ticket", headers={"x-ticket-token": tok}), c.get("/nope"),
               c.post("/t/api/note", content=b"x", headers={"x-ticket-token": tok, "content-type": "text/plain"}),
               c.post("/t/api/note", content=b"{", headers={"x-ticket-token": tok, "content-type": "application/json"}),
               c.post("/t/api/note", content=b"x" * (JSON_MAX + 1), headers={"x-ticket-token": tok, "content-type": "application/json"})]
    assert [a.status_code for a in answers] == [200, 200, 200, 404, 415, 422, 413]
    for a in answers:
        for k, v in SECURITY_HEADERS:
            assert a.headers.get(k.decode()) == v.decode(), (a.status_code, k)
        assert a.headers["content-security-policy"] == CSP and "unsafe-inline" not in CSP
        assert "server" not in a.headers and "set-cookie" not in a.headers and "access-control-allow-origin" not in a.headers
        assert a.headers.get("cache-control") == "no-store"


def test_no_cookie_in_and_none_out_and_no_cors(w):
    link, tok = w.links.add()
    c = w.client()
    r = c.get("/t/api/test-cookie", headers={"x-ticket-token": tok, "cookie": "arx_session=abc; other=1", "origin": "https://evil.example"})
    assert r.status_code == 200 and r.json() == {"saw_cookie": False}
    assert "set-cookie" not in r.headers and r.headers.get("server") is None and "access-control-allow-origin" not in r.headers
    pre = c.options("/t/api/note", headers={"origin": "https://evil.example", "access-control-request-method": "POST",
                                            "access-control-request-headers": "x-ticket-token"})
    assert pre.status_code == 404 and "access-control-allow-origin" not in pre.headers


def test_uniform_404_is_byte_identical_for_every_unavailable_case(w):
    c = w.client()
    now = w.clock()
    _l, live = w.links.add()
    _e, expired = w.links.add(ttl_s=-1)
    _r, revoked = w.links.add(revoked=True)
    _g, past_grace = w.links.add(grace_until=now - 1)
    _p, unknown = None, links.derive_token(KEY, links.new_link_id(), 1)
    gen2_link, gen2 = w.links.add(generation=2)
    gen1_of_same = links.derive_token(KEY, gen2_link.link_id, 1)  # an older generation's token
    cases = {
        "unknown": c.get("/t/api/ticket", headers={"x-ticket-token": unknown}),
        "expired": c.get("/t/api/ticket", headers={"x-ticket-token": expired}),
        "revoked": c.get("/t/api/ticket", headers={"x-ticket-token": revoked}),
        "past_grace": c.get("/t/api/ticket", headers={"x-ticket-token": past_grace}),
        "old_generation": c.get("/t/api/ticket", headers={"x-ticket-token": gen1_of_same}),
        "malformed": c.get("/t/api/ticket", headers={"x-ticket-token": live[:-1]}),
        "missing": c.get("/t/api/ticket"),
        "unknown_path": c.get("/t/api/secret"),
        "outside": c.get("/api/v1/me"),
        "wrong_method": c.put("/t/api/ticket", headers={"x-ticket-token": live}),
        "head": c.head("/t/"),
        "options": c.options("/t/api/ticket"),
    }
    w.switch.on = False
    cases["module_off_api"] = c.get("/t/api/ticket", headers={"x-ticket-token": live})
    cases["module_off_shell"] = c.get("/t/")
    cases["module_off_health"] = c.get("/t/healthz")
    reference = raw(cases["unknown"])
    assert reference[0] == 404 and reference[2] == b'{"code":"link_unavailable"}'
    for name, resp in cases.items():
        if name == "head":
            assert resp.status_code == 404 and [h for h in raw(resp)[1]] == reference[1], name
            continue
        assert raw(resp) == reference, name


def test_each_dead_token_costs_exactly_one_lookup_and_a_counted_failure(w):
    c = w.client()
    _e, expired = w.links.add(ttl_s=-1)
    before = w.links.lookups
    for _ in range(3):
        c.get("/t/api/ticket", headers={"x-ticket-token": expired})
    assert w.links.lookups - before == 3
    assert w.app.gate.limiter.count("fail:198.51.100.0/24", 60) == 3


# ---------------------------------------------------------------- the rate gate runs before any lookup


def test_a_locked_network_gets_429_without_a_lookup(w):
    c = w.client()
    for _ in range(20):
        assert c.get("/t/api/ticket", headers={"x-ticket-token": links.derive_token(KEY, links.new_link_id(), 1)}).status_code == 404
    n = w.links.lookups
    r = c.get("/t/api/ticket", headers={"x-ticket-token": links.derive_token(KEY, links.new_link_id(), 1)})
    assert r.status_code == 429 and r.json()["code"] == "rate_limited" and 1 <= int(r.headers["retry-after"]) <= 60
    assert w.links.lookups == n  # no database read for an over-limit request
    assert w.client(peer="203.0.113.5").get("/t/api/ticket", headers={"x-ticket-token": "B" * 32}).status_code == 404


def test_missing_or_malformed_tokens_never_reach_the_store(w):
    c = w.client()
    for value in (None, "", "short", "x" * 33, "A" * 31 + "!", "A" * 32 + " "):
        headers = {} if value is None else {"x-ticket-token": value}
        assert c.get("/t/api/ticket", headers=headers).status_code in (404, 429)
    assert w.links.lookups == 0


def test_global_flood_spares_a_vendor_already_working(w):
    link, tok = w.links.add()
    working = w.client(peer="192.0.2.50")
    assert working.get("/t/api/ticket", headers={"x-ticket-token": tok}).status_code == 200
    for i in range(300):  # failures from 30 networks, none of them reaching its own cap of 20
        w.app.gate.failure(f"198.51.{i % 30}.0/24")
    n = w.links.lookups
    fresh_link, fresh = w.links.add()
    r = w.client(peer="203.0.113.9").get("/t/api/ticket", headers={"x-ticket-token": fresh})
    assert r.status_code == 429 and w.links.lookups == n
    assert working.get("/t/api/ticket", headers={"x-ticket-token": tok}).status_code == 200


def test_a_path_scan_pays_the_static_budget(w):
    c = w.client(peer="192.0.2.99")
    codes = [c.get(f"/scan/{i}").status_code for i in range(125)]
    assert codes[:120] == [404] * 120 and set(codes[120:]) == {429}
    assert c.get("/t/").status_code == 429  # the same budget: a scanner learns nothing about which paths exist
    assert w.client(peer="203.0.113.1").get("/scan/x").status_code == 404


def test_per_token_request_cap(w):
    link, tok = w.links.add()
    c = w.client()
    codes = [c.get("/t/api/ticket", headers={"x-ticket-token": tok}).status_code for _ in range(61)]
    assert codes.count(200) == 60 and codes[-1] == 429


def test_cf_connecting_ip_counts_only_behind_a_trusted_peer(w):
    tunnel = w.client(peer="172.30.32.7")  # cloudflared on the hassio network
    for _ in range(20):
        tunnel.get("/t/api/ticket", headers={"x-ticket-token": "C" * 32, "cf-connecting-ip": "198.51.100.77"})
    assert tunnel.get("/t/api/ticket", headers={"x-ticket-token": "D" * 32, "cf-connecting-ip": "198.51.100.78"}).status_code == 429
    assert tunnel.get("/t/api/ticket", headers={"x-ticket-token": "D" * 32, "cf-connecting-ip": "203.0.113.4"}).status_code == 404
    lan = w.client(peer="192.0.2.20")  # a mapped port: the header is the client's own choice and changes nothing
    for i in range(20):
        lan.get("/t/api/ticket", headers={"x-ticket-token": "E" * 32, "cf-connecting-ip": f"203.0.113.{i}"})
    assert lan.get("/t/api/ticket", headers={"x-ticket-token": "E" * 32, "cf-connecting-ip": "203.0.113.200"}).status_code == 429


# ---------------------------------------------------------------- bodies: JSON only, caps, the 422 envelope


def test_json_only_and_size_caps_before_any_lookup(w):
    link, tok = w.links.add()
    c = w.client()
    h = {"x-ticket-token": tok}
    n = w.links.lookups
    assert c.post("/t/api/note", data={"text": "x"}, headers=h).status_code == 415  # a form post (CSRF shape)
    assert c.post("/t/api/note", content=b"{}", headers={**h, "content-type": "text/plain"}).status_code == 415
    assert c.post("/t/api/note", content=b"{}", headers={**h, "content-type": "application/json; charset=latin-1"}).status_code == 415
    big = c.post("/t/api/note", content=b"{" + b" " * JSON_MAX + b"}", headers={**h, "content-type": "application/json"})
    assert big.status_code == 413 and big.json() == {"code": "too_large", "max_bytes": JSON_MAX} and big.headers["connection"] == "close"
    assert c.request("GET", "/t/api/ticket", content=b"body", headers=h).status_code == 413
    assert w.links.lookups == n


def test_a_chunked_body_over_the_cap_is_cut_while_it_streams(w):
    link, tok = w.links.add()

    def chunks():
        for _ in range(40):
            yield b" " * 1024

    r = w.client().post("/t/api/note", content=chunks(), headers={"x-ticket-token": tok, "content-type": "application/json"})
    assert r.status_code == 413 and r.json()["code"] == "too_large"


@pytest.mark.parametrize("body", [b"{", b"[]", b'"x"', b'{"text":"a","text":"b","client_request_id":"x"}', b'{"n": NaN}',
                                  b"\xff\xfe{}", b"[" * 5000 + b"]" * 5000])
def test_malformed_json_is_one_422_without_any_input(w, body):
    link, tok = w.links.add()
    r = w.client().post("/t/api/note", content=body, headers={"x-ticket-token": tok, "content-type": "application/json"})
    assert r.status_code == 422 and r.json() == {"code": "invalid", "fields": [{"field": "body", "code": "json"}]}


def test_validation_errors_never_echo_the_input(w):
    link, tok = w.links.add()
    r = w.client().post("/t/api/note", json={"text": "x", "client_request_id": crid(), "phone": PHONE},
                        headers={"x-ticket-token": tok})
    assert r.status_code == 422
    assert r.json() == {"code": "invalid", "fields": [{"field": "phone", "code": "extra_forbidden"}]}
    assert PHONE not in r.text and "input" not in r.text and "url" not in r.text
    r = w.client().post("/t/api/note", json={"text": PHONE * 300, "client_request_id": crid()}, headers={"x-ticket-token": tok})
    assert r.status_code == 422 and r.json()["fields"] == [{"field": "text", "code": "too_long"}] and PHONE not in r.text
    r = w.client().post("/t/api/note", json={"text": 5, "client_request_id": crid()}, headers={"x-ticket-token": tok})
    assert r.json()["fields"] == [{"field": "text", "code": "type"}]


def test_text_is_cleaned_before_it_is_stored(w):
    link, tok = w.links.add()
    r = note(w.client(), tok, text="  בוצע‮​ לא \r\n\r\n\r\nסוף ")
    assert r.status_code == 200 and r.json()["text"] == "בוצע לא\n\nסוף" and w.notes == ["בוצע לא\n\nסוף"]


# ---------------------------------------------------------------- idempotency, grace, codes


def test_idempotent_replay_and_reuse_on_another_route(w, tmp_path):
    link, tok = w.links.add()
    c = w.client()
    rid = crid()
    first = note(c, tok, text="one", rid=rid)
    again = note(c, tok, text="two", rid=rid.upper())
    assert first.status_code == again.status_code == 200 and again.json() == first.json() and w.notes == ["one"]
    assert again.headers.get("x-idempotent-replay") == "1"
    photo = c.post("/t/api/photo", files={"file": ("p.jpg", jpeg_bytes(), "image/jpeg")}, data={"client_request_id": rid},
                   headers={"x-ticket-token": tok})
    assert photo.status_code == 409 and photo.json()["code"] == "request_id_reused"
    for bad in ("", "not-a-uuid", "0" * 36, str(uuid.uuid4())[:-1]):
        assert note(c, tok, rid=bad).json()["fields"] == [{"field": "client_request_id", "code": "uuid"}]


def test_idempotency_never_runs_the_work_twice_under_concurrency():
    import asyncio

    from tests.tickets_public_fakes import FakeRequests

    idem = Idempotency(FakeRequests())
    runs: list[int] = []

    async def work():
        runs.append(1)
        await asyncio.sleep(0.05)
        return 201, {"id": "a1"}

    async def scenario():
        async def attempt():
            try:
                r = await idem.run("link:L", "same-id", "/t/api/photo", work)
                return r.status_code
            except PublicError as exc:
                return exc.code

        first = await asyncio.gather(*(attempt() for _ in range(6)))
        later = await attempt()
        return first, later

    first, later = asyncio.run(scenario())
    assert runs == [1] and first.count(201) == 1 and first.count("request_in_progress") == 5 and later == 201
    replay = asyncio.run(idem.run("link:L", "same-id", "/t/api/photo", work))
    assert replay.headers.get("x-idempotent-replay") == "1" and runs == [1]


def test_read_only_grace_after_close(w):
    link, tok = w.links.add(grace_until=w.clock() + 3600)
    c = w.client()
    view = c.get("/t/api/ticket", headers={"x-ticket-token": tok})
    assert view.status_code == 200 and view.json()["read_only"] is True
    r = note(c, tok)
    assert r.status_code == 409 and r.json() == {"code": "read_only"}
    w.clock.advance(3601)
    assert c.get("/t/api/ticket", headers={"x-ticket-token": tok}).status_code == 404


def test_code_protected_link_full_flow(w):
    link, tok = w.links.add(require_code=True)
    c = w.client()
    h = {"x-ticket-token": tok}
    assert c.get("/t/api/ticket", headers=h).json() == {"number": 1042, "code_required": True}  # nothing beyond the number
    assert note(c, tok).json() == {"code": "code_required"}
    sent = c.post("/t/api/code/send", json={}, headers=h)
    assert sent.status_code == 200 and sent.json() == {"sent": True, "channel": "whatsapp", "expires_in_s": 600}
    (link_id, code_id, channel), = w.sender.sent
    code = cd.derive_code(KEY, code_id)  # what the outbox worker renders; the store never had it
    assert code not in json.dumps([vars(r) for r in w.codes.codes.values()])
    again = c.post("/t/api/code/send", json={}, headers=h)
    assert again.status_code == 429 and again.json()["code"] == "rate_limited" and "retry-after" in again.headers
    bad = c.post("/t/api/code/verify", json={"code": f"{(int(code) + 1) % 10 ** 6:06d}"}, headers=h)
    assert bad.status_code == 422 and bad.json() == {"code": "code_invalid", "attempts_left": 4}
    assert c.post("/t/api/code/verify", json={"code": "12a"}, headers=h).json()["code"] == "code_malformed"
    ok = c.post("/t/api/code/verify", json={"code": code}, headers=h)
    assert ok.status_code == 200 and ok.json()["expires_in_s"] == 43200
    session = ok.json()["session"]
    assert c.get("/t/api/ticket", headers={**h, "x-ticket-session": session}).json()["title"] == "מזגן חדר 102"
    assert note(c, tok, session=session).status_code == 200
    assert note(c, tok, session=links.new_session_value()).json() == {"code": "code_required"}
    assert c.post("/t/api/code/verify", json={"code": code}, headers=h).json()["code"] == "code_missing"  # single use


def test_code_lock_answers_429_with_the_lock_time(w):
    link, tok = w.links.add(require_code=True)
    c = w.client()
    h = {"x-ticket-token": tok}
    c.post("/t/api/code/send", json={}, headers=h)
    code = cd.derive_code(KEY, w.sender.sent[0][1])
    for _ in range(4):
        c.post("/t/api/code/verify", json={"code": f"{(int(code) + 7) % 10 ** 6:06d}"}, headers=h)
    r = c.post("/t/api/code/verify", json={"code": f"{(int(code) + 7) % 10 ** 6:06d}"}, headers=h)
    assert r.status_code == 429 and r.json() == {"code": "code_locked", "retry_after_s": 1800} and r.headers["retry-after"] == "1800"
    assert c.post("/t/api/code/send", json={}, headers=h).json()["code"] == "code_locked"


def test_code_routes_refuse_cleanly(w):
    plain, tok = w.links.add(require_code=False)
    c = w.client()
    assert c.post("/t/api/code/send", json={}, headers={"x-ticket-token": tok}).json() == {"code": "code_not_required"}
    assert c.post("/t/api/code/send", json={"x": 1}, headers={"x-ticket-token": tok}).status_code == 422
    link, tok2 = w.links.add(require_code=True)
    w.sender.channel = None  # D6: no channel may carry the code now
    r = c.post("/t/api/code/send", json={}, headers={"x-ticket-token": tok2})
    assert r.status_code == 503 and r.json() == {"code": "code_unavailable"}
    w.sender.channel, w.sender.ok = "whatsapp", False  # the outbox refused the row: the issued code is withdrawn
    r = c.post("/t/api/code/send", json={}, headers={"x-ticket-token": tok2})
    assert r.status_code == 503 and w.codes.latest_code(link.link_id).expires_at <= w.clock()
    assert c.post("/t/api/code/verify", json={"code": 123456}, headers={"x-ticket-token": tok2}).status_code == 422  # strict: a string


# ---------------------------------------------------------------- the e-mail redeem link


def test_redeem_page_is_the_static_shell_and_the_release_needs_a_post(w):
    link, tok = w.links.add()
    rid = w.redeems.add(link, w.clock())
    c = w.client()
    shell = c.get("/t/")
    page = c.get(f"/t/r/{rid}")
    assert raw(page) == raw(shell) and shell.content == FALLBACK_SHELL
    assert w.redeems.rows[links.redeem_hash(rid)]["uses"] == 0 and w.links.lookups == 0 and w.links.by_id_calls == 0
    for _ in range(3):
        r = c.post("/t/api/redeem", json={"rid": rid})
        assert r.status_code == 200 and r.json() == {"token": tok}
    assert raw(c.post("/t/api/redeem", json={"rid": rid}))[0] == 404  # three releases at most


def test_redeem_refusals_are_uniform(w):
    link, tok = w.links.add()
    c = w.client()
    expired = w.redeems.add(link, w.clock() - 86401)
    bumped_link, _ = w.links.add()
    rid_old_gen = w.redeems.add(bumped_link, w.clock())
    w.links.replace(bumped_link, generation=2)
    answers = [raw(c.post("/t/api/redeem", json={"rid": rid})) for rid in (expired, rid_old_gen, links.new_redeem_id(), "zz", "A" * 32)]
    assert answers[0][0] == 404 and answers[0][2] == b'{"code":"link_unavailable"}'
    assert all(a == answers[0] for a in answers)


def test_redeem_is_rate_limited_per_network(w):
    c = w.client(peer="192.0.2.77")
    codes = [c.post("/t/api/redeem", json={"rid": links.new_redeem_id()}).status_code for _ in range(12)]
    assert codes[:10] == [404] * 10 and codes[10:] == [429, 429]


# ---------------------------------------------------------------- photos


def jpeg_bytes(w: int = 320, h: int = 200, **save) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (90, 30, 160)).save(buf, "JPEG", **save)
    return buf.getvalue()


def upload(client, token, data: bytes | None = None, rid: str | None = None, name: str = "photo.jpg", **headers):
    return client.post("/t/api/photo", files={"file": (name, data if data is not None else jpeg_bytes(), "image/jpeg")},
                       data={"client_request_id": rid or crid()}, headers={"x-ticket-token": token, **headers})


def test_photo_upload_is_reencoded_stored_and_idempotent(w):
    link, tok = w.links.add()
    c = w.client()
    exif = Image.Exif()
    exif[0x010E] = "GPS secret"
    rid = crid()
    r = upload(c, tok, jpeg_bytes(exif=exif.tobytes()), rid=rid, name="../../evil.php")
    assert r.status_code == 201 and r.json()["width"] == 320
    (row,) = w.photos.rows.values()
    stored = (w.root / row["rel"]).read_bytes()
    assert b"GPS secret" not in stored and row["rel"].startswith("tk0001/") and "evil" not in row["rel"]
    again = upload(c, tok, jpeg_bytes(), rid=rid)
    assert again.status_code == 201 and again.json() == r.json() and len(w.photos.rows) == 1
    got = c.get(f"/t/api/photo/{r.json()['id']}", headers={"x-ticket-token": tok})
    assert got.status_code == 200 and got.content == stored
    assert got.headers["content-type"] == "image/jpeg" and got.headers["content-disposition"] == 'inline; filename="ticket-1042.jpg"'
    assert got.headers["x-content-type-options"] == "nosniff" and got.headers["cache-control"] == "private, no-store"


def test_photo_refusals(w):
    link, tok = w.links.add()
    c = w.client()
    buf = io.BytesIO()
    Image.new("RGB", (10, 10)).save(buf, "WEBP")
    r = upload(c, tok, buf.getvalue(), name="x.jpg")
    assert r.status_code == 415 and r.json() == {"code": "webp_refused"}
    assert upload(c, tok, b"<svg onload=alert(1)>", name="x.jpg").json() == {"code": "unsupported_format"}
    nofile = c.post("/t/api/photo", data={"client_request_id": crid()}, headers={"x-ticket-token": tok},
                    files={"other": ("a", b"x", "text/plain")})
    assert nofile.status_code == 422 and nofile.json()["fields"] == [{"field": "form", "code": "unknown_field"}]
    norid = c.post("/t/api/photo", files={"file": ("p.jpg", jpeg_bytes(), "image/jpeg")}, headers={"x-ticket-token": tok})
    assert norid.status_code == 422
    assert c.post("/t/api/photo", json={"x": 1}, headers={"x-ticket-token": tok}).status_code == 415
    w.photos.extra_ticket = 60  # the ticket already holds 60 photos
    r = upload(c, tok)
    assert r.status_code == 409 and r.json() == {"code": "photo_limit"}
    assert not w.photos.rows


def test_a_retry_of_the_upload_that_reached_the_quota_is_its_replay(w):
    link, tok = w.links.add()
    w.photos.extra_ticket = 59
    c = w.client()
    rid = crid()
    first = upload(c, tok, rid=rid)
    assert first.status_code == 201  # the 60th photo of the ticket
    retry = upload(c, tok, rid=rid)
    assert retry.status_code == 201 and retry.json() == first.json() and retry.headers.get("x-idempotent-replay") == "1"
    assert upload(c, tok).json() == {"code": "photo_limit"}  # a NEW photo is refused


def test_storage_full_is_refused_before_the_body_is_decoded(tmp_path):
    w = build_world(tmp_path, storage_cap=1000)
    link, tok = w.links.add()
    r = upload(w.client(), tok)
    assert r.status_code == 507 and r.json() == {"code": "storage_full"}
    assert not w.photos.rows and not list(w.root.rglob("*.jpg"))


def test_a_failed_record_removes_the_stored_file(w):
    link, tok = w.links.add()
    w.photos.fail_record = True
    r = upload(w.client(), tok)
    assert r.status_code == 500 and r.json() == {"code": "server_error"}
    assert not list(w.root.rglob("*.jpg"))


def test_photo_get_is_scoped_to_the_links_ticket_and_the_code(w):
    link, tok = w.links.add()
    other, tok_other = w.links.add(ticket_id="tk0002")
    pid = upload(w.client(), tok).json()["id"]
    c = w.client()
    assert c.get(f"/t/api/photo/{pid}", headers={"x-ticket-token": tok_other}).status_code == 404
    assert c.get("/t/api/photo/../../x", headers={"x-ticket-token": tok}).status_code == 404
    locked, tok_locked = w.links.add(require_code=True)
    assert c.get(f"/t/api/photo/{pid}", headers={"x-ticket-token": tok_locked}).json() == {"code": "code_required"}


def test_one_upload_in_flight_per_link_at_the_app(w):
    link, tok = w.links.add()
    from smplwise.services.tickets.public_app import create_public_app  # noqa: F401 - the guard lives inside the app

    # the guard is per app instance; hold it through the second request by making the first one block in the sink
    import threading

    started, release = threading.Event(), threading.Event()
    real_record = w.photos.record

    def slow_record(*a, **k):
        started.set()
        release.wait(5)
        return real_record(*a, **k)

    w.photos.record = slow_record  # type: ignore[assignment]
    results: list[int] = []
    t = threading.Thread(target=lambda: results.append(upload(w.client(), tok).status_code))
    t.start()
    assert started.wait(5)
    second = upload(w.client(), tok)
    release.set()
    t.join(10)
    assert second.status_code == 429 and second.json()["code"] == "busy" and results == [201]


# ---------------------------------------------------------------- errors and the shell


def test_an_unhandled_error_is_a_plain_500_with_nothing_of_the_exception(w):
    link, tok = w.links.add()
    r = w.client().post("/t/api/test-crash", json={}, headers={"x-ticket-token": tok})
    assert r.status_code == 500 and r.json() == {"code": "server_error"} and PHONE not in r.text
    assert w.app.stats.snapshot()["counters"]["unhandled_errors"] == 1 and w.app.stats.last_5xx_at is not None


def test_shell_and_assets_from_the_built_bundle(tmp_path):
    shell_dir = tmp_path / "www-public"
    (shell_dir / "assets").mkdir(parents=True)
    (shell_dir / "index.html").write_bytes(b'<!doctype html><script type="module" src="/t/assets/main-AbCd1234.js"></script>')
    (shell_dir / "assets" / "main-AbCd1234.js").write_bytes(b"console.log(1)")
    (shell_dir / "assets" / "plain.css").write_bytes(b"body{}")
    (shell_dir / "assets" / "notes.txt").write_bytes(b"x")
    (tmp_path / "secret.js").write_bytes(b"secret")
    w = build_world(tmp_path, shell_dir=shell_dir)
    c = w.client()
    assert c.get("/t/").content.startswith(b"<!doctype html><script")
    js = c.get("/t/assets/main-AbCd1234.js")
    assert js.status_code == 200 and js.headers["content-type"] == "text/javascript; charset=utf-8"
    assert js.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert c.get("/t/assets/plain.css").headers["cache-control"] == "no-cache"
    for bad in ("/t/assets/notes.txt", "/t/assets/..%2fsecret.js", "/t/assets/%2e%2e/secret.js", "/t/assets/.hidden.js",
                "/t/assets/missing.js", "/t/assets/a/b.js"):
        assert c.get(bad).status_code == 404, bad


def test_parse_json_object_rules():
    assert parse_json_object(b'{"a": [1, {"b": null}]}') == {"a": [1, {"b": None}]}
    for bad in (b"", b"[]", b"1", b'{"a":1,"a":2}', b'{"a": Infinity}', b"\xef\xbb\xbf{}", b"{'a':1}", b"\x80"):
        with pytest.raises(ValueError):
            parse_json_object(bad)


def test_public_error_is_not_a_404_leak():
    e = PublicError(409, "read_only")
    assert (e.status, e.code, e.extra) == (409, "read_only", {})
