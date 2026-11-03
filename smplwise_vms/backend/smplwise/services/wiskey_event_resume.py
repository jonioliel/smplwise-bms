"""WISKEY-EVENT-CURSOR-2400 (plan T15): gap-free WisKey door events across Arx, WisKey and Home Assistant restarts.

WisKey keeps a durable, sequenced copy of its door events and serves it page by page through `events/resume_v1`
(contract `wiskey-event-cursor.v1`, WisKey `event_resume.py`): a page is at-least-once, ordered by WisKey's acceptance sequence,
and every discontinuity is an explicit `reset_required` (`source_replaced`, `cursor_ahead`, `retention_gap`) - never a silent skip.
Until now Arx only had a consumer on the installed direct client (`wiskey_installed_features.EventCursor`), and nothing called it.
This module is the consumer on the SERVICE feed (services/intercom_sync.py): the session that is always up.

- The command leaves only as a signed `wiskey-bridge-command.v1` envelope (WisKey admits `events/resume_v1` through its bridge
  command host, never as a plain frame), over the service feed's own socket. `signed_sender` builds that sender; it can send
  exactly this one command (its own one-command guard, like the signed W10 path - the channel allow-lists are not widened).
- One cursor per WisKey event source (`wiskey_event_cursors`, migration 0201). WisKey's `source` is its event store's identity: a
  reinstall or a storage reset is a new source. Exactly one source is active; a reconnect resumes it from its stored cursor.
- Every delivered event is stored once (`wiskey_door_events`, primary key = WisKey's event id): a replayed page inserts nothing and
  is counted as duplicates. The events and the cursor move in ONE transaction - a crash before the commit replays the page.
- A discontinuity is recorded, never hidden: a `wiskey_event_gaps` row with the time range Arx cannot vouch for, and a
  `coverage_gap` row in the event centre (services/events_ingest.record_gap's shape) so the gap is visible in the events log.
  * cursor expired / too old (`retention_gap`), WisKey's history went back (`cursor_ahead`), a cursor WisKey cannot verify any
    more (`invalid_cursor` refusal): gap from the last moment Arx was complete to now; Arx adopts WisKey's reset point (or, for an
    unverifiable cursor, re-reads the source from its beginning - the retained history comes again and is de-duplicated).
  * WisKey reinstalled / its store reset (`source_replaced`, or a page from another source): a source Arx knew before is resumed
    from its own cursor (no gap); an unknown one starts fresh from its beginning, behind a gap.
  * Arx never held a cursor (first start): starts fresh, behind a `first_start` gap whose start is unknown.
- Concurrent reconnects: one pull at a time in this process (a second one answers `busy`), and the cursor moves only if it is still
  the one the page was read with (compare-and-set) - a stale puller's page is dropped, never stored over a newer cursor.
- Read only towards WisKey and the stations: no device write, no WisKey configuration change. (WisKey itself persists its resume
  bookkeeping on every call - its own storage, which is why the safety poll is slow and the pump mainly follows `refresh` pushes.)

The last outcome is kept in memory and in the setting `wiskey.events.resume.last` (codes, counts and instants only) and shown as
one status line on "מצב WisKey" (`status_line`, used by services/wiskey_pairing.py). `SW_WISKEY_EVENT_RESUME=0` turns the pump off.
"""
from __future__ import annotations

import asyncio
import datetime as dt
import json
import logging
import os
import re
import threading
import uuid
from typing import Any, Awaitable, Callable

from ..db import Database, get_setting, now_iso, set_setting
from . import intercom_client
from .intercom_client import IntercomError
from .wiskey_installed_features import EventCursorError, EventPage, read_page

log = logging.getLogger("smplwise.wiskey.events")

COMMAND = "events/resume_v1"
ENV = "SW_WISKEY_EVENT_RESUME"
LAST_KEY = "wiskey.events.resume.last"
PAGE_LIMIT = 200  # WisKey allows 1..500
MAX_STEPS = 50  # pages per pass; a longer backlog continues on the next pass (has_more)
SEND_TIMEOUT_S = 20.0
POLL_S = 300.0  # safety poll behind WisKey's `refresh` pushes (each call makes WisKey save its resume state)
WAKE_DEBOUNCE_S = 2.0
RETRY_S = (30.0, 60.0, 120.0, 300.0)
RETENTION_DAYS = 400  # stored door events older than this (by received_at) are pruned
GAP_VISIBLE_DAYS = 7  # the status line warns about a gap this recent
_STR = 128
_TS_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")

