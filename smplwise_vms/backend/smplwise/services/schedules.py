"""CR-014 (schedules): the mirror of the scheduler component's definitions and Arx's own storage around it
(docs/architecture/SCHEDULER_API.md §6, §7, §9.7).

The component (HA storage) is the authority for definitions. This module keeps a READ cache of its items
(`schedule_cache`), Arx-only data (owner of record, folders, order, pins: `schedule_meta`, `schedule_folders`), the
30-day trash, the derived runs and the write operations (`schedule_ops`, idempotency). Nothing here writes to Home
Assistant: the write path is `schedule_ops.py` through the bridge; reads are the component's WebSocket commands
`scheduler` / `scheduler/item` over the add-on's existing HA session.

Three refresh layers (§6.2): the `scheduler_updated` subscription (frame shape unverified, P0-2), the schedule
switches' `state_changed` (`MIRROR.on_entity_state`, called from `ha_sync.handle_state_event`), and a pull at every
session start and every registry refresh (10 minutes). Every cache change publishes `{"type": "schedules_changed"}`
(no ids) through `ha_sync.publish`.

Seams (§9.7): `SchedulerTransport` (`ws`, `bridge`) - production `HaTransport`, tests `set_transport(FakeTransport)`;
component events through `MIRROR.on_component_event(frame)`; entity states through `ha_sync` (`handle_state_event`)."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import logging
import sqlite3
import threading
import uuid
from contextlib import contextmanager, nullcontext
from typing import Any, Callable, Iterator, Protocol

from ..audit import audit
from ..db import Database, get_setting, set_setting, unlocked
from ..errors import ApiError
from . import ha_bridge, ha_client, ha_sync
from . import schedule_model as model
from .timeutil import iso_utc, parse_utc

log = logging.getLogger("smplwise.schedules")

TRASH_DAYS = 30
COMPONENT_MISSING_CONFIRM_S = 300  # two `unknown_command` answers at least this far apart before the cache is hidden (§6.3)
FETCH_DEBOUNCE_S = 1.0
ENSURE_RETRY_S = 30.0
RUN_SETTLE_S = 20.0  # a run is settled this long after its switch entered `triggered` (§6.6)
STALE_AFTER_S = 25 * 60  # a mirror not refreshed for this long is stale even while the socket is up (the periodic pull is 10 minutes)
OP_KEEP_DAYS = 30
BRIDGE_REQUIRED = "0.3.0"
STATE_KEY = "schedules.mirror"


# ---------------------------------------------------------------- transport (§9.7)

class SchedulerTransport(Protocol):
    def ws(self, msg_type: str, **kw: Any) -> dict[str, Any]:
        """One read-only WebSocket command; HA's reply (`{"success": bool, "result" | "error": ...}`). ApiError when HA is
        unreachable."""

    def bridge(self, payload: dict[str, Any]) -> dict[str, Any]:
        """The signed `smplwise_bridge.schedule` call; the service response. ApiError on a transport failure (504
        `scheduler_timeout` for a call that may have been applied)."""

    def connected(self) -> bool: ...

    def configured(self) -> bool: ...


class HaTransport:
    """Production transport: the live HA session (`ha_sync.SYNC.ws_call`) and the bridge service over REST."""

    def ws(self, msg_type: str, **kw: Any) -> dict[str, Any]:
        return ha_sync.SYNC.ws_call(msg_type, **kw)

    def bridge(self, payload: dict[str, Any]) -> dict[str, Any]:
        settings = MIRROR.settings or ha_sync.SYNC.settings
        if settings is None:
            raise ApiError(503, "ha_not_configured", "אין גישה לתשתית המערכת.")
        return ha_client.call_bridge_schedule(settings, payload)

    def connected(self) -> bool:
        return bool(ha_sync.STATE.connected)

    def configured(self) -> bool:
        settings = MIRROR.settings or ha_sync.SYNC.settings
        return bool(settings is not None and ha_client.configured(settings))


_TRANSPORT: SchedulerTransport = HaTransport()


def set_transport(transport: SchedulerTransport | None) -> None:
    """Tests: replace the transport (None restores the production one)."""
    global _TRANSPORT
    _TRANSPORT = transport if transport is not None else HaTransport()


def get_transport() -> SchedulerTransport:
    return _TRANSPORT


# ---------------------------------------------------------------- helpers

def _iso(value: dt.datetime) -> str:
    return iso_utc(value)


def is_json_error(reply: Any) -> tuple[bool, str | None]:
    """(success, error code) of a WebSocket reply."""
    if not isinstance(reply, dict):
        return False, "bad_reply"
    if reply.get("success"):
        return True, None
    err = reply.get("error")
    return False, (err.get("code") if isinstance(err, dict) else None) or "error"


def cache_rows(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM schedule_cache ORDER BY schedule_id").fetchall()


def cache_row(conn: sqlite3.Connection, schedule_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM schedule_cache WHERE schedule_id = ?", (schedule_id,)).fetchone()


def item_of(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    try:
        item = json.loads(row["item_json"])
    except (ValueError, TypeError):
        item = {}
    return item if isinstance(item, dict) else {}


def meta_rows(conn: sqlite3.Connection) -> dict[str, sqlite3.Row]:
    return {r["schedule_id"]: r for r in conn.execute("SELECT * FROM schedule_meta").fetchall()}


def feature_on(conn: sqlite3.Connection) -> bool:
    return (get_setting(conn, "schedules.enabled", "false") or "false") == "true"


# ---------------------------------------------------------------- the mirror

class Mirror:
    """The read cache and its refresh layers. One process-wide instance (`MIRROR`); it holds no per-request state - the
    database is the state, so a second process or a restart sees the same cache. `debounce_s == 0` (tests) runs every
    deferred fetch synchronously at `flush()`."""

    def __init__(self) -> None:
        self.db: Database | None = None
        self.settings: Any = None
        self.debounce_s: float = FETCH_DEBOUNCE_S
        self.clock: Callable[[], dt.datetime] = lambda: dt.datetime.now(dt.timezone.utc)
        self._lock = threading.Lock()
        self._pending: set[str] = set()
        self._timer: threading.Timer | None = None
        self._followups: list[dict[str, Any]] = []  # what an ADOPTED op still owes (disable it, finish the split), done after the commit

    # -- wiring

    def bind(self, db: Database, settings: Any = None) -> None:
        self.db = db
        if settings is not None:
            self.settings = settings

    def reset(self) -> None:
        """Tests: forget deferred work and rewire nothing else."""
        with self._lock:
            self._pending.clear()
            self._followups = []
            if self._timer is not None:
                self._timer.cancel()
            self._timer = None

    def now(self) -> dt.datetime:
        return self.clock()

    def feature_on(self, handle: Any) -> bool:
        """Whether the feature is switched on; `handle` is a Database or an open connection."""
        if isinstance(handle, sqlite3.Connection):
            return feature_on(handle)
        with handle.connection(mode="read") as conn:
            return feature_on(conn)

    def feature_switched_on(self) -> None:
        """Settings: the feature was just enabled - listen to the component now (the live session does it in the
        background; a fresh cache is pulled by the first request otherwise)."""
        try:
            ha_sync.SYNC.schedules_switched_on()
        except Exception:  # noqa: BLE001
            log.exception("could not start the schedules subscription")

    @contextmanager
    def _use(self, conn: sqlite3.Connection | None) -> Iterator[sqlite3.Connection]:
        if conn is not None:
            yield conn
            return
        if self.db is None:
            raise RuntimeError("schedules mirror is not bound to a database")
        with self.db.connection(label="schedules mirror") as c:
            yield c

    # -- persisted mirror state (settings key `schedules.mirror`)

    def state(self, conn: sqlite3.Connection) -> dict[str, Any]:
        try:
            st = json.loads(get_setting(conn, STATE_KEY, "{}") or "{}")
        except ValueError:
            st = {}
        st = st if isinstance(st, dict) else {}
        st.setdefault("last_sync_at", None)
        st.setdefault("missing_first_at", None)
        st.setdefault("missing_confirmed", False)
        st.setdefault("last_error", None)
        st.setdefault("component_version", None)
        return st

    def _save(self, conn: sqlite3.Connection, st: dict[str, Any]) -> None:
        set_setting(conn, STATE_KEY, json.dumps(st, ensure_ascii=False, separators=(",", ":")))

    # -- pulls

    def ensure(self, conn: sqlite3.Connection) -> None:
        """A request found the mirror never synced (a fresh start, or the feature was just switched on): pull now, at most
        once per RETRY_S. Reads never wait for the periodic pull to have something to show."""
        if not feature_on(conn) or not get_transport().connected():
            return
        st = self.state(conn)
        if st.get("last_sync_at") is not None:
            return
        last = _parse(st.get("last_attempt_at"))
        if last is not None and (self.now() - last).total_seconds() < ENSURE_RETRY_S:
            return
        self.pull(conn, "first")

    def pull(self, conn: sqlite3.Connection | None = None, reason: str = "") -> dict[str, Any]:
        """Full pull of every item (`scheduler`), then the cache is made equal to it. Failures keep the cache and are
        recorded (§6.3). `conn` given = a request's connection (its write lock is released around the HA call)."""
        handle = conn if conn is not None else self.db
        if handle is None or not self.feature_on(handle):
            return {"skipped": "feature_disabled"}
        tr = get_transport()
        try:
            with self._use(conn) as c:
                st = self.state(c)
                st["last_attempt_at"] = _iso(self.now())
                self._save(c, st)
        except sqlite3.Error:
            log.debug("could not record the schedules pull attempt", exc_info=True)
        try:
            with (unlocked(conn) if conn is not None and not _read_only(conn) else nullcontext()):
                reply = tr.ws("scheduler")
        except ApiError as exc:
            self._record_error(conn, exc.code)
            return {"error": exc.code}
        ok, code = is_json_error(reply)
        if not ok:
            if code == "unknown_command":
                self._record_missing(conn)
            else:
                self._record_error(conn, code or "error")
            return {"error": code}
        items = [i for i in (reply.get("result") or []) if isinstance(i, dict) and isinstance(i.get("schedule_id"), str) and i.get("schedule_id")]
        version = self._component_version(tr)
        with self._use(conn) as c:
            changed = self.apply_items(c, items, full=True)
            st = self.state(c)
            st.update(last_sync_at=_iso(self.now()), missing_first_at=None, missing_confirmed=False, last_error=None)
            if version:
                st["component_version"] = version
            self._save(c, st)
        if changed:
            ha_sync.publish({"type": "schedules_changed"})
        self.run_followups(conn)
        return {"items": len(items), "changed": changed}

    def _component_version(self, tr: SchedulerTransport) -> str | None:
        try:
            reply = tr.ws("manifest/get", integration="scheduler")
        except ApiError:
            return None
        ok, _ = is_json_error(reply)
        result = reply.get("result") if ok else None
        return str(result.get("version")) if isinstance(result, dict) and result.get("version") else None

    def _record_missing(self, conn: sqlite3.Connection | None) -> None:
        with self._use(conn) as c:
            st = self.state(c)
            now = self.now()
            first = _parse(st.get("missing_first_at"))
            if first is None:
                st["missing_first_at"] = _iso(now)
            elif (now - first).total_seconds() >= COMPONENT_MISSING_CONFIRM_S:
                st["missing_confirmed"] = True
            st["last_error"] = "unknown_command"
            self._save(c, st)

    def _record_error(self, conn: sqlite3.Connection | None, code: str) -> None:
        try:
            with self._use(conn) as c:
                st = self.state(c)
                st["last_error"] = code
                self._save(c, st)
        except Exception:  # noqa: BLE001 - recording a failure must never raise over it
            log.debug("could not record the schedules mirror error", exc_info=True)

    def fetch_item(self, schedule_id: str, conn: sqlite3.Connection | None = None) -> dict[str, Any] | None:
        """One fresh `scheduler/item`: the cache row is updated and the item returned; None (and the cache row dropped)
        when the component no longer knows it. Transport errors propagate as ApiError."""
        tr = get_transport()
        with (unlocked(conn) if conn is not None and not _read_only(conn) else nullcontext()):
            reply = tr.ws("scheduler/item", schedule_id=schedule_id)
        ok, code = is_json_error(reply)
        gone = (not ok and code in ("not_found", "invalid_format")) or (ok and reply.get("result") is None)  # verified: an unknown id answers success:true, result:null
        if gone:
            with self._use(conn) as c:
                if self.drop(c, schedule_id):
                    ha_sync.publish({"type": "schedules_changed"})
            return None
        if not ok:
            raise ApiError(503, "scheduler_unavailable", "התזמונים אינם זמינים כרגע.", retryable=True, details={"error": code})
        item = reply.get("result")
        item = model.mask_codes(item) if isinstance(item, dict) else item
        if not isinstance(item, dict) or item.get("schedule_id") != schedule_id:
            raise ApiError(503, "scheduler_unavailable", "התזמונים אינם זמינים כרגע.", retryable=True, details={"error": "bad_item"})
        with self._use(conn) as c:
            changed = self.apply_items(c, [item], full=False)
        if changed:
            ha_sync.publish({"type": "schedules_changed"})
        self.run_followups(conn)
        return item

    # -- cache

    def apply_items(self, conn: sqlite3.Connection, items: list[dict[str, Any]], *, full: bool) -> bool:
        """Write items into the cache (and `schedule_meta`); with `full` also drop what is no longer there. Returns
        whether anything changed. Audits `schedule.changed_outside` for a sensitive schedule changed or created without
        an Arx op (§4.6) - except in the very first pull (the baseline)."""
        now = _iso(self.now())
        st = self.state(conn)
        baseline = st.get("last_sync_at") is None and full
        changed = False
        existing = {r["schedule_id"]: r for r in conn.execute("SELECT * FROM schedule_cache").fetchall()}
        meta = meta_rows(conn)
        seen: set[str] = set()
        for raw_item in items:
            item = model.mask_codes(raw_item)  # a code typed in Home Assistant never reaches Arx's database
            sid = item["schedule_id"]
            seen.add(sid)
            rev = model.revision(item)
            enabled = 1 if item.get("enabled", True) else 0
            eid = item.get("entity_id") if isinstance(item.get("entity_id"), str) else None
            blob = json.dumps(item, ensure_ascii=False, sort_keys=True)
            row = existing.get(sid)
            if row is None:
                conn.execute("INSERT INTO schedule_cache(schedule_id, entity_id, revision, item_json, enabled, seen_at, changed_at) VALUES (?,?,?,?,?,?,?)", (sid, eid, rev, blob, enabled, now, now))
                changed = True
                if sid not in meta:
                    self._new_meta(conn, sid, now)
                    self._maybe_adopt(conn, sid, item, now)
                    if not baseline and not self._arx_create_in_flight(conn):
                        self._audit_outside(conn, sid, item, "created")
                else:
                    conn.execute("UPDATE schedule_meta SET last_seen_at = ?, gone_at = NULL WHERE schedule_id = ?", (now, sid))
            else:
                if row["revision"] != rev or row["enabled"] != enabled or row["entity_id"] != eid or row["item_json"] != blob:
                    conn.execute("UPDATE schedule_cache SET entity_id = ?, revision = ?, item_json = ?, enabled = ?, seen_at = ?, changed_at = ? WHERE schedule_id = ?", (eid, rev, blob, enabled, now, now, sid))
                    changed = True
                    if row["revision"] != rev and not self._recent_arx_op(conn, sid):
                        self._audit_outside(conn, sid, item, "updated")
                else:
                    conn.execute("UPDATE schedule_cache SET seen_at = ? WHERE schedule_id = ?", (now, sid))
                conn.execute("UPDATE schedule_meta SET last_seen_at = ?, gone_at = NULL WHERE schedule_id = ?", (now, sid))
        if full:
            for sid in list(existing):
                if sid not in seen:
                    changed = self.drop(conn, sid, now) or changed
        return changed

    def drop(self, conn: sqlite3.Connection, schedule_id: str, now: str | None = None) -> bool:
        """The component no longer has this schedule: out of the cache, `gone_at` on its meta (the meta and the trash are
        never deleted by absence)."""
        now = now or _iso(self.now())
        cur = conn.execute("DELETE FROM schedule_cache WHERE schedule_id = ?", (schedule_id,))
        conn.execute("UPDATE schedule_meta SET gone_at = COALESCE(gone_at, ?) WHERE schedule_id = ?", (now, schedule_id))
        return cur.rowcount > 0

    def _new_meta(self, conn: sqlite3.Connection, sid: str, now: str) -> None:
        conn.execute("INSERT OR IGNORE INTO schedule_meta(schedule_id, created_via, first_seen_at, last_seen_at) VALUES (?, 'external', ?, ?)", (sid, now, now))

    def _maybe_adopt(self, conn: sqlite3.Connection, sid: str, item: dict[str, Any], now: str) -> None:
        """A create / copy / split / restore the bridge could not name (`id_unknown`, or a timeout, §3.6): the ONE new
        schedule whose name AND content fingerprint (days, slots, conditions) equal what that op sent, appearing within the
        hour, is that one - the op is settled, the schedule becomes Arx's and the adoption is audited. What the op still owes
        is queued (review R1): a schedule requested DISABLED is disabled now, a split completes by taking the moved days off
        the original. Never re-sent, never guessed from a name alone (review M2)."""
        name = item.get("name") or ""
        fp = model.fingerprint(item)
        cutoff = _iso(self.now() - dt.timedelta(hours=1))
        candidates = [r for r in conn.execute("SELECT * FROM schedule_ops WHERE status = 'unknown' AND op IN ('create', 'copy', 'restore', 'split') AND (schedule_id IS NULL OR op = 'split') AND requested_at >= ?", (cutoff,)).fetchall()
                      if _op_name(r) == name and _op_field(r, "fp") == fp]
        if len(candidates) != 1:
            return
        op = candidates[0]
        try:
            meta_json = json.loads(op["error"] or "{}") or {}
        except ValueError:
            meta_json = {}
        if op["op"] == "split":
            conn.execute("UPDATE schedule_ops SET status = 'ok', error = ?, responded_at = ? WHERE id = ?", (json.dumps({**meta_json, "created": sid}, ensure_ascii=False), now, op["id"]))
        else:
            conn.execute("UPDATE schedule_ops SET status = 'ok', schedule_id = ?, responded_at = ? WHERE id = ?", (sid, now, op["id"]))
        conn.execute("UPDATE schedule_meta SET created_via = 'arx', created_by = ?, created_by_username = ?, created_at = ?, updated_by = ?, updated_by_username = ?, updated_at = ? WHERE schedule_id = ?",
                     (op["principal_user_id"], op["principal_username"], now, op["principal_user_id"], op["principal_username"], now, sid))
        if op["op"] == "restore" and meta_json.get("trash"):  # the claim on the trash item is finalised
            conn.execute("UPDATE schedule_trash SET restored_at = ?, restored_schedule_id = ? WHERE id = ? AND restored_at LIKE '~%'", (now, sid, meta_json["trash"]))
        audit(conn, actor=None, action="schedule.adopted", decision="allowed", resource_type="schedule", resource_id=sid,
              details={"op_id": op["id"], "op": op["op"], "requested_by": op["principal_username"], "requested_disabled": meta_json.get("enabled") is False})
        if meta_json.get("enabled") is False and item.get("enabled", True):
            self._followups.append({"kind": "disable", "sid": sid, "item": item, "op": dict(op)})
        if op["op"] == "split" and meta_json.get("original") and meta_json.get("remaining"):
            self._followups.append({"kind": "split_original", "sid": sid, "item": item, "op": dict(op), "meta": meta_json})

    def run_followups(self, conn: sqlite3.Connection | None) -> None:
        """Do what adopted ops still owe, through the same signed bridge path (as the requesting user), after the write that
        found them has committed. A failure is audited and never retried here: the review list keeps naming it."""
        todo, self._followups = self._followups, []
        for f in todo:
            try:
                self._followup(conn, f)
            except Exception as exc:  # noqa: BLE001 - one follow-up failing never stops the others or the pull
                log.warning("adoption follow-up %s of %s failed: %s", f["kind"], f["sid"], type(exc).__name__)
                try:
                    with self._use(conn) as c:
                        audit(c, actor=None, action="schedule.adoption_followup", decision="denied", resource_type="schedule", resource_id=f["sid"], reason=getattr(exc, "code", type(exc).__name__), details={"kind": f["kind"], "op_id": f["op"]["id"]})
                except Exception:  # noqa: BLE001
                    log.debug("could not audit the failed follow-up", exc_info=True)

    def _followup(self, conn: sqlite3.Connection | None, f: dict[str, Any]) -> None:
        op = f["op"]
        with self._use(conn) as c:
            secret = ha_bridge.signing_key(c)
            core = model.normalize(f["item"])
            from .schedule_view import Ctx

            sensitive = bool(model.classify(core, Ctx(c, None).resolver)["sensitive"])
            if f["kind"] == "disable":
                target, entity, payload, kind = f["sid"], f["item"].get("entity_id"), {}, "disable"
            else:
                meta = f["meta"]
                original = cache_row(c, meta["original"])
                if original is None or model.normalize(item_of(original))["weekdays"] != meta.get("before"):
                    return  # the original moved on (or is gone): nothing to complete blindly
                target, entity, kind = meta["original"], original["entity_id"], "edit"
                payload = {"weekdays": meta["remaining"], "start_date": meta.get("start_date"), "end_date": meta.get("end_date")}
        body = {"user_id": op["principal_user_id"], "op": kind, "request_id": "adopt" + op["id"], "schedule_id": target, "schedule_entity_id": entity, "payload": payload, "name": None, "time": None,
                "skip_conditions": False, "sensitive": sensitive}
        signed = ha_bridge.sign(secret or "", body)
        with (unlocked(conn) if conn is not None and not _read_only(conn) else nullcontext()):
            resp = get_transport().bridge(signed)
        if not isinstance(resp, dict) or not resp.get("ok"):
            raise ApiError(502, "scheduler_refused", "רכיב התזמונים דחה את השינוי.", details={"error": str((resp or {}).get("error"))[:60] if isinstance(resp, dict) else "bad_answer"})
        self.fetch_item(target, conn)
        with self._use(conn) as c:
            audit(c, actor=None, action="schedule.adoption_followup", decision="allowed", resource_type="schedule", resource_id=target, details={"kind": f["kind"], "op_id": op["id"]})

    def _arx_create_in_flight(self, conn: sqlite3.Connection) -> bool:
        """A create / copy / split / restore of Arx's own is pending or was requested a moment ago: what just appeared is
        probably its result (the op then claims it), not a change made outside."""
        cutoff = _iso(self.now() - dt.timedelta(seconds=120))
        return conn.execute("SELECT 1 FROM schedule_ops WHERE op IN ('create', 'copy', 'split', 'restore') AND (status = 'pending' OR requested_at >= ?) LIMIT 1", (cutoff,)).fetchone() is not None

    def _conditions_fail(self, conn: sqlite3.Connection, item: dict[str, Any], slot: int | None) -> bool:
        """The component sets a schedule to `triggered` at a slot start EVEN WHEN its conditions fail (verified), so
        `triggered` never proves the actions ran. When the mirrored states say the slot's conditions do not hold (and it does
        not track them for later), the derived run is `skipped`, never left to be confirmed by devices that may already be
        in the target state."""
        core = model.normalize(item)
        target = next((sl for sl in core["slots"] if sl["index"] == slot), core["slots"][0] if len(core["slots"]) == 1 else None)
        if target is None or not target["conditions"] or target["track"]:
            return False
        results = []
        for c in target["conditions"]:
            r = conn.execute("SELECT state, attributes_json FROM ha_entities WHERE entity_id = ?", (c["entity_id"],)).fetchone()
            try:
                attrs = json.loads(r["attributes_json"] or "{}") if r else {}
            except ValueError:
                attrs = {}
            results.append(_cond_holds(r["state"] if r else None, attrs, c))
        return not (all(results) if target["condition_type"] == "and" else any(results))

    def _recent_arx_op(self, conn: sqlite3.Connection, sid: str) -> bool:
        cutoff = _iso(self.now() - dt.timedelta(seconds=120))
        return conn.execute("SELECT 1 FROM schedule_ops WHERE schedule_id = ? AND (status = 'pending' OR requested_at >= ?) LIMIT 1", (sid, cutoff)).fetchone() is not None

    def _audit_outside(self, conn: sqlite3.Connection, sid: str, item: dict[str, Any], what: str) -> None:
        try:
            from .schedule_view import Ctx

            ctx = Ctx(conn, None)
            core = model.normalize(item)
            cls = model.classify(core, ctx.resolver)
            if not cls["sensitive"]:
                return
            audit(conn, actor=None, action="schedule.changed_outside", decision="allowed", resource_type="schedule", resource_id=sid,
                  details={"what": what, "revision_after": model.revision(item), "classes": cls["sensitive_classes"], "entities": model.action_entities(core)})
        except Exception:  # noqa: BLE001 - an audit hiccup never blocks the mirror
            log.exception("could not audit an outside change of %s", sid)

    # -- deferred fetches (component events, switch states)

    def on_component_event(self, frame: dict[str, Any]) -> None:
        """A frame of the component's own `scheduler_updated` command (verified 2026-09-30): `{"event": {"event":
        "scheduler_item_created" | "scheduler_item_updated" | "scheduler_item_removed" | "scheduler_timer_updated" |
        "scheduler_timer_finished", "schedule_id": ...}}`. `item_*` -> fetch the item; `item_removed` -> drop; `timer_*`
        ignored. The bus event `scheduler_updated` (subscribe_events) has `data: {}` - no id, none on remove - and is only a
        "something changed" signal: a full pull. The un-prefixed names stay accepted."""
        event = frame.get("event") if isinstance(frame, dict) else None
        if not isinstance(event, dict):
            return
        data = event.get("data") if isinstance(event.get("data"), dict) else event
        name = str(data.get("event") or data.get("type") or event.get("event") or "")
        name = name.removeprefix("scheduler_")  # the component's frames: scheduler_item_created | _item_updated | _item_removed | _timer_updated | _timer_finished
        sid = data.get("schedule_id") if isinstance(data.get("schedule_id"), str) else None
        if name.startswith("timer"):
            return  # a timer moved: the schedule itself did not change (its switch state carries `triggered`)
        if name == "item_removed" and sid:
            if self.db is not None:
                with self.db.connection(label="schedules event") as conn:
                    if self.drop(conn, sid):
                        ha_sync.publish({"type": "schedules_changed"})
            return
        self._queue(sid or "*")
        self.flush()

    def _queue(self, key: str) -> None:
        with self._lock:
            self._pending.add(key)
            if self.debounce_s > 0 and self._timer is None:
                self._timer = threading.Timer(self.debounce_s, self._timer_fire)
                self._timer.daemon = True
                self._timer.start()

    def flush(self) -> None:
        """Synchronous mode (`debounce_s == 0`): run the queued fetches now. Otherwise the timer does."""
        if self.debounce_s <= 0:
            self._drain()

    def _timer_fire(self) -> None:
        with self._lock:
            self._timer = None
        self._drain()

    def _drain(self) -> None:
        with self._lock:
            pending, self._pending = self._pending, set()
        if not pending or self.db is None or not self.feature_on(self.db):
            return
        try:
            if "*" in pending:
                self.pull(None, "event")
                return
            for sid in sorted(pending):
                try:
                    self.fetch_item(sid)
                except ApiError as exc:
                    log.info("schedule %s could not be refreshed: %s", sid, exc.code)
        except Exception:  # noqa: BLE001
            log.exception("deferred schedule refresh failed")

    def on_entity_state(self, conn: sqlite3.Connection, row: dict[str, Any], old_state: dict[str, Any] | None) -> None:
        """A `switch.schedule_*` state was mirrored (called inside `ha_sync.handle_state_event`'s transaction: nothing here
        talks to HA). A new or moved switch queues an item fetch; entering `triggered` starts a derived run (§6.6)."""
        if not feature_on(conn):
            return
        eid = row["entity_id"]
        sid = row.get("unique_id") if row.get("platform") == "scheduler" else None
        cached = conn.execute("SELECT schedule_id FROM schedule_cache WHERE entity_id = ?", (eid,)).fetchone()
        if cached is not None:
            sid = cached["schedule_id"]
        old = (old_state or {}).get("state")
        old_attrs = (old_state or {}).get("attributes") or {}
        attrs = row.get("attributes") or {}
        if cached is None or row.get("state") != old or attrs.get("next_trigger") != old_attrs.get("next_trigger"):
            self._queue(sid or "*")
        if row.get("state") == "triggered" and old != "triggered" and sid:
            self._start_run(conn, sid, row)

    def _start_run(self, conn: sqlite3.Connection, sid: str, row: dict[str, Any]) -> None:
        attrs = row.get("attributes") or {}
        slot = attrs.get("current_slot")
        slot = slot if isinstance(slot, int) and not isinstance(slot, bool) else None
        now = self.now()
        recent = _iso(now - dt.timedelta(seconds=30))
        if conn.execute("SELECT 1 FROM schedule_runs WHERE schedule_id = ? AND via = 'run_now' AND started_at >= ? LIMIT 1", (sid, recent)).fetchone():
            return  # the run-now request already made this run's row (the component enters `triggered` for it too)
        stamp = str(row.get("last_changed") or _iso(now))
        run_id = "r" + hashlib.sha1(f"{sid}|{stamp}".encode("utf-8")).hexdigest()[:14]
        sensitive = 0
        cached = cache_row(conn, sid)
        if cached is not None:
            try:
                from .schedule_view import Ctx

                core = model.normalize(item_of(cached))
                cls = model.classify(core, Ctx(conn, None).resolver)
                sensitive = 1 if cls["sensitive"] else 0
            except Exception:  # noqa: BLE001
                log.exception("could not classify the run of %s", sid)
        skipped = cached is not None and self._conditions_fail(conn, item_of(cached), slot)
        cur = conn.execute("INSERT OR IGNORE INTO schedule_runs(id, schedule_id, slot_index, started_at, settled_at, result, sensitive, via, detail_json) VALUES (?,?,?,?,?,?,?, 'component', ?)",
                           (run_id, sid, slot, _iso(now), _iso(now) if skipped else None, "skipped" if skipped else "pending", sensitive, json.dumps({"entities": [], "conditions": False}) if skipped else None))
        if sensitive and cur.rowcount and not skipped:
            audit(conn, actor=None, action="schedule.executed", decision="allowed", resource_type="schedule", resource_id=sid, details={"slot_index": slot, "run_id": run_id})
        ha_sync.publish({"type": "schedules_changed"})


