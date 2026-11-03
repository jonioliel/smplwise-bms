"""WISKEY-JOIN-LIVE-2382: WisKey's direct join follows its two conditions at RUNTIME - no add-on restart.

`wiskey_direct_join.startup` installs the direct join only while (1) `access.station_media_provider = auto` and (2) the pairing key signs
(present, readable, not rotated). Before this module it read the two once, at add-on start, so switching the provider (or pairing,
restoring or rotating the key) changed nothing until a restart, and every native feature behind the join (door windows tier B,
emergency, door automations, the WisKey-checked people CSV, native people writes, template sends, relay-map sync) kept the old state.

`JoinManager` (one per process, `MANAGER`) re-evaluates the two conditions and starts or stops the join through the SAME
`startup` / `shutdown` - the selection rule itself is unchanged and is still checked on every send (`DirectJoin.selected`):

- triggers: the settings save of the provider (`request_reevaluate`, from routers/settings.py), any other caller that changes the key
  (pairing, restore, rotation - they may call `request_reevaluate` too) and a periodic check (`CHECK_EVERY_S`) that catches the rest;
- debounce: a change is applied only when two reads at least `DEBOUNCE_S` apart agree; an unreadable state changes nothing; a failed
  start waits `RETRY_START_S` before the next attempt. A dropped socket is NOT a condition here (the session has its own back-off), so
  network trouble never starts/stops the join;
- start: `startup` (one lineage for the join, opened once per start), then the scope recovery in the background (as at add-on start);
- stop: the capture leases granted over the direct path are revoked first (while that path is still installed), then `shutdown`: the
  globals are restored at once (no new caller picks the join), in-flight requests get `DRAIN_S`, then the socket closes, the loop's
  tasks are cancelled (a request still running settles `unknown`, never re-sent) and the lineage closes last;
- a different signing key while up (re-pair) restarts the join, so a socket authenticated with the old key is never used with the new
  one (the fingerprint is an in-memory hash, never stored or logged);
- every runtime change writes one audit row (`wiskey.direct_join.start` / `.stop`) with the administrator whose save triggered it
  (or no actor for a periodic observation); the add-on start / stop itself writes none (as before).

`join_state()` is the read the status page uses (no I/O to WisKey): state, since, last error, the pending change, the people-write
path and the features that follow the join.

Safety properties kept: the signed path only (`startup`'s rule is the one that installs; nothing unsigned is added), no unsigned
fallback, nothing re-sent (a stopped join refuses new requests `not_sent join_stopped`; an interrupted one stays `unknown`), every new
connection signs with fresh nonces (no frame is replayed across a restart), policy B untouched (no installation, no grant, no switch).
NOT run against a real WisKey."""
from __future__ import annotations

import datetime as dt
import hashlib
import logging
import os
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable

log = logging.getLogger("smplwise.wiskey.join_live")

ENV_THREAD = "SW_WISKEY_JOIN_LIVE_THREAD"  # "0": no background thread (tests call `evaluate` with explicit instants)

OFF_BY_SETTING = "off_by_setting"
KEY_MISSING = "key_missing"
KEY_ROTATED = "key_rotated"
STARTING = "starting"
CONNECTING = "connecting"
UP = "up"
STOPPING = "stopping"
ERROR = "error"
STATES = (OFF_BY_SETTING, KEY_MISSING, KEY_ROTATED, STARTING, CONNECTING, UP, STOPPING, ERROR)

AUDIT_START = "wiskey.direct_join.start"
AUDIT_STOP = "wiskey.direct_join.stop"
LEASE_REASON = {OFF_BY_SETTING: "feature_off", KEY_MISSING: "key_rotation", KEY_ROTATED: "key_rotation", "key_changed": "key_rotation"}

# the features that follow the join, each with the command whose selection it needs (read without I/O for join_state)
FEATURE_COMMANDS: tuple[tuple[str, str], ...] = (
    ("feature_host", "features/start"),          # emergency v2, door automations, live validation
    ("door_programs", "stations/technical_program_save"),  # door windows tier B
    ("people_csv", "features/people_csv_preview"),
    ("templates", "whatsapp/template_send_v1"),
    ("relay_map", "installation/relay_map_stage_v1"),
)


