"""WKAUDIN-295: listening to a station (its audio TO Arx) - the setting, the session registry and the provider hook.

The setting `access.station_listen` is OFF by default (owner): `off` | `on` | `probe`.
- `on`: a listen session opens only when the station's descriptor says `audio.listen` (WisKey's descriptor leaves it unknown until
  measured, so a real station stays unavailable until WisKey publishes it);
- `probe`: the administrator's switch for a shared session with the owner: the descriptor's unknown is accepted and the attempt is made
  (the downlink itself is still WisKey's: until its contract exists the attempt answers `downlink_pending`).

A listen session is read-only toward the station (nothing is sent to it), needs `access.call` on the station like talk (the owner's
rule: the call permission covers talk and listening), is one per user and at most MAX_PER_STATION per station, ends by the browser's
stop, the expiry, a lost permission, the setting turned off or the upstream closing, and writes one start row and one end row
(`intercom.listen.start` / `intercom.listen.end`: who, which station, duration, frame count, outcome - never audio content).
Nothing is recorded, stored or served again: a frame goes from the downlink's small queue to the socket and is gone.
"""
from __future__ import annotations

import hashlib
import logging
import secrets
import threading
import time
from dataclasses import dataclass
from typing import Any

from ..config import Settings
from ..db import get_setting
from . import intercom_media as im
from . import wiskey_listen_adapter as adapter

log = logging.getLogger("smplwise.intercom.listen")

LISTEN_SETTING = "access.station_listen"
LISTEN_MODES = ("off", "on", "probe")
LISTEN_DEFAULT = "off"
MAX_PER_STATION = 4
RESERVE_S = 15.0  # a started session must attach its socket within this time


def listen_mode(conn: Any) -> str:
    """`off` | `on` | `probe`; anything unreadable is `off` (fail closed)."""
    try:
        value = str(get_setting(conn, LISTEN_SETTING, LISTEN_DEFAULT))
    except Exception as exc:  # noqa: BLE001 - fail closed
        log.warning("station listen: setting unreadable (%s); off", type(exc).__name__)
        return "off"
    return value if value in LISTEN_MODES else "off"


def provider_listen_open(provider: Any, settings: Settings, station_id: str, descriptor: im.Descriptor, *, actor_id: str, actor_name: str,
                         request_id: str | None, expires_at: float | None) -> adapter.ListenChannel:
    """The provider's listen channel; a provider without one (Arx's local source) cannot be listened to."""
    opener = getattr(provider, "listen_open", None)
    if opener is None:
        raise adapter.ListenUnavailable("listen_unsupported")
    return opener(settings, station_id, descriptor, actor_id=actor_id, actor_name=actor_name, request_id=request_id, expires_at=expires_at)


def availability(mode: str, descriptor: im.Descriptor | None, provider: Any) -> tuple[bool, str | None]:
    """Whether the drawer may offer listening: (available, reason). The caller's permission is checked by the router."""
    if mode == "off":
        return False, "off"
    if descriptor is None:
        return False, "unavailable"
    if getattr(provider, "listen_open", None) is None:
        return False, "unsupported"
    if mode == "on" and not descriptor.listen:
        return False, "no_listen"  # the station does not say it can be listened to
    return True, None


@dataclass
class ListenSession:
    id: str
    station_id: str
    user_id: str
    username: str
    request_id: str | None
    mode: str
    created_at: float
    expires_at: float
    attached: bool = False
    opened_at: float | None = None
    closed: bool = False
    outcome: str | None = None
    frames: int = 0
    dropped: int = 0
    stop_requested: str | None = None

    @property
    def ref(self) -> str:
        """What the audit keeps of the session handle: a digest prefix (the handle itself admits its socket)."""
        return hashlib.sha256(self.id.encode()).hexdigest()[:12]


class ListenState:
    """Process-wide, in memory (a restart ends every listen session; nothing is persisted)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.sessions: dict[str, ListenSession] = {}

    def reset(self) -> None:
        with self._lock:
            self.sessions.clear()

    def prune(self, now: float | None = None) -> list[ListenSession]:
        """Sessions that never attached in time or expired: closed here, returned so the caller writes their end rows."""
        now = time.time() if now is None else now
        out: list[ListenSession] = []
        with self._lock:
            for s in list(self.sessions.values()):
                if s.closed:
                    continue
                if (not s.attached and now - s.created_at > RESERVE_S) or now >= s.expires_at:
                    s.closed, s.outcome = True, "never_connected" if not s.attached else "expired"
                    self.sessions.pop(s.id, None)
                    out.append(s)
        return out

    def listeners(self, station_id: str, now: float | None = None) -> int:
        now = time.time() if now is None else now
        with self._lock:
            return sum(1 for s in self.sessions.values() if s.station_id == station_id and not s.closed and (s.attached or now - s.created_at <= RESERVE_S))

    def reserve(self, session: ListenSession) -> str | None:
        """One session per user, MAX_PER_STATION per station; None, or the refusal code."""
        with self._lock:
            live = [s for s in self.sessions.values() if not s.closed]
            if any(s.user_id == session.user_id for s in live):
                return "intercom_listen_user_busy"
            if sum(1 for s in live if s.station_id == session.station_id) >= MAX_PER_STATION:
                return "intercom_listen_busy"
            self.sessions[session.id] = session
            return None

    def get(self, session_id: str) -> ListenSession | None:
        with self._lock:
            s = self.sessions.get(session_id)
            return s if s is not None and not s.closed else None

    def attach(self, session: ListenSession) -> bool:
        with self._lock:
            if session.closed or session.attached:
                return False
            session.attached = True
            return True

    def finish(self, session: ListenSession, outcome: str) -> bool:
        """Closes the session once; True for the call that closed it (that one writes the end row)."""
        with self._lock:
            if session.closed:
                return False
            session.closed, session.outcome = True, outcome
            self.sessions.pop(session.id, None)
            return True


LISTEN = ListenState()


def new_listen(station_id: str, user_id: str, username: str, request_id: str | None, mode: str, *, limit_s: int) -> ListenSession:
    now = time.time()
    return ListenSession(id=secrets.token_urlsafe(24), station_id=station_id, user_id=user_id, username=username, request_id=request_id,
                         mode=mode, created_at=now, expires_at=now + limit_s)