def _cond_holds(state: str | None, attrs: dict[str, Any], c: dict[str, Any]) -> bool:
    if state in (None, "unavailable", "unknown"):
        return False  # an unavailable sensor satisfies neither `is on` nor `is off` (verified behaviour of the component)
    actual: Any = state if (c.get("attribute") or "state") == "state" else attrs.get(c["attribute"])
    want, kind = c.get("value"), c.get("match_type") or "is"
    if kind == "is":
        return str(actual) == str(want)
    if kind == "not":
        return str(actual) != str(want)
    try:
        a, b = float(actual), float(want)
    except (TypeError, ValueError):
        return False
    return a > b if kind == "above" else a < b


def stamp() -> str:
    """Now as UTC ISO-8601 with `Z`, from the mirror's clock (the real one in production; tests inject their own so every
    timestamp of the schedules - cache, ops, runs, trash - is on one timeline)."""
    return _iso(MIRROR.now())


def _read_only(conn: sqlite3.Connection) -> bool:
    from ..db import read_mode

    return read_mode(conn)


def _parse(value: Any) -> dt.datetime | None:
    try:
        return parse_utc(value) if isinstance(value, str) and value else None
    except ValueError:
        return None


def _op_field(row: sqlite3.Row, key: str) -> Any:
    try:
        data = json.loads(row["error"] or "{}")
    except ValueError:
        return None
    return data.get(key) if isinstance(data, dict) else None


