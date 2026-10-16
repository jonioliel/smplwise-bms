"""CR-038 slice 6b (D24, section 13.6): the query language of the board's TABLE view - the one whitelist that validates the list
API's sort and filters, the CSV export's columns and the saved views (`ticket_saved_views.view_json`). Pure functions, no SQL (the
SQL is store.table_rows_unchecked, reached through access.visible_table_page only).

    sort      `<key>:<asc|desc>[,<key>:<dir>]` from SORT_KEYS; at most two keys, no repeat; ties are broken by the ticket id
    filters   scope, status (a group or a list), department[], priority[] (keys), assignee (user:<id> | contact:<id> | none | me),
              floor, area, stuck (any | a stuck kind), waiting (manager), created_from / created_to (UTC instants), q
    cursor    SEALED {sort, values of the last row's sort keys, its id} (AES-GCM under a per-process key - TK251): the position may
              be an invisible row or a limited one (a short page stops on whatever row it looked at last), so its sort values - a
              title, a place, an SLA due - must not be readable by the client; a cursor that does not open is a TableError (the
              client starts over; a restart of the add-on does the same). Forging is impossible; even a forged position would only
              move inside the caller's visible set (every value is a bound parameter and every row still passes access.visible())
    limit     25 / 50 / 100 / 200

Anything outside the whitelist is a `TableError` (the router answers 422 `validation` naming the field)."""
from __future__ import annotations

import base64
import binascii
import json
import os
import re
import time
from dataclasses import dataclass, field
from typing import Any

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .model import STATUSES, clean_text

SORT_KEYS: tuple[str, ...] = ("number", "title", "department", "priority", "status", "assignee", "place", "device", "created", "activity", "stuck", "sla",
                              "cost")
# the table's columns (13.6) - the same keys as the sort, the CSV export takes them too; `number` and `title` are always shown
COLUMNS: tuple[str, ...] = SORT_KEYS + ("cost_status",)
# slice 9 (11A.9): the cost columns, their sort and the cost-status filter exist only for tickets.costs.view holders - asking for
# them without the permission is a 403 (the router checks `uses_costs`); a row whose place lacks the permission shows them blank
COST_KEYS: tuple[str, ...] = ("cost", "cost_status")
COST_STATUSES: tuple[str, ...] = ("not_required", "awaiting", "submitted", "rejected", "approved", "paid")
DEFAULT_COLUMNS: tuple[str, ...] = ("number", "title", "department", "priority", "status", "assignee", "place", "activity")
REQUIRED_COLUMNS: tuple[str, ...] = ("number", "title")
DEFAULT_SORT: tuple[tuple[str, str], ...] = (("activity", "desc"),)
MAX_SORT_KEYS = 2
LIMITS: tuple[int, ...] = (25, 50, 100, 200)
DEFAULT_LIMIT = 50
DENSITIES: tuple[str, ...] = ("comfortable", "compact")
VIEWS: tuple[str, ...] = ("cards", "table", "kanban")
SCOPES: tuple[str, ...] = ("visible", "mine", "department", "all")
STATUS_GROUPS: dict[str, tuple[str, ...]] = {
    "open": ("new", "assigned", "acknowledged", "in_progress", "waiting_part", "done", "returned"),
    "unassigned": ("new", "returned"),
    "handling": ("assigned", "acknowledged", "in_progress", "waiting_part"),
    "done": ("done",),
    "closed": ("closed", "cancelled"),
}
PRIORITY_KEYS: tuple[str, ...] = ("urgent", "high", "normal", "low")
STUCK_KINDS: tuple[str, ...] = ("unassigned", "unopened", "ack", "stuck", "waiting", "overdue")
MAX_LIST = 20
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
_INSTANT_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$")
FILTER_KEYS: tuple[str, ...] = ("scope", "status", "department", "priority", "assignee", "floor", "area", "stuck", "waiting", "created_from", "created_to", "q",
                                "cost_status")


