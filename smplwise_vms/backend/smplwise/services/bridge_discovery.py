"""BRIDGE-STALE-DISCOVERY-2383: the lifecycle of Arx's own Supervisor discovery message for the `smplwise_bridge` integration, and the symptom
when it went wrong (the bridge's signed directory pushes refused). See docs/changes/BRIDGE-STALE-DISCOVERY-2383.md.

Why: Home Assistant replays EVERY Supervisor discovery message at each start (hassio/discovery.py, the start handler lists `GET /discovery`
and starts a flow per message). A message Arx posted once stays in the Supervisor until it is deleted, so an OLD pairing code kept coming
back into the existing bridge entry after a re-pair (the bridge's K-02 re-pair path then threw the working key set away).

Supervisor rules relied on (supervisor/api/discovery.py, supervisor/discovery/__init__.py, api/middleware/security.py):
- `POST /discovery` (any add-on that lists the service under `discovery` in its config) answers `{uuid}`. A message is identified by
  (add-on, service): a second POST from the same add-on for the same service UPDATES that message in place (same uuid) and pushes it to
  Home Assistant again; a POST with an identical config is a duplicate - same uuid, nothing pushed.
- `DELETE /discovery/{uuid}`: only the add-on that posted the message (403 otherwise, 404 for an unknown uuid). Home Assistant is told and,
  for an entry whose unique_id equals that uuid and whose source is `hassio`, removes it - the bridge's unique_id is its domain, never a
  discovery uuid, so deleting the message never removes the bridge entry.
- `GET /discovery` and `GET /discovery/{uuid}` are Home Assistant's only (`require_home_assistant`): an add-on cannot list or read messages.
  The uuid of a message posted by an older Arx (which kept no uuid) is therefore recovered by one POST of a harmless config (`addon_url`
  only - the bridge aborts `invalid_discovery` without touching its entry), which answers the existing message's uuid, then DELETE.

The invariant this module keeps: the Supervisor holds a `smplwise_bridge` message from Arx only while it carries Arx's CURRENT plain
pairing code that is not adopted into the key set yet (K-01). Settings rows (installation-local, never in a project backup):
- `bridge.discovery_messages`: {uuid: {fp, at}} of every message Arx posted and has not deleted yet. `fp` is a one-way tag of the code
  the message carried (sha256 of a fixed label + the code, 16 hex) or null for the harmless recovery post. Never the code itself.
- `bridge.discovery_swept_at`: when Arx last learned the uuid of its message (any successful POST); before it is set, Arx runs the one
  recovery sweep above.

Network calls never run while the request's write lock is held (`unlocked`). Nothing here logs a code, a fingerprint or a uuid."""
from __future__ import annotations

import hashlib
import json
import logging
import re
import sqlite3
import threading
import time
from contextlib import contextmanager
from typing import Any, Iterator

from ..config import Settings
from ..db import Database, get_setting, now_iso, set_setting, unlocked
from ..errors import ApiError
from . import bridge_keys as bk
from . import ha_client

log = logging.getLogger("smplwise.bridge.discovery")

SERVICE = "smplwise_bridge"
K_MESSAGES = "bridge.discovery_messages"
K_SWEPT = "bridge.discovery_swept_at"
FP_LABEL = b"arx-bridge-discovery-fp.v1|"
UUID_RE = re.compile(r"[0-9a-f]{32}")
MAX_RECORDS = 16
REMOVED = ("deleted", "gone", "forbidden")  # "forbidden": not Arx's message - it can never be deleted by Arx, so it is not retried

_RETIRE_LOCK = threading.Lock()


def code_fp(code: str) -> str:
    return hashlib.sha256(FP_LABEL + code.encode("utf-8")).hexdigest()[:16]


# ---------------------------------------------------------------- local facts

