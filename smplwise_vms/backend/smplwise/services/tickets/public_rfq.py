"""TKRFQVP (docs/tickets/RFQ_BACKEND_CONTRACT.md section 15): the vendor quote page's routes on the EXISTING public listener -
added to public_app through `PublicDeps.extra_routers`, behind the same edge (public_http.ROUTES carries their limits, kinds and
deadlines), rate gate, security headers and uniform 404.

    GET  /t/api/rfq               the request as the vendor may see it (rfq_vendor.view) - counts as an open
    POST /t/api/rfq/quote         a quote (a new version; base_version guards against a stale form)
    POST /t/api/rfq/withdraw      his submitted quote
    POST /t/api/rfq/decline       "not interested" (+ a short reason)
    POST /t/api/rfq/message       a clarification question (stored in his thread; nothing is sent anywhere)
    POST /t/api/rfq/code/send     the OPTIONAL verification code (owner decision 16.10: off by default, per vendor)
    POST /t/api/rfq/code/verify
    GET  /t/api/rfq/file/<id>[/thumb]  RFQATT (contract 19.4): one of the request's live vendor-visible files (a picture inline, its
                                  thumbnail, or a document as a download) - his own link, past the code gate, not on a closed /
                                  cancelled page; anything else is the uniform 404
    POST /t/api/rfq/upload        RFQ-VENDOR-UPLOAD (contract 19.10): one file / picture onto HIS submitted quote (multipart) -
                                  behind `rfq.vendor_uploads.enabled` (OFF by default: the uniform 404); rfq_vendor_files.py
    POST /t/api/rfq/upload/remove one of his own files marked removed

The wiring rules of the ticket routes (code review section 3) apply unchanged: the token is resolved by `rfq_context()` ONLY - ONE
indexed read of `ticket_rfq_links.token_hash` (joined with the vendor, the request and the contact) after the rate gate; an unknown,
revoked, expired, ticket (other domain) token or a contact that became staff -> a counted failure and the uniform 404; read-only
during the grace (409 `read_only` for writes); a code-protected link needs its code session (403 `code_required`). Bodies through
`read_json()` into strict models (`extra = forbid`: client totals are not even accepted); `client_request_id` mandatory, claimed and
answered inside the effect's own transaction (`ticket_requests`, scope `link:<link_id>:<generation>`); the write budget is spent once a
NEW effect is stored. No answer ever carries another vendor, another quote, an amount of someone else or an internal note."""
from __future__ import annotations

import dataclasses
import datetime as dt
import json
import logging
from typing import Any, Callable, Literal

from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from ...db import Database
from . import codes as codes_mod
from . import image_intake, links, rfq_attach, rfq_files, rfq_terms, rfq_vendor, rfq_vendor_files, store_rfq
from .codes import CodeEngine, CodePolicy, CodeRefused
from .handler_actions import ActionRefused, _finish as finish_request, claim as claim_request
from .image_intake import IntakeError, StorePathError
from .keyring import KEYS
from .module_key import ModuleKeyError
from .public_app import (Idempotency, LinkContext, PublicError, begin_body, idempotency_scope, parse_client_request_id, public_request, read_json,
                         spend_budget)
from .public_multipart import FieldRule, MultipartError, boundary_of, parse_form
from .public_claims import LineIn
from .public_ports import CodeRecord, FailureRecord, SessionRecord
from .public_store import epoch, iso, make_code_record
from .rfq_vendor import VendorLinkGone, VendorRefused

log = logging.getLogger("smplwise.tickets.public")
UTC = dt.timezone.utc
FINAL = ("closed", "cancelled")
VIEW_ROUTE = "/t/api/rfq"
QUOTE_ROUTE = "/t/api/rfq/quote"
WITHDRAW_ROUTE = "/t/api/rfq/withdraw"
DECLINE_ROUTE = "/t/api/rfq/decline"
MESSAGE_ROUTE = "/t/api/rfq/message"
ARRIVAL_ROUTE = "/t/api/rfq/arrival"  # CR-RFQ-PAYMENT-SCHEDULE (contract 20.5)
CODE_SEND_ROUTE = "/t/api/rfq/code/send"
CODE_VERIFY_ROUTE = "/t/api/rfq/code/verify"
FILE_ROUTE = "/t/api/rfq/file/{attachment_id}"
THUMB_ROUTE = "/t/api/rfq/file/{attachment_id}/thumb"
UPLOAD_ROUTE = "/t/api/rfq/upload"  # RFQ-VENDOR-UPLOAD (contract 19.10)
UPLOAD_REMOVE_ROUTE = "/t/api/rfq/upload/remove"
# the vendor's upload form: exactly these fields (public_multipart refuses any other, a duplicate, a file without a filename); the
# file's own filename is never used - `name` (optional text) is only a display name after rfq_files.display_name, never the kind
UPLOAD_FIELDS = {"file": FieldRule(file=True, max_bytes=rfq_files.DOCUMENT_MAX_BYTES),
                 # exactly ONE target: his submitted quote, or (owner decision 2026-10-17) one of his own questions - no quote needed
                 "quote_id": FieldRule(file=False, max_bytes=64, required=False), "message_id": FieldRule(file=False, max_bytes=64, required=False),
                 "client_request_id": FieldRule(file=False, max_bytes=64),
                 "name": FieldRule(file=False, max_bytes=rfq_vendor_files.NAME_FIELD_MAX, required=False)}


