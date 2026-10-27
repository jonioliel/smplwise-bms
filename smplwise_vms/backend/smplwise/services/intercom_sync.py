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
screen. B0 (D-006): the same goes for each station's `last_access` (person name, employee number, event identity) and for
every people count: WisKey's `overview` still sends them, this module never keeps, serves or logs them. A person's name
reaches a screen only through the adapter's one-off reads (services/intercom_adapter.py, CR-036 S4). The background (read)
channel proper - its own session, its own account once the owner creates it, and the closed D-006 projection - is
services/wiskey_background_feed.py (the session) and services/wiskey_background.py (the projection); this session is the
service channel (SUPERVISOR_TOKEN) that also carries the writes (D-004).

One-off reads go through `IntercomSync.command`: the request thread schedules the command on this feed's own event loop
and it is sent over the SAME live session, never over a new Home Assistant connection. It runs only while the feed is
`ready`; otherwise the reply carries the feed's own state (`ha_not_configured`, `connecting`, `ha_unavailable`,
`not_installed`, `forbidden`, `error`) and no data. Since CR-036 S4 the stage-1 reads (people, events, groups, schedules,
health, sync, alerts, WisKey's audit ...) are services/intercom_adapter.py's: they ride this socket under the `read` /
`technical` channel guards (wiskey_channels), in this feed's read lane, and pass the projection filter
(services/intercom_authority.py) before anything is served. With the copy this feed keeps each station's closed technical
part and the `api` facts the adapter's feature flags need; a `refresh` push marks the adapter's cached reads stale and a
dropped copy clears them.

Physical actions (CR-005 phase 3: door release, call signal, TTS announcement) take the same road - `IntercomSync.action`
shares `command`'s session, in-flight slots and rate buckets - but anything short of success is raised as an ApiError
that says whether the command was not sent, refused, or sent without an answer (`action_error`). They are never queued
or retried. A TTS announcement is a WisKey subscription: its progress is followed here and relayed to browser clients as
`intercom_tts` notices.

People writes (CR-005 phase 2, slice A1: `users/create` / `users/update` / `users/delete`) take the same road in a
third lane, `config` (one in-flight slot, its own buckets): a people save that WisKey holds for a while can never take
a physical-action slot, so it can never block a door release (brief §0.3). Their editor projections
(`project_person_editor`, `project_editor_context`) are separate from `project_person` / `project_overview` and are
served only under `access.people.manage`, never cached, never broadcast (brief A.5).

Card capture (CR-005 phase 2, slice A2) has a fourth lane, `capture` (one slot, own buckets): `cards/capture_start`,
`cards/capture_cancel` and the capture poller's `cards/capture_status` (`capture_read`; services/intercom_capture.py
owns the sessions). The approval (`cards/capture_confirm`) is a people write in the config lane; the reader read
(`cards/reader_capabilities`) a one-off read with its own timeout."""
from __future__ import annotations

import asyncio
import datetime
import hashlib
import hmac
import json
import logging
import os
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
# WisKey's normalized call states (the coordinator's `normalized`; wiskey-format.ts names each). Anything else - a value a
# newer WisKey adds, or schema drift - is served as `unknown`, never echoed (CR-036 2.2, D-003).
CALL_STATES = frozenset({"idle", "ringing", "in_call", "ending", "unavailable", "unknown"})
# a station's sync states (WisKey access/manager.py); anything else is `unknown` too (CR-036 S4 found it echoed before)
STATION_SYNC_STATES = frozenset({"offline", "pending", "syncing", "synced", "error"})
# one person as the read-only people screens show them. Not kept: `phone`, `cards`, `pin_configured`, `profile`,
# `photo_configured`, `permission_overrides`, `access_timing_*`, `timing_readbacks`, `identity_locked`, `user_type`,
# `sync_reference`, `created_at` / `updated_at`, and each assignment's `last_error` / revisions.
PERSON_KEYS = ("id", "employee_no", "display_name")
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
# physical actions have a lane of their own, so read traffic (an adapter scan spends up to its MAX_SCAN_PAGES tokens) can
# never leave a release or a hang-up `busy` / `rate_limited` (T054 review S5): their own in-flight slots and buckets.
# Totals stay under WisKey's AdminLimiter (8 handlers, burst 30, refill 2/s per HA user) with room for the feed:
# slots 4 + 2 (+ the feed's own overview / subscribe calls), bursts 20 + 8, refills 1.5 + 0.5 per second - at the very
# worst WisKey then answers the feed's own refetch `rate_limited`, which the feed already retries without dropping the
# session. Per user: a guard desk's answer, announcement, release, hang up and the next call's answer all fit the burst.
ACTION_INFLIGHT = 2
ACTION_USER_BURST, ACTION_USER_RATE = 6.0, 0.5
ACTION_GLOBAL_BURST, ACTION_GLOBAL_RATE = 8.0, 0.5
# people writes (CR-005 phase 2) have a third lane: ONE slot, so a save WisKey holds cannot occupy an action slot and
# block a release, and their own buckets (an administrator saving several people in a row fits the burst). Slots stay
# at 4 + 2 + 1 (+ the feed's own) under WisKey's 8 handlers; the three lanes' bursts (20 + 8 + 6) can exceed WisKey's
# 30-token bucket only if all three are drained at once, and WisKey's `rate_limited` on a write is a clean pre-dispatch
# refusal (nothing saved) that the caller simply retries.
CONFIG_INFLIGHT = 1
CONFIG_USER_BURST, CONFIG_USER_RATE = 6.0, 0.5
CONFIG_GLOBAL_BURST, CONFIG_GLOBAL_RATE = 6.0, 0.5
# a people write is WisKey storage only (no device I/O): well within ha_client's 60 s limit
CONFIG_TIMEOUT_S = 35.0
# R3-06 (WisKey round 3, static reading, NOT_RUN): a write this side stopped waiting for is NOT cancelled - WisKey may still save it
# after the 504. Until a fresh read of the same person has answered (sent after the write's call was over), another write to that
# person is refused here, nothing sent: `outcome_pending` while the call is still out, `readback_required` once it is over.
UNSETTLED_CODES = ("outcome_pending", "readback_required")
LATE_KEEP = 50  # how many late answers are kept for diagnostics (ids and codes only)
# card capture (CR-005 phase 2 slice A2) has a fourth lane: ONE slot and its own buckets for `cards/capture_start`,
# `cards/capture_cancel` and the capture poller's `cards/capture_status` (services/intercom_capture.py). WisKey answers
# all three from memory (start registers a session and returns; the reader is driven by WisKey's own background task),
# so the slot is held for milliseconds - but on its own lane, a capture in progress, or a stuck start, can never take a
# door release's slot or a people save's. A user's start / cancel waits up to CAPTURE_SLOT_WAIT_S for the slot (the
# poller may hold it for one status read); the poller never waits (it skips a tick). Slots 4 + 2 + 1 + 1 = 8 (+ the
# feed's own) sit at WisKey's AdminLimiter ceiling; a moment over it is WisKey's `rate_limited`, a pre-dispatch refusal.
# `cards/reader_capabilities` reaches the device (WisKey allows it 35 s) and runs in the READ lane with its own
# timeout, so a slow reader never holds the capture slot either.
CAPTURE_INFLIGHT = 1
CAPTURE_USER_BURST, CAPTURE_USER_RATE = 8.0, 1.0
CAPTURE_GLOBAL_BURST, CAPTURE_GLOBAL_RATE = 10.0, 1.0
CAPTURE_TIMEOUT_S = 20.0
CAPTURE_SLOT_WAIT_S = 3.0
# WhatsApp messages (CR-036 WA, services/intercom_messaging.py) have a fifth lane: ONE slot and buckets of their own, so a send that
# WisKey's provider holds for tens of seconds can never take a door release's slot or a people save's. Slots 4 + 2 + 1 + 1 + 1 = 9
# (+ the feed's own) is one over WisKey's AdminLimiter ceiling of 8 handlers per HA user: only if every lane is busy at once does
# WisKey answer `rate_limited` - a clean pre-dispatch refusal, which the message flow reports as "not sent, try again". The refill
# (0.5 a second) is what the dialog's pacing between the sends of a bulk run stays under. WisKey's own provider call has a 45 s limit.
MESSAGE_INFLIGHT = 1
MESSAGE_USER_BURST, MESSAGE_USER_RATE = 6.0, 0.5
MESSAGE_GLOBAL_BURST, MESSAGE_GLOBAL_RATE = 6.0, 0.5
MESSAGE_TIMEOUT_S = 50.0
# review round 1 (M1): the capture poller never spends a user's or the lane's shared tokens - its status reads come
# from a small bucket of their own, sized for WisKey's maximum of three sessions at the poller's own pace (one read per
# session every 2 s, every 3 s once more than one is followed: at most 1/s in all). A cancel spends no token at all:
# a cancel is always cheaper than a reader left collecting, so no amount of polling or starting can refuse one.
CAPTURE_POLL_BURST, CAPTURE_POLL_RATE = 3.0, 1.0
READERS_TIMEOUT_S = 40.0  # WisKey's own asyncio.timeout(35) on cards/reader_capabilities, plus the round trip
RATE_LIMITED = "rate_limited"
RATE_RETRY_S = 2.0  # the feed's own refetch answered `rate_limited`: keep the session and try again after this long
DEFER_RETRY_S = 5.0  # a refetch failure deferred during an announcement (S6) is retried this often
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
    # CR-036 S4 (the adapter's reads): the same answer as for something the caller may not see - no existence oracle
    "event_not_found": (404, "intercom_event_not_found", "האירוע לא נמצא."),
    "station_not_found": (404, "intercom_station_not_found", "העמדה לא נמצאה."),
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


class NotSent(Exception):
    """WKINT-295: a `send` that proves nothing of its own frame left Arx (the native people write over WisKey's direct API refused
    locally, or its transport proved not-sent). `code` is a short machine code. Raised only by services/wiskey_direct_join.py; the
    Home Assistant path never raises it."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code

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