def _op_name(row: sqlite3.Row) -> str:
    return str(_op_field(row, "name") or "")


MIRROR = Mirror()


# ---------------------------------------------------------------- runs (§6.6)

def settle_runs(conn: sqlite3.Connection, now: dt.datetime | None = None) -> int:
    """Settle every pending run older than RUN_SETTLE_S with the product's confirmation logic: each action entity of the
    slot is compared with what its service expects (`ha_bridge.ACTIONS` expect / attribute_reached). All confirmed ->
    `confirmed`; any unavailable -> `skipped`; some not reached -> `not_confirmed`; nothing observable -> `unknown`.
    Returns how many were settled. Wording downstream is never "failed"."""
    now = now or MIRROR.now()
    cutoff = _iso(now - dt.timedelta(seconds=RUN_SETTLE_S))
    settled = 0
    for run in conn.execute("SELECT * FROM schedule_runs WHERE result = 'pending' AND started_at <= ?", (cutoff,)).fetchall():
        row = cache_row(conn, run["schedule_id"])
        entities: list[dict[str, Any]] = []
        result = "unknown"
        sched_name = ""
        if row is not None:
            core = model.normalize(item_of(row))
            sched_name = str(core.get("name") or "")
            slot = next((s for s in core["slots"] if s["index"] == run["slot_index"]), None)
            slots = [slot] if slot is not None else ([core["slots"][0]] if len(core["slots"]) == 1 else [])
            entities = [_judge_action(conn, a) for s in slots for a in s["actions"] if a["entity_id"]]
            result = _overall([e["result"] for e in entities])
        conn.execute("UPDATE schedule_runs SET result = ?, settled_at = ?, detail_json = ? WHERE id = ?", (result, _iso(now), json.dumps({"entities": entities}, ensure_ascii=False), run["id"]))
        settled += 1
        from . import notify_sources  # CR-018: a SENSITIVE schedule whose run was not confirmed / skipped tells the administrators; a confirmed run resolves it

        meta = conn.execute("SELECT created_by, updated_by FROM schedule_meta WHERE schedule_id = ?", (run["schedule_id"],)).fetchone()
        notify_sources.on_schedule_run(conn, run["schedule_id"], sched_name, result, bool(run["sensitive"]), [e["entity_id"] for e in entities], (meta["updated_by"] or meta["created_by"]) if meta else None, run["id"])
    if settled:
        ha_sync.publish({"type": "schedules_changed"})
    return settled


