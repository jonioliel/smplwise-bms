"""WISKEY-PEOPLE-COMPLETE-2390 (plan task T9, owner decision Q3 "a" of 03.11): people completeness.

1. **People on stations only** - users that exist on a door station but are not managed by WisKey (and so not in Arx). WisKey's
   `stations/inventory {station_id}` reads the station (WisKey scans the device) and answers one row per station user: the station's
   user number (`employee_no`), the name as the station reports it, the WisKey person bound to it on that station (`user_id`, null when
   none - the rows this view shows), WisKey's own ignore flag, a `review_token` (WisKey's fingerprint of the station user - adopt and
   delete are refused `review_stale` when the station changed since), `import_error` (why WisKey cannot take the user over as is),
   `pin_configured` and the cards in WisKey's masked form. Arx keeps:
   - the rows in memory per station (`Inventory`, at most CACHE_S old unless refreshed) - the review tokens NEVER leave the server
     (a fingerprint of a record that holds a short PIN must not reach a browser);
   - per (station, user number) when it was first and last seen and the administrator's reversible "ignore" (migration 0198); no
     name, PIN, card or face value is stored.
   Face / fingerprint: rc.10's inventory row has no such field. WisKey refuses to adopt a user holding one (`unsupported_credentials`
   from `_import_data`), so `biometric` is true exactly then and null ("not reported") otherwise.
2. **Actions** (routers/access_control_station_people.py): adopt (`users/adopt` - WisKey binds the existing station user to a new
   WisKey person, or to an existing one with the same user number, `user_id` + `revision`; nothing is created on the station), ignore
   (Arx's list + WisKey's `users/ignore` mirror) and delete from the station (`users/delete_unmanaged` - WisKey records the user and a
   tombstone in one commit; its own sync then removes the user from the device).
3. **Duplicate checks**: `users/data_quality kind=duplicate` (people sharing a name, a phone or a unique profile value; no PIN - WisKey
   never compares PINs there), `users/duplicate_check` (a draft against WisKey's people: same user number, name, phone, card suffix)
   and `users/pin_check` (whether a PIN is free; the value is sent to WisKey once, never stored, logged or audited).

Every command leaves through the `station_people` channel guard (services/wiskey_channels.py) on the feed's own session; nothing here
opens a socket of its own and nothing is retried. The refusal tables below are a static reading of WisKey rc.10
(`custom_components/hikvision_intercom/access/manager.py` `async_adopt` / `_import_data` / `async_ignore`, `repository.py`
`async_adopt` / `async_ignore`, ref origin/codex/wiskey-mac-m12-policy-b-2026-11-02 @ 2834aa5e): every code raised before WisKey's
commit is a refusal ("not carried out"); anything else - `storage_write_failed`, `manager_closed`, `action_failed`, a code this table
does not know - is "outcome unknown", never retried (NOT_RUN against a live WisKey)."""
from __future__ import annotations

import re
import sqlite3
import threading
import time
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Iterable

from ..db import now_iso
from . import intercom_client
from .intercom_client import API_CONTRACT, Call, IntercomError, UnclearAnswer, command_type

CHANNEL = "station_people"
INVENTORY_TIMEOUT_S = 45.0  # WisKey scans the station (identity, capabilities, the user and card lists) before it answers
CACHE_S = 120.0  # a station's rows are served from memory this long; the screen's "refresh" reads the station again
TOKEN_MAX_AGE_S = 600.0  # an adopt / delete needs an inventory of the station at most this old (else: read the station again)
EMPLOYEE_NO = re.compile(r"^[A-Za-z0-9_-]{1,32}$")  # WisKey validate_identifier (client/access.py)
NAME_MAX = 64  # WisKey text_field(display_name, 64)
DQ_PAGE = 100  # users/data_quality: limit 1..100
DQ_MAX_PAGES = 5  # at most 500 people with a duplicate issue are read for the people screen's warning
PIN_CHECKS_PER_MIN = 6  # users/pin_check answers whether a PIN is in use: an oracle, kept slow per Arx user
DUPLICATE_CODES = ("duplicate_display_name", "duplicate_phone", "duplicate_profile")

