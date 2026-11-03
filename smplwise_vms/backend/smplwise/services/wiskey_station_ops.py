"""WISKEY-STATION-OPS-2390 (WisKey full integration plan of 2026-11-03, task T4; capability matrix rows 3, 33, 34, 36): a station's
maintenance from Arx - "sync now", "rescan", a health refresh and a clock check - without opening WisKey's own panel, and the
read-only health detail the drawer shows next to them (last sync, event stream, last error, and the sporadic `authentication_failed`
with its step and time).

The four WisKey commands (rc.10 `websocket.py` COMMANDS and handlers, checked against the pinned catalog rc37-contract.4; every one
station-scoped and non-READ, so `api_contract` goes on each frame):

| action          | WisKey command           | WisKey's effect                                                                  | Arx result       |
|-----------------|--------------------------|----------------------------------------------------------------------------------|------------------|
| `sync`          | `sync/station`           | `manager.request(station)`: the station's reconciliation is QUEUED; `{accepted}`  | `acknowledged`   |
| `rescan`        | `stations/rescan`        | `manager.async_rescan`: capabilities + inventory re-read (no reconciliation); waits | `completed`      |
| `health_refresh`| `health/refresh`         | clock read + media inspect on the device (35 s cap, 3 at once), then the report   | `completed`      |
| `clock_refresh` | `stations/clock_refresh` | the station clock is READ again (`StationClock.async_refresh`); no time is set    | `completed`      |

Not here, deliberately: `sync/all` and `sync/user` (installation / person scope, not a station's; WisKey grants them with `users:
manage`), `clock/station_sync` (it WRITES the device clock - a separate decision), `sync/diagnostics` (a support export).

The path: the add-on's own live WisKey session (intercom_sync), on its closed `maintenance` channel (services/wiskey_channels.py -
exactly these four commands; the same socket and identity as the service channel that carries the other station writes), sent ONCE,
never queued, never retried. In intercom_sync it runs in the `maintenance` lane name, which that module does not special-case: it
takes a read slot and the read buckets there (no edit of the shared feed module), and this module adds its own limits on top
(`Limits`: one command per station and action per cool-down, a per-operator window, at most MAX_INFLIGHT at once) so a maintenance
burst can never starve the screens' reads or touch the physical-action lane of door releases.

Everything here is pure (projections, the limits, the observed-failure memo); the HTTP side is routers/access_control_station_ops.py.
Tests drive it with tests/fake_wiskey.py (tests/test_wiskey_station_ops.py); nothing contacts a device."""
from __future__ import annotations

import threading
import time
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable

from . import intercom_adapter as ad
from . import intercom_client
from .intercom_client import IntercomError, UnclearAnswer

CHANNEL = "maintenance"  # services/wiskey_channels.py MAINTENANCE
LANE = "maintenance"  # intercom_sync: no lane of its own -> a read slot and the read buckets (module note)
AUTH_FAILED = "authentication_failed"

# WisKey's sync stages (rc.10 access/diagnostics.py STEPS); anything else is "other" (a newer WisKey)
SYNC_STEPS = frozenset({"queued", "identity", "capabilities", "inventory", "person_read", "reconcile", "journal", "create_person", "update_person",
                        "delete_person", "create_card", "update_card", "delete_card", "readback", "complete"})
# the device sub-statuses WisKey keeps on a failed stage (rc.10 access/diagnostics.py SAFE_SUB_STATUS); anything else is "other"
SUB_STATUSES = frozenset({"badjsoncontent", "badxmlcontent", "notsupport", "notsupported", "methodnotallowed", "unauthorized", "nopermission",
                          "cardnoalreadyexist", "employeenoalreadyexist", "deviceuseralreadyexist", "userpasswordalreadyexist", "cardfull",
                          "userfull", "devicecardfull", "deviceuserfull", "cardfullperuser"})
# a `success: false` answer is a definite failure with WisKey's code, except these, which say nothing about what happened
UNCLEAR_CODES = frozenset({"", "action_failed", "storage_or_internal_error", "invalid_response", "timeout", "unknown_error"})