# ---------------------------------------------------------------- the link record (the fields the listener and the code engine read)

@dataclasses.dataclass(frozen=True)
class RfqLink:
    link_id: str
    generation: int
    rfq_id: str
    rfq_vendor_id: str
    contact_id: str
    require_code: bool
    expires_at: float
    key_id: str
    grace_until: float | None = None
    revoked: bool = False
    recipient_key: str | None = None
    sent_via: str | None = None
    rfq_number: int | None = None
    kind: str = "rfq"
    no_money: bool = False

    def available(self, now: float) -> bool:
        if self.revoked or now >= self.expires_at:
            return False
        return self.grace_until is None or now < self.grace_until

    def read_only(self, now: float) -> bool:
        return self.grace_until is not None and now < self.grace_until


def fold(row: dict[str, Any] | None) -> RfqLink | None:
    """The RfqLink of a joined lookup row (contract 15.1). Fail closed: a removed vendor, an erased / inactive contact, a contact that now
    names an internal user or is an employee, or an ended request without a recorded grace is revoked."""
    if row is None:
        return None
    ended = row["r_state"] in FINAL
    staff = bool(row["c_user_id"]) or bool(row["c_employee"])
    revoked = (bool(row["revoked_at"]) or row["v_state"] == "removed" or bool(row["c_erased_at"]) or not row["c_active"] or staff
               or (ended and not row["grace_until"]))
    expires = min(epoch(row["expires_at"]) or 0.0, epoch(row["cap_at"]) or 0.0)
    return RfqLink(link_id=row["id"], generation=int(row["generation"]), rfq_id=row["rfq_id"], rfq_vendor_id=row["rfq_vendor_id"],
                   contact_id=row["contact_id"], require_code=bool(row["require_code"] or row["v_require_code"]), expires_at=expires,
                   key_id=row["key_id"], grace_until=epoch(row["grace_until"]) if ended else None, revoked=revoked,
                   recipient_key=row["c_phone_key"], sent_via=row["sent_via"], rfq_number=int(row["r_number"]))


class SqlRfqLinkStore:
    def __init__(self, db: Database) -> None:
        self.db = db

    def lookup(self, token_hash: str) -> RfqLink | None:
        with self.db.connection(mode="read", label="tickets.public.rfq.lookup") as conn:
            return fold(store_rfq.link_by_token_joined(conn, token_hash))

    def by_id(self, link_id: str) -> RfqLink | None:
        if not links.is_link_id(link_id):
            return None
        with self.db.connection(mode="read", label="tickets.public.rfq.link") as conn:
            return fold(store_rfq.link_by_id_joined(conn, link_id))


def redeem_releaser(db: Database) -> Callable[[str, float, int], str | None]:
    """`PublicDeps.rfq_redeem`: the e-mail form of an RFQ link (contract 15.1) - the token, or None (the core route then counts ONE
    failure for the unknown id, exactly as before)."""

    def release(rid_hash: str, now: float, max_uses: int) -> str | None:
        with db.connection(label="tickets.public.rfq.redeem") as conn:
            released = store_rfq.release_redeem(conn, rid_hash, iso(now), max_uses)
            if released is None:
                return None
            rec = fold(store_rfq.link_by_id_joined(conn, released[0]))
        if rec is None or rec.generation != released[1] or not rec.available(now):
            return None
        try:
            return links.derive_token(KEYS.get(rec.key_id), rec.link_id, rec.generation, domain="rfq")
        except ModuleKeyError:
            return None

    return release


# ---------------------------------------------------------------- the verification code over the RFQ tables (contract 15.2)