def _overall(results: list[str]) -> str:
    known = [r for r in results if r != "unknown"]
    if any(r == "skipped" for r in results):
        return "skipped"
    if not known:
        return "unknown"
    return "confirmed" if all(r == "confirmed" for r in known) else "not_confirmed"


def _judge_action(conn: sqlite3.Connection, action: dict[str, Any]) -> dict[str, Any]:
    eid, service, data = action["entity_id"], action["service"], action["data"]
    r = conn.execute("SELECT state, attributes_json, available FROM ha_entities WHERE entity_id = ?", (eid,)).fetchone()
    if r is None or not r["available"] or r["state"] in (None, "unavailable"):
        return {"entity_id": eid, "expected": None, "observed": r["state"] if r else None, "result": "skipped"}
    try:
        attrs = json.loads(r["attributes_json"] or "{}")
    except ValueError:
        attrs = {}
    spec = ha_bridge.ACTIONS.get(service)
    if not spec:
        return {"entity_id": eid, "expected": None, "observed": r["state"], "result": "unknown"}
    args = {k: v for k, v in data.items() if k in spec["args"]}
    try:
        checked, cleaned = ha_bridge.validate_action(service, eid, args)
    except ApiError:
        return {"entity_id": eid, "expected": None, "observed": r["state"], "result": "unknown"}
    expected = ha_bridge.expectation_for(checked, attrs)
    kind = ha_bridge.confirmation_kind(service, expected)
    if kind == "none":
        return {"entity_id": eid, "expected": None, "observed": r["state"], "result": "unknown"}
    if kind == "state":
        reached = r["state"] == expected
        observed = r["state"]
    else:
        reached = ha_bridge.attribute_reached(service, {k: v for k, v in cleaned.items() if k != "entity_id"}, r["state"], attrs)
        attr = (spec.get("expect_attr") or {}).get("attribute")
        observed = attrs.get(attr) if attr else r["state"]
    return {"entity_id": eid, "expected": expected, "observed": None if observed is None else str(observed), "result": "confirmed" if reached else "not_confirmed"}


