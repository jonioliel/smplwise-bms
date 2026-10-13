"""In-memory fakes of the CR-038 public-surface ports (services/tickets/public_ports.py) and a harness that runs the public
listener on 127.0.0.1 with them. No database, no network beyond 127.0.0.1, no real key: every id, number and token here is
invented. Slice 4's SQL implementations must keep the same contracts these fakes keep (the tests below exercise them)."""
from __future__ import annotations

import dataclasses
import threading
import time
from pathlib import Path
from typing import Any, Mapping

from smplwise.services.tickets import links
from smplwise.services.tickets.public_ports import (CodeRecord, FailureRecord, LinkRecord, PhotoCounts, PhotoFile, SessionRecord,
                                                    StoredImage, StoredResponse)

KEY = bytes(range(32))  # a fixed test key - never a real one


class Clock:
    """A settable wall clock (epoch seconds)."""

    def __init__(self, t: float = 1_800_000_000.0) -> None:
        self.t = t
        self._lock = threading.Lock()

    def __call__(self) -> float:
        with self._lock:
            return self.t

    def advance(self, s: float) -> None:
        with self._lock:
            self.t += s


class FakeLinks:
    """LinkStore: links by token hash; counts every lookup (the "one indexed read per request" and "no read before the rate gate"
    assertions)."""

    def __init__(self, clock: Clock | None = None) -> None:
        self.clock = clock or Clock()
        self.by_hash: dict[str, LinkRecord] = {}
        self.by_link: dict[str, LinkRecord] = {}
        self.lookups = 0
        self.by_id_calls = 0
        self.lock = threading.Lock()

    def add(self, *, generation: int = 1, require_code: bool = False, ttl_s: float = 14 * 86400.0, grace_until: float | None = None,
            revoked: bool = False, recipient_key: str | None = "k" * 64, ticket_id: str = "tk0001", ticket_number: int = 1042,
            sent_via: str | None = "whatsapp", link_id: str | None = None) -> tuple[LinkRecord, str]:
        link_id = link_id or links.new_link_id()
        rec = LinkRecord(link_id=link_id, generation=generation, ticket_id=ticket_id, assignment_id="as" + link_id[:8],
                         contact_id="ct" + link_id[:8], require_code=require_code, expires_at=self.clock() + ttl_s,
                         grace_until=grace_until, revoked=revoked, recipient_key=recipient_key, sent_via=sent_via,
                         ticket_number=ticket_number)
        token = links.derive_token(KEY, link_id, generation)
        with self.lock:
            self.by_hash[links.token_hash(token)] = rec
            self.by_link[link_id] = rec
        return rec, token

    def replace(self, rec: LinkRecord, **changes: Any) -> LinkRecord:
        new = dataclasses.replace(rec, **changes)
        with self.lock:
            for h, r in list(self.by_hash.items()):
                if r.link_id == rec.link_id:
                    self.by_hash[h] = new
            self.by_link[rec.link_id] = new
        return new

    def lookup(self, token_hash: str) -> LinkRecord | None:
        with self.lock:
            self.lookups += 1
            return self.by_hash.get(token_hash)

    def by_id(self, link_id: str) -> LinkRecord | None:
        with self.lock:
            self.by_id_calls += 1
            return self.by_link.get(link_id)


class FakeSwitch:
    def __init__(self, on: bool = True) -> None:
        self.on = on

    def module_on(self) -> bool:
        return self.on


class FakeRedeems:
    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = {}
        self.lock = threading.Lock()

    def add(self, link: LinkRecord, created_at: float, ttl_s: float = 86400.0) -> str:
        rid = links.new_redeem_id()
        with self.lock:
            self.rows[links.redeem_hash(rid)] = {"link_id": link.link_id, "generation": link.generation, "expires_at": created_at + ttl_s, "uses": 0}
        return rid

    def release(self, rid_hash: str, now: float, max_uses: int) -> tuple[str, int] | None:
        with self.lock:
            r = self.rows.get(rid_hash)
            if r is None or now >= r["expires_at"] or r["uses"] >= max_uses:
                return None
            r["uses"] += 1
            return r["link_id"], r["generation"]


