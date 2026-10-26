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

ADOPTR6-295: the nine answers of the Mac reply-6 delivery (M3_PEOPLE_CSV_NINE_ANSWERS.json, native CODE 6a8a0a2c) replace the earlier
NOT_IDENTIFIED list (docs/changes/ADOPTR6-295-ADOPTION-RECEIPT.md section M3):
1. the answer's `schema` is exactly `arx.people_csv.preview.v1`; a native create row has `user_id` and `revision` both null, an update both set;
2. the mode is exactly `create` or `upsert` (upsert creates absent employees and updates existing ones by employee_no; there is no delete /
   sync / replace). Arx's own person-id compare-and-set rows are not expressible in either mode and are refused locally;
3. `column_map` maps EVERY original header (exactly as the native reader sees it) to a native field name; targets are unique and include
   employee_no and display_name; the native parser limits (262144 UTF-8 bytes, 32 headers of 1..128 characters, 500 non-empty records) are
   checked here first so nothing is sent for a file the native reader refuses anyway;
4. authority_ref / authority_revision / scope_ref / source_epoch have NO universal value: they come from the owner-set binding (`binding`) and
   the original signed current policy; nothing is invented here;
5. `preview_ref`, `ownership_policy_ref`, `revision_policy_ref` are intent METADATA (1..128 characters, no C0 controls) - never authority;
6. the returned `start` carries the ORIGINAL request, valid only inside its own <= 15 s window: Arx passes a FRESH preview's start unchanged,
   and refuses locally (nothing sent, nothing edited or extended) when that window has already passed (`start`);
7. review_stamp / rules_stamp / change_digest are deterministic under the documented conditions; grant ids and origin refs are not, so the
   shown/fresh comparison (`Preview.digest`) uses only the former;
8. `features/result` finished.receipt is the native CheckpointJobs.public + source_binding + device_application='unknown': a central commit
   per saved row, never a device-delivery proof (`read_result`);
9. `source_line` is the PHYSICAL line on which a record ENDS (csv line_num after the record); `source_lines` maps it to Arx's record number."""
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
SCHEMA = "arx.people_csv.preview.v1"  # answer 1 (arx_people_preview.prepare_people_csv)
MODE_CREATE = "create"
MODE_UPSERT = "upsert"
MODES = (MODE_CREATE, MODE_UPSERT)  # answer 2: exactly these two
# Answer 3: the native import field names (csv_transfer.IMPORT_COLUMNS; `profile:<id>` is native too but its id grammar is not Arx's to
# guess, so Arx never maps to it). Arx maps a header only to a native name that IS the same Arx canonical column; anything else is refused.
NATIVE_FIELDS = frozenset({"employee_no", "display_name", "active", "valid_from", "valid_until", "stations", "phone", "access_category",
                           "responsible_person", "access_purpose", "pin", "cards", "group_ids", "permission_overrides", "access_timing_policy"})
NATIVE_REQUIRED = ("employee_no", "display_name")
MAPPED_FIELDS = ("employee_no", "display_name", "active", "valid_from", "valid_until", "phone", "access_category", "responsible_person",
                 "access_purpose")  # Arx canonical columns whose name is the native field (row formats stay native validation)
NATIVE_MAX_BYTES = 262_144
NATIVE_MAX_HEADERS = 32
NATIVE_MAX_HEADER_CHARS = 128
NATIVE_MAX_RECORDS = 500
OWNERSHIP_POLICY_REF = "arx-explicit-person-id"  # answer 5: intent metadata only (1..128 chars, no C0); grants nothing
REVISION_POLICY_REF = "arx-revision-compare-and-set"  # answer 5: intent metadata only
RECEIPT_PUBLIC_KEYS = frozenset({"id", "kind", "state", "revision", "created_at", "updated_at", "approval", "total", "saved", "failed", "pending",
                                 "errors"})
RECEIPT_KEYS = RECEIPT_PUBLIC_KEYS | {"source_binding", "device_application"}  # answer 8
JOB_STATES = ("paused", "running", "completed", "completed_with_errors", "cancelled")
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
            "modes": list(MODES), "fields": list(MAPPED_FIELDS)}