def record_run_now(conn: sqlite3.Connection, schedule_id: str, slot_index: int | None, sensitive: bool, now: dt.datetime | None = None) -> str:
    """A `run-now` request: its own derived-run row (via `run_now`), settled like the others."""
    run_id = "r" + uuid.uuid4().hex[:14]
    conn.execute("INSERT INTO schedule_runs(id, schedule_id, slot_index, started_at, result, sensitive, via) VALUES (?,?,?,?, 'pending', ?, 'run_now')",
                 (run_id, schedule_id, slot_index, _iso(now or MIRROR.now()), 1 if sensitive else 0))
    return run_id


# ---------------------------------------------------------------- ops (idempotency, §3 preamble)

def begin_op(conn: sqlite3.Connection, principal: Any, client_request_id: str, op: str, schedule_id: str | None, error: str | None = None) -> tuple[str, sqlite3.Row | None]:
    """Record the operation before anything is sent. Returns (op id, the FIRST op with this client_request_id, or None when
    this is the first): a repeated request answers as the first one did and never sends twice."""
    prev = conn.execute("SELECT * FROM schedule_ops WHERE principal_user_id = ? AND client_request_id = ?", (principal.user_id, client_request_id)).fetchone()
    if prev is not None:
        return prev["id"], prev
    op_id = "op" + uuid.uuid4().hex[:12]
    conn.execute("INSERT INTO schedule_ops(id, principal_user_id, principal_username, client_request_id, op, schedule_id, status, error, requested_at) VALUES (?,?,?,?,?,?, 'pending', ?, ?)",
                 (op_id, principal.user_id, principal.username, client_request_id, op, schedule_id, error, stamp()))
    return op_id, None


