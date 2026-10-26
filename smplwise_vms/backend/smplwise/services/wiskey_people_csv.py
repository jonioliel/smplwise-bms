"""WKR5ADOPT-295 (Arx item W-006): the WisKey-verified PREVIEW of a people CSV import, adopted on the direct transport.

Contract read as DATA: Mac delivery `final/delivery/PEOPLE_CSV_PREVIEW_V1.json` (command `features/people_csv_preview`, wiskey-direct-ws.v1 signed
original native bridge) and the producer's own test `tests/ha/test_owner_continuation_people_csv.py`. Nothing here ran against a WisKey.

The recipe (Mac, `client_recipe`)
1. `preview = call("features/people_csv_preview", {request, policy_snapshot})` - the request is the ordinary people_csv FeatureRequest, the
   snapshot is the ordinary closed policy snapshot with `rows: []` and `private_input = {kind: "csv", content, mode, column_map}`;
2. the answer carries `review_token`, `review_stamp`, `rules_stamp`, `rows` (one per changed line, each with `change_digest`) and `start`;
3. `call("features/start", preview["start"])` UNCHANGED, then the original `features/result`. A missing result or an error is UNKNOWN - never
   replayed, never "not sent".

What Arx does and does not do
- Arx never computes a stamp, a digest or a row origin and never sees WisKey's `fingerprint_key`; it reads WisKey's answer with a closed reader.
- The preview is a READ: nothing is admitted to the intent log and nothing is written. The WRITE is `features/start` through
  `DirectFeatureClient.start`, i.e. the existing durable intent log (`wiskey_feature_intents`: stored and committed BEFORE the first byte, one
  attempt per request id, no replay).
- A human reviews the preview, so it can be older than the request's own wire window (<= 15 s). Arx therefore never sends the displayed
  `start`: at CONFIRM it asks for a FRESH preview of the same file and starts only when that fresh preview has the same rows, digests and
  stamps as the one the person saw (`preview_changed` otherwise, nothing sent). The fresh `start` is passed on unchanged.
- The CSV text is kept only in this process's memory (bounded, 15 minutes), never in the database, a log, an audit row or a response.

NOT_IDENTIFIED (documented in docs/changes/WKR5ADOPT-295.md, to be answered by Mac): the value of `schema`; the `mode` vocabulary beyond
`create`; the WisKey field names behind the `column_map` beyond `employee_no` / `display_name`; what `authority_ref`, `authority_revision`,
`scope_ref` and `source_epoch` WisKey checks for an Arx service subject (here: an owner-set binding, see `binding`); the meaning of `preview_ref`
and the two policy refs; whether the preview `start` stays valid longer than the request's 15 s window; the receipt shape beyond `state` and `saved`."""
from __future__ import annotations

import hashlib
import json
import sqlite3
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

from ..db import get_setting, set_setting
from ..rbac import Principal
from . import wiskey_feature_exec as fx
from . import wiskey_peer as wp
from .wiskey_capture_port import PortError

COMMAND = "features/people_csv_preview"
FEATURE = "people_csv"
FLAG_KEY = "access.people_csv_preview"  # off | on - system administrator; default off
BINDING_KEY = "access.people_csv_binding"  # JSON {authority_ref, authority_revision, scope_ref, source_epoch}; owner-set; absent = blocked
PERMISSION = "people/write"
MODE_CREATE = "create"  # the only mode the producer's evidence names
# The Arx canonical columns Arx may hand to WisKey's column_map. Only employee_no / display_name are evidenced by the producer's test;
# the other four are the same names Arx already uses for `users/create` (NOT_IDENTIFIED as csv fields). Anything else is refused whole.
MAPPED_FIELDS = ("employee_no", "display_name", "phone", "access_category", "responsible_person", "access_purpose")
OWNERSHIP_POLICY_REF = "arx-explicit-person-id"  # NOT_IDENTIFIED: the value WisKey expects
REVISION_POLICY_REF = "arx-revision-compare-and-set"  # NOT_IDENTIFIED
EXEC_WINDOW_S = 180
REQUEST_TTL_S = fx.MAX_TTL_S
CALL_TIMEOUT_S = 8.0
STORE_TTL_S = 15 * 60
STORE_MAX = 32
MAX_ROWS = 2000


class CsvError(Exception):
    """`outcome`: not_sent (nothing left) | refused (WisKey answered with an error) | unknown (sent, no usable answer) | local (Arx refused it)."""

    def __init__(self, code: str, outcome: str = "local", fields: tuple[str, ...] = ()) -> None:
        super().__init__(code)
        self.code = str(code)[:64]
        self.outcome = outcome
        self.fields = fields


# ---------------------------------------------------------------- the switch and the owner-set binding

