"""WISKEY-CONFLICTS-2400 (WisKey full integration plan of 2026-11-03, task T5; capability matrix rows 37, 38, 76, 77): the operator
closes what the status page shows in red without opening WisKey's own panel - a person's sync conflict on a station, a deletion that
WisKey holds for review, and the fleet alerts - and, behind a setting that is OFF by default, Arx's notification centre is told about
new WisKey fleet alerts.

The WisKey commands (rc.10 `websocket.py` COMMANDS / handlers and `access/manager.py`, `fleet_alerts.py`, checked against the pinned
catalog rc37-contract.4 and the rc.10 extract; all four are non-READ in both, so `api_contract` goes on every frame):

| Arx step            | WisKey command                | WisKey's effect                                                                                  |
|---------------------|-------------------------------|--------------------------------------------------------------------------------------------------|
| review (preview)    | `conflicts/review`            | READS the station (capabilities + the person's device record, in WisKey's device transaction) and |
|                     |                               | answers the comparison, the plan, which resolutions it allows, and a `review_token` (an HMAC of   |
|                     |                               | the device record): nothing is written                                                            |
| resolve             | `conflicts/resolve`           | re-reads the device; refuses `review_stale` when the record changed since the review and          |
|                     |                               | `revision_conflict` when the person changed; `central` keeps WisKey's record, `device` adopts the |
|                     |                               | device's; the binding goes `pending` and the person's sync is QUEUED (`request_user`)             |
| continue a deletion | `conflicts/resolve_deletion`  | re-reads the device (same stale check); the station's deletion goes `delete_pending` and the      |
|                     |                               | station's sync is QUEUED - the person is then removed from that station by WisKey's worker        |
| snooze / restore    | `fleet/alerts_action`         | `suppress` (15 / 60 / 240 / 1440 / 10080 minutes, a closed reason) or `restore` of ONE station +  |
|                     |                               | kind (or `maintenance` = every kind of the station); compare-and-set on WisKey's `revision`.     |
|                     |                               | Presentation only: "suppression changes presentation, not device state" (WisKey's own words)     |

WisKey has NO acknowledge and NO close for a fleet alert: an alert is a live observation and ends when its condition ends; snooze and
restore are the only actions (docs/changes/WISKEY-CONFLICTS-2400.md "WisKey gaps").

The path: the add-on's own live WisKey session (intercom_sync), on its closed `triage` channel (services/wiskey_channels.py - exactly
these four commands; the same socket and identity as the service channel), each command sent ONCE, never queued, never retried. The
lane name `triage` is not special-cased by intercom_sync (a read slot and the read buckets, like WISKEY-STATION-OPS' `maintenance`);
this module adds its own limits on top (`Limits`).

The review's token never reaches the browser: the review is stored here (`wiskey_conflict_reviews`, migration 0200) under a random id,
bound to the operator, the station, the person and WisKey's revision, single use, REVIEW_TTL_S. The resolve names the review id and the
direction the operator confirmed; the server sends WisKey's token. The impact the operator saw is kept with it (closed fields only: no
PIN, no card number, no photo).

Everything here is pure or local (projections, the limits, the review store, the alert feed's reconcile); the HTTP side is
routers/access_control_triage.py. Tests drive it with tests/fake_wiskey.py (tests/test_wiskey_triage_2400.py); nothing contacts a device."""
from __future__ import annotations

import datetime as dt
import json
import logging
import secrets
import sqlite3
import threading
import time
from collections import deque
from typing import Any, Callable

from ..config import Settings
from ..db import Database, get_setting
from . import intercom_adapter as ad
from . import intercom_authority as ia
from . import intercom_client
from .intercom_client import IntercomError, UnclearAnswer

log = logging.getLogger("smplwise.intercom")

CHANNEL = "triage"  # services/wiskey_channels.py TRIAGE
LANE = "triage"  # intercom_sync: no lane of its own -> a read slot and the read buckets
REVIEW = "conflicts/review"
RESOLVE = "conflicts/resolve"
RESOLVE_DELETION = "conflicts/resolve_deletion"
ALERT_ACTION = "fleet/alerts_action"
COMMANDS = frozenset({REVIEW, RESOLVE, RESOLVE_DELETION, ALERT_ACTION})