def finish_op(conn: sqlite3.Connection, op_id: str, status: str, *, error: str | None = None, schedule_id: str | None = None) -> None:
    conn.execute("UPDATE schedule_ops SET status = ?, error = COALESCE(?, error), schedule_id = COALESCE(?, schedule_id), responded_at = ? WHERE id = ?", (status, error, schedule_id, stamp(), op_id))


# ---------------------------------------------------------------- meta (owner of record, organisation)

def note_arx_write(conn: sqlite3.Connection, schedule_id: str, principal: Any, *, created: bool = False, now: str | None = None) -> None:
    """The owner of record (§2.1 `owner`): the last Arx editor, else the Arx creator."""
    now = now or stamp()
    conn.execute("INSERT OR IGNORE INTO schedule_meta(schedule_id, created_via, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)", (schedule_id, "arx" if created else "external", now, now))
    if created:
        conn.execute("UPDATE schedule_meta SET created_via = 'arx', created_by = ?, created_by_username = ?, created_at = ? WHERE schedule_id = ?", (principal.user_id, principal.username, now, schedule_id))
    conn.execute("UPDATE schedule_meta SET updated_by = ?, updated_by_username = ?, updated_at = ?, gone_at = NULL WHERE schedule_id = ?", (principal.user_id, principal.username, now, schedule_id))