Sender = Callable[[str | None, int], Awaitable[Any]]

_PULL_LOCK = threading.Lock()  # one pull at a time in this process (the CAS below covers anything else)
STATUS: dict[str, Any] = {"last": None}  # the last pass's outcome (process memory; the setting keeps it across restarts)
_PUMP: dict[str, Any] = {"wake": None, "loop": None}
_clock: Callable[[], str] = now_iso


def enabled() -> bool:
    return os.environ.get(ENV, "1") != "0"


def reset_for_tests() -> None:
    global _clock
    STATUS["last"] = None
    _PUMP.update(wake=None, loop=None)
    _clock = now_iso


def set_clock_for_tests(clock: Callable[[], str]) -> None:
    global _clock
    _clock = clock


# ---------------------------------------------------------------- the closed projection of one WisKey event record

def _s(v: Any, default: str = "unknown", limit: int = _STR) -> str:
    return v[:limit] if isinstance(v, str) and v and not any(ord(c) < 32 or ord(c) == 127 for c in v) else default


def _ts(v: Any) -> str | None:
    """An ISO instant; an offset-aware one is normalised to UTC `...Z` (so instants compare as text). A naive one is kept as sent
    (a device-clock quirk is evidence, not something to correct here)."""
    if not isinstance(v, str) or not _TS_RE.match(v) or len(v) > 40:
        return None
    try:
        parsed = dt.datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return v
    return parsed.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def project_event(source: str, sequence: int, event: dict[str, Any], stored_at: str) -> dict[str, Any]:
    """WisKey's event record -> the stored row. Built field by field: a person's name, employee number, card, major/minor never
    reach Arx's table. A malformed optional field becomes `unknown` / NULL rather than blocking the cursor behind one record."""
    received = _ts(event.get("received_at")) or stored_at
    door = event.get("door")
    return {"event_id": event["id"], "source": source, "sequence": sequence, "station_id": _s(event.get("station_id")),
            "event_type": _s(event.get("event_type"), limit=64), "result": _s(event.get("result"), limit=32),
            "authentication": _s(event.get("authentication"), limit=32),
            "door": door if type(door) is int and 0 <= door <= 64 else None,
            "occurred_at": _ts(event.get("timestamp")) or received, "time_source": _s(event.get("time_source"), limit=32),
            "received_at": received, "recovered": 1 if event.get("recovered") is True else 0, "stored_at": stored_at}


# ---------------------------------------------------------------- state (SQL)

def _active(conn: Any) -> dict[str, Any] | None:
    row = conn.execute("SELECT source, cursor, last_sequence, fresh_gap_id, caught_up_at, last_event_at FROM wiskey_event_cursors "
                       "WHERE active = 1").fetchone()
    return None if row is None else dict(zip(("source", "cursor", "last_sequence", "fresh_gap_id", "caught_up_at", "last_event_at"), tuple(row)))


def _row(conn: Any, source: str) -> dict[str, Any] | None:
    row = conn.execute("SELECT source, cursor, fresh_gap_id FROM wiskey_event_cursors WHERE source = ?", (source,)).fetchone()
    return None if row is None else {"source": row[0], "cursor": row[1], "fresh_gap_id": row[2]}


def _activate(conn: Any, source: str, now: str, *, cursor: str | None = None, fresh_gap_id: str | None = None, create: bool) -> None:
    conn.execute("UPDATE wiskey_event_cursors SET active = 0 WHERE active = 1 AND source <> ?", (source,))
    if create:
        conn.execute("INSERT INTO wiskey_event_cursors(source, cursor, active, fresh_gap_id, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?) "
                     "ON CONFLICT(source) DO UPDATE SET cursor = excluded.cursor, active = 1, fresh_gap_id = excluded.fresh_gap_id, "
                     "updated_at = excluded.updated_at", (source, cursor, fresh_gap_id, now, now))
    else:
        conn.execute("UPDATE wiskey_event_cursors SET active = 1, updated_at = ? WHERE source = ?", (now, source))


def _complete_until(st: dict[str, Any] | None) -> str | None:
    """The last moment Arx's copy of the source was known complete: the later of its last caught-up page and its newest event."""
    if st is None:
        return None
    marks = [m for m in (st.get("caught_up_at"), st.get("last_event_at")) if m]
    return max(marks) if marks else None