class TableError(ValueError):
    """A value outside the whitelist: `field` names it for the 422 answer."""

    def __init__(self, field_name: str, code: str = "invalid"):
        super().__init__(f"{field_name}:{code}")
        self.field = field_name
        self.code = code


@dataclass(frozen=True)
class Filters:
    scope: str = "visible"
    statuses: tuple[str, ...] | None = STATUS_GROUPS["open"]  # None = every status
    status_text: str = "open"  # as written (a group name or the comma list) - what a saved view keeps
    departments: tuple[str, ...] = ()
    priorities: tuple[str, ...] = ()
    assignee: str = ""  # '' | 'none' | 'me' | 'user:<id>' | 'contact:<id>'
    floor: str = ""
    area: str = ""
    stuck: str = ""  # '' | 'any' | a stuck kind
    waiting: str = ""  # '' | 'manager'
    created_from: str = ""
    created_to: str = ""
    q: str = ""
    cost_statuses: tuple[str, ...] = ()  # slice 9

    def as_dict(self) -> dict[str, Any]:
        """The canonical form (what a saved view stores and the export audit names): empty values left out."""
        out: dict[str, Any] = {"scope": self.scope, "status": self.status_text}
        if self.departments:
            out["department"] = list(self.departments)
        if self.priorities:
            out["priority"] = list(self.priorities)
        for k in ("assignee", "floor", "area", "stuck", "waiting", "created_from", "created_to", "q"):
            v = getattr(self, k)
            if v:
                out[k] = v
        if self.cost_statuses:
            out["cost_status"] = list(self.cost_statuses)
        return out


@dataclass(frozen=True)
class Query:
    filters: Filters = field(default_factory=Filters)
    sort: tuple[tuple[str, str], ...] = DEFAULT_SORT

    @property
    def sort_text(self) -> str:
        return sort_text(self.sort)

    @property
    def uses_costs(self) -> bool:
        """Slice 9: the cost sort or the cost-status filter (tickets.costs.view at installation scope only - the order of the rows
        must not leak amounts of tickets the caller may not see the costs of)."""
        return bool(self.filters.cost_statuses) or any(k == "cost" for k, _d in self.sort)


# ---------------------------------------------------------------- parsing

def _list(raw: Any, name: str) -> list[str]:
    """A comma-separated string or a list of strings -> distinct non-empty items (at most MAX_LIST)."""
    if raw is None or raw == "":
        return []
    if isinstance(raw, str):
        items = [x.strip() for x in raw.split(",")]
    elif isinstance(raw, (list, tuple)):
        if not all(isinstance(x, str) for x in raw):
            raise TableError(name)
        items = [x.strip() for x in raw]
    else:
        raise TableError(name)
    out = list(dict.fromkeys(x for x in items if x))
    if len(out) > MAX_LIST:
        raise TableError(name, "too_many")
    return out


def parse_status(raw: Any) -> tuple[tuple[str, ...] | None, str]:
    """`open` / `unassigned` / `handling` / `done` / `closed` / `all`, or a comma list of statuses."""
    if raw is None or raw == "":
        return STATUS_GROUPS["open"], "open"
    if isinstance(raw, str) and raw == "all":
        return None, "all"
    if isinstance(raw, str) and raw in STATUS_GROUPS:
        return STATUS_GROUPS[raw], raw
    items = _list(raw, "status")
    if not items or any(s not in STATUSES for s in items):
        raise TableError("status")
    ordered = tuple(s for s in STATUSES if s in items)
    return ordered, ",".join(ordered)


def _instant(raw: Any, name: str) -> str:
    if raw is None or raw == "":
        return ""
    if not isinstance(raw, str) or len(raw) > 40 or not _INSTANT_RE.match(raw):
        raise TableError(name, "format")
    from ..timeutil import iso_utc, parse_utc

    try:
        return iso_utc(parse_utc(raw))
    except ValueError:
        raise TableError(name, "format") from None


def _id(raw: Any, name: str) -> str:
    if raw is None or raw == "":
        return ""
    if not isinstance(raw, str) or not ID_RE.match(raw):
        raise TableError(name)
    return raw