def owner_of(meta: sqlite3.Row | None) -> dict[str, Any] | None:
    if meta is None:
        return None
    uid = meta["updated_by"] or meta["created_by"]
    name = meta["updated_by_username"] or meta["created_by_username"]
    return {"user_id": uid, "username": name or "", "display_name": name or ""} if uid else None


# ---------------------------------------------------------------- trash (§3.11-3.13)

def trash_put(conn: sqlite3.Connection, item: dict[str, Any], meta: sqlite3.Row | None, entities: list[dict[str, Any]], sensitive: bool, principal: Any, now: dt.datetime | None = None) -> tuple[str, str]:
    now = now or MIRROR.now()
    item = model.mask_codes(item)
    trash_id = "tr" + uuid.uuid4().hex[:12]
    expires = _iso(now + dt.timedelta(days=TRASH_DAYS))
    meta_json = json.dumps({k: meta[k] for k in meta.keys()}, ensure_ascii=False) if meta is not None else None
    conn.execute(
        "INSERT INTO schedule_trash(id, schedule_id, name, item_json, meta_json, entities_json, sensitive, deleted_by, deleted_by_username, deleted_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (trash_id, item["schedule_id"], item.get("name") or "", json.dumps(item, ensure_ascii=False, sort_keys=True), meta_json, json.dumps(entities, ensure_ascii=False), 1 if sensitive else 0,
         principal.user_id, principal.username, _iso(now), expires))
    return trash_id, expires


