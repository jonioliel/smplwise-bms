"""WISKEY-ADOPT-2272 step 4: the Arx consumers of what WisKey's owner28 installation adds on the installed direct client
(`wiskey_auto_install.InstalledWiskeyClient`) - the durable template queue, the v3 pacing companion (reader in wiskey_auto_install), the
durable event cursor and the version-2 discovery document. Contracts: WisKey delivery 03_templates_queue/QUEUE_CONTRACT.json,
04_pacing/PACING_COMPATIBILITY.json, 05_events/EVENT_CURSOR_CONTRACT.json, native source direct_bridge_discovery.capabilities(version=2).

Rules kept from WisKey's contracts (never relaxed here):
- a queued template job is WisKey's: Arx enqueues once per operation (its own journal row first), reads `queued / dispatching / completed /
  cancelled / unknown` and never re-enqueues; `dispatching` after a WisKey restart is `unknown` (no replay); an UNKNOWN is never turned into
  not_sent and nothing is retried automatically; a provider ACK is `accepted` only (delivery stays unknown);
- the event cursor is at-least-once: records are de-duplicated by event id, the cursor is stored only AFTER the records were handed on, and
  `reset_required` (`source_replaced`, `cursor_ahead`, `retention_gap`) is reported as a gap - never as "all delivered". Moving to the
  `reset_cursor` is an explicit acknowledgement of the discontinuity (`acknowledge_reset`), recorded with its reason;
- discovery v2 is read by its own reader; the v1 reader (`wiskey_direct_discovery.read_capabilities`) is not changed.
Nothing here is wired to a screen or started at boot: it runs only through an installed client, which needs `wiskey.auto_install` on.
"""
from __future__ import annotations

import json
import logging
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Mapping

log = logging.getLogger("smplwise.wiskey.installed")

_REF_MAX = 128


def _ref(v: Any) -> bool:
    return isinstance(v, str) and 1 <= len(v.encode("utf-8")) <= _REF_MAX and not any(ord(c) < 32 or ord(c) == 127 for c in v)


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


# ================================================================ the template queue (whatsapp/template_enqueue_v1 / _job_v1 / _cancel_v1)

JOB_STATES = ("queued", "dispatching", "completed", "cancelled", "unknown")
JOB_KEYS = frozenset({"schema_version", "state", "result", "operation_id", "replay_available"})
TTL_MAX_S = 300


@dataclass(frozen=True)
class JobView:
    """One job as Arx reads it. `outcome`: pending (queued / dispatching) | accepted | not_sent | unknown. `retry_after_s` is WisKey's
    local pacing hint (relative to its observation) - never a retry permission."""

    operation_id: str
    state: str
    outcome: str
    code: str | None = None
    retry_after_s: int | None = None


def read_job(raw: Any, *, operation_id: str) -> JobView:
    """The closed job document. Anything malformed, of another operation or with a result Arx cannot prove is `unknown`."""
    if (not isinstance(raw, Mapping) or set(raw) != JOB_KEYS or type(raw["schema_version"]) is not int or raw["schema_version"] != 1
            or raw["operation_id"] != operation_id or raw["replay_available"] is not False or raw["state"] not in JOB_STATES):
        return JobView(operation_id, "unknown", "unknown", "invalid_response")
    state, result = raw["state"], raw["result"]
    if state in ("queued", "dispatching"):
        return JobView(operation_id, state, "pending" if result is None else "unknown", None if result is None else "invalid_response")
    if not isinstance(result, Mapping) or not isinstance(result.get("state"), str):
        return JobView(operation_id, state, "unknown", "invalid_response" if state != "unknown" else "unknown")
    code = result.get("code") if isinstance(result.get("code"), str) else None
    rstate = result["state"]
    if state == "unknown" or rstate == "unknown":
        return JobView(operation_id, state, "unknown", code or "unknown")
    if state == "cancelled":
        ok = rstate == "not_sent" and code == "cancelled_before_dispatch"
        return JobView(operation_id, state, "not_sent" if ok else "unknown", code)
    # completed: a provider ACK (accepted) or a proven pre-dispatch not_sent; anything else is unknown
    if rstate == "accepted" and result.get("provider_accepted") is True:
        return JobView(operation_id, state, "accepted", code)
    if rstate == "not_sent" and result.get("provider_accepted", False) is False:
        delay = result.get("retry_after_s")
        return JobView(operation_id, state, "not_sent", code, delay if type(delay) is int and delay >= 0 else None)
    return JobView(operation_id, state, "unknown", code or "invalid_response")