def _revision(value: Any) -> int | None:
    """R8-A1: a record revision as the engine reads it - a strict int >= 1, else None (0 / negative is not a revision WisKey issues, so
    a write gated on it can never match)."""
    v = _int(value)
    return v if v is not None and v >= 1 else None


def _station(raw: dict[str, Any]) -> dict[str, Any]:
    """One station as the entry center shows it: identity, health and the operational state the door / call / camera
    flows need (call, sync, relays, camera entity). Built field by field. B0 (D-006): never `last_access` (person name,
    employee number, event identity) and never a people count (`pending_user_count`, `managed_user_count`); WisKey's
    `overview` still sends them, and they are dropped here, before anything is cached, served or logged."""
    entities = raw.get("entities") if isinstance(raw.get("entities"), dict) else {}
    clock = raw.get("clock") if isinstance(raw.get("clock"), dict) else {}
    locks = raw.get("integrated_locks") if isinstance(raw.get("integrated_locks"), list) else []
    return {
        "id": str(raw.get("id") or ""),
        "name": str(raw.get("name") or ""),
        "online": bool(raw.get("online")),
        "call_state": call if isinstance(call := raw.get("call_state"), str) and call in CALL_STATES else "unknown",  # CR-036 2.2: an unknown value is "unknown"
        "sync_state": sync if isinstance(sync := raw.get("sync_state"), str) and sync in STATION_SYNC_STATES else "unknown",  # CR-036 2.2, as call_state
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
        # the station clock's display zone (WisKey formats a station's times in it, panel.ts zone())
        "zone": clock.get("zone") if isinstance(clock.get("zone"), dict) else None,
    }


# What B0 (D-006) stopped keeping from WisKey's `overview` still tells the activity log and the people screens WHEN something
# happened: a new access record changes a station's `last_access`, a people edit changes the counts. Browsers are told only
# when the entry center changed (`intercom_refresh`, one notice per actual change), so the change itself is detected with an
# opaque keyed digest of those removed fields: held in memory, never served, logged or compared across restarts (the key is
# random per process). The digest is not a field of a person or an event, and it cannot be turned back into one.
_CHANGE_KEY = os.urandom(16)


def change_tag(raw: dict[str, Any]) -> str:
    """Keyed digest of the parts of `overview` that are no longer projected (last access, people counts), so that a change
    in them is still noticed without keeping them."""
    parts = {
        str(s.get("id") or ""): [s.get("last_access"), s.get("pending_user_count"), s.get("managed_user_count")]
        for s in raw.get("stations") or []
        if isinstance(s, dict)
    }
    body = json.dumps([parts, raw.get("user_count")], sort_keys=True, default=str, separators=(",", ":")).encode("utf-8")
    return hmac.new(_CHANGE_KEY, body, hashlib.sha256).hexdigest()