def records(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    raw = get_setting(conn, K_MESSAGES)
    try:
        d = json.loads(raw) if raw else {}
    except ValueError:
        return {}
    if not isinstance(d, dict):
        return {}
    return {u: v for u, v in d.items() if isinstance(u, str) and UUID_RE.fullmatch(u) and isinstance(v, dict)}


def _store(conn: sqlite3.Connection, d: dict[str, dict[str, Any]]) -> None:
    newest = sorted(d.items(), key=lambda kv: str(kv[1].get("at") or ""))[-MAX_RECORDS:]
    set_setting(conn, K_MESSAGES, json.dumps(dict(newest), sort_keys=True))


def current_code(conn: sqlite3.Connection) -> str | None:
    """The only code a discovery may carry right now (K-01): the plain pairing code while it is not adopted into the key set. Never creates one."""
    if bk.adopted(conn):
        return None
    return get_setting(conn, "bridge.secret") or None


def bridge_seen(conn: sqlite3.Connection) -> bool:
    """A bridge entry has talked to Arx at least once (a ping or a signed push recorded its version) - kept across a re-pair."""
    return bool(get_setting(conn, "bridge.integration_version"))


def may_announce(conn: sqlite3.Connection, manual_profile: bool) -> bool:
    """On a manual WisKey owner profile Arx installs nothing into Home Assistant; delivering a new code to the EXISTING bridge entry (the bridge's
    K-02 re-pair path) installs nothing, so it stays open there once a bridge is known. Without a known bridge the owner adds it himself."""
    return (not manual_profile) or bridge_seen(conn)


def manual_profile() -> bool:
    from . import bridge_install

    try:
        return bridge_install._manual_owner_profile(bridge_install.ha_config_dir())
    except Exception:  # noqa: BLE001 - an unreadable config directory counts as "not manual"; the gate below still needs the token
        return False


def path_open(conn: sqlite3.Connection) -> bool:
    """Whether a new pairing code reaches the bridge by itself (Supervisor discovery). Read only."""
    try:
        return bool(ha_client.supervisor_token()) and may_announce(conn, manual_profile())
    except Exception:  # noqa: BLE001
        return False


def stale(conn: sqlite3.Connection, keep: str | None = None) -> list[str]:
    """The recorded messages whose code is no longer the current one (every message once the code is adopted), except `keep`."""
    cur = current_code(conn)
    fp = code_fp(cur) if cur else None
    return [u for u, v in records(conn).items() if u != keep and (fp is None or v.get("fp") != fp)]


def facts(conn: sqlite3.Connection) -> dict[str, Any]:
    return {"discovery_messages": len(records(conn)), "discovery_swept": bool(get_setting(conn, K_SWEPT)), "discovery_path_open": path_open(conn)}


# ---------------------------------------------------------------- transaction helpers

@contextmanager
def _conn(db: Database | None, conn: sqlite3.Connection | None, label: str) -> Iterator[sqlite3.Connection]:
    if conn is not None:
        yield conn
        return
    assert db is not None
    with db.connection(label=label) as c:
        yield c


@contextmanager
def _net(conn: sqlite3.Connection | None) -> Iterator[None]:
    if conn is None:
        yield
        return
    with unlocked(conn):  # the Supervisor call runs without the request's write lock
        yield


# ---------------------------------------------------------------- actions

def _delete(db: Database | None, settings: Settings, conn: sqlite3.Connection | None, uuids: list[str]) -> dict[str, str]:
    if not uuids:
        return {}
    out: dict[str, str] = {}
    with _net(conn):
        for u in uuids:
            try:
                out[u] = ha_client.delete_discovery(settings, u)
            except Exception as exc:  # noqa: BLE001 - a refused call shape or a broken transport: retried later
                log.warning("bridge discovery removal failed (%s)", type(exc).__name__)
                out[u] = "failed"
    with _conn(db, conn, "bridge discovery removal") as c:
        d = records(c)
        for u, result in out.items():
            if result in REMOVED:
                d.pop(u, None)
        _store(c, d)
    n_removed = sum(1 for r in out.values() if r in REMOVED)
    log.info("bridge discovery: %d stale announcement(s) removed, %d left for a later retry", n_removed, len(out) - n_removed)
    return out


def after_post(db: Database | None, settings: Settings, conn: sqlite3.Connection | None, uuid: Any, code: str) -> dict[str, str]:
    """A discovery carrying `code` was posted and the Supervisor answered `uuid`: record it, then delete every OTHER message Arx recorded
    (post the new one first, then delete the old - with the Supervisor's in-place update the old uuid usually IS the new one and is kept)."""
    with _conn(db, conn, "bridge discovery record") as c:
        d = records(c)
        ok = isinstance(uuid, str) and bool(UUID_RE.fullmatch(uuid))
        if ok:
            d[uuid] = {"fp": code_fp(code), "at": now_iso()}
        else:
            log.info("bridge discovery: the Supervisor answered without a usable message id; that announcement cannot be removed by Arx later")
        _store(c, d)
        set_setting(c, K_SWEPT, now_iso())
        others = [u for u in d if not ok or u != uuid]
    return _delete(db, settings, conn, others)


def retire(db: Database | None, settings: Settings, conn: sqlite3.Connection | None = None, *, sweep: bool = True) -> dict[str, str]:
    """Nothing current is being announced (the code was adopted - K-01 -, there is no code, or announcing is not allowed here): delete Arx's
    recorded messages whose code is no longer current, and - once per installation, when Arx never learned the uuid of its message - recover
    it with one harmless POST and delete it. Never raises; does nothing without the Supervisor token."""
    if not ha_client.supervisor_token():
        return {}
    if not _RETIRE_LOCK.acquire(blocking=False):
        return {}
    try:
        with _conn(db, conn, "bridge discovery check") as c:
            targets = stale(c)
            do_sweep = sweep and not records(c) and not get_setting(c, K_SWEPT)
        if do_sweep:
            from .bridge_install import addon_url

            try:
                with _net(conn):
                    data = ha_client.post_discovery(settings, SERVICE, {"addon_url": addon_url()})
            except ApiError as exc:
                log.info("bridge discovery: the one-time check for an older announcement did not run (%s)", exc.code)
                return _delete(db, settings, conn, targets)
            uuid = (data or {}).get("uuid")
            with _conn(db, conn, "bridge discovery sweep") as c:
                set_setting(c, K_SWEPT, now_iso())
                if isinstance(uuid, str) and UUID_RE.fullmatch(uuid):
                    d = records(c)
                    d[uuid] = {"fp": None, "at": now_iso()}
                    _store(c, d)
                    targets.append(uuid)
        return _delete(db, settings, conn, targets)
    except Exception as exc:  # noqa: BLE001 - housekeeping never takes a request or the start-up down
        log.warning("bridge discovery housekeeping failed (%s)", type(exc).__name__)
        return {}
    finally:
        _RETIRE_LOCK.release()


# ---------------------------------------------------------------- the symptom: the bridge's signed pushes refused

REFUSAL_CODES = frozenset({"bridge_bad_signature", "bridge_not_paired"})  # the push did not prove Arx's key (not a clock or replay refusal)
REFUSALS: dict[str, Any] = {"count": 0, "first_at": None, "last_at": None, "last_epoch": 0.0, "code": None}
_REF_LOCK = threading.Lock()


def note_directory_refused(code: str | None) -> None:
    """`POST /ha/bridge/directory` refused a push because its signature does not match Arx's key. Process memory only (the refusal's own
    transaction rolls back)."""
    if code not in REFUSAL_CODES:
        return
    with _REF_LOCK:
        if REFUSALS["count"] == 0:
            REFUSALS["first_at"] = now_iso()
        REFUSALS.update(count=REFUSALS["count"] + 1, last_at=now_iso(), last_epoch=time.time(), code=code)


def note_directory_accepted() -> None:
    with _REF_LOCK:
        REFUSALS.update(count=0, first_at=None, last_at=None, last_epoch=0.0, code=None)


def directory_refusals() -> dict[str, Any] | None:
    with _REF_LOCK:
        return dict(REFUSALS) if REFUSALS["count"] else None


def reset_for_tests() -> None:
    note_directory_accepted()