class FakeRequests:
    def __init__(self) -> None:
        self.rows: dict[tuple[str, str], StoredResponse] = {}
        self.lock = threading.Lock()

    def get(self, scope: str, client_request_id: str) -> StoredResponse | None:
        with self.lock:
            return self.rows.get((scope, client_request_id))

    def put(self, scope: str, client_request_id: str, route: str, status: int, body: Mapping[str, Any]) -> bool:
        with self.lock:
            if (scope, client_request_id) in self.rows:
                return False
            self.rows[(scope, client_request_id)] = StoredResponse(route, status, dict(body))
            return True


class FakeCodes:
    """CodeStore over dicts, with the atomicity the contract asks for (replace_code, consume)."""

    def __init__(self) -> None:
        self.codes: dict[str, CodeRecord] = {}
        self.order: list[str] = []
        self.failures_by_link: dict[str, FailureRecord] = {}
        self.sessions: dict[str, SessionRecord] = {}
        self.lock = threading.Lock()

    def latest_code(self, link_id: str) -> CodeRecord | None:
        with self.lock:
            for cid in reversed(self.order):
                c = self.codes[cid]
                if c.link_id == link_id:
                    return c
            return None

    def code_times_since(self, link_id: str, since: float) -> list[float]:
        with self.lock:
            return sorted(c.created_at for c in self.codes.values() if c.link_id == link_id and c.created_at >= since)

    def replace_code(self, record: CodeRecord, now: float) -> None:
        with self.lock:
            for cid, c in list(self.codes.items()):
                if c.link_id == record.link_id and c.consumed_at is None and c.expires_at > now:
                    self.codes[cid] = dataclasses.replace(c, expires_at=now)
            self.codes[record.id] = record
            self.order.append(record.id)

    def expire_code(self, code_id: str, now: float) -> None:
        with self.lock:
            c = self.codes.get(code_id)
            if c is not None:
                self.codes[code_id] = dataclasses.replace(c, expires_at=min(c.expires_at, now))

    def add_attempt(self, code_id: str) -> int:
        with self.lock:
            c = self.codes[code_id]
            c = self.codes[code_id] = dataclasses.replace(c, attempts=c.attempts + 1)
            return c.attempts

    def consume(self, code_id: str, now: float) -> bool:
        with self.lock:
            c = self.codes.get(code_id)
            if c is None or c.consumed_at is not None:
                return False
            self.codes[code_id] = dataclasses.replace(c, consumed_at=now)
            return True

    def failures(self, link_id: str) -> FailureRecord | None:
        with self.lock:
            return self.failures_by_link.get(link_id)

    def put_failures(self, link_id: str, record: FailureRecord) -> None:
        with self.lock:
            self.failures_by_link[link_id] = record

    def clear_failures(self, link_id: str) -> None:
        with self.lock:
            self.failures_by_link.pop(link_id, None)

    def put_session(self, record: SessionRecord) -> None:
        with self.lock:
            self.sessions[record.id_hash] = record

    def session(self, id_hash: str) -> SessionRecord | None:
        with self.lock:
            return self.sessions.get(id_hash)


class FakeSender:
    """CodeSender: records (link_id, code_id, channel); the test derives the digits like the outbox worker would."""

    def __init__(self, channel: str | None = "whatsapp", ok: bool = True) -> None:
        self.channel = channel
        self.ok = ok
        self.sent: list[tuple[str, str, str]] = []

    def channel_for(self, link: LinkRecord) -> str | None:
        return self.channel

    def send(self, link: LinkRecord, code_id: str, channel: str) -> bool:
        if self.ok:
            self.sent.append((link.link_id, code_id, channel))
        return self.ok


