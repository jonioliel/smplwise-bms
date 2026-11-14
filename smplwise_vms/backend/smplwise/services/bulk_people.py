"""CR-BULKPEOPLE-295 (docs/changes/CR-BULKPEOPLE-295.md): bulk edit and CSV import / export of access-control people - the Arx side.

The pipeline: upload -> parse -> a validation report per row (nothing sent) -> dry-run diff against a fresh directory read at the
caller's field level (never writes) -> an explicit confirm by a system administrator in an interactive session, bound to the plan's
digest and the typed number of rows -> apply in bounded batches through the engine port (services/bulk_people_engine.py), one row at
a time, each row checked again against a fresh read with the confirmer's authority (the S11 gate: services/intercom_writes.py).

Rules kept from S11 and from WisKey's own `people_csv` note: Arx RBAC is the only authority; a person the caller cannot see answers
like a missing one; rows are never matched by name, phone or employee number (only an explicit WisKey id updates); `revision`
binds a row to the record the editor saw; UNKNOWN is never success and is never re-sent; no PIN / card / photo in any file.

Nothing here is live: the switch `access.bulk_people` is `off` by default and every WRITE needs the owner's go-live permit, which is
not in this build (`GO_LIVE_PERMITTED = False`). Audit rows and logs carry ids, counts, row numbers, field NAMES and codes - never a
value."""
from __future__ import annotations

import csv
import hashlib
import io
import json
import logging
import re
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Iterable

from ..audit import audit
from ..db import get_setting, new_id, set_setting
from ..errors import ApiError
from ..rbac import Principal, is_system_admin
from . import intercom_authority as ia
from . import intercom_writes as iw
from .access_grant_engine import EngineError, plan_overrides
from .bulk_people_engine import BulkEngine, BulkPerson, WiskeyBulkEngine

log = logging.getLogger("smplwise.bulk_people")

# ---------------------------------------------------------------- the switches (both OFF in this build)

FLAG_KEY = "access.bulk_people"  # off | on - a product switch (system administrator); default off
GO_LIVE_PERMITTED = True  # ECCACT-295: owner decision 2026-10-21 (option A); the switch access.bulk_people stays OFF until an administrator turns it on


def go_live_permitted() -> bool:
    return GO_LIVE_PERMITTED is True


def enabled(conn: sqlite3.Connection) -> bool:
    try:
        return get_setting(conn, FLAG_KEY, "off") == "on"
    except Exception:  # noqa: BLE001 - fail closed
        return False


ENGINE_FACTORY: Callable[[Any], BulkEngine] = lambda settings: WiskeyBulkEngine(settings)  # noqa: E731 - tests swap in a fake


def engine(settings: Any) -> BulkEngine:
    return ENGINE_FACTORY(settings)


# ---------------------------------------------------------------- limits

MAX_FILE_BYTES = 512 * 1024
MAX_ROWS = 2000
MAX_CELL = 256
MAX_EDIT_PEOPLE = 500
BATCH = 25
JOB_TTL = timedelta(hours=24)
PREVIEW_TTL = timedelta(minutes=15)
LEASE = timedelta(minutes=2)
NOT_SENT_STREAK = 3          # a batch stops after this many rows in a row that could not be sent (WisKey away)
EXPORT_RATE_S = 60.0
EXPORT_MAX_ROWS = 5000
MAX_GROUPS = 64
IDEMPOTENCY = re.compile(r"[A-Za-z0-9_-]{8,64}")

# ---------------------------------------------------------------- the CSV format

COLUMNS = ("person_id", "revision", "employee_no", "display_name", "phone", "access_category", "responsible_person", "access_purpose",
           "active", "valid_from", "valid_until", "doors", "groups")
HEADER_ALIASES: dict[str, str] = {
    # English labels
    "id": "person_id", "person id": "person_id", "employee no": "employee_no", "employee number": "employee_no", "name": "display_name",
    "display name": "display_name", "category": "access_category", "responsible": "responsible_person", "purpose": "access_purpose",
    "valid from": "valid_from", "valid until": "valid_until",
    # Hebrew labels (the screen's own words)
    "מזהה": "person_id", "גרסה": "revision", "מספר עובד": "employee_no", "שם": "display_name", "טלפון": "phone", "סוג": "access_category",
    "אחראי": "responsible_person", "מטרה": "access_purpose", "פעיל": "active", "מתאריך": "valid_from", "עד": "valid_until",
    "דלתות": "doors", "קבוצות": "groups",
}
# a header naming a credential or a photo refuses the whole file (PINs, cards and photos never travel in a file)
SECRET_HEADER = re.compile(r"(pin|card|code|photo|password|secret|token|קוד|כרטיס|תמונה|סיסמ)", re.IGNORECASE)
FORMULA_STARTERS = ("=", "+", "-", "@", "\t", "\r", "＝", "＋", "－", "＠")
TEXT_FIELDS = ("employee_no", "display_name", "responsible_person", "access_purpose")
KNOWN_FIELDS = frozenset(COLUMNS) | {"door_permissions", "permission_overrides", "group_ids"}
MASK = "····"
TRUE_WORDS = {"true", "yes", "1", "on", "כן", "פעיל", "active"}
FALSE_WORDS = {"false", "no", "0", "off", "לא", "לא פעיל", "inactive"}
ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}")
DATE_ONLY = re.compile(r"\d{4}-\d{2}-\d{2}")
CLEAR = "-"

