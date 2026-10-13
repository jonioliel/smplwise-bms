"""CR-038 log hygiene of the public listener (spec 10.4 / 17 / 19, review T16): a live listener on 127.0.0.1 is driven with
traffic full of secrets - a live token, an unknown token, a redeem id in the path, a code session, the six-digit code, a phone
number in bodies, headers, a malformed request and an exception message, a client address in CF-Connecting-IP, a user-agent
marker, EXIF metadata, an oversize head, a concurrency overflow, a handler crash - while EVERY relevant logger (root, uvicorn,
uvicorn.error, uvicorn.access, uvicorn.asgi, smplwise.*, python_multipart, asyncio) is captured at the lowest level. None of
the secrets may appear in any record (message, arguments, exception text), uvicorn.access must stay silent, and the request
lines must name route templates only. The client libraries' own loggers (httpx / httpcore: this test's client side) are
excluded from the scan. Every value is invented."""
from __future__ import annotations

import io
import logging
import socket
import uuid

import httpx
import pytest
from PIL import Image

from smplwise.services.tickets import codes as cd
from smplwise.services.tickets import links
from smplwise.services.tickets import public_server as ps
from tests.test_tickets_public_app import TEST_RULES, slice4_router
from tests.tickets_public_fakes import KEY, build_world
from smplwise.services.tickets.public_app import Idempotency

PHONE = "972541234987"
CLIENT_IP = "198.51.100.77"
UA_MARK = "UA-MARKER-7f3a"
EXIF_MARK = "EXIF-MARKER-c2d9"
LOGGERS = ("", "uvicorn", "uvicorn.error", "uvicorn.access", "uvicorn.asgi", "smplwise", "smplwise.tickets.public",
           "smplwise.tickets.public.http", "python_multipart", "python_multipart.multipart", "asyncio")


class Capture(logging.Handler):
    def __init__(self) -> None:
        super().__init__(level=1)
        self.records: list[logging.LogRecord] = []

    def emit(self, record: logging.LogRecord) -> None:
        if record.name.startswith(("httpx", "httpcore")):
            return  # the test's own client
        self.records.append(record)

    def texts(self) -> list[str]:
        out = []
        for r in self.records:
            try:
                msg = r.getMessage()
            except Exception:  # noqa: BLE001
                msg = f"{r.msg!r} {r.args!r}"
            exc = logging.Formatter().formatException(r.exc_info) if r.exc_info else ""
            out.append(f"{r.name}|{msg}|{r.args!r}|{exc}|{r.exc_text or ''}|{r.stack_info or ''}")
        return out


@pytest.fixture()
def capture():
    cap = Capture()
    saved = []
    for name in LOGGERS:
        lg = logging.getLogger(name)
        saved.append((lg, lg.level, lg.propagate))
        lg.addHandler(cap)
        lg.setLevel(1)
    yield cap
    for lg, level, propagate in saved:
        lg.removeHandler(cap)
        lg.setLevel(level)
        lg.propagate = propagate


def raw_send(port: int, data: bytes) -> bytes:
    with socket.create_connection(("127.0.0.1", port), timeout=5) as s:
        s.sendall(data)
        s.settimeout(5)
        out = b""
        try:
            while True:
                chunk = s.recv(65536)
                if not chunk:
                    break
                out += chunk
                if b"\r\n\r\n" in out and len(out) > 200:
                    break
        except OSError:
            pass
        return out


