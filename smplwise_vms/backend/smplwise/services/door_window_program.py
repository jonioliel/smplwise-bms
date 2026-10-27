"""DOORWRITE-297 (board r129, CR-039 4.3): the rules of writing a door-window program from Arx to WisKey - pure functions, no I/O.

`door_windows.sync` composes each door's weekly program from the Arx schedule (`door_windows.compile_door`) and writes it through the typed
seam (`door_windows_engine.WindowEngine`, live: `wiskey_program_direct.DirectProgramEngine`). This module holds what that path decides:

- VALIDATE before anything is sent (`validate_policy`): the exact shape WisKey's `hold_open.policy` accepts (R: rc.37 extraction, mirrored by
  the W0 fake `tests/fake_doorwin_program.policy_code`), the Arx name prefix, and the catalog's request size cap. A policy that fails is never
  sent (`invalid`), so a WisKey refusal can only come from WisKey's own state (revision, pause-before-edit, the station).
- COMPARE by a canonical form (`canonical_sha`): what WisKey lists back is compared field by field to what Arx wrote, independent of key order,
  period order and of weekdays listed with no periods. Read-back verification and drift detection both use it.
- DRIFT (`drift_of`): the engine no longer holds what Arx wrote - the program is missing, paused, changed, or now carries a name that is not
  Arx's. Drift is never corrected automatically (a person may have paused the door on purpose in the intercom window): the door is blocked
  for automatic writes until a person presses "write again" (routers/door_windows.py `.../program/apply`).
- RETRY (`next_attempt_at`): a failed write is retried by the sync with a growing wait, at most `MAX_ATTEMPTS` times; then `failed` waits for a
  person or for a new compiled document. Every attempt starts with a fresh read (CR-039 4.3: never a blind second save after `unknown`).
- MESSAGES (`message_he`): one short Hebrew sentence per state for the operator (plain words, no codes; CLAUDE.md / owner rule).

Nothing here reaches WisKey; the program engine stays off in this build (`door_windows_engine.PROGRAM_ENGINE_BUILT` is False)."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from . import door_windows_engine as dwe

WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
MAX_PERIODS = 8            # per weekday / per date exception (R)
MAX_HOLIDAYS = 100         # date exceptions per program (W?: the W0 fake's assumption, CR-039 5.4)
MAX_REQUEST_BYTES = 65536  # the pinned catalog's max_request_bytes for the three program commands
HM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

WRITE_STATES = ("idle", "written", "verified", "retry_wait", "failed", "drift", "foreign", "blocked", "invalid", "prepared")
DRIFT_KINDS = ("missing", "disabled", "changed", "foreign")
RETRY_WAIT_S = (60, 120, 300, 900, 1800)  # after the 1st..5th failed attempt
MAX_ATTEMPTS = len(RETRY_WAIT_S)
DRIFT_CHECK_S = 900  # a door whose program Arx believes written is re-read at most this often to detect drift


# ---------------------------------------------------------------- validation (before anything is sent)

def _minutes(hm: str) -> int:
    return 24 * 60 if hm == "24:00" else int(hm[:2]) * 60 + int(hm[3:])


def _periods_code(periods: Any) -> str | None:
    if not isinstance(periods, list):
        return "invalid_fields"
    if len(periods) > MAX_PERIODS:
        return "schedule_period_limit"
    spans = []
    for p in periods:
        if not isinstance(p, dict) or set(p) != {"start", "end"}:
            return "invalid_fields"
        start, end = p["start"], p["end"]
        if not (isinstance(start, str) and HM.match(start)) or not (isinstance(end, str) and (HM.match(end) or end == "24:00")):
            return "schedule_invalid_time"
        if _minutes(end) <= _minutes(start):
            return "schedule_invalid_time"
        spans.append((_minutes(start), _minutes(end)))
    spans.sort()
    if any(a[1] > b[0] for a, b in zip(spans, spans[1:])):
        return "schedule_overlap"
    return None


def validate_policy(policy: Any, *, station_id: str = "", relay: int = 1, revision: int = 0) -> str | None:
    """None when WisKey would accept `policy` as Arx composed it, else the first problem's code. Same rules as rc.37's `hold_open.policy`
    (R) plus Arx's own: the program name carries the Arx prefix (CR-039 4.3), and the whole save request fits the catalog's size cap."""
    if not isinstance(policy, dict) or set(policy) != {"timezone", "schedule"}:
        return "invalid_fields"
    zone = policy["timezone"]
    if not isinstance(zone, str) or not zone or len(zone) > 64:
        return "invalid_timezone"
    try:
        ZoneInfo(zone)
    except (ZoneInfoNotFoundError, ValueError):
        return "invalid_timezone"
    sched = policy["schedule"]
    if not isinstance(sched, dict) or set(sched) != {"name", "weekly", "holidays"}:
        return "invalid_fields"
    name = sched["name"]
    if not isinstance(name, str) or not name.strip() or len(name) > dwe.NAME_MAX:
        return "invalid_fields"
    if not name.startswith(dwe.ARX_PREFIX):
        return "not_arx_name"
    weekly = sched["weekly"]
    if not isinstance(weekly, dict) or set(weekly) - set(WEEKDAYS):
        return "invalid_fields"
    for periods in weekly.values():
        code = _periods_code(periods)
        if code:
            return code
    holidays = sched["holidays"]
    if not isinstance(holidays, list):
        return "invalid_fields"
    if len(holidays) > MAX_HOLIDAYS:
        return "schedule_holiday_limit"
    ranges = []
    for h in holidays:
        if not isinstance(h, dict) or set(h) != {"name", "start", "end", "periods"}:
            return "invalid_fields"
        if not isinstance(h["name"], str) or not h["name"].strip() or len(h["name"]) > dwe.NAME_MAX:
            return "invalid_fields"
        if not all(isinstance(h[k], str) and DATE.match(h[k]) for k in ("start", "end")) or h["end"] < h["start"]:
            return "schedule_invalid_date"
        try:
            dt.date.fromisoformat(h["start"]), dt.date.fromisoformat(h["end"])
        except ValueError:
            return "schedule_invalid_date"
        code = _periods_code(h["periods"])
        if code:
            return code
        ranges.append((h["start"], h["end"]))
    ranges.sort()
    if any(a[1] >= b[0] for a, b in zip(ranges, ranges[1:])):
        return "schedule_holiday_overlap"
    if request_bytes(policy, station_id=station_id, relay=relay, revision=revision) > MAX_REQUEST_BYTES:
        return "request_too_large"
    return None


def request_bytes(policy: dict[str, Any], *, station_id: str = "", relay: int = 1, revision: int = 0) -> int:
    """The size of the `technical_program_save` frame Arx would send (with a generous envelope allowance for id / type / api_contract)."""
    body = {"id": 999999999, "type": "hikvision_intercom/stations/technical_program_save", "api_contract": 1, "station_id": station_id or "x" * 128,
            "door": relay, "revision": revision, "policy": policy, "enabled": True}
    return len(json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))


# ---------------------------------------------------------------- canonical comparison (read-back and drift)

def _canon_periods(periods: Any) -> list[tuple[str, str]]:
    if not isinstance(periods, list):
        return []
    return sorted((str(p.get("start", "")), str(p.get("end", ""))) for p in periods if isinstance(p, dict))


def canonical(policy: Any) -> dict[str, Any] | None:
    """The fields Arx writes, in one order: zone, name, the seven weekdays (a missing weekday = no periods) and the date exceptions sorted by
    start. Anything WisKey adds to the record beyond these is not compared. None for an unreadable policy (never equal to a written one)."""
    if not isinstance(policy, dict) or not isinstance(policy.get("schedule"), dict):
        return None
    sched = policy["schedule"]
    weekly = sched.get("weekly") if isinstance(sched.get("weekly"), dict) else {}
    holidays = sched.get("holidays") if isinstance(sched.get("holidays"), list) else []
    return {
        "timezone": str(policy.get("timezone") or ""),
        "name": str(sched.get("name") or ""),
        "weekly": {d: _canon_periods(weekly.get(d, [])) for d in WEEKDAYS},
        "holidays": sorted((str(h.get("start", "")), str(h.get("end", "")), str(h.get("name", "")), tuple(_canon_periods(h.get("periods"))))
                           for h in holidays if isinstance(h, dict)),
    }


def canonical_sha(policy: Any) -> str | None:
    c = canonical(policy)
    if c is None:
        return None
    return hashlib.sha256(json.dumps(c, sort_keys=True, ensure_ascii=False, default=list).encode("utf-8")).hexdigest()


def holds(state: dwe.ProgramState, policy: dict[str, Any] | None) -> bool:
    """The engine holds exactly `policy`, enabled, under an Arx name (the read-back proof of a write). Fail closed."""
    if policy is None or not state.exists or not state.arx or not state.enabled:
        return False
    a, b = canonical_sha(state.policy), canonical_sha(policy)
    return a is not None and a == b


def drift_of(state: dwe.ProgramState, policy: dict[str, Any] | None) -> str | None:
    """Why the engine no longer holds what Arx wrote (None: it does). `policy` is what Arx wrote and believes is held."""
    if policy is None:
        return None
    if not state.exists:
        return "missing"
    if not state.arx:
        return "foreign"
    if not state.enabled:
        return "disabled"
    if canonical_sha(state.policy) != canonical_sha(policy):
        return "changed"
    return None


# ---------------------------------------------------------------- retry

def next_attempt_at(attempts: int, now: dt.datetime) -> dt.datetime | None:
    """The earliest next try after `attempts` failed attempts; None once the attempts are used up (state `failed`)."""
    if attempts < 1:
        return now
    if attempts > MAX_ATTEMPTS:
        return None
    return now + dt.timedelta(seconds=RETRY_WAIT_S[attempts - 1])


def retryable(kind: str) -> bool:
    """An engine error the sync may try again after a wait (the next try starts with a read). `refused` covers WisKey refusals before any
    effect (the station unreachable, busy); `unknown` is settled by that read, never by a blind save."""
    return kind in ("not_sent", "unknown", "revision_conflict", "refused")


# ---------------------------------------------------------------- the operator's words (Hebrew; no codes on screen)

MESSAGES_HE: dict[str, str] = {
    "idle": "אין תוכנית פתיחה לדלת זו.",
    "written": "התוכנית נשלחה לאינטרקום וממתינה לאימות.",
    "verified": "התוכנית נכתבה לאינטרקום ואומתה.",
    "retry_wait": "הכתיבה לאינטרקום נכשלה. המערכת תנסה שוב בעוד מספר דקות.",
    "failed": "הכתיבה לאינטרקום נכשלה כמה פעמים. בדקו את החיבור לאינטרקום ולחצו \"כתיבה מחדש\".",
    "drift": "התוכנית בדלת שונתה מחוץ למערכת. בדקו בחלון האינטרקום ולחצו \"כתיבה מחדש\" כדי להחזיר את התוכנית של המערכת.",
    "foreign": "בדלת יש תוכנית שנוצרה בחלון האינטרקום. המערכת לא דורסת אותה.",
    "blocked": "הכתיבה לדלת ממתינה: הדלת מושהית, במצב חירום, או שחזרתה למצב רגיל טרם אושרה.",
    "invalid": "התוכנית שחושבה אינה תקינה ולא נשלחה. בדקו את חלונות הפתיחה של הדלת.",
    "prepared": "התוכנית מוכנה בלבד. יש להחיל אותה בחלון האינטרקום.",
}
DRIFT_HE: dict[str, str] = {
    "missing": "התוכנית נמחקה מהאינטרקום.",
    "disabled": "התוכנית הושהתה באינטרקום.",
    "changed": "שעות התוכנית באינטרקום שונו.",
    "foreign": "שם התוכנית באינטרקום שונה.",
}
CODE_HE: dict[str, str] = {
    "transport_not_selected": "אין כרגע חיבור פעיל לאינטרקום.",
    "device_unavailable": "עמדת האינטרקום אינה זמינה.",
    "device_busy": "עמדת האינטרקום עסוקה.",
    "revision_conflict": "התוכנית השתנתה בזמן הכתיבה.",
    "readback_mismatch": "האינטרקום לא החזיר את התוכנית שנכתבה.",
    "answer_lost": "לא התקבלה תשובה מהאינטרקום.",
}


def message_he(state: str | None, code: str | None = None, drift_kind: str | None = None) -> str:
    """One short sentence for the door's row. The code only selects an extra clause; it is never shown itself."""
    base = MESSAGES_HE.get(state or "idle", MESSAGES_HE["idle"])
    extra = ""
    if state == "drift" and drift_kind in DRIFT_HE:
        extra = DRIFT_HE[drift_kind]
    elif state in ("retry_wait", "failed") and code:
        extra = CODE_HE.get(code.split(":", 1)[-1], "")
    return f"{extra} {base}".strip() if extra else base