def enabled(conn: sqlite3.Connection) -> bool:
    try:
        return get_setting(conn, FLAG_KEY, "off") == "on"
    except Exception:  # noqa: BLE001 - fail closed
        return False


def set_enabled(conn: sqlite3.Connection, value: str) -> None:
    if value not in ("off", "on"):
        raise CsvError("invalid_fields")
    set_setting(conn, FLAG_KEY, value)


@dataclass(frozen=True)
class Binding:
    authority_ref: str
    authority_revision: int
    scope_ref: str
    source_epoch: str


def binding(conn: sqlite3.Connection) -> Binding | None:
    """The authority binding the owner set for the Arx service subject, else None (the feature is then blocked, nothing is invented)."""
    try:
        raw = json.loads(get_setting(conn, BINDING_KEY, "") or "null")
    except ValueError:
        return None
    if not isinstance(raw, dict) or set(raw) != {"authority_ref", "authority_revision", "scope_ref", "source_epoch"}:
        return None
    if not (wp.is_ref(raw["authority_ref"]) and wp.is_pos_int(raw["authority_revision"]) and wp.is_ref(raw["scope_ref"]) and wp.is_ref(raw["source_epoch"])):
        return None
    return Binding(raw["authority_ref"], raw["authority_revision"], raw["scope_ref"], raw["source_epoch"])


def adapters_provider() -> Any:
    """The `FeatureAdapters` over the installed direct join while the preview + start commands are selected; tests replace this."""
    from . import wiskey_direct_join as join

    j = join.installed()
    return j.people_csv_or_none() if j is not None else None


def status(conn: sqlite3.Connection) -> dict[str, Any]:
    """What the screen needs to know, in plain codes. `available` needs the switch, the binding AND a selected direct path (no I/O here)."""
    from . import bulk_people as bp
    from . import wiskey_direct_join as join

    blockers: list[str] = []
    if not enabled(conn):
        blockers.append("switch_off")
    if not bp.enabled(conn):
        blockers.append("bulk_people_off")
    if binding(conn) is None:
        blockers.append("binding_not_configured")
    j = join.installed()
    if j is None:
        blockers.append("direct_not_installed")
    else:
        try:
            if j.session.transport_refusal(COMMAND) is not None or j.session.transport_refusal("features/start") is not None:
                blockers.append("direct_not_selected")
        except Exception:  # noqa: BLE001
            blockers.append("direct_not_selected")
    return {"enabled": "on" if enabled(conn) else "off", "available": not blockers, "blockers": blockers, "mode": MODE_CREATE,
            "fields": list(MAPPED_FIELDS)}


# ---------------------------------------------------------------- the closed reader of WisKey's answer

_ANSWER_KEYS = {"schema", "review_token", "review_stamp", "rules_stamp", "rows", "expires_at", "start"}
_ROW_KEYS = {"grant_id", "source_line", "user_id", "revision", "origin_ref", "change_digest", "grants"}
_GRANT_KEYS = {"permission", "scope_ref", "station_grant_ids"}
_START_KEYS = {"request", "policy_snapshot"}


@dataclass(frozen=True)
class PreviewRow:
    source_line: int
    user_id: str | None
    revision: int | None
    change_digest: str

    @property
    def op(self) -> str:
        return "create" if self.user_id is None else "update"


@dataclass(frozen=True)
class Preview:
    schema: str
    review_stamp: str
    rules_stamp: str
    rows: tuple[PreviewRow, ...]
    expires_at: datetime
    request_id: str
    start: dict[str, Any] = field(repr=False)  # the answer's `start`, kept untouched (it carries the private input); never serialised

    @property
    def digest(self) -> str:
        """What the person saw: the rows' lines / persons / revisions / change digests and WisKey's two stamps. Not the review token, the
        origin refs or grant ids (they may be per-preview); the stamps and digests are WisKey's own, Arx only compares them."""
        body = json.dumps([[r.source_line, r.user_id, r.revision, r.change_digest] for r in self.rows] + [self.review_stamp, self.rules_stamp],
                          separators=(",", ":"), ensure_ascii=True)
        return hashlib.sha256(body.encode("utf-8")).hexdigest()