# review L3: both tables (`wiskey_template_jobs`, `wiskey_event_seen`) come from this numbered migration - nothing here runs DDL
MIGRATION = "0183_wiskey_installed_features.sql"


class TemplateJobs:
    """Arx's side of WisKey's durable queue: a local row BEFORE the enqueue leaves (so a lost answer is never enqueued again), then
    WisKey's job document. Only ids, states and codes are kept - never a phone number, a parameter value or a template body. The table
    is migration 0183's (`MIGRATION`)."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self.conn = conn

    def row(self, operation_id: str) -> dict[str, Any] | None:
        r = self.conn.execute("SELECT operation_id, request_id, state, outcome, code FROM wiskey_template_jobs WHERE operation_id = ?",
                              (operation_id,)).fetchone()
        return None if r is None else dict(zip(("operation_id", "request_id", "state", "outcome", "code"), r))

    def _note(self, view: JobView) -> None:
        self.conn.execute("UPDATE wiskey_template_jobs SET state = ?, outcome = ?, code = ?, updated_at = ? WHERE operation_id = ?",
                          (view.state, view.outcome, view.code, _now(), view.operation_id))
        self.conn.commit()

    async def enqueue(self, client: Any, template: Mapping[str, Any], *, ttl_s: int, template_id: str | None = None,
                      person_id: str | None = None) -> JobView:
        """`template` is the closed v2 descriptor (wa_template_send.TemplateRequestV2 wire). One enqueue per operation, ever."""
        op, req = template.get("operation_id"), template.get("request_id")
        if not (_ref(op) and _ref(req)) or type(ttl_s) is not int or not 1 <= ttl_s <= TTL_MAX_S:
            return JobView(str(op), "unknown", "not_sent", "invalid_fields")
        seen = self.row(op)
        if seen is not None:  # observed again: never enqueued twice; read WisKey's record instead
            return JobView(op, seen["state"], seen["outcome"], seen["code"])
        try:
            now = _now()
            self.conn.execute("INSERT INTO wiskey_template_jobs (operation_id, request_id, template_id, person_id, state, outcome, code, "
                              "created_at, updated_at) VALUES (?, ?, ?, ?, 'unknown', 'unknown', 'enqueue_in_flight', ?, ?)",
                              (op, req, template_id, person_id, now, now))
            self.conn.commit()
        except sqlite3.IntegrityError:
            # review M7: a concurrent enqueue of the same operation won the row - its record is the answer (never a false not_sent);
            # a request id recorded for ANOTHER operation leaves this one unknown
            try:
                self.conn.rollback()
            except sqlite3.Error:
                pass
            seen = self.row(op)
            if seen is not None:
                return JobView(op, seen["state"], seen["outcome"], seen["code"])
            return JobView(op, "unknown", "unknown", "request_already_recorded")
        try:
            raw = await client.enqueue(dict(template), ttl_s)
        except Exception as exc:  # noqa: BLE001 - after the write began the outcome is unknown unless the transport proves not_sent
            proven = getattr(exc, "outcome", None) == "not_sent"
            view = JobView(op, "unknown", "not_sent" if proven else "unknown", str(getattr(exc, "code", None) or type(exc).__name__)[:64])
            self._note(view)
            return view
        view = read_job(raw, operation_id=op)
        self._note(view)
        return view

    async def refresh(self, client: Any, operation_id: str) -> JobView:
        raw = await client.call("whatsapp/template_job_v1", {"operation_id": operation_id})
        view = read_job(raw, operation_id=operation_id)
        if self.row(operation_id) is not None:
            self._note(view)
        return view

    async def cancel(self, client: Any, operation_id: str) -> JobView:
        """Only a still-queued job can be cancelled (WisKey decides); the answer is read like any job document."""
        raw = await client.call("whatsapp/template_cancel_v1", {"operation_id": operation_id})
        view = read_job(raw, operation_id=operation_id)
        if self.row(operation_id) is not None:
            self._note(view)
        return view


# ================================================================ the durable event cursor (events/resume_v1)

EVENT_CONTRACT = "wiskey-event-cursor.v1"
PAGE_KEYS = frozenset({"contract", "schema_version", "state", "reason", "records", "cursor", "reset_cursor", "has_more", "all_delivered",
                       "source"})
RESET_REASONS = ("source_replaced", "cursor_ahead", "retention_gap")
CURSOR_KEY = "wiskey.events.cursor"  # {"cursor", "source", "pending_reset", "gaps"} - no event content
GAP_HISTORY = 32  # review L2: acknowledged gaps kept (reason + times only)
SEEN_LIMIT = 4096  # event ids kept for de-duplication (at-least-once delivery)
PAGE_LIMIT_MAX = 500


class EventCursorError(ValueError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class EventPage:
    state: str  # page | reset_required
    reason: str | None
    records: tuple[dict[str, Any], ...]
    cursor: str | None
    reset_cursor: str | None
    has_more: bool
    all_delivered: bool
    source: str


def read_page(raw: Any) -> EventPage:
    """The closed `wiskey-event-cursor.v1` answer. A reset never claims delivery; a page's records are ordered by sequence."""
    if (not isinstance(raw, Mapping) or set(raw) != PAGE_KEYS or raw["contract"] != EVENT_CONTRACT or type(raw["schema_version"]) is not int
            or raw["schema_version"] != 1 or not _ref(raw["source"]) or type(raw["has_more"]) is not bool
            or type(raw["all_delivered"]) is not bool or type(raw["records"]) is not list):
        raise EventCursorError("event_page_invalid")
    if raw["state"] == "reset_required":
        if (raw["reason"] not in RESET_REASONS or raw["records"] or raw["all_delivered"] is not False or raw["has_more"] is not False
                or not isinstance(raw["reset_cursor"], str)):
            raise EventCursorError("event_page_invalid")
        return EventPage("reset_required", raw["reason"], (), raw["cursor"], raw["reset_cursor"], False, False, raw["source"])
    if raw["state"] != "page" or raw["reason"] is not None or raw["reset_cursor"] is not None or not isinstance(raw["cursor"], str):
        raise EventCursorError("event_page_invalid")
    if raw["all_delivered"] and raw["has_more"]:
        raise EventCursorError("event_page_invalid")
    last = 0
    records = []
    for rec in raw["records"]:
        if (not isinstance(rec, Mapping) or set(rec) != {"sequence", "event"} or type(rec["sequence"]) is not int or rec["sequence"] <= last
                or not isinstance(rec["event"], Mapping) or not _ref(rec["event"].get("id"))):
            raise EventCursorError("event_page_invalid")
        last = rec["sequence"]
        records.append({"sequence": rec["sequence"], "event": dict(rec["event"])})
    return EventPage("page", None, tuple(records), raw["cursor"], None, raw["has_more"], raw["all_delivered"], raw["source"])