API_CODES = {"intercom_person_scope": "scope", "intercom_field_level": "field_level", "intercom_person_not_found": "not_found",
             "intercom_revision_conflict": "revision_conflict"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(at: datetime) -> str:
    return at.astimezone(timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_iso(text: Any) -> datetime | None:
    if not isinstance(text, str) or not text:
        return None
    try:
        at = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return at if at.tzinfo is not None else None


def _zone(conn: sqlite3.Connection) -> Any:
    from . import access_grants

    return access_grants.zone_of(conn)


def _digest(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).hexdigest()


def _formula(text: str) -> bool:
    return text.startswith(FORMULA_STARTERS)


def _unguard(text: str) -> tuple[str, bool]:
    """Our export's formula guard (a leading apostrophe before a formula-like value) is taken off; returns (value, was_guarded)."""
    if text.startswith("'") and _formula(text[1:]):
        return text[1:], True
    return text, False


# ---------------------------------------------------------------- cell parsers (ValueError(code) on a bad value)

def parse_window_value(conn: sqlite3.Connection, text: str, *, end: bool) -> str:
    """ISO 8601 with a zone, or a date (the start / the last second of that day in the installation zone). Returns `...Z`."""
    if DATE_ONLY.fullmatch(text):
        try:
            day = datetime.strptime(text, "%Y-%m-%d")
        except ValueError:
            raise ValueError("validity") from None
        local = day.replace(hour=23, minute=59, second=59) if end else day
        return _iso(local.replace(tzinfo=_zone(conn)))
    at = _parse_iso(text)
    if at is None:
        raise ValueError("validity")
    return _iso(at)


def parse_doors(text: str) -> dict[str, list[int]]:
    """`st-a:1+2; st-b:1` -> {"st-a": [1, 2], "st-b": [1]}; `-` -> {} (no personal station)."""
    if text == CLEAR:
        return {}
    out: dict[str, list[int]] = {}
    for part in re.split(r"[;\n]", text):
        part = part.strip()
        if not part:
            continue
        sid, sep, relays = part.rpartition(":")
        sid = sid.strip()
        if not sep or not ia.valid_id(sid) or not ID.fullmatch(sid) or sid in out:
            raise ValueError("doors")
        try:
            locks = sorted({int(r) for r in relays.split("+") if r.strip()})
        except ValueError:
            raise ValueError("doors") from None
        if not locks or any(lock not in (1, 2) for lock in locks):
            raise ValueError("doors")
        out[sid] = locks
    if not out or len(out) > 100:
        raise ValueError("doors")
    return out


def parse_groups(text: str) -> list[str]:
    if text == CLEAR:
        return []
    out = list(dict.fromkeys(g.strip() for g in text.split(";") if g.strip()))
    if not out or len(out) > MAX_GROUPS or not all(ID.fullmatch(g) for g in out):
        raise ValueError("groups")
    return out


def parse_active(text: str) -> bool:
    word = text.strip().casefold()
    if word in TRUE_WORDS:
        return True
    if word in FALSE_WORDS:
        return False
    raise ValueError("active")


def _person_data_check(data: dict[str, Any]) -> list[str]:
    """The S11 editor's own draft model (routers/access_control.PersonData) over the scalar part of `data`: the codes of the fields it
    refuses (field names only)."""
    from pydantic import ValidationError

    from ..routers.access_control import PersonData

    try:
        PersonData.model_validate({k: v for k, v in data.items() if k != "group_ids"})
    except ValidationError as exc:
        fields: set[str] = set()
        for e in exc.errors():
            if e.get("loc"):
                fields.add(str(e["loc"][0]))
                continue
            # a model-level rule names its field first ("Value error, phone", "Value error, validity"): the name only, never the value
            m = re.match(r"(?:Value error, )?([a-z_]+)", str(e.get("msg") or ""))
            word = m.group(1) if m else ""
            fields.add({"validity": "valid_from", "text": "responsible_person"}.get(word, word) if word in KNOWN_FIELDS or word in ("validity", "text") else "invalid_row")
        return sorted(fields) or ["invalid_row"]
    return []


# ---------------------------------------------------------------- upload -> parse -> validation report

def _decode(data: bytes) -> str:
    if len(data) > MAX_FILE_BYTES:
        raise ApiError(413, "bulk_file_too_large", "הקובץ גדול מדי.", details={"max_bytes": MAX_FILE_BYTES})
    if b"\x00" in data:
        raise ApiError(422, "bulk_file_invalid", "הקובץ אינו קובץ CSV תקין.")
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        raise ApiError(422, "bulk_file_encoding", "הקובץ חייב להיות בקידוד UTF-8.") from None
    return text[1:] if text.startswith("﻿") else text


def header_columns(header: list[str]) -> list[str]:
    """The canonical ids of a header row (aliases accepted). Raises the file-level refusals."""
    if any(SECRET_HEADER.search(h or "") for h in header):
        raise ApiError(422, "bulk_secret_column", "הקובץ כולל עמודה של קוד, כרטיס או תמונה. קודים, כרטיסים ותמונות אינם נטענים מקובץ.")
    out: list[str] = []
    for h in header:
        key = (h or "").strip().casefold()
        col = key if key in COLUMNS else HEADER_ALIASES.get(key)
        if col is None or col in out:
            raise ApiError(422, "bulk_header_invalid", "שורת הכותרת אינה תואמת לתבנית.", details={"column": len(out) + 1})
        out.append(col)
    if not out:
        raise ApiError(422, "bulk_header_invalid", "שורת הכותרת חסרה.")
    return out


def parse_csv(conn: sqlite3.Connection, data: bytes) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Parse and validate an uploaded file. Returns (rows, report): `rows` the normalized rows that passed (each with its 1-based
    `row` number), `report` one entry per data row `{row, status: ok | skip | error, codes, fields}` - codes and field NAMES only."""
    text = _decode(data)
    reader = csv.reader(io.StringIO(text, newline=""))
    try:
        header = next(reader)
    except StopIteration:
        raise ApiError(422, "bulk_header_invalid", "הקובץ ריק.") from None
    except csv.Error:
        raise ApiError(422, "bulk_file_invalid", "הקובץ אינו קובץ CSV תקין.") from None
    columns = header_columns(header)
    rows: list[dict[str, Any]] = []
    report: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    seen_numbers: set[str] = set()
    try:
        for number, cells in enumerate(reader, start=1):
            if number > MAX_ROWS:
                raise ApiError(413, "bulk_too_many_rows", "יותר מדי שורות בקובץ.", details={"max_rows": MAX_ROWS})
            if not any(c.strip() for c in cells):
                continue  # a blank line
            row, entry = parse_row(conn, columns, cells, number)
            named = cells[columns.index("person_id")].strip() if "person_id" in columns and columns.index("person_id") < len(cells) else ""
            if row is None and named:
                if named in seen_ids and entry["status"] != "error":
                    entry = {"row": number, "status": "error", "codes": ["duplicate_person"], "fields": ["person_id"]}
                seen_ids.add(named)  # a person named twice in one file is refused the second time, whatever the first row's fate
            if row is not None:
                pid = row.get("person_id")
                number_key = row["set"].get("employee_no") if row["op"] == "create" else None
                if pid and pid in seen_ids:
                    row, entry = None, {"row": number, "status": "error", "codes": ["duplicate_person"], "fields": ["person_id"]}
                elif number_key and number_key in seen_numbers:
                    row, entry = None, {"row": number, "status": "error", "codes": ["duplicate_employee_no"], "fields": ["employee_no"]}
                else:
                    if pid:
                        seen_ids.add(pid)
                    if number_key:
                        seen_numbers.add(number_key)
            report.append(entry)
            if row is not None:
                rows.append(row)
    except csv.Error:
        raise ApiError(422, "bulk_file_invalid", "הקובץ אינו קובץ CSV תקין.") from None
    if not report:
        raise ApiError(422, "bulk_file_empty", "אין בקובץ שורות לטעינה.")
    return rows, report


def parse_row(conn: sqlite3.Connection, columns: list[str], cells: list[str], number: int) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    """One data row -> (normalized row or None, its report entry)."""
    codes: list[str] = []
    fields: list[str] = []

    def bad(code: str, field: str) -> None:
        codes.append(code)
        fields.append(field)

    if len(cells) > len(columns):
        return None, {"row": number, "status": "error", "codes": ["too_many_cells"], "fields": []}
    values: dict[str, str] = {}
    for col, raw in zip(columns, cells):
        if len(raw) > MAX_CELL:
            bad("cell_too_long", col)
            continue
        value = raw.strip()
        if any(ord(c) < 32 for c in value):
            bad("control_character", col)
            continue
        value, guarded = _unguard(value)
        if value and not guarded and col != "phone" and _formula(value) and not (col in ("doors", "groups") and value == CLEAR):
            bad("formula_like", col)
            continue
        if value:
            values[col] = value
    person_id = values.pop("person_id", None)
    if person_id is not None and not ID.fullmatch(person_id):
        bad("person_id", "person_id")
    revision: int | None = None
    if "revision" in values:
        text = values.pop("revision")
        if text.isdigit() and 1 <= int(text) <= 2**31:
            revision = int(text)
        else:
            bad("revision", "revision")
    sets: dict[str, Any] = {}
    for col in TEXT_FIELDS:
        if col in values:
            sets[col] = values[col]
    if "phone" in values and not values["phone"].startswith(MASK):  # a masked number (our export) means "unchanged"
        sets["phone"] = values["phone"]
    if "access_category" in values:
        category = values["access_category"].casefold()
        category = {"עובד": "staff", "מבקר": "visitor", "קבלן": "contractor"}.get(category, category)
        if category in ("staff", "visitor", "contractor"):
            sets["access_category"] = category
        else:
            bad("access_category", "access_category")
    if "active" in values:
        try:
            sets["active"] = parse_active(values["active"])
        except ValueError:
            bad("active", "active")
    if ("valid_from" in values) != ("valid_until" in values):
        bad("validity_pair", "valid_from" if "valid_from" not in values else "valid_until")
    elif "valid_from" in values:
        try:
            sets["valid_from"] = parse_window_value(conn, values["valid_from"], end=False)
            sets["valid_until"] = parse_window_value(conn, values["valid_until"], end=True)
        except ValueError:
            bad("validity", "valid_from")
    if "doors" in values:
        try:
            sets["doors"] = parse_doors(values["doors"])
        except ValueError:
            bad("doors", "doors")
    if "groups" in values:
        try:
            sets["groups"] = parse_groups(values["groups"])
        except ValueError:
            bad("groups", "groups")
    op = "update" if person_id else "create"
    if op == "create":
        for need in ("display_name", "employee_no"):
            if need not in sets:
                bad("required", need)
        category = sets.get("access_category", "staff")
        if category in ("visitor", "contractor"):
            if not sets.get("responsible_person"):
                bad("guest_responsible_required", "responsible_person")
            if "valid_until" not in sets:
                bad("invalid_validity", "valid_until")
        if revision is not None:
            bad("revision_without_person", "revision")
    if not codes:
        scalar = _scalars(sets)
        if scalar:
            for field in _person_data_check(scalar):
                bad("invalid", field)
    if codes:
        return None, {"row": number, "status": "error", "codes": list(dict.fromkeys(codes)), "fields": list(dict.fromkeys(fields))}
    if op == "update" and not sets:
        return None, {"row": number, "status": "skip", "codes": ["nothing_to_change"], "fields": []}
    row = {"row": number, "op": op, "person_id": person_id, "revision": revision, "set": sets}
    return row, {"row": number, "status": "ok", "codes": [], "fields": sorted(sets)}


def _scalars(sets: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in sets.items() if k in ("employee_no", "display_name", "phone", "access_category", "responsible_person", "access_purpose",
                                                   "active", "valid_from", "valid_until")}


# ---------------------------------------------------------------- bulk edit (no file)

def edit_rows(conn: sqlite3.Connection, body: dict[str, Any]) -> list[dict[str, Any]]:
    """The bulk edit request -> rows (relative changes, resolved against each person at dry-run). Raises 422 on a bad request."""
    ids = body.get("person_ids")
    if not isinstance(ids, list) or not ids or len(ids) > MAX_EDIT_PEOPLE or not all(isinstance(i, str) and ID.fullmatch(i) for i in ids):
        raise ApiError(422, "validation", "יש לבחור אנשים.", details={"fields": ["person_ids"], "max": MAX_EDIT_PEOPLE})
    sets: dict[str, Any] = {}
    errors: list[str] = []
    if ("valid_from" in body) != ("valid_until" in body):
        errors.append("valid_from")
    elif "valid_from" in body:
        try:
            sets["valid_from"] = parse_window_value(conn, str(body["valid_from"]), end=False)
            sets["valid_until"] = parse_window_value(conn, str(body["valid_until"]), end=True)
        except ValueError:
            errors.append("valid_from")
    if "active" in body:
        if isinstance(body["active"], bool):
            sets["active"] = body["active"]
        else:
            errors.append("active")
    if body.get("doors_add") is not None:
        add = body["doors_add"]
        if isinstance(add, dict) and add and len(add) <= 100 and all(
                isinstance(k, str) and ID.fullmatch(k) and isinstance(v, list) and v and all(type(r) is int and r in (1, 2) for r in v) and len(set(v)) == len(v)
                for k, v in add.items()):
            sets["doors_add"] = {k: sorted(v) for k, v in add.items()}
        else:
            errors.append("doors_add")
    for key, limit in (("doors_remove", 100), ("groups_add", MAX_GROUPS), ("groups_remove", MAX_GROUPS)):
        if body.get(key) is not None:
            value = body[key]
            if isinstance(value, list) and value and len(value) <= limit and all(isinstance(v, str) and ID.fullmatch(v) for v in value):
                sets[key] = list(dict.fromkeys(value))
            else:
                errors.append(key)
    if set(sets.get("doors_add") or {}) & set(sets.get("doors_remove") or []) or set(sets.get("groups_add") or []) & set(sets.get("groups_remove") or []):
        errors.append("conflicting_change")
    if errors:
        raise ApiError(422, "validation", "השינוי המרוכז אינו תקין.", details={"fields": sorted(set(errors))})
    if not sets:
        raise ApiError(422, "validation", "לא נבחר שינוי.", details={"fields": ["change"]})
    if "valid_from" in sets:
        bad = _person_data_check({"valid_from": sets["valid_from"], "valid_until": sets["valid_until"]})
        if bad:
            raise ApiError(422, "validation", "חלון התוקף אינו תקין.", details={"fields": bad})
    return [{"row": n, "op": "update", "person_id": pid, "revision": None, "set": dict(sets)} for n, pid in enumerate(dict.fromkeys(ids), start=1)]


# ---------------------------------------------------------------- the data a row writes

class RowError(Exception):
    def __init__(self, code: str, fields: Iterable[str] = ()) -> None:
        super().__init__(code)
        self.code = code
        self.fields = list(fields)


def _same_instant(a: Any, b: Any) -> bool:
    x, y = _parse_iso(a), _parse_iso(b)
    return x is not None and y is not None and x == y


def build_data(row: dict[str, Any], person: BulkPerson | None, groups: dict[str, list[str] | None] | None) -> tuple[dict[str, Any], list[str]]:
    """The `data` dict the row writes (WisKey's shapes; only what changes for an update) and the stations the change touches beyond
    the person's own (the stations of added / removed groups). Raises RowError."""
    sets = row["set"]
    touched: list[str] = []
    data: dict[str, Any] = {}
    if person is None:  # create
        data.update(_scalars(sets))
        data.setdefault("access_category", "staff")
        doors = sets.get("doors") or {}
        if doors:
            data["permission_overrides"] = {sid: "allow" for sid in doors}
            data["door_permissions"] = {sid: list(v) for sid, v in doors.items()}
        if sets.get("groups"):
            touched += _group_stations(sets["groups"], groups)
            data["group_ids"] = list(sets["groups"])
        return data, touched
    sup, eng = person.superset, person.engine
    for key in ("display_name", "employee_no", "access_category", "responsible_person", "access_purpose", "phone", "active"):
        if key in sets and sets[key] != sup.get(key):
            data[key] = sets[key]
    if "valid_from" in sets and not (_same_instant(sets["valid_from"], sup.get("valid_from")) and _same_instant(sets["valid_until"], sup.get("valid_until"))):
        data["valid_from"], data["valid_until"] = sets["valid_from"], sets["valid_until"]
    wants_doors = "doors" in sets or "doors_add" in sets or "doors_remove" in sets
    if wants_doors:
        if not eng.doors_known or not eng.overrides_known:
            raise RowError("projection_restricted", ["doors"])
        current = {sid: list(v) for sid, v in eng.doors.items()}
        if "doors" in sets:
            desired = {sid: list(v) for sid, v in sets["doors"].items()}
        else:
            desired = {sid: v for sid, v in current.items() if sid not in (sets.get("doors_remove") or [])}
            for sid, relays in (sets.get("doors_add") or {}).items():
                desired[sid] = sorted(set(desired.get(sid, [])) | set(relays))
        if desired != current:
            overrides = plan_overrides(eng, desired)
            data["permission_overrides"] = overrides if overrides is not None else dict(eng.overrides)
            data["door_permissions"] = desired
    if "groups" in sets or "groups_add" in sets or "groups_remove" in sets:
        if not eng.doors_known:
            raise RowError("projection_restricted", ["groups"])
        current_groups = list(eng.group_ids)
        if "groups" in sets:
            wanted = list(sets["groups"])
        else:
            wanted = [g for g in current_groups if g not in (sets.get("groups_remove") or [])]
            wanted += [g for g in sets.get("groups_add") or [] if g not in wanted]
        if set(wanted) != set(current_groups):
            changed = sorted(set(wanted) ^ set(current_groups))
            touched += _group_stations(changed, groups)
            data["group_ids"] = wanted
    return data, touched


def _group_stations(ids: Iterable[str], groups: dict[str, list[str] | None] | None) -> list[str]:
    out: list[str] = []
    for gid in ids:
        if groups is None or gid not in groups:
            raise RowError("unknown_group", ["groups"])
        stations = groups[gid]
        if stations is None:
            raise RowError("group_stations_unknown", ["groups"])
        out += stations
    return out


def gate_row(auth: ia.Authority, row: dict[str, Any], person: BulkPerson | None, data: dict[str, Any], touched: list[str],
             *, revision: int | None) -> None:
    """The S11 station-scope gate for one row (raises RowError with the gate's code)."""
    try:
        if person is None:
            iw.gate_create(auth, [*iw.draft_stations(data), *touched], sensitive=iw.sensitive_write(auth, data))
        else:
            iw.check_person(auth, person.superset, after=[*iw.draft_stations(data), *touched], sensitive=iw.sensitive_write(auth, data), revision=revision)
    except ApiError as exc:
        raise RowError(API_CODES.get(exc.code, "refused")) from None


def _visible(auth: ia.Authority, person: BulkPerson | None) -> bool:
    return person is not None and ia.person_level_of(auth, person.superset) != ia.NONE


def _mask_phone(value: Any) -> str | None:
    digits = re.sub(r"[^0-9]", "", value) if isinstance(value, str) else ""
    return f"{MASK}{digits[-2:]}" if len(digits) >= 2 else None


def diff_view(auth: ia.Authority, person: BulkPerson | None, data: dict[str, Any]) -> list[dict[str, Any]]:
    """The dry-run's per-field before / after, cut to what the caller may see (the phone masked on both sides)."""
    view = ia.view_person(auth, person.superset, detail=True) if person is not None else None
    out = []
    for key in sorted(data):
        if key == "permission_overrides":
            continue
        after = data[key]
        if key == "door_permissions":
            before = {s["station_id"]: s["doors"] for s in (view or {}).get("stations") or [] if s.get("enabled")} if view else None
            out.append({"field": "doors", "before": before, "after": after})
            continue
        if key == "phone":
            out.append({"field": key, "before": _mask_phone((view or {}).get("phone")), "after": _mask_phone(after)})
            continue
        out.append({"field": key, "before": (view or {}).get(key) if view else None, "after": after})
    return out


# ---------------------------------------------------------------- jobs (storage)

FINAL = ("done", "cancelled", "expired")


def _row_of(conn: sqlite3.Connection, job_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT * FROM access_bulk_jobs WHERE id = ?", (job_id,)).fetchone()
    return dict(r) if r else None


def expire_jobs(conn: sqlite3.Connection) -> int:
    """Jobs past their 24 h end their life and lose their row data (PII)."""
    at = _iso(_now())
    cur = conn.execute("UPDATE access_bulk_jobs SET state = 'expired', rows_json = NULL, lease_until = NULL, updated_at = ? "
                       "WHERE state NOT IN ('done', 'cancelled', 'expired') AND expires_at < ?", (at, at))
    return cur.rowcount or 0


def create_job(conn: sqlite3.Connection, principal: Principal, *, kind: str, key: str, digest: str, rows: list[dict[str, Any]],
               report: list[dict[str, Any]], request_id: str | None) -> tuple[dict[str, Any], bool]:
    """A new staged job, or the one this key already made (same content). Returns (job row, replayed)."""
    if not IDEMPOTENCY.fullmatch(key or ""):
        raise ApiError(422, "bulk_idempotency_key", "חסר מפתח ייחודי לבקשה.", details={"header": "Idempotency-Key"})
    old = conn.execute("SELECT * FROM access_bulk_jobs WHERE created_by = ? AND idempotency_key = ?", (principal.user_id, key)).fetchone()
    if old is not None:
        if old["source_digest"] != digest:
            raise ApiError(409, "bulk_idempotency_conflict", "המפתח הייחודי כבר שימש לבקשה אחרת.")
        return dict(old), True
    at = _now()
    job_id = new_id()
    conn.execute("""INSERT INTO access_bulk_jobs(id, kind, state, created_by, idempotency_key, source_digest, row_count, rows_json, report_json,
                    created_at, updated_at, expires_at) VALUES (?, ?, 'staged', ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                 (job_id, kind, principal.user_id, key, digest, len(report), json.dumps(rows, ensure_ascii=False), json.dumps(report),
                  _iso(at), _iso(at), _iso(at + JOB_TTL)))
    counts = _report_counts(report)
    audit(conn, actor=principal, action="access.bulk.stage", decision="allowed", resource_type="access_bulk_job", resource_id=job_id,
          request_id=request_id, details={"kind": kind, "rows": len(report), **counts})
    return _row_of(conn, job_id), False  # type: ignore[return-value]


def _report_counts(report: list[dict[str, Any]]) -> dict[str, int]:
    out = {"ok": 0, "skip": 0, "error": 0}
    for e in report:
        out[e["status"]] = out.get(e["status"], 0) + 1
    return out


def may_see_job(conn: sqlite3.Connection, principal: Principal, job: dict[str, Any]) -> bool:
    return job["created_by"] == principal.user_id or is_system_admin(conn, principal.user_id)


def job_view(job: dict[str, Any]) -> dict[str, Any]:
    """What a client sees of a job: no row values ever (codes, field names, row numbers, person ids, outcomes)."""
    report = json.loads(job["report_json"] or "[]")
    plan = json.loads(job["plan_json"]) if job.get("plan_json") else None
    results = json.loads(job["results_json"] or "{}")
    outcomes: dict[str, int] = {}
    for r in results.values():
        outcomes[r["outcome"]] = outcomes.get(r["outcome"], 0) + 1
    writes = len(plan) if plan is not None else None
    return {
        "id": job["id"], "kind": job["kind"], "state": job["state"], "row_count": job["row_count"], "created_at": job["created_at"],
        "expires_at": job["expires_at"], "report": report, "counts": _report_counts(report),
        "plan": plan, "plan_digest": job.get("plan_digest"), "previewed_at": job.get("previewed_at"), "writes": writes,
        "confirmed": job.get("confirmed_at") is not None,
        "results": [{"row": int(k), **v} for k, v in sorted(results.items(), key=lambda kv: int(kv[0]))], "outcomes": outcomes,
        "progress": {"done": sum(1 for r in results.values() if r["outcome"] in ("ok", "failed", "unknown")), "total": writes or 0},
        "go_live_permitted": go_live_permitted(),
    }


# ---------------------------------------------------------------- dry-run (never writes)

def dry_run(auth: ia.Authority, job: dict[str, Any], eng: BulkEngine) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Resolve every staged row against ONE fresh directory read, at the caller's field level. Returns (plan, rows_out, report): `plan`
    the writes (no values: row, op, person_id, revision, fields, data digest), `rows_out` the screen's diff (values the caller may see,
    never stored), `report` the updated per-row report."""
    rows = json.loads(job["rows_json"] or "[]")
    who = auth.principal.user_id
    people = {p.superset["id"]: p for p in eng.list_people(who)}
    visible_numbers = {p.superset.get("employee_no"): pid for pid, p in people.items() if p.superset.get("employee_no") and _visible(auth, p)}
    needs_groups = any(k in r["set"] for r in rows for k in ("groups", "groups_add", "groups_remove"))
    groups = eng.groups(who) if needs_groups else None
    report = {e["row"]: e for e in json.loads(job["report_json"] or "[]")}
    plan: list[dict[str, Any]] = []
    out: list[dict[str, Any]] = []
    for row in rows:
        n = row["row"]
        person = people.get(row["person_id"]) if row["op"] == "update" else None
        entry: dict[str, Any] = {"row": n, "op": row["op"], "person_id": row["person_id"]}
        try:
            if row["op"] == "update":
                if not _visible(auth, person):
                    raise RowError("not_found", ["person_id"])
                assert person is not None
                if row["revision"] is not None and row["revision"] != person.engine.revision:
                    raise RowError("revision_conflict", ["revision"])
            elif row["set"].get("employee_no") in visible_numbers:
                raise RowError("employee_conflict", ["employee_no"])
            data, touched = build_data(row, person, groups)
            if row["op"] == "update" and not data:
                entry.update(status="unchanged", codes=[], fields=[])
                report[n] = {"row": n, "status": "skip", "codes": ["unchanged"], "fields": []}
                out.append(entry)
                continue
            bad = _person_data_check(data)
            if bad:
                raise RowError("invalid", bad)
            gate_row(auth, row, person, data, touched, revision=None)
        except RowError as err:
            entry.update(status="error", codes=[err.code], fields=err.fields)
            report[n] = {"row": n, "status": "error", "codes": [err.code], "fields": err.fields}
            out.append(entry)
            continue
        fields = sorted(k for k in data if k != "permission_overrides")
        revision = person.engine.revision if person is not None else None
        plan.append({"row": n, "op": row["op"], "person_id": row["person_id"], "revision": revision, "fields": fields, "data": _digest(data)})
        view = ia.view_person(auth, person.superset, detail=False) if person is not None else None
        entry.update(status="write", codes=[], fields=fields, name=(view or {}).get("display_name") if view else row["set"].get("display_name"),
                     diff=diff_view(auth, person, data))
        report[n] = {"row": n, "status": "ok", "codes": [], "fields": fields}
        out.append(entry)
    return plan, out, [report[k] for k in sorted(report)]


def store_preview(conn: sqlite3.Connection, job: dict[str, Any], principal: Principal, plan: list[dict[str, Any]], report: list[dict[str, Any]],
                  request_id: str | None) -> dict[str, Any]:
    at = _iso(_now())
    digest = _digest(plan)
    cur = conn.execute("""UPDATE access_bulk_jobs SET state = 'previewed', plan_json = ?, plan_digest = ?, report_json = ?, previewed_at = ?,
                          previewed_by = ?, confirmed_by = NULL, confirmed_at = NULL, updated_at = ? WHERE id = ? AND state IN ('staged', 'previewed')""",
                       (json.dumps(plan), digest, json.dumps(report), at, principal.user_id, at, job["id"]))
    if not cur.rowcount:
        raise ApiError(409, "bulk_job_state", "המשימה כבר אינה בשלב התצוגה המקדימה.")
    audit(conn, actor=principal, action="access.bulk.dry_run", decision="allowed", resource_type="access_bulk_job", resource_id=job["id"],
          request_id=request_id, details={"writes": len(plan), "creates": sum(1 for p in plan if p["op"] == "create"), **_report_counts(report)})
    return _row_of(conn, job["id"])  # type: ignore[return-value]


# ---------------------------------------------------------------- confirm (system administrator, interactive, bound to the plan)

def confirm(conn: sqlite3.Connection, principal: Principal, job: dict[str, Any], *, plan_digest: str, typed: str, request_id: str | None) -> dict[str, Any]:
    def refuse(code: str, message: str, status: int = 409) -> ApiError:
        audit(conn, actor=principal, action="access.bulk.confirm", decision="denied", resource_type="access_bulk_job", resource_id=job["id"],
              reason=code, request_id=request_id)
        return ApiError(status, code, message)

    if not is_system_admin(conn, principal.user_id):
        raise refuse("not_system_admin", "רק מנהל מערכת יכול לאשר שינוי מרוכז.", 403)
    if not iw.interactive(principal):
        raise refuse("bulk_interactive_only", "אישור שינוי מרוכז זמין רק בהפעלה אינטראקטיבית של אדם (דפדפן).", 403)
    if job["state"] != "previewed" or not job.get("plan_json"):
        raise refuse("bulk_job_state", "יש להריץ תצוגה מקדימה לפני האישור.")
    previewed = _parse_iso(job.get("previewed_at"))
    if previewed is None or _now() - previewed > PREVIEW_TTL:
        raise refuse("bulk_preview_stale", "התצוגה המקדימה ישנה. הריצו אותה שוב לפני האישור.")
    if plan_digest != job["plan_digest"]:
        raise refuse("bulk_plan_changed", "התוכנית השתנתה מאז שהוצגה. הריצו שוב את התצוגה המקדימה.")
    writes = len(json.loads(job["plan_json"]))
    if writes == 0:
        raise refuse("bulk_nothing_to_apply", "אין שורות לכתיבה.")
    if typed.strip() != str(writes):
        raise refuse("bulk_confirm_mismatch", "יש להקליד את מספר השורות שייכתבו.", 422)
    at = _iso(_now())
    conn.execute("UPDATE access_bulk_jobs SET state = 'confirmed', confirmed_by = ?, confirmed_at = ?, updated_at = ? WHERE id = ? AND state = 'previewed'",
                 (principal.user_id, at, at, job["id"]))
    audit(conn, actor=principal, action="access.bulk.confirm", decision="allowed", resource_type="access_bulk_job", resource_id=job["id"],
          request_id=request_id, details={"writes": writes, "plan_digest": job["plan_digest"][:16]})
    return _row_of(conn, job["id"])  # type: ignore[return-value]


# ---------------------------------------------------------------- apply (bounded batches, resumable)

def claim(conn: sqlite3.Connection, principal: Principal, job_id: str) -> dict[str, Any] | None:
    """Take the job for one batch (a lease; one applier at a time; only the confirmer)."""
    now = _now()
    cur = conn.execute("""UPDATE access_bulk_jobs SET state = 'applying', lease_until = ?, updated_at = ?
                          WHERE id = ? AND confirmed_by = ? AND (state IN ('confirmed', 'paused') OR (state = 'applying' AND lease_until < ?))""",
                       (_iso(now + LEASE), _iso(now), job_id, principal.user_id, _iso(now)))
    return _row_of(conn, job_id) if cur.rowcount else None


def pending_entries(job: dict[str, Any]) -> list[dict[str, Any]]:
    """The plan entries still to write: never written, or not sent (nothing reached WisKey). `ok`, `failed` and `unknown` are final:
    an unknown outcome is never re-sent (it needs a fresh check by a person - the S11 rule)."""
    results = json.loads(job["results_json"] or "{}")
    return [p for p in json.loads(job["plan_json"] or "[]") if results.get(str(p["row"]), {}).get("outcome") in (None, "not_sent")]


def apply_row(auth: ia.Authority, eng: BulkEngine, entry: dict[str, Any], row: dict[str, Any], groups: dict[str, list[str] | None] | None) -> dict[str, Any]:
    """Write one planned row: a fresh read, the gate again (the confirmer's authority), the data rebuilt and compared with the planned
    digest, then one engine write. Returns `{outcome: ok | failed | unknown | not_sent, code, person_id}`."""
    who = auth.principal.user_id
    person: BulkPerson | None = None
    try:
        if entry["op"] == "update":
            try:
                person = eng.get_person(entry["person_id"], who)
            except EngineError as exc:
                if exc.kind == "not_sent":
                    return {"outcome": "not_sent", "code": exc.code or "not_sent", "person_id": entry["person_id"]}
                return {"outcome": "failed", "code": "not_found" if exc.kind == "not_found" else exc.kind, "person_id": entry["person_id"]}
            if not _visible(auth, person):
                return {"outcome": "failed", "code": "not_found", "person_id": entry["person_id"]}
            if person.engine.revision != entry["revision"]:
                return {"outcome": "failed", "code": "revision_conflict", "person_id": entry["person_id"]}
        data, touched = build_data(row, person, groups)
        if _digest(data) != entry["data"]:
            return {"outcome": "failed", "code": "plan_changed", "person_id": entry["person_id"]}
        gate_row(auth, row, person, data, touched, revision=entry["revision"])
    except RowError as err:
        return {"outcome": "failed", "code": err.code, "person_id": entry["person_id"]}
    try:
        if person is None:
            saved = eng.create(data, who)
        else:
            saved = eng.update(entry["person_id"], person.engine.revision, data, who)
    except EngineError as exc:
        outcome = {"not_sent": "not_sent", "unknown": "unknown", "not_permitted": "not_sent"}.get(exc.kind, "failed")
        code = exc.code if exc.kind in ("refused", "not_sent", "unknown") and exc.code else exc.kind
        return {"outcome": outcome, "code": code[:64], "person_id": entry["person_id"]}
    except Exception as exc:  # noqa: BLE001 - an unexpected failure after sending may have reached WisKey: unknown, never re-sent
        log.warning("bulk people: a row write failed (%s)", type(exc).__name__)
        return {"outcome": "unknown", "code": type(exc).__name__[:64], "person_id": entry["person_id"]}
    return {"outcome": "ok", "code": None, "person_id": saved.superset.get("id") or entry["person_id"]}


def apply_batch(db: Any, principal: Principal, job_id: str, eng: BulkEngine, request_id: str | None) -> dict[str, Any]:
    """One bounded batch of the confirmed job. The engine calls run with no write lock held; each row's result is committed on its own
    (a crash loses at most the row in flight, whose outcome is then `unknown`-safe: it is retried only if it was never recorded as sent)."""
    with db.connection(label="bulk_people.claim") as conn:
        expire_jobs(conn)
        job = _row_of(conn, job_id)
        if job is None or not may_see_job(conn, principal, job):
            raise ApiError(404, "bulk_job_not_found", "המשימה לא נמצאה.")
        if not enabled(conn):
            raise ApiError(409, "bulk_people_off", "שינוי מרוכז של אנשים כבוי.")
        if not go_live_permitted():
            audit(conn, actor=principal, action="access.bulk.apply", decision="denied", resource_type="access_bulk_job", resource_id=job_id,
                  reason="bulk_people_not_permitted", request_id=request_id)
            raise ApiError(409, "bulk_people_not_permitted", "כתיבה מרוכזת לבקרת הכניסה דורשת אישור הפעלה נפרד מבעל המערכת, וגרסה זו אינה כוללת אותו.")
        if job["state"] == "done":
            return job_view(job)
        if job.get("confirmed_by") != principal.user_id:
            raise ApiError(409, "bulk_job_state", "רק מי שאישר את המשימה יכול להריץ אותה.")
        job = claim(conn, principal, job_id)
        if job is None:
            raise ApiError(409, "bulk_job_busy", "המשימה אינה מוכנה להרצה או שהיא כבר רצה.")
    rows = {r["row"]: r for r in json.loads(job["rows_json"] or "[]")}
    batch = pending_entries(job)[:BATCH]
    streak = 0
    stopped = False
    with db.connection(mode="read", label="bulk_people.authority") as rconn:
        auth = ia.Authority(rconn, principal)
        groups: dict[str, list[str] | None] | None = None
        if any(k in rows[e["row"]]["set"] for e in batch for k in ("groups", "groups_add", "groups_remove")):
            try:
                groups = eng.groups(principal.user_id)
            except EngineError:
                groups = None  # the rows that need them fail as `unknown_group` - nothing is sent for them
        for entry in batch:
            result = apply_row(auth, eng, entry, rows[entry["row"]], groups)
            with db.connection(label="bulk_people.row") as conn:
                current = _row_of(conn, job_id)
                results = json.loads(current["results_json"] or "{}")
                results[str(entry["row"])] = result
                conn.execute("UPDATE access_bulk_jobs SET results_json = ?, updated_at = ? WHERE id = ?", (json.dumps(results), _iso(_now()), job_id))
                audit(conn, actor=principal, action="access.bulk.row", decision="allowed" if result["outcome"] == "ok" else "denied",
                      resource_type="intercom_person", resource_id=result.get("person_id") or "new", reason=result.get("code"), request_id=request_id,
                      details={"job": job_id, "row": entry["row"], "op": entry["op"], "outcome": result["outcome"], "fields": entry["fields"]})
            streak = streak + 1 if result["outcome"] == "not_sent" else 0
            if streak >= NOT_SENT_STREAK:
                stopped = True
                break
    with db.connection(label="bulk_people.release") as conn:
        job = _row_of(conn, job_id)
        left = pending_entries(job)
        finished = not left
        state = "done" if finished else "paused"
        done = sum(1 for r in json.loads(job["results_json"] or "{}").values() if r["outcome"] in ("ok", "failed", "unknown"))
        conn.execute("UPDATE access_bulk_jobs SET state = ?, lease_until = NULL, cursor = ?, rows_json = CASE WHEN ? THEN NULL ELSE rows_json END, "
                     "updated_at = ? WHERE id = ?", (state, done, finished, _iso(_now()), job_id))
        if finished:
            outcomes: dict[str, int] = {}
            for r in json.loads(job["results_json"] or "{}").values():
                outcomes[r["outcome"]] = outcomes.get(r["outcome"], 0) + 1
            audit(conn, actor=principal, action="access.bulk.apply", decision="allowed", resource_type="access_bulk_job", resource_id=job_id,
                  request_id=request_id, details={"writes": len(json.loads(job["plan_json"] or "[]")), **outcomes})
        view = job_view(_row_of(conn, job_id))  # type: ignore[arg-type]
    view["stalled"] = stopped
    view["more"] = not finished and not stopped
    return view


def cancel(conn: sqlite3.Connection, principal: Principal, job: dict[str, Any], request_id: str | None) -> dict[str, Any]:
    if job["state"] in FINAL:
        return job
    if job["state"] == "applying" and (_parse_iso(job.get("lease_until")) or _now()) > _now():
        raise ApiError(409, "bulk_job_busy", "המשימה רצה כרגע. נסו שוב בעוד רגע.")
    conn.execute("UPDATE access_bulk_jobs SET state = 'cancelled', rows_json = NULL, lease_until = NULL, updated_at = ? WHERE id = ?", (_iso(_now()), job["id"]))
    audit(conn, actor=principal, action="access.bulk.cancel", decision="allowed", resource_type="access_bulk_job", resource_id=job["id"], request_id=request_id)
    return _row_of(conn, job["id"])  # type: ignore[return-value]


# ---------------------------------------------------------------- export (the people the caller may see)

_export_last: dict[str, float] = {}


def reset_for_tests() -> None:
    _export_last.clear()


def export_wait(user_id: str) -> float:
    last = _export_last.get(user_id)
    return 0.0 if last is None else max(0.0, EXPORT_RATE_S - (time.monotonic() - last))


def export_mark(user_id: str) -> None:
    _export_last[user_id] = time.monotonic()


def csv_cell(value: Any) -> str:
    """The shared formula guard (tickets/text_hygiene.csv_cell) on text."""
    from .tickets.text_hygiene import csv_cell as guard

    out = guard(value)
    return str(out)


def export_rows(auth: ia.Authority, eng: BulkEngine) -> list[list[str]]:
    """Header + one row per person the caller may see (the projection filter), in the import format. Never a PIN, card or photo; the
    phone only at the sensitive level and then masked (····NN); the doors / groups the caller sees. 413 above EXPORT_MAX_ROWS."""
    people = eng.list_people(auth.principal.user_id)
    views = [v for p in people if (v := ia.view_person(auth, p.superset, detail=True)) is not None]
    if len(views) > EXPORT_MAX_ROWS:
        raise ApiError(413, "export_too_large", "יותר מדי שורות לייצוא.", details={"max_rows": EXPORT_MAX_ROWS})
    views.sort(key=lambda v: ((v.get("display_name") or "").casefold(), v.get("id") or ""))
    out = [list(COLUMNS)]
    for v in views:
        stations = [s for s in v.get("stations") or [] if s.get("enabled")]
        doors = "; ".join(f"{s['station_id']}:{'+'.join(str(d) for d in s.get('doors') or [])}" for s in stations if s.get("doors"))
        values = {
            "person_id": v.get("id"), "revision": v.get("revision"), "employee_no": v.get("employee_no"), "display_name": v.get("display_name"),
            "phone": _mask_phone(v.get("phone")) if v.get("level") == ia.SENSITIVE else None, "access_category": v.get("access_category"),
            "responsible_person": v.get("responsible_person"), "access_purpose": v.get("access_purpose"),
            "active": None if v.get("active") is None else ("true" if v.get("active") else "false"),
            "valid_from": v.get("valid_from"), "valid_until": v.get("valid_until"), "doors": doors,
            "groups": "; ".join(g for g in v.get("group_ids") or [] if isinstance(g, str)),
        }
        out.append([csv_cell("" if values[c] is None else str(values[c])) for c in COLUMNS])
    return out


def write_csv(cells: list[list[str]]) -> bytes:
    """UTF-8 with a BOM, every cell quoted, CRLF (the tickets and GRANTSMIN exports' format)."""
    buf = io.StringIO(newline="")
    csv.writer(buf, quoting=csv.QUOTE_ALL, lineterminator="\r\n").writerows(cells)
    return ("﻿" + buf.getvalue()).encode("utf-8")


def template_csv() -> bytes:
    return write_csv([list(COLUMNS)])


# ---------------------------------------------------------------- settings

def settings_view(conn: sqlite3.Connection) -> dict[str, Any]:
    return {"enabled": "on" if enabled(conn) else "off", "go_live_permitted": go_live_permitted(),
            "limits": {"max_file_bytes": MAX_FILE_BYTES, "max_rows": MAX_ROWS, "max_edit_people": MAX_EDIT_PEOPLE, "batch": BATCH,
                       "export_rows": EXPORT_MAX_ROWS, "job_hours": int(JOB_TTL.total_seconds() // 3600)},
            "columns": list(COLUMNS)}


def set_enabled(conn: sqlite3.Connection, value: str) -> None:
    set_setting(conn, FLAG_KEY, value)