# ---------------------------------------------------------------- refusals proven to come before WisKey's commit (static reading)

_IMPORT_CODES = frozenset({"device_user_missing", "schedule_unverified", "unmanaged_lock", "unsupported_credentials", "pin_device_managed",
                           "local_validity_needs_conversion"})
# async_adopt: validate_identifier, _station / _driver, the transaction's device READS (capabilities, the one person), the fingerprint
# compare (`review_stale`), _import_data, _validate (build_user + capabilities) and repository.async_adopt's change function
# (`invalid_operation`, `user_not_found`, `revision_conflict`, `identity_migration_required`, `already_managed`) plus _commit's
# collision checks - all before `_save`. The device is only READ before the commit (no device write in this command).
ADOPT_REFUSED = intercom_client.PRE_STORAGE["users/create"] | _IMPORT_CODES | {
    "station_offline", "device_unavailable", "review_stale", "invalid_operation", "already_managed", "approval_required",
}
IGNORE_REFUSED = frozenset({"station_not_found", "invalid_boolean", "invalid_identifier", "storage_stopping"})
PRE_COMMIT: dict[str, frozenset[str]] = {
    "users/adopt": ADOPT_REFUSED,
    "users/delete_unmanaged": ADOPT_REFUSED,
    "users/ignore": IGNORE_REFUSED,
}


def _refused(command: str, code: str) -> bool:
    return code in intercom_client.PRE_DISPATCH or code in PRE_COMMIT.get(command, frozenset())


def _write_result(frame: dict[str, Any], command: str) -> Any:
    """A write's answer, read like intercom_client._action_result: `success: true` is done; `success: false` is a refusal only for a
    code PRE_COMMIT proves comes before the commit; everything else is "outcome unknown" (UnclearAnswer)."""
    if not isinstance(frame, dict):
        raise UnclearAnswer(command, "invalid_response")
    if frame.get("success") is True:
        return frame.get("result")
    if frame.get("success") is False:
        error = frame.get("error") if isinstance(frame.get("error"), dict) else {}
        code = str(error.get("code") or "")
        if code and _refused(command, code):
            raise IntercomError(code, command)
        raise UnclearAnswer(command, code or "action_failed")
    raise UnclearAnswer(command, "invalid_response")


def _read_result(frame: Any, command: str) -> Any:
    if not isinstance(frame, dict):
        raise IntercomError("invalid_response", command)
    if frame.get("success") is True:
        return frame.get("result")
    if frame.get("success") is False:
        error = frame.get("error") if isinstance(frame.get("error"), dict) else {}
        raise IntercomError(str(error.get("code") or "action_failed"), command)
    raise IntercomError("invalid_response", command)


# ---------------------------------------------------------------- the commands (the pinned catalog's key sets; rc37-contract.4)

async def inventory(call: Call, station_id: str) -> list[dict[str, Any]]:
    """`stations/inventory {station_id}` - a READ in the pinned catalog (no `api_contract`): the station's users as the device reports
    them. WisKey scans the station first (`station_offline` / `device_unavailable` when it cannot)."""
    result = _read_result(await call(command_type("stations/inventory"), station_id=station_id), "stations/inventory")
    if not isinstance(result, list):
        raise IntercomError("invalid_response", "stations/inventory")
    return result


async def data_quality(call: Call, offset: int, snapshot: str) -> dict[str, Any]:
    """`users/data_quality {kind: duplicate, state: current, offset, limit, snapshot}` - a READ; WisKey's own report over its people."""
    result = _read_result(await call(command_type("users/data_quality"), kind="duplicate", state="current", offset=offset, limit=DQ_PAGE, snapshot=snapshot),
                          "users/data_quality")
    if not isinstance(result, dict):
        raise IntercomError("invalid_response", "users/data_quality")
    return result