def _record_gap(conn: Any, reason: str, from_at: str | None, to_at: str, old_source: str | None, new_source: str | None) -> str:
    """One gap row + its visible marker in the event centre (`coverage_gap`, camera-less, like events_ingest.record_gap)."""
    gid = uuid.uuid4().hex[:16]
    eid = uuid.uuid4().hex[:12]
    details = {"origin": "wiskey_events", "reason": reason, "from": from_at, "to": to_at, "old_source": old_source, "new_source": new_source,
               "complete": False}
    conn.execute("INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, "
                 "confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                 (eid, "system", "wiskey_events_gap", "coverage_gap", None, None, from_at or to_at, to_at, to_at, "none", 1, "alert", "measured",
                  json.dumps(details, separators=(",", ":")), f"wkgap:{gid}", to_at))
    conn.execute("INSERT INTO wiskey_event_gaps(id, reason, from_at, to_at, old_source, new_source, event_ref, observed_at) VALUES (?,?,?,?,?,?,?,?)",
                 (gid, reason, from_at, to_at, old_source, new_source, eid, to_at))
    log.warning("wiskey events: gap recorded (%s) from %s to %s; the history in between is not in Arx", reason, from_at or "unknown", to_at)
    return gid


def _extend_gap(conn: Any, gap_id: str, to_at: str) -> None:
    row = conn.execute("SELECT event_ref, to_at FROM wiskey_event_gaps WHERE id = ?", (gap_id,)).fetchone()
    if row is None or (row[1] or "") >= to_at:
        return
    conn.execute("UPDATE wiskey_event_gaps SET to_at = ? WHERE id = ?", (to_at, gap_id))
    ev = conn.execute("SELECT details_json FROM events WHERE id = ?", (row[0],)).fetchone()
    if ev is not None:
        details = json.loads(ev[0] or "{}")
        details["to"] = to_at
        conn.execute("UPDATE events SET ended_at = ?, details_json = ? WHERE id = ?", (to_at, json.dumps(details, separators=(",", ":")), row[0]))


def _store_records(conn: Any, page: EventPage, now: str) -> tuple[int, int, str | None]:
    fresh = dup = 0
    newest: str | None = None
    for rec in page.records:
        row = project_event(page.source, rec["sequence"], rec["event"], now)
        cur = conn.execute("INSERT OR IGNORE INTO wiskey_door_events(event_id, source, sequence, station_id, event_type, result, authentication, door, "
                           "occurred_at, time_source, received_at, recovered, stored_at) VALUES (:event_id, :source, :sequence, :station_id, "
                           ":event_type, :result, :authentication, :door, :occurred_at, :time_source, :received_at, :recovered, :stored_at)", row)
        if cur.rowcount == 1:
            fresh += 1
        else:
            dup += 1
        newest = max(newest or "", row["received_at"])
    return fresh, dup, newest


def _prune(conn: Any, now: str) -> None:
    try:
        cutoff = (dt.datetime.fromisoformat(now.replace("Z", "+00:00")) - dt.timedelta(days=RETENTION_DAYS)).isoformat().replace("+00:00", "Z")
    except ValueError:
        return
    conn.execute("DELETE FROM wiskey_door_events WHERE received_at < ?", (cutoff,))


# ---------------------------------------------------------------- one request / answer

def _plan(db: Database) -> dict[str, Any] | None:
    with db.connection(mode="read", label="wiskey events resume plan") as conn:
        return _active(conn)


