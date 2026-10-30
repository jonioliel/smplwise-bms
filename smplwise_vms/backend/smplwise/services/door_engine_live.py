"""DOORLIVE-2310 (release train 3, owner decisions 2026-10-30): the live wiring of the door engines - NOTHING here acts on a door by itself.

What this module does, and only this:

- `LiveEmergencyEngine` is the process's emergency engine (`door_windows_engine.EMERGENCY_ENGINE_FACTORY`). It resolves the installed
  `wiskey_direct_join.JOIN` on EVERY call and delegates OPEN / release to `wiskey_emergency_direct.DirectEmergencyEngine` (wiskey-emergency-event.v2,
  one NEW request per attempt) only while that join selects `features/start` NOW. Otherwise the call answers `not_sent transport_not_selected` - nothing
  left Arx, nothing is queued, nothing is retried blindly after a reconnect. A `lock_secure` call is `not_implemented` (WisKey v2 has no such command):
  `lock_supported` is False, so the LOCK control is hidden and a real LOCK start is refused (`door_emergency.lock_available`). A RELEASE is never gated
  by a switch or a permit.
- `open_supported` means "wired and configured" (the join exists, provider = auto, the key signs): a dropped socket must not take the OPEN control away
  in the middle of an incident - the attempt itself is what reconnects, and a failure is a visible `not_sent` / `unknown`.
- The door-window programs need no wiring beyond the build flag: `door_windows_engine.WiskeyProgramEngine` already uses `DirectProgramEngine`, which
  sends only over the selected join (`selected(command)`).
- `reconcile_active` (startup, G6): an incident that is still active when the process starts is NOT re-sent. It is audited, flagged `verify_required`
  and announced (`door.emergency.verify`); the person verifies against the access system and releases. `tick` (every worker pass, G10): while a real
  incident is active and the link to the access system is gone, `door.emergency.link_lost` is raised (once per incident) and resolved when it is back.

SR-1 holds: no function here opens a door. Switches that stay OFF by default: `doors.windows.enabled`, `doors.emergency.enabled`,
`doors.emergency.open_enabled` (+ the attestation), `doors.automation_open`. NOT_RUN against a real WisKey."""
from __future__ import annotations

import datetime as dt
import logging
from typing import Any, Callable

from ..audit import audit
from . import door_windows_engine as dwe

log = logging.getLogger("smplwise.door_engine_live")

COMMAND = "features/start"
ACTIVE_STATES = ("applying", "in_effect", "in_effect_partial", "releasing")
SOURCE_VERIFY = "door.emergency.verify"
SOURCE_LINK = "door.emergency.link_lost"

VERIFY: set[str] = set()        # incident ids found active at this process's start (cleared when the incident ends)
LINK_ALERTED: set[str] = set()  # incident ids with an open link-lost notice

_PREVIOUS: Any = None
_INSTALLED: "LiveEmergencyEngine | None" = None


def _join() -> Any:
    from . import wiskey_direct_join as wdj

    return wdj.JOIN


