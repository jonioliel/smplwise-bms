"""WISKEY-INBOUND-CALLS-2382: incoming door-station calls as first-class objects in Arx - the call book, the call log and who
gets the incoming-call banner.

What WisKey gives (read on origin/codex/wiskey-mac-m12-policy-b-2026-11-02, static reading): a station's `call_state` polled from
the device (`idle` / `ringing` / `in_call`; `ending` is declared but never produced; `unavailable` when the station is down), a bare
`ring` row in its event log, and `media/signal` (answer / reject / hangUp, physical_result always "unverified"). There is NO call
id, NO caller identity, NO ring-start time on the station and NO record of how a call ended. So Arx keeps its own:

  * the CALL BOOK (in memory, the source of the banner): one open call per station, minted when the station feed shows the
    station START ringing (services/intercom_sync._store calls `on_stations(before, after)` on the feed's loop - nothing here
    blocks or writes on that loop: every change is queued for this module's writer thread);
  * the CALL LOG (`intercom_calls`, migration 0197): one row per call - rang, answered (from Arx by whom, or elsewhere), rejected
    / hung up from Arx by whom, missed, unknown - and whether a door of that station was opened from Arx during the call or within
    DOOR_AFTER_S after it. The rows carry the station's name and Arx operators' names only; never a visitor, an image, a phone.

What decides the outcome (the station never says): ringing -> in_call = answered (`arx` when an Arx `answer` of this station was
sent in the last COMMAND_WINDOW_S, else `elsewhere`); ringing -> idle = `rejected` after an Arx `reject` in that window, else
`missed`; in_call -> idle = still `answered`, `ended_by` the Arx user whose `hangUp` preceded it. A station that goes offline or
unknown mid-call closes the call (`unknown` if it was never answered). A call seen first IN a call (Arx restarted, the station was
dialled) is logged with `observed = 'in_call'` and answered `elsewhere`.

The banner (GET intercom/calls/active, routers/intercom_calls.py) is NEW behaviour and OFF by default: the setting
`intercom.call_banner` (system.configure) says who gets it - `off`, `everyone` (everyone holding access.call on the station's
chain) or `roles` (only holders of the listed roles; still access.call on the station) - and optionally limits it to some
stations. Its sound follows the notification rules that already exist: the quiet hours (with the pass-through of the doorbell's
severity for push), never a quiet window (REL2140 M-5: the doorbell is never muted by a quiet window), never the critical,
do-not-disturb-bypassing sound (only the safety sources qualify, services/notify_settings.CRITICAL_SOUND_SOURCES)."""
from __future__ import annotations

import datetime as dt
import json
import logging
import queue
import sqlite3
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any

from ..db import Database, get_setting, now_iso, retry_locked, set_setting
from ..rbac import Principal, _active_bindings
from .timeutil import iso_utc_ms, parse_utc

log = logging.getLogger("smplwise.intercom.calls")
UTC = dt.timezone.utc

SETTING_KEY = "intercom.call_banner"
MODES = ("off", "everyone", "roles")
DEFAULT_SETTINGS: dict[str, Any] = {"mode": "off", "roles": [], "stations": [], "sound": True}
MAX_LIST = 200

COMMAND_WINDOW_S = 20.0   # an Arx command this recent explains the next transition of that station
DOOR_AFTER_S = 60.0       # a door opened this long after the call ended still belongs to it (the visitor walks in after hanging up)
RETENTION_DAYS = 90
RECENT_KEEP = 32          # closed calls kept in memory (door-after-call, the banner's last word)
CALL_PERMISSION = "access.call"
READ_PERMISSION = "access.read"
HISTORY_PERMISSIONS = ("access.events.read", "access.call")  # either one on the station's chain, besides access.read

ACTIVE = ("ringing", "in_call", "ending")


def _now() -> dt.datetime:
    return dt.datetime.now(UTC)


# UTC with milliseconds: two calls of one station never share an instant, so the log's order and its `before` cursor are exact.
_iso = iso_utc_ms  # CR-TIMEUTIL-2436 (04:F14): the shared helper under this module's name, same text