def _apply(db: Database, sent: dict[str, Any] | None, answer: Any, now: str) -> dict[str, Any]:
    """Apply one answer to the request that was sent with `sent` (the active row as it was; None = no cursor yet). One write
    transaction; nothing is written when another puller moved the cursor meanwhile (`superseded`)."""
    sent_source = sent["source"] if sent else None
    sent_cursor = sent["cursor"] if sent else None
    gaps: list[str] = []
    with db.write_aside(label="wiskey events resume") as conn:
        cur = _active(conn)
        if (cur["source"] if cur else None, cur["cursor"] if cur else None) != (sent_source, sent_cursor):
            return {"state": "superseded"}
        if answer == "invalid_cursor":  # WisKey cannot verify the stored cursor any more: re-read the source from its beginning
            gid = _record_gap(conn, "cursor_invalid", _complete_until(cur), now, sent_source, sent_source)
            conn.execute("UPDATE wiskey_event_cursors SET cursor = NULL, fresh_gap_id = ?, updated_at = ? WHERE source = ?", (gid, now, sent_source))
            return {"state": "gap", "reason": "cursor_invalid", "gap": gid}
        page: EventPage = answer
        if sent is None:  # first start: Arx never held a cursor
            known = _row(conn, page.source)
            if known is not None:
                _activate(conn, page.source, now, create=False)
                return {"state": "switched", "source": page.source}
            gid = _record_gap(conn, "first_start", None, now, None, page.source)
            gaps.append(gid)
            _activate(conn, page.source, now, cursor=None, fresh_gap_id=gid, create=True)
            sent = {"source": page.source, "cursor": None, "fresh_gap_id": gid, "caught_up_at": None, "last_event_at": None}
            sent_source = page.source
        if page.state == "page":
            if page.source != sent_source:  # a page of another source than the cursor's: a discontinuity WisKey did not announce
                return _switch(conn, sent, page.source, "source_mismatch", now)
            fresh, dup, newest = _store_records(conn, page, now)
            last_seq = page.records[-1]["sequence"] if page.records else None
            conn.execute("UPDATE wiskey_event_cursors SET cursor = ?, last_sequence = COALESCE(?, last_sequence), fresh_gap_id = NULL, "
                         "caught_up_at = CASE WHEN ? THEN ? ELSE caught_up_at END, "
                         "last_event_at = CASE WHEN ? IS NOT NULL AND (last_event_at IS NULL OR ? > last_event_at) THEN ? ELSE last_event_at END, "
                         "updated_at = ? WHERE source = ?",
                         (page.cursor, last_seq, 1 if page.all_delivered else 0, now, newest, newest, newest, now, sent_source))
            if fresh:
                _prune(conn, now)
            return {"state": "page", "delivered": fresh, "duplicates": dup, "has_more": page.has_more, "all_delivered": page.all_delivered,
                    "gaps": gaps}
        # reset_required
        if page.reason == "source_replaced" or page.source != sent_source:
            return _switch(conn, sent, page.source, "source_replaced" if page.reason == "source_replaced" else "source_mismatch", now)
        if sent_cursor is None and sent.get("fresh_gap_id"):
            # a fresh start that WisKey cannot serve from the beginning (retention): the open gap already covers it - extended, no second gap
            _extend_gap(conn, sent["fresh_gap_id"], now)
            conn.execute("UPDATE wiskey_event_cursors SET cursor = ?, fresh_gap_id = NULL, updated_at = ? WHERE source = ?",
                         (page.reset_cursor, now, sent_source))
            return {"state": "adopted", "reason": page.reason, "gaps": gaps}
        gid = _record_gap(conn, page.reason or "retention_gap", _complete_until(sent), now, sent_source, sent_source)
        conn.execute("UPDATE wiskey_event_cursors SET cursor = ?, fresh_gap_id = NULL, updated_at = ? WHERE source = ?",
                     (page.reset_cursor, now, sent_source))
        return {"state": "gap", "reason": page.reason, "gap": gid, "gaps": gaps}


def _switch(conn: Any, sent: dict[str, Any], new_source: str, reason: str, now: str) -> dict[str, Any]:
    """WisKey's event store is another one now. A source Arx resumed before continues from its own cursor (no gap); an unknown one
    starts from its beginning behind a gap that runs from the old source's last complete moment."""
    if _row(conn, new_source) is not None:
        _activate(conn, new_source, now, create=False)
        return {"state": "switched", "source": new_source}
    gid = _record_gap(conn, reason, _complete_until(sent), now, sent["source"], new_source)
    _activate(conn, new_source, now, cursor=None, fresh_gap_id=gid, create=True)
    return {"state": "gap", "reason": reason, "gap": gid}


async def step(send: Sender, db: Database, *, limit: int = PAGE_LIMIT) -> dict[str, Any]:
    """One `events/resume_v1` round trip and its effect. Never raises for WisKey's answers; the outcome says what happened."""
    sent = await asyncio.to_thread(_plan, db)
    try:
        raw = await asyncio.wait_for(send(sent["cursor"] if sent else None, limit), SEND_TIMEOUT_S)
        answer: Any = read_page(raw)
    except asyncio.TimeoutError:
        return {"state": "error", "code": "timeout"}
    except EventCursorError as exc:
        return {"state": "error", "code": exc.code}
    except IntercomError as exc:
        if exc.code == "invalid_cursor" and sent is not None and sent["cursor"] is not None:
            answer = "invalid_cursor"
        elif exc.not_installed:
            return {"state": "unsupported", "code": exc.code}
        else:
            return {"state": "refused", "code": exc.code}
    return await asyncio.to_thread(_apply, db, sent, answer, _clock())