class SqlRfqCodeStore:
    """public_ports.CodeStore over `ticket_rfq_link_codes` / `_failures` / `_sessions` (the 0080 rules, per link generation)."""

    def __init__(self, db: Database) -> None:
        self.db = db

    def _gen(self, conn, link_id: str, generation: int | None) -> int:
        if generation is not None:
            return int(generation)
        row = store_rfq.link(conn, link_id)
        return int(row["generation"]) if row else 1

    @staticmethod
    def _code(row: dict[str, Any] | None) -> CodeRecord | None:
        if row is None:
            return None
        return make_code_record(id=row["id"], link_id=row["link_id"], generation=int(row["generation"]), code_hash=row["code_hash"],
                                channel=row["channel"], created_at=epoch(row["created_at"]) or 0.0, expires_at=epoch(row["expires_at"]) or 0.0,
                                attempts=int(row["attempts"]), consumed_at=epoch(row["consumed_at"]))

    def latest_code(self, link_id: str, generation: int | None = None) -> CodeRecord | None:
        with self.db.connection(mode="read", label="tickets.public.rfq.code") as conn:
            return self._code(store_rfq.code_latest(conn, link_id, self._gen(conn, link_id, generation)))

    def code_times_since(self, link_id: str, *args: Any) -> list[float]:
        generation, since = (None, args[0]) if len(args) == 1 else (args[0], args[1])
        with self.db.connection(mode="read", label="tickets.public.rfq.code") as conn:
            return [epoch(t) or 0.0 for t in store_rfq.code_times_since(conn, link_id, self._gen(conn, link_id, generation), iso(since))]

    def replace_code(self, record: CodeRecord, now: float) -> None:
        with self.db.connection(label="tickets.public.rfq.code") as conn:
            store_rfq.code_replace(conn, {
                "id": record.id, "link_id": record.link_id, "generation": self._gen(conn, record.link_id, getattr(record, "generation", None)),
                "code_hash": record.code_hash, "channel": record.channel, "created_at": iso(record.created_at), "expires_at": iso(record.expires_at),
                "attempts": record.attempts, "consumed_at": iso(record.consumed_at) if record.consumed_at else None}, iso(now))

    def expire_code(self, code_id: str, now: float) -> None:
        with self.db.connection(label="tickets.public.rfq.code") as conn:
            store_rfq.code_expire(conn, code_id, iso(now))

    def add_attempt(self, code_id: str) -> int:
        with self.db.connection(label="tickets.public.rfq.code") as conn:
            return store_rfq.code_add_attempt(conn, code_id)

    def consume(self, code_id: str, now: float) -> bool:
        with self.db.connection(label="tickets.public.rfq.code") as conn:
            return store_rfq.code_consume(conn, code_id, iso(now))

    def failures(self, link_id: str, generation: int | None = None) -> FailureRecord | None:
        with self.db.connection(mode="read", label="tickets.public.rfq.code") as conn:
            row = store_rfq.code_failures(conn, link_id, self._gen(conn, link_id, generation))
        if row is None:
            return None
        return FailureRecord(window_start=epoch(row["window_start"]) or 0.0, failures=int(row["failures"]), locked_until=epoch(row["locked_until"]))

    def put_failures(self, link_id: str, *args: Any) -> None:
        generation, record = (None, args[0]) if len(args) == 1 else (args[0], args[1])
        with self.db.connection(label="tickets.public.rfq.code") as conn:
            store_rfq.code_put_failures(conn, link_id, self._gen(conn, link_id, generation), iso(record.window_start), int(record.failures),
                                        iso(record.locked_until) if record.locked_until else None)

    def clear_failures(self, link_id: str, generation: int | None = None) -> None:
        with self.db.connection(label="tickets.public.rfq.code") as conn:
            store_rfq.code_clear_failures(conn, link_id, self._gen(conn, link_id, generation))

    def put_session(self, record: SessionRecord) -> None:
        with self.db.connection(label="tickets.public.rfq.code") as conn:
            store_rfq.code_put_session(conn, record.id_hash, record.link_id, int(record.generation), iso(record.created_at), iso(record.expires_at))

    def session(self, id_hash: str) -> SessionRecord | None:
        with self.db.connection(mode="read", label="tickets.public.rfq.code") as conn:
            row = store_rfq.code_session(conn, id_hash)
        if row is None:
            return None
        return SessionRecord(id_hash=row["id_hash"], link_id=row["link_id"], generation=int(row["generation"]),
                             created_at=epoch(row["created_at"]) or 0.0, expires_at=epoch(row["expires_at"]) or 0.0)


class SqlRfqCodeSender:
    """The CodeSender of RFQ links: the D6 channel rule at send time (code_flow.code_channel_for over the live link), and ONE outbox row
    (purpose `code`, the fixed code template - no link, no title) with the code ROW id; the six digits are derived from it at render
    time (messaging._derive_code) and handed to the outbox in memory only - never stored, queued in clear or logged."""

    def __init__(self, db: Database, *, clock: Callable[[], float] | None = None) -> None:
        self.db = db
        self._clock = clock or (lambda: dt.datetime.now(UTC).timestamp())

    def channel_for(self, link: RfqLink) -> str | None:
        from .code_flow import code_channel_for

        with self.db.connection(mode="read", label="tickets.public.rfq.code_channel") as conn:
            from . import store_links

            contact = store_links.contact(conn, link.contact_id)
            row = store_rfq.link(conn, link.link_id)
            if row is None:
                return None
            return code_channel_for(conn, contact, link_sent_via=row.get("sent_via"))

    def send(self, link: RfqLink, code_id: str, channel: str) -> bool:
        from . import store_links
        from .messaging import RUNTIME

        if RUNTIME.outbox is None or channel not in ("whatsapp", "email"):
            return False
        now = self._clock()
        try:
            with self.db.connection(label="tickets.public.rfq.code_queue") as conn:
                rec = fold(store_rfq.link_by_id_joined(conn, link.link_id))
                if rec is None or rec.generation != link.generation or not rec.available(now):
                    return False
                row = store_rfq.link(conn, link.link_id) or {}
                rfq_row = rfq_vendor.rfq.row_of_link(conn, rec.rfq_id) or {}
                contact = store_links.contact(conn, rec.contact_id)
                if contact is None or contact.get("erased_at") or not rfq_row:
                    return False
                digits = codes_mod.derive_code(KEYS.get(row.get("key_id")), code_id)
                queued = RUNTIME.enqueue(conn, purpose="code", contact_id=contact["id"], link_id=rec.link_id, department_id=rfq_row["department_id"],
                                         params={"number": str(rfq_row["number"])}, channel=channel, requested_by=f"link:{rec.link_id[:6]}",
                                         code=digits, code_id=code_id, rfq_id=rec.rfq_id)
                store_rfq.code_set_outbox(conn, code_id, queued.id)
                rfq_vendor._audit(conn, rec, "ticket.rfq.vendor_code_send", rfq_row, channel=channel)
            return True
        except Exception:  # noqa: BLE001 - the route answers 503 code_unavailable; nothing about the code is logged
            log.warning("rfq verification code not queued")
            return False


