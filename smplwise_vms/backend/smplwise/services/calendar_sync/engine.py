"""CALENDARS-298 section 12 - the sync engine. Provider-neutral: it talks to a `SyncAdapter` (adapter.py) and to the calendars tables.

Owner rules (round 6, contract C8/C9), all of them settings:
* an external calendar stays editable outside Arx and Arx adapts: every inbound create / edit / delete is ACCEPTED (`sync_accept_external`);
* when an inbound change collides with an Arx entry, BOTH are kept and flagged `sync_flag = 'conflict'`: nothing is reverted or deleted;
* an Arx entry deleted outside Arx is cancelled in Arx (`sync_external_delete = cancel`, the default) or kept and flagged (`flag`);
* loop prevention: an event we pushed comes back with the etag we stored; it is ignored (the marker `arx_id` rides along);
* at most one sync per connection at a time (a lease row in `settings`); polling only (no inbound webhook, no new public surface);
* errors back off exponentially up to 60 minutes; an invalid sync token (410) re-pulls the window from scratch;
* two entry points over the SAME steps (fetch pull -> apply pull -> plan push -> execute push -> apply push):
  `sync_connection(conn, ...)` runs the whole sync inside the caller's one write transaction (the in-memory fake, the contract tests);
  `run_connection(db, ...)` (CALCONNECT-2330: the manual "sync now" and the scheduler) never holds the database lock while an adapter
  waits for the provider - a short write takes the lease, the pulls run with no transaction open, one write applies them and plans
  the pushes, the pushes run with no transaction open, one write records their results, the state and frees the lease;
* no step here opens a network connection: that is the adapter's business.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import logging
import sqlite3
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from ...audit import audit
from .. import connection_store
from ..calendar import model, occ
from ..calendar.calendars import new_id
from ..calendar.events import _insert_event, _touch
from ..calendar.recurrence import LOCAL_FMT
from . import registry
from .adapter import DIRECTIONS, Binding, ConnectionInfo, ExtDeletion, ExtEvent, NeedsReauth, OutEvent, RateLimited, SyncAdapter, SyncError

log = logging.getLogger(__name__)

BUSY_TITLE = "תפוס"
UNTITLED = "(ללא כותרת)"
LEASE_MIN = 10
SOURCE_OF = {"ics_in": "ics", "ics_out": "ics", "google": "google", "microsoft": "microsoft"}
GONE_STATES = ("cancelled", "rejected", "withdrawn", "expired")


# ---------------------------------------------------------------- rows -> neutral values

def connection_info(row: sqlite3.Row) -> ConnectionInfo:
    return ConnectionInfo(row["id"], row["provider"], row["label"], row["scope"], row["token_ref"])


def open_ref(data_dir: Path, row: sqlite3.Row) -> str:
    return connection_store.open_calendar_sync(data_dir, row["id"], "ref", row["external_calendar_id_sealed"]) if row["external_calendar_id_sealed"] else ""


def binding_of(conn: sqlite3.Connection, data_dir: Path, row: sqlite3.Row) -> Binding:
    cal = conn.execute("SELECT name FROM cal_calendars WHERE id = ?", (row["calendar_id"],)).fetchone()
    return Binding(row["id"], row["calendar_id"], open_ref(data_dir, row), row["direction"], row["detail"], bool(row["dedicated"]), cal["name"] if cal else "")


def map_out(ev: sqlite3.Row, cal_name: str, detail: str) -> OutEvent:
    """The ONE mapper per detail level (12.2): busy -> a bare block; titles -> title + room; details -> + notes. Guests are never included."""
    start, end = model.parse_utc(ev["starts_at"], "s"), model.parse_utc(ev["ends_at"], "e")
    if detail == "busy":
        title, notes, loc = BUSY_TITLE, "", ""
    else:
        title, notes, loc = ev["title"], (ev["notes"] if detail == "details" else ""), cal_name
    return OutEvent(ev["id"], title, start, end, bool(ev["all_day"]), ev["tz"], notes, loc, ev["rrule"], tuple(json.loads(ev["exdates_json"] or "[]")))


# ---------------------------------------------------------------- lease, schedule, state

def _lease_key(cid: str) -> str:
    return f"calendar.sync.lease.{cid}"


def acquire_lease(conn: sqlite3.Connection, cid: str, now: dt.datetime) -> bool:
    """One sync per connection at a time: the row holds the lease expiry; an expired row is taken over."""
    cur = conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE settings.value < ?",
                       (_lease_key(cid), model.iso(now + dt.timedelta(minutes=LEASE_MIN)), model.iso(now)))
    return cur.rowcount == 1


def release_lease(conn: sqlite3.Connection, cid: str) -> None:
    conn.execute("DELETE FROM settings WHERE key = ?", (_lease_key(cid),))


def _jitter_min(cid: str, poll: int) -> float:
    return int(hashlib.sha1(cid.encode()).hexdigest()[:2], 16) / 255 * 0.2 * poll


def _failures(row: sqlite3.Row) -> int:
    t = row["error_text"] or ""
    return int(t.split("=", 1)[1]) if t.startswith("failures=") and t.split("=", 1)[1].isdigit() else 0


def _ok(conn: sqlite3.Connection, row: sqlite3.Row, settings: dict[str, Any], now: dt.datetime) -> None:
    nxt = now + dt.timedelta(minutes=settings["sync_poll_min"] + _jitter_min(row["id"], settings["sync_poll_min"]))
    conn.execute("UPDATE cal_connections SET state = 'ok', last_sync_at = ?, next_sync_at = ?, error_code = NULL, error_text = NULL WHERE id = ?",
                 (model.iso(now), model.iso(nxt), row["id"]))


def _failed(conn: sqlite3.Connection, row: sqlite3.Row, settings: dict[str, Any], now: dt.datetime, err: SyncError) -> dict[str, Any]:
    n = _failures(row) + 1
    if isinstance(err, NeedsReauth):
        conn.execute("UPDATE cal_connections SET state = 'needs_reauth', next_sync_at = NULL, error_code = ?, error_text = NULL WHERE id = ?", (err.code, row["id"]))
        return {"state": "needs_reauth", "code": err.code}
    wait = min(60.0, settings["sync_poll_min"] * (2 ** n))
    if isinstance(err, RateLimited) and err.retry_after_s:
        wait = max(wait, min(60.0, err.retry_after_s / 60))
    conn.execute("UPDATE cal_connections SET state = 'error', next_sync_at = ?, error_code = ?, error_text = ? WHERE id = ?",
                 (model.iso(now + dt.timedelta(minutes=wait)), err.code[:40], f"failures={n}", row["id"]))
    return {"state": "error", "code": err.code, "failures": n, "retry_in_min": wait}


# ---------------------------------------------------------------- entry points

def _new_report() -> dict[str, Any]:
    return {"pulled": 0, "created": 0, "updated": 0, "cancelled": 0, "flagged": 0, "echo": 0, "pushed": 0, "deleted_out": 0, "resync": 0, "bindings": 0}


def _preamble(conn: sqlite3.Connection, settings: dict[str, Any], cid: str, now: dt.datetime, adapter: SyncAdapter | None) -> tuple[sqlite3.Row | None, SyncAdapter | None, dict[str, Any] | None]:
    """(row, adapter, None) when the sync may run (the lease is taken), else (.., .., the skip answer)."""
    row = conn.execute("SELECT * FROM cal_connections WHERE id = ?", (cid,)).fetchone()
    if row is None:
        return None, None, {"skipped": "unknown_connection"}
    if row["state"] in ("paused", "revoked", "needs_reauth"):
        return row, None, {"skipped": row["state"]}
    if not settings["sync_enabled"]:
        return row, None, {"skipped": "sync_disabled"}
    ad = adapter or registry.get(row["provider"])
    if ad is None:
        conn.execute("UPDATE cal_connections SET state = 'error', error_code = 'adapter_unavailable', error_text = NULL, next_sync_at = ? WHERE id = ?",
                     (model.iso(now + dt.timedelta(minutes=60)), cid))
        return row, None, {"skipped": "adapter_unavailable"}
    if not acquire_lease(conn, cid, now):
        return row, ad, {"skipped": "busy"}
    return row, ad, None


def _fail_audit(conn: sqlite3.Connection, row: sqlite3.Row, settings: dict[str, Any], now: dt.datetime, err: SyncError) -> dict[str, Any]:
    out = _failed(conn, row, settings, now, err)
    audit(conn, actor=None, action="calendar.sync.error", decision="denied", resource_type="calendar_connection", resource_id=row["id"], reason=err.code)
    return out


def sync_connection(conn: sqlite3.Connection, data_dir: Path, settings: dict[str, Any], cid: str, now: dt.datetime, *, adapter: SyncAdapter | None = None) -> dict[str, Any]:
    """Runs one sync of every binding of one connection inside the caller's ONE write transaction (the in-memory fake, the contract tests).
    Never raises for a provider failure: the result and the connection state say what happened."""
    row, ad, skip = _preamble(conn, settings, cid, now, adapter)
    if skip is not None or row is None or ad is None:
        return skip or {"skipped": "unknown_connection"}
    rep = _new_report()
    try:
        info = connection_info(row)
        h = ad.health(info)
        if h.state == "needs_reauth":
            rep.update(_failed(conn, row, settings, now, NeedsReauth(code=h.code or "needs_reauth")))
            return rep
        for brow in conn.execute("SELECT * FROM cal_sync_bindings WHERE connection_id = ? ORDER BY id", (cid,)).fetchall():
            b = binding_of(conn, data_dir, brow)
            if _pulls(b, settings):
                res, full = _fetch_pull(ad, info, b, _token(data_dir, brow), rep)
                conn.execute("SAVEPOINT cal_pull")
                try:
                    _apply_pull(conn, data_dir, settings, row, b, res, full, now, rep)
                    conn.execute("RELEASE cal_pull")
                except BaseException:
                    conn.execute("ROLLBACK TO cal_pull")
                    conn.execute("RELEASE cal_pull")
                    raise
            if _pushes(b, info):
                for op in _plan_push(conn, b):
                    _apply_push(conn, b, op, _exec(ad, info, b, op), now, rep)
            rep["bindings"] += 1
        _ok(conn, row, settings, now)
        rep["state"] = "ok"
    except SyncError as err:
        rep.update(_fail_audit(conn, row, settings, now, err))
    finally:
        release_lease(conn, cid)
    return rep


def run_connection(db: Any, data_dir: Path, cid: str, now: dt.datetime, *, adapter: SyncAdapter | None = None) -> dict[str, Any]:
    """The same sync, with NO transaction open while the adapter talks to the provider (CALCONNECT-2330). Pulls of every binding are
    fetched first and applied together; a provider failure before the apply changes nothing (the tokens stay). Pushes are planned in the
    apply transaction, sent with no transaction open and recorded afterwards (a push that fails stops the rest; what went out is kept).
    An Arx entry edited while its push was in flight carries a newer revision than the one recorded, so the next run sends it again."""
    with db.connection(label="calendar.sync.begin") as conn:
        settings = model.read_settings(conn)
        row, ad, skip = _preamble(conn, settings, cid, now, adapter)
        if skip is not None or row is None or ad is None:
            return skip or {"skipped": "unknown_connection"}
        info = connection_info(row)
        bindings = [(binding_of(conn, data_dir, brow), _token(data_dir, brow))
                    for brow in conn.execute("SELECT * FROM cal_sync_bindings WHERE connection_id = ? ORDER BY id", (cid,)).fetchall()]
    rep = _new_report()
    try:
        try:
            h = ad.health(info)
            if h.state == "needs_reauth":
                with db.connection(label="calendar.sync.state") as conn:
                    rep.update(_failed(conn, row, settings, now, NeedsReauth(code=h.code or "needs_reauth")))
                return rep
            pulled = {b.id: _fetch_pull(ad, info, b, token, rep) for b, token in bindings if _pulls(b, settings)}
        except SyncError as err:
            with db.connection(label="calendar.sync.state") as conn:
                rep.update(_fail_audit(conn, row, settings, now, err))
            return rep
        plans: list[tuple[Binding, list[dict[str, Any]]]] = []
        with db.connection(label="calendar.sync.apply") as conn:
            for b, _token_ in bindings:
                if conn.execute("SELECT 1 FROM cal_sync_bindings WHERE id = ?", (b.id,)).fetchone() is None:
                    continue  # unbound while the pull was on its way
                if b.id in pulled:
                    _apply_pull(conn, data_dir, settings, row, b, *pulled[b.id], now, rep)
                if _pushes(b, info):
                    plans.append((b, _plan_push(conn, b)))
                rep["bindings"] += 1
        done: list[tuple[Binding, dict[str, Any], Any]] = []
        failure: SyncError | None = None
        for b, ops in plans:
            for op in ops:
                try:
                    done.append((b, op, _exec(ad, info, b, op)))
                except SyncError as err:
                    failure = err
                    break
            if failure is not None:
                break
        with db.connection(label="calendar.sync.finish") as conn:
            for b, op, res in done:
                if conn.execute("SELECT 1 FROM cal_sync_bindings WHERE id = ?", (b.id,)).fetchone() is not None:
                    _apply_push(conn, b, op, res, now, rep)
            if failure is not None:
                rep.update(_fail_audit(conn, row, settings, now, failure))
            else:
                _ok(conn, row, settings, now)
                rep["state"] = "ok"
        return rep
    finally:
        with db.connection(label="calendar.sync.lease") as conn:
            release_lease(conn, cid)


def _due(conn: sqlite3.Connection, now: dt.datetime) -> list[str]:
    return [r["id"] for r in conn.execute("SELECT id FROM cal_connections WHERE state IN ('ok','error') AND (next_sync_at IS NULL OR next_sync_at <= ?) "
                                          "AND EXISTS (SELECT 1 FROM cal_sync_bindings b WHERE b.connection_id = cal_connections.id) ORDER BY id", (model.iso(now),)).fetchall()]


def run_due(conn: sqlite3.Connection, data_dir: Path, settings: dict[str, Any], now: dt.datetime) -> dict[str, Any]:
    """The scheduler step inside one transaction (kept for the contract tests): every connection whose time has come and that has at least one binding."""
    out: dict[str, Any] = {}
    if not settings["enabled"] or not settings["sync_enabled"]:
        return out
    for cid in _due(conn, now):
        try:
            out[cid] = sync_connection(conn, data_dir, settings, cid, now)
        except Exception:  # noqa: BLE001 - one connection never stops the others
            log.warning("calendar sync failed for %s", cid, exc_info=True)
    return out


def run_due_db(db: Any, data_dir: Path, now: dt.datetime) -> dict[str, Any]:
    """The scheduler step of the sync tick: the due list from a read, then each connection through run_connection (no lock over the network)."""
    with db.connection(mode="read", label="calendar.sync.due") as conn:
        settings = model.read_settings(conn)
        if not settings["enabled"] or not settings["sync_enabled"]:
            return {}
        due = _due(conn, now)
    out: dict[str, Any] = {}
    for cid in due:
        try:
            out[cid] = run_connection(db, data_dir, cid, now)
        except Exception:  # noqa: BLE001 - one connection never stops the others
            log.warning("calendar sync failed for %s", cid, exc_info=True)
    return out


# ---------------------------------------------------------------- one binding

def _pulls(b: Binding, settings: dict[str, Any]) -> bool:
    return b.direction in ("import", "two_way") and bool(settings["sync_accept_external"])


def _pushes(b: Binding, info: ConnectionInfo) -> bool:
    return b.direction in ("export", "two_way") and info.scope == "read_write"


def _token(data_dir: Path, brow: sqlite3.Row) -> str | None:
    return connection_store.open_calendar_sync(data_dir, brow["id"], "token", brow["sync_token_sealed"]) if brow["sync_token_sealed"] else None


def _fetch_pull(ad: SyncAdapter, info: ConnectionInfo, b: Binding, token: str | None, rep: dict[str, Any]) -> tuple[Any, bool]:
    """The network half of a pull: (PullResult, full listing?)."""
    res = ad.pull(info, b, token)
    if res.full_resync_required:  # 410: the window is read again from scratch
        rep["resync"] += 1
        token = None
        res = ad.pull(info, b, None)
        if res.full_resync_required:
            raise SyncError("the provider keeps refusing a full pull", code="resync_failed")
    return res, token is None


def _apply_pull(conn: sqlite3.Connection, data_dir: Path, settings: dict[str, Any], crow: sqlite3.Row, b: Binding, res: Any, full: bool,
                now: dt.datetime, rep: dict[str, Any]) -> None:
    seen: set[str] = set()
    cal = conn.execute("SELECT * FROM cal_calendars WHERE id = ?", (b.calendar_id,)).fetchone()
    for ch in res.changes:
        rep["pulled"] += 1
        if isinstance(ch, ExtDeletion) or ch.status == "cancelled":
            _external_delete(conn, settings, crow, b, ch.ext_uid, now, rep)
            continue
        seen.add(ch.ext_uid)
        _external_upsert(conn, settings, crow, cal, b, ch, now, rep)
    if full:  # a full listing carries no deletions: whatever we mapped and the provider no longer lists is gone
        for m in conn.execute("SELECT ext_uid FROM cal_sync_map WHERE binding_id = ?", (b.id,)).fetchall():
            if m["ext_uid"] not in seen:
                _external_delete(conn, settings, crow, b, m["ext_uid"], now, rep)
    refresh_flags(conn, settings, b.calendar_id, now)
    sealed = connection_store.seal_calendar_sync(data_dir, b.id, "token", res.next_token) if res.next_token else None
    conn.execute("UPDATE cal_sync_bindings SET sync_token_sealed = ? WHERE id = ?", (sealed, b.id))


def _filtered(ev: ExtEvent, detail: str) -> tuple[str, str]:
    """How much of an inbound event is stored: busy -> a bare block; titles -> title; details -> title and notes."""
    if detail == "busy":
        return BUSY_TITLE, ""
    title = "".join(c for c in (ev.title or "") if ord(c) >= 32).strip()[:120] or UNTITLED
    notes = "".join(c for c in (ev.notes or "") if ord(c) >= 32 or c in "\n\t")[:2000] if detail == "details" else ""
    return title, notes


def _local(utc: dt.datetime, tz: str) -> str:
    return utc.astimezone(ZoneInfo(tz)).strftime(LOCAL_FMT)


def _external_upsert(conn: sqlite3.Connection, settings: dict[str, Any], crow: sqlite3.Row, cal: sqlite3.Row, b: Binding, ev: ExtEvent, now: dt.datetime, rep: dict[str, Any]) -> None:
    stamp = model.iso(now)
    m = conn.execute("SELECT * FROM cal_sync_map WHERE binding_id = ? AND ext_uid = ?", (b.id, ev.ext_uid)).fetchone()
    if m is None and ev.arx_id:  # our marker without a map row (binding recreated): re-link instead of duplicating
        own = conn.execute("SELECT id, revision FROM cal_events WHERE id = ? AND calendar_id = ?", (ev.arx_id, b.calendar_id)).fetchone()
        if own is not None:
            conn.execute("INSERT OR REPLACE INTO cal_sync_map(event_id, binding_id, ext_uid, ext_etag, last_pushed_revision, last_pulled_at, origin) VALUES (?,?,?,?,?,?, 'arx')",
                         (own["id"], b.id, ev.ext_uid, ev.etag, own["revision"], stamp))
            rep["echo"] += 1
            return
    if ev.end <= ev.start:
        return
    if m is not None and m["ext_etag"] == ev.etag:
        rep["echo"] += 1  # loop prevention: this is the state we already know (our own push, or an unchanged event)
        return
    row = conn.execute("SELECT * FROM cal_events WHERE id = ?", (m["event_id"],)).fetchone() if m is not None else None
    if m is not None and row is None:  # the Arx side is gone: forget the link, treat the event as new
        conn.execute("DELETE FROM cal_sync_map WHERE binding_id = ? AND ext_uid = ?", (b.id, ev.ext_uid))
        m = None
    tz = ev.tz or cal["tz"]
    title, notes = _filtered(ev, b.detail)
    if m is None:
        eid = new_id("evt")
        owner = crow["owner_user_id"]
        _insert_event(conn, {
            "id": eid, "calendar_id": b.calendar_id, "kind": "external", "title": title, "notes": notes, "starts_at": model.iso(ev.start), "ends_at": model.iso(ev.end),
            "all_day": int(ev.all_day), "tz": tz, "local_start": _local(ev.start, tz), "local_end": _local(ev.end, tz), "rrule": None, "series_until": model.iso(ev.end),
            "exdates_json": "[]", "holiday_skip": 0, "state": "confirmed", "contested": 0, "organizer_user_id": owner, "on_behalf_kind": "self", "on_behalf_label": "מיומן חיצוני",
            "equipment_req_json": "[]", "source": SOURCE_OF.get(crow["provider"], "arx"), "source_ref": ev.ext_uid, "automation_hold": 0,
            "created_by": owner, "created_at": stamp, "updated_by": owner, "updated_at": stamp,
        })
        conn.execute("INSERT INTO cal_sync_map(event_id, binding_id, ext_uid, ext_etag, last_pushed_revision, last_pulled_at, origin) VALUES (?,?,?,?,1,?, 'external')",
                     (eid, b.id, ev.ext_uid, ev.etag, stamp))
        rep["created"] += 1
        occ.rebuild(conn, eid, settings, now)
        _flag_collisions(conn, settings, cal, eid, now, rep)
        return
    # a mapped event changed outside Arx
    if row["state"] in GONE_STATES and m["origin"] == "external" and b.direction != "two_way":
        return  # an imported entry cancelled in Arx stays cancelled
    if row["rrule"] or row["override_of"]:
        return  # series edits from outside are a later refinement (the note in contract 12.4)
    cols: dict[str, Any] = {"starts_at": model.iso(ev.start), "ends_at": model.iso(ev.end), "all_day": int(ev.all_day), "local_start": _local(ev.start, row["tz"]),
                            "local_end": _local(ev.end, row["tz"]), "series_until": model.iso(ev.end)}
    if m["origin"] == "external":
        cols.update(title=title, notes=notes)
    elif b.detail == "details":  # an Arx entry published with its details: the provider's wording is accepted too
        cols.update(title=title, notes=notes)
    if row["state"] in GONE_STATES:
        cols["state"] = "confirmed"  # the provider shows it again: accepted
    _touch(conn, row["id"], crow["owner_user_id"], stamp, **cols)
    rev = conn.execute("SELECT revision FROM cal_events WHERE id = ?", (row["id"],)).fetchone()[0]
    conn.execute("UPDATE cal_sync_map SET ext_etag = ?, last_pushed_revision = ?, last_pulled_at = ? WHERE binding_id = ? AND ext_uid = ?", (ev.etag, rev, stamp, b.id, ev.ext_uid))
    if row["sync_flag"] == "deleted_external":
        conn.execute("UPDATE cal_events SET sync_flag = NULL WHERE id = ?", (row["id"],))
    rep["updated"] += 1
    occ.rebuild(conn, row["id"], settings, now)
    _flag_collisions(conn, settings, cal, row["id"], now, rep)


def _external_delete(conn: sqlite3.Connection, settings: dict[str, Any], crow: sqlite3.Row, b: Binding, ext_uid: str, now: dt.datetime, rep: dict[str, Any]) -> None:
    m = conn.execute("SELECT * FROM cal_sync_map WHERE binding_id = ? AND ext_uid = ?", (b.id, ext_uid)).fetchone()
    if m is None:
        return
    row = conn.execute("SELECT * FROM cal_events WHERE id = ?", (m["event_id"],)).fetchone()
    stamp = model.iso(now)
    if row is None or row["state"] in GONE_STATES:
        conn.execute("DELETE FROM cal_sync_map WHERE binding_id = ? AND ext_uid = ?", (b.id, ext_uid))
        return
    if m["origin"] == "arx" and settings["sync_external_delete"] == "flag":
        conn.execute("UPDATE cal_events SET sync_flag = 'deleted_external' WHERE id = ?", (row["id"],))
        conn.execute("UPDATE cal_sync_map SET ext_etag = NULL WHERE binding_id = ? AND ext_uid = ?", (b.id, ext_uid))
        rep["flagged"] += 1
        audit(conn, actor=None, action="calendar.sync.flag", decision="allowed", resource_type="calendar_event", resource_id=row["id"], details={"flag": "deleted_external"})
        return
    _touch(conn, row["id"], crow["owner_user_id"], stamp, state="cancelled")
    conn.execute("UPDATE cal_event_rooms SET state = 'cancelled' WHERE event_id = ? AND state IN ('pending','confirmed')", (row["id"],))
    for (oid,) in conn.execute("SELECT id FROM cal_events WHERE override_of = ? AND state IN ('pending','confirmed','displaced')", (row["id"],)).fetchall():
        _touch(conn, oid, crow["owner_user_id"], stamp, state="cancelled")
        occ.rebuild(conn, oid, settings, now)
    occ.rebuild(conn, row["id"], settings, now)
    conn.execute("DELETE FROM cal_sync_map WHERE binding_id = ? AND ext_uid = ?", (b.id, ext_uid))
    rep["cancelled"] += 1
    audit(conn, actor=None, action="calendar.sync.cancel", decision="allowed", resource_type="calendar_event", resource_id=row["id"], details={"origin": m["origin"]})


# ---------------------------------------------------------------- collisions (C9: keep BOTH and flag)

def _collisions(conn: sqlite3.Connection, settings: dict[str, Any], cal: sqlite3.Row, eid: str, now: dt.datetime) -> list[dict[str, Any]]:
    row = conn.execute("SELECT * FROM cal_events WHERE id = ?", (eid,)).fetchone()
    if row is None or row["state"] != "confirmed":
        return []
    spans = [(o.start_utc, o.end_utc) for o in occ.event_occurrences(conn, row, settings, now)]
    return occ.blockers(conn, cal, spans, settings, exclude=occ.family(conn, eid), states=("confirmed",))


def _flag_collisions(conn: sqlite3.Connection, settings: dict[str, Any], cal: sqlite3.Row, eid: str, now: dt.datetime, rep: dict[str, Any]) -> None:
    found = _collisions(conn, settings, cal, eid, now)
    if not found:
        return
    ids = {eid} | {c["event_id"] for c in found}
    for i in ids:
        conn.execute("UPDATE cal_events SET sync_flag = 'conflict' WHERE id = ?", (i,))
    rep["flagged"] += len(ids)
    audit(conn, actor=None, action="calendar.sync.flag", decision="allowed", resource_type="calendar_event", resource_id=eid, details={"flag": "conflict", "with": len(ids) - 1})


def refresh_flags(conn: sqlite3.Connection, settings: dict[str, Any], calendar_id: str, now: dt.datetime) -> int:
    """Clears `conflict` flags that no longer have a collision behind them (an edit moved one side away). Returns the number cleared."""
    cal = conn.execute("SELECT * FROM cal_calendars WHERE id = ?", (calendar_id,)).fetchone()
    cleared = 0
    for r in conn.execute("SELECT id FROM cal_events WHERE calendar_id = ? AND sync_flag = 'conflict'", (calendar_id,)).fetchall():
        if not _collisions(conn, settings, cal, r["id"], now):
            conn.execute("UPDATE cal_events SET sync_flag = NULL WHERE id = ?", (r["id"],))
            cleared += 1
    return cleared


# ---------------------------------------------------------------- push

def _plan_push(conn: sqlite3.Connection, b: Binding) -> list[dict[str, Any]]:
    """What has to go out for one binding: `push` (an Arx entry new or changed since its last push) and `delete` (an entry gone in Arx)."""
    ops: list[dict[str, Any]] = []
    for ev in conn.execute("SELECT * FROM cal_events WHERE calendar_id = ? AND override_of IS NULL ORDER BY id", (b.calendar_id,)).fetchall():
        m = conn.execute("SELECT * FROM cal_sync_map WHERE binding_id = ? AND event_id = ?", (b.id, ev["id"])).fetchone()
        origin = m["origin"] if m is not None else ("external" if ev["kind"] == "external" else "arx")
        live = ev["state"] == "confirmed" and ev["sync_flag"] != "deleted_external"
        if live and origin == "arx":
            if m is None or m["last_pushed_revision"] != ev["revision"]:
                ops.append({"op": "push", "event_id": ev["id"], "revision": ev["revision"], "out": map_out(ev, b.calendar_name, b.detail),
                            "ext_uid": m["ext_uid"] if m is not None else None, "etag": m["ext_etag"] if m is not None else None})
        elif m is not None and ev["state"] in (*GONE_STATES, "displaced") and m["ext_etag"] is not None and (origin == "arx" or b.direction == "two_way"):
            ops.append({"op": "delete", "event_id": ev["id"], "ext_uid": m["ext_uid"], "etag": m["ext_etag"]})
    return ops


def _exec(ad: SyncAdapter, info: ConnectionInfo, b: Binding, op: dict[str, Any]) -> Any:
    if op["op"] == "push":
        return ad.push(info, b, op["out"], op["ext_uid"], op["etag"])
    ad.delete(info, b, op["ext_uid"], op["etag"])
    return None


def _apply_push(conn: sqlite3.Connection, b: Binding, op: dict[str, Any], res: Any, now: dt.datetime, rep: dict[str, Any]) -> None:
    if op["op"] == "push":
        if conn.execute("SELECT 1 FROM cal_events WHERE id = ?", (op["event_id"],)).fetchone() is None:
            return
        conn.execute("INSERT INTO cal_sync_map(event_id, binding_id, ext_uid, ext_etag, last_pushed_revision, last_pulled_at, origin) VALUES (?,?,?,?,?,?, 'arx') "
                     "ON CONFLICT(event_id, binding_id) DO UPDATE SET ext_uid = excluded.ext_uid, ext_etag = excluded.ext_etag, last_pushed_revision = excluded.last_pushed_revision",
                     (op["event_id"], b.id, res.ext_uid, res.etag, op["revision"], model.iso(now)))
        rep["pushed"] += 1
    else:
        conn.execute("DELETE FROM cal_sync_map WHERE binding_id = ? AND ext_uid = ?", (b.id, op["ext_uid"]))
        rep["deleted_out"] += 1


# ---------------------------------------------------------------- a human decision on a flagged entry

def resolve_flag(conn: sqlite3.Connection, settings: dict[str, Any], row: sqlite3.Row, resolution: str, actor: str, now: dt.datetime) -> None:
    """`keep`: the flag is cleared and both entries stay (an Arx entry deleted outside is re-published on the next sync).
    `cancel`: the entry is cancelled in Arx (and removed at the provider on the next sync)."""
    stamp = model.iso(now)
    if resolution == "cancel":
        _touch(conn, row["id"], actor, stamp, state="cancelled", sync_flag=None)
        conn.execute("UPDATE cal_event_rooms SET state = 'cancelled' WHERE event_id = ? AND state IN ('pending','confirmed')", (row["id"],))
        occ.rebuild(conn, row["id"], settings, now)
    else:
        conn.execute("UPDATE cal_events SET sync_flag = NULL WHERE id = ?", (row["id"],))
        if row["sync_flag"] == "deleted_external":
            conn.execute("DELETE FROM cal_sync_map WHERE event_id = ? AND origin = 'arx'", (row["id"],))
    refresh_flags(conn, settings, row["calendar_id"], now)


def validate_binding(provider: str, direction: str, detail: str, dedicated: bool, scope: str) -> None:
    """Binding rules of 12.1: the provider's capabilities, two_way only on a dedicated calendar, writing only over a read_write connection."""
    if direction not in ("export", "import", "two_way"):
        raise model.Invalid("direction: export, import or two_way", "direction")
    if direction not in DIRECTIONS.get(provider, ()):
        raise model.Invalid(f"direction {direction} is not available for {provider}", "direction", "direction_unsupported")
    if detail not in ("busy", "titles", "details"):
        raise model.Invalid("detail: busy, titles or details", "detail")
    if direction == "two_way" and not dedicated:
        raise model.Invalid("two_way needs a dedicated calendar (never a personal one)", "dedicated", "two_way_requires_dedicated")
    if direction in ("export", "two_way") and scope != "read_write":
        raise model.Invalid("exporting needs a read_write connection", "direction", "connection_read_only")


__all__ = ["sync_connection", "run_connection", "run_due", "run_due_db", "resolve_flag", "refresh_flags", "validate_binding", "map_out", "binding_of", "connection_info", "open_ref"]
