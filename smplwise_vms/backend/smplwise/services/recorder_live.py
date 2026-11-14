"""Disable / enable a recorder while the process runs (CR-024, owner decision 2026-10-04: no restart).

`recorder_scope.DISABLED` is the switch every device boundary reads (mode.ensure_nvr, has_host / ready, capabilities), so the
moment a recorder is disabled nothing new reaches it: no discovery, no device call from any route, no recording search, export,
thumbnail or live / playback stream. What was already running is stopped here, after the HTTP answer (FastAPI background task,
never under the database write lock):

- its alert stream (the first recorder's LISTENER, or its own listener) is shut down;
- its open playback sessions are closed and their `smplwise_pb_*` streams deleted;
- its live streams `smplwise_{recorder}_ch{n}_{main|sub}` are deleted from go2rtc by their exact names (nothing outside the
  `smplwise_` namespace is ever touched; the intercom project's streams stay foreign).

Enabling applies at once when this process has the recorder's connection loaded (every recorder that existed at start-up, disabled
or not): the alert stream starts, then one discovery and the stream sync run for it. A recorder added after the start still needs
the restart (connection changes keep restart semantics). Never raises: every step is logged and the next periodic run repairs."""
from __future__ import annotations

import logging
from typing import Any

from ..recorder_scope import PRIMARY, is_disabled, ready, set_disabled, settings_for
from . import autosync
from . import go2rtc as g2

log = logging.getLogger("smplwise.recorder_live")


def stream_names(conn: Any, recorder_id: str) -> list[str]:
    rows = conn.execute("SELECT channel FROM cameras WHERE recorder_id = ? AND channel IS NOT NULL", (recorder_id,)).fetchall()
    return [g2.stream_name(recorder_id, r["channel"], p) for r in rows for p in ("sub", "main")]


def delete_streams(settings: Any, names: list[str]) -> int:
    """Delete our streams by exact name (only `smplwise_` names; only the ones go2rtc lists). Returns how many."""
    if not settings.go2rtc_url or not names:
        return 0
    client = g2.Go2rtc(settings)
    listed = client.list_streams()
    n = 0
    for name in names:
        if name.startswith(g2.STREAM_PREFIX) and name in listed:
            client.delete_stream(name)
            n += 1
    return n


def stop(db: Any, settings: Any, recorder_id: str) -> dict[str, int]:
    """Everything that was running for a recorder that was just disabled (or removed). The caller already set it disabled."""
    out = {"listener": 0, "playback": 0, "streams": 0}
    from . import events_ingest
    from . import playback as pb

    try:
        lst = events_ingest.LISTENER if recorder_id == PRIMARY else events_ingest.EXTRA.get(recorder_id)
        if lst is not None and lst.thread is not None and lst.thread.is_alive():
            lst.shutdown()
            out["listener"] = 1
    except Exception:  # noqa: BLE001
        log.warning("could not stop the alert stream of %s", recorder_id, exc_info=True)
    try:
        for s in list(pb.REGISTRY.sessions.values()):
            if getattr(s, "recorder_id", PRIMARY) == recorder_id and s.state not in ("closed", "expired", "failed"):
                pb.close(settings, s, "closed")
                out["playback"] += 1
    except Exception:  # noqa: BLE001
        log.warning("could not close the playback sessions of %s", recorder_id, exc_info=True)
    try:
        with db.connection(mode="read") as conn:
            names = stream_names(conn, recorder_id)
        out["streams"] = delete_streams(settings, names)
    except Exception:  # noqa: BLE001 - go2rtc down: the next stream sync deletes them (disabled recorders are in its list)
        log.warning("could not delete the go2rtc streams of %s", recorder_id, exc_info=True)
    log.info("recorder %s stopped: %s", recorder_id, out)
    return out


def start(db: Any, settings: Any, recorder_id: str, tz_of: Any = None) -> bool:
    """A recorder that was just enabled: alert stream, one discovery, the stream sync. False = its connection is not loaded in
    this process (added after the start) - it runs after the next restart."""
    if is_disabled(recorder_id):
        return False
    rs = settings_for(settings, recorder_id)
    if not ready(rs):
        return False
    from . import events_ingest

    try:
        if recorder_id == PRIMARY:
            lst = events_ingest.LISTENER
            if lst.db is not None and (lst.thread is None or not lst.thread.is_alive()):
                lst.start(lst.db, lst.settings or settings, lst.tz_getter)
        else:
            getter = tz_of(recorder_id) if tz_of else (lambda: "Asia/Jerusalem")
            events_ingest.start_extra_one(db, settings, recorder_id, getter)
    except Exception:  # noqa: BLE001
        log.warning("could not start the alert stream of %s", recorder_id, exc_info=True)
    try:
        if autosync._discover_one(db, settings, recorder_id, "enabled") and settings.go2rtc_url:
            with db.connection() as conn:
                autosync.ensure_streams(settings, conn, actor=None, reason="enabled")
    except Exception:  # noqa: BLE001
        log.warning("discovery / stream sync after enabling %s failed", recorder_id, exc_info=True)
    return True


def apply(db: Any, settings: Any, recorder_id: str, enabled: bool, tz_of: Any = None) -> None:
    """The background half of `PATCH /recorders/{id}` ({enabled}); the switch itself was flipped in the request."""
    if enabled:
        start(db, settings, recorder_id, tz_of)
    else:
        stop(db, settings, recorder_id)


def flip(recorder_id: str, enabled: bool) -> None:
    set_disabled(recorder_id, not enabled)