def read_preview(raw: Any, request: Mapping[str, Any], *, now: datetime) -> Preview:
    """The closed `features/people_csv_preview` answer, else CsvError(invalid_response, unknown) - an answer that is not this shape is not a
    preview, and nothing is started from it."""
    def bad() -> CsvError:
        return CsvError("invalid_response", "unknown")

    if not isinstance(raw, Mapping) or set(raw) != _ANSWER_KEYS:
        raise bad()
    if not (isinstance(raw["schema"], str) and 1 <= len(raw["schema"]) <= 128):
        raise bad()
    for name in ("review_token", "review_stamp", "rules_stamp"):
        if not wp.is_ref(raw[name]):
            raise bad()
    rows_raw = raw["rows"]
    if not isinstance(rows_raw, list) or len(rows_raw) > MAX_ROWS:
        raise bad()
    rows: list[PreviewRow] = []
    last = 0
    for item in rows_raw:
        if not isinstance(item, Mapping) or set(item) != _ROW_KEYS:
            raise bad()
        line, uid, rev = item["source_line"], item["user_id"], item["revision"]
        grants = item["grants"]
        if not (type(line) is int and line > last and wp.is_ref(item["grant_id"]) and wp.is_ref(item["origin_ref"]) and wp.is_ref(item["change_digest"])
                and (uid is None or wp.is_ref(uid)) and (rev is None or wp.is_pos_int(rev))
                and isinstance(grants, Mapping) and set(grants) == _GRANT_KEYS and grants["permission"] == PERMISSION and wp.is_ref(grants["scope_ref"])
                and isinstance(grants["station_grant_ids"], list)):
            raise bad()
        last = line
        rows.append(PreviewRow(line, uid, rev, item["change_digest"]))
    try:
        expires = fx.absolute_time(raw["expires_at"])
    except fx.FeatureError:
        raise bad() from None
    if expires <= now.astimezone(timezone.utc):
        raise CsvError("preview_expired", "refused")
    start = raw["start"]
    if not isinstance(start, Mapping) or set(start) != _START_KEYS or not isinstance(start["request"], Mapping) or not isinstance(start["policy_snapshot"], Mapping):
        raise bad()
    if dict(start["request"]) != dict(request):
        raise CsvError("start_request_changed", "unknown")  # the returned start must carry the original request (Mac: "original FeatureRequest")
    snap_rows = start["policy_snapshot"].get("rows")
    if not isinstance(snap_rows, list) or len(snap_rows) != len(rows):
        raise bad()
    return Preview(raw["schema"], raw["review_stamp"], raw["rules_stamp"], tuple(rows), expires, str(request["request_id"]), dict(start))


# ---------------------------------------------------------------- the preview (a read) and the start (the durable intent)

def _csv_text(data: bytes) -> str:
    from . import bulk_people as bp

    return bp._decode(data)


def column_map(data: bytes) -> dict[str, str]:
    """header cell -> canonical column, for the columns Arx may map; a file with any other column is refused (names only)."""
    import csv
    import io

    from . import bulk_people as bp

    reader = csv.reader(io.StringIO(_csv_text(data), newline=""))
    header = next(reader, [])
    columns = bp.header_columns(header)
    extra = tuple(c for c in columns if c not in MAPPED_FIELDS)
    if extra:
        raise CsvError("csv_columns_not_identified", "local", extra)
    return {h.strip(): c for h, c in zip(header, columns)}


def request_preview(conn: sqlite3.Connection, principal: Principal, adapters: Any, *, data: bytes, rows: list[dict[str, Any]], job_id: str,
                    session_active: bool, now: datetime | None = None) -> Preview:
    """Ask WisKey for the verified preview of `data` as `principal`. A READ: no intent is stored. Raises CsvError with nothing sent when Arx
    refuses first (no binding, not all rows are creates, an unmapped column, policy incomplete)."""
    from .wiskey_feature_direct import FeatureWireError, START_TIMEOUT_S

    now = now or datetime.now(timezone.utc)
    bind = binding(conn)
    if bind is None:
        raise CsvError("binding_not_configured", "not_sent")
    if adapters is None:
        raise CsvError("direct_not_selected", "not_sent")
    if not rows:
        raise CsvError("csv_nothing_to_preview", "local")
    if any(r.get("op") != "create" for r in rows):
        raise CsvError("csv_mode_not_identified", "local")  # only mode "create" is evidenced; updates by person id are not previewed through WisKey
    stray = tuple(sorted({k for r in rows for k in r.get("set", {}) if k not in MAPPED_FIELDS}))
    if stray:
        raise CsvError("csv_columns_not_identified", "local", stray)
    cmap = column_map(data)
    private = {"kind": "csv", "content": _csv_text(data), "mode": MODE_CREATE, "column_map": cmap}
    params = {"preview_ref": "csv-" + hashlib.sha256(data).hexdigest()[:40], "ownership_policy_ref": OWNERSHIP_POLICY_REF,
              "revision_policy_ref": REVISION_POLICY_REF}
    try:
        body, snapshot = adapters.prepare(
            conn, feature=FEATURE, actor=fx.human_actor(principal.user_id), principals=[principal], authority_ref=bind.authority_ref,
            authority_revision=bind.authority_revision, scope_ref=bind.scope_ref, parameter_reference=reference_of(job_id), params=params, now=now,
            source_epoch=bind.source_epoch, actor_session_active=session_active, rows=(), private_input=private,
            execution_expires_at=now + timedelta(seconds=EXEC_WINDOW_S), ttl_s=REQUEST_TTL_S, allow_empty_rows=True)
    except FeatureWireError as exc:
        raise CsvError(exc.code, "not_sent") from None
    except fx.FeatureError as exc:
        raise CsvError(exc.code, "not_sent") from None
    try:
        raw = adapters.port.call(COMMAND, {"request": body, "policy_snapshot": snapshot}, timeout_s=min(START_TIMEOUT_S, CALL_TIMEOUT_S))
    except PortError as exc:
        raise CsvError(exc.code, exc.outcome) from None
    return read_preview(raw, body, now=datetime.now(timezone.utc))