class LiveEmergencyEngine:
    """The `EmergencyEngine` of the running process (see the module docstring)."""

    simulated = False
    lock_supported = False
    transport_timeout_s = 6.0  # < door_emergency.ENGINE_DEADLINE_S (8 s)
    new_request_per_attempt = True  # every retry is a NEW v2 request with retry_of on the same event fence (door_emergency.v2_new_attempts)

    def __init__(self, db: Any, join: Callable[[], Any] = _join) -> None:
        self.db = db
        self._join = join
        self._inner: Any = None
        self._inner_for: Any = None

    # -- readiness (no I/O) ----------------------------------------------------------------------------------------------------------
    def _joined(self) -> Any:
        try:
            return self._join()
        except Exception:  # noqa: BLE001
            return None

    @property
    def open_supported(self) -> bool:
        joined = self._joined()
        return joined is not None and joined.configured()

    def link_up(self, *, connect: bool = False) -> bool:
        """The link to the access system now. `connect=True` lets the join try to (re)open the socket (its own 60 s back-off applies)."""
        joined = self._joined()
        if joined is None or not joined.configured():
            return False
        try:
            if joined.session.connected and joined.session.transport_refusal(COMMAND) is None:
                return True
            return bool(joined.selected(COMMAND)) if connect else False
        except Exception:  # noqa: BLE001
            return False

    # -- EmergencyEngine ---------------------------------------------------------------------------------------------------------------
    def _engine(self, kind: str) -> Any:
        if kind != "open":
            raise dwe.EngineError("not_implemented", "emergency_secure_not_in_event_v2")
        joined = self._joined()
        if joined is None or not joined.selected(COMMAND) or joined.features_or_none() is None:
            raise dwe.EngineError("not_sent", "transport_not_selected")
        if self._inner is None or self._inner_for is not joined:
            self._inner = joined.emergency_engine(lambda: self.db.connection(label="door emergency direct"))
            self._inner_for = joined
        return self._inner

    def apply(self, kind: str, station_id: str, relay: int, request_id: str, reason: str) -> dwe.DoorOutcome:
        return self._engine(kind).apply(kind, station_id, relay, request_id, reason)

    def release(self, kind: str, station_id: str, relay: int, request_id: str) -> dwe.DoorOutcome:
        return self._engine(kind).release(kind, station_id, relay, request_id)


def install(db: Any, settings: Any = None) -> LiveEmergencyEngine | None:  # noqa: ARG001 - settings kept for the factory signature
    """Make the live engine the process's emergency engine - only while the emergency engine is built into this release and the permit is in it.
    Changes no switch."""
    global _PREVIOUS, _INSTALLED
    if not (dwe.go_live_permitted() and dwe.emergency_engine_built()):
        return None
    if _INSTALLED is not None:
        return _INSTALLED
    engine = LiveEmergencyEngine(db)
    _PREVIOUS = dwe.EMERGENCY_ENGINE_FACTORY
    dwe.EMERGENCY_ENGINE_FACTORY = lambda _settings: engine
    _INSTALLED = engine
    return engine


def uninstall() -> None:
    global _PREVIOUS, _INSTALLED
    if _INSTALLED is None:
        return
    dwe.EMERGENCY_ENGINE_FACTORY = _PREVIOUS if _PREVIOUS is not None else dwe._emergency_engine
    _PREVIOUS = None
    _INSTALLED = None
    VERIFY.clear()
    LINK_ALERTED.clear()


def _active_real(conn: Any) -> list[Any]:
    marks = ",".join("?" for _ in ACTIVE_STATES)
    return conn.execute(f"SELECT * FROM door_emergency_incidents WHERE drill = 0 AND state IN ({marks})", ACTIVE_STATES).fetchall()  # noqa: S608


def _notify(conn: Any, source: str, row: Any, *, resolve: bool = False) -> None:
    from . import door_emergency as de
    from . import notify

    iid = row["id"]
    notify.emit(conn, notify.Signal(source, "door", f"emergency:{iid}", dedupe_key=f"{source}:{iid}", params={} if resolve else de._params(conn, row),
                                    origin={"incident_id": iid}, resolve=resolve))


def reconcile_active(db: Any) -> list[str]:
    """G6: at process start every still-active real incident is flagged for verification. Sends NOTHING (never re-sent after a restart)."""
    found: list[str] = []
    try:
        with db.connection() as conn:
            for row in _active_real(conn):
                VERIFY.add(row["id"])
                found.append(row["id"])
                audit(conn, actor=None, action="door.emergency.reconcile", decision="allowed", resource_type="door_emergency", resource_id=row["id"],
                      reason="active_at_startup", details={"state": row["state"], "kind": row["kind"], "doors": row["doors_total"], "sent": False})
                try:
                    _notify(conn, SOURCE_VERIFY, row)
                except Exception:  # noqa: BLE001 - a notice never blocks the reconcile
                    log.warning("door emergency: the verify notice for %s failed", row["id"], exc_info=True)
    except Exception:  # noqa: BLE001
        log.exception("door emergency: the startup reconcile failed")
    return found