@dataclass(frozen=True)
class PullResult:
    state: str  # page | reset_required | reset_pending
    reason: str | None
    delivered: int
    duplicates: int
    has_more: bool
    all_delivered: bool


class EventCursor:
    """The consumer: one durable cursor + the recent event ids, in Arx's settings / a small table. `pull` hands each NEW event to
    `handler` (in order), remembers each id once its handler returned, and stores the cursor only after all of them returned; a handler
    failure leaves the cursor where it was (the page comes again - at-least-once - and the de-duplication drops what was already handed
    on)."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self.conn = conn  # `wiskey_event_seen` is migration 0183's (review L3)

    def _doc(self) -> dict[str, Any]:
        from ..db import get_setting

        try:
            doc = json.loads(get_setting(self.conn, CURSOR_KEY) or "{}")
        except ValueError:
            doc = {}
        return doc if isinstance(doc, dict) else {}

    def state(self) -> dict[str, Any]:
        doc = self._doc()
        gaps = doc.get("gaps") if isinstance(doc.get("gaps"), list) else []
        return {"cursor": doc.get("cursor"), "source": doc.get("source"), "pending_reset": doc.get("pending_reset"),
                "last_gap": gaps[-1] if gaps else None, "gaps": gaps}

    def _store(self, update: dict[str, Any]) -> None:
        """Review L2: merged into the stored document - the gap history (`gaps`) survives every later cursor move."""
        from ..db import set_setting

        doc = self._doc()
        doc.pop("last_gap", None)  # superseded by `gaps` (derived in state())
        doc.update({k: v for k, v in update.items() if k not in ("gaps", "last_gap")})
        set_setting(self.conn, CURSOR_KEY, json.dumps(doc, separators=(",", ":")))

    def _record_gap(self, pending: dict[str, Any]) -> dict[str, Any]:
        from ..db import set_setting

        doc = self._doc()
        gaps = doc.get("gaps") if isinstance(doc.get("gaps"), list) else []
        gap = {"reason": pending.get("reason"), "observed_at": pending.get("observed_at"), "acknowledged_at": _now(), "delivered": False}
        doc["gaps"] = (gaps + [gap])[-GAP_HISTORY:]
        doc.pop("last_gap", None)
        set_setting(self.conn, CURSOR_KEY, json.dumps(doc, separators=(",", ":")))
        return gap

    def _seen(self, event_id: str) -> bool:
        return self.conn.execute("SELECT 1 FROM wiskey_event_seen WHERE event_id = ?", (event_id,)).fetchone() is not None

    def _remember(self, ids: list[str]) -> None:
        top = self.conn.execute("SELECT COALESCE(MAX(seq), 0) FROM wiskey_event_seen").fetchone()[0]
        self.conn.executemany("INSERT OR IGNORE INTO wiskey_event_seen (event_id, seq) VALUES (?, ?)",
                              [(e, top + i + 1) for i, e in enumerate(ids)])
        self.conn.execute("DELETE FROM wiskey_event_seen WHERE seq <= (SELECT COALESCE(MAX(seq), 0) FROM wiskey_event_seen) - ?",
                          (SEEN_LIMIT,))

    async def pull(self, client: Any, handler: Callable[[dict[str, Any]], Any], *, limit: int = 100) -> PullResult:
        if type(limit) is not int or not 1 <= limit <= PAGE_LIMIT_MAX:
            raise EventCursorError("invalid_fields")
        st = self.state()
        if st["pending_reset"] is not None:  # a gap was reported and not acknowledged yet: nothing more is read past it
            return PullResult("reset_pending", st["pending_reset"]["reason"], 0, 0, False, False)
        page = read_page(await client.events(st["cursor"], limit))
        if page.state == "page" and st["source"] is not None and page.source != st["source"]:
            # review L2: a page from ANOTHER source than the stored cursor's is a discontinuity WisKey did not announce - nothing of it
            # is handed on; it is recorded like a reset (adopting it starts the new source from its beginning: reset cursor None)
            self._store({"pending_reset": {"reason": "source_mismatch", "reset_cursor": None, "source": page.source, "observed_at": _now()}})
            self.conn.commit()
            log.warning("wiskey events: the page's source differs from the stored cursor's; the gap is recorded, not delivered")
            return PullResult("reset_required", "source_mismatch", 0, 0, False, False)
        if page.state == "reset_required":
            # the gap is recorded (never "all delivered"); the reset cursor is adopted only by acknowledge_reset()
            self._store({"pending_reset": {"reason": page.reason, "reset_cursor": page.reset_cursor, "source": page.source,
                                           "observed_at": _now()}})
            self.conn.commit()
            log.warning("wiskey events: reset required (%s); the gap is recorded, not delivered", page.reason)
            return PullResult("reset_required", page.reason, 0, 0, False, False)
        fresh, dup = [], 0
        for rec in page.records:
            eid = rec["event"]["id"]
            if self._seen(eid) or eid in {r["event"]["id"] for r in fresh}:
                dup += 1
                continue
            fresh.append(rec)
        for rec in fresh:
            result = handler(rec["event"])
            if hasattr(result, "__await__"):
                await result  # type: ignore[misc]
            # review L1: remembered as soon as ITS handler returned - a later failure on the page re-reads the page (the cursor did not
            # move) and the events already handed on are dropped as duplicates instead of being handed on twice
            self._remember([rec["event"]["id"]])
            self.conn.commit()
        self._store({"cursor": page.cursor, "source": page.source, "pending_reset": None})
        self.conn.commit()
        return PullResult("page", None, len(fresh), dup, page.has_more, page.all_delivered)

    def acknowledge_reset(self) -> dict[str, Any] | None:
        """The explicit discontinuity acknowledgement: move to WisKey's `reset_cursor` (its current high mark). It is NOT a proof that the
        missing history was delivered; the reason stays in the returned record for the caller's audit."""
        st = self.state()
        pending = st["pending_reset"]
        if pending is None:
            return None
        self._record_gap(pending)  # review L2: a durable, bounded history of every acknowledged gap
        self._store({"cursor": pending["reset_cursor"], "source": pending["source"], "pending_reset": None})
        self.conn.commit()
        return {"reason": pending["reason"], "delivered": False}