@dataclass(frozen=True)
class Op:
    action: str
    command: str
    audit: str  # the audit row's action
    needs_online: bool  # refused (not sent) while the served copy says the station is offline
    cooldown_s: float  # one command per station and action per this long
    result: str  # what a success means: `acknowledged` (WisKey accepted / queued it) or `completed` (WisKey waited for it)
    project: Callable[[Any], dict[str, Any]]
    summary: Callable[[dict[str, Any]], dict[str, Any]]


# ---------------------------------------------------------------- projections (closed construction, like the adapter's)

def project_accepted(raw: Any) -> dict[str, Any]:
    """`sync/station` / `stations/rescan`: WisKey answers `{accepted: true}`; anything else is not an acceptance (the feed then reads
    the outcome as unknown, never as done)."""
    if isinstance(raw, dict) and raw.get("accepted") is True:
        return {"accepted": True}
    raise ValueError("unexpected maintenance answer")


def project_clock(raw: Any) -> dict[str, Any]:
    """`stations/clock_refresh`: the station clock as WisKey measured it (`StationClock.public()`), reduced like the overview's clock."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected stations/clock_refresh answer")
    return {
        "source": ad._enum(raw.get("source"), ad.CLOCK_SOURCES),
        "status": ad._enum(raw.get("status"), ad.CLOCK_STATUSES),
        "skew_seconds": ad._num(raw.get("skew_seconds")),
        "drift_state": ad._enum(raw.get("drift_state"), ad.DRIFT_STATES),
        "time_mode": ad._enum(raw.get("time_mode"), ad.TIME_MODES),
        "checked_at": ad._iso(raw.get("checked_at")),
        "error": ad._code(raw.get("error")),
    }


def auth_summary(raw: Any) -> dict[str, Any]:
    """The sporadic `authentication_failed` (lab: all ten stations since 28.10, a concurrency / lock-out pattern) as one station's health
    report shows it: the newest sync stage that failed with it (WisKey's step and the stage's time; the device's status code / sub-status
    when WisKey kept them), how many of WisKey's retained stages failed so (`retained`: WisKey keeps the last 200 stages of ALL stations
    since its start), and whether the sync, the event stream or the event history is in that state right now. The person pseudonym
    (`user_ref`) is never kept."""
    report = raw if isinstance(raw, dict) else {}
    access = report.get("access") if isinstance(report.get("access"), dict) else {}
    events = report.get("events") if isinstance(report.get("events"), dict) else {}
    diag = report.get("sync_diagnostics") if isinstance(report.get("sync_diagnostics"), dict) else {}
    rows = [r for r in (diag.get("recent") if isinstance(diag.get("recent"), list) else [])[-400:] if isinstance(r, dict)]
    failed = [r for r in rows if r.get("error") == AUTH_FAILED]
    steps: dict[str, int] = {}
    for r in failed:
        step = r.get("step") if r.get("step") in SYNC_STEPS else "other"
        steps[step] = steps.get(step, 0) + 1
    last = failed[-1] if failed else None  # WisKey appends in order: the last one is the newest
    done = [r for r in rows if r.get("step") == "complete" and r.get("outcome") == "succeeded"]
    return {
        "last_failure": None if last is None else {
            "source": "sync",
            "step": last.get("step") if last.get("step") in SYNC_STEPS else "other",
            "at": ad._iso(last.get("timestamp")),
            "status_code": ad._int(last.get("status_code")),
            "sub_status": None if last.get("sub_status") is None else last["sub_status"] if last.get("sub_status") in SUB_STATUSES else "other",
        },
        "retained": len(failed),
        "steps": steps,
        "sync_now": access.get("last_error") == AUTH_FAILED,
        "event_stream_now": events.get("stream") == AUTH_FAILED,
        "event_history_now": events.get("history") == AUTH_FAILED,
        "last_sync_ok_at": ad._iso(done[-1].get("timestamp")) if done else None,
        "retention": ad._code(diag.get("retention")),
    }


def project_report(raw: Any) -> dict[str, Any]:
    """`health/get` / `health/refresh` (the same report): the status page's health card (intercom_adapter.project_health) plus the
    authentication summary."""
    return {"health": ad.project_health(raw), "auth": auth_summary(raw)}


def _summary_accepted(p: dict[str, Any]) -> dict[str, Any]:
    return {"accepted": bool(p.get("accepted"))}


def _summary_report(p: dict[str, Any]) -> dict[str, Any]:
    health = p.get("health") or {}
    auth = p.get("auth") or {}
    return {"online": health.get("online"), "sync_state": (health.get("access") or {}).get("sync_state"), "auth_failures_retained": auth.get("retained")}


def _summary_clock(p: dict[str, Any]) -> dict[str, Any]:
    return {"status": p.get("status"), "skew_seconds": p.get("skew_seconds"), "drift_state": p.get("drift_state")}


OPS: dict[str, Op] = {
    "sync": Op("sync", "sync/station", "intercom.station_sync", False, 30.0, "acknowledged", project_accepted, _summary_accepted),
    "rescan": Op("rescan", "stations/rescan", "intercom.station_rescan", True, 60.0, "completed", project_accepted, _summary_accepted),
    "health_refresh": Op("health_refresh", "health/refresh", "intercom.station_health_refresh", True, 60.0, "completed", project_report, _summary_report),
    "clock_refresh": Op("clock_refresh", "stations/clock_refresh", "intercom.station_clock_refresh", True, 60.0, "completed", project_clock, _summary_clock),
}
COMMANDS = frozenset(op.command for op in OPS.values())
AUDIT_ACTIONS = tuple(op.audit for op in OPS.values())


# ---------------------------------------------------------------- the frame and its answer

def result_of(frame: dict[str, Any], command: str) -> Any:
    """A maintenance command's answer: `success: true` -> the result; `success: false` with a code -> a definite failure
    (IntercomError: the feed's outcome `refused`, shown as "failed: <code>") - these commands only queue a sync or read the device, so
    WisKey's code IS the outcome; an unclear code or a frame that is neither -> UnclearAnswer (outcome unknown: "sent, no clear answer")."""
    if frame.get("success") is True:
        return frame.get("result")
    if frame.get("success") is False:
        error = frame.get("error") if isinstance(frame.get("error"), dict) else {}
        code = str(error.get("code") or "")
        if code not in UNCLEAR_CODES and ad.CODE.fullmatch(code):
            raise IntercomError(code, command)
        raise UnclearAnswer(command, code or "action_failed")
    raise UnclearAnswer(command, "invalid_response")


async def send(call: intercom_client.Call, op: Op, station_id: str) -> Any:
    """`hikvision_intercom/<command> {station_id, api_contract}` - the exact key set of the pinned catalog for all four commands."""
    frame = await call(intercom_client.command_type(op.command), station_id=station_id, api_contract=intercom_client.API_CONTRACT)
    return result_of(frame, op.command)


async def health_read(call: intercom_client.Call, station_id: str) -> Any:
    """The read-only health report (`health/get`, the adapter's READ channel command - no `api_contract`, it is a READ command)."""
    return await ad.health_get(call, station_id)


# ---------------------------------------------------------------- Arx's own limits

COOLDOWN_SCALE = 1.0  # tests shrink it
USER_WINDOW_S = 60.0
USER_MAX = 24  # maintenance commands per operator per window (two list actions over ten stations fit)
MAX_INFLIGHT = 2  # at once, installation-wide (WisKey itself allows three health refreshes at once)


class Limits:
    """In-process limits on top of the feed's buckets. A refusal is `(code, retry_after_s)`; an admitted command holds one in-flight
    slot until `done`. The cool-down starts only when the command was handed to WisKey (`sent`), never for one that was not sent."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._last: dict[tuple[str, str], float] = {}
        self._users: dict[str, deque[float]] = {}
        self._inflight = 0

    def cooldown_left(self, station_id: str, action: str, now: float | None = None) -> float:
        op = OPS[action]
        with self._lock:
            at = self._last.get((station_id, action))
        if at is None:
            return 0.0
        left = op.cooldown_s * COOLDOWN_SCALE - ((time.monotonic() if now is None else now) - at)
        return max(0.0, round(left, 1))

    def admit(self, user: str, station_id: str, action: str) -> tuple[str, float] | None:
        now = time.monotonic()
        left = self.cooldown_left(station_id, action, now)
        if left > 0:
            return "station_ops_cooldown", left
        with self._lock:
            window = self._users.setdefault(user, deque())
            while window and now - window[0] >= USER_WINDOW_S:
                window.popleft()
            if len(window) >= USER_MAX:
                return "station_ops_rate_limited", round(USER_WINDOW_S - (now - window[0]), 1)
            if self._inflight >= MAX_INFLIGHT:
                return "station_ops_busy", 2.0
            window.append(now)
            self._inflight += 1
        return None

    def sent(self, station_id: str, action: str) -> None:
        with self._lock:
            self._last[(station_id, action)] = time.monotonic()

    def done(self) -> None:
        with self._lock:
            self._inflight = max(0, self._inflight - 1)

    def reset(self) -> None:
        with self._lock:
            self._last.clear()
            self._users.clear()
            self._inflight = 0


LIMITS = Limits()


# ---------------------------------------------------------------- the observed authentication failures (memo)

class Seen:
    """The newest `authentication_failed` Arx has SEEN per station since the add-on started - from a health report's sync stages
    (WisKey's own time of the stage), or from the station's state in the served copy / a report (the event stream, the event history,
    the station's sync error: no device time exists for those, so the time is when Arx saw it). WisKey keeps its stages in a ring of
    200 for all stations together, so a failure an hour ago may be gone from WisKey's report; this keeps it visible until restart.
    Process memory only (no table, no migration): a restart forgets it - the drawer says "since the system started"."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._by: dict[str, dict[str, Any]] = {}

    def note(self, station_id: str, failure: dict[str, Any] | None) -> None:
        if not failure or not failure.get("at"):
            return
        with self._lock:
            old = self._by.get(station_id)
            if old is None or str(failure["at"]) >= str(old.get("at") or ""):
                self._by[station_id] = dict(failure)

    def note_state(self, station_id: str, source: str) -> None:
        """A state seen right now (no device time): recorded with Arx's own clock, unless the same source is already the newest."""
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        with self._lock:
            old = self._by.get(station_id)
            if old is not None and old.get("source") == source and old.get("observed"):
                return  # keep the FIRST sighting of an ongoing state
        self.note(station_id, {"source": source, "step": None, "at": now, "status_code": None, "sub_status": None, "observed": True})

    def get(self, station_id: str) -> dict[str, Any] | None:
        with self._lock:
            found = self._by.get(station_id)
            return dict(found) if found else None

    def reset(self) -> None:
        with self._lock:
            self._by.clear()


SEEN = Seen()


def observe(station_id: str, technical: dict[str, Any] | None, auth: dict[str, Any] | None) -> None:
    """Feed the memo from what a read saw: the served copy's technical part and / or a health report's summary."""
    if auth:
        SEEN.note(station_id, auth.get("last_failure"))
        if auth.get("event_stream_now"):
            SEEN.note_state(station_id, "event_stream")
        if auth.get("event_history_now"):
            SEEN.note_state(station_id, "event_history")
    if technical:
        stream = (technical.get("event_status") or {}).get("stream")
        if stream == AUTH_FAILED:
            SEEN.note_state(station_id, "event_stream")
        if technical.get("last_error") == AUTH_FAILED and not (auth and auth.get("last_failure")):
            SEEN.note_state(station_id, "station_sync")


# ---------------------------------------------------------------- the read cache of the health report

HEALTH_TTL_S = 15.0


class HealthCache:
    """One health report per station for HEALTH_TTL_S (the drawer may be opened and closed; WisKey is asked at most this often)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._by: dict[str, tuple[float, str, dict[str, Any]]] = {}

    def get(self, station_id: str) -> tuple[str, dict[str, Any]] | None:
        with self._lock:
            hit = self._by.get(station_id)
        if hit is None or time.monotonic() - hit[0] > HEALTH_TTL_S:
            return None
        return hit[1], hit[2]

    def put(self, station_id: str, fetched_at: str, value: dict[str, Any]) -> None:
        with self._lock:
            self._by[station_id] = (time.monotonic(), fetched_at, value)

    def drop(self, station_id: str) -> None:
        with self._lock:
            self._by.pop(station_id, None)

    def reset(self) -> None:
        with self._lock:
            self._by.clear()


HEALTH = HealthCache()


def reset() -> None:
    LIMITS.reset()
    SEEN.reset()
    HEALTH.reset()
