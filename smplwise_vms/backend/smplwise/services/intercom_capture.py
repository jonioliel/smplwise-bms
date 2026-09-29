"""Card capture sessions (CR-005 phase 2, slice A2): reading a presented card's number from a WisKey door station's
reader into the person editor - the product's first long-running physical interaction.

WisKey keeps each capture session in its own memory (access/enrollment.py `CardEnrollment`): `cards/capture_start` puts
the station's reader into card-collection mode through a background collector (70 s overall, one 30 s device request),
the session lives SESSION_S (WisKey's `SESSION_SECONDS`, 120 s), is polled by id (`cards/capture_status`), cancelled
(`cards/capture_cancel`) or approved (`cards/capture_confirm`, which adds the collected card to the person - the number
itself never leaves WisKey; the status shows it masked, `•••• 1234`). WisKey allows one session per station and three
across all its users, and it owns every session by the HA user that started it - which, for everything SMPLWISE sends,
is the add-on's single HA user. So SMPLWISE keeps its own map from WisKey's `session_id` to the SMPLWISE user who
started it (`owner`), and serves, cancels or confirms a session only for that user: to anyone else it does not exist.

The browser never polls WisKey. One poller thread here reads each active session's status every POLL_S (POLL_BUSY_S
while more than one session is followed; paid from a small bucket of its own, never a user's) in the feed's
capture lane (intercom_sync `capture_read`: its own slot and rate buckets, so neither a capture nor its polling can
take a door release's or a people save's slot) and keeps the result in memory; the owner's browser reads that copy
(`GET /intercom/card-capture/{id}`, SMPLWISE-local, no WisKey traffic). The masked number is kept only in this
in-memory copy and goes only into the owner's replies - never into the audit log, a log line or a broadcast.

Server-side limits mirror WisKey's: a session is `expired` once WisKey's own 120 s TTL has passed (it drops it then),
the collection countdown is WisKey's 70 s. A session whose owner stopped asking for it for ABANDON_S (the dialog closed
without its cancel arriving, the browser went away) is cancelled by the backend itself. At most one active capture
per station and per SMPLWISE user. After a start whose outcome is unknown the station is held for the rest of WisKey's
120 s: a session SMPLWISE cannot see may be keeping the reader in collection mode there.

Every start / cancel / confirm is audited by the router under the real actor; the terminal results the poller sees
(`captured`, WisKey's `error` - `capture_timeout` among them -, `expired`, `lost`) and the backend's own cancel of an
abandoned session are audited here, under the owner (`intercom.card_capture.result` / `.cancel`)."""
from __future__ import annotations

import datetime
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable

from ..audit import audit
from ..db import Database, now_iso
from ..errors import ApiError
from ..rbac import Principal
from . import intercom_client, intercom_sync

log = logging.getLogger("smplwise.intercom")

SESSION_S = 120.0  # WisKey enrollment.SESSION_SECONDS: WisKey drops the session (unless applying) after this long
# the countdown the dialog shows: WisKey's collector waits for ONE card with a 30 s device request deadline
# (client/capture.py `deadline=30`; WisKey's own copy: "the request waits up to 30 s"). WisKey's overall bound of 70 s
# (enrollment._collect) also covers re-reading the capabilities; its `capture_timeout` is what ends the wait.
COLLECT_S = 30.0
EXPIRE_GRACE_S = 3.0  # a session is called expired this long after WisKey's own TTL (its timer may run a little late)
POLL_S = 2.0  # the poller's status read per active session (WisKey's own panel polls every 1.0 s per open dialog)
POLL_BUSY_S = 3.0  # ... and while more than one session is followed (at most 3 x 1/3 s = 1 read/s against WisKey)
CAPTURED_POLL_S = 5.0  # a collected card waits for approval: WisKey's session changes no more, only its TTL runs
ABANDON_S = 20.0  # no status read from the owner this long -> the backend cancels the session itself
KEEP_DONE_S = 300.0  # a finished session stays readable by its owner this long (the final state), then it is forgotten
POLLED = ("preparing", "waiting", "captured")  # WisKey states the poller follows
ACTIVE = (*POLLED, "applying")  # a session that still holds its station and its owner's one slot
# SMPLWISE's own terminal states: WisKey's `error`; `cancelled` (WisKey confirmed the cancel); `cancel_unknown` (the
# cancel was sent, no clear answer); `expired` (WisKey's 120 s passed); `lost` (WisKey no longer knows the session
# before its TTL - HA restarted, the station detached); `confirmed` (the card was added); `unconfirmed` (the confirm
# was sent, no clear answer); `closed` (WisKey refused the confirm and dropped the session)
TERMINAL = ("error", "cancelled", "cancel_unknown", "expired", "lost", "confirmed", "unconfirmed", "closed")
# states in which WisKey may still be driving the reader, or the reader's own (firmware-controlled, UNVERIFIED)
# collection timeout may still run: the UI says so instead of "done"
MAYBE_COLLECTING = ("preparing", "waiting", "cancel_unknown", "lost")