def test_no_secret_reaches_any_log_record(tmp_path, capture):
    box: dict = {}
    world = build_world(tmp_path, routers=(slice4_router(box),), rules=TEST_RULES, trusted=("127.0.0.0/8",))
    box["idem"] = Idempotency(world.requests)
    link, token = world.links.add(require_code=True)
    plain_link, plain_token = world.links.add()
    unknown = links.derive_token(KEY, links.new_link_id(), 1)
    rid = world.redeems.add(plain_link, world.clock())
    lst = ps.PublicListener("tickets-public-logscan")
    assert lst.start(world.app, host="127.0.0.1", port=0)
    secrets_seen: list[str] = [token, plain_token, unknown, rid, PHONE, CLIENT_IP, UA_MARK, EXIF_MARK]
    try:
        base = f"http://127.0.0.1:{lst.port}"
        common = {"user-agent": f"Mozilla/5.0 {UA_MARK}", "cf-connecting-ip": CLIENT_IP, "x-phone": PHONE}
        with httpx.Client(base_url=base, headers=common) as c:
            assert c.get(f"/t/r/{rid}").status_code == 200
            assert c.post("/t/api/redeem", json={"rid": rid}).json() == {"token": plain_token}
            assert c.get("/t/api/ticket", headers={"x-ticket-token": unknown}).status_code == 404
            sent = c.post("/t/api/code/send", json={}, headers={"x-ticket-token": token})
            assert sent.status_code == 200
            code = cd.derive_code(KEY, world.sender.sent[-1][1])
            secrets_seen.append(code)
            bad = c.post("/t/api/code/verify", json={"code": f"{(int(code) + 1) % 10 ** 6:06d}"}, headers={"x-ticket-token": token})
            assert bad.status_code == 422
            ok = c.post("/t/api/code/verify", json={"code": code}, headers={"x-ticket-token": token})
            session = ok.json()["session"]
            secrets_seen.append(session)
            r = c.post("/t/api/note", json={"text": f"call me {PHONE}", "client_request_id": str(uuid.uuid4())},
                       headers={"x-ticket-token": token, "x-ticket-session": session})
            assert r.status_code == 200
            r = c.post("/t/api/note", json={"text": "x", "client_request_id": str(uuid.uuid4()), "phone": PHONE},
                       headers={"x-ticket-token": plain_token})
            assert r.status_code == 422 and PHONE not in r.text
            assert c.post("/t/api/test-crash", json={}, headers={"x-ticket-token": plain_token}).status_code == 500
            exif = Image.Exif()
            exif[0x010E] = f"{EXIF_MARK} {PHONE}"
            buf = io.BytesIO()
            Image.new("RGB", (64, 48)).save(buf, "JPEG", exif=exif.tobytes())
            up = c.post("/t/api/photo", headers={"x-ticket-token": plain_token}, data={"client_request_id": str(uuid.uuid4())},
                        files={"file": (f"{PHONE}.jpg", buf.getvalue(), "image/jpeg")})
            assert up.status_code == 201
            assert c.get(f"/t/api/photo/{up.json()['id']}", headers={"x-ticket-token": plain_token}).status_code == 200
            for _ in range(25):  # a locked network: 429s
                c.get("/t/api/photo/ffffffffffffffff", headers={"x-ticket-token": unknown})
        # malformed and oversize requests carrying the secrets in their raw bytes
        raw_send(lst.port, b"GET /t/?phone=" + PHONE.encode() + b" HTTP/1.1\r\nBroken " + token.encode() + b"\r\n\r\n")
        raw_send(lst.port, b"GET /t/healthz HTTP/1.1\r\nHost: x\r\nX-Big: " + (token.encode() + b"-") * 1000 + b"\r\n\r\n")
        raw_send(lst.port, b"POST /t/api/redeem HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: 2\r\n"
                 b"X-Ticket-Token: " + token.encode() + b"\r\n\r\n{" + PHONE.encode())
        held = []
        try:
            for _ in range(17):  # the concurrency limit: uvicorn's "Exceeded concurrency limit." goes through ProtocolLog
                s = socket.create_connection(("127.0.0.1", lst.port), timeout=5)
                s.sendall(b"GET /t/r/" + rid.encode() + b" HTTP/1.1\r\nHost: x\r\nUser-Agent: " + UA_MARK.encode() + b"\r\n\r\n")
                s.recv(4096)
                held.append(s)
        finally:
            for s in held:
                s.close()
    finally:
        assert lst.stop()

    texts = capture.texts()
    assert texts, "the scan saw no record at all - the capture is not wired"
    for secret in secrets_seen:
        for t in texts:
            assert secret not in t, (secret[:6], t[:200])
    assert not [r for r in capture.records if r.name == "uvicorn.access"]
    lines = [r.getMessage() for r in capture.records if r.name == "smplwise.tickets.public" and r.getMessage().startswith("public ")]
    assert any("/t/r/{rid}" in ln for ln in lines) and any("/t/api/photo/{attachment_id}" in ln for ln in lines)
    assert any("unhandled error" in t and "ValueError" in t for t in texts)  # the crash is reported - as its type only
    snap = world.app.stats.snapshot()
    assert snap["counters"].get("invalid_requests", 0) >= 1 and snap["counters"].get("concurrency_refusals", 0) >= 1
    assert snap["rate_limited_24h"] >= 1 and snap["last_5xx_at"] is not None