async def pass_once(send: Sender, db: Database, *, limit: int = PAGE_LIMIT, max_steps: int = MAX_STEPS) -> dict[str, Any]:
    """Read until WisKey says everything was delivered (or `max_steps` pages, or an error). One pass at a time per process."""
    if not _PULL_LOCK.acquire(blocking=False):
        return {"state": "busy"}
    try:
        total = {"delivered": 0, "duplicates": 0, "pages": 0, "gaps": [], "switched": 0}
        last: dict[str, Any] = {"state": "idle"}
        for _ in range(max_steps):
            last = await step(send, db, limit=limit)
            total["gaps"] += [g for g in (last.get("gaps") or []) if g not in total["gaps"]]
            if last.get("gap"):
                total["gaps"].append(last["gap"])
            if last["state"] == "switched":
                total["switched"] += 1
                if total["switched"] > 2:  # never loop between two sources
                    last = {"state": "error", "code": "source_loop"}
                    break
                continue
            if last["state"] in ("gap", "adopted"):
                continue
            if last["state"] != "page":
                break
            total["pages"] += 1
            total["delivered"] += last["delivered"]
            total["duplicates"] += last["duplicates"]
            if not last["has_more"]:
                break
        outcome = {"at": _clock(), "state": last["state"], "code": last.get("code"), "delivered": total["delivered"],
                   "duplicates": total["duplicates"], "pages": total["pages"], "gaps": len(total["gaps"]),
                   "caught_up": last["state"] == "page" and bool(last.get("all_delivered"))}
        await asyncio.to_thread(_remember, db, outcome)
        return outcome
    finally:
        _PULL_LOCK.release()


def _remember(db: Database, outcome: dict[str, Any]) -> None:
    previous = STATUS.get("last")
    STATUS["last"] = outcome
    same = previous is not None and all(previous.get(k) == outcome.get(k) for k in ("state", "code", "caught_up")) and not (
        outcome["delivered"] or outcome["gaps"])
    if same:
        return  # nothing new to keep across a restart (the in-memory line still shows the latest time)
    try:
        with db.write_aside(label="wiskey events resume status") as conn:
            set_setting(conn, LAST_KEY, json.dumps(outcome, separators=(",", ":")))
    except Exception as exc:  # noqa: BLE001 - the status is best effort; the cursor is already safe
        log.info("wiskey events: could not keep the last outcome (%s)", type(exc).__name__)


# ---------------------------------------------------------------- the signed sender on the service feed's socket

def _signing_key(settings: Any) -> Any:
    from . import ha_bridge

    with Database(settings.db_path).connection(mode="read", label="wiskey events signing key") as conn:
        return ha_bridge.signing_key(conn)


def signed_sender(call: intercom_client.Call, settings: Any, *, key_reader: Callable[[Any], Any] | None = None) -> Sender:
    """`send(cursor, limit)` over the feed's raw session: the identity is the session's Home Assistant user (as the signed metadata
    reads, services/wiskey_native_feed.py), each request is signed afresh with the pairing key. This sender can carry nothing but
    `events/resume_v1` with exactly `{cursor, limit}`."""
    from .wiskey_media_bridge import TYPE_PREFIX, BridgeSigner, MediaBridgeError

    identity: dict[str, str] = {}
    read_key = key_reader or _signing_key

    async def send(cursor: str | None, limit: int) -> Any:
        if not (cursor is None or isinstance(cursor, str)) or type(limit) is not int:
            raise IntercomError("invalid_fields", COMMAND)
        if "id" not in identity:
            who = await call("auth/current_user")
            result = who.get("result") if isinstance(who, dict) and who.get("success") is True else None
            uid = result.get("id") if isinstance(result, dict) else None
            if not isinstance(uid, str) or re.fullmatch(r"[0-9a-f]{32}", uid) is None:
                raise IntercomError("unauthorized", COMMAND)
            identity["id"] = uid
        key = await asyncio.to_thread(read_key, settings)
        if not key:
            raise IntercomError("bridge_not_paired", COMMAND)
        try:
            proof = BridgeSigner(lambda: key).command_proof(COMMAND, identity["id"], {"cursor": cursor, "limit": limit})
        except MediaBridgeError as exc:
            raise IntercomError(exc.code, COMMAND) from None
        return intercom_client._result(await call(TYPE_PREFIX + COMMAND, bridge=proof), COMMAND)

    return send