@dataclass(eq=False)
class Capture:
    session_id: str
    owner: Principal
    person_id: str
    station_id: str
    station_name: str | None
    reader_id: int
    revision: int
    settings: Any
    db: Database
    started: float = field(default_factory=time.monotonic)
    started_at: str = field(default_factory=now_iso)
    state: str = "preparing"
    error: str | None = None
    card: dict[str, Any] | None = None  # WisKey's masked public form only; never audited, never logged
    last_seen: float = field(default_factory=time.monotonic)
    last_poll: float = 0.0
    ended: float | None = None
    reason: str | None = None  # why SMPLWISE itself ended it: `abandoned` (nobody asked for it for ABANDON_S)

    def elapsed(self, now: float | None = None) -> float:
        return (time.monotonic() if now is None else now) - self.started


@dataclass(eq=False)
class _Reservation:
    token: str
    owner: str
    station_id: str
    since: float = field(default_factory=time.monotonic)


class CaptureRegistry:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._sessions: dict[str, Capture] = {}
        self._pending: dict[str, _Reservation] = {}
        self._holds: dict[str, float] = {}  # station id -> monotonic time until which a start there is refused
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()

    # -- reservations (the router, before sending cards/capture_start)
    def reserve(self, owner: str, station_id: str) -> str:
        """One active capture per SMPLWISE user and per station, counting starts still in flight. Raises the refusal
        (an ApiError the router audits as `not_sent`)."""
        now = time.monotonic()
        with self._lock:
            active = [c for c in self._sessions.values() if c.state in ACTIVE]
            pending = list(self._pending.values())
            if any(c.owner.user_id == owner for c in active) or any(r.owner == owner for r in pending):
                raise ApiError(409, "intercom_capture_user_busy", "כבר פתוחה לכם קריאת כרטיס אחרת. סיימו או בטלו אותה לפני שמתחילים חדשה.")
            if any(c.station_id == station_id for c in active) or any(r.station_id == station_id for r in pending):
                raise ApiError(409, "intercom_capture_station_busy", "בעמדה הזו כבר פתוחה קריאת כרטיס (של משתמש אחר ב־Arx). הקורא לא הופעל שוב.")
            hold = self._holds.get(station_id, 0.0)
            if hold > now:
                wait = hold - now
                raise ApiError(409, "intercom_capture_station_busy", f"קריאת כרטיס קודמת בעמדה הזו הסתיימה בתוצאה לא ידועה, וייתכן שהקורא עדיין במצב קריאה. המתינו עד {int(wait) + 1} שניות ונסו שוב.", details={"retry_after_s": round(wait, 1)})
            token = uuid.uuid4().hex
            self._pending[token] = _Reservation(token, owner, station_id)
            return token

    def release(self, token: str) -> None:
        with self._lock:
            self._pending.pop(token, None)

    def hold_unknown(self, token: str) -> float:
        """A start whose outcome is unknown: the owner's slot is free again (there is no session they could follow),
        the station stays held for WisKey's whole TTL. Returns the hold in seconds."""
        with self._lock:
            reservation = self._pending.pop(token, None)
            if reservation is None:
                return 0.0
            until = reservation.since + SESSION_S
            self._holds[reservation.station_id] = max(self._holds.get(reservation.station_id, 0.0), until)
            return max(0.0, until - time.monotonic())

    def register(self, token: str, session: dict[str, Any], owner: Principal, person_id: str, station_id: str, station_name: str | None,
                 reader_id: int, revision: int, settings: Any, db: Database) -> Capture:
        """WisKey answered the start with a session: it is the owner's from now on, and the poller follows it."""
        with self._lock:
            reservation = self._pending.pop(token, None)
            capture = Capture(session["session_id"], owner, person_id, station_id, station_name, reader_id, revision, settings, db,
                              started=reservation.since if reservation else time.monotonic(), state=session["state"] if session["state"] in POLLED else "preparing")
            self._sessions[capture.session_id] = capture
            self._ensure_poller()
        return capture

    # -- the owner's access
    def owned(self, session_id: str, owner: str, touch: bool = True) -> Capture | None:
        """The session if `owner` started it, else None - a session of another SMPLWISE user does not exist for them."""
        with self._lock:
            capture = self._sessions.get(session_id)
            if capture is None or capture.owner.user_id != owner:
                return None
            if touch:
                capture.last_seen = time.monotonic()
            return capture

    def view(self, capture: Capture) -> dict[str, Any]:
        """What the owner's browser gets: the state, WisKey's error code, the collected card in WisKey's masked form,
        and the countdowns computed here on the server's own monotonic clock."""
        now = time.monotonic()
        with self._lock:
            elapsed = capture.elapsed(now)
            state = capture.state
            return {
                "session_id": capture.session_id,
                "person_id": capture.person_id,
                "station_id": capture.station_id,
                "station_name": capture.station_name,
                "reader_id": capture.reader_id,
                "state": state,
                "active": state in ACTIVE,
                "error": capture.error,
                "reason": capture.reason,
                "card": dict(capture.card) if capture.card and state in ("captured", "applying") else None,
                "started_at": capture.started_at,
                "elapsed_s": round(elapsed, 1),
                "collect_remaining_s": round(max(0.0, COLLECT_S - elapsed), 1) if state in ("preparing", "waiting") else None,
                "session_remaining_s": round(max(0.0, SESSION_S - elapsed), 1),
                # WisKey may still drive the reader, or its firmware collection timeout (UNVERIFIED) may still run
                "reader_may_be_collecting": state in MAYBE_COLLECTING and elapsed < SESSION_S,
            }

    def set_state(self, capture: Capture, state: str, error: str | None = None, *, only_from: tuple[str, ...] | None = None, reason: str | None = None) -> bool:
        """Move the session to `state` (atomically, and only from one of `only_from` when given). A terminal state
        drops the collected card's masked form from memory. Returns whether it moved."""
        with self._lock:
            if only_from is not None and capture.state not in only_from:
                return False
            capture.state = state
            capture.error = error
            capture.reason = reason
            if state in TERMINAL:
                capture.ended = time.monotonic()
                capture.card = None
                if state in ("cancel_unknown", "unconfirmed"):
                    # WisKey may still hold the session (and the station) until its own TTL
                    self._holds[capture.station_id] = max(self._holds.get(capture.station_id, 0.0), capture.started + SESSION_S)
            return True

    def begin_applying(self, capture: Capture) -> bool:
        """The owner's confirm is about to be sent: only from `captured`, and the poller leaves the session alone."""
        with self._lock:
            if capture.state != "captured":
                return False
            capture.state = "applying"
            return True

    def back_to_captured(self, capture: Capture) -> None:
        """WisKey refused the confirm at once (`capture_not_ready`, `invalid_text`) or it was not sent: its session is
        unchanged, the card still waits for approval."""
        with self._lock:
            if capture.state == "applying":
                capture.state = "captured"

    def clear(self) -> None:
        """Forget everything (tests; a fresh process state). The poller thread ends on its own."""
        with self._lock:
            self._sessions.clear()
            self._pending.clear()
            self._holds.clear()
            self._stop.set()
            self._thread = None
        self._stop = threading.Event()

    # -- the poller
    def _ensure_poller(self) -> None:
        """Called with the lock held."""
        if self._thread is None or not self._thread.is_alive():
            self._thread = threading.Thread(target=self._run, args=(self._stop,), name="intercom-capture", daemon=True)
            self._thread.start()

    def _run(self, stop: threading.Event) -> None:
        while not stop.is_set():
            now = time.monotonic()
            with self._lock:
                if self._thread is not threading.current_thread():
                    return
                for sid in [sid for sid, c in self._sessions.items() if c.ended is not None and now - c.ended > KEEP_DONE_S]:
                    del self._sessions[sid]
                for station in [s for s, until in self._holds.items() if until <= now]:
                    del self._holds[station]
                followed = [c for c in self._sessions.values() if c.state in POLLED]
                busy = len(followed) > 1
                if not followed and not self._pending:
                    self._thread = None
                    return
            for capture in followed:
                try:
                    self._tick(capture, time.monotonic(), busy)
                except Exception:  # noqa: BLE001 - one session's failure must not stop the others being followed
                    log.exception("card capture poller: session follow-up failed")
            stop.wait(POLL_S / 3)

    def _tick(self, capture: Capture, now: float, busy: bool = False) -> None:
        elapsed = capture.elapsed(now)
        if elapsed >= SESSION_S + EXPIRE_GRACE_S:
            self._finish_polled(capture, "expired", None)
            return
        if now - capture.last_seen > ABANDON_S:
            self._abandon(capture)
            return
        interval = CAPTURED_POLL_S if capture.state == "captured" else POLL_BUSY_S if busy else POLL_S
        if now - capture.last_poll < interval:
            return
        capture.last_poll = now
        session_id = capture.session_id
        then: list[Callable[[], None]] = []  # audits and WisKey cleanups, once the lane's slot is free again

        def record(reply: dict[str, Any], outcome: str) -> None:
            """The read's result, recorded while the capture lane's slot is still this read's (intercom_sync._execute):
            no cancel of the owner's can reach WisKey between this read's answer and this record (T054)."""
            if outcome == "ok":
                status = reply["capture"]
                with self._lock:
                    if capture.state not in POLLED:
                        return  # cancelled / confirming meanwhile: this read is stale
                    previous = capture.state
                    if status["state"] in ("preparing", "waiting"):
                        capture.state = status["state"]
                        return
                    if status["state"] == "captured":
                        capture.card = status["card"]
                        capture.state = "captured"
                        if previous != "captured":
                            card = status["card"] or {}
                            extra = {"technology": card.get("technology"), "card_reader_id": card.get("reader_id")}
                            then.append(lambda: self._audit_result(capture, "captured", None, extra))
                        return
                if status["state"] == "error":
                    error = status["error"] or "capture_failed"
                    if self.set_state(capture, "error", error, only_from=POLLED):
                        then.append(lambda: self._polled_finished(capture, "error", error))
                return  # `applying`: only this owner's confirm causes it, and that is not followed here
            if outcome == "refused" and reply.get("last_error") == "capture_not_found":
                # WisKey no longer has the session: its TTL passed, or it went away early (HA restarted, the station detached)
                state = "expired" if elapsed >= SESSION_S - 2 * POLL_S else "lost"
                if self.set_state(capture, state, None, only_from=POLLED):
                    then.append(lambda: self._polled_finished(capture, state, None))
            # anything else (busy, rate limited, the feed reconnecting, a timeout): try again on the next tick - WisKey
            # keeps its sessions per HA user, not per connection, so a reconnect does not end them

        intercom_sync.SYNC.capture_read(capture.settings, lambda call: intercom_client.capture_status(call, session_id), intercom_sync.project_capture_session, capture.owner.user_id,
                                        on_result=record)
        for step in then:
            step()

    def _finish_polled(self, capture: Capture, state: str, error: str | None) -> None:
        if not self.set_state(capture, state, error, only_from=POLLED):
            return  # the owner cancelled or confirmed meanwhile: that path records its own outcome
        self._polled_finished(capture, state, error)

    def _polled_finished(self, capture: Capture, state: str, error: str | None) -> None:
        """What follows a terminal state the poller recorded: WisKey's failed session let go, the result audited."""
        outcome = "timeout" if error == "capture_timeout" else state
        extra: dict[str, Any] = {}
        if state == "error":
            # WisKey keeps a failed session - and with it the station's one capture slot - until its 120 s TTL; its own
            # panel cancels it when the dialog closes or collects again. The collector is already over, so this cancel
            # only frees the slot; its outcome goes into the same row.
            extra["cleanup"] = self._release_wiskey_session(capture)
        self._audit_result(capture, outcome, error, extra)

    def _release_wiskey_session(self, capture: Capture) -> str:
        session_id = capture.session_id
        not_after = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=15)
        try:
            intercom_sync.SYNC.action(capture.settings, "cancelled", lambda call: intercom_client.capture_cancel(call, session_id), intercom_sync.project_cancelled,
                                      who=capture.owner.user_id, not_after=not_after, lane="capture", slot_wait=intercom_sync.CAPTURE_SLOT_WAIT_S, free=True)
        except ApiError as exc:
            return str(exc.details.get("outcome") or "unknown")
        return "cancelled"

    def _abandon(self, capture: Capture) -> None:
        """The owner's browser stopped asking (dialog left without its cancel, tab closed): cancel it ourselves - once
        WisKey answered it; a cancel that was not sent (busy, rate limited, the feed reconnecting) is tried again
        shortly, until WisKey's own TTL ends the session anyway."""
        with self._lock:
            if capture.state not in POLLED:
                return
        session_id = capture.session_id
        not_after = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=15)
        trigger = {"trigger": "abandoned"}
        moved: dict[str, bool] = {}

        def record(reply: dict[str, Any], outcome: str) -> None:
            # while the capture lane's slot is still this cancel's (intercom_sync._execute), like the owner's own cancel
            if outcome == "ok":
                moved["to"] = self.set_state(capture, "cancelled", None, only_from=POLLED, reason="abandoned")
            elif outcome == "refused" and reply.get("last_error") == "capture_not_found":
                moved["to"] = self.set_state(capture, "lost", None, only_from=POLLED, reason="abandoned")
            elif outcome == "unknown":
                moved["to"] = self.set_state(capture, "cancel_unknown", None, only_from=POLLED, reason="abandoned")

        try:
            intercom_sync.SYNC.action(capture.settings, "cancelled", lambda call: intercom_client.capture_cancel(call, session_id), intercom_sync.project_cancelled,
                                      who=capture.owner.user_id, not_after=not_after, lane="capture", slot_wait=intercom_sync.CAPTURE_SLOT_WAIT_S, free=True,
                                      on_result=record)
        except ApiError as exc:
            outcome = str(exc.details.get("outcome") or "unknown")
            code = str(exc.details.get("wiskey_code") or exc.code)
            if outcome == "refused" and code == "capture_not_found":
                if moved.get("to"):
                    self._audit(capture, "intercom.card_capture.cancel", "refused", code, trigger)
                return
            if outcome in ("not_sent", "refused"):
                capture.last_seen = time.monotonic() - ABANDON_S + 2 * POLL_S  # nothing was cancelled: try again shortly
                return
            if moved.get("to"):
                self._audit(capture, "intercom.card_capture.cancel", "unknown", code, trigger)
            return
        if moved.get("to"):
            self._audit(capture, "intercom.card_capture.cancel", "ok", None, trigger)

    def _audit_result(self, capture: Capture, outcome: str, error: str | None, extra: dict[str, Any]) -> None:
        self._audit(capture, "intercom.card_capture.result", outcome, error, extra)

    def _audit(self, capture: Capture, action: str, outcome: str, reason: str | None, extra: dict[str, Any]) -> None:
        """One row under the session's owner. The collected card's number - even masked - is never part of it."""
        details = {
            "command": action.removeprefix("intercom."), "phase": "outcome", "outcome": outcome, "session_id": capture.session_id,
            "person_id": capture.person_id, "station_id": capture.station_id, "station_name": capture.station_name, "reader_id": capture.reader_id,
            "elapsed_s": round(capture.elapsed(), 1), **extra,
        }
        try:
            with capture.db.write_aside() as w:
                audit(w, actor=capture.owner, action=action, decision="allowed", resource_type="intercom_capture", resource_id=capture.session_id, reason=reason, details=details)
        except Exception:  # noqa: BLE001 - best effort, like the physical actions' outcome rows
            log.exception("audit: the card capture %s row (%s) could not be recorded", action, outcome)


CAPTURES = CaptureRegistry()