# ---------------------------------------------------------------- the closed reader of WisKey's answer

_ANSWER_KEYS = {"schema", "review_token", "review_stamp", "rules_stamp", "rows", "expires_at", "start"}
_ROW_KEYS = {"grant_id", "source_line", "user_id", "revision", "origin_ref", "change_digest", "grants"}
_GRANT_KEYS = {"permission", "scope_ref", "station_grant_ids"}
_START_KEYS = {"request", "policy_snapshot"}


@dataclass(frozen=True)
class PreviewRow:
    source_line: int  # WisKey's: the PHYSICAL line the record ends on (answer 9)
    user_id: str | None
    revision: int | None
    change_digest: str
    row: int | None = None  # Arx's record number of that line (bulk_people's `row`), when the file was given

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


def read_preview(raw: Any, request: Mapping[str, Any], *, now: datetime, lines: Mapping[int, int] | None = None) -> Preview:
    """The closed `features/people_csv_preview` answer, else CsvError(invalid_response, unknown) - an answer that is not this shape is not a
    preview, and nothing is started from it. `lines` (physical end line -> Arx record number, from `source_lines`): every row WisKey names
    must be a record of the file Arx sent, else `preview_line_unknown` (unknown)."""
    def bad() -> CsvError:
        return CsvError("invalid_response", "unknown")

    if not isinstance(raw, Mapping) or set(raw) != _ANSWER_KEYS:
        raise bad()
    if raw["schema"] != SCHEMA:
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
                and (uid is None or wp.is_ref(uid)) and (rev is None or wp.is_pos_int(rev)) and (uid is None) == (rev is None)
                and isinstance(grants, Mapping) and set(grants) == _GRANT_KEYS and grants["permission"] == PERMISSION and wp.is_ref(grants["scope_ref"])
                and isinstance(grants["station_grant_ids"], list)):
            raise bad()  # answer 1: a native create has user_id AND revision null; an update has both
        if lines is not None and line not in lines:
            raise CsvError("preview_line_unknown", "unknown")  # WisKey names a line that does not end a record of this file
        last = line
        rows.append(PreviewRow(line, uid, rev, item["change_digest"], lines.get(line) if lines is not None else None))
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


def _native_reader(text: str) -> tuple[Any, list[str]]:
    """The file as the native reader sees it (csv_transfer._reader): BOM removed, strict quoting, the header limits. Refusals are local:
    nothing is sent for a file the native side refuses anyway."""
    import csv
    import io

    if len(text.encode("utf-8")) > NATIVE_MAX_BYTES:
        raise CsvError("csv_too_large", "local")
    if "\x00" in text or "�" in text:
        raise CsvError("csv_invalid_encoding", "local")
    reader = csv.reader(io.StringIO(text.removeprefix("﻿"), newline=""), strict=True)
    try:
        headers = next(reader)
    except (csv.Error, StopIteration):
        raise CsvError("csv_invalid_format", "local") from None
    if (not headers or len(headers) > NATIVE_MAX_HEADERS or len(set(headers)) != len(headers)
            or any(not h or len(h) > NATIVE_MAX_HEADER_CHARS for h in headers)):
        raise CsvError("csv_invalid_headers", "local")
    return reader, headers


def source_lines(data: bytes) -> dict[int, int]:
    """Answer 9: {physical END line of a record -> Arx's record number}. The native parser reports `reader.line_num` after consuming the
    whole record (a quoted value over lines 2-3 is line 3), skips empty records while line_num still advances. Arx's bulk_people numbers
    the records after the header 1, 2, ... (blank ones counted, then skipped): the same records in the same order."""
    import csv

    reader, _headers = _native_reader(_csv_text(data))
    out: dict[int, int] = {}
    try:
        for number, row in enumerate(reader, start=1):
            if not row or not any(row):
                continue
            out[reader.line_num] = number
            if len(out) > NATIVE_MAX_RECORDS:
                raise CsvError("csv_too_many_rows", "local")
    except csv.Error:
        raise CsvError("csv_invalid_format", "local") from None
    if not out:
        raise CsvError("csv_nothing_to_preview", "local")
    return out