class FakePhotos:
    """PhotoSink: rows in a dict; counts per assignment / ticket; `fail_record` makes `record` raise (the file must then go)."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.rows: dict[str, dict[str, Any]] = {}
        self.extra_ticket = 0
        self.fail_record = False
        self.lock = threading.Lock()
        self.n = 0

    def counts(self, link: LinkRecord) -> PhotoCounts:
        with self.lock:
            a = sum(1 for r in self.rows.values() if r["assignment_id"] == link.assignment_id)
            t = sum(1 for r in self.rows.values() if r["ticket_id"] == link.ticket_id) + self.extra_ticket
        return PhotoCounts(a, t)

    def record(self, link: LinkRecord, image: StoredImage, client_request_id: str) -> Mapping[str, Any]:
        if self.fail_record:
            raise RuntimeError("database unavailable")
        with self.lock:
            self.n += 1
            aid = f"{self.n:016x}"
            self.rows[aid] = {"ticket_id": link.ticket_id, "assignment_id": link.assignment_id, "rel": image.rel_path, "visible_external": 1}
        return {"id": aid, "width": image.width, "height": image.height}

    def open(self, link: LinkRecord, attachment_id: str) -> PhotoFile | None:
        with self.lock:
            r = self.rows.get(attachment_id)
        if r is None or r["ticket_id"] != link.ticket_id or not r["visible_external"]:
            return None
        return PhotoFile(path=(self.root / r["rel"]).resolve(), ticket_number=link.ticket_number or 0)


def wait_until(pred, timeout: float = 5.0, step: float = 0.01) -> bool:
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if pred():
            return True
        time.sleep(step)
    return pred()


# ---------------------------------------------------------------- the harness: a public app over fakes


@dataclasses.dataclass
class World:
    clock: Clock
    links: FakeLinks
    switch: FakeSwitch
    redeems: FakeRedeems
    requests: FakeRequests
    codes: FakeCodes
    engine: Any
    sender: FakeSender
    photos: FakePhotos
    root: Path
    storage: Any
    app: Any

    def client(self, peer: str = "198.51.100.7", **kw: Any):
        from fastapi.testclient import TestClient

        return TestClient(self.app, client=(peer, 50000), **kw)


def build_world(tmp_path: Path, *, now: float | None = None, storage_cap: int | None = None, routers: tuple = (), rules: tuple | None = None,
                shell_dir: Path | None = None, trusted: tuple[str, ...] | None = None, decode_wait_s: float = 5.0) -> World:
    from smplwise.services.tickets.codes import CodeEngine
    from smplwise.services.tickets.image_intake import StorageMeter
    from smplwise.services.tickets.public_app import PublicDeps, create_public_app
    from smplwise.services.tickets.public_http import ROUTES
    from smplwise.services.tickets.ratelimit import DEFAULT_TRUSTED_PROXY_CIDRS, new_public_limiter, parse_trusted_cidrs

    clock = Clock(now if now is not None else time.time())
    fl = FakeLinks(clock)
    root = tmp_path / "tickets"
    root.mkdir(parents=True, exist_ok=True)
    limiter = new_public_limiter(clock)
    codes = FakeCodes()
    engine = CodeEngine(codes, lambda: KEY, limiter=limiter, clock=clock)
    world = World(clock=clock, links=fl, switch=FakeSwitch(True), redeems=FakeRedeems(), requests=FakeRequests(), codes=codes,
                  engine=engine, sender=FakeSender(), photos=FakePhotos(root), root=root,
                  storage=StorageMeter(root, cap_bytes=storage_cap or 2 * 1024 ** 3), app=None)
    deps = PublicDeps(links=fl, switch=world.switch, key=lambda: KEY,
                      trusted_proxies=parse_trusted_cidrs(trusted or DEFAULT_TRUSTED_PROXY_CIDRS),
                      requests=world.requests, redeems=world.redeems, codes=engine, code_sender=world.sender, photos=world.photos,
                      attachments_root=root, storage=world.storage, shell_dir=shell_dir, limiter=limiter, clock=clock,
                      extra_routers=routers, rules=rules or ROUTES, decode_wait_s=decode_wait_s)
    world.app = create_public_app(deps)
    return world