def _utc_iso(value: float) -> str:
    return dt.datetime.fromtimestamp(value, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass(frozen=True)
class Desired:
    """The two config conditions read now. `fingerprint`: an in-memory hash of the signing key (None when it cannot sign)."""

    want: bool
    reason: str  # "ready" | OFF_BY_SETTING | KEY_MISSING | KEY_ROTATED
    fingerprint: str | None = None

    @property
    def key(self) -> tuple[bool, str | None]:
        return (self.want, self.fingerprint if self.want else None)


def read_desired(db: Any) -> Desired:
    """Read (1) the provider and (2) the key with the SAME rules `wiskey_direct_join.startup` uses. Raises when the state is unreadable
    (the manager then changes nothing)."""
    from . import ha_bridge
    from . import wiskey_media_bridge as bridge
    from .intercom_media import provider_choice

    with db.connection(mode="read", label="wiskey join live") as c:
        provider = provider_choice(c)
        key = ha_bridge.signing_key(c) if provider == "auto" else None
    if provider != "auto":
        return Desired(False, OFF_BY_SETTING)
    try:
        text = bridge._key_text(key)  # noqa: SLF001 - the signer's own rule, so the two can never drift apart
    except bridge.MediaBridgeError as exc:
        return Desired(False, KEY_ROTATED if exc.code == "bridge_key_rotated" else KEY_MISSING)
    kid = getattr(key, "kid", "")
    return Desired(True, "ready", hashlib.sha256(f"{kid}\x1f{text}".encode("utf-8")).hexdigest()[:16])


class JoinManager:
    """The supervised lifecycle of the direct join (see the module docstring). Thread-safe; `evaluate` is the one step."""

    DEBOUNCE_S = 3.0
    CHECK_EVERY_S = 15.0
    KICK_POLL_S = 0.5     # after a trigger: re-read this often (the saving request commits a moment after it asked)
    KICK_WINDOW_S = 10.0
    RETRY_START_S = 60.0
    DRAIN_S = 8.0
    LEASE_BUDGET_S = 2.0

    def __init__(self, *, clock: Callable[[], float] = time.monotonic, wall: Callable[[], float] = time.time,
                 reader: Callable[[Any], Desired] = read_desired, startup_kw: dict[str, Any] | None = None) -> None:
        self.clock, self.wall, self.reader = clock, wall, reader
        self.startup_kw = dict(startup_kw or {})  # tests: the fake opener / readers handed to `startup`
        self.recover_in_background = True
        self.db: Any = None
        self.settings: Any = None
        self._lock = threading.RLock()
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.state = OFF_BY_SETTING
        self.since = wall()
        self.last_error: str | None = None
        self._pending: tuple[tuple[bool, str | None], float, Desired] | None = None
        self._fingerprint: str | None = None
        self._actor: Any = None
        self._request_id: str | None = None
        self._trigger: str | None = None
        self._kicked_at = float("-inf")
        self._retry_at = float("-inf")
        self.kicks = 0
        self.transitions = 0

    # -- what others call ------------------------------------------------------------------------------------------------------------
    def boot(self, db: Any, settings: Any, *, thread: bool | None = None) -> Any:
        """Add-on start: the first evaluation at once (no debounce, no audit row - exactly the old `startup` call), then the background
        thread (unless `SW_WISKEY_JOIN_LIVE_THREAD=0`). Returns the installed join or None. Never raises."""
        self.db, self.settings = db, settings
        self._stop.clear()
        try:
            self.evaluate(immediate=True, audited=False)
        except Exception:  # noqa: BLE001 - start-up never fails on it
            log.warning("wiskey join live: the first evaluation failed", exc_info=True)
        if thread is None:
            thread = os.environ.get(ENV_THREAD, "1") != "0"
        if thread and (self._thread is None or not self._thread.is_alive()):
            self._thread = threading.Thread(target=self._run, name="wiskey-join-live", daemon=True)
            self._thread.start()
        from . import wiskey_direct_join as wdj

        return wdj.JOIN

    def request_reevaluate(self, trigger: str, *, actor: Any = None, request_id: str | None = None) -> None:
        """Something that decides the join may have changed (the provider saved, the key paired / restored / rotated). Never blocks, never
        raises, never reads the database here (the caller's transaction may not be committed yet): the manager re-reads shortly."""
        with self._lock:
            self.kicks += 1
            self._kicked_at = self.clock()
            self._trigger = trigger
            if actor is not None:
                self._actor, self._request_id = actor, request_id
        self._wake.set()

    def shutdown(self) -> None:
        """Add-on stop: end the thread, then stop the join (no audit row; the capture leases were revoked by the lease worker's own
        shutdown before this). Never raises."""
        self._stop.set()
        self._wake.set()
        t = self._thread
        if t is not None and t is not threading.current_thread():
            t.join(timeout=self.DRAIN_S + 5)
        self._thread = None
        try:
            from . import wiskey_direct_join as wdj

            with self._lock:
                wdj.shutdown(drain_s=self.DRAIN_S)
        except Exception:  # noqa: BLE001
            log.warning("wiskey join live: stopping the join failed", exc_info=True)

    # -- the one step ----------------------------------------------------------------------------------------------------------------
    def evaluate(self, now: float | None = None, *, immediate: bool = False, audited: bool = True) -> str:
        """Read the conditions and, when a change has held for `DEBOUNCE_S` (or `immediate`), start / stop / restart the join. Returns
        the state. Never raises."""
        with self._lock:
            t = self.clock() if now is None else now
            from . import wiskey_direct_join as wdj

            try:
                desired = self.reader(self.db)
            except Exception as exc:  # noqa: BLE001 - an unreadable state changes nothing (no flapping on a busy database)
                self.last_error = f"state_unreadable:{type(exc).__name__}"
                return self._settle_label()
            join = wdj.JOIN
            on = join is not None
            if on and getattr(join, "origin", None) != wdj.ORIGIN_STARTUP:
                return self._settle_label()  # a join this manager did not install (a test's, a tool's): never touched
            if on and self._fingerprint is None and desired.want:
                self._fingerprint = desired.fingerprint  # a join installed by another caller of `startup` (the automatic installation)
            current = (on, self._fingerprint if on else None)
            if current == desired.key:
                self._pending = None
                if not on:
                    self._set(desired.reason)
                self._clear_trigger()
                return self._settle_label()
            if not immediate:
                if self._pending is None or self._pending[0] != desired.key:
                    self._pending = (desired.key, t, desired)
                    return self._settle_label()
                if t - self._pending[1] < self.DEBOUNCE_S:
                    return self._settle_label()
            if desired.want and t < self._retry_at:
                return self._settle_label()
            self._pending = None
            self._apply(on, desired, t, audited=audited)
            return self._settle_label()

    # -- transitions -----------------------------------------------------------------------------------------------------------------
    def _apply(self, on: bool, desired: Desired, t: float, *, audited: bool) -> None:
        from . import wiskey_direct_join as wdj

        actor, request_id, trigger = self._actor, self._request_id, self._trigger or ("startup" if not audited else "periodic")
        if on:
            reason = desired.reason if not desired.want else "key_changed"
            self._set(STOPPING)
            self._release_leases(LEASE_REASON.get(reason, "feature_off"))
            idle = wdj.shutdown(drain_s=self.DRAIN_S)
            self._fingerprint = None
            self.transitions += 1
            self._set(desired.reason if not desired.want else STARTING)
            log.info("wiskey direct join stopped at runtime (%s, trigger %s, drained %s)", reason, trigger, idle)
            if audited:
                self._audit(AUDIT_STOP, actor, request_id, {"reason": reason, "trigger": trigger, "drained": bool(idle)})
        if desired.want:
            self._set(STARTING)
            try:
                join = wdj.startup(self.db, self.settings, **self.startup_kw)
            except Exception as exc:  # noqa: BLE001 - a failed start is retried after RETRY_START_S, never in a tight loop
                self.last_error = f"start_failed:{type(exc).__name__}"
                self._retry_at = t + self.RETRY_START_S
                self._set(ERROR)
                log.warning("wiskey direct join: the runtime start failed (%s)", type(exc).__name__)
                if audited:
                    self._audit(AUDIT_START, actor, request_id, {"trigger": trigger, "result": "failed", "error": type(exc).__name__},
                                decision="error")
                self._clear_trigger()
                return
            if join is None:  # the conditions changed between the read and startup's own read: the next evaluation decides
                self._set(OFF_BY_SETTING)
                self._clear_trigger()
                return
            self._fingerprint = desired.fingerprint
            self.last_error = None
            self.transitions += 1
            self._set(CONNECTING)
            if self.recover_in_background:
                threading.Thread(target=join.recover_now, name="wiskey-join-recover", daemon=True).start()
            log.info("wiskey direct join started at runtime (trigger %s)", trigger)
            if audited:
                self._audit(AUDIT_START, actor, request_id, {"trigger": trigger, "result": "installed"})
        self._clear_trigger()

    def _release_leases(self, reason: str) -> None:
        """Revoke every live capture lease while the direct path that granted it is still installed (`lease_revoke scope: all`). Bounded
        by LEASE_BUDGET_S; never raises; nothing is sent when nothing is live."""
        try:
            from . import capture_lease as cl
            from . import lease_events

            if not cl.has_live():
                return
            cl.on_authority_change(reason, all=True)
            deadline = self.clock() + self.LEASE_BUDGET_S
            while self.clock() < deadline:
                lease_events.WORKER.step()
                if not any(not p.done for p in lease_events.WORKER.pending):
                    break
                if not lease_events.AUTO_THREAD:
                    break
                time.sleep(0.05)
        except Exception:  # noqa: BLE001
            log.warning("wiskey join live: revoking capture leases before the stop failed", exc_info=True)

    def _audit(self, action: str, actor: Any, request_id: str | None, details: dict[str, Any], decision: str = "allowed") -> None:
        if self.db is None:
            return
        try:
            from ..audit import audit

            with self.db.connection(label="wiskey join live audit") as c:
                audit(c, actor=actor, action=action, decision=decision, resource_type="installation", resource_id="wiskey_direct_join",
                      request_id=request_id, details=details)
        except Exception:  # noqa: BLE001 - the transition happened; a lost audit row is logged, not raised
            log.warning("wiskey join live: the audit row (%s) could not be written", action, exc_info=True)

    # -- state -----------------------------------------------------------------------------------------------------------------------
    def _set(self, state: str) -> None:
        if state != self.state:
            self.state, self.since = state, self.wall()

    def _clear_trigger(self) -> None:
        self._actor = self._request_id = self._trigger = None

    def _settle_label(self) -> str:
        """`up` / `connecting` follow the live socket of an installed join (no I/O); the off states stay as decided."""
        from . import wiskey_direct_join as wdj

        join = wdj.JOIN
        if join is not None and getattr(join, "origin", None) == wdj.ORIGIN_STARTUP and self.state != STOPPING:
            self._set(UP if join.session.connected else CONNECTING)
            err = getattr(join.session, "last_error", None)
            if err:
                self.last_error = err
        return self.state

    def _run(self) -> None:
        last_check = self.clock()
        while not self._stop.is_set():
            now = self.clock()
            kicked = now - self._kicked_at < self.KICK_WINDOW_S
            pending = self._pending is not None
            wait = self.KICK_POLL_S if (kicked or pending) else max(0.0, self.CHECK_EVERY_S - (now - last_check))
            self._wake.wait(timeout=wait)
            self._wake.clear()
            if self._stop.is_set():
                break
            try:
                self.evaluate()
            except Exception:  # noqa: BLE001 - the thread never dies of one evaluation
                log.exception("wiskey join live: evaluation failed")
            last_check = self.clock()

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            self._settle_label()
            pending = None
            if self._pending is not None:
                want = self._pending[2]
                pending = {"to": "start" if want.want else "stop", "reason": want.reason}
            return {"state": self.state, "since": _utc_iso(self.since), "last_error": self.last_error, "pending": pending,
                    "thread": self._thread is not None and self._thread.is_alive()}


MANAGER = JoinManager()


def request_reevaluate(trigger: str, *, actor: Any = None, request_id: str | None = None) -> None:
    """For the settings save of `access.station_media_provider` and for any code that pairs, restores or rotates the signing key."""
    MANAGER.request_reevaluate(trigger, actor=actor, request_id=request_id)


def join_state() -> dict[str, Any]:
    """THE read for the status page ("מצב WisKey"): no I/O to WisKey, never raises.

    {state: off_by_setting | key_missing | key_rotated | starting | connecting | up | stopping | error,
     since: ISO UTC, last_error: code | None, pending: {to, reason} | None, installed: bool,
     people_writes: {path: direct | classic, reason},
     features: {feature_host, door_programs, people_csv, templates, relay_map: {available: bool, reason}}}"""
    from . import wiskey_direct_join as wdj

    try:
        out = MANAGER.snapshot()
    except Exception:  # noqa: BLE001
        out = {"state": ERROR, "since": None, "last_error": "unreadable", "pending": None, "thread": False}
    join = wdj.JOIN
    out["installed"] = join is not None
    out["people_writes"] = wdj.people_path()
    features: dict[str, Any] = {}
    for name, command in FEATURE_COMMANDS:
        if join is None:
            features[name] = {"available": False, "reason": out["state"] if out["state"] in (OFF_BY_SETTING, KEY_MISSING, KEY_ROTATED, ERROR) else "not_installed"}
            continue
        try:
            if not join.configured():
                features[name] = {"available": False, "reason": "not_configured"}
                continue
            why = join.session.transport_refusal(command)
        except Exception:  # noqa: BLE001
            why = "unreadable"
        features[name] = {"available": why is None, "reason": why}
    out["features"] = features
    return out