def column_map(data: bytes) -> dict[str, str]:
    """Answer 3: EVERY original header (exactly as the native reader sees it - no strip, BOM removed) -> its native field name. A header Arx
    cannot map to a native name of the same meaning refuses the file (names only); targets are unique and include the two required ones."""
    from . import bulk_people as bp

    _reader, header = _native_reader(_csv_text(data))
    columns = bp.header_columns(header)
    extra = tuple(c for c in columns if c not in MAPPED_FIELDS)
    if extra:
        raise CsvError("csv_columns_not_identified", "local", extra)
    cmap = dict(zip(header, columns))
    targets = [t for t in cmap.values() if t]
    if (len(cmap) != len(header) or len(set(targets)) != len(targets) or not set(NATIVE_REQUIRED) <= set(targets)
            or any(t not in NATIVE_FIELDS for t in targets)):
        raise CsvError("csv_invalid_headers", "local", tuple(sorted(set(NATIVE_REQUIRED) - set(targets))))
    return cmap


def _metadata_ref_ok(value: Any) -> bool:
    """Answer 5: a nonempty string of 1..128 characters without C0 controls - a label, never a permission."""
    return isinstance(value, str) and 1 <= len(value) <= 128 and not any(ord(ch) < 0x20 for ch in value)


def request_preview(conn: sqlite3.Connection, principal: Principal, adapters: Any, *, data: bytes, rows: list[dict[str, Any]], job_id: str,
                    session_active: bool, now: datetime | None = None, mode: str = MODE_CREATE) -> Preview:
    """Ask WisKey for the verified preview of `data` as `principal`. A READ: no intent is stored. Raises CsvError with nothing sent when Arx
    refuses first (no binding, an unknown mode, a person-id row, an unmapped column, a file over the native limits, policy incomplete).
    `mode`: `create` (an existing employee_no is refused by WisKey) or `upsert` (WisKey creates the absent and updates the existing ones by
    employee_no; its rows then carry user_id + revision)."""
    from .wiskey_feature_direct import FeatureWireError, START_TIMEOUT_S

    now = now or datetime.now(timezone.utc)
    bind = binding(conn)
    if bind is None:
        raise CsvError("binding_not_configured", "not_sent")
    if adapters is None:
        raise CsvError("direct_not_selected", "not_sent")
    if mode not in MODES:
        raise CsvError("csv_mode_not_identified", "local")
    if not rows:
        raise CsvError("csv_nothing_to_preview", "local")
    if any(r.get("op") != "create" for r in rows):
        # Arx's own person-id + revision rows (compare-and-set) are not a native mode: upsert keys by employee_no
        raise CsvError("csv_mode_not_identified", "local")
    stray = tuple(sorted({k for r in rows for k in r.get("set", {}) if k not in MAPPED_FIELDS}))
    if stray:
        raise CsvError("csv_columns_not_identified", "local", stray)
    cmap = column_map(data)
    lines = source_lines(data)
    private = {"kind": "csv", "content": _csv_text(data), "mode": mode, "column_map": cmap}
    params = {"preview_ref": "csv-" + hashlib.sha256(data).hexdigest()[:40], "ownership_policy_ref": OWNERSHIP_POLICY_REF,
              "revision_policy_ref": REVISION_POLICY_REF}
    if not all(_metadata_ref_ok(v) for v in params.values()):
        raise CsvError("invalid_fields", "local")
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
    return read_preview(raw, body, now=datetime.now(timezone.utc), lines=lines)


def start_window_open(request: Mapping[str, Any], now: datetime) -> bool:
    """Answer 6: the returned start carries the ORIGINAL request, valid only while now < request_expires_at (<= 15 s after issued_at) and
    now < execution_expires_at. Arx never edits, extends or re-signs it: a passed window means a fresh preview, nothing else."""
    try:
        req_end = fx.absolute_time(request["request_expires_at"])
        exec_end = fx.absolute_time(request["execution_expires_at"])
    except (KeyError, TypeError, fx.FeatureError):
        return False
    now = now.astimezone(timezone.utc)
    return now < req_end and now < exec_end