@dataclass
class Call:
    id: str
    station_id: str
    station_name: str
    rang_at: str
    observed: str = "ringing"
    state: str = "ringing"          # ringing | in_call | ended
    outcome: str | None = None      # answered | rejected | missed | unknown (set when known)
    answered_at: str | None = None
    answered_via: str | None = None
    answered_by: str | None = None
    answered_by_name: str | None = None
    ended_at: str | None = None
    ended_by: str | None = None
    ended_by_name: str | None = None
    door_opened_at: str | None = None
    door_opened_by: str | None = None
    door_opened_by_name: str | None = None
    updated_at: str = ""
    # not persisted
    ended_mono: float = field(default=0.0, repr=False)

    def row(self) -> dict[str, Any]:
        d = asdict(self)
        d.pop("ended_mono", None)
        return d


@dataclass
class _Command:
    command: str
    user_id: str
    name: str
    mono: float


def phase(station: dict[str, Any] | None) -> str:
    """A station's call phase as the book reads it: `absent` (not in the copy), `offline`, `ringing`, `in_call` (`ending` counts as
    still in the call: WisKey never produces it, but a later version might), `idle`, or `unknown` (anything else - `unavailable`,
    an unrecognised value: never read as idle, never as a call)."""
    if not isinstance(station, dict):
        return "absent"
    if not station.get("online"):
        return "offline"
    cs = station.get("call_state")
    if cs == "ringing":
        return "ringing"
    if cs in ("in_call", "ending"):
        return "in_call"
    if cs == "idle":
        return "idle"
    return "unknown"


def actor_name(principal: Principal) -> str:
    return (principal.display_name or principal.username or principal.user_id or "")[:80]


# ---------------------------------------------------------------- the call book