# the audit rows' actions (one per Arx step)
AUDIT_REVIEW = "intercom.conflict_review"
AUDIT_RESOLVE = "intercom.conflict_resolve"
AUDIT_DELETION = "intercom.conflict_resolve_deletion"
AUDIT_ALERT = "intercom.fleet_alert_action"
AUDIT_ACTIONS = (AUDIT_REVIEW, AUDIT_RESOLVE, AUDIT_DELETION, AUDIT_ALERT)

KINDS = ("person", "removal")  # the conflict rows that can be resolved (intercom_adapter.project_conflicts); a `revocation` cannot
DIRECTIONS = ("central", "device", "delete")  # `delete` = conflicts/resolve_deletion
# WisKey's fleet alerts (rc.10 fleet_alerts.py): the kinds, the snooze reasons and durations it accepts
ALERT_KINDS = ad.ALERT_KINDS
SUPPRESS_KINDS = (*ALERT_KINDS, "maintenance")
REASONS = ("planned_maintenance", "network_work", "investigating")
DURATIONS = (15, 60, 240, 1440, 10080)
ALERT_ACTIONS = ("snooze", "restore")  # Arx's words for WisKey's `suppress` / `restore`
WISKEY_ACTION = {"snooze": "suppress", "restore": "restore"}

# the review's closed vocabulary (rc.10 access/review.py `compare`, manager.async_review)
DIFF_FIELDS = ("presence", "display_name", "user_type", "validity", "door_rights", "pin", "schedule", "privileged", "other_credentials", "cards")
PLAN_PERSON = ("create", "delete", "update", "none")
PLAN_PIN = ("none", "remove", "set", "change")
VALIDITY_TYPES = ("local", "utc")
# a `success: false` answer is a definite refusal with WisKey's code (these commands check before they write), except these, which
# say nothing about whether WisKey's store was written
UNCLEAR_CODES = frozenset({"", "action_failed", "storage_or_internal_error", "invalid_response", "timeout", "unknown_error", "storage_write_failed",
                           "storage_stopping", "storage_corrupt"})


# ---------------------------------------------------------------- projections (closed construction, like the adapter's)

def _view(raw: Any) -> dict[str, Any] | None:
    """One side of the comparison (WisKey `public_view`): display fields only. Cards as a COUNT (WisKey's public card carries a masked
    number; Arx keeps none), the PIN as configured or not."""
    if not isinstance(raw, dict):
        return None
    validity = raw.get("validity") if isinstance(raw.get("validity"), dict) else {}
    cards = raw.get("cards") if isinstance(raw.get("cards"), list) else []
    rights = raw.get("door_rights") if isinstance(raw.get("door_rights"), list) else []
    return {
        "present": bool(raw.get("present")),
        "display_name": ad._text(raw.get("display_name"), 128),
        "user_type": ad._code(raw.get("user_type")),
        "validity": {"timed": ad._bool(validity.get("timed")), "from": ad._iso(validity.get("from")), "until": ad._iso(validity.get("until")),
                     "time_type": ad._enum(validity.get("time_type"), VALIDITY_TYPES)},
        "door_rights": [r for r in rights[:16] if isinstance(r, int) and not isinstance(r, bool) and 1 <= r <= 64],
        "pin_configured": ad._bool(raw.get("pin_configured")),
        "card_count": len(cards[:500]),
        "schedule_configured": ad._bool(raw.get("schedule_configured")),
        "privileged": ad._bool(raw.get("privileged")),
        "other_credentials": ad._bool(raw.get("other_credentials")),
    }


