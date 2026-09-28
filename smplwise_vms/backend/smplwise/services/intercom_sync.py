"""WisKey entry-center feed (CR-005 phase 1a): one long-lived Home Assistant WebSocket session that keeps a trimmed,
read-only copy of WisKey's `overview` and tells SMPLWISE's own browser clients when it changed.

Mirrors services/ha_sync.py: a background thread, a small state object (`connected`, `last_error`, `reconnects` ...),
subscriber queues fanned out under a lock, and `.start()` / `.shutdown()` wired from main.py.

Refresh sources, the same ones WisKey's own panel relies on (WISKEY_SOURCE_EXTRACTION.md, "Live update behaviour"):
- `hikvision_intercom/subscribe`: data-free `{"kind": "refresh"}` pushes -> refetch `overview`;
  `{"kind": "access_revoked"}` -> the add-on's HA user lost WisKey access; the copy is dropped.
- Home Assistant state pushes for the stations' own `online` / `ringing` / `call_status` entities
  (`subscribe_entities`), which is how WisKey's panel sees ringing without waiting for a poll.
- a 30 s poll, only while someone is looking (WisKey's panel polls `overview` every 30 s while its tab is open and
  visible, panel.ts:492-497): a browser client holds the change-notice socket open, or GET /intercom/overview was asked
  within the last two poll intervals. Every `overview` reply carries WisKey's whole user directory, so nobody watching
  means no polling; the two push sources above keep running regardless.
Refetches are single-flight with coalescing (WisKey's `refresh()` / `_refreshAgain`).

Home Assistant answers WebSocket commands while integrations are still being set up, and WisKey registers its commands
only after its access and event managers are up (`__init__.py:23-45`, WISKEY_SOURCE_EXTRACTION.md 0.1). So an
`unknown_command` reply right after an HA restart is not proof WisKey is absent: the feed asks HA's `get_config` and
concludes `not_installed` only when HA itself is RUNNING (and, after a session that was ready, only after
`ABSENT_AFTER_READY` consecutive probes); until then it stays `connecting` on the normal short backoff and keeps
serving the last-known copy as not fresh.

Honest state: without Home Assistant access, without the WisKey integration, or when WisKey refuses the add-on's user,
the state says so and no station data is served. Only the projection below is ever kept in memory - WisKey's people
list (cards, PIN flags, phones) is dropped the moment the reply arrives; that belongs to a later, separately gated
screen.

One-off reads (phase 1b: `events/list`, `users/query`, `users/get`) go through `IntercomSync.command`: the request
thread schedules the command on this feed's own event loop and it is sent over the SAME live session (`self._call`),
never over a new Home Assistant connection. It runs only while the feed is `ready`; otherwise the reply carries the
feed's own state (`ha_not_configured`, `connecting`, `ha_unavailable`, `not_installed`, `forbidden`, `error`) and no
data. Nothing from these replies is cached, and only their projections below are returned.

Physical actions (CR-005 phase 3: door release, call signal, TTS announcement) take the same road - `IntercomSync.action`
shares `command`'s session, in-flight slots and rate buckets - but anything short of success is raised as an ApiError
that says whether the command was not sent, refused, or sent without an answer (`action_error`). They are never queued
or retried. A TTS announcement is a WisKey subscription: its progress is followed here and relayed to browser clients as
`intercom_tts` notices."""
from __future__ import annotations

import asyncio
import datetime
import logging
import queue
import re
import threading
import time
from collections import deque
from typing import Any, Awaitable, Callable

from ..config import Settings
from ..db import now_iso
from ..errors import ApiError
from . import ha_client, intercom_client
from .intercom_client import IntercomError

log = logging.getLogger("smplwise.intercom")

POLL_S = 30.0
VIEW_WINDOW_S = 2 * POLL_S  # a GET within this window counts as someone looking (a socket-less client GETs every 30 s)
RETRY_S = 5.0  # reconnect backoff: 5 s doubling to RETRY_MAX_S
RETRY_MAX_S = 60.0
RETRY_ABSENT_S = 300.0  # WisKey missing or refusing us: re-probe every five minutes, not every few seconds
ABSENT_AFTER_READY = 3  # after a ready session, `unknown_command` with HA RUNNING must repeat this often to mean "removed"
LOADING = "wiskey_loading"  # IntercomError code: HA does not know WisKey's commands yet, but may still be loading it
STATION_WATCH_KEYS = ("online", "ringing", "call_status")
SERVED_STATES = ("ready", "ha_unavailable", "connecting", "error")  # the states in which the last-known copy is served
# a camera entity id as Home Assistant spells it (lower-case, digits, underscores). It comes from WisKey's `overview`,
# which is untrusted input, and is meant to name a media source later, so anything else is not kept.
CAMERA_ENTITY = re.compile(r"camera\.[a-z0-9_]{1,200}")
LAST_ACCESS_KEYS = ("timestamp", "time_source", "person_name", "employee_no", "authentication", "result", "event_type", "recovered", "door")
# one events/list row as the activity screen shows it: the overview's last-access fields plus the row's identity and
# arrival time. Not kept: `card` (masked last-4), `portrait`, `evidence`, `major` / `minor`, `api_door`, `source`.
EVENT_KEYS = ("id", "station_id", "timestamp", "received_at", *LAST_ACCESS_KEYS[1:])
# one person as the read-only people screens show them. Not kept: `phone`, `cards`, `pin_configured`, `profile`,
# `photo_configured`, `permission_overrides`, `access_timing_*`, `timing_readbacks`, `identity_locked`, `user_type`,
# `sync_reference`, `created_at` / `updated_at`, and each assignment's `last_error` / revisions.
PERSON_KEYS = ("id", "employee_no", "display_name")
PEOPLE_PAGE_KEYS = ("total", "total_all", "offset", "limit", "next_offset", "previous_offset")
COMMAND_TIMEOUT_S = 25.0  # a one-off read waits this long for WisKey (`ha_client`'s own per-call limit is 60 s)
# WisKey's AdminLimiter allows 8 concurrent handlers per HA user, and the feed's own overview refetch shares that user:
# one-off reads from browsers are kept to half of it. A slot stays taken until WisKey actually answered (or
# `ha_client` gave up on the call), not merely until the browser request timed out.
MAX_INFLIGHT = 4
# WisKey's AdminLimiter is also a token bucket per HA user (burst 30, refill 2/s) shared with the feed's own overview
# refetch. One-off reads spend local tokens first and are refused here, without calling WisKey, once they run out:
# per SMPLWISE user (fairness) and in total (kept well under WisKey's own refill, so the feed always has headroom).
USER_BURST, USER_RATE = 10.0, 1.0
GLOBAL_BURST, GLOBAL_RATE = 20.0, 1.5
# physical actions have a lane of their own, so read traffic (a people search spends up to MAX_SCAN_PAGES tokens) can
# never leave a release or a hang-up `busy` / `rate_limited` (T054 review S5): their own in-flight slots and buckets.
# Totals stay under WisKey's AdminLimiter (8 handlers, burst 30, refill 2/s per HA user) with room for the feed:
# slots 4 + 2 (+ the feed's own overview / subscribe calls), bursts 20 + 8, refills 1.5 + 0.5 per second - at the very
# worst WisKey then answers the feed's own refetch `rate_limited`, which the feed already retries without dropping the
# session. Per user: a guard desk's answer, announcement, release, hang up and the next call's answer all fit the burst.
ACTION_INFLIGHT = 2
ACTION_USER_BURST, ACTION_USER_RATE = 6.0, 0.5
ACTION_GLOBAL_BURST, ACTION_GLOBAL_RATE = 8.0, 0.5
RATE_LIMITED = "rate_limited"
RATE_RETRY_S = 2.0  # the feed's own refetch answered `rate_limited`: keep the session and try again after this long
DEFER_RETRY_S = 5.0  # a refetch failure deferred during an announcement (S6) is retried this often
# people text search runs here, not in WisKey (D1, see search_people): the filtered directory is scanned in pages of
# SCAN_PAGE, at most MAX_SCAN_PAGES per request (2 000 people; a WisKey station holds a few hundred), every page after
# the first spending one more rate token
SCAN_PAGE = 200
MAX_SCAN_PAGES = 10
# a physical action (release / call signal / TTS start) waits longer than a read: WisKey's own panel gives
# `stations/test_unlock` 30 s and `media/signal` 40 s (a 15 s device budget plus up to 5 s of call-state observation)
ACTION_TIMEOUT_S = 35.0
# the keys of WisKey's answers that SMPLWISE serves back for the physical actions
SIGNAL_KEYS = ("command", "acknowledged", "physical_result", "before_state", "observed_state", "observation", "checked_at")
TTS_TERMINAL = ("completed", "closed")
# request-level refusals are the caller's to fix, not a degraded feed: (HTTP status, SMPLWISE code, message)
REQUEST_ERRORS = {
    "user_not_found": (404, "intercom_person_not_found", "האדם לא נמצא ב־WisKey."),
    "invalid_fields": (422, "intercom_invalid_request", "WisKey דחה את פרמטרי הבקשה."),
}