class CallBook:
    """One open call per station (in memory) + the recently closed ones; every change is queued for the writer."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._open: dict[str, Call] = {}
        self._recent: list[Call] = []
        self._commands: dict[str, _Command] = {}
        self._writes: "queue.Queue[dict[str, Any]]" = queue.Queue(maxsize=5000)
        self.mono = time.monotonic   # test seams
        self.clock = _now

    # -- the queue
    def _persist(self, call: Call) -> None:
        call.updated_at = _iso(self.clock())
        try:
            self._writes.put_nowait(call.row())
        except queue.Full:
            log.warning("intercom calls: the write queue is full; call %s not logged", call.id)

    def take(self, limit: int = 500) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        while len(out) < limit:
            try:
                out.append(self._writes.get_nowait())
            except queue.Empty:
                break
        return out

    def pending(self) -> int:
        return self._writes.qsize()

    # -- reads
    def open_calls(self) -> list[Call]:
        with self._lock:
            return [Call(**{**c.row(), "ended_mono": c.ended_mono}) for c in self._open.values()]

    def open_call(self, station_id: str) -> Call | None:
        with self._lock:
            c = self._open.get(station_id)
            return Call(**{**c.row(), "ended_mono": c.ended_mono}) if c else None

    def recent(self) -> list[Call]:
        with self._lock:
            return list(self._recent)

    # -- transitions
    def _recent_command(self, station_id: str, *commands: str) -> _Command | None:
        c = self._commands.get(station_id)
        if c is not None and c.command in commands and self.mono() - c.mono <= COMMAND_WINDOW_S:
            return c
        return None

    def _close(self, call: Call, outcome: str | None, by: _Command | None = None) -> None:
        now = self.clock()
        call.state = "ended"
        call.ended_at = _iso(now)
        if outcome:
            call.outcome = outcome
        elif call.outcome is None:
            call.outcome = "answered" if call.answered_at else "unknown"
        if by is not None:
            call.ended_by, call.ended_by_name = by.user_id, by.name
        call.ended_mono = self.mono()
        self._open.pop(call.station_id, None)
        self._recent.insert(0, call)
        del self._recent[RECENT_KEEP:]
        self._commands.pop(call.station_id, None)
        self._persist(call)

    def _new(self, station: dict[str, Any], observed: str) -> Call:
        now = _iso(self.clock())
        call = Call(id=uuid.uuid4().hex[:16], station_id=str(station["id"]), station_name=str(station.get("name") or "")[:120], rang_at=now, observed=observed,
                    state=observed)
        if observed == "in_call":  # seen first in a call: someone answered somewhere (or the station was dialled); never "from Arx"
            call.answered_at, call.answered_via, call.outcome = now, "elsewhere", "answered"
        self._open[call.station_id] = call
        self._persist(call)
        return call

    def _answer(self, call: Call, by: _Command | None) -> None:
        call.state = "in_call"
        call.outcome = "answered"
        if call.answered_at is None:
            call.answered_at = _iso(self.clock())
            if by is not None:
                call.answered_via, call.answered_by, call.answered_by_name = "arx", by.user_id, by.name
            else:
                call.answered_via = "elsewhere"
        self._persist(call)

    def on_stations(self, old: list[dict[str, Any]] | None, new: list[dict[str, Any]]) -> int:
        """The station copy changed (intercom_sync._store, on the feed's loop): advance each station's call. Returns how many calls
        changed. Never raises (a bad row is skipped); never blocks (writes are queued)."""
        before = {str(s["id"]): s for s in (old or []) if isinstance(s, dict) and s.get("id")}
        after = {str(s["id"]): s for s in new if isinstance(s, dict) and s.get("id")}
        n = 0
        with self._lock:
            for sid in set(before) | set(after) | set(self._open):
                try:
                    n += self._step(sid, before.get(sid), after.get(sid))
                except Exception:  # noqa: BLE001 - one bad station never costs the others
                    log.exception("intercom calls: station step failed")
        return n

    def _step(self, sid: str, old: dict[str, Any] | None, new: dict[str, Any] | None) -> int:
        was, now = phase(old), phase(new)
        call = self._open.get(sid)
        if call is not None and new is not None and new.get("name"):
            call.station_name = str(new["name"])[:120]
        if now == "ringing":
            if was == "ringing":
                return 0  # the same ring - possibly already answered / rejected by an Arx command the copy has not caught up with
            if call is not None and call.state == "in_call":
                self._close(call, None)  # a new ring after a call: the old one is over
                call = None
            if call is None:
                self._new(new or {"id": sid}, "ringing")
                return 1
            return 0
        if now == "in_call":
            if call is None:
                if was == "in_call":
                    return 0  # already closed from a command (hangUp) while the copy lagged
                self._new(new or {"id": sid}, "in_call")
                return 1
            if call.state == "ringing":
                self._answer(call, self._recent_command(sid, "answer"))
                return 1
            return 0
        if call is None:
            return 0
        # idle / offline / unknown / absent: the call is over
        if call.state == "ringing":
            if now == "idle":
                rej = self._recent_command(sid, "reject")
                self._close(call, "rejected" if rej else "missed", rej)
            else:
                self._close(call, "unknown")
            return 1
        self._close(call, "answered", self._recent_command(sid, "hangUp") if now == "idle" else None)
        return 1

    # -- what Arx itself did (the request threads)
    def note_command(self, station_id: str, command: str, principal: Principal, result: dict[str, Any] | None) -> None:
        """An Arx call command WisKey ACCEPTED (POST intercom/stations/{id}/call). Remembered for the next transition; when WisKey's
        own read-back already shows the new state (`observed_state`), the call advances now (the banner turns at once)."""
        with self._lock:
            by = _Command(command, principal.user_id, actor_name(principal), self.mono())
            self._commands[station_id] = by
            call = self._open.get(station_id)
            observed = (result or {}).get("observed_state") if isinstance(result, dict) else None
            if call is None:
                return
            if command == "answer" and observed == "in_call" and call.state == "ringing":
                self._answer(call, by)
            elif command == "reject" and observed == "idle" and call.state == "ringing":
                self._close(call, "rejected", by)
            elif command == "hangUp" and observed == "idle" and call.state == "in_call":
                self._close(call, "answered", by)

    def note_door(self, station_id: str, principal: Principal) -> str | None:
        """A door of this station was opened from Arx (WisKey accepted the release). Attached to the open call, or to the call that
        ended at most DOOR_AFTER_S ago. Returns the call id it was attached to."""
        with self._lock:
            call = self._open.get(station_id)
            if call is None:
                call = next((c for c in self._recent if c.station_id == station_id and self.mono() - c.ended_mono <= DOOR_AFTER_S), None)
            if call is None:
                return None
            call.door_opened_at = _iso(self.clock())
            call.door_opened_by, call.door_opened_by_name = principal.user_id, actor_name(principal)
            self._persist(call)
            return call.id

    def reset(self) -> None:
        """Tests: forget everything (open calls, recent ones, commands, queued writes)."""
        with self._lock:
            self._open.clear()
            self._recent.clear()
            self._commands.clear()
            self.take(100_000)
            self.mono = time.monotonic
            self.clock = _now


BOOK = CallBook()


def on_stations(old: list[dict[str, Any]] | None, new: list[dict[str, Any]]) -> int:
    """The hook of services/intercom_sync._store. Never raises into the feed."""
    try:
        return BOOK.on_stations(old, new)
    except Exception:  # noqa: BLE001
        log.exception("intercom calls: on_stations failed")
        return 0


def note_command(station_id: str, command: str, principal: Principal, result: dict[str, Any] | None) -> None:
    try:
        BOOK.note_command(station_id, command, principal, result)
    except Exception:  # noqa: BLE001 - the command itself succeeded; the log must never turn it into an error
        log.exception("intercom calls: note_command failed")


def note_door(station_id: str, principal: Principal) -> None:
    try:
        BOOK.note_door(station_id, principal)
    except Exception:  # noqa: BLE001
        log.exception("intercom calls: note_door failed")


# ---------------------------------------------------------------- the log writer

_COLUMNS = ("id", "station_id", "station_name", "rang_at", "observed", "state", "outcome", "answered_at", "answered_via", "answered_by", "answered_by_name",
            "ended_at", "ended_by", "ended_by_name", "door_opened_at", "door_opened_by", "door_opened_by_name", "updated_at")


def write_rows(conn: sqlite3.Connection, rows: list[dict[str, Any]]) -> int:
    """Upsert call rows (the newest snapshot of each call wins; rows arrive in order)."""
    sql = f"INSERT INTO intercom_calls({', '.join(_COLUMNS)}) VALUES ({', '.join('?' for _ in _COLUMNS)}) " \
          f"ON CONFLICT(id) DO UPDATE SET {', '.join(f'{c} = excluded.{c}' for c in _COLUMNS if c != 'id')}"
    for r in rows:
        conn.execute(sql, tuple(r.get(c) for c in _COLUMNS))
    return len(rows)


def flush(db: Database, limit: int = 500) -> int:
    """Write every queued call change in one short transaction (the writer thread calls it; tests and the history read call it)."""
    rows = BOOK.take(limit)
    if not rows:
        return 0

    def _write() -> None:
        with db.connection(label="intercom.calls") as conn:
            write_rows(conn, rows)

    try:
        retry_locked(_write, what="intercom calls", attempts=3, base_s=0.25)
    except Exception:  # noqa: BLE001
        log.exception("intercom calls: %d call changes could not be written", len(rows))
        return 0
    return len(rows)


def close_orphans(conn: sqlite3.Connection, now: dt.datetime | None = None) -> int:
    """At start-up: a call the previous process left open is closed at its last update (`unknown` unless it had been answered), and
    rows past the retention are pruned."""
    now = now or _now()
    n = conn.execute(
        "UPDATE intercom_calls SET state = 'ended', ended_at = updated_at, outcome = CASE WHEN answered_at IS NOT NULL THEN 'answered' ELSE 'unknown' END "
        "WHERE state != 'ended'").rowcount
    conn.execute("DELETE FROM intercom_calls WHERE rang_at < ?", (_iso(now - dt.timedelta(days=RETENTION_DAYS)),))
    return n


class Writer:
    def __init__(self) -> None:
        self.stop = threading.Event()
        self.thread: threading.Thread | None = None
        self.db: Database | None = None

    def start(self, db: Database) -> None:
        if self.thread and self.thread.is_alive():
            return
        self.db = db
        try:
            with db.connection(label="intercom.calls start") as conn:
                close_orphans(conn)
        except Exception:  # noqa: BLE001 - the log is best effort; the banner works from memory
            log.exception("intercom calls: start-up cleanup failed")
        self.stop.clear()
        self.thread = threading.Thread(target=self._loop, name="intercom-calls", daemon=True)
        self.thread.start()

    def _loop(self) -> None:
        last_prune = time.monotonic()
        while not self.stop.wait(0.5):
            if self.db is None:
                continue
            if BOOK.pending():
                flush(self.db)
            if time.monotonic() - last_prune > 86400:
                last_prune = time.monotonic()
                try:
                    with self.db.connection(label="intercom.calls prune") as conn:
                        conn.execute("DELETE FROM intercom_calls WHERE rang_at < ?", (_iso(_now() - dt.timedelta(days=RETENTION_DAYS)),))
                except Exception:  # noqa: BLE001
                    log.exception("intercom calls: prune failed")
        if self.db is not None:
            flush(self.db)

    def shutdown(self) -> None:
        self.stop.set()
        if self.thread:
            self.thread.join(timeout=3)


WRITER = Writer()


# ---------------------------------------------------------------- the banner setting

def load_settings(conn: sqlite3.Connection) -> dict[str, Any]:
    """The stored setting, normalised; anything unreadable reads as the default (OFF)."""
    try:
        raw = json.loads(get_setting(conn, SETTING_KEY, "") or "{}")
    except (ValueError, TypeError):
        raw = {}
    if not isinstance(raw, dict):
        raw = {}
    mode = raw.get("mode") if raw.get("mode") in MODES else "off"
    roles = [r for r in raw.get("roles") or [] if isinstance(r, str) and r][:50] if isinstance(raw.get("roles"), list) else []
    stations = [s for s in raw.get("stations") or [] if isinstance(s, str) and s][:200] if isinstance(raw.get("stations"), list) else []
    sound = raw.get("sound") if isinstance(raw.get("sound"), bool) else True
    return {"mode": mode, "roles": roles, "stations": stations, "sound": sound}


class SettingsInvalid(ValueError):
    def __init__(self, field_name: str, message: str) -> None:
        super().__init__(message)
        self.field = field_name


def validate_settings(body: Any, known_roles: set[str]) -> dict[str, Any]:
    if not isinstance(body, dict) or set(body) - {"mode", "roles", "stations", "sound"}:
        raise SettingsInvalid("body", "שדה לא מוכר בהגדרה.")
    mode = body.get("mode", "off")
    if mode not in MODES:
        raise SettingsInvalid("mode", "מצב לא מוכר.")
    roles = body.get("roles", [])
    if not isinstance(roles, list) or len(roles) > 50 or any(not isinstance(r, str) or r not in known_roles for r in roles):
        raise SettingsInvalid("roles", "תפקיד לא מוכר.")
    stations = body.get("stations", [])
    if not isinstance(stations, list) or len(stations) > 200 or any(not isinstance(s, str) or not s or len(s) > 128 for s in stations):
        raise SettingsInvalid("stations", "רשימת עמדות לא תקינה.")
    sound = body.get("sound", True)
    if not isinstance(sound, bool):
        raise SettingsInvalid("sound", "ערך צליל לא תקין.")
    if mode == "roles" and not roles:
        raise SettingsInvalid("roles", "יש לבחור לפחות תפקיד אחד.")
    return {"mode": mode, "roles": list(dict.fromkeys(roles)), "stations": list(dict.fromkeys(stations)), "sound": sound}


def save_settings(conn: sqlite3.Connection, value: dict[str, Any]) -> None:
    set_setting(conn, SETTING_KEY, json.dumps(value, ensure_ascii=False, sort_keys=True))


def role_ids(conn: sqlite3.Connection, principal: Principal) -> set[str]:
    """The roles this principal holds through an active ALLOW binding (any scope, directly or through a group)."""
    return {str(b["role_id"]) for b in _active_bindings(conn, principal) if b["effect"] == "allow"}


def applies_to(conn: sqlite3.Connection, principal: Principal, cfg: dict[str, Any]) -> bool:
    """Whether the banner is on for this principal at all (before the per-station rights)."""
    if cfg["mode"] == "off":
        return False
    if cfg["mode"] == "roles":
        return bool(role_ids(conn, principal) & set(cfg["roles"]))
    return True


def sound_for(conn: sqlite3.Connection, cfg: dict[str, Any], now: dt.datetime | None = None) -> tuple[str, str | None]:
    """`ring` or `silent`, and why silent. The quiet hours hold the ring unless the doorbell's severity passes them for push (the
    administrator's pass-through matrix, the same rule the push channel follows). Quiet windows never hold a doorbell. The sound is an
    ordinary in-page tone: a doorbell never qualifies for the critical, do-not-disturb-bypassing sound."""
    if not cfg.get("sound", True):
        return "silent", "setting_off"
    try:
        from ..routers.settings import read_settings
        from . import notify_settings as nsettings
        from .notify_policy import get_policy

        st = nsettings.load(conn)
        tz = read_settings(conn)["time.zone"]
        if nsettings.in_quiet_hours(st["quiet"], now or _now(), tz):
            policy = get_policy(conn, "door.ring") or {}
            severity = policy.get("severity") or "alert"
            if not (st.get("pass_through") or {}).get(severity, {}).get("webpush"):
                return "silent", "quiet_hours"
    except Exception:  # noqa: BLE001 - an unreadable notification setting never silences a doorbell (fail open, as quiet_windows does)
        log.exception("intercom calls: the quiet-hours check failed; the ring sounds")
    return "ring", None


def active_for(conn: sqlite3.Connection, principal: Principal, *, stations: dict[str, dict[str, Any]], camera: dict[str, str], doors: dict[str, bool],
               cfg: dict[str, Any] | None = None, now_mono: float | None = None) -> dict[str, Any]:
    """The banner's read for one principal: the ringing calls of the stations this principal may answer (and the calls this principal
    answered from Arx, so the answering screen keeps its controls), plus the sound decision."""
    from . import intercom_authority as ia

    cfg = cfg or load_settings(conn)
    enabled = applies_to(conn, principal, cfg)
    out: dict[str, Any] = {"enabled": enabled, "mode": cfg["mode"], "calls": []}
    sound, why = sound_for(conn, cfg)
    out["sound"], out["sound_reason"] = sound, why
    if not enabled:
        return out
    auth = ia.Authority(conn, principal)
    limit = set(cfg["stations"])
    now = BOOK.clock()
    for c in sorted(BOOK.open_calls(), key=lambda c: c.rang_at, reverse=True):
        if limit and c.station_id not in limit:
            continue
        mine = c.state == "in_call" and c.answered_via == "arx" and c.answered_by == principal.user_id
        if c.state != "ringing" and not mine:
            continue
        if not (auth.station(READ_PERMISSION, c.station_id) and auth.station(CALL_PERMISSION, c.station_id)):
            continue
        s = stations.get(c.station_id) or {}
        since = parse_utc(c.answered_at if mine and c.answered_at else c.rang_at)
        out["calls"].append({
            "call_id": c.id,
            "station_id": c.station_id,
            "station_name": s.get("name") or c.station_name,
            "state": c.state,
            "rang_at": c.rang_at,
            "answered_at": c.answered_at,
            "answered_by_me": mine,
            "elapsed_s": max(0, int((now - since).total_seconds())),
            "online": bool(s.get("online")),
            "has_camera": bool(s.get("has_camera")),
            "still": camera.get(c.station_id) == "ready",
            "can_open_door": bool(doors.get(c.station_id)) and bool(s.get("lock_enabled")) and bool(s.get("locks")),
            "locks": [{"physical_index": lk.get("physical_index"), "name": lk.get("name")} for lk in (s.get("locks") or []) if isinstance(lk, dict)],
        })
    return out


def history(conn: sqlite3.Connection, principal: Principal, station_id: str | None, limit: int = 20, before: str | None = None) -> list[dict[str, Any]]:
    """The call log, newest first, of the stations this principal may read the activity of (access.read and access.events.read or
    access.call on the station's chain). A row of a station the principal may not see is left out, never greyed."""
    from . import intercom_authority as ia

    auth = ia.Authority(conn, principal)
    limit = max(1, min(int(limit), MAX_LIST))
    sql = "SELECT * FROM intercom_calls WHERE 1 = 1"
    args: list[Any] = []
    if station_id:
        sql += " AND station_id = ?"
        args.append(station_id)
    if before:
        sql += " AND rang_at < ?"
        args.append(before)
    sql += " ORDER BY rang_at DESC, rowid DESC LIMIT ?"
    args.append(limit * 4 if not station_id else limit)
    out: list[dict[str, Any]] = []
    allowed: dict[str, bool] = {}
    for r in conn.execute(sql, args).fetchall():
        sid = r["station_id"]
        if sid not in allowed:
            allowed[sid] = auth.station(READ_PERMISSION, sid) and any(auth.station(p, sid) for p in HISTORY_PERMISSIONS)
        if not allowed[sid]:
            continue
        out.append({k: r[k] for k in _COLUMNS if k not in ("answered_by", "ended_by", "door_opened_by")} | {"answered_by_me": r["answered_by"] == principal.user_id})
        if len(out) >= limit:
            break
    return out