def project_overview(raw: dict[str, Any]) -> dict[str, Any]:
    """What SMPLWISE keeps and serves from WisKey's `overview`: the stations as the entry center shows them and the
    display zone. Not kept (B0, D-006): people, the directory size (`user_count`), per-station last access, cards, PIN
    flags, tombstones / revocations, host / model / firmware."""
    stations = [_station(s) for s in raw.get("stations") or [] if isinstance(s, dict)]
    api = raw.get("api") if isinstance(raw.get("api"), dict) else {}
    return {
        "version": raw.get("version") if isinstance(raw.get("version"), str) else None,
        "api_version": _int(api.get("version")),
        "default_zone": raw.get("default_zone") if isinstance(raw.get("default_zone"), dict) else None,
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


# WisKey round 3 (R3-03; operator_scope.project_person in WisKey's pinned source c0b2d94c, static reading, NOT_RUN): for a
# restricted caller WisKey adds `operator_editable` and `redacted_fields` (the CATEGORY names: `access`, `credentials`, `phone`,
# `photo`, `profile`) and then blanks what is withheld - `access` -> assignments {}, permission_overrides {}, group_ids [],
# validity null, access_category "staff"; `credentials` -> cards [], pin_configured false; `phone` -> "". A station-scoped caller
# also gets assignments / permission_overrides filtered to the stations it may see, with `redacted_fields` possibly EMPTY. An
# unrestricted caller gets the record unchanged and neither key. So an empty map or a false flag is only evidence when neither
# marker is present and the field itself is well formed; otherwise it is UNKNOWN, never "none".
ACCESS_REDACTION = frozenset({"access", "assignments", "group_ids", "permission_overrides", "door_permissions"})
CREDENTIAL_REDACTION = frozenset({"credentials", "pin", "pin_configured", "cards"})


def person_scope(raw: Any) -> dict[str, Any]:
    """What a WisKey person record can prove about its own completeness (R3-03): `restricted` (WisKey marked the record as
    projected for a restricted caller: either marker present), `redacted_fields` (the names WisKey sent; strings only),
    `operator_editable` (WisKey's flag, None when absent), `access_known` (the access fields are readable and well formed),
    `stations_known` (the assignments are the COMPLETE set: readable and not projected for a restricted caller, whose view may
    be filtered by station), `credentials_known` (`pin_configured` is a readable boolean). A `redacted_fields` that is present
    but not a list of strings blocks everything.

    R8-A1 / R6-A4 (ARX-N03): `access_known` also needs the SAME strict shape verdict the grant engine uses
    (`access_grant_engine.access_shape`): a malformed assignment row (non-boolean `enabled`, an unsupported relay, a bad bookkeeping
    revision, a non-object row, a blank key), a malformed override / group entry or container, or a missing / non-boolean `active`
    makes `access_known` / `stations_known` False - the projectors below may still show the well-formed rows, but never as the
    complete set (every authorization consumer then treats the station set as unknown). `access_malformed` names the fields.
    Absent `permission_overrides` / `group_ids` alone do not block the people views (they never read them as the station set); the
    engine's `doors_known` additionally requires them (`AccessShape.complete`)."""
    from .access_grant_engine import access_shape

    raw = raw if isinstance(raw, dict) else {}
    marker = raw.get("redacted_fields")
    restricted = "redacted_fields" in raw or "operator_editable" in raw
    parsable = marker is None or (isinstance(marker, list) and all(isinstance(f, str) for f in marker))
    names = set(marker) if parsable and isinstance(marker, list) else set()
    access_readable = parsable and not (names & ACCESS_REDACTION)
    malformed = access_shape(raw).malformed
    access_known = access_readable and isinstance(raw.get("assignments"), dict) and not malformed
    return {
        "access_malformed": list(malformed),
        "restricted": restricted,
        "redacted_fields": sorted(names) if parsable else None,
        "operator_editable": raw.get("operator_editable") if isinstance(raw.get("operator_editable"), bool) else None,
        "access_readable": access_readable,
        "access_known": access_known,
        "stations_known": access_known and not restricted,
        "credentials_known": parsable and not (names & CREDENTIAL_REDACTION) and isinstance(raw.get("pin_configured"), bool),
        "phone_known": parsable and "phone" not in names,
    }


ACCESS_CATEGORIES = ("staff", "visitor", "contractor")


def project_person(raw: dict[str, Any]) -> dict[str, Any]:
    """One WisKey person as the read-only people screens show them: identity, status, validity window, groups, and which
    stations they are assigned to (with WisKey's sync state and door numbers). Never phones, cards, PIN flags, profile
    values or photos - the editing phase adds what it needs deliberately.

    R3-03: missing or redacted access data stays distinguishable from "none" - `access_known` / `stations_known` say whether
    `stations` / `group_ids` / the validity are real evidence (an empty list with `stations_known: false` means "not shown",
    never "no stations"), `access_category` is null when withheld, and WisKey's own `redacted_fields` / `operator_editable`
    are passed on. Nothing here (or anywhere downstream) may infer a revocation from `stations: []` unless `stations_known`."""
    scope = person_scope(raw)
    assignments = raw.get("assignments") if isinstance(raw.get("assignments"), dict) else {}
    groups = raw.get("group_ids") if isinstance(raw.get("group_ids"), list) else []
    category = raw.get("access_category")
    return {
        **{k: str(raw.get(k) or "") for k in PERSON_KEYS},
        "active": bool(raw.get("active")),
        "valid_from": _str(raw.get("valid_from")) if scope["access_readable"] else None,
        "valid_until": _str(raw.get("valid_until")) if scope["access_readable"] else None,
        "revision": _revision(raw.get("revision")),
        "access_category": category if scope["access_readable"] and category in ACCESS_CATEGORIES else None,
        "access_known": scope["access_known"],
        "stations_known": scope["stations_known"],
        "redacted_fields": scope["redacted_fields"],
        "operator_editable": scope["operator_editable"],
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


# ---------------------------------------------------------------- the person editor's projections (access.people.manage)
# Brief A.5: the editor legitimately needs what the read projection strips - but only what WisKey itself returns after a
# save. `ManagedUser.public()` never carries a PIN (only `pin_configured`) and masks every card to `"•••• " + last4`
# (`ManagedCard.public()`); the full number exists only in the browser form that typed it. Neither projection below
# ever keeps a `pin`, `card_no`, `photo`, profile values or a timing schedule (slice A3 adds timing and photo).

CARD_MASK = re.compile(r"^[•*]{2,8}(?: ?[A-Za-z0-9_-]{0,4})?$")  # WisKey's masked form ("•••• 1234" / "••••"); nothing longer
EDITOR_ASSIGNMENT_KEYS = ("sync_state", "last_error", "desired_revision", "applied_revision")


def _masked(value: Any) -> str:
    """A card number field is served ONLY when it is WisKey's masked form: a value that looks like a full number
    (however it got there) is replaced by the bare mask, never passed on."""
    return value if isinstance(value, str) and CARD_MASK.fullmatch(value) else "••••"


def project_person_editor(raw: dict[str, Any]) -> dict[str, Any]:
    """One WisKey person for the editor (`users/get` or a save's answer): the read projection's fields plus `phone`,
    `identity_locked`, `pin_configured` (a flag; WisKey never returns the value), the cards in WisKey's masked form,
    `permission_overrides`, and each assignment's sync bookkeeping. `has_timing` says a weekly / dates schedule or an
    enforced timing policy exists (its content is slice A3's; a save from this editor never touches it). An answer
    that is not a person record (no id, no integer revision) raises: after a save that is "outcome unknown"."""
    if not isinstance(raw, dict) or not isinstance(raw.get("id"), str) or not raw["id"] or _int(raw.get("revision")) is None:
        raise ValueError("unexpected person record")
    person = project_person(raw)
    scope = person_scope(raw)
    assignments = raw.get("assignments") if isinstance(raw.get("assignments"), dict) else {}
    cards = raw.get("cards") if isinstance(raw.get("cards"), list) else []
    overrides = raw.get("permission_overrides") if isinstance(raw.get("permission_overrides"), dict) else {}
    return {
        **person,
        # R3-03: a withheld field is null ("not shown"), never the blank WisKey puts in its place ("" phone, false PIN flag)
        "phone": (_str(raw.get("phone")) or "") if scope["phone_known"] else None,
        "identity_locked": bool(raw.get("identity_locked")),
        "pin_configured": raw["pin_configured"] if scope["credentials_known"] else None,
        "credentials_known": scope["credentials_known"],
        "cards": [
            {
                "id": str(card.get("id")),
                "masked_number": _masked(card.get("masked_number")),
                "label": _str(card.get("label")) or "",
                "card_type": _str(card.get("card_type")) or "normalCard",
                "enabled": bool(card.get("enabled")),
            }
            for card in cards
            if isinstance(card, dict) and isinstance(card.get("id"), str)
        ],
        "permission_overrides": {str(k): v for k, v in overrides.items() if v in ("allow", "deny")},
        "has_timing": raw.get("access_timing_draft") is not None or raw.get("access_timing_policy") is not None,
        "stations": [_editor_assignment(station, assignments.get(station["station_id"])) for station in person["stations"]],
    }


def _editor_assignment(station: dict[str, Any], raw: Any) -> dict[str, Any]:
    a = raw if isinstance(raw, dict) else {}
    bookkeeping = {k: (v if isinstance(v := a.get(k), (str, int)) and not isinstance(v, bool) else None) for k in EDITOR_ASSIGNMENT_KEYS}
    return {**station, **bookkeeping}


def project_editor_context(raw: dict[str, Any]) -> dict[str, Any]:
    """What the editor needs from WisKey's `overview` beyond the entry-center projection: per station whether its
    keypad PIN can be written (`capabilities.pin_writable`; null when WisKey has not scanned it), the relays, the HA
    display zone, WisKey's `api.capabilities`, whether the people-write commands are listed for the add-on's HA user
    (`api.commands`; null when WisKey does not list them - brief §0.2 / §6.1: the user needs the `users:manage` area)
    and whether a profile policy (custom fields, groups, templates - slice A3) exists. Never the users, hosts or PII."""
    api = raw.get("api") if isinstance(raw.get("api"), dict) else {}
    access = raw.get("access") if isinstance(raw.get("access"), dict) else {}
    areas = access.get("areas") if isinstance(access.get("areas"), dict) else {}
    commands = api.get("commands") if isinstance(api.get("commands"), list) else None
    settings = raw.get("profile_settings") if isinstance(raw.get("profile_settings"), dict) else None
    stations = []
    for s in raw.get("stations") or []:
        if not isinstance(s, dict):
            continue
        caps = s.get("capabilities") if isinstance(s.get("capabilities"), dict) else {}
        base = _station(s)
        stations.append({
            "id": base["id"], "name": base["name"], "online": base["online"], "lock_enabled": base["lock_enabled"], "locks": base["locks"],
            "pin_writable": caps.get("pin_writable") if isinstance(caps.get("pin_writable"), bool) else None,
        })
    return {
        "stations": stations,
        "default_zone": raw.get("default_zone") if isinstance(raw.get("default_zone"), dict) else None,
        "capabilities": [c for c in (api.get("capabilities") or []) if isinstance(c, str)],
        "writes_listed": None if commands is None else all(f"users/{c}" in commands for c in ("create", "update", "delete")),
        "users_manage": True if access.get("is_admin") is True else (areas.get("users") == "manage" if isinstance(areas.get("users"), str) else None),
        "profile_policy": {"revision": _int(settings.get("revision")), "groups": len(settings.get("groups") or []), "fields": len(settings.get("fields") or [])} if settings else None,
    }


def project_pin(raw: Any) -> dict[str, Any]:
    """`users/pin_generate`'s answer: the generated PIN (digits only), to be shown once in the form."""
    pin = raw.get("pin") if isinstance(raw, dict) else None
    if not isinstance(pin, str) or not re.fullmatch(r"[0-9]{1,128}", pin):
        raise ValueError("unexpected users/pin_generate answer")
    return {"pin": pin}


def project_accepted(raw: Any) -> dict[str, Any]:
    """`users/delete`'s answer: `{accepted: true}` - WisKey queued the removals, it did not finish them."""
    if not isinstance(raw, dict) or raw.get("accepted") is not True:
        raise ValueError("unexpected users/delete answer")
    return {"accepted": True}


# ---------------------------------------------------------------- card capture projections (CR-005 phase 2 slice A2)

CAPTURE_STATES = ("preparing", "waiting", "captured", "error", "applying")  # WisKey CaptureSession.state
CAPTURE_TECHNOLOGIES = ("TypeA_M1", "TypeA_CPU", "TypeB", "ID_125K", "FelicaCard", "DesfireCard")  # client/capture.py TECHNOLOGIES
CAPTURE_ERROR = re.compile(r"[a-z0-9_]{1,64}")
SESSION_ID = re.compile(r"[A-Za-z0-9_-]{1,128}")  # WisKey: uuid4().hex


def project_readers(raw: Any) -> dict[str, Any]:
    """`cards/reader_capabilities`: the reader ids a capture may name (0 = the station's default reader) and WisKey's
    card-number length bounds. Anything else raises: "invalid_response"."""
    readers = raw.get("readers") if isinstance(raw, dict) else None
    if not isinstance(readers, list) or not readers or any(_int(r) is None or not 0 <= r <= 8 for r in readers):
        raise ValueError("unexpected cards/reader_capabilities answer")
    return {"readers": sorted(set(readers)), "card_min": _int(raw.get("card_min")), "card_max": _int(raw.get("card_max"))}


def project_capture_card(raw: Any) -> dict[str, Any] | None:
    """A collected card as WisKey's `CapturedCard.public()` gives it - the masked form only (a value that looks like a
    full number is replaced by the bare mask, as for the editor's saved cards), the technology when it is one WisKey
    knows, the reader id 1-8."""
    if not isinstance(raw, dict):
        return None
    tech = raw.get("technology")
    reader = _int(raw.get("reader_id"))
    return {
        "masked_number": _masked(raw.get("masked_number")),
        "technology": tech if tech in CAPTURE_TECHNOLOGIES else None,
        "reader_id": reader if reader is not None and 1 <= reader <= 8 else None,
    }


def project_capture_session(raw: Any) -> dict[str, Any]:
    """`cards/capture_start` / `cards/capture_status`: WisKey's session. An answer without a usable `session_id` or
    state raises - after a start that is "outcome unknown" (the reader may be collecting under a session SMPLWISE cannot
    see), never "refused"."""
    if not isinstance(raw, dict) or not isinstance(raw.get("session_id"), str) or not SESSION_ID.fullmatch(raw["session_id"]):
        raise ValueError("unexpected capture session")
    state = raw.get("state")
    if state not in CAPTURE_STATES:
        raise ValueError("unexpected capture state")
    error = raw.get("error")
    return {
        "session_id": raw["session_id"],
        "state": state,
        "error": error if isinstance(error, str) and CAPTURE_ERROR.fullmatch(error) else ("capture_failed" if state == "error" else None),
        "card": project_capture_card(raw.get("card")) if state in ("captured", "applying") else None,
    }


def project_cancelled(raw: Any) -> dict[str, Any]:
    """`cards/capture_cancel`: `{cancelled: true}` - WisKey stopped waiting. Anything else raises ("outcome unknown")."""
    if not isinstance(raw, dict) or raw.get("cancelled") is not True:
        raise ValueError("unexpected cards/capture_cancel answer")
    return {"cancelled": True}


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
    "ha_not_configured": "ל־Arx אין גישה לתשתית המערכת בסביבה הזו",
    "connecting": "החיבור ל־WisKey עדיין נפתח",
    "ha_unavailable": "תשתית המערכת אינה זמינה כרגע",
    "not_installed": "אינטגרציית WisKey אינה מותקנת",
    "forbidden": "WisKey דחה את הגישה של Arx",
    "error": "WisKey החזיר שגיאה",
}


# WisKey's refusals of a people write that the editor handles by name (CR-005 phase 2): (HTTP status, SMPLWISE code,
# message). Every other proven refusal is a generic 502 `intercom_action_refused` with the code in `details.wiskey_code`.
WRITE_REFUSALS: dict[str, tuple[int, str, str]] = {
    "revision_conflict": (409, "intercom_revision_conflict", "האדם השתנה ב־WisKey בזמן העריכה, ולכן השינוי לא נשמר. טענו מחדש את הרשומה העדכנית ונסו שוב."),
    "pin_conflict": (409, "intercom_pin_conflict", "קוד ה־PIN הזה כבר משויך לאדם אחר ב־WisKey, ולכן השינוי לא נשמר. בחרו קוד אחר או צרו PIN ייחודי."),
    "employee_conflict": (409, "intercom_employee_conflict", "מזהה העובד הזה כבר קיים ב־WisKey, ולכן השינוי לא נשמר."),
    "card_conflict": (409, "intercom_card_conflict", "מספר הכרטיס הזה כבר משויך לאדם אחר ב־WisKey, ולכן השינוי לא נשמר."),
    "pin_removal_pending": (409, "intercom_removal_pending", "קוד ה־PIN הזה עדיין ממתין להסרה מתחנה, ולכן WisKey לא מאפשר להשתמש בו שוב עדיין."),
    "card_removal_pending": (409, "intercom_removal_pending", "הכרטיס הזה עדיין ממתין להסרה מתחנה, ולכן WisKey לא מאפשר להשתמש בו שוב עדיין."),
    "identity_migration_required": (409, "intercom_identity_locked", "מזהה העובד כבר נפרס בתחנה ואי אפשר לשנותו כאן."),
    "group_policy_changed": (409, "intercom_policy_changed", "הגדרות הקבוצות ב־WisKey השתנו בזמן העריכה. טענו מחדש ונסו שוב."),
    "user_not_found": (404, "intercom_person_not_found", "האדם לא נמצא ב־WisKey (ייתכן שנמחק בינתיים)."),
    "unauthorized": (502, "intercom_action_refused", "WisKey דחה את הפקודה: למשתמש תשתית המערכת אין הרשאת ניהול אנשים (users:manage) ב־WisKey. הפקודה לא בוצעה."),
    "storage_stopping": (503, "intercom_unavailable", "תשתית המערכת נכבתה כרגע, ולכן WisKey לא שמר את השינוי. נסו שוב אחרי ההפעלה."),
    # CR-036 S11 (the person writes added in this slice; the screens word them by code, without a platform name)
    "approval_required": (409, "intercom_approval_required", "בקרת הכניסה דורשת אישור נוסף לפעולה הזו בחלון האינטרקום, ולכן היא לא בוצעה."),
    "archive_state_changed": (409, "intercom_archive_state_changed", "מצב הארכיון של האדם כבר השתנה. טענו מחדש את הרשומה."),
    "temporary_user_required": (409, "intercom_not_temporary", "סיום גישה זמנית חל רק על אורח או קבלן."),
    "temporary_already_inactive": (409, "intercom_already_inactive", "הגישה של האדם כבר מושבתת."),
    "card_not_found": (404, "intercom_card_not_found", "הכרטיס הזה כבר אינו משויך לאדם. טענו מחדש את הרשומה."),
    "user_archived": (409, "intercom_person_archived", "האדם בארכיון. יש לשחזר אותו מהארכיון לפני שמפעילים אותו."),
    "guest_responsible_required": (422, "intercom_responsible_required", "לאורח או לקבלן נדרשים אחראי ותאריך סיום."),
    "photo_disabled": (409, "intercom_photo_disabled", "קליטת התמונות כבויה בבקרת הכניסה, ולכן התמונה לא נשמרה. טענו מחדש את ההגדרות."),
    # WisKey round 3 (R3-04): the profile checks, all before WisKey's save (intercom_client._USER_WRITE_REFUSED) - the caller's to fix
    "profile_required": (422, "intercom_profile_required", "חסר ערך בשדה פרופיל חובה, ולכן השינוי לא נשמר."),
    "profile_value_invalid": (422, "intercom_profile_invalid", "ערך באחד משדות הפרופיל אינו תקין, ולכן השינוי לא נשמר."),
    "profile_value_not_unique": (422, "intercom_profile_not_unique", "ערך באחד משדות הפרופיל כבר משויך לאדם אחר, ולכן השינוי לא נשמר."),
}
# WisKey's refusals of the card-capture commands (lane "capture" for start / cancel; a confirm is a people write in the
# config lane and gets WRITE_REFUSALS first): (HTTP status, SMPLWISE code, message)
CAPTURE_REFUSALS: dict[str, tuple[int, str, str]] = {
    "capture_station_busy": (409, "intercom_capture_station_busy", "בעמדה הזו כבר קיימת ב־WisKey קריאת כרטיס שממתינה לסיום או לאישור (ייתכן שמ־WisKey עצמו). הקורא לא הופעל שוב - המתינו עד שתי דקות ונסו שוב."),
    "capture_limit": (409, "intercom_capture_limit", "שלוש קריאות כרטיס כבר פעילות ב־WisKey (כולל מחוץ ל־Arx). הקורא לא הופעל - סיימו או בטלו אחת מהן."),
    "revision_conflict": (409, "intercom_revision_conflict", "האדם השתנה ב־WisKey מאז שנטען, ולכן WisKey לא הפעיל את הקורא. טענו מחדש את הרשומה ונסו שוב."),
    "user_not_found": (404, "intercom_person_not_found", "האדם לא נמצא ב־WisKey (ייתכן שנמחק בינתיים)."),
    "station_not_found": (404, "intercom_station_not_found", "העמדה לא נמצאה ב־WisKey."),
    "station_offline": (409, "intercom_station_offline", "העמדה אינה מחוברת ל־WisKey, ולכן הקורא לא הופעל."),
    "station_has_no_managed_lock": (409, "intercom_no_lock", "לעמדה אין מנעול מנוהל ב־WisKey, ולכן אי אפשר לקרוא בה כרטיס."),
    "manager_closed": (503, "intercom_unavailable", "מנהל הגישה של WisKey נסגר (תשתית המערכת נטענה מחדש?), ולכן הקורא לא הופעל."),
    "capture_applying": (409, "intercom_capture_applying", "הכרטיס נמצא בשמירה ב־WisKey. יש להמתין לתוצאה לפני פעולה נוספת."),
    "capture_not_found": (404, "intercom_capture_not_found", "הקריאה פגה או אינה קיימת עוד ב־WisKey. יש להתחיל קריאה חדשה."),
    "capture_not_ready": (409, "intercom_capture_not_ready", "אין כרטיס שנקרא וממתין לאישור."),
    "invalid_text": (422, "intercom_invalid_request", "תווית הכרטיס אינה תקינה (עד 64 תווים, ללא תווי בקרה)."),
}
# codes of a malformed or over-capacity draft (WisKey's build_user / _validate): the caller's to fix
WRITE_INVALID_PREFIXES = ("invalid_", "unsupported_", "schedule_", "duplicate_card", "unmanaged_lock", "station_not_found", "station_has_no_managed_lock",
                          "person_exceeds_capabilities", "pin_device_managed", "pin_exceeds_capabilities", "card_capacity", "card_exceeds_capabilities",
                          "photo_", "profile_settings_unavailable")


def action_error(reply: dict[str, Any], outcome: str, lane: str = "action") -> ApiError:
    """A physical action (or a people write, `lane` "config") that did not complete is an HTTP error, never a 200 with
    a state field: the caller must not be able to read it as done. `details.outcome` says what is known: `not_sent`
    (nothing reached WisKey - safe to try again), `refused` (WisKey answered with an error code), `unknown` (sent, but
    no answer arrived - it may or may not have happened, so it must not be retried blindly)."""
    state, code = reply.get("state"), reply.get("last_error")
    details = {"outcome": outcome, "state": state, "wiskey_code": code}
    config = lane == "config"
    capture = lane == "capture"
    if outcome == "not_sent":
        if code == "expired":  # the code routers/ha.py uses for an expired HA action
            return ApiError(409, "expired", "הבקשה פגה לפני שנשלחה ל־WisKey, ולכן לא נשלחה. אם עדיין צריך - בצעו אותה שוב.", details=details)
        if code == RATE_LIMITED:
            return ApiError(429, "intercom_rate_limited", "יותר מדי פקודות ל־WisKey בזמן קצר. הפקודה לא נשלחה - נסו שוב בעוד כמה שניות.", retryable=True, details=details)
        if code == "busy":
            return ApiError(429, "intercom_busy", "WisKey עסוק בבקשות אחרות. הפקודה לא נשלחה - נסו שוב בעוד רגע.", retryable=True, details=details)
        if code in UNSETTLED_CODES:  # R3-06: a fresh read of the person must come first (IntercomSync.write_gate)
            return ApiError(409, "intercom_outcome_pending", "לשמירה קודמת של האדם הזה עדיין אין תוצאה ברורה. הפקודה לא נשלחה - טענו מחדש את הרשומה ובדקו את הגרסה שלה לפני שמנסים שוב.",
                            details=details)
        reason = NOT_SENT_REASONS.get(str(state), "WisKey אינו זמין")
        return ApiError(503, "intercom_unavailable", f"הפקודה לא נשלחה: {reason}.", details=details)
    if outcome == "unknown":
        if code in ("timeout", "invalid_response") or state == "ha_unavailable":
            said = "הפקודה נשלחה אך לא התקבלה מ־WisKey תשובה ברורה"
        else:  # WisKey answered with a failure that can come after the command reached the device / the store (release_unconfirmed, storage_write_failed ...)
            said = f"WisKey לא אישר שהפקודה בוצעה ({code})"
        if config:
            return ApiError(504, "intercom_outcome_unknown", f"{said}. ייתכן שהשינוי נשמר וייתכן שלא - טענו מחדש את הרשומה ובדקו את הגרסה שלה לפני שמנסים שוב.", details=details)
        if capture:
            return ApiError(504, "intercom_outcome_unknown", f"{said}. ייתכן שהקורא בעמדה נכנס למצב קריאת כרטיס וממתין לכרטיס עד שתי דקות (עד שהזמן של WisKey יפוג) - שום כרטיס לא יתווסף לאדם בלי אישורכם.", details=details)
        return ApiError(504, "intercom_outcome_unknown", f"{said}. ייתכן שבוצעה וייתכן שלא - בדקו במצלמה או במקום לפני שמנסים שוב.", details=details)
    if code == RATE_LIMITED:
        return ApiError(429, "intercom_rate_limited", "WisKey הגביל את קצב הפקודות ודחה את הפקודה. היא לא בוצעה - נסו שוב בעוד כמה שניות.", retryable=True, details=details)
    if code == "invalid_fields":
        return ApiError(422, "intercom_invalid_request", "WisKey דחה את פרמטרי הפקודה, והיא לא בוצעה.", details=details)
    if config and code in WRITE_REFUSALS:
        status, own, message = WRITE_REFUSALS[code]
        return ApiError(status, own, message, details=details)
    # the capture lane by every code above; a people write (the capture confirm among them) only by the capture_* ones,
    # so a draft's own codes (`station_not_found` ...) keep the people writes' meaning below
    if code in CAPTURE_REFUSALS and (capture or (config and code.startswith("capture_"))):
        status, own, message = CAPTURE_REFUSALS[code]
        return ApiError(status, own, message, details=details)
    if config and code and code.startswith(WRITE_INVALID_PREFIXES):
        return ApiError(422, "intercom_invalid_request", f"WisKey דחה את פרטי האדם ({code}), ולכן השינוי לא נשמר.", details=details)
    return ApiError(502, "intercom_action_refused", f"WisKey דחה את הפקודה ({code}). לפי WisKey היא לא בוצעה.", details=details)


def person_target(user_id: str) -> str:
    """The `target` of a people write / readback of one WisKey person (R3-06)."""
    return f"person:{user_id}"


def _late_outcome(future: Any, project: Callable[[Any], Any]) -> tuple[str, str | None]:
    """R3-06: what a call this side stopped waiting for finally said, read the way `_settle` reads an answer in time: `ok` (an
    acceptance whose answer the projection accepts), `refused` (a proven pre-effect refusal, intercom_client.PRE_EFFECT),
    `not_sent`, or `unknown` (an unclear code, an answer of an unexpected shape, the session gone, cancelled)."""
    if future.cancelled():
        return "unknown", "cancelled"
    exc = future.exception()
    if exc is None:
        try:
            project(future.result())
        except Exception:  # noqa: BLE001 - a committed save whose answer cannot be used is still not "refused"
            return "unknown", "invalid_response"
        return "ok", None
    if isinstance(exc, (_NotReady, _Expired)):
        return "not_sent", type(exc).__name__
    if isinstance(exc, intercom_client.UnclearAnswer):
        return "unknown", exc.code
    if isinstance(exc, IntercomError):
        return "refused", exc.code
    return "unknown", type(exc).__name__


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
        # CR-036 S4: with the same copy, each station's closed technical part (intercom_adapter.project_station_technical:
        # served only through the adapter's views, to access.stations.read holders) and the `api` facts the feature flags
        # need. Kept and dropped together with the copy; never person data.
        self._technical: dict[str, dict[str, Any]] = {}
        self._api: dict[str, Any] | None = None
        self._tag: str | None = None  # change_tag of the last overview stored (never served)
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
        self._config_inflight = threading.BoundedSemaphore(CONFIG_INFLIGHT)  # people writes: a third lane (one slot)
        self._capture_inflight = threading.BoundedSemaphore(CAPTURE_INFLIGHT)  # card capture: a fourth lane (one slot)
        self._message_inflight = threading.BoundedSemaphore(MESSAGE_INFLIGHT)  # WhatsApp sends: a fifth lane (one slot)
        self._bucket_lock = threading.Lock()
        self._tts_status: dict[str, dict[str, Any]] = {}  # station id -> its latest announcement's progress
        # R3-06: people writes whose outcome is unknown, by target (e.g. "person:<id>"), until a read SENT AFTER the write's own
        # call was over has answered (write_gate / note_readback). Kept across sessions: a write may have landed before a
        # session ended. `_late`: the late answers of writes this side stopped waiting for (newest last; ids and codes only).
        self._unsettled_lock = threading.Lock()
        self._unsettled: dict[str, dict[str, Any]] = {}
        # R4-07: targets with a write ADMITTED and not yet over (checked and registered in one step under `_unsettled_lock`, so a second
        # write to the same person can never pass the gate while the first is being sent)
        self._writing: set[str] = set()
        self._seq = 0
        self._late: deque[dict[str, Any]] = deque(maxlen=LATE_KEEP)
        # R5-A6: the DURABLE side of the gate (intercom_write_journal.WriteJournal over the database; installed by main.py at start-up,
        # None in a process without one): every targeted person write is recorded before it is sent and its outcome after, and an
        # unresolved write of an earlier process (restart / standby takeover) holds the next write to that person until a readback.
        self.journal: Any = None
        self._buckets_reset()
        self._session_reset()

    def _buckets_reset(self) -> None:
        with self._bucket_lock:
            self._global_bucket = TokenBucket(GLOBAL_BURST, GLOBAL_RATE)
            self._user_buckets: dict[str, TokenBucket] = {}
            self._action_global_bucket = TokenBucket(ACTION_GLOBAL_BURST, ACTION_GLOBAL_RATE)
            self._action_user_buckets: dict[str, TokenBucket] = {}
            self._config_global_bucket = TokenBucket(CONFIG_GLOBAL_BURST, CONFIG_GLOBAL_RATE)
            self._config_user_buckets: dict[str, TokenBucket] = {}
            self._capture_global_bucket = TokenBucket(CAPTURE_GLOBAL_BURST, CAPTURE_GLOBAL_RATE)
            self._capture_user_buckets: dict[str, TokenBucket] = {}
            self._capture_poll_bucket = TokenBucket(CAPTURE_POLL_BURST, CAPTURE_POLL_RATE)
            self._message_global_bucket = TokenBucket(MESSAGE_GLOBAL_BURST, MESSAGE_GLOBAL_RATE)
            self._message_user_buckets: dict[str, TokenBucket] = {}

    def _spend_token(self, who: str, lane: str = "read") -> bool:
        """One token from both the caller's and the shared bucket of `lane` (`read`, `action`, `config`, `capture` or `message`),
        or none at all (nothing is spent on a refusal). `capture_poll` (the capture poller) has one bucket of its own
        and no per-user one."""
        with self._bucket_lock:
            if lane == "capture_poll":
                if not self._capture_poll_bucket.ready():
                    return False
                self._capture_poll_bucket.take()
                return True
            if lane == "action":
                users, shared, burst, rate = self._action_user_buckets, self._action_global_bucket, ACTION_USER_BURST, ACTION_USER_RATE
            elif lane == "config":
                users, shared, burst, rate = self._config_user_buckets, self._config_global_bucket, CONFIG_USER_BURST, CONFIG_USER_RATE
            elif lane == "capture":
                users, shared, burst, rate = self._capture_user_buckets, self._capture_global_bucket, CAPTURE_USER_BURST, CAPTURE_USER_RATE
            elif lane == "message":
                users, shared, burst, rate = self._message_user_buckets, self._message_global_bucket, MESSAGE_USER_BURST, MESSAGE_USER_RATE
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
        # CR-036 S4: the same live socket under the other channels' guards (wiskey_channels): `read` (the adapter's READ
        # commands) and `technical` (its reviewed non-READ reads). Built in on_ready, gone with the session.
        self._channel_calls: dict[str, intercom_client.Call] = {}
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
        self._config_inflight = threading.BoundedSemaphore(CONFIG_INFLIGHT)
        self._capture_inflight = threading.BoundedSemaphore(CAPTURE_INFLIGHT)
        self._message_inflight = threading.BoundedSemaphore(MESSAGE_INFLIGHT)
        self._tts_status = {}
        with self._unsettled_lock:
            self._unsettled = {}
            self._writing = set()
            self._late = deque(maxlen=LATE_KEEP)
        self.journal = None
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

    def stations_superset(self, settings: Settings) -> dict[str, Any]:
        """CR-036 S4: the served copy's stations, each with its closed technical part (`technical`), for the adapter's views -
        never served as is. Like GET /intercom/overview it counts as someone looking (the copy is refetched after an idle
        stretch). `stations` is None whenever there is nothing honest to show; `fresh` as in `snapshot`."""
        self._viewed()
        state, overview = self.served(settings)
        with self._cache_lock:
            technical = dict(self._technical)
        stations = None if overview is None else [{**s, "technical": technical.get(s["id"])} for s in overview.get("stations") or []]
        return {
            "state": state,
            "fresh": state == "ready" and overview is not None and self._deferred is None,
            "fetched_at": STATE.fetched_at if overview is not None else None,
            "stations": stations,
            "default_zone": (overview or {}).get("default_zone"),
        }

    def api_facts(self, settings: Settings) -> dict[str, Any] | None:
        """CR-036 S4: the served copy's `api` facts (version, min_client, the commands WisKey lists for the add-on's user), or
        None while there is no served copy."""
        if self.served(settings)[1] is None:
            return None
        with self._cache_lock:
            return dict(self._api) if self._api is not None else {"version": None, "min_client": None, "commands": None}

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
        timeout: float | None = None,
        channel: str = "service",
        slot_wait: float = 0.0,
        target: str | None = None,
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
        loop remain the only judges of the connection. `timeout` replaces COMMAND_TIMEOUT_S for a read WisKey itself
        allows longer (`cards/reader_capabilities` reaches the device: READERS_TIMEOUT_S). `channel`: the guard the frame
        goes through (see `_one_off`); the adapter's reads pass `read` or `technical`. `slot_wait`: how long a free read
        slot may be waited for (the adapter's continuation pages of one scan; everything else answers `busy` at once).
        `target` (R3-06, e.g. `person:<id>`): this read is a fresh readback of that target - once it has answered (a record, or
        WisKey's `user_not_found`) and it was sent after an unknown write's call was over, writes to the target are allowed again."""
        started = self._tick()
        journal = self.journal
        started_wall = journal.clock() if journal is not None else None
        try:
            reply, outcome = self._execute(settings, key, send, project, who, COMMAND_TIMEOUT_S if timeout is None else timeout, channel=channel, slot_wait=slot_wait)
        except ApiError as exc:
            if target is not None and isinstance(exc.details, dict) and exc.details.get("wiskey_code") == "user_not_found":
                self.note_readback(target, started, started_wall)  # an answer about the target, too (it is gone, or out of this caller's scope)
            raise
        if target is not None and outcome == "ok":
            self.note_readback(target, started, started_wall)
        return reply

    # -- R3-06: unknown people writes are reconciled by a fresh read before the next write to the same target
    def write_gate(self, target: str) -> str | None:
        """None when a write to `target` may be sent; else why not: `outcome_pending` (an earlier write's call is still out - it
        may yet be saved, or R4-07: another write to the target is being sent right now), `readback_required` (it is over, but no fresh
        read has answered since)."""
        with self._unsettled_lock:
            blocked = self._gate_locked(target)
        if blocked is None and self.journal is not None:
            return self.journal.blocking(target)  # R5-A6: an unresolved write recorded by this or an earlier process
        return blocked

    def _journal_admit(self, target: str, key: str, lane: str) -> tuple[str | None, str | None]:
        """R5-A6: after the in-memory admission, the durable side: (blocked, op id). An unresolved journal row holds the write
        (`outcome_pending` / `readback_required`); otherwise the intent is recorded BEFORE dispatch - a journal that cannot record it
        refuses the write (`journal_unavailable`, nothing sent). No journal installed: (None, None).
        R6-A2 / ACR6-01: the check and the insert are ONE database write transaction (`WriteJournal.admit`), never a read on one
        connection followed by an insert on another - another IntercomSync instance on the same database cannot slip in between."""
        journal = self.journal
        if journal is None:
            return None, None
        return journal.admit(target, key, lane)

    def begin_external(self, target: str, key: str) -> tuple[str | None, str | None]:
        """R5-A5: a people write that does NOT travel through `action` (the signed capture-lease confirm) takes the same per-person
        admission: (blocked, op id). None = admitted - the caller MUST call `end_external` exactly once, whatever happens."""
        blocked = self._admit(target)
        if blocked is not None:
            return blocked, None
        blocked, op_id = self._journal_admit(target, key, "config")
        if blocked is not None:
            self._release(target)
        return blocked, op_id

    def end_external(self, target: str, op_id: str | None, outcome: str, code: str | None = None) -> None:
        """R5-A5: the outcome of an externally sent people write. `unknown` keeps the target blocked until a fresh readback (the call
        is over from this side when this is called; a later commit by the remote handler is what the readback is for)."""
        try:
            if outcome not in ("ok", "refused", "not_sent"):
                with self._unsettled_lock:
                    self._seq += 1
                    self._unsettled[target] = {"since": time.monotonic(), "done_at": self._seq, "late": None}
            if op_id is not None and self.journal is not None:
                self.journal.finish(op_id, outcome if outcome in ("ok", "refused", "not_sent") else "unknown", code)
        finally:
            self._release(target)

    def _gate_locked(self, target: str) -> str | None:
        entry = self._unsettled.get(target)
        if entry is None:
            return "outcome_pending" if target in self._writing else None
        return "outcome_pending" if entry["done_at"] is None else "readback_required"

    def _admit(self, target: str) -> str | None:
        """R4-07: check the target's gate AND register this write as in flight, atomically. None = admitted (the caller must `_release`)."""
        with self._unsettled_lock:
            blocked = self._gate_locked(target)
            if blocked is None:
                self._writing.add(target)
            return blocked

    def _release(self, target: str) -> None:
        with self._unsettled_lock:
            self._writing.discard(target)

    def _tick(self) -> int:
        """A strictly increasing sequence number (the wall and monotonic clocks tick in ~15.6 ms steps on Windows: two events in one
        step would compare equal, and "read sent after the call was over" must be exact)."""
        with self._unsettled_lock:
            self._seq += 1
            return self._seq

    def note_readback(self, target: str, started: int, started_wall: float | None = None) -> None:
        """A read of `target` that started at `started` (a `_tick`) has answered: it settles an unknown write whose call was over by then.
        R5-A6: the journal's rows too - this process's own by the same sequence decision, an earlier process's by the wall clock
        (`started_wall`) after the row's call was over (or its hold ran out)."""
        memory = "absent"
        with self._unsettled_lock:
            entry = self._unsettled.get(target)
            if entry is not None:
                memory = "pending"
                if entry["done_at"] is not None and started > entry["done_at"]:
                    del self._unsettled[target]
                    memory = "settled"
        if self.journal is not None and started_wall is not None:
            self.journal.readback(target, started_wall, memory)

    def late_results(self) -> list[dict[str, Any]]:
        """The late answers of writes this side stopped waiting for (newest last): key, lane, target, outcome, code, at."""
        with self._unsettled_lock:
            return [dict(r) for r in self._late]

    def _follow_unknown(self, future: Any, key: str, lane: str, project: Callable[[Any], Any], target: str | None, waited_out: bool,
                        on_late: Callable[[dict[str, Any]], None] | None, op_id: str | None = None) -> None:
        """An `unknown` outcome: with a `target`, block further writes to it until a fresh read (write_gate); when this side stopped
        waiting before the call was over (`waited_out`), classify the call's late answer once it comes (`_late`, `on_late`) - the
        caller's reconciliation still reads the target fresh, a late answer is never taken as the state."""
        entry: dict[str, Any] | None = None
        if target is not None:
            entry = {"since": time.monotonic(), "done_at": None, "late": None}  # done_at: the `_tick` at which the call was over
            with self._unsettled_lock:
                self._unsettled[target] = entry

        def finished(f: Any) -> None:
            record = None
            if waited_out:
                outcome, code = _late_outcome(f, project)
                record = {"key": key, "lane": lane, "target": target, "outcome": outcome, "code": code, "at": now_iso()}
                log.info("intercom: late answer to a %s command (%s) this side stopped waiting for: %s (%s)", lane, key, outcome, code)
            with self._unsettled_lock:
                if entry is not None:
                    self._seq += 1
                    entry["done_at"] = self._seq
                    entry["late"] = record
                if record is not None:
                    self._late.append(record)
            journal = self.journal
            if op_id is not None and journal is not None:
                # R5-A6: from now on a readback that STARTS later can settle the durable row too. A database write never runs on the
                # feed's event loop (a busy database would stall the WisKey session): a call that ended later is recorded by a thread.
                if inline[0]:
                    journal.call_over(op_id)
                else:
                    threading.Thread(target=journal.call_over, args=(op_id,), name="intercom-journal", daemon=True).start()
            if record is not None and on_late is not None:
                try:
                    on_late(dict(record))
                except Exception:  # noqa: BLE001 - the caller's record of a late answer never breaks the loop
                    log.warning("intercom: on_late callback failed")

        inline = [True]
        future.add_done_callback(finished)  # runs at once (in this thread) when the call is already over
        inline[0] = False

    def action(
        self,
        settings: Settings,
        key: str,
        send: Callable[[intercom_client.Call], Awaitable[Any]],
        project: Callable[[Any], dict[str, Any]],
        who: str,
        not_after: datetime.datetime | None = None,
        on_settled: Callable[[], None] | None = None,
        lane: str = "action",
        slot_wait: float = 0.0,
        free: bool = False,
        on_result: Callable[[dict[str, Any], str], None] | None = None,
        target: str | None = None,
        on_late: Callable[[dict[str, Any]], None] | None = None,
        channel: str = "service",
    ) -> dict[str, Any]:
        """Run one PHYSICAL WisKey command (release, call signal, TTS start) like `command` - over the feed's own live
        session, never queued, never retried - but in the action lane (its own in-flight slots and rate buckets, so
        reads cannot starve it), waiting up to ACTION_TIMEOUT_S, and turning every result other than success into an
        ApiError (`action_error`), so that a refused, dropped or unanswered physical command can never be read as done.
        A people write (`lane` "config") runs the same way in the config lane (one slot of its own, CONFIG_TIMEOUT_S), a
        card-capture command (`lane` "capture") in the capture lane (CAPTURE_TIMEOUT_S); `slot_wait` > 0 lets the caller
        wait that long for the lane's slot instead of being answered `busy` at once (the capture poller's status read may
        hold it for a moment). `free`: spend no rate token (a capture cancel - never refused by SMPLWISE's own budget).

        `not_after` (aware UTC): checked on the feed's loop immediately before the frame is written; a command that
        reaches that point later is not sent (`expired`) - a request delayed in transit or in a queue never actuates
        late. `on_settled` is called exactly once, when the command is really over: at once when it was never
        scheduled, else when WisKey answered, the session ended, or ha_client's own call limit expired - which can be
        well after this method gave up waiting (ACTION_TIMEOUT_S). `on_result(reply, outcome)`: see `_execute` - the
        caller's own record of the outcome, made before the lane's slot can go to anyone else. Returns the
        `command`-shaped reply on success.

        R3-06: `target` (a people write's person, `person:<id>`): after an `unknown` outcome no further write to that target is
        sent (409 `intercom_outcome_pending`, nothing sent) until a fresh `command(..., target=)` read has answered - the next
        decision is made on the readback, never by replaying. `on_late(record)`: called once with the classified late answer
        (`ok` / `refused` / `unknown`) when this side stopped waiting (the local timeout) and the call ends later."""
        timeout = {"config": CONFIG_TIMEOUT_S, "capture": CAPTURE_TIMEOUT_S}.get(lane, ACTION_TIMEOUT_S)
        reply, outcome = self._execute(settings, key, send, project, who, timeout, lane=lane, not_after=not_after, on_settled=on_settled, slot_wait=slot_wait, free=free,
                                       on_result=on_result, target=target, on_late=on_late, channel=channel)
        if outcome != "ok":
            raise action_error(reply, outcome, lane)
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
        slot_wait: float = 0.0,
        free: bool = False,
        bucket: str | None = None,
        on_result: Callable[[dict[str, Any], str], None] | None = None,
        channel: str = "service",
        target: str | None = None,
        on_late: Callable[[dict[str, Any]], None] | None = None,
    ) -> tuple[dict[str, Any], str]:
        """`command`'s body. Also returns what is known about the command itself: `not_sent` (nothing reached WisKey),
        `refused` (WisKey answered with an error: a genuine refusal), `unknown` (sent, but no usable answer: timeout,
        the session went away mid-request, or an answer after `success: true` of a shape the projection does not
        accept) or `ok`.

        `on_result(reply, outcome)` is called once a scheduled command's outcome is known here (the reply as returned,
        WisKey's code in `last_error`) and BEFORE the lane's slot is freed: the caller records what the command did (a
        capture's `cancelled`, a poller read's new state) while no later command of the lane can have been sent yet.
        It must be quick and must not use the lane itself. Not called when nothing was scheduled (busy, no rate token,
        no live session): the reply alone says so."""
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
        # R3-06 / R4-07: an earlier write to this target has no clear outcome yet (read it fresh first), or another write to it is being
        # sent: refused, nothing sent. The check and this write's registration are ONE step (`_admit`), so two callers can never both pass.
        blocked = self._admit(target) if target is not None else None
        op_id: str | None = None
        if blocked is None and target is not None and lane != "read":
            blocked, op_id = self._journal_admit(target, key, lane)  # R5-A6: durable intent BEFORE dispatch (or the durable hold)
            if blocked is not None:
                self._release(target)
        if blocked is not None:
            reply.update(state="error", last_error=blocked, sync=STATE.as_dict())
            settled()
            return reply, "not_sent"
        recorded = False
        try:
            reply, outcome = self._execute_admitted(settings, reply, loop, key, send, project, who, timeout, lane, not_after, settled, slot_wait, free, bucket,
                                                    on_result, channel, target, on_late, op_id)
            recorded = True
            return reply, outcome
        finally:
            if op_id is not None and not recorded:
                self.journal.finish(op_id, "unknown", "error")  # an unexpected failure after admission: unresolved, never "not sent"
            if target is not None:
                self._release(target)  # after an `unknown` outcome `_follow_unknown` has already registered the target as unsettled

    def _execute_admitted(self, settings: Settings, reply: dict[str, Any], loop: Any, key: str, send: Callable[[intercom_client.Call], Awaitable[Any]],
                          project: Callable[[Any], dict[str, Any]], who: str, timeout: float, lane: str, not_after: datetime.datetime | None,
                          settled: Callable[[], None], slot_wait: float, free: bool, bucket: str | None,
                          on_result: Callable[[dict[str, Any], str], None] | None, channel: str, target: str | None,
                          on_late: Callable[[dict[str, Any]], None] | None, op_id: str | None = None) -> tuple[dict[str, Any], str]:
        journal = self.journal if op_id is not None else None

        def record(outcome: str, code: Any) -> None:
            if journal is not None:  # R5-A6: the outcome as this side knows it (`unknown`: the call's end is recorded by _follow_unknown)
                journal.finish(op_id, outcome, code, over=outcome != "unknown")

        slot = {"action": self._action_inflight, "config": self._config_inflight, "capture": self._capture_inflight, "message": self._message_inflight}.get(lane, self._inflight)  # (reset() may swap in a new one)
        acquired = slot.acquire(timeout=slot_wait) if slot_wait > 0 else slot.acquire(blocking=False)
        if not acquired:  # checked first: a `busy` refusal costs the caller no rate token
            reply.update(state="error", last_error="busy", sync=STATE.as_dict())
            settled()
            record("not_sent", "busy")
            return reply, "not_sent"
        if not free and not self._spend_token(who, bucket or lane):
            slot.release()
            reply.update(state="error", last_error=RATE_LIMITED, sync=STATE.as_dict())
            settled()
            record("not_sent", RATE_LIMITED)
            return reply, "not_sent"
        coro = self._one_off(send, not_after, channel)
        try:
            future = asyncio.run_coroutine_threadsafe(coro, loop)
        except RuntimeError as exc:  # the session's loop closed between the check above and scheduling
            coro.close()
            slot.release()
            reply.update(state="ha_unavailable", last_error=type(exc).__name__, sync=STATE.as_dict())
            settled()
            record("not_sent", type(exc).__name__)
            return reply, "not_sent"

        # the slot is freed when BOTH are through: the call itself (answer, session end, or ha_client's own 60 s limit -
        # a browser-side timeout does not stop WisKey's handler, so it must not free anything early either) and this
        # thread's handling of it, `on_result` included. The call's done-callback runs on the feed's loop, typically
        # before this thread has even woken up: freeing the slot there let the lane's next command (a capture poller's
        # status read) reach WisKey - and record its own view - between a cancel's answer and the cancel's record of
        # it, so a cancelled capture was reported `lost` (T054). `settled` still says when the call itself is over.
        through = threading.Lock()
        holders = [2]

        def let_go() -> None:
            with through:
                holders[0] -= 1
                last = holders[0] == 0
            if last:
                slot.release()

        def done(_f: Any) -> None:
            let_go()
            settled()

        future.add_done_callback(done)
        try:
            try:
                reply, outcome = self._settle(future, reply, key, project, timeout, lane, on_result)
            except BaseException:
                record("unknown", "error")
                if journal is not None:
                    future.add_done_callback(lambda _f: threading.Thread(target=journal.call_over, args=(op_id,), daemon=True).start())
                raise
            record(outcome, reply.get("last_error"))  # before _follow_unknown: its callback records the call's end
            if outcome == "unknown" and lane != "read":
                self._follow_unknown(future, key, lane, project, target, reply.get("last_error") == "timeout", on_late, op_id=op_id)
            return reply, outcome
        finally:
            let_go()

    def _settle(
        self,
        future: Any,
        reply: dict[str, Any],
        key: str,
        project: Callable[[Any], dict[str, Any]],
        timeout: float,
        lane: str,
        on_result: Callable[[dict[str, Any], str], None] | None,
    ) -> tuple[dict[str, Any], str]:
        """`_execute`'s wait for a scheduled command and its reading of the result, ending with `on_result`."""
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
        except NotSent as exc:  # WKINT-295: only the direct people-write send raises it
            reply.update(state="error", last_error=exc.code)
            outcome = "not_sent"
        except intercom_client.UnclearAnswer as exc:
            reply.update(state="error", last_error=exc.code)  # outcome stays "unknown"
        except IntercomError as exc:
            if exc.code in REQUEST_ERRORS and lane == "read":
                status, code, message = REQUEST_ERRORS[exc.code]
                raise ApiError(status, code, message, details={"wiskey_code": exc.code}) from exc
            outcome = "refused"  # for an action / a write, only a pre-effect code gets here (intercom_client.PRE_EFFECT)
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
        if on_result is not None:
            on_result(reply, outcome)
        return reply, outcome

    def message_send(
        self,
        settings: Settings,
        key: str,
        send: Callable[[intercom_client.Call], Awaitable[Any]],
        project: Callable[[Any], dict[str, Any]],
        who: str,
        not_after: datetime.datetime | None = None,
    ) -> tuple[dict[str, Any], str]:
        """CR-036 WA: one WhatsApp send (WisKey `whatsapp/preview` + `whatsapp/send` in ONE coroutine, so both ride the same slot and
        the same token) in the message lane, on the `messaging` channel's guard - never queued, never retried. Unlike `action` it
        does not turn a refused or unknown outcome into an ApiError: it returns `_execute`'s (reply, outcome) - `ok`, `not_sent`
        (nothing reached WisKey), `refused` (WisKey answered with a proven pre-effect refusal, code in `reply["last_error"]`) or
        `unknown` (sent, no usable answer: timeout, a dropped session, or a code that may come after the provider call) - because
        the caller (services/intercom_messaging.py) has its own table of what each WisKey code means for a message."""
        return self._execute(settings, key, send, project, who, MESSAGE_TIMEOUT_S, lane="message", not_after=not_after, channel="messaging")

    def capture_read(
        self,
        settings: Settings,
        send: Callable[[intercom_client.Call], Awaitable[Any]],
        project: Callable[[Any], dict[str, Any]],
        who: str,
        on_result: Callable[[dict[str, Any], str], None] | None = None,
    ) -> tuple[dict[str, Any], str]:
        """The card-capture poller's `cards/capture_status` read (services/intercom_capture.py): the capture lane - so
        a user's start / cancel, not the read lane, is what it competes with - never waiting for the slot (a busy slot
        or an empty bucket just skips a tick) and paid from the poller's own bucket (`capture_poll`), never from a
        user's. `on_result`: the poller's record of what it read, made before the slot is freed (`_execute`). Returns
        `_execute`'s (reply under `capture`, outcome)."""
        return self._execute(settings, "capture", send, project, who, CAPTURE_TIMEOUT_S, lane="capture", bucket="capture_poll", on_result=on_result)

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

    def subscribe_state(self) -> str:
        """Whether WisKey's `subscribe` is live on this session (`ok`) or not (`not_attempted`: no ready session yet)."""
        return "ok" if self._wiskey_sub is not None and STATE.state == "ready" else "not_attempted"

    def stations(self) -> list[dict[str, Any]]:
        """Every station of the served copy (empty without one) - the door map and the station scope read names and
        relays from here (CR-033 D1/D2), never from the device."""
        with self._cache_lock:
            cached = self._cache
        return list((cached or {}).get("stations", []))

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

    async def _one_off(self, send: Callable[[intercom_client.Call], Awaitable[Any]], not_after: datetime.datetime | None = None, channel: str = "service") -> Any:
        """On the feed's loop: send over the session that is live NOW (it may have ended since the request thread
        looked), never a new connection - and, for a physical action, only while it has not expired. `channel` picks the
        guard the frame goes through (CR-036 S4): `service` (writes and the write flows' reads), `read` / `technical`
        (the adapter's reads, services/intercom_adapter.py) - the same socket, a different allow-list."""
        call = self._call if channel == "service" else self._channel_calls.get(channel)
        if call is None or self._call is None or STATE.state != "ready":
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
        from . import intercom_adapter  # CR-036 S4: the adapter's closed projections (it imports this module)

        tag = change_tag(raw)
        tag_changed = self._tag is not None and tag != self._tag
        self._tag = tag
        projected = project_overview(raw)
        hosts = {
            str(s.get("id") or ""): s["host"]
            for s in raw.get("stations") or []
            if isinstance(s, dict) and isinstance(s.get("host"), str) and s["host"]
        }
        try:
            technical = {
                str(s.get("id")): intercom_adapter.project_station_technical(s)
                for s in raw.get("stations") or []
                if isinstance(s, dict) and isinstance(s.get("id"), str) and s["id"]
            }
            api = intercom_adapter.project_api(raw.get("api"))
        except Exception as exc:  # noqa: BLE001 - the adapter's extras must never take the entry center down: fail closed
            log.warning("WisKey feed: the adapter's station / api projection failed (%s); technical details and features withheld", type(exc).__name__)
            technical, api = {}, None
        with self._cache_lock:
            changed = projected != self._cache
            before = list((self._cache or {}).get("stations") or [])
            self._cache = projected
            self._hosts = hosts
            self._technical = technical
            self._api = api
        if changed:
            from . import notify_sources  # CR-018: a station that starts ringing signals `door.ring` - queued for the notifier's thread, never a write on this loop

            notify_sources.on_stations(before, projected["stations"])
            lease_station_diff(before, projected["stations"])
        STATE.fetched_at = now_iso()
        self._fetched_mono = time.monotonic()
        STATE.refreshes += 1
        STATE.wiskey_version = projected["version"]
        if changed:
            STATE.sequence += 1
            publish({"type": "intercom_refresh", "sequence": STATE.sequence})
        elif tag_changed:  # only what B0 no longer projects changed (a new access record, a people edit): still one notice
            STATE.sequence += 1
            publish({"type": "intercom_refresh", "sequence": STATE.sequence})
        return changed

    def _drop(self) -> None:
        with self._cache_lock:
            self._cache = None
            self._hosts = {}
            self._technical = {}
            self._api = None
        self._tag = None
        from . import intercom_adapter  # CR-036 S4: whatever the adapter cached from this WisKey goes with the copy

        intercom_adapter.ADAPTER.forget()

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
                _lease_hook("feed_reconnect")  # CR-WISKEY-LEASE-REVOCATION-EVENT T8: a feed reconnect revokes every live capture lease
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
            from . import wiskey_channels

            from .wiskey_native_feed import bind_metadata
            raw = await bind_metadata(call, self.settings)
            native_metadata_call = raw
            call = wiskey_channels.guard(raw, "service")  # CR-036 S1: only the service (write) channel's allow-list leaves here
            self._call = call
            # CR-036 S4: the adapter's reads ride this socket under their own guards (no write is on either list)
            self._channel_calls = {name: wiskey_channels.guard(raw, name) for name in wiskey_channels.ADAPTER_CHANNELS}
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
                    renew_at = getattr(native_metadata_call, "native_subscription_renew_at", None)
                    if renew_at is not None and time.monotonic() >= renew_at:
                        # A new finite registration after cancelling this exact
                        # old id. No proof or media activity is renewed in place.
                        if self._wiskey_sub is not None:
                            await call("unsubscribe_events", subscription=self._wiskey_sub)
                        self._wiskey_sub = await intercom_client.subscribe(call)
                        self._replay_early()
                    if self.watched():
                        await self._refresh()

            poller = asyncio.create_task(poll(), name="intercom-poll")

        try:
            await ha_client.ws_session(self.settings, on_ready, lambda _data: None, end, on_message=self._on_message)
        finally:
            self._call = None
            self._channel_calls = {}
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
                from . import intercom_adapter  # CR-036 S4: the adapter's cached reads are stale from now on

                intercom_adapter.ADAPTER.cache.invalidate()
                self._kick()
            elif kind == "access_revoked":
                _lease_hook("receiver_changed")  # T8: the add-on lost WisKey access - every live capture lease goes
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


def _lease_hook(reason: str, station_ids: list[str] | None = None) -> None:
    """CR-WISKEY-LEASE-REVOCATION-EVENT T7 / T8 (capture leases). Non-blocking (safe on this event loop), never raises."""
    try:
        from . import capture_lease

        if station_ids is None:
            capture_lease.on_authority_change(reason, all=True)
        elif station_ids:
            capture_lease.on_authority_change(reason, station_ids=station_ids)
    except Exception:  # noqa: BLE001
        pass


LEASE_RECEIVER_KEYS = ("lock_enabled", "locks")


def lease_station_diff(before: list[Any], after: list[Any]) -> None:
    """T7 / T8 from one overview refresh: a station that left the overview or whose `binding_revision` (WisKey's, W? - absent
    today) moved -> `binding_changed`; a station not online -> `receiver_offline`; its managed lock set changed ->
    `receiver_changed`. Only stations with a live lease are affected (the hook matches). EXTENSION POINT: the reader set of
    `cards/reader_capabilities` compared with the one at issue (needs the reader set recorded at issue; not built)."""
    try:
        from . import capture_lease

        if not capture_lease.has_live():
            return
        old = {s["id"]: s for s in before if isinstance(s, dict) and isinstance(s.get("id"), str)}
        new = {s["id"]: s for s in after if isinstance(s, dict) and isinstance(s.get("id"), str)}
        gone = [sid for sid in old if sid not in new]
        moved = [sid for sid, s in new.items() if sid in old and s.get("binding_revision") != old[sid].get("binding_revision")]
        offline = [sid for sid, s in new.items() if s.get("online") is not True]
        receiver = [sid for sid, s in new.items() if sid in old and any(s.get(k) != old[sid].get(k) for k in LEASE_RECEIVER_KEYS)]
        _lease_hook("binding_changed", gone + moved)
        _lease_hook("receiver_offline", offline)
        _lease_hook("receiver_changed", receiver)
    except Exception:  # noqa: BLE001
        log.warning("capture lease: station diff failed", exc_info=True)


SYNC = IntercomSync()