def _plain_id(value: str) -> bool:
    import re

    return re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}", value) is not None


def _code_event(db: Database, link: RfqLink, kind: str, *, clock: Callable[[], float], **data: Any) -> None:
    """`code_verified` / `code_locked` on the request's timeline + the audit row (never a code, a hash or a session value)."""
    try:
        at = iso(clock())
        with db.connection(label="tickets.public.rfq.code_event") as conn:
            row = rfq_vendor.rfq.row_of_link(conn, link.rfq_id)
            if row is None:
                return
            store_rfq.insert_event(conn, row["id"], kind, actor_kind="system" if kind == "code_locked" else "contact",
                                   rfq_vendor_id=link.rfq_vendor_id, data=data, at=at)
            rfq_vendor._audit(conn, link, f"ticket.rfq.{kind}", row, **data)
    except Exception:  # noqa: BLE001 - the engine already decided the answer; a failure to record never changes it
        log.warning("rfq code event not recorded (%s)", kind)


# ---------------------------------------------------------------- request models (strict; extra = forbid)

class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class PaymentItemIn(_Strict):
    """CR-RFQ-PAYMENT-SCHEDULE: one proposed instalment - amounts and dates only (never bank data)."""
    kind: Literal["advance", "progress", "final"]
    percent: str | None = Field(default=None, max_length=8)
    amount: str | None = Field(default=None, max_length=16)
    due: Literal["date", "completion", "after_completion"]
    date: str | None = Field(default=None, max_length=10)
    days: int | None = Field(default=None, ge=0, le=180)


class PaymentIn(_Strict):
    items: list[PaymentItemIn] = Field(min_length=1, max_length=6)


class ArrivalIn(_Strict):
    action: Literal["confirm", "propose"]
    work_from: str | None = Field(default=None, max_length=40)
    work_to: str | None = Field(default=None, max_length=40)
    acknowledge_schedule: bool
    schedule_hash: str | None = Field(default=None, min_length=64, max_length=64, pattern=r"^[0-9a-f]{64}$")  # review F10 (optional echo)
    client_request_id: str = Field(max_length=64)


class QuoteIn(_Strict):
    payment: PaymentIn | None = None
    lines: list[LineIn] = Field(default_factory=list, max_length=30)
    currency: str | None = Field(default=None, max_length=3)
    amounts_include_vat: bool | None = None
    work_from: str | None = Field(default=None, max_length=40)
    work_to: str | None = Field(default=None, max_length=40)
    valid_until: str | None = Field(default=None, max_length=40)
    note: str | None = Field(default=None, max_length=4000)
    vendor_ref: str | None = Field(default=None, max_length=200)
    question: str | None = Field(default=None, max_length=8000)  # RFQQUESTIONS: a question sent with the quote (stored in his thread)
    base_version: int | None = Field(default=None, ge=1, le=100000)
    client_request_id: str = Field(max_length=64)


class WithdrawIn(_Strict):
    quote_id: str = Field(max_length=64)
    client_request_id: str = Field(max_length=64)


class DeclineIn(_Strict):
    reason: str | None = Field(default=None, max_length=1000)
    client_request_id: str = Field(max_length=64)


class MessageIn(_Strict):
    text: str = Field(max_length=8000)
    client_request_id: str = Field(max_length=64)


class CodeSendIn(_Strict):
    pass


class CodeVerifyIn(_Strict):
    code: str = Field(max_length=32)


class UploadRemoveIn(_Strict):
    """RFQ-VENDOR-UPLOAD: remove one of HIS files (contract 19.10)."""
    file_id: str = Field(max_length=64)
    client_request_id: str = Field(max_length=64)


def _refused(exc: VendorRefused | ActionRefused | rfq_vendor_files.Refused) -> PublicError:
    if exc.status == 404:
        return PublicError(404, "link_unavailable")
    return PublicError(exc.status, exc.code, **exc.extra)


def _code_refused(exc: CodeRefused) -> PublicError:
    if exc.reason in ("locked", "rate_limited"):
        code = "code_locked" if exc.reason == "locked" else "rate_limited"
        return PublicError(429, code, retry_after_s=max(1, int(exc.retry_after_s + 0.999)))
    codes_map = {"malformed": "code_malformed", "no_code": "code_missing", "expired": "code_expired", "invalid": "code_invalid"}
    extra = {"attempts_left": exc.attempts_left} if exc.attempts_left is not None else {}
    return PublicError(422, codes_map.get(exc.reason, "code_invalid"), **extra)