# ---------------------------------------------------------------- the pump (one per service-feed session)

def wake() -> None:
    """A WisKey `refresh` push: something changed - new door events among it. Called on the feed's loop."""
    ev = _PUMP.get("wake")
    if ev is not None:
        ev.set()


async def run(send: Sender, db: Database, end: asyncio.Event) -> None:
    """Pass on connect, then after every `refresh` push (debounced) or every POLL_S; after a failure the retry backs off. Ends with
    the session (cancelled with its tasks)."""
    wake_ev = asyncio.Event()
    _PUMP.update(wake=wake_ev, loop=asyncio.get_running_loop())
    failures = 0
    try:
        while not end.is_set():
            wake_ev.clear()  # a push that arrives during the pass below triggers the next one
            try:
                out = await pass_once(send, db)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 - the feed must outlive any surprise here
                log.warning("wiskey events: resume pass failed (%s)", type(exc).__name__)
                out = {"state": "error", "code": type(exc).__name__}
            if out["state"] == "unsupported":
                log.info("wiskey events: WisKey does not offer %s; the pump stops for this session", COMMAND)
                return
            ok = out["state"] in ("page", "busy", "superseded")
            failures = 0 if ok else failures + 1
            if ok and out["state"] == "page" and not out.get("caught_up"):
                await asyncio.sleep(0)  # a backlog: the next pass right away
                continue
            delay = POLL_S if ok else RETRY_S[min(failures, len(RETRY_S)) - 1]
            try:
                await asyncio.wait_for(wake_ev.wait(), delay)
                await asyncio.sleep(WAKE_DEBOUNCE_S)  # coalesce a burst of pushes
            except asyncio.TimeoutError:
                pass
    finally:
        if _PUMP.get("wake") is wake_ev:
            _PUMP.update(wake=None, loop=None)


def start(call: intercom_client.Call, settings: Any, end: asyncio.Event) -> asyncio.Task[None] | None:
    """Called by the service feed when its session is ready (raw, unguarded `call`: the sender adds its own one-command guard)."""
    if not enabled() or settings is None:
        return None
    try:
        db = Database(settings.db_path)
    except Exception as exc:  # noqa: BLE001 - the feed's session never fails because of this pump
        log.warning("wiskey events: the resume pump did not start (%s)", type(exc).__name__)
        return None
    return asyncio.get_running_loop().create_task(run(signed_sender(call, settings), db, end), name="wiskey-event-resume")


# ---------------------------------------------------------------- the status line ("מצב WisKey")

def last_outcome(conn: Any) -> dict[str, Any] | None:
    if STATUS.get("last") is not None:
        return STATUS["last"]
    try:
        doc = json.loads(get_setting(conn, LAST_KEY) or "null")
    except ValueError:
        return None
    return doc if isinstance(doc, dict) else None


def recent_gap(conn: Any, now: dt.datetime | None = None) -> dict[str, Any] | None:
    if now is None:
        try:
            now = dt.datetime.fromisoformat(_clock().replace("Z", "+00:00"))
        except ValueError:
            now = dt.datetime.now(dt.timezone.utc)
    since = (now - dt.timedelta(days=GAP_VISIBLE_DAYS)).isoformat().replace("+00:00", "Z")
    try:
        row = conn.execute("SELECT reason, from_at, to_at FROM wiskey_event_gaps WHERE observed_at >= ? ORDER BY observed_at DESC LIMIT 1",
                           (since,)).fetchone()
    except Exception:  # noqa: BLE001 - before the migration ran
        return None
    return None if row is None else {"reason": row[0], "from": row[1], "to": row[2]}


def facts(conn: Any) -> dict[str, Any]:
    """What the status line shows: the last outcome, the active source's caught-up time and the most recent gap. Read only."""
    try:
        active = _active(conn)
        stored = conn.execute("SELECT COUNT(*) FROM wiskey_door_events").fetchone()[0]
    except Exception:  # noqa: BLE001 - before the migration ran
        active, stored = None, 0
    return {"enabled": enabled(), "last": last_outcome(conn), "caught_up_at": (active or {}).get("caught_up_at"),
            "source": ((active or {}).get("source") or "")[:8] or None, "stored": stored, "gap": recent_gap(conn)}