def start(conn: sqlite3.Connection, adapters: Any, fresh: Preview, *, now: datetime | None = None) -> str:
    """`features/start` with the FRESH preview's start, unchanged, through the durable intent log. Returns the operation_ref. A start that is
    refused / lost raises CsvError(outcome refused | unknown | not_sent); nothing is ever re-sent. A fresh start whose own request window has
    already passed is refused locally (`preview_window_passed`, not_sent): nothing is stored, sent, edited or extended."""
    from .wiskey_feature_direct import FeatureWireError

    request, snapshot = fresh.start["request"], fresh.start["policy_snapshot"]
    if not start_window_open(request, now or datetime.now(timezone.utc)):
        raise CsvError("preview_window_passed", "not_sent")
    try:
        outcome = adapters.client.start(conn, dict(request), dict(snapshot))
    except fx.FeatureError as exc:
        raise CsvError(exc.code, "not_sent") from None
    except FeatureWireError as exc:
        raise CsvError(exc.code, exc.outcome) from None
    if outcome.state != "admitted" or not outcome.operation_ref:
        raise CsvError(outcome.code or outcome.state, "not_sent" if outcome.state == "not_sent" else ("unknown" if outcome.state == "unknown" else "refused"))
    return outcome.operation_ref


def _count(value: Any) -> int | None:
    return value if type(value) is int and 0 <= value <= MAX_ROWS else None


def read_receipt(receipt: Any) -> dict[str, Any] | None:
    """Answer 8: the closed reader of `finished.receipt` = CheckpointJobs.public + source_binding + device_application ('unknown'). Returns
    counts, the job state, the error codes per physical line and the lines WisKey records as `central_committed` - a CENTRAL commit only:
    `device_application` is always 'unknown' (no device-delivery proof exists in this receipt). Any other shape -> None (unreadable)."""
    if not isinstance(receipt, Mapping) or set(receipt) != RECEIPT_KEYS or receipt["device_application"] != "unknown":
        return None
    if receipt["state"] not in JOB_STATES:
        return None
    counts = {k: _count(receipt[k]) for k in ("total", "saved", "failed", "pending")}
    if None in counts.values():
        return None
    errors = receipt["errors"]
    if not isinstance(errors, list) or any(not isinstance(e, Mapping) or set(e) != {"row", "code"} or type(e["row"]) is not int
                                           or not isinstance(e["code"], str) for e in errors):
        return None
    binding_ = receipt["source_binding"]
    rows = binding_.get("rows") if isinstance(binding_, Mapping) else None
    if not isinstance(rows, Mapping):
        return None
    committed: list[int] = []
    for item in rows.values():
        if not isinstance(item, Mapping) or type(item.get("source_line")) is not int:
            return None
        if item.get("state") == "central_committed":
            committed.append(item["source_line"])
    return {**counts, "job_state": receipt["state"], "errors": [{"line": e["row"], "code": str(e["code"])[:64]} for e in errors],
            "central_committed_lines": sorted(committed), "device_application": "unknown"}


def read_result(adapters: Any, operation_ref: str) -> dict[str, Any]:
    """The original completion read, projected to what the screen shows: state, and for a finished receipt the closed `read_receipt`
    projection (`saved` stays the count it always was). A missing or failed read is `unknown` - it is not a not-sent proof and nothing is
    replayed; an unreadable receipt keeps `saved` None and says so."""
    from .wiskey_feature_direct import FeatureWireError

    try:
        res = adapters.client.result(operation_ref)
    except FeatureWireError:
        return {"state": "unknown", "saved": None}
    if res.receipt is None:
        return {"state": res.state, "saved": None}
    projected = read_receipt(res.receipt)
    if projected is None:
        return {"state": res.state, "saved": None, "receipt": "unreadable"}
    return {"state": res.state, **projected}


# ---------------------------------------------------------------- the in-memory hold (the CSV never touches the disk)

@dataclass
class Held:
    user_id: str
    data: bytes = field(repr=False)
    rows: list[dict[str, Any]] = field(repr=False)
    shown_digest: str
    writes: int
    expires: float
    mode: str = MODE_CREATE  # the mode the person previewed; the fresh preview at confirm uses the same one


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