def _still_serving(conn, ctx: LinkContext, t: float) -> None:
    """Review F4 (2.6.3): re-read the LINK row inside the write transaction. A revoke, a new generation, a contact change (erased /
    inactive / now staff), a vendor removal or a close without grace that landed between the dependency's lookup and this write is the
    uniform 404; a read-only grace that began meanwhile is 409 `read_only`; a code switched on meanwhile needs the code session."""
    link: RfqLink = ctx.link  # type: ignore[assignment]
    fresh = fold(store_rfq.link_by_id_joined(conn, link.link_id))
    if fresh is None or fresh.generation != link.generation or fresh.contact_id != link.contact_id or not fresh.available(t):
        raise VendorLinkGone()
    if fresh.read_only(t):
        raise VendorRefused(409, "read_only")
    if fresh.require_code and not link.require_code:
        raise VendorRefused(403, "code_required")


def build_router(db: Database, *, clock: Callable[[], float] | None = None, limiter: Any = None,
                 policy: CodePolicy | Callable[[], CodePolicy] | None = None) -> APIRouter:
    """The RFQ routes over the real store. `clock` (epoch seconds) is the public app's clock in tests; `limiter` is the public app's own
    limiter (the per-recipient code caps are shared with the ticket codes); `policy` the code policy reader."""
    r = APIRouter()
    idem = Idempotency(None)  # in-process duplicate claims only: the request rows are written by the effects themselves
    store = SqlRfqLinkStore(db)
    epoch_now: Callable[[], float] = clock if clock is not None else (lambda: dt.datetime.now(UTC).timestamp())
    engine_kw: dict[str, Any] = {"clock": epoch_now}
    if limiter is not None:
        engine_kw["limiter"] = limiter
    if policy is not None:
        engine_kw["policy"] = policy
    engine = CodeEngine(SqlRfqCodeStore(db), KEYS, **engine_kw)
    sender = SqlRfqCodeSender(db, clock=epoch_now)

    def now() -> dt.datetime:
        return dt.datetime.fromtimestamp(float(epoch_now()), UTC).replace(microsecond=0)

    def rfq_context(*, write: bool = False, need_code: bool = True):
        async def dep(request: Request) -> LinkContext:
            pr = public_request(request)
            if pr.token_hash is None or pr.token_key is None:
                raise PublicError(404, "link_unavailable")
            link = await run_in_threadpool(store.lookup, pr.token_hash)
            t = epoch_now()
            if link is None or not link.available(t):
                pr.cost.unknown()
                raise PublicError(404, "link_unavailable")
            pr.cost.proved(link.link_id)
            read_only = link.read_only(t)
            code_ok = not link.require_code
            if link.require_code and pr.session:
                code_ok = await run_in_threadpool(engine.session_ok, link, pr.session)
            if write and read_only:
                raise PublicError(409, "read_only")
            if write and need_code and not code_ok:
                raise PublicError(403, "code_required")
            return LinkContext(link=link, request=pr, read_only=read_only, code_ok=code_ok, now=t)  # type: ignore[arg-type]

        return dep

    async def write(request: Request, ctx: LinkContext, route: str, crid: str, fn: Callable[..., tuple[int, dict[str, Any]]]) -> JSONResponse:
        def tx() -> tuple[int, dict[str, Any], bool]:
            when = now()
            with db.connection(label="tickets.public.rfq.write") as conn:
                _still_serving(conn, ctx, float(epoch_now()))
                replay = claim_request(conn, ctx.link, crid, route, when)  # type: ignore[arg-type]
                if replay is not None:
                    return replay[0], replay[1], False
                status, answer = fn(conn, when)
                return (*finish_request(conn, ctx.link, crid, status, answer), True)  # type: ignore[arg-type]

        async def work() -> tuple[int, dict[str, Any]]:
            try:
                status, answer, new = await run_in_threadpool(tx)
            except VendorLinkGone:
                raise PublicError(404, "link_unavailable") from None
            except (VendorRefused, ActionRefused, rfq_vendor_files.Refused) as exc:
                raise _refused(exc) from None
            if new:
                spend_budget(request)  # W18: only a stored effect spends the token's write budget
            return status, answer

        return await idem.run(idempotency_scope(ctx.link), crid, route, work)  # type: ignore[arg-type]

    @r.get(VIEW_ROUTE)
    async def get_rfq(ctx: LinkContext = Depends(rfq_context())) -> JSONResponse:
        link: RfqLink = ctx.link  # type: ignore[assignment]

        def read() -> dict[str, Any]:
            when = now()
            until = iso(link.grace_until) if ctx.read_only and link.grace_until else None
            with db.connection(label="tickets.public.rfq.open") as conn:
                if ctx.code_ok:  # review F1 (2.6.3): an open counts only past the code gate - a forwarded link alone forges no "opened"
                    rfq_vendor.record_open(conn, link, when)
                return rfq_vendor.view(conn, link, code_ok=ctx.code_ok, read_only=ctx.read_only, read_only_until=until, now=when)

        try:
            data = await run_in_threadpool(read)
        except VendorLinkGone:
            raise PublicError(404, "link_unavailable") from None
        data["code_locked_s"] = int(await run_in_threadpool(engine.locked_for, link) + 0.999) if (link.require_code and not ctx.code_ok) else 0
        return JSONResponse(data)

    @r.post(QUOTE_ROUTE)
    async def post_quote(request: Request, ctx: LinkContext = Depends(rfq_context(write=True))) -> JSONResponse:
        body: QuoteIn = await read_json(request, QuoteIn)
        crid = parse_client_request_id(body.client_request_id)
        payload = body.model_dump(exclude={"client_request_id"})
        payload["lines"] = [{k: v for k, v in ln.items() if v is not None} for ln in payload.get("lines", [])]

        def fn(conn, when: dt.datetime) -> tuple[int, dict[str, Any]]:
            return 201, {"ok": True, "quote": rfq_vendor.submit(conn, ctx.link, payload, when)}

        return await write(request, ctx, QUOTE_ROUTE, crid, fn)

    @r.post(WITHDRAW_ROUTE)
    async def post_withdraw(request: Request, ctx: LinkContext = Depends(rfq_context(write=True))) -> JSONResponse:
        body: WithdrawIn = await read_json(request, WithdrawIn)
        crid = parse_client_request_id(body.client_request_id)

        def fn(conn, when: dt.datetime) -> tuple[int, dict[str, Any]]:
            rfq_vendor.withdraw(conn, ctx.link, body.quote_id, when)
            return 200, {"ok": True}

        return await write(request, ctx, WITHDRAW_ROUTE, crid, fn)

    @r.post(DECLINE_ROUTE)
    async def post_decline(request: Request, ctx: LinkContext = Depends(rfq_context(write=True))) -> JSONResponse:
        body: DeclineIn = await read_json(request, DeclineIn)
        crid = parse_client_request_id(body.client_request_id)

        def fn(conn, when: dt.datetime) -> tuple[int, dict[str, Any]]:
            rfq_vendor.decline(conn, ctx.link, body.reason, when)
            return 200, {"ok": True}

        return await write(request, ctx, DECLINE_ROUTE, crid, fn)

    @r.post(MESSAGE_ROUTE)
    async def post_message(request: Request, ctx: LinkContext = Depends(rfq_context(write=True))) -> JSONResponse:
        body: MessageIn = await read_json(request, MessageIn)
        crid = parse_client_request_id(body.client_request_id)

        def fn(conn, when: dt.datetime) -> tuple[int, dict[str, Any]]:
            return 201, {"ok": True, "message": rfq_vendor.ask(conn, ctx.link, body.text, when)}

        return await write(request, ctx, MESSAGE_ROUTE, crid, fn)

    # ------------------------------------------------------------ RFQATT: the request's files (contract 19.4)

    async def serve_file(request: Request, attachment_id: str, ctx: LinkContext, thumb: bool) -> FileResponse:
        if not ctx.code_ok:
            raise PublicError(403, "code_required")  # like the ticket photos: nothing of the request before the code (15.3)
        root = getattr(request.app.state.deps, "attachments_root", None)
        link: RfqLink = ctx.link  # type: ignore[assignment]
        if root is None or not isinstance(attachment_id, str) or not _plain_id(attachment_id):
            raise PublicError(404, "link_unavailable")

        def read() -> tuple[dict[str, Any], int] | None:
            when = now()
            with db.connection(mode="read", label="tickets.public.rfq.file") as conn:
                fresh = fold(store_rfq.link_by_id_joined(conn, link.link_id))  # the link as it is now (a revoke meanwhile -> 404)
                if fresh is None or fresh.generation != link.generation or not fresh.available(float(epoch_now())):
                    return None
                if not rfq_vendor.shows_files(conn, link, when):
                    return None
                a = rfq_attach.for_vendor(conn, link.rfq_id, attachment_id)
                return (a, int(fresh.rfq_number or 0)) if a is not None else None

        try:
            got = await run_in_threadpool(read)
        except VendorLinkGone:
            got = None
        if got is None:
            raise PublicError(404, "link_unavailable")
        a, number = got
        path = rfq_attach.file_path(root, a, thumb)
        if path is None:
            raise PublicError(404, "link_unavailable")
        h = rfq_files.headers("image" if thumb else a["kind"], ref_number=number, file_id=a["id"], name=a["name"])
        media = h.pop("Content-Type")
        return FileResponse(path, media_type=media, headers=h)

    @r.get(FILE_ROUTE)
    async def get_file(request: Request, attachment_id: str, ctx: LinkContext = Depends(rfq_context())) -> FileResponse:
        return await serve_file(request, attachment_id, ctx, False)

    @r.get(THUMB_ROUTE)
    async def get_thumb(request: Request, attachment_id: str, ctx: LinkContext = Depends(rfq_context())) -> FileResponse:
        return await serve_file(request, attachment_id, ctx, True)

    # ------------------------------------------------------------ RFQ-VENDOR-UPLOAD: his own files on his quote (contract 19.10)

    def uploads_on() -> bool:
        with db.connection(mode="read", label="tickets.public.rfq.upload_switch") as conn:
            return rfq_vendor_files.available(conn)

    async def upload_gate(ctx: LinkContext) -> None:
        """The switch FIRST (off: the uniform 404 - the route reads as absent, before the read-only / code answers), then the write rules
        of every token write: read-only grace 409, a code-protected link without its session 403."""
        if not await run_in_threadpool(uploads_on):
            raise PublicError(404, "link_unavailable")
        if ctx.read_only:
            raise PublicError(409, "read_only")
        if not ctx.code_ok:
            raise PublicError(403, "code_required")

    def _field(form: dict[str, Any], key: str) -> str | None:
        part = form.get(key)
        if part is None:
            return None
        try:
            return part.text()
        except MultipartError:
            raise PublicError(422, "invalid", fields=[{"field": key, "code": "encoding"}]) from None

    @r.post(UPLOAD_ROUTE)
    async def post_upload(request: Request, ctx: LinkContext = Depends(rfq_context())) -> JSONResponse:
        """One file onto HIS submitted quote (`quote_id`) or one of HIS own questions (`message_id`, no quote needed). The photo route's protections, through the public app's own handles (UploadGuards): one
        upload in flight per link, the upload memory budget and the installation cap BEFORE the body is read, the body phase paid when it
        starts (the edge's `rfq_upload` windows: per link and per client network), the processing and decoder admission; the request /
        quote / quota checks before the decode, the SAME content checks as a manager's file (rfq_files.store: pictures re-encoded, WebP
        refused, PDF / office structure, office only with allow_office), everything re-checked in the write transaction; idempotent by
        `client_request_id` (a retry of a stored upload is its replay, before any decode)."""
        await upload_gate(ctx)
        deps = request.app.state.deps
        guards = getattr(request.app.state, "uploads", None)
        root = getattr(deps, "attachments_root", None)
        if guards is None or root is None:
            raise PublicError(404, "link_unavailable")
        link: RfqLink = ctx.link  # type: ignore[assignment]
        storage = getattr(deps, "storage", None)
        with guards.in_flight.claim(link.link_id):
            need = ctx.request.content_length or ctx.request.rule.max_body
            async with guards.memory(need, link.link_id):
                if storage is not None:
                    await run_in_threadpool(storage.admit, need)
                begin_body(request)  # from here on this upload costs one unit of the link's `rfq_upload` budget, whatever follows
                raw = bytearray()
                async for chunk in request.stream():
                    raw += chunk
                try:
                    form = parse_form(raw, boundary_of(ctx.request.content_type), UPLOAD_FIELDS)
                except MultipartError as exc:
                    raise PublicError(422, "invalid", fields=[{"field": "form", "code": exc.code}]) from None
                finally:
                    del raw
                crid = parse_client_request_id(_field(form, "client_request_id"))
                target = {"quote_id": _field(form, "quote_id") or None, "message_id": _field(form, "message_id") or None}
                name = _field(form, "name") or ""
                data = form["file"].data
                del form
                scope = idempotency_scope(link)  # type: ignore[arg-type]

                def precheck() -> tuple[int, dict[str, Any]] | None:
                    from . import store_links

                    with db.connection(label="tickets.public.rfq.upload_check") as conn:
                        _still_serving(conn, ctx, float(epoch_now()))
                        prior = store_links.request_row(conn, scope, crid)
                        if prior is not None:
                            if prior["route"] != UPLOAD_ROUTE:
                                raise ActionRefused(409, "request_id_reused")
                            if not prior["status_code"]:
                                raise ActionRefused(409, "request_in_progress", retry_after_s=2)
                            body = json.loads(prior["response_json"] or "{}")
                            return int(prior["status_code"]), body if isinstance(body, dict) else {}
                        rfq_vendor_files.check_add(conn, link, target, data, now())
                        return None

                def office_on() -> bool:
                    with db.connection(mode="read", label="tickets.public.rfq.upload_office") as conn:
                        return rfq_files.office_allowed(conn)

                def tx(stored: rfq_files.StoredFile) -> tuple[int, dict[str, Any], bool]:
                    when = now()
                    with db.connection(label="tickets.public.rfq.upload") as conn:
                        _still_serving(conn, ctx, float(epoch_now()))
                        replay = claim_request(conn, link, crid, UPLOAD_ROUTE, when)  # type: ignore[arg-type]
                        if replay is not None:
                            return replay[0], replay[1], False
                        f = rfq_vendor_files.record(conn, link, stored, name=name, target=target, now=when)
                        return (*finish_request(conn, link, crid, 201, {"ok": True, "file": f}), True)  # type: ignore[arg-type]

                async def work() -> tuple[int, dict[str, Any]]:
                    async with guards.processing():
                        try:
                            prior = await run_in_threadpool(precheck)
                        except VendorLinkGone:
                            raise PublicError(404, "link_unavailable") from None
                        except (VendorRefused, ActionRefused, rfq_vendor_files.Refused) as exc:
                            raise _refused(exc) from None
                        if prior is not None:
                            return prior
                        allow_office = await run_in_threadpool(office_on)
                        try:
                            async with guards.decode():
                                stored = await run_in_threadpool(lambda: rfq_files.store(
                                    root, link.rfq_id, data, wait_s=getattr(deps, "decode_wait_s", image_intake.DECODE_WAIT_S),
                                    allow_office=allow_office, allow_webp=False, semaphore=image_intake._DECODE))
                        except StorePathError:
                            raise PublicError(404, "link_unavailable") from None
                        except IntakeError as exc:
                            raise PublicError(exc.status, "unsupported_format" if exc.code == "webp_refused" else exc.code,
                                              **{k: v for k, v in (exc.details or {}).items() if isinstance(v, int)}) from None
                        if storage is not None:
                            storage.note(stored.stored_bytes)
                        try:
                            status, answer, new = await run_in_threadpool(tx, stored)
                        except BaseException as exc:
                            rfq_files.remove(root, stored.rel_path, stored.thumb_rel)
                            if storage is not None:
                                storage.note(-stored.stored_bytes)
                            if isinstance(exc, VendorLinkGone):
                                raise PublicError(404, "link_unavailable") from None
                            if isinstance(exc, (VendorRefused, ActionRefused, rfq_vendor_files.Refused)):
                                raise _refused(exc) from None
                            raise
                        if not new:  # a replay that raced past the precheck: the bytes just stored are nobody's
                            rfq_files.remove(root, stored.rel_path, stored.thumb_rel)
                            if storage is not None:
                                storage.note(-stored.stored_bytes)
                        return status, answer

                return await idem.run(scope, crid, UPLOAD_ROUTE, work)

    @r.post(UPLOAD_REMOVE_ROUTE)
    async def post_upload_remove(request: Request, ctx: LinkContext = Depends(rfq_context())) -> JSONResponse:
        """One of HIS live files marked removed (kept for the record; the managers see it marked). Any other id: 409 `upload_not_found`."""
        await upload_gate(ctx)
        body: UploadRemoveIn = await read_json(request, UploadRemoveIn)
        crid = parse_client_request_id(body.client_request_id)

        def fn(conn, when: dt.datetime) -> tuple[int, dict[str, Any]]:
            rfq_vendor_files.remove(conn, ctx.link, body.file_id, when)
            return 200, {"ok": True}

        return await write(request, ctx, UPLOAD_REMOVE_ROUTE, crid, fn)

    @r.post(ARRIVAL_ROUTE)
    async def post_arrival(request: Request, ctx: LinkContext = Depends(rfq_context(write=True))) -> JSONResponse:
        """CR-RFQ-PAYMENT-SCHEDULE: the awarded vendor confirms the planned arrival window or proposes another one, and acknowledges
        the approved payment schedule (his own award only; every other case is 409 `arrival_closed`)."""
        body: ArrivalIn = await read_json(request, ArrivalIn)
        crid = parse_client_request_id(body.client_request_id)
        payload = body.model_dump(exclude={"client_request_id"})

        def fn(conn, when: dt.datetime) -> tuple[int, dict[str, Any]]:
            return 200, {"ok": True, "terms": rfq_terms.vendor_act(conn, ctx.link, payload, when)}

        return await write(request, ctx, ARRIVAL_ROUTE, crid, fn)

    # ------------------------------------------------------------ the optional verification code (15.2), as /t/api/code/*

    @r.post(CODE_SEND_ROUTE)
    async def code_send(request: Request, ctx: LinkContext = Depends(rfq_context(need_code=False))) -> JSONResponse:
        await read_json(request, CodeSendIn)
        link: RfqLink = ctx.link  # type: ignore[assignment]
        if not link.require_code:
            raise PublicError(409, "code_not_required")
        channel = await run_in_threadpool(sender.channel_for, link)
        if channel not in ("whatsapp", "email"):
            raise PublicError(503, "code_unavailable")
        try:
            issued = await run_in_threadpool(engine.issue, link, channel)
        except CodeRefused as exc:
            raise _code_refused(exc) from None
        except ModuleKeyError:
            raise PublicError(503, "code_unavailable") from None
        if not await run_in_threadpool(sender.send, link, issued.code_id, channel):
            await run_in_threadpool(engine.withdraw, link, issued.code_id)
            raise PublicError(503, "code_unavailable")
        return JSONResponse({"sent": True, "channel": channel, "expires_in_s": int(issued.expires_at - epoch_now())})

    @r.post(CODE_VERIFY_ROUTE)
    async def code_verify(request: Request, ctx: LinkContext = Depends(rfq_context(need_code=False))) -> JSONResponse:
        body: CodeVerifyIn = await read_json(request, CodeVerifyIn)
        link: RfqLink = ctx.link  # type: ignore[assignment]
        if not link.require_code:
            raise PublicError(409, "code_not_required")
        try:
            verified = await run_in_threadpool(engine.verify, link, body.code)
        except CodeRefused as exc:
            if exc.just_locked:
                await run_in_threadpool(_code_event, db, link, "code_locked", clock=epoch_now)
            raise _code_refused(exc) from None
        except ModuleKeyError:
            raise PublicError(503, "code_unavailable") from None
        await run_in_threadpool(_code_event, db, link, "code_verified", clock=epoch_now)
        return JSONResponse({"session": verified.session, "expires_in_s": int(verified.expires_at - epoch_now())})

    return r