def parse_filters(raw: dict[str, Any]) -> Filters:
    """The whitelist of section 13.6 (also for a saved view's `filters`). Unknown keys are refused."""
    if not isinstance(raw, dict):
        raise TableError("filters")
    unknown = [k for k in raw if k not in FILTER_KEYS]
    if unknown:
        raise TableError(unknown[0], "unknown")
    scope = raw.get("scope") or "visible"
    if scope not in SCOPES:
        raise TableError("scope")
    statuses, status_text = parse_status(raw.get("status"))
    departments = _list(raw.get("department"), "department")
    if any(not ID_RE.match(d) for d in departments):
        raise TableError("department")
    priorities = _list(raw.get("priority"), "priority")
    if any(p not in PRIORITY_KEYS for p in priorities):
        raise TableError("priority")
    assignee = raw.get("assignee") or ""
    if assignee:
        if not isinstance(assignee, str):
            raise TableError("assignee")
        kind, _, ident = assignee.partition(":")
        if assignee in ("none", "me"):
            pass
        elif kind in ("user", "contact") and ID_RE.match(ident):
            pass
        else:
            raise TableError("assignee")
    stuck = raw.get("stuck") or ""
    if stuck and stuck != "any" and stuck not in STUCK_KINDS:
        raise TableError("stuck")
    waiting = raw.get("waiting") or ""
    if waiting and waiting != "manager":
        raise TableError("waiting")
    created_from = _instant(raw.get("created_from"), "created_from")
    created_to = _instant(raw.get("created_to"), "created_to")
    if created_from and created_to and created_from > created_to:
        raise TableError("created_to", "before_from")
    q = raw.get("q") or ""
    if not isinstance(q, str) or len(q) > 80:
        raise TableError("q")
    cost_statuses = _list(raw.get("cost_status"), "cost_status")
    if any(c not in COST_STATUSES for c in cost_statuses):
        raise TableError("cost_status")
    return Filters(
        scope=scope, statuses=statuses, status_text=status_text, departments=tuple(departments), priorities=tuple(priorities),
        assignee=assignee, floor=_id(raw.get("floor"), "floor"), area=_id(raw.get("area"), "area"), stuck=stuck, waiting=waiting,
        created_from=created_from, created_to=created_to, q=clean_text(q), cost_statuses=tuple(cost_statuses),
    )


def parse_sort(raw: Any) -> tuple[tuple[str, str], ...]:
    """`key:dir[,key:dir]` (a bare key sorts ascending); the default (last activity, newest first) when empty."""
    if raw is None or raw == "":
        return DEFAULT_SORT
    if not isinstance(raw, str) or len(raw) > 60:
        raise TableError("sort")
    out: list[tuple[str, str]] = []
    for part in raw.split(","):
        key, _, direction = part.strip().partition(":")
        direction = direction or "asc"
        if key not in SORT_KEYS or direction not in ("asc", "desc") or any(k == key for k, _ in out):
            raise TableError("sort")
        out.append((key, direction))
    if not out or len(out) > MAX_SORT_KEYS:
        raise TableError("sort")
    return tuple(out)


def sort_text(sort: tuple[tuple[str, str], ...]) -> str:
    return ",".join(f"{k}:{d}" for k, d in sort)


def parse_limit(raw: Any) -> int:
    if raw is None or raw == "":
        return DEFAULT_LIMIT
    try:
        value = int(raw)
    except (TypeError, ValueError):
        raise TableError("limit") from None
    if value not in LIMITS:
        raise TableError("limit")
    return value


def parse_columns(raw: Any, *, name: str = "columns", require: bool = True) -> tuple[str, ...]:
    """Visible columns in their order (a column chooser's result). `require`: the table always shows the number and the title - when
    missing they are added at the front; the CSV export (require=False) takes exactly the columns asked for."""
    items = _list(raw, name)
    if not items:
        return DEFAULT_COLUMNS
    if any(c not in COLUMNS for c in items):
        raise TableError(name)
    head = [c for c in REQUIRED_COLUMNS if c not in items] if require else []
    return tuple(head + items)