class TokenBucket:
    """A plain token bucket (`burst` tokens, refilled at `rate` per second); callers hold `_bucket_lock`."""

    def __init__(self, burst: float, rate: float) -> None:
        self.burst, self.rate = burst, rate
        self.tokens = burst
        self.at = time.monotonic()

    def ready(self) -> bool:
        now = time.monotonic()
        self.tokens = min(self.burst, self.tokens + (now - self.at) * self.rate)
        self.at = now
        return self.tokens >= 1.0

    def take(self) -> None:
        self.tokens -= 1.0


class _NotReady(Exception):
    """The session the request thread saw had already ended when the command reached the feed's loop."""


class _Expired(Exception):
    """A physical action reached the feed's loop after its `not_after`: it is not sent."""

# ha_not_configured | idle | connecting | ha_unavailable | not_installed | forbidden | error | ready
STATES = ("ha_not_configured", "idle", "connecting", "ha_unavailable", "not_installed", "forbidden", "error", "ready")


class IntercomState:
    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.state = "idle"
        self.connected = False
        self.last_error: str | None = None
        self.reconnects = 0
        self.started_at: str | None = None
        self.fetched_at: str | None = None
        self.refreshes = 0
        self.sequence = 0
        self.wiskey_version: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {k: getattr(self, k) for k in ("state", "connected", "last_error", "reconnects", "started_at", "fetched_at", "refreshes", "sequence", "wiskey_version")}


STATE = IntercomState()
_subscribers: list[queue.Queue] = []
_sub_lock = threading.Lock()


def subscribe() -> queue.Queue:
    q: queue.Queue = queue.Queue(maxsize=100)
    with _sub_lock:
        _subscribers.append(q)
    return q


def unsubscribe(q: queue.Queue) -> None:
    with _sub_lock:
        if q in _subscribers:
            _subscribers.remove(q)


def publish(msg: dict[str, Any]) -> None:
    with _sub_lock:
        subs = list(_subscribers)
    for q in subs:
        try:
            q.put_nowait(msg)
        except queue.Full:
            pass


# ---------------------------------------------------------------- projection