async def duplicate_check(call: Call, user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """`users/duplicate_check {user_id, data}` - a READ: WisKey's people that may be this draft (`data` keys: employee_no,
    display_name, phone, card_suffixes; no PIN, no full card number in the answer)."""
    result = _read_result(await call(command_type("users/duplicate_check"), user_id=user_id, data=data), "users/duplicate_check")
    if not isinstance(result, dict):
        raise IntercomError("invalid_response", "users/duplicate_check")
    return result


async def pin_check(call: Call, user_id: str, pin: str) -> dict[str, Any]:
    """`users/pin_check {user_id, pin, api_contract}` - non-READ (`users: manage`), side-effect free: `{available}`."""
    result = _read_result(await call(command_type("users/pin_check"), user_id=user_id, pin=pin, api_contract=API_CONTRACT), "users/pin_check")
    if not isinstance(result, dict) or type(result.get("available")) is not bool:
        raise IntercomError("invalid_response", "users/pin_check")
    return {"available": result["available"]}


async def adopt(call: Call, station_id: str, employee_no: str, review_token: str, user_id: str | None = None, revision: int | None = None) -> Any:
    """`users/adopt {station_id, employee_no, review_token[, user_id, revision], api_contract}`: WisKey takes the station user over as
    is (a new person, or the existing person `user_id` at `revision` - same user number only). Nothing is written to the station."""
    extra: dict[str, Any] = {}
    if user_id is not None:
        if type(revision) is not int:
            raise IntercomError("invalid_fields", "users/adopt")
        extra = {"user_id": user_id, "revision": revision}
    frame = await call(command_type("users/adopt"), station_id=station_id, employee_no=employee_no, review_token=review_token, api_contract=API_CONTRACT, **extra)
    return _write_result(frame, "users/adopt")


async def delete_unmanaged(call: Call, station_id: str, employee_no: str, review_token: str) -> Any:
    """`users/delete_unmanaged {station_id, employee_no, review_token, api_contract}`: WisKey records the station user and its removal
    in one commit; its own sync then deletes the user from the station (a device write, not immediate)."""
    frame = await call(command_type("users/delete_unmanaged"), station_id=station_id, employee_no=employee_no, review_token=review_token, api_contract=API_CONTRACT)
    return _write_result(frame, "users/delete_unmanaged")


async def ignore(call: Call, station_id: str, employee_no: str, ignored: bool) -> Any:
    """`users/ignore {station_id, employee_no, ignored, api_contract}`: WisKey's own ignore flag (its unmanaged counts leave it out)."""
    if type(ignored) is not bool:
        raise IntercomError("invalid_fields", "users/ignore")
    frame = await call(command_type("users/ignore"), station_id=station_id, employee_no=employee_no, ignored=ignored, api_contract=API_CONTRACT)
    return _write_result(frame, "users/ignore")


# ---------------------------------------------------------------- projections

def _text(value: Any, limit: int) -> str:
    """A name as the station reports it: NFC, control characters dropped, whitespace collapsed, at most `limit` characters."""
    if not isinstance(value, str):
        return ""
    text = "".join(ch for ch in unicodedata.normalize("NFC", value) if unicodedata.category(ch)[0] != "C")
    return " ".join(text.split())[:limit]


@dataclass
class Row:
    """One user of one station as Arx keeps it in memory (the token stays here)."""

    employee_no: str
    display_name: str
    managed_by: str | None  # the WisKey person bound to it on this station (such rows are not shown)
    ignored_wiskey: bool
    review_token: str | None
    import_error: str | None
    pin: bool
    cards: int
    biometric: bool | None


def project_rows(raw: Any) -> list[Row]:
    """`stations/inventory`'s answer as Rows: a row without a valid user number is dropped (it could never be adopted, ignored or
    deleted by number); every other key is read defensively (a malformed row reads as "no credential", "not adoptable")."""
    if not isinstance(raw, list):
        raise ValueError("unexpected stations/inventory answer")
    out: list[Row] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        number = item.get("employee_no")
        if not isinstance(number, str) or not EMPLOYEE_NO.match(number) or number in seen:
            continue
        seen.add(number)
        token = item.get("review_token")
        error = item.get("import_error")
        owner = item.get("user_id")
        cards = item.get("cards")
        out.append(Row(
            employee_no=number,
            display_name=_text(item.get("display_name"), NAME_MAX),
            managed_by=owner if isinstance(owner, str) and owner else None,
            ignored_wiskey=item.get("ignored") is True,
            review_token=token if isinstance(token, str) and token else None,
            import_error=error if isinstance(error, str) and re.fullmatch(r"[a-z_]{1,64}", error) else (None if error is None else "unknown"),
            pin=item.get("pin_configured") is True,
            cards=len([c for c in cards if isinstance(c, dict)]) if isinstance(cards, list) else 0,
            biometric=True if error == "unsupported_credentials" else None,
        ))
    return out


@dataclass
class Inventory:
    station_id: str
    rows: list[Row]
    read_at: float  # time.monotonic() of the read
    read_at_iso: str


class InventoryCache:
    """The last inventory per station (process memory only; a restart reads the stations again)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._by_station: dict[str, Inventory] = {}

    def get(self, station_id: str, max_age: float) -> Inventory | None:
        with self._lock:
            inv = self._by_station.get(station_id)
        if inv is None or time.monotonic() - inv.read_at > max_age:
            return None
        return inv

    def put(self, inv: Inventory) -> None:
        with self._lock:
            self._by_station[inv.station_id] = inv

    def forget(self, station_id: str) -> None:
        """After a write to the station's users: the next view reads the station again (the tokens moved on)."""
        with self._lock:
            self._by_station.pop(station_id, None)

    def reset(self) -> None:
        with self._lock:
            self._by_station.clear()


CACHE = InventoryCache()


def station_only(inv: Inventory) -> list[Row]:
    """The rows this view is about: no WisKey person is bound to them on this station."""
    return [r for r in inv.rows if r.managed_by is None]


def find(inv: Inventory, employee_no: str) -> Row | None:
    return next((r for r in inv.rows if r.employee_no == employee_no), None)


# ---------------------------------------------------------------- the stored part (migration 0198)

def record_seen(conn: sqlite3.Connection, station_id: str, numbers: Iterable[str], at: str | None = None) -> None:
    """First / last seen of the station-only users of one inventory (insert or touch; nothing is ever deleted here)."""
    when = at or now_iso()
    for number in numbers:
        conn.execute(
            "INSERT INTO wiskey_station_people(station_id, employee_no, first_seen_at, last_seen_at) VALUES (?,?,?,?) "
            "ON CONFLICT(station_id, employee_no) DO UPDATE SET last_seen_at = excluded.last_seen_at",
            (station_id, number, when, when),
        )


def stored(conn: sqlite3.Connection, station_id: str) -> dict[str, dict[str, Any]]:
    rows = conn.execute("SELECT employee_no, first_seen_at, last_seen_at, ignored_at, ignored_by FROM wiskey_station_people WHERE station_id = ?",
                        (station_id,)).fetchall()
    return {r["employee_no"]: dict(r) for r in rows}


def set_ignored(conn: sqlite3.Connection, station_id: str, employee_no: str, ignored: bool, by: str, at: str | None = None) -> None:
    when = at or now_iso()
    conn.execute(
        "INSERT INTO wiskey_station_people(station_id, employee_no, first_seen_at, last_seen_at, ignored_at, ignored_by) VALUES (?,?,?,?,?,?) "
        "ON CONFLICT(station_id, employee_no) DO UPDATE SET ignored_at = excluded.ignored_at, ignored_by = excluded.ignored_by",
        (station_id, employee_no, when, when, when if ignored else None, by if ignored else None),
    )


def ignored_counts(conn: sqlite3.Connection) -> dict[str, int]:
    rows = conn.execute("SELECT station_id, COUNT(*) AS n FROM wiskey_station_people WHERE ignored_at IS NOT NULL GROUP BY station_id").fetchall()
    return {r["station_id"]: int(r["n"]) for r in rows}


def view_rows(inv: Inventory, saved: dict[str, dict[str, Any]], *, credentials: bool) -> list[dict[str, Any]]:
    """The station-only users of one station for the screen. `credentials`: the caller holds `access.people.sensitive` on the station
    (else the PIN / card / face presence is null - it is a credential fact). Never a token, a PIN, a card number or a face."""
    out = []
    for r in station_only(inv):
        s = saved.get(r.employee_no) or {}
        out.append({
            "employee_no": r.employee_no,
            "display_name": r.display_name,
            "first_seen_at": s.get("first_seen_at") or inv.read_at_iso,
            "last_seen_at": s.get("last_seen_at") or inv.read_at_iso,
            "ignored": bool(s.get("ignored_at")),
            "ignored_at": s.get("ignored_at"),
            "ignored_in_wiskey": r.ignored_wiskey,
            "adoptable": r.import_error is None and r.review_token is not None,
            "import_error": r.import_error,
            "pin": r.pin if credentials else None,
            "cards": r.cards if credentials else None,
            "biometric": r.biometric if credentials else None,
        })
    out.sort(key=lambda x: (x["display_name"].casefold() or "￿", x["employee_no"]))
    return out


def has_credentials(row: Row) -> bool:
    return row.pin or row.cards > 0 or row.biometric is True


# ---------------------------------------------------------------- duplicates (users/data_quality)

def project_duplicates(pages: list[dict[str, Any]], *, sensitive: bool) -> list[dict[str, Any]]:
    """WisKey's duplicate issues as groups for the people screen: `{code, field_id, label, people: [{id, display_name}]}` - one group
    per set of people that share a value (never the value itself). `sensitive`: phone and unique-profile duplicates (they reveal that
    two people share a phone or an id number) only for a holder of `access.people.sensitive` everywhere; names for everyone allowed."""
    groups: dict[tuple[str, str, tuple[str, ...]], dict[str, Any]] = {}
    for page in pages:
        for record in page.get("records") or []:
            if not isinstance(record, dict) or not isinstance(record.get("id"), str):
                continue
            me = {"id": record["id"], "display_name": _text(record.get("display_name"), NAME_MAX)}
            for issue in record.get("issues") or []:
                if not isinstance(issue, dict) or issue.get("kind") != "duplicate":
                    continue
                code = issue.get("code")
                if code not in DUPLICATE_CODES or (code != "duplicate_display_name" and not sensitive):
                    continue
                related = [p for p in issue.get("related_people") or [] if isinstance(p, dict) and isinstance(p.get("id"), str)]
                people = [me] + [{"id": p["id"], "display_name": _text(p.get("display_name"), NAME_MAX)} for p in related]
                ids = tuple(sorted({p["id"] for p in people}))
                key = (code, str(issue.get("field_id") or ""), ids)
                if key in groups:
                    continue
                by_id = {p["id"]: p for p in people}
                groups[key] = {"code": code, "field_id": key[1], "label": _text(issue.get("label"), 64),
                               "people": [by_id[i] for i in ids], "more": max(0, int(issue.get("related_count") or 0) + 1 - len(ids))}
    return sorted(groups.values(), key=lambda g: (DUPLICATE_CODES.index(g["code"]), [p["display_name"].casefold() for p in g["people"]]))


# ---------------------------------------------------------------- the PIN-check budget (per Arx user, process memory)

@dataclass
class _Window:
    stamps: list[float] = field(default_factory=list)


class PinBudget:
    def __init__(self, per_minute: int = PIN_CHECKS_PER_MIN) -> None:
        self.per_minute = per_minute
        self._lock = threading.Lock()
        self._users: dict[str, _Window] = {}

    def take(self, user_id: str) -> bool:
        now = time.monotonic()
        with self._lock:
            w = self._users.setdefault(user_id, _Window())
            w.stamps = [t for t in w.stamps if now - t < 60.0]
            if len(w.stamps) >= self.per_minute:
                return False
            w.stamps.append(now)
            return True

    def reset(self) -> None:
        with self._lock:
            self._users.clear()


PIN_BUDGET = PinBudget()
