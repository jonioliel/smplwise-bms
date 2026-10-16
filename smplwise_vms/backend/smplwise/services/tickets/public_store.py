"""CR-038 slice 4: the storage ports of the public listener (public_ports.py) over the real SQLite store (migration 0080 + 0079).

Contract kept by every class (public_ports.py, code review section 3):
- `SqlLinkStore.lookup` is ONE read: `store_links.LOOKUP_SQL` driven by the unique index on `token_hash`, the same statement
  for every state of the row (W1). The row is folded into a LinkRecord here: revoked when `revoked_at` is set, when the
  assignment is no longer the ticket's current one while the ticket is open, or when the ticket is closed / cancelled and no
  read-only grace was recorded for this link (W2 - fail closed); `grace_until` only for a closed / cancelled ticket; the
  expiry is the earlier of the sliding expiry and the cap. A purged ticket takes its links with it (ON DELETE CASCADE): None.
- The lookup runs on a read-mode connection (deferred, query-only): an anonymous request never takes the write gate (W6).
- Every write is one short transaction of its own; the photo's `record` writes the attachment, the timeline row, the audit
  row, the sliding expiry AND the `ticket_requests` row together (W5): a crash between them leaves nothing half done.
- `SqlRedeemStore.release` is one UPDATE ... RETURNING (W4); `SqlCodeStore.consume` is a compare-and-set and `replace_code`
  invalidates the older codes in the insert's transaction (W7).
- Times are epoch seconds at the port and ISO `...Z` text in the tables.

The code ports accept both shapes of the public-core library while code review V8 (generation-scoped codes) lands: a call
without a generation means the link's current generation."""
from __future__ import annotations

import dataclasses
import datetime as dt
import json
import logging
from pathlib import Path
from typing import Any, Callable, Mapping

from ...audit import audit
from ...db import Database, new_id
from . import image_intake, links, store_links
from .public_ports import CodeRecord, FailureRecord, LinkRecord, PhotoCounts, PhotoFile, SessionRecord, StoredImage, StoredResponse

log = logging.getLogger("smplwise.tickets.public")
FINAL = ("closed", "cancelled")
PHOTO_ROUTE = "/t/api/photo"


# ---------------------------------------------------------------- time