def verify_required(incident_id: str | None) -> bool:
    return incident_id is not None and incident_id in VERIFY


def tick(db: Any, now: dt.datetime | None = None) -> dict[str, list[str]]:  # noqa: ARG001 - the clock is not needed; kept for the worker's call shape
    """G10: while a real incident is active and the access link is down, raise the link-lost notice (once per incident); resolve it when the link is back
    or the incident ended. Resolves the verify notice when its incident ended. Reads and notifies only - never sends a door command."""
    out: dict[str, list[str]] = {"link_lost": [], "link_back": [], "verify_resolved": []}
    engine = _INSTALLED
    if engine is None and not VERIFY and not LINK_ALERTED:
        return out
    try:
        with db.connection() as conn:
            rows = {r["id"]: r for r in _active_real(conn)}
            for iid in sorted(VERIFY - set(rows)):
                ended = conn.execute("SELECT * FROM door_emergency_incidents WHERE id = ?", (iid,)).fetchone()
                if ended is not None:
                    _notify(conn, SOURCE_VERIFY, ended, resolve=True)
                VERIFY.discard(iid)
                out["verify_resolved"].append(iid)
            for iid in sorted(LINK_ALERTED - set(rows)):
                ended = conn.execute("SELECT * FROM door_emergency_incidents WHERE id = ?", (iid,)).fetchone()
                if ended is not None:
                    _notify(conn, SOURCE_LINK, ended, resolve=True)
                LINK_ALERTED.discard(iid)
            if rows and engine is not None:
                up = engine.link_up(connect=True)
                for iid, row in rows.items():
                    if not up and iid not in LINK_ALERTED:
                        LINK_ALERTED.add(iid)
                        audit(conn, actor=None, action="door.emergency.link_lost", decision="failed", resource_type="door_emergency", resource_id=iid,
                              reason="no_contact_with_access_system", details={"state": row["state"]})
                        _notify(conn, SOURCE_LINK, row)
                        out["link_lost"].append(iid)
                    elif up and iid in LINK_ALERTED:
                        LINK_ALERTED.discard(iid)
                        _notify(conn, SOURCE_LINK, row, resolve=True)
                        out["link_back"].append(iid)
    except Exception:  # noqa: BLE001 - the watchdog thread never dies of this
        log.exception("door emergency: the link check failed")
    return out


def startup(db: Any, settings: Any) -> dict[str, Any]:
    """Called once after `wiskey_direct_join.startup`. Installs the live engine (when built), flags active incidents. Sends nothing."""
    engine = install(db, settings)
    return {"installed": engine is not None, "verify": reconcile_active(db)}


def readiness(conn: Any, settings: Any) -> dict[str, Any]:
    """The read-only readiness picture (plan 4.4 item 8): flags, switches, what the wiring offers. No I/O to the access system, nothing sent."""
    from . import door_automation as da
    from . import door_emergency as de
    from . import door_windows as dw

    engine = dwe.emergency_engine(settings)
    return {
        "build": {"go_live_permitted": dwe.go_live_permitted(), "program_engine_built": dwe.program_engine_built(),
                  "emergency_engine_built": dwe.emergency_engine_built(), "automation_go_live_permitted": da.go_live_permitted()},
        "switches": {"windows": dw.setting(conn, dw.ENABLED), "emergency": de.setting(conn, de.ENABLED), "emergency_open": de.setting(conn, de.OPEN_ENABLED),
                     "emergency_engine_switch": de.setting(conn, de.ENGINE_SWITCH), "automation_open": da.feature_setting(conn), "attested": de.attested(conn)},
        "wiring": {"emergency_engine": type(engine).__name__, "open_supported": bool(getattr(engine, "open_supported", False)),
                   "lock_supported": getattr(engine, "lock_supported", False) is True, "window_tier": dwe.window_engine(settings).tier},
        "active_incidents_to_verify": sorted(VERIFY),
    }