# ================================================================ direct/capabilities_v2 (its own reader; v1 untouched)

NATIVE_INSTALLATION_KEYS = frozenset({"schema_version", "contract", "authority_mode", "grant_ref", "source", "expires_at"})


def read_capabilities_v2(raw: Any, connection_ref: str, *, manifest_grant: Mapping[str, Any] | None = None) -> Any:
    """The schema-2 document of `direct/capabilities_v2`: the v1 core (read by the UNCHANGED v1 reader on a copy whose version-2 markers
    are taken out), `lifecycle.event_cursor_resume` true and the closed `native_installation` block. With `manifest_grant`, the block's
    GrantRef must be the one WisKey published in the private manifest (a different one = the installation changed). Returns
    (Capabilities, native_installation)."""
    from . import wiskey_direct_discovery as dd

    if not isinstance(raw, Mapping) or raw.get("schema_version") != 2 or type(raw.get("schema_version")) is not int:
        raise dd.DiscoveryError("capabilities_unsupported")
    block = raw.get("native_installation")
    if (not isinstance(block, Mapping) or set(block) != NATIVE_INSTALLATION_KEYS or block["schema_version"] != 1
            or block["contract"] != "wiskey-native-service-write.v2" or block["authority_mode"] != "permanent_full_installation"
            or block["expires_at"] is not None or not (block["grant_ref"] is None or isinstance(block["grant_ref"], Mapping))):
        raise dd.DiscoveryError("capabilities_invalid")
    lifecycle = raw.get("lifecycle")
    if not isinstance(lifecycle, Mapping) or lifecycle.get("event_cursor_resume") is not True:
        raise dd.DiscoveryError("lifecycle_unsupported")
    if manifest_grant is not None and dict(block["grant_ref"] or {}) != dict(manifest_grant):
        raise dd.DiscoveryError("installation_changed_reconnect_required")
    core = {k: v for k, v in raw.items() if k != "native_installation"}
    core["schema_version"] = dd.SCHEMA_VERSION
    core["lifecycle"] = {**lifecycle, "event_cursor_resume": False}
    return dd.read_capabilities(core, connection_ref), dict(block)