def _int(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _station(raw: dict[str, Any]) -> dict[str, Any]:
    entities = raw.get("entities") if isinstance(raw.get("entities"), dict) else {}
    clock = raw.get("clock") if isinstance(raw.get("clock"), dict) else {}
    last = raw.get("last_access") if isinstance(raw.get("last_access"), dict) else None
    locks = raw.get("integrated_locks") if isinstance(raw.get("integrated_locks"), list) else []
    return {
        "id": str(raw.get("id") or ""),
        "name": str(raw.get("name") or ""),
        "online": bool(raw.get("online")),
        "call_state": str(raw.get("call_state") or "unknown"),
        "sync_state": str(raw.get("sync_state") or "unknown"),
        "lock_enabled": bool(raw.get("lock_enabled")),
        "lock_count": len(locks),
        # the relays a release may name (`stations/test_unlock` `lock` = physical_index); WisKey's `api_id` stays behind
        "locks": [
            {"physical_index": lock["physical_index"], "name": lock.get("name") if isinstance(lock.get("name"), str) else None}
            for lock in locks
            if isinstance(lock, dict) and _int(lock.get("physical_index")) is not None
        ],
        "has_camera": bool(entities.get("camera")),
        # the station camera's HA entity id (WisKey's panel hands `station.entities.camera` to its camera player). An HA
        # entity id names a camera; it carries nothing about a person or the device (host, model, firmware stay behind,
        # as do the station's other entity ids). Kept only when it is a well-formed camera id.
        "camera_entity": camera if isinstance(camera := entities.get("camera"), str) and CAMERA_ENTITY.fullmatch(camera) else None,
        "last_error": raw.get("last_error") if isinstance(raw.get("last_error"), str) else None,
        "last_seen": raw.get("last_seen") if isinstance(raw.get("last_seen"), str) else None,
        "pending_user_count": _int(raw.get("pending_user_count")) or 0,
        "managed_user_count": _int(raw.get("managed_user_count")),
        # the station clock's display zone (WisKey formats a station's last access in it, panel.ts zone())
        "zone": clock.get("zone") if isinstance(clock.get("zone"), dict) else None,
        "last_access": {k: last.get(k) for k in LAST_ACCESS_KEYS} if last else None,
    }


def project_overview(raw: dict[str, Any]) -> dict[str, Any]:
    """What SMPLWISE keeps and serves from WisKey's `overview`: the stations as the entry center shows them, counts,
    and the display zone. Not kept: people, cards, PIN flags, tombstones / revocations, host / model / firmware."""
    stations = [_station(s) for s in raw.get("stations") or [] if isinstance(s, dict)]
    api = raw.get("api") if isinstance(raw.get("api"), dict) else {}
    users = raw.get("users")
    user_count = _int(raw.get("user_count"))
    return {
        "version": raw.get("version") if isinstance(raw.get("version"), str) else None,
        "api_version": _int(api.get("version")),
        "default_zone": raw.get("default_zone") if isinstance(raw.get("default_zone"), dict) else None,
        "user_count": user_count if user_count is not None else (len(users) if isinstance(users, list) else 0),
        "stations": stations,
    }


def watched_entities(raw: dict[str, Any]) -> set[str]:
    out: set[str] = set()
    for s in raw.get("stations") or []:
        entities = s.get("entities") if isinstance(s, dict) and isinstance(s.get("entities"), dict) else {}
        out.update(str(entities[k]) for k in STATION_WATCH_KEYS if entities.get(k))
    return out


def _str(value: Any) -> str | None:
    return value if isinstance(value, str) else None


def project_event_page(raw: dict[str, Any]) -> dict[str, Any]:
    """What SMPLWISE serves from one `events/list` page: the rows (EVENT_KEYS only), the cursor, the cache bounds, and
    each station's stream / history status (so the screen can say "history incomplete")."""
    records = [{k: r.get(k) for k in EVENT_KEYS} for r in raw.get("records") or [] if isinstance(r, dict)]
    stations = raw.get("stations") if isinstance(raw.get("stations"), dict) else {}
    return {
        "records": records,
        "next": _str(raw.get("next")),
        "retention_days": _int(raw.get("retention_days")),
        "capacity": _int(raw.get("capacity")),
        "membership_basis": _str(raw.get("membership_basis")),
        "storage_failed": bool(raw.get("storage_failed")),
        "stations": {str(sid): {"stream": _str(st.get("stream")), "history": _str(st.get("history"))} for sid, st in stations.items() if isinstance(st, dict)},
    }


def project_person(raw: dict[str, Any]) -> dict[str, Any]:
    """One WisKey person as the read-only people screens show them: identity, status, validity window, groups, and which
    stations they are assigned to (with WisKey's sync state and door numbers). Never phones, cards, PIN flags, profile
    values or photos - the editing phase adds what it needs deliberately."""
    assignments = raw.get("assignments") if isinstance(raw.get("assignments"), dict) else {}
    groups = raw.get("group_ids") if isinstance(raw.get("group_ids"), list) else []
    return {
        **{k: str(raw.get(k) or "") for k in PERSON_KEYS},
        "active": bool(raw.get("active")),
        "valid_from": _str(raw.get("valid_from")),
        "valid_until": _str(raw.get("valid_until")),
        "revision": _int(raw.get("revision")),
        "group_ids": [g for g in groups if isinstance(g, str)],
        "stations": [
            {
                "station_id": str(sid),
                "enabled": bool(a.get("enabled")),
                "doors": sorted(d for d in a.get("allowed_locks") or [] if _int(d) is not None),
                "sync_state": _str(a.get("sync_state")),
            }
            for sid, a in sorted(assignments.items())
            if isinstance(a, dict)
        ],
    }


def project_people_page(raw: dict[str, Any]) -> dict[str, Any]:
    """One `users/query` page without a search text: projected people plus WisKey's paging bookkeeping (`snapshot` /
    `stale` included, so the next page request can pass the snapshot back). Always complete."""
    return {
        "records": [project_person(r) for r in raw.get("records") or [] if isinstance(r, dict)],
        **{k: _int(raw.get(k)) for k in PEOPLE_PAGE_KEYS},
        "snapshot": _str(raw.get("snapshot")) or "",
        "stale": bool(raw.get("stale")),
        "complete": True,
        "incomplete_reason": None,
    }


def project_release(raw: Any) -> dict[str, Any]:
    """`stations/test_unlock`'s answer: WisKey ACCEPTED the command. It never says the door moved. WisKey's documented
    answer is `{accepted: true}`; anything else after `success: true` raises, which the action path reports as
    "outcome unknown" (the command may well have been carried out), never as refused."""
    if not isinstance(raw, dict) or raw.get("accepted") is not True:
        raise ValueError("unexpected stations/test_unlock answer")
    return {"accepted": True}


def project_signal(raw: Any) -> dict[str, Any]:
    """`media/signal`'s CallResult as WisKey sends it (acknowledgement, observed call state, `physical_result`). A
    non-object answer raises: "outcome unknown"."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected media/signal answer")
    return {k: raw.get(k) for k in SIGNAL_KEYS}


def project_tts_engines(raw: dict[str, Any]) -> dict[str, Any]:
    engines = raw.get("engines") if isinstance(raw.get("engines"), list) else []
    return {
        "default": _str(raw.get("default")),
        "engines": [
            {
                "engine_id": str(e["engine_id"]),
                "name": str(e.get("name") or e["engine_id"]),
                "supported_languages": [lang for lang in e.get("supported_languages") or [] if isinstance(lang, str)],
                "default_language": _str(e.get("default_language")),
            }
            for e in engines
            if isinstance(e, dict) and isinstance(e.get("engine_id"), str) and e["engine_id"]
        ],
    }


# why a physical action was not sent, in the feed's own words (the read endpoints show the same states as panels)
NOT_SENT_REASONS = {
    "ha_not_configured": "ל־SMPLWISE אין גישה ל־Home Assistant בסביבה הזו",
    "connecting": "החיבור ל־WisKey עדיין נפתח",
    "ha_unavailable": "Home Assistant אינו זמין כרגע",
    "not_installed": "אינטגרציית WisKey אינה מותקנת ב־Home Assistant",
    "forbidden": "WisKey דחה את הגישה של SMPLWISE",
    "error": "WisKey החזיר שגיאה",
}


def action_error(reply: dict[str, Any], outcome: str) -> ApiError:
    """A physical action that did not complete is an HTTP error, never a 200 with a state field: the caller must not be
    able to read it as done. `details.outcome` says what is known: `not_sent` (nothing reached WisKey - safe to try
    again), `refused` (WisKey answered with an error code), `unknown` (sent, but no answer arrived - it may or may not
    have happened, so it must not be retried blindly)."""
    state, code = reply.get("state"), reply.get("last_error")
    details = {"outcome": outcome, "state": state, "wiskey_code": code}
    if outcome == "not_sent":
        if code == "expired":  # the code routers/ha.py uses for an expired HA action
            return ApiError(409, "expired", "הבקשה פגה לפני שנשלחה ל־WisKey, ולכן לא נשלחה. אם עדיין צריך - בצעו אותה שוב.", details=details)
        if code == RATE_LIMITED:
            return ApiError(429, "intercom_rate_limited", "יותר מדי פקודות ל־WisKey בזמן קצר. הפקודה לא נשלחה - נסו שוב בעוד כמה שניות.", retryable=True, details=details)
        if code == "busy":
            return ApiError(429, "intercom_busy", "WisKey עסוק בבקשות אחרות. הפקודה לא נשלחה - נסו שוב בעוד רגע.", retryable=True, details=details)
        reason = NOT_SENT_REASONS.get(str(state), "WisKey אינו זמין")
        return ApiError(503, "intercom_unavailable", f"הפקודה לא נשלחה: {reason}.", details=details)
    if outcome == "unknown":
        if code in ("timeout", "invalid_response") or state == "ha_unavailable":
            said = "הפקודה נשלחה אך לא התקבלה מ־WisKey תשובה ברורה"
        else:  # WisKey answered with a failure that can come after the command reached the device (release_unconfirmed ...)
            said = f"WisKey לא אישר שהפקודה בוצעה ({code})"
        return ApiError(504, "intercom_outcome_unknown", f"{said}. ייתכן שבוצעה וייתכן שלא - בדקו במצלמה או במקום לפני שמנסים שוב.", details=details)
    if code == RATE_LIMITED:
        return ApiError(429, "intercom_rate_limited", "WisKey הגביל את קצב הפקודות ודחה את הפקודה. היא לא בוצעה - נסו שוב בעוד כמה שניות.", retryable=True, details=details)
    if code == "invalid_fields":
        return ApiError(422, "intercom_invalid_request", "WisKey דחה את פרמטרי הפקודה, והיא לא בוצעה.", details=details)
    return ApiError(502, "intercom_action_refused", f"WisKey דחה את הפקודה ({code}). לפי WisKey היא לא בוצעה.", details=details)


def person_matches(person: dict[str, Any], needle: str) -> bool:
    """SMPLWISE's people text search: a case-insensitive substring of the PROJECTED person's display name and employee
    number. It is given the projection, so a phone number or card digits can never be what matched."""
    return needle in f"{person['display_name']} {person['employee_no']}".casefold()


async def search_people(
    call: intercom_client.Call,
    needle: str,
    filters: dict[str, Any],
    offset: int,
    limit: int,
    snapshot: str | None,
    spend: Callable[[], bool],
) -> dict[str, Any]:
    """Text search without handing WisKey the text (D1). WisKey's own search also matches phone digits and card last-4,
    so SMPLWISE asks WisKey for the filtered directory with an EMPTY query, page by page in WisKey's own order (its
    `sort`), projects every record and keeps those that match `needle` (already casefolded) by name / employee number.

    Paging is over SMPLWISE's match list, not WisKey's: `total` is the number of matches, `offset` / `next_offset` /
    `previous_offset` index into the matches (an offset past the end is clamped to the last page, as WisKey does), and
    `total_all` stays WisKey's directory size (it does not depend on the text). The whole filtered directory is scanned
    so that `total` is exact; a scan stopped by MAX_SCAN_PAGES or by an empty rate bucket (`spend()` refused the next
    page) is returned as it stands with `complete: false` and `incomplete_reason` `scan_limit` / `rate_limited`, and
    `total` is then a lower bound ("narrow the search"). `snapshot` is WisKey's value from the first page; `stale` says
    the caller's snapshot is out of date or the directory changed during the scan."""
    matches: list[dict[str, Any]] = []
    seen: set[str] = set()  # a directory change mid-scan can shift a person onto the next page as well
    wk_offset, pages = 0, 0
    current = ""
    total_all: int | None = None
    stale = False
    reason: str | None = None
    while True:
        if pages >= MAX_SCAN_PAGES:
            reason = "scan_limit"
            break
        if pages and not spend():  # the first page was paid for by command()
            reason = RATE_LIMITED
            break
        raw = await intercom_client.users_query(call, filters, wk_offset, SCAN_PAGE, current)
        pages += 1
        if pages == 1:
            current = _str(raw.get("snapshot")) or ""
            total_all = _int(raw.get("total_all"))
        elif raw.get("stale"):
            stale = True  # someone changed the directory while it was being scanned
        records = raw.get("records")
        if records is None:
            records = []
        if not isinstance(records, list):
            raise IntercomError("invalid_response", "users/query")
        try:
            for record in records:
                if not isinstance(record, dict):
                    continue
                person = project_person(record)
                if person["id"] in seen:
                    continue
                seen.add(person["id"])
                if person_matches(person, needle):
                    matches.append(person)
        except Exception as exc:  # noqa: BLE001 - a malformed record is WisKey's error, not a lost connection
            raise IntercomError("invalid_response", "users/query") from exc
        following = _int(raw.get("next_offset"))
        if following is None or following <= wk_offset:
            break
        wk_offset = following
    total = len(matches)
    if offset >= total:
        offset = ((total - 1) // limit) * limit if total else 0
    end = offset + limit
    return {
        "records": matches[offset:end],
        "total": total,
        "total_all": total_all,
        "offset": offset,
        "limit": limit,
        "next_offset": end if end < total else None,
        "previous_offset": max(0, offset - limit) if offset > 0 else None,
        "snapshot": current,
        "stale": stale or bool(snapshot and snapshot != current),
        "complete": reason is None,
        "incomplete_reason": reason,
    }


# ---------------------------------------------------------------- the session

class IntercomSync:
    def __init__(self) -> None:
        self.thread: threading.Thread | None = None
        self.stop = threading.Event()
        self.settings: Settings | None = None
        self._cache: dict[str, Any] | None = None
        # station id -> the station's host from the same `overview` reply. NEVER served: it only builds the station's
        # RTSP source for go2rtc (camera stills), server-side. Kept and dropped together with the copy.
        self._hosts: dict[str, str] = {}
        self._cache_lock = threading.Lock()
        self._logged_error: str | None = None
        self._was_ready = False  # a session reached `ready` since the process (or reset()) started
        self._absent_strikes = 0  # consecutive `unknown_command` probes with HA RUNNING, after a ready session
        self._last_view: float | None = None  # monotonic time of the last GET /intercom/overview
        self._fetched_mono: float | None = None
        self._event_loop: asyncio.AbstractEventLoop | None = None
        self._tasks: set[asyncio.Task[None]] = set()  # refreshes started by pushes (_kick); cancelled with the session
        self._inflight = threading.BoundedSemaphore(MAX_INFLIGHT)  # one-off reads (command) in flight at once
        self._action_inflight = threading.BoundedSemaphore(ACTION_INFLIGHT)  # physical actions: a lane of their own
        self._bucket_lock = threading.Lock()
        self._tts_status: dict[str, dict[str, Any]] = {}  # station id -> its latest announcement's progress
        self._buckets_reset()
        self._session_reset()

    def _buckets_reset(self) -> None:
        with self._bucket_lock:
            self._global_bucket = TokenBucket(GLOBAL_BURST, GLOBAL_RATE)
            self._user_buckets: dict[str, TokenBucket] = {}
            self._action_global_bucket = TokenBucket(ACTION_GLOBAL_BURST, ACTION_GLOBAL_RATE)
            self._action_user_buckets: dict[str, TokenBucket] = {}

    def _spend_token(self, who: str, lane: str = "read") -> bool:
        """One token from both the caller's and the shared bucket of `lane` (`read` or `action`), or none at all
        (nothing is spent on a refusal)."""
        with self._bucket_lock:
            if lane == "action":
                users, shared, burst, rate = self._action_user_buckets, self._action_global_bucket, ACTION_USER_BURST, ACTION_USER_RATE
            else:
                users, shared, burst, rate = self._user_buckets, self._global_bucket, USER_BURST, USER_RATE
            mine = users.get(who)
            if mine is None:
                mine = users[who] = TokenBucket(burst, rate)
            if not (mine.ready() and shared.ready()):
                return False
            mine.take()
            shared.take()
            return True

    def _session_reset(self) -> None:
        self._call: intercom_client.Call | None = None
        self._wiskey_sub: int | None = None
        self._entities_sub: int | None = None
        # event frames whose subscription id is not known yet: HA sends a subscription's first event right behind
        # its result, and the socket reader can get to it before the awaiting coroutine has recorded the id
        self._early: deque[dict[str, Any]] = deque(maxlen=20)
        self._watched: set[str] = set()
        self._refreshing = False
        self._again = False
        # announcements in progress on this session: `tts/start` subscription id -> station id. Kept until WisKey's
        # terminal event, because unsubscribing earlier would cancel the playback
        self._tts: dict[int, str] = {}
        self._retry_pending = False  # a refetch after WisKey's `rate_limited` is scheduled (at most one)
        self._rate_logged = False  # that stretch was logged (once, not every retry)
        self._deferred: str | None = None  # an overview failure kept pending while an announcement plays (S6)
        self._end: asyncio.Event | None = None
        self._fault: BaseException | None = None

    # -- lifecycle (main.py)
    def start(self, settings: Settings) -> None:
        self.settings = settings
        if not ha_client.configured(settings):
            STATE.state = "ha_not_configured"
            STATE.last_error = "ha_not_configured"
            return
        STATE.state = "connecting"
        STATE.started_at = now_iso()
        self.stop.clear()
        self.thread = threading.Thread(target=self._run, name="intercom-sync", daemon=True)
        self.thread.start()

    def shutdown(self) -> None:
        self.stop.set()

    def reset(self) -> None:
        """Forget the cached copy and the counters (a fresh process state; used by tests)."""
        self._drop()
        self._logged_error = None
        self._was_ready = False
        self._absent_strikes = 0
        self._last_view = None
        self._fetched_mono = None
        self._inflight = threading.BoundedSemaphore(MAX_INFLIGHT)
        self._action_inflight = threading.BoundedSemaphore(ACTION_INFLIGHT)
        self._tts_status = {}
        self._buckets_reset()
        self._session_reset()
        STATE.reset()

    # -- what the router serves
    def served(self, settings: Settings) -> tuple[str, dict[str, Any] | None]:
        """The feed state and the overview copy exactly as GET /intercom/overview would serve them (None whenever
        there is nothing honest to show). Unlike `snapshot`, this does not count as someone looking: a camera still
        refreshing on its own must not keep WisKey's overview polling alive."""
        configured = ha_client.configured(settings)
        state = STATE.state if configured else "ha_not_configured"
        if configured and state == "idle":
            state = "connecting"
        with self._cache_lock:
            cached = self._cache
        return state, cached if state in SERVED_STATES else None

    def station_host(self, settings: Settings, station_id: str) -> str | None:
        """The station's host as WisKey reported it with the served copy (server-side only), or None: no served copy,
        or WisKey sent none (it strips `host` for a user without its `stations` area)."""
        if self.served(settings)[1] is None:
            return None
        with self._cache_lock:
            return self._hosts.get(station_id)

    def snapshot(self, settings: Settings) -> dict[str, Any]:
        configured = ha_client.configured(settings)
        self._viewed()
        state, overview = self.served(settings)
        return {
            "state": state,
            "configured": configured,
            # a copy from before a disconnect is served as last-known, never as current
            "fresh": state == "ready" and overview is not None and self._deferred is None,
            "fetched_at": STATE.fetched_at if overview is not None else None,
            "last_error": STATE.last_error if configured else "ha_not_configured",
            "overview": overview,
            "sync": STATE.as_dict(),
            # the server's clock (epoch ms): the UI derives its physical commands' `expires_at` from it, not from the
            # device's own clock, which may be minutes off (T054 final review S-3)
            "server_time_ms": int(time.time() * 1000),
        }

    def command(
        self,
        settings: Settings,
        key: str,
        send: Callable[[intercom_client.Call], Awaitable[dict[str, Any]]],
        project: Callable[[dict[str, Any]], dict[str, Any]],
        who: str = "",
    ) -> dict[str, Any]:
        """Run one read-only WisKey command over the feed's live session and serve its projection under `key`:
        `{state, configured, last_error, fetched_at, <key>, sync}`. `<key>` is null whenever the command did not run or
        did not succeed; `state` is the feed's own state, or for this request only `forbidden` (WisKey refuses the
        add-on's user this command), `unsupported` (this WisKey has no such command), `error` (another WisKey error;
        `rate_limited` from SMPLWISE's own buckets or WisKey's; `busy` when MAX_INFLIGHT reads are already out;
        `timeout`; `invalid_response`) or `ha_unavailable` (the session went away mid-request; `last_error` is the
        exception name, or `session_ended` when the session was already gone before the command could be sent). A
        request-level refusal (REQUEST_ERRORS) raises an ApiError instead. `who` keys the caller's own rate bucket (the SMPLWISE user id).

        Never blocks a worker thread on anything but the WisKey call itself: no rate token or no free slot is answered
        at once. The feed's state machine is never changed from here: the session's own overview refetch and reconnect
        loop remain the only judges of the connection."""
        return self._execute(settings, key, send, project, who, COMMAND_TIMEOUT_S)[0]

    def action(
        self,
        settings: Settings,
        key: str,
        send: Callable[[intercom_client.Call], Awaitable[Any]],
        project: Callable[[Any], dict[str, Any]],
        who: str,
        not_after: datetime.datetime | None = None,
        on_settled: Callable[[], None] | None = None,
    ) -> dict[str, Any]:
        """Run one PHYSICAL WisKey command (release, call signal, TTS start) like `command` - over the feed's own live
        session, never queued, never retried - but in the action lane (its own in-flight slots and rate buckets, so
        reads cannot starve it), waiting up to ACTION_TIMEOUT_S, and turning every result other than success into an
        ApiError (`action_error`), so that a refused, dropped or unanswered physical command can never be read as done.

        `not_after` (aware UTC): checked on the feed's loop immediately before the frame is written; a command that
        reaches that point later is not sent (`expired`) - a request delayed in transit or in a queue never actuates
        late. `on_settled` is called exactly once, when the command is really over: at once when it was never
        scheduled, else when WisKey answered, the session ended, or ha_client's own call limit expired - which can be
        well after this method gave up waiting (ACTION_TIMEOUT_S). Returns the `command`-shaped reply on success."""
        reply, outcome = self._execute(settings, key, send, project, who, ACTION_TIMEOUT_S, lane="action", not_after=not_after, on_settled=on_settled)
        if outcome != "ok":
            raise action_error(reply, outcome)
        return reply

    def _execute(
        self,
        settings: Settings,
        key: str,
        send: Callable[[intercom_client.Call], Awaitable[Any]],
        project: Callable[[Any], dict[str, Any]],
        who: str,
        timeout: float,
        lane: str = "read",
        not_after: datetime.datetime | None = None,
        on_settled: Callable[[], None] | None = None,
    ) -> tuple[dict[str, Any], str]:
        """`command`'s body. Also returns what is known about the command itself: `not_sent` (nothing reached WisKey),
        `refused` (WisKey answered with an error: a genuine refusal), `unknown` (sent, but no usable answer: timeout,
        the session went away mid-request, or an answer after `success: true` of a shape the projection does not
        accept) or `ok`."""
        settled = on_settled or (lambda: None)
        configured = ha_client.configured(settings)
        state = STATE.state if configured else "ha_not_configured"
        if configured and state == "idle":
            state = "connecting"
        reply: dict[str, Any] = {"state": state, "configured": configured, "last_error": STATE.last_error if configured else "ha_not_configured", "fetched_at": None, key: None}
        loop = self._event_loop
        if state != "ready" or loop is None or self._call is None:
            reply["sync"] = STATE.as_dict()
            settled()
            return reply, "not_sent"
        slot = self._action_inflight if lane == "action" else self._inflight  # (reset() may swap in a new one)
        if not slot.acquire(blocking=False):  # checked first: a `busy` refusal costs the caller no rate token
            reply.update(state="error", last_error="busy", sync=STATE.as_dict())
            settled()
            return reply, "not_sent"
        if not self._spend_token(who, lane):
            slot.release()
            reply.update(state="error", last_error=RATE_LIMITED, sync=STATE.as_dict())
            settled()
            return reply, "not_sent"
        coro = self._one_off(send, not_after)
        try:
            future = asyncio.run_coroutine_threadsafe(coro, loop)
        except RuntimeError as exc:  # the session's loop closed between the check above and scheduling
            coro.close()
            slot.release()
            reply.update(state="ha_unavailable", last_error=type(exc).__name__, sync=STATE.as_dict())
            settled()
            return reply, "not_sent"

        # the slot is freed - and the caller told the command is over - when the call is really over (answer, session
        # end, or ha_client's own 60 s limit): a browser-side timeout does not stop WisKey's handler, so it must not
        # free anything early either
        def done(_f: Any) -> None:
            slot.release()
            settled()

        future.add_done_callback(done)
        raw: Any = None
        answered = False
        outcome = "unknown"
        try:
            raw = future.result(timeout=timeout)
            answered = True
        except TimeoutError:
            reply.update(state="error", last_error="timeout")
        except _NotReady:
            # report what the feed says now; "ready" without a live call is a session that just ended
            now = {"idle": "connecting", "ready": "ha_unavailable"}.get(STATE.state, STATE.state)
            reply.update(state=now, last_error=STATE.last_error if now == STATE.state else "session_ended")
            outcome = "not_sent"
        except _Expired:
            reply.update(state="error", last_error="expired")
            outcome = "not_sent"
        except intercom_client.UnclearAnswer as exc:
            reply.update(state="error", last_error=exc.code)  # outcome stays "unknown"
        except IntercomError as exc:
            if exc.code in REQUEST_ERRORS and lane != "action":
                status, code, message = REQUEST_ERRORS[exc.code]
                raise ApiError(status, code, message, details={"wiskey_code": exc.code}) from exc
            outcome = "refused"  # for an action, only a pre-device code gets here (intercom_client.PRE_DEVICE)
            if exc.code == "unauthorized":
                reply.update(state="forbidden", last_error=exc.code)
            elif exc.not_installed:
                reply.update(state="unsupported", last_error=exc.code)
            else:
                reply.update(state="error", last_error=exc.code)
        except Exception as exc:  # noqa: BLE001 - socket closed / session cancelled mid-request
            now = STATE.state
            if now in ("ready", "idle", "connecting"):  # the feed has not concluded anything yet: the socket went away
                reply.update(state="ha_unavailable", last_error=type(exc).__name__)
            else:
                reply.update(state=now, last_error=STATE.last_error)
        if answered:
            try:
                reply.update(state="ready", last_error=None, fetched_at=now_iso())
                reply[key] = project(raw)
                outcome = "ok"
            except Exception:  # noqa: BLE001 - a reply of an unexpected shape is WisKey's error, not a lost connection
                reply.update(state="error", last_error="invalid_response", fetched_at=None)
                reply[key] = None
        reply["sync"] = STATE.as_dict()
        return reply, outcome

    def people(self, settings: Settings, who: str, query: str, filters: dict[str, Any], offset: int, limit: int, snapshot: str | None) -> dict[str, Any]:
        """The people directory for `who`: without a text, one WisKey page as it is; with a text, SMPLWISE's own search
        (search_people), each scanned page after the first paid from the same rate buckets. Either way WisKey's
        `query` field is empty."""
        needle = query.strip().casefold()
        if not needle:
            return self.command(settings, "people", lambda call: intercom_client.users_query(call, filters, offset, limit, snapshot), project_people_page, who=who)
        return self.command(
            settings,
            "people",
            lambda call: search_people(call, needle, filters, offset, limit, snapshot, spend=lambda: self._spend_token(who)),
            lambda page: page,  # already projected, person by person, before matching
            who=who,
        )

    def station(self, station_id: str) -> dict[str, Any] | None:
        """One station from the served copy (None when there is no copy or no such station)."""
        with self._cache_lock:
            cached = self._cache
        for s in (cached or {}).get("stations", []):
            if s["id"] == station_id:
                return s
        return None

    def has_copy(self) -> bool:
        with self._cache_lock:
            return self._cache is not None

    def tts_status(self, station_id: str) -> dict[str, Any] | None:
        return self._tts_status.get(station_id)

    async def tts_start(self, call: intercom_client.Call, station_id: str, engine_id: str, language: str | None, message: str) -> dict[str, Any]:
        """The `send` of a TTS action, on the feed's loop: start the announcement and follow its subscription. The
        subscription's first event can reach the socket reader before this coroutine resumes; it is held in `_early`
        and replayed once the id is known (the same race `subscribe_entities` has)."""
        sub = await intercom_client.tts_start(call, station_id, engine_id, language, message)
        if self._call is not call:
            # WisKey took it, but the session ended before this resumed: HA dropped the subscription (and with it the
            # playback) together with the connection, and the session's own cleanup has already run
            self._tts_update(station_id, {"state": "closed", "reason": "connection_lost"})
            return dict(self._tts_status[station_id])
        self._tts[sub] = station_id
        self._tts_update(station_id, {"state": "started"})
        self._replay_early()
        return dict(self._tts_status[station_id])

    def _tts_update(self, station_id: str, fields: dict[str, Any]) -> None:
        status = {"station_id": station_id, "state": fields["state"], "reason": fields.get("reason"), "physical_result": fields.get("physical_result"), "at": now_iso()}
        self._tts_status[station_id] = status
        publish({"type": "intercom_tts", **status})

    def _on_tts(self, sub: int, event: dict[str, Any]) -> None:
        """One `tts/start` event: `generating` -> `speaking` -> `completed` {physical_result: "unverified"} | `closed`
        {reason}. After a terminal one the subscription is released, as WisKey's own panel does (tts-controls.ts:406-428)."""
        station_id = self._tts.get(sub)
        state = event.get("state")
        if station_id is None or state not in ("generating", "speaking", *TTS_TERMINAL):
            return
        self._tts_update(station_id, {"state": state, "reason": _str(event.get("reason")), "physical_result": _str(event.get("physical_result"))})
        if state in TTS_TERMINAL:
            del self._tts[sub]
            call = self._call
            if call is not None:
                task = asyncio.get_running_loop().create_task(self._release_subscription(call, sub), name="intercom-tts-unsubscribe")
                self._tasks.add(task)
                task.add_done_callback(self._tasks.discard)

    async def _release_subscription(self, call: intercom_client.Call, sub: int) -> None:
        try:
            await call("unsubscribe_events", subscription=sub)
        except Exception:  # noqa: BLE001 - the announcement is over either way; the session end drops it too
            pass

    async def _one_off(self, send: Callable[[intercom_client.Call], Awaitable[Any]], not_after: datetime.datetime | None = None) -> Any:
        """On the feed's loop: send over the session that is live NOW (it may have ended since the request thread
        looked), never a new connection - and, for a physical action, only while it has not expired."""
        call = self._call
        if call is None or STATE.state != "ready":
            raise _NotReady()
        # `>=`: Windows ticks the wall clock in ~15.6 ms steps, so "now" can EQUAL a deadline that has just passed
        if not_after is not None and datetime.datetime.now(datetime.timezone.utc) >= not_after:
            raise _Expired()
        return await send(call)

    def watched(self) -> bool:
        """Someone is looking at the entry center: a change-notice socket is open, or a GET arrived recently."""
        with _sub_lock:
            if _subscribers:
                return True
        seen = self._last_view
        return seen is not None and time.monotonic() - seen < VIEW_WINDOW_S

    def _viewed(self) -> None:
        """A GET arrived. After a stretch with nobody watching (no polling), the copy may be older than one poll:
        refetch now instead of on the next poll tick; the client hears `intercom_refresh` if anything changed."""
        idle = not self.watched()
        self._last_view = time.monotonic()
        loop, fetched = self._event_loop, self._fetched_mono
        # only a ready session: during on_ready's own probe / subscribe a second overview + subscribe_entities would race it
        ready = STATE.state == "ready" and self._call is not None
        if idle and ready and loop is not None and (fetched is None or time.monotonic() - fetched > POLL_S):
            try:
                loop.call_soon_threadsafe(self._kick)
            except RuntimeError:  # the session's loop is already closed
                pass

    def _store(self, raw: dict[str, Any]) -> bool:
        projected = project_overview(raw)
        hosts = {
            str(s.get("id") or ""): s["host"]
            for s in raw.get("stations") or []
            if isinstance(s, dict) and isinstance(s.get("host"), str) and s["host"]
        }
        with self._cache_lock:
            changed = projected != self._cache
            self._cache = projected
            self._hosts = hosts
        STATE.fetched_at = now_iso()
        self._fetched_mono = time.monotonic()
        STATE.refreshes += 1
        STATE.wiskey_version = projected["version"]
        if changed:
            STATE.sequence += 1
            publish({"type": "intercom_refresh", "sequence": STATE.sequence})
        return changed

    def _drop(self) -> None:
        with self._cache_lock:
            self._cache = None
            self._hosts = {}

    def _set_state(self, state: str, error: str | None) -> None:
        changed = state != STATE.state
        STATE.state, STATE.last_error = state, error
        if changed:
            publish({"type": "intercom_state", "state": state})

    # -- thread
    def _run(self) -> None:
        asyncio.run(self._loop())

    async def _loop(self) -> None:
        assert self.settings
        backoff = RETRY_S
        stop_evt = asyncio.Event()

        async def watch_stop() -> None:
            while not self.stop.is_set():
                await asyncio.sleep(1)
            stop_evt.set()

        asyncio.create_task(watch_stop())
        while not self.stop.is_set():
            delay = backoff
            short = False  # HA is answering but WisKey is still loading: retry soon, whatever the backoff had reached
            try:
                await self._session(stop_evt)
                backoff = RETRY_S
                if STATE.state == "ready":
                    self._set_state("ha_unavailable", "disconnected")
            except IntercomError as exc:
                if exc.code == LOADING:
                    # HA is (re)starting and WisKey is not loaded yet: keep the last-known copy (served as not fresh)
                    # and retry on the normal short backoff
                    self._set_state("connecting", LOADING)
                    delay, short = RETRY_S, True
                elif exc.not_installed or exc.code == "unauthorized":
                    self._drop()
                    self._set_state("not_installed" if exc.not_installed else "forbidden", exc.code)
                    delay = RETRY_ABSENT_S
                else:
                    self._set_state("error", exc.code)
                if STATE.last_error != self._logged_error:  # an absent integration is logged once, not every probe
                    log.warning("WisKey feed: %s (%s)", STATE.state, exc.code)
                    self._logged_error = STATE.last_error
            except Exception as exc:  # noqa: BLE001 - the loop must survive any socket failure
                if self.stop.is_set():
                    break
                code = exc.code if isinstance(exc, ApiError) else type(exc).__name__
                self._set_state("ha_unavailable", code)
                log.warning("WisKey feed disconnected: %s (retry in %.0fs)", code, delay)
            if STATE.connected:
                STATE.reconnects += 1
            STATE.connected = False
            try:
                await asyncio.wait_for(stop_evt.wait(), timeout=delay)
            except asyncio.TimeoutError:
                pass
            backoff = RETRY_S if short else min(RETRY_MAX_S, backoff * 2)
        STATE.connected = False

    async def _session(self, stop_evt: asyncio.Event) -> None:
        assert self.settings
        self._session_reset()
        end = asyncio.Event()
        self._end = end
        self._event_loop = asyncio.get_running_loop()
        poller: asyncio.Task[None] | None = None

        async def forward_stop() -> None:
            await stop_evt.wait()
            end.set()

        stopper = asyncio.create_task(forward_stop())

        async def on_ready(call: intercom_client.Call) -> None:
            nonlocal poller
            self._call = call
            try:
                raw = await intercom_client.overview(call)  # the probe: unknown_command = not loaded (yet?)
            except IntercomError as exc:
                if exc.not_installed and await self._maybe_loading(call):
                    raise IntercomError(LOADING, "overview") from exc
                raise
            self._absent_strikes = 0
            self._store(raw)
            await self._watch(call, watched_entities(raw))
            self._wiskey_sub = await intercom_client.subscribe(call)
            self._replay_early()
            STATE.connected = True
            self._was_ready = True
            self._set_state("ready", None)
            self._logged_error = None  # a later repeat of an earlier failure is logged again
            log.info("WisKey feed connected: %d stations, WisKey %s", len((self._cache or {}).get("stations", [])), STATE.wiskey_version)

            async def poll() -> None:
                while not end.is_set():
                    await asyncio.sleep(POLL_S)
                    if self.watched():
                        await self._refresh()

            poller = asyncio.create_task(poll(), name="intercom-poll")

        try:
            await ha_client.ws_session(self.settings, on_ready, lambda _data: None, end, on_message=self._on_message)
        finally:
            self._call = None
            # nothing of this session may outlive it: a stray refresh's own `finally` would otherwise run after the
            # next session reset and break its one-refresh-at-a-time invariant
            tasks = [t for t in (stopper, poller, *self._tasks) if t is not None and not t.done()]
            for t in tasks:
                t.cancel()
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
            self._tasks.clear()
            # Home Assistant drops a connection's subscriptions with it, which cancels any announcement still playing
            for station_id in set(self._tts.values()):
                self._tts_update(station_id, {"state": "closed", "reason": "connection_lost"})
            self._tts.clear()
        if self._fault is not None:
            raise self._fault

    async def _maybe_loading(self, call: intercom_client.Call) -> bool:
        """`unknown_command` for WisKey's `overview`: True while that may only mean "not loaded yet" (see the module
        docstring), False once it means "not installed"."""
        # a socket failure here propagates: the session ends as ha_unavailable (the connection is gone), not as loading
        frame = await call("get_config")
        result = frame.get("result") if frame.get("success") else None
        running = isinstance(result, dict) and result.get("state") == "RUNNING"
        if not running:
            return True
        # HA's bootstrap can reach RUNNING past a slow integration's setup: after a ready session, re-probe a few times
        if self._was_ready:
            self._absent_strikes += 1
            return self._absent_strikes < ABSENT_AFTER_READY
        return False

    def _replay_early(self) -> None:
        early = list(self._early)
        self._early.clear()
        for msg in early:
            self._on_message(msg)

    def _on_message(self, msg: dict[str, Any]) -> None:
        mid = msg.get("id")
        event = msg.get("event") if isinstance(msg.get("event"), dict) else {}
        if mid is not None and mid in self._tts:
            self._on_tts(mid, event)
            return
        if mid is None or mid not in (self._wiskey_sub, self._entities_sub):
            self._early.append(msg)
            return
        if mid == self._wiskey_sub:
            kind = event.get("kind")
            if kind == "refresh":
                self._kick()
            elif kind == "access_revoked":
                self._fail(IntercomError("unauthorized", "subscribe"))
        elif mid == self._entities_sub:
            # subscribe_entities also opens with the current states; that costs one coalesced refetch, and clients
            # are only told when the projection actually changed
            self._kick()

    def _kick(self) -> None:
        task = asyncio.get_running_loop().create_task(self._refresh(), name="intercom-refresh")
        self._tasks.add(task)  # a strong reference (an unreferenced task can be collected mid-run) ...
        task.add_done_callback(self._tasks.discard)  # ... dropped once it is done

    def _fail(self, exc: BaseException) -> None:
        self._fault = exc
        if self._end is not None:
            self._end.set()

    async def _refresh(self) -> None:
        """Single-flight overview refetch; a request that arrives meanwhile runs once more afterwards."""
        call = self._call
        if call is None:
            return
        if self._refreshing:
            self._again = True
            return
        self._refreshing = True
        try:
            while True:
                self._again = False
                raw = await intercom_client.overview(call)
                self._store(raw)
                self._deferred = None  # a deferred failure (S6) is over: the copy is current again
                self._rate_logged = False  # a later rate-limited stretch is logged again
                await self._watch(call, watched_entities(raw))
                if not self._again:
                    break
        except asyncio.CancelledError:
            raise
        except IntercomError as exc:
            if exc.code == RATE_LIMITED:
                # WisKey's per-user budget is spent for the moment: temporary, not a broken session. Keep the session
                # and the last copy, and refetch once the bucket has refilled a little.
                self._retry_refresh()
            elif self._tts and exc.code not in ("unauthorized", "unknown_command"):
                self._defer_failure(exc.code)  # WisKey answered (the socket is fine): do not cut the announcement
            else:
                self._fail(exc)
        except TimeoutError as exc:
            if self._tts:
                self._defer_failure("timeout")
            else:
                self._fail(exc)
        except Exception as exc:  # noqa: BLE001 - end the session; the loop reconnects and re-probes
            self._fail(exc)
        finally:
            self._refreshing = False

    def _defer_failure(self, code: str) -> None:
        """T054 review S6: an overview refetch failed while an announcement is playing on this session. Ending the
        session would make Home Assistant drop the announcement's subscription and cut it off mid-sentence, although
        the failure has nothing to do with it (WisKey answered, or one call timed out; the socket itself is up). So the
        session is kept, the copy is served as NOT fresh (`_deferred`), and the refetch is retried every
        DEFER_RETRY_S; once no announcement is playing, a failure ends the session exactly as before. A revoked access
        (`unauthorized`) or a removed WisKey (`unknown_command`) never waits, and neither does a broken socket."""
        if self._deferred is None:
            log.warning("WisKey feed: overview refetch failed (%s) during an announcement; keeping the session until it ends", code)
        self._deferred = code
        self._retry_refresh(DEFER_RETRY_S)

    def _retry_refresh(self, delay: float | None = None) -> None:
        """One delayed refetch (after `rate_limited`, or a failure deferred by `_defer_failure`), tracked with the
        session's tasks so it never outlives it."""
        if self._retry_pending:
            return
        self._retry_pending = True
        wait = RATE_RETRY_S if delay is None else delay
        if delay is None and not self._rate_logged:
            log.warning("WisKey feed: overview refetch rate limited; retrying in %.0fs", RATE_RETRY_S)
            self._rate_logged = True

        async def later() -> None:
            try:
                await asyncio.sleep(wait)
            finally:
                self._retry_pending = False
            await self._refresh()

        task = asyncio.get_running_loop().create_task(later(), name="intercom-refresh-retry")
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _watch(self, call: intercom_client.Call, ids: set[str]) -> None:
        """Follow the stations' own online / ringing / call-status entities (re-subscribed when that set changes)."""
        if ids == self._watched:
            return
        if self._entities_sub is not None:
            await call("unsubscribe_events", subscription=self._entities_sub)
            self._entities_sub = None
        self._watched = set()
        if not ids:
            return
        frame = await call("subscribe_entities", entity_ids=sorted(ids))
        if frame.get("success"):
            self._entities_sub = int(frame["id"])
            self._watched = set(ids)  # only now: a refused subscription is tried again on the next refresh
            self._replay_early()


SYNC = IntercomSync()