def iso(t: float) -> str:
    return dt.datetime.fromtimestamp(float(t), dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def epoch(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


# ---------------------------------------------------------------- the actor of a link's writes (audit)


@dataclasses.dataclass(frozen=True)
class LinkActor:
    """The synthetic principal of a write made through a handler link (spec 10.3: actor `contact:<id>`, source `ticket_link`).
    It holds no permission anywhere: it only names who acted in the audit row."""

    contact_id: str

    @property
    def user_id(self) -> str:
        return f"contact:{self.contact_id}"

    @property
    def username(self) -> str:
        return "ticket_link"

    source = "ticket_link"


class _NoGrant:
    scope = None


NO_GRANT = _NoGrant()


def audit_link(conn, link: LinkRecord, action: str, *, decision: str = "allowed", reason: str | None = None, **details: Any) -> None:
    audit(conn, actor=LinkActor(link.contact_id), action=action, decision=decision, resource_type="ticket", resource_id=link.ticket_id,
          reason=reason, details={"source": "ticket_link", "link": link.link_id[:6], "number": link.ticket_number, **details}, under=NO_GRANT)


# ---------------------------------------------------------------- LinkRecord from a joined row

_LINK_FIELDS = {f.name for f in dataclasses.fields(LinkRecord)}
_CODE_FIELDS = {f.name for f in dataclasses.fields(CodeRecord)}


def make_link_record(**kw: Any) -> LinkRecord:
    return LinkRecord(**{k: v for k, v in kw.items() if k in _LINK_FIELDS})


def make_code_record(**kw: Any) -> CodeRecord:
    return CodeRecord(**{k: v for k, v in kw.items() if k in _CODE_FIELDS})


def _staff_contact(row: Mapping[str, Any]) -> bool:
    """2.5.8 review F4: the joined contact is a TKSTAFF2 staff contact (assignees.is_staff: a flagged person, no user, no vendor)."""
    keys = row.keys()
    if "c_employee" not in keys:
        return False
    return row["c_kind"] == "person" and bool(row["c_employee"]) and not row["c_user_id"] and not row["c_vendor_id"]


def fold(row: Mapping[str, Any] | None) -> LinkRecord | None:
    """The LinkRecord of a joined lookup row (module docstring, W2)."""
    if row is None:
        return None
    final = row["t_status"] in FINAL
    current = row["t_current"] == row["assignment_id"]
    if final:
        # the ticket is closed / cancelled: only a link whose close recorded a grace stays readable, until the grace ends
        revoked = bool(row["revoked_at"]) or not row["grace_until"] or (row["asg_ended_at"] is not None and row["asg_end_reason"] not in FINAL)
        grace = epoch(row["grace_until"])
    else:
        revoked = bool(row["revoked_at"]) or row["asg_ended_at"] is not None or not current
        grace = None
    expires = min(epoch(row["expires_at"]) or 0.0, epoch(row["cap_at"]) or 0.0)
    return make_link_record(
        link_id=row["id"], generation=int(row["generation"]), ticket_id=row["ticket_id"], assignment_id=row["assignment_id"],
        contact_id=row["contact_id"], require_code=bool(row["require_code"]), expires_at=expires, key_id=row["key_id"],
        grace_until=grace, revoked=revoked, recipient_key=row["c_phone_key"], sent_via=row["sent_via"], ticket_number=row["t_number"],
        kind=(row["kind"] if "kind" in row.keys() else None) or "external",
        staff_contact=_staff_contact(row),
    )


class SqlLinkStore:
    def __init__(self, db: Database) -> None:
        self.db = db

    def lookup(self, token_hash: str) -> LinkRecord | None:
        with self.db.connection(mode="read", label="tickets.public.lookup") as conn:
            return fold(store_links.link_by_token_hash(conn, token_hash))

    def by_id(self, link_id: str) -> LinkRecord | None:
        if not links.is_link_id(link_id):
            return None
        with self.db.connection(mode="read", label="tickets.public.link") as conn:
            return fold(store_links.link_by_id_joined(conn, link_id))


# ---------------------------------------------------------------- e-mail redeem ids


class SqlRedeemStore:
    def __init__(self, db: Database) -> None:
        self.db = db

    def release(self, rid_hash: str, now: float, max_uses: int) -> tuple[str, int] | None:
        with self.db.connection(label="tickets.public.redeem") as conn:
            return store_links.release_redeem(conn, rid_hash, iso(now), max_uses)


# ---------------------------------------------------------------- idempotency rows


class SqlRequestLog:
    """`ticket_requests` (scope `link:<link_id>`). The effects of slice 4 write their own row inside their transaction
    (handler_actions / SqlPhotoSink.record); `put` then finds it and answers False - a no-op, never a second row."""

    def __init__(self, db: Database) -> None:
        self.db = db

    def get(self, scope: str, client_request_id: str) -> StoredResponse | None:
        with self.db.connection(mode="read", label="tickets.public.request") as conn:
            row = store_links.request_row(conn, scope, client_request_id)
        if row is None or not row["status_code"]:
            return None
        try:
            body = json.loads(row["response_json"] or "{}")
        except ValueError:
            body = {}
        return StoredResponse(route=row["route"], status=int(row["status_code"]), body=body if isinstance(body, dict) else {})

    def put(self, scope: str, client_request_id: str, route: str, status: int, body: Mapping[str, Any]) -> bool:
        with self.db.connection(label="tickets.public.request") as conn:
            return store_links.insert_request(conn, scope, client_request_id, route, status, dict(body), iso_now())


def iso_now() -> str:
    return iso(dt.datetime.now(dt.timezone.utc).timestamp())


# ---------------------------------------------------------------- verification codes (option B)


class SqlCodeStore:
    def __init__(self, db: Database) -> None:
        self.db = db

    def _gen(self, conn, link_id: str, generation: int | None) -> int:
        if generation is not None:
            return int(generation)
        row = store_links.link(conn, link_id)
        return int(row["generation"]) if row else 1

    @staticmethod
    def _code(row: Mapping[str, Any] | None) -> CodeRecord | None:
        if row is None:
            return None
        return make_code_record(id=row["id"], link_id=row["link_id"], generation=int(row["generation"]), code_hash=row["code_hash"],
                                channel=row["channel"], created_at=epoch(row["created_at"]) or 0.0, expires_at=epoch(row["expires_at"]) or 0.0,
                                attempts=int(row["attempts"]), consumed_at=epoch(row["consumed_at"]))

    def latest_code(self, link_id: str, generation: int | None = None) -> CodeRecord | None:
        with self.db.connection(mode="read", label="tickets.public.code") as conn:
            return self._code(store_links.latest_code(conn, link_id, self._gen(conn, link_id, generation)))

    def code_times_since(self, link_id: str, *args: Any) -> list[float]:
        generation, since = (None, args[0]) if len(args) == 1 else (args[0], args[1])
        with self.db.connection(mode="read", label="tickets.public.code") as conn:
            return [epoch(t) or 0.0 for t in store_links.code_times_since(conn, link_id, self._gen(conn, link_id, generation), iso(since))]

    def replace_code(self, record: CodeRecord, now: float) -> None:
        with self.db.connection(label="tickets.public.code") as conn:
            gen = getattr(record, "generation", None)
            store_links.replace_code(conn, {
                "id": record.id, "link_id": record.link_id, "generation": self._gen(conn, record.link_id, gen), "code_hash": record.code_hash,
                "channel": record.channel, "created_at": iso(record.created_at), "expires_at": iso(record.expires_at),
                "attempts": record.attempts, "consumed_at": iso(record.consumed_at) if record.consumed_at else None,
            }, iso(now))

    def expire_code(self, code_id: str, now: float) -> None:
        with self.db.connection(label="tickets.public.code") as conn:
            store_links.expire_code(conn, code_id, iso(now))

    def add_attempt(self, code_id: str) -> int:
        with self.db.connection(label="tickets.public.code") as conn:
            return store_links.add_attempt(conn, code_id)

    def consume(self, code_id: str, now: float) -> bool:
        with self.db.connection(label="tickets.public.code") as conn:
            return store_links.consume_code(conn, code_id, iso(now))

    def failures(self, link_id: str, generation: int | None = None) -> FailureRecord | None:
        with self.db.connection(mode="read", label="tickets.public.code") as conn:
            row = store_links.failures(conn, link_id, self._gen(conn, link_id, generation))
        if row is None:
            return None
        return FailureRecord(window_start=epoch(row["window_start"]) or 0.0, failures=int(row["failures"]), locked_until=epoch(row["locked_until"]))

    def put_failures(self, link_id: str, *args: Any) -> None:
        generation, record = (None, args[0]) if len(args) == 1 else (args[0], args[1])
        with self.db.connection(label="tickets.public.code") as conn:
            store_links.put_failures(conn, link_id, self._gen(conn, link_id, generation), iso(record.window_start), int(record.failures),
                                     iso(record.locked_until) if record.locked_until else None)

    def clear_failures(self, link_id: str, generation: int | None = None) -> None:
        with self.db.connection(label="tickets.public.code") as conn:
            store_links.clear_failures(conn, link_id, self._gen(conn, link_id, generation))

    def put_session(self, record: SessionRecord) -> None:
        with self.db.connection(label="tickets.public.code") as conn:
            store_links.put_session(conn, record.id_hash, record.link_id, int(record.generation), iso(record.created_at), iso(record.expires_at))

    def session(self, id_hash: str) -> SessionRecord | None:
        with self.db.connection(mode="read", label="tickets.public.code") as conn:
            row = store_links.session(conn, id_hash)
        if row is None:
            return None
        return SessionRecord(id_hash=row["id_hash"], link_id=row["link_id"], generation=int(row["generation"]),
                             created_at=epoch(row["created_at"]) or 0.0, expires_at=epoch(row["expires_at"]) or 0.0)


class NoCodeChannel:
    """The CodeSender until the ticket message channel exists (slices 5b / 7): no channel may carry a code, so `code/send`
    answers 503 `code_unavailable` and nothing is ever sent. Slice 5b / 7 replace it with the outbox (purpose `code`, the code
    row id only - the six digits are derived by the worker at render time)."""

    def channel_for(self, link: LinkRecord) -> str | None:
        return None

    def send(self, link: LinkRecord, code_id: str, channel: str) -> bool:
        return False


# ---------------------------------------------------------------- photos


class LinkGone(Exception):
    """The link stopped serving between the lookup and the write (closed, returned, revoked meanwhile): the photo route deletes
    the stored file and the caller answers the uniform 404."""


class SqlPhotoSink:
    """`ticket_attachments` for the handler's photos. `record` is ONE transaction (W5); `open` serves only a photo of the link's
    own ticket that is marked for the handler and not deleted, and only the handler's own uploads or the organisation's photos
    marked for the handler since this contact was first assigned (W10, review T15)."""

    def __init__(self, db: Database, root: Path, *, clock: Callable[[], float] | None = None) -> None:
        self.db = db
        self.root = Path(root)
        self._clock = clock or (lambda: dt.datetime.now(dt.timezone.utc).timestamp())

    def counts(self, link: LinkRecord) -> PhotoCounts:
        with self.db.connection(mode="read", label="tickets.public.photo") as conn:
            a, t = store_links.photo_counts(conn, link.ticket_id, link.assignment_id)
        return PhotoCounts(a, t)

    def record(self, link: LinkRecord, image: StoredImage, client_request_id: str) -> Mapping[str, Any]:
        from . import handler_actions

        with self.db.connection(label="tickets.public.photo") as conn:
            return handler_actions.record_photo(conn, link, image, client_request_id, now=self._clock())

    def open(self, link: LinkRecord, attachment_id: str) -> PhotoFile | None:
        if not isinstance(attachment_id, str) or not attachment_id:
            return None
        with self.db.connection(mode="read", label="tickets.public.photo") as conn:
            att = store_links.handler_attachment(conn, link.ticket_id, attachment_id)
            if att is None:
                return None
            if att["uploaded_by_kind"] == "contact":
                if att["uploaded_by"] != link.contact_id:
                    return None
            else:
                since = store_links.first_assigned_at(conn, link.ticket_id, link.contact_id)
                if since is None or att["created_at"] < since:
                    return None
        try:
            path = image_intake.resolve_stored(self.root, att["path"])
        except image_intake.StorePathError:
            return None
        return PhotoFile(path=path, ticket_number=int(link.ticket_number or 0))