def start(conn: sqlite3.Connection, adapters: Any, fresh: Preview) -> str:
    """`features/start` with the FRESH preview's start, unchanged, through the durable intent log. Returns the operation_ref. A start that is
    refused / lost raises CsvError(outcome refused | unknown | not_sent); nothing is ever re-sent."""
    from .wiskey_feature_direct import FeatureWireError

    request, snapshot = fresh.start["request"], fresh.start["policy_snapshot"]
    try:
        outcome = adapters.client.start(conn, dict(request), dict(snapshot))
    except fx.FeatureError as exc:
        raise CsvError(exc.code, "not_sent") from None
    except FeatureWireError as exc:
        raise CsvError(exc.code, exc.outcome) from None
    if outcome.state != "admitted" or not outcome.operation_ref:
        raise CsvError(outcome.code or outcome.state, "not_sent" if outcome.state == "not_sent" else ("unknown" if outcome.state == "unknown" else "refused"))
    return outcome.operation_ref


def read_result(adapters: Any, operation_ref: str) -> dict[str, Any]:
    """The original completion read, projected to what the screen shows: state, and for a finished receipt only `saved` (a count) when it is an
    int. A missing or failed read is `unknown` - it is not a not-sent proof and nothing is replayed."""
    from .wiskey_feature_direct import FeatureWireError

    try:
        res = adapters.client.result(operation_ref)
    except FeatureWireError:
        return {"state": "unknown", "saved": None}
    saved = None
    if res.receipt is not None:
        value = res.receipt.get("saved")
        saved = value if type(value) is int and 0 <= value <= MAX_ROWS else None
    return {"state": res.state, "saved": saved}


# ---------------------------------------------------------------- the in-memory hold (the CSV never touches the disk)

@dataclass
class Held:
    user_id: str
    data: bytes = field(repr=False)
    rows: list[dict[str, Any]] = field(repr=False)
    shown_digest: str
    writes: int
    expires: float


_LOCK = threading.Lock()
_HELD: dict[str, Held] = {}


def hold(job_id: str, held: Held) -> None:
    with _LOCK:
        now = time.monotonic()
        for k in [k for k, v in _HELD.items() if v.expires <= now]:
            del _HELD[k]
        while len(_HELD) >= STORE_MAX and job_id not in _HELD:
            del _HELD[min(_HELD, key=lambda k: _HELD[k].expires)]
        _HELD[job_id] = held


def held(job_id: str) -> Held | None:
    with _LOCK:
        h = _HELD.get(job_id)
        if h is not None and h.expires <= time.monotonic():
            del _HELD[job_id]
            return None
        return h


def drop(job_id: str) -> None:
    with _LOCK:
        _HELD.pop(job_id, None)


def reset_for_tests() -> None:
    with _LOCK:
        _HELD.clear()


def reference_of(job_id: str) -> str:
    return "csvjob-" + job_id[:32]


def already_started(conn: sqlite3.Connection, job_id: str) -> bool:
    """A start for this job is on the DURABLE intent log (wiskey_feature_intents, found by the job's parameter reference): a second confirm is
    refused, even after a restart that lost the in-memory hold. Only an attempt settled `refused` with code `not_sent` (nothing left) is free."""
    return conn.execute("SELECT 1 FROM wiskey_feature_intents WHERE feature = ? AND parameter_reference = ? AND NOT (state = 'refused' AND code = 'not_sent') LIMIT 1",
                        (FEATURE, reference_of(job_id))).fetchone() is not None


def operation_of_job(conn: sqlite3.Connection, job_id: str) -> str | None:
    """The host's handle of the job's started operation, from the intent row (`op:<ref>` while the intent is open)."""
    from .wiskey_feature_direct import operation_of

    r = conn.execute("SELECT request_id FROM wiskey_feature_intents WHERE feature = ? AND parameter_reference = ? ORDER BY rowid DESC LIMIT 1",
                     (FEATURE, reference_of(job_id))).fetchone()
    return operation_of(conn, r[0]) if r else None