def _plan(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    count = lambda v: v if isinstance(v, int) and not isinstance(v, bool) and 0 <= v <= 10000 else None  # noqa: E731
    return {"person": ad._enum(raw.get("person"), PLAN_PERSON), "pin": ad._enum(raw.get("pin"), PLAN_PIN),
            "cards_add": count(raw.get("cards_add")), "cards_remove": count(raw.get("cards_remove")), "cards_update": count(raw.get("cards_update"))}


def project_review(raw: Any) -> dict[str, Any]:
    """`conflicts/review`: the impact the operator confirms, plus WisKey's token under `_token` (the router stores it and never sends it
    on). The device's and WisKey's record as `_view` reduces them; the field NAMES that differ; the plan (counts); which of the three
    resolutions WisKey allows right now, each with WisKey's reason when not; the stations the person is on (a `device` resolution changes
    the record every one of them receives)."""
    if not isinstance(raw, dict) or not isinstance(raw.get("review_token"), str) or not raw["review_token"] or len(raw["review_token"]) > 256:
        raise ValueError("unexpected conflicts/review answer")
    actions_raw = raw.get("actions") if isinstance(raw.get("actions"), dict) else {}
    actions = {}
    for name in ("central", "device", "delete"):
        a = actions_raw.get(name) if isinstance(actions_raw.get(name), dict) else {}
        actions[name] = {"allowed": a.get("allowed") is True, "reason": None if a.get("allowed") is True else (ad._code(a.get("reason")) or "unknown")}
    diffs = raw.get("differences") if isinstance(raw.get("differences"), list) else []
    return {
        "user_id": ad._id(raw.get("user_id")),
        "station_id": ad._id(raw.get("station_id")),
        "revision": ad._int(raw.get("revision")),
        "reviewed_at": ad._iso(raw.get("reviewed_at")),
        "absent": bool(raw.get("absent")),
        "deletion_pending": bool(raw.get("deletion_pending")),
        "active": bool(raw.get("active")),
        "central": _view(raw.get("central")),
        "device": _view(raw.get("device")),
        "differences": [d if d in DIFF_FIELDS else "other" for d in diffs[:32] if isinstance(d, str)],
        "plan": _plan(raw.get("plan")),
        "unverified_fields": [f for f in (raw.get("unverified_fields") if isinstance(raw.get("unverified_fields"), list) else [])[:8] if f == "pin"],
        "affected_stations": ad._ids(raw.get("affected_stations"), 200),
        "actions": actions,
        "_token": raw["review_token"],
    }


def project_resolved(raw: Any) -> dict[str, Any]:
    """`conflicts/resolve`: WisKey answers the person's public record. Kept: the new revision and each station's sync state (the station
    just resolved reads `pending`: the person's sync is queued)."""
    if not isinstance(raw, dict) or ad._int(raw.get("revision")) is None:
        raise ValueError("unexpected conflicts/resolve answer")
    assignments = raw.get("assignments") if isinstance(raw.get("assignments"), dict) else {}
    states = {sid: ad._enum(a.get("sync_state"), ad.ASSIGNMENT_SYNC_STATES) for sid, a in list(assignments.items())[:200] if ad._id(sid) and isinstance(a, dict)}
    return {"revision": raw["revision"], "station_states": states}


def project_accepted(raw: Any) -> dict[str, Any]:
    """`conflicts/resolve_deletion`: `{accepted: true}`; anything else is not an acceptance (the outcome is then unknown, never done)."""
    if isinstance(raw, dict) and raw.get("accepted") is True:
        return {"accepted": True}
    raise ValueError("unexpected conflicts/resolve_deletion answer")


def project_alert_action(raw: Any) -> dict[str, Any]:
    """`fleet/alerts_action`: `{revision}` - WisKey's suppression revision after the change (the same one when nothing changed)."""
    if isinstance(raw, dict) and ad._int(raw.get("revision")) is not None:
        return {"revision": raw["revision"]}
    raise ValueError("unexpected fleet/alerts_action answer")


def project_alert_page(raw: Any) -> dict[str, Any]:
    """`fleet/alerts` for the action's fresh check: the adapter's projection plus WisKey's suppression `revision` (the compare-and-set
    value `fleet/alerts_action` needs; the adapter's served view does not carry it)."""
    page = ad.project_alerts(raw)
    page["revision"] = ad._int(raw.get("revision")) if isinstance(raw, dict) else None
    return page


# ---------------------------------------------------------------- the frames and their answers

def result_of(frame: dict[str, Any], command: str) -> Any:
    """`success: true` -> the result; `success: false` with a code -> a definite refusal (IntercomError: the feed's outcome `refused`,
    WisKey's code is the reason) - every one of these commands checks before it writes; an unclear code or a frame that is neither ->
    UnclearAnswer (outcome unknown: "sent, no clear answer")."""
    if frame.get("success") is True:
        return frame.get("result")
    if frame.get("success") is False:
        error = frame.get("error") if isinstance(frame.get("error"), dict) else {}
        code = str(error.get("code") or "")
        if code not in UNCLEAR_CODES and ad.CODE.fullmatch(code):
            raise IntercomError(code, command)
        raise UnclearAnswer(command, code or "action_failed")
    raise UnclearAnswer(command, "invalid_response")


def _ct(command: str) -> str:
    return intercom_client.command_type(command)


async def send_review(call: intercom_client.Call, station_id: str, user_id: str) -> Any:
    """`conflicts/review {station_id, user_id, api_contract}` - the pinned catalog's exact key set."""
    frame = await call(_ct(REVIEW), station_id=station_id, user_id=user_id, api_contract=intercom_client.API_CONTRACT)
    return result_of(frame, REVIEW)


async def send_resolve(call: intercom_client.Call, station_id: str, user_id: str, review_token: str, revision: int, direction: str) -> Any:
    frame = await call(_ct(RESOLVE), station_id=station_id, user_id=user_id, review_token=review_token, revision=revision, direction=direction,
                       api_contract=intercom_client.API_CONTRACT)
    return result_of(frame, RESOLVE)


async def send_resolve_deletion(call: intercom_client.Call, station_id: str, user_id: str, review_token: str) -> Any:
    frame = await call(_ct(RESOLVE_DELETION), station_id=station_id, user_id=user_id, review_token=review_token, api_contract=intercom_client.API_CONTRACT)
    return result_of(frame, RESOLVE_DELETION)


async def send_alert_action(call: intercom_client.Call, revision: int, station_id: str, kind: str, action: str, duration_minutes: int, reason: str) -> Any:
    """`fleet/alerts_action` - all six fields are required by WisKey's schema, also for `restore` (where WisKey ignores the duration and
    the reason; Arx sends valid values, as WisKey's own panel does)."""
    frame = await call(_ct(ALERT_ACTION), revision=revision, station_id=station_id, kind=kind, action=WISKEY_ACTION[action], duration_minutes=duration_minutes,
                       reason=reason, api_contract=intercom_client.API_CONTRACT)
    return result_of(frame, ALERT_ACTION)


# ---------------------------------------------------------------- Arx's own limits

USER_WINDOW_S = 60.0
USER_MAX = {"review": 20, "write": 10}  # per operator per window
MAX_INFLIGHT = {"review": 2, "write": 1}  # installation-wide: a review reads a device; writes one at a time
COOLDOWN_S = {"review": 3.0, "write": 10.0}  # per target (station + person, or station + alert kind) after a SEND
COOLDOWN_SCALE = 1.0  # tests shrink it


class Limits:
    """In-process limits on top of the feed's buckets. A refusal is `(code, retry_after_s)`; an admitted command holds one in-flight slot
    of its class until `done`. The cool-down starts only when the command was handed to WisKey (`sent`)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._last: dict[tuple[str, str], float] = {}
        self._users: dict[tuple[str, str], deque[float]] = {}
        self._inflight = {"review": 0, "write": 0}

    def cooldown_left(self, cls: str, target: str, now: float | None = None) -> float:
        with self._lock:
            at = self._last.get((cls, target))
        if at is None:
            return 0.0
        left = COOLDOWN_S[cls] * COOLDOWN_SCALE - ((time.monotonic() if now is None else now) - at)
        return max(0.0, round(left, 1))

    def admit(self, user: str, cls: str, target: str) -> tuple[str, float] | None:
        now = time.monotonic()
        left = self.cooldown_left(cls, target, now)
        if left > 0:
            return "triage_cooldown", left
        with self._lock:
            window = self._users.setdefault((cls, user), deque())
            while window and now - window[0] >= USER_WINDOW_S:
                window.popleft()
            if len(window) >= USER_MAX[cls]:
                return "triage_rate_limited", round(USER_WINDOW_S - (now - window[0]), 1)
            if self._inflight[cls] >= MAX_INFLIGHT[cls]:
                return "triage_busy", 2.0
            window.append(now)
            self._inflight[cls] += 1
        return None

    def sent(self, cls: str, target: str) -> None:
        with self._lock:
            self._last[(cls, target)] = time.monotonic()

    def done(self, cls: str) -> None:
        with self._lock:
            self._inflight[cls] = max(0, self._inflight[cls] - 1)

    def reset(self) -> None:
        with self._lock:
            self._last.clear()
            self._users.clear()
            self._inflight = {"review": 0, "write": 0}


LIMITS = Limits()


# ---------------------------------------------------------------- the review store (migration 0200)

REVIEW_TTL_S = 600  # a review older than this must be taken again (the device may have changed; WisKey would say `review_stale`)
REVIEW_KEEP_DAYS = 30  # a used / expired review row stays this long (what was confirmed), then it is removed


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _iso(t: dt.datetime) -> str:
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


def new_review_id() -> str:
    return "rv_" + secrets.token_urlsafe(18)


def store_review(conn: sqlite3.Connection, *, actor: str, kind: str, station_id: str, person_id: str, revision: int | None, token: str,
                 impact: dict[str, Any], now: dt.datetime | None = None) -> dict[str, Any]:
    """Keep one review (the caller's transaction). Returns `{id, expires_at}`. Old rows go first (REVIEW_KEEP_DAYS)."""
    at = now or _now()
    conn.execute("DELETE FROM wiskey_conflict_reviews WHERE created_at < ?", (_iso(at - dt.timedelta(days=REVIEW_KEEP_DAYS)),))
    rid = new_review_id()
    expires = at + dt.timedelta(seconds=REVIEW_TTL_S)
    conn.execute(
        "INSERT INTO wiskey_conflict_reviews(id, actor_user_id, kind, station_id, person_id, revision, review_token, impact_json, created_at, expires_at)"
        " VALUES (?,?,?,?,?,?,?,?,?,?)",
        (rid, actor, kind, station_id, person_id, revision, token, json.dumps(impact, ensure_ascii=False, sort_keys=True), _iso(at), _iso(expires)),
    )
    return {"id": rid, "expires_at": _iso(expires)}


def load_review(conn: sqlite3.Connection, review_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM wiskey_conflict_reviews WHERE id = ?", (review_id,)).fetchone()


def review_problem(row: sqlite3.Row | None, actor: str, now: dt.datetime | None = None) -> str | None:
    """Why this review cannot back a resolution: `review_not_found` (none, or another operator's - the same answer, no oracle),
    `review_used` (single use), `review_expired`; None when it can."""
    if row is None or row["actor_user_id"] != actor:
        return "review_not_found"
    if row["used_at"]:
        return "review_used"
    if str(row["expires_at"]) <= _iso(now or _now()):
        return "review_expired"
    return None


def consume_review(conn: sqlite3.Connection, review_id: str, direction: str, now: dt.datetime | None = None) -> bool:
    """Mark the review used (compare-and-set: False when another request took it first) and drop WisKey's token from the row."""
    cur = conn.execute("UPDATE wiskey_conflict_reviews SET used_at = ?, used_direction = ?, review_token = '' WHERE id = ? AND used_at IS NULL",
                       (_iso(now or _now()), direction, review_id))
    return cur.rowcount == 1


def settle_review(conn: sqlite3.Connection, review_id: str, outcome: str) -> None:
    conn.execute("UPDATE wiskey_conflict_reviews SET outcome = ? WHERE id = ?", (outcome, review_id))


# ---------------------------------------------------------------- the notification feed (setting, OFF by default)

NOTIFY_KEY = "access.wiskey_alerts_notify"  # "true" | "false" (default false); written by PUT /access-control/triage/settings only
NOTIFY_SOURCE = "wiskey.fleet_alert"  # services/notify_policy.py
FEED_TICK_S = 60.0
FEED_FIRST_S = 30.0
FEED_WHO = "system:wiskey-alerts"
KIND_TEXT = {
    "offline": "העמדה לא מחוברת",
    "sync_stalled": "הסנכרון תקוע",
    "sync_conflict": "התנגשות סנכרון",
    "sync_error": "שגיאת סנכרון",
    "event_gap": "פער בזרם האירועים",
    "clock_drift": "שעון העמדה סוטה",
}


def notify_enabled(conn: sqlite3.Connection) -> bool:
    """Fail closed: anything but the stored "true" is off."""
    try:
        return (get_setting(conn, NOTIFY_KEY) or "false") == "true"
    except Exception:  # noqa: BLE001
        return False


def feed_signals(items: list[dict[str, Any]]) -> tuple[dict[str, Any], set[str]]:
    """The fleet alerts as notify signals: one open notification per (station, kind) WisKey reports and does NOT hold suppressed (a
    snoozed alert is not announced and closes its open row). Severity: WisKey `error` -> alert, `warning` -> info. A station's NAME and
    the kind only - never a person; the subject is `system` (visible to system.configure, services/notify_visibility.py)."""
    from . import notify

    due: dict[str, Any] = {}
    for it in items:
        sid, kind = it.get("station_id"), it.get("kind")
        if not ia.valid_id(sid) or kind not in ALERT_KINDS or it.get("suppressed"):
            continue
        key = f"{NOTIFY_SOURCE}:{sid}:{kind}"
        name = it.get("station_name") or sid
        due[key] = notify.Signal(NOTIFY_SOURCE, "system", f"{sid}/{kind}", severity="alert" if it.get("severity") == "error" else "info", dedupe_key=key,
                                 params={"name": name, "place": name, "detail": KIND_TEXT[kind]}, origin={"station_id": sid, "alert_kind": kind},
                                 link="#/wiskey/alerts")
    return due, set(due)


class AlertFeed:
    """A thread that, ONLY while the setting is on, reads WisKey's fleet alerts (the READ channel, one `fleet/alerts` per tick) and makes
    the open notifications of `wiskey.fleet_alert` say what is true now (services/notify_sources.reconcile: a new alert is announced
    once, a gone or snoozed one is resolved). Who is told, on which channel, and whether quiet hours / quiet windows hold it back is the
    notification pipeline's (the source's policy in Settings > notifications; services/notify_channels.py) - this thread only signals.
    With the setting off it reads nothing and resolves the open rows it left (turning it off closes them). A WisKey that does not answer
    changes nothing (no resolve on a failed read)."""

    def __init__(self) -> None:
        self.thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._db: Database | None = None
        self._settings: Settings | None = None
        self.last: dict[str, Any] = {"at": None, "state": "idle", "emitted": 0, "resolved": 0}

    def start(self, db: Database, settings: Settings) -> None:
        if self.thread is not None:
            return
        self._db, self._settings = db, settings
        self._stop.clear()
        self.thread = threading.Thread(target=self._loop, name="wiskey-alert-feed", daemon=True)
        self.thread.start()

    def shutdown(self) -> None:
        self._stop.set()
        if self.thread is not None:
            self.thread.join(timeout=5)
        self.thread = None

    def _loop(self) -> None:
        if self._stop.wait(FEED_FIRST_S):
            return
        while not self._stop.is_set():
            try:
                self.tick()
            except Exception:  # noqa: BLE001 - a notification problem never stops the feed or the add-on
                log.exception("WisKey alert feed: tick failed")
            if self._stop.wait(FEED_TICK_S):
                return

    def tick(self, read: Callable[[], dict[str, Any] | None] | None = None) -> dict[str, Any]:
        """One pass (tests call it directly with `read`). Returns what it did."""
        from . import notify_sources

        assert self._db is not None
        with self._db.connection(mode="read", label="wiskey_alert_feed.setting") as conn:
            enabled = notify_enabled(conn)
            left_open = conn.execute("SELECT 1 FROM notifications WHERE source = ? AND state != 'resolved' LIMIT 1", (NOTIFY_SOURCE,)).fetchone() is not None
        if not enabled:
            done = {"emitted": 0, "resolved": 0}
            if left_open:  # turned off: close what this feed left open (no write transaction otherwise)
                with self._db.connection(label="wiskey_alert_feed.off") as conn:
                    done = notify_sources.reconcile(conn, NOTIFY_SOURCE, {}, set(), _now())
            self.last = {"at": _iso(_now()), "state": "off", **done}
            return self.last
        page = (read or self._read)()
        if page is None:
            self.last = {"at": _iso(_now()), "state": "unavailable", "emitted": 0, "resolved": 0}
            return self.last
        due, active = feed_signals(page.get("items") or [])
        with self._db.connection(label="wiskey_alert_feed.reconcile") as conn:
            if not page.get("fetched_all", True):  # WisKey held more than one page: announce what was read, resolve nothing
                active |= {r[0] for r in conn.execute("SELECT dedupe_key FROM notifications WHERE source = ? AND state != 'resolved'", (NOTIFY_SOURCE,)).fetchall()}
            done = notify_sources.reconcile(conn, NOTIFY_SOURCE, due, active, _now())
        self.last = {"at": _iso(_now()), "state": "ready", **done}
        return self.last

    def _read(self) -> dict[str, Any] | None:
        from . import intercom_sync

        assert self._settings is not None
        try:
            reply = intercom_sync.SYNC.command(self._settings, "alerts", lambda call: ad.fleet_alerts(call, "", False), ad.project_alerts, who=FEED_WHO, channel="read")
        except Exception as exc:  # noqa: BLE001 - an ApiError (rate, request refusal) or anything else: this pass reads nothing
            log.info("WisKey alert feed: read refused (%s)", getattr(exc, "code", type(exc).__name__))
            return None
        if reply.get("state") != "ready" or reply.get("alerts") is None:
            return None
        return reply["alerts"]


FEED = AlertFeed()


def reset() -> None:
    LIMITS.reset()