# ---------------------------------------------------------------- the cursor (keyset pagination)

CURSOR_MAX = 1600  # two sort values of up to 200 characters, sealed and base64 (the router's query limit is the same)
_CURSOR_KEY = AESGCM.generate_key(bit_length=128)  # per process: nothing to store, nothing to leak; a restart starts lists over
_CURSOR_AAD = b"smplwise.tickets.table.cursor.v2"
CURSOR_TTL_S = 1800  # review R2 A-3: a cursor lives 30 minutes (a list left open longer starts over)


def _aad(uid: str, fingerprint: str) -> bytes:
    """Review R2 A-3: the cursor is bound to its caller and to the exact filter set (a replay by another user, from a log or a
    shared address, or with other filters does not open: the same 422 `cursor`)."""
    return _CURSOR_AAD + b"\x1f" + uid.encode() + b"\x1f" + fingerprint.encode()


def filters_fingerprint(query: "Query") -> str:
    import hashlib

    doc = json.dumps({"f": query.filters.as_dict(), "s": query.sort_text}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(doc.encode()).hexdigest()[:32]


def encode_cursor(sort: tuple[tuple[str, str], ...], values: list[Any], ticket_id: str, *, uid: str = "", fingerprint: str = "") -> str:
    raw = json.dumps({"s": sort_text(sort), "v": values, "i": ticket_id, "t": int(time.time())}, ensure_ascii=False, separators=(",", ":"))
    nonce = os.urandom(12)
    sealed = nonce + AESGCM(_CURSOR_KEY).encrypt(nonce, raw.encode(), _aad(uid, fingerprint))
    return base64.urlsafe_b64encode(sealed).decode().rstrip("=")


def _open_cursor(cursor: str, aad: bytes = _CURSOR_AAD) -> bytes:
    try:
        blob = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4))
    except (ValueError, binascii.Error):
        raise TableError("cursor") from None
    if len(blob) < 12 + 16:
        raise TableError("cursor")
    try:
        return AESGCM(_CURSOR_KEY).decrypt(blob[:12], blob[12:], aad)
    except InvalidTag:
        raise TableError("cursor") from None


def decode_cursor(cursor: str | None, sort: tuple[tuple[str, str], ...], *, uid: str = "", fingerprint: str = "") -> tuple[list[Any], str] | None:
    """(the last row's sort values, its id) or None for the first page. A cursor of another sort, a broken one or one with values
    of the wrong shape is a TableError (the client starts over)."""
    if not cursor:
        return None
    if len(cursor) > CURSOR_MAX:
        raise TableError("cursor")
    raw = _open_cursor(cursor, _aad(uid, fingerprint))
    try:
        doc = json.loads(raw.decode())
    except (ValueError, UnicodeDecodeError):
        raise TableError("cursor") from None
    if not isinstance(doc, dict) or doc.get("s") != sort_text(sort):
        raise TableError("cursor")
    issued = doc.get("t")
    if isinstance(issued, bool) or not isinstance(issued, int) or not (-60 <= time.time() - issued <= CURSOR_TTL_S):
        raise TableError("cursor")
    values, tid = doc.get("v"), doc.get("i")
    if not isinstance(values, list) or len(values) != len(sort) or not isinstance(tid, str) or not ID_RE.match(tid):
        raise TableError("cursor")
    for v in values:
        if isinstance(v, bool) or not isinstance(v, (int, str)) or (isinstance(v, str) and len(v) > 200) or (isinstance(v, int) and abs(v) > 10**12):
            raise TableError("cursor")
    return values, tid


def from_query_params(params: dict[str, Any]) -> tuple[Query, int, str | None]:
    """The list / export route's query string -> (query, limit, cursor)."""
    filters = parse_filters({k: params.get(k) for k in FILTER_KEYS if params.get(k) not in (None, "")})
    return Query(filters=filters, sort=parse_sort(params.get("sort"))), parse_limit(params.get("limit")), params.get("cursor") or None