def trash_rows(conn: sqlite3.Connection, now: dt.datetime | None = None) -> list[sqlite3.Row]:
    """The live trash: not expired, not restored."""
    now_s = _iso(now or MIRROR.now())
    return conn.execute("SELECT * FROM schedule_trash WHERE restored_at IS NULL AND expires_at > ? ORDER BY deleted_at DESC", (now_s,)).fetchall()


# ---------------------------------------------------------------- housekeeping

def janitor(db: Database, settings: dict[str, Any]) -> dict[str, int]:
    """The janitor pass (main.janitor_tick): expired trash rows, runs past their retention, settled ops past 30 days, and
    the pending runs that are due. Nothing here talks to Home Assistant."""
    out = {"trash": 0, "runs": 0, "ops": 0, "settled": 0, "released": 0}
    with db.connection(label="schedules janitor") as conn:
        now = MIRROR.now()
        out["trash"] = conn.execute("DELETE FROM schedule_trash WHERE expires_at <= ?", (_iso(now),)).rowcount
        # a claim ('~restoring:<stamp>' / '~unknown:<stamp>') that nothing finished or adopted within the hour goes back to the trash
        out["released"] = conn.execute("UPDATE schedule_trash SET restored_at = NULL WHERE restored_at LIKE '~%' AND substr(restored_at, instr(restored_at, ':') + 1) < ?", (_iso(now - dt.timedelta(hours=1)),)).rowcount
        days = int(settings.get("schedules.runs_retention_days") or 90)
        out["runs"] = conn.execute("DELETE FROM schedule_runs WHERE started_at < ? AND result != 'pending'", (_iso(now - dt.timedelta(days=days)),)).rowcount
        out["ops"] = conn.execute("DELETE FROM schedule_ops WHERE requested_at < ? AND status != 'pending'", (_iso(now - dt.timedelta(days=OP_KEEP_DAYS)),)).rowcount
        if feature_on(conn):
            out["settled"] = settle_runs(conn, now)
    return out
