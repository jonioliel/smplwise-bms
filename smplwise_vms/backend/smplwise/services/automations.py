"""CR-017 (automations, scenes, scripts): the mirror, the read model and the status (docs/architecture/AUTOMATIONS_API.md §2-§3, §6; CR §4.6, §6.1, §8.1,
§9.4-§9.7, §10-§12).

Home Assistant's config files are the authority. This module keeps a READ cache of every item (`ha_config_items`: the stored config with secret-like values
masked, its revision, where it lives), Arx-only data around it (`automation_meta`, `automation_prefs`), the version history (`automation_versions`) and the
derived runs (`automation_runs`). Nothing here writes to Home Assistant: the write path is services/automation_ops.py through the bridge; reads are the
config API by id, the add-on's WebSocket session (`trace/*`, `validate_config`, `get_services`) and the entity states ha_sync already mirrors.

Refresh layers (§12): a full pull at every session start and every registry refresh, deferred per-item fetches on `automation_reloaded` / `scene_reloaded` /
`automation_triggered` / `script_started` and on the three domains' state changes, and Arx's own writes. Every cache change publishes
`{"type": "automations_changed", "kinds": [...], "ids": []}` (no ids: the clients refetch what they may see).

Seams: `automation_transport.set_transport(Fake)`; events through `MIRROR.on_ha_event(frame)`; entity states through `ha_sync.handle_state_event`."""
from __future__ import annotations

import concurrent.futures
import datetime as dt
import hashlib
import json
import logging
import sqlite3
import threading
import uuid
from contextlib import contextmanager, nullcontext
from typing import Any, Callable, Iterator

from ..audit import audit
from ..db import Database, get_setting, set_setting, unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize
from . import automation_model as model
from . import automation_policy as pol
from . import automation_scope as scope
from . import automation_trace as trace
from . import automation_transport as tr
from . import ha_bridge, ha_sync
from .timeutil import iso_utc, parse_utc, zone

log = logging.getLogger("smplwise.automations")

KINDS = pol.ITEM_KINDS
FETCH_CONCURRENCY = 4
STALE_AFTER_S = 25 * 60
ENSURE_RETRY_S = 30.0
FETCH_DEBOUNCE_S = 0.5
RUN_KEEP_DAYS = 30
OP_KEEP_DAYS = 30
RECENT_OP_S = 120
AUTHORING_RETRY_S = 60
TRACE_LIST_MAX = 50


def _iso(value: dt.datetime) -> str:
    return iso_utc(value)


def is_json_error(reply: Any) -> tuple[bool, str | None]:
    if not isinstance(reply, dict):
        return False, "bad_reply"
    if reply.get("success"):
        return True, None
    err = reply.get("error")
    return False, (err.get("code") if isinstance(err, dict) else None) or "error"


def feature_on(conn: sqlite3.Connection) -> bool:
    return (get_setting(conn, "automations.enabled", "true") or "true") == "true"


def _read_only(conn: sqlite3.Connection) -> bool:
    from ..db import read_mode

    return read_mode(conn)


def _parse(value: Any) -> dt.datetime | None:
    try:
        return parse_utc(value) if isinstance(value, str) and value else None
    except ValueError:
        return None


# ================================================================ candidates and fetching

class Cand:
    """One item Home Assistant has an entity for: where its config lives (`config_id`), or that it has none."""

    def __init__(self, kind: str, item_id: str, config_id: str | None, entity_id: str | None, platform: str | None = None, integration: bool = False) -> None:
        self.kind, self.item_id, self.config_id, self.entity_id, self.platform, self.integration = kind, item_id, config_id, entity_id, platform, integration

    @property
    def key(self) -> tuple[str, str]:
        return self.kind, self.item_id


def candidates(conn: sqlite3.Connection) -> list[Cand]:
    """The automation / script / scene entities of the mirror (ha_sync keeps them): automation and native scene -> the `id` attribute (= registry unique_id),
    script -> the object id of `script.<key>`; an item without one is `entity:<entity_id>` (YAML without an id, an integration's scene)."""
    out: list[Cand] = []
    for r in conn.execute("SELECT entity_id, domain, attributes_json, platform, unique_id FROM ha_entities WHERE domain IN ('automation', 'script', 'scene') AND removed_at IS NULL ORDER BY entity_id").fetchall():
        try:
            attrs = json.loads(r["attributes_json"] or "{}")
        except ValueError:
            attrs = {}
        kind, eid = r["domain"], r["entity_id"]
        if kind == "script":
            cid: str | None = eid.split(".", 1)[1]
        elif kind == "automation":
            cid = str(attrs["id"]) if attrs.get("id") not in (None, "") else (str(r["unique_id"]) if r["platform"] == "automation" and r["unique_id"] else None)
        else:
            native = r["platform"] == "homeassistant" or (r["platform"] is None and attrs.get("id") not in (None, ""))
            cid = (str(attrs["id"]) if attrs.get("id") not in (None, "") else (str(r["unique_id"]) if r["unique_id"] else None)) if native else None
        out.append(Cand(kind, cid or f"entity:{eid}", cid, eid, r["platform"], integration=(kind == "scene" and cid is None)))
    return out


def fetch_config(transport: tr.AutomationsTransport, c: Cand) -> dict[str, Any]:
    """Read one item's stored config: {"status": "ok" | "yaml" | "none" | "api_unavailable" | "error", "config": dict | None}. REST first (the config API by id);
    a refusal or a missing view falls back to the session's `automation/config` / `script/config` command (U-2)."""
    if c.config_id is None:
        return {"status": "none", "config": None}
    try:
        status, body = transport.rest_config(c.kind, c.config_id)
    except ApiError:
        return {"status": "error", "config": None}
    if status == 200 and isinstance(body, dict):
        return {"status": "ok", "config": body}
    if status == 404 and isinstance(body, dict):  # in HA's registry but not in the editor's file: a YAML-managed item
        return {"status": "yaml", "config": _ws_config(transport, c)}
    if status in (401, 403) or (status in (404, 405) and body is None):
        cfg = _ws_config(transport, c)
        return {"status": "ok" if cfg is not None else "api_unavailable", "config": cfg}
    return {"status": "error", "config": None}


def _ws_config(transport: tr.AutomationsTransport, c: Cand) -> dict[str, Any] | None:
    if c.kind not in ("automation", "script") or not c.entity_id:
        return None
    try:
        reply = transport.ws(f"{c.kind}/config", entity_id=c.entity_id)
    except ApiError:
        return None
    ok, _ = is_json_error(reply)
    result = reply.get("result") if ok else None
    cfg = result.get("config") if isinstance(result, dict) else None
    return cfg if isinstance(cfg, dict) else None


def config_sensitive(kind: str, cfg: dict[str, Any] | None) -> list[str]:
    """The sensitive classes a stored config statically contains (no entity lookups: alarm / lock / siren services, locked blocks that touch them)."""
    if not isinstance(cfg, dict) or kind == "scene":
        return []
    d = model.config_to_draft(kind, cfg, model.ModelContext(template_text=False)).draft
    return model.sensitive_classes(d)


# ================================================================ the mirror

class Mirror:
    """The read cache and its refresh layers. One process-wide instance (`MIRROR`); no per-request state - the database is the state. `debounce_s == 0`
    (tests) runs every deferred fetch synchronously at `flush()`."""

    def __init__(self) -> None:
        self.db: Database | None = None
        self.settings: Any = None
        self.debounce_s: float = FETCH_DEBOUNCE_S
        self.clock: Callable[[], dt.datetime] = lambda: dt.datetime.now(dt.timezone.utc)
        self._lock = threading.Lock()
        self._pending: set[str] = set()
        self._timer: threading.Timer | None = None

    # -- wiring

    def bind(self, db: Database, settings: Any = None) -> None:
        self.db = db
        if settings is not None:
            self.settings = settings
            tr.bind_settings(settings)

    def reset(self) -> None:
        with self._lock:
            self._pending.clear()
            if self._timer is not None:
                self._timer.cancel()
            self._timer = None
        _STORM_AUDITED.clear()

    def now(self) -> dt.datetime:
        return self.clock()

    def stamp(self) -> str:
        return _iso(self.now())

    def feature_on(self, handle: Any) -> bool:
        if isinstance(handle, sqlite3.Connection):
            return feature_on(handle)
        with handle.connection(mode="read") as conn:
            return feature_on(conn)

    @contextmanager
    def _use(self, conn: sqlite3.Connection | None) -> Iterator[sqlite3.Connection]:
        if conn is not None:
            yield conn
            return
        if self.db is None:
            raise RuntimeError("automations mirror is not bound to a database")
        with self.db.connection(label="automations mirror") as c:
            yield c

    def _save(self, conn: sqlite3.Connection, st: dict[str, Any]) -> None:
        set_setting(conn, tr.STATE_KEY, json.dumps(st, ensure_ascii=False, separators=(",", ":")))

    def feature_switched_on(self) -> None:
        try:
            ha_sync.SYNC.automations_switched_on()
        except Exception:  # noqa: BLE001
            log.exception("could not start the automations subscriptions")

    # -- pulls

    def ensure(self, conn: sqlite3.Connection) -> None:
        """A request found the mirror never synced: pull now, at most once per ENSURE_RETRY_S. Reads never wait for the periodic pull to have something to show."""
        if not feature_on(conn) or not tr.get_transport().connected():
            return
        st = tr.mirror_state(conn)
        if st.get("last_sync_at") is not None:
            return
        last = _parse(st.get("last_attempt_at"))
        if last is not None and (self.now() - last).total_seconds() < ENSURE_RETRY_S:
            return
        self.pull(conn, "first")

    def pull(self, conn: sqlite3.Connection | None = None, reason: str = "") -> dict[str, Any]:
        """Full pull of every item (config by id, ≤ 4 in flight), then the cache is made equal to it. Failures keep the cache and are recorded."""
        handle = conn if conn is not None else self.db
        if handle is None or not self.feature_on(handle):
            return {"skipped": "feature_disabled"}
        transport = tr.get_transport()
        with self._use(conn) as c:
            st = tr.mirror_state(c)
            st["last_attempt_at"] = self.stamp()
            self._save(c, st)
            cands = candidates(c)
        try:
            with (unlocked(conn) if conn is not None and not _read_only(conn) else nullcontext()):
                results = self._fetch_all(transport, cands)
                probe = self._probe(transport) if not any(c.config_id for c in cands) else None
        except ApiError as exc:
            self._record_error(conn, exc.code)
            return {"error": exc.code}
        with self._use(conn) as c:
            changed = self.apply(c, cands, results, full=True)
            st = tr.mirror_state(c)
            oks = [r for r in results.values() if r["status"] in ("ok", "yaml")]
            api_bad = [r for r in results.values() if r["status"] == "api_unavailable"]
            if oks:
                st["config_api"] = "ok"
            elif api_bad:
                st["config_api"] = "unavailable"
            elif probe is not None:
                st["config_api"] = probe
            st.update(last_sync_at=self.stamp(), last_error=None if any(r["status"] != "error" for r in results.values()) or not results else "fetch_failed")
            st["ha_version"] = ha_sync.STATE.ha_version or st.get("ha_version")
            self._save(c, st)
        if changed:
            publish(["automation", "script", "scene"])
        return {"items": len(cands), "changed": changed}

    def _fetch_all(self, transport: tr.AutomationsTransport, cands: list[Cand]) -> dict[tuple[str, str], dict[str, Any]]:
        todo = [c for c in cands if c.config_id is not None]
        out: dict[tuple[str, str], dict[str, Any]] = {c.key: {"status": "none", "config": None} for c in cands}
        if not todo:
            return out
        with concurrent.futures.ThreadPoolExecutor(max_workers=FETCH_CONCURRENCY) as pool:
            for c, res in zip(todo, pool.map(lambda x: fetch_config(transport, x), todo)):
                out[c.key] = res
        return out

    def _probe(self, transport: tr.AutomationsTransport) -> str | None:
        """No item to read: ask for an id that cannot exist. JSON `{"message": ...}` = the config API is there; anything else = it is not (CR §2: the components
        list is never trusted)."""
        try:
            status, body = transport.rest_config("automation", tr.PROBE_ID)
        except ApiError:
            return None
        if status == 200 or (status == 404 and isinstance(body, dict)):
            return "ok"
        return "unavailable"

    def _record_error(self, conn: sqlite3.Connection | None, code: str) -> None:
        try:
            with self._use(conn) as c:
                st = tr.mirror_state(c)
                st["last_error"] = code
                self._save(c, st)
        except Exception:  # noqa: BLE001
            log.debug("could not record the automations mirror error", exc_info=True)

    def fetch_item(self, kind: str, item_id: str, conn: sqlite3.Connection | None = None, *, entity_id: str | None = None) -> dict[str, Any] | None:
        """One fresh read of one item: the cache row is updated; returns the stored config (None when the item is gone or has no readable config). Transport
        errors propagate as ApiError."""
        transport = tr.get_transport()
        with self._use(conn) as c:
            row = cache_row(c, kind, item_id)
            ent = entity_id or (row["entity_id"] if row is not None else None)
        cid = row["config_id"] if row is not None else (None if item_id.startswith("entity:") else item_id)
        cand = Cand(kind, item_id, cid, ent, None, integration=(row is not None and row["source"] == "integration"))
        with (unlocked(conn) if conn is not None and not _read_only(conn) else nullcontext()):
            res = fetch_config(transport, cand)
        if res["status"] == "error":
            raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True)
        with self._use(conn) as c:
            if res["status"] in ("none", "api_unavailable") and row is None:
                return None
            changed = self.apply(c, [cand], {cand.key: res}, full=False)
            if changed:
                publish([kind])
        return res["config"]

    # -- the cache

    def apply(self, conn: sqlite3.Connection, cands: list[Cand], results: dict[tuple[str, str], dict[str, Any]], *, full: bool) -> bool:
        """Write results into the cache (and the meta / version rows). With `full` the items no longer there are dropped. Returns whether anything changed."""
        now = self.stamp()
        st = tr.mirror_state(conn)
        baseline = st.get("last_sync_at") is None and full
        existing = {(r["kind"], r["item_id"]): r for r in conn.execute("SELECT * FROM ha_config_items").fetchall()}
        changed = False
        seen: set[tuple[str, str]] = set()
        for c in cands:
            res = results.get(c.key) or {"status": "error", "config": None}
            seen.add(c.key)
            row = existing.get(c.key)
            if res["status"] in ("error", "api_unavailable") and row is not None:
                conn.execute("UPDATE ha_config_items SET seen_at = ? WHERE kind = ? AND item_id = ?", (now, c.kind, c.item_id))
                continue
            cfg = res["config"] if isinstance(res["config"], dict) else None
            if res["status"] == "ok":
                source, reason = "ui", None
            elif res["status"] == "yaml":
                source, reason = "yaml", "yaml_managed"
            elif c.kind == "scene" and c.integration:
                source, reason = "integration", "integration_scene"
            else:
                source, reason = "yaml", "no_config_id"
            if res["status"] in ("error", "api_unavailable"):
                source, reason = "yaml", "config_api_unavailable"
            changed = self._upsert(conn, c, source, reason, cfg, row, now, baseline) or changed
        if full:
            for key, row in existing.items():
                if key not in seen:
                    conn.execute("DELETE FROM ha_config_items WHERE kind = ? AND item_id = ?", key)
                    conn.execute("UPDATE automation_meta SET gone_at = COALESCE(gone_at, ?) WHERE kind = ? AND item_id = ?", (now, *key))
                    changed = True
        return changed

    def _upsert(self, conn: sqlite3.Connection, c: Cand, source: str, reason: str | None, cfg: dict[str, Any] | None, row: sqlite3.Row | None, now: str, baseline: bool) -> bool:
        masked_cfg = pol.mask_secrets(cfg) if cfg is not None else None
        rev = model.revision_of(cfg) if cfg is not None else None
        masked = 1 if cfg is not None and pol.secret_kind(cfg) else 0
        blob = json.dumps(masked_cfg, ensure_ascii=False) if masked_cfg is not None else None
        config_id = c.config_id
        if row is None:
            conn.execute("INSERT INTO ha_config_items(kind, item_id, config_id, entity_id, source, revision, config_json, masked, reason, seen_at, changed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                         (c.kind, c.item_id, config_id, c.entity_id, source, rev, blob, masked, reason, now, now))
            exists = conn.execute("SELECT 1 FROM automation_meta WHERE kind = ? AND item_id = ?", c.key).fetchone()
            if exists is None:
                conn.execute("INSERT INTO automation_meta(kind, item_id, created_via, first_seen_at, last_seen_at) VALUES (?, ?, 'external', ?, ?)", (*c.key, now, now))
                if not baseline and not self._arx_create_in_flight(conn) and cfg is not None:
                    self._audit_outside(conn, c, cfg, "created", rev)
            else:
                conn.execute("UPDATE automation_meta SET last_seen_at = ?, gone_at = NULL WHERE kind = ? AND item_id = ?", (now, *c.key))
            if rev is not None:
                note_version(conn, c.kind, c.item_id, rev, blob, masked, "external", None, None, self.now(), keep=versions_keep(conn))
            return True
        changed = False
        if (row["revision"] != rev or row["entity_id"] != c.entity_id or row["source"] != source or row["config_json"] != blob or row["reason"] != reason or row["config_id"] != config_id):
            conn.execute("UPDATE ha_config_items SET config_id = ?, entity_id = ?, source = ?, revision = ?, config_json = ?, masked = ?, reason = ?, seen_at = ?, changed_at = ? WHERE kind = ? AND item_id = ?",
                         (config_id, c.entity_id, source, rev, blob, masked, reason, now, now, *c.key))
            changed = True
            if row["revision"] != rev and rev is not None:
                arx = self._recent_arx_op(conn, c.kind, c.item_id)
                note_version(conn, c.kind, c.item_id, rev, blob, masked, "arx" if arx else "external", None, None, self.now(), keep=versions_keep(conn))
                if not arx:
                    self._audit_outside(conn, c, cfg, "updated", rev)
        else:
            conn.execute("UPDATE ha_config_items SET seen_at = ? WHERE kind = ? AND item_id = ?", (now, *c.key))
        conn.execute("INSERT OR IGNORE INTO automation_meta(kind, item_id, created_via, first_seen_at, last_seen_at) VALUES (?, ?, 'external', ?, ?)", (*c.key, now, now))
        conn.execute("UPDATE automation_meta SET last_seen_at = ?, gone_at = NULL WHERE kind = ? AND item_id = ?", (now, *c.key))
        return changed

    def drop(self, conn: sqlite3.Connection, kind: str, item_id: str) -> bool:
        now = self.stamp()
        cur = conn.execute("DELETE FROM ha_config_items WHERE kind = ? AND item_id = ?", (kind, item_id))
        conn.execute("UPDATE automation_meta SET gone_at = COALESCE(gone_at, ?) WHERE kind = ? AND item_id = ?", (now, kind, item_id))
        return cur.rowcount > 0

    def _arx_create_in_flight(self, conn: sqlite3.Connection) -> bool:
        cutoff = _iso(self.now() - dt.timedelta(seconds=RECENT_OP_S))
        return conn.execute("SELECT 1 FROM automation_ops WHERE op IN ('create', 'copy', 'restore') AND (status = 'pending' OR requested_at >= ?) LIMIT 1", (cutoff,)).fetchone() is not None

    def _recent_arx_op(self, conn: sqlite3.Connection, kind: str, item_id: str) -> bool:
        cutoff = _iso(self.now() - dt.timedelta(seconds=RECENT_OP_S))
        return conn.execute("SELECT 1 FROM automation_ops WHERE kind = ? AND item_id = ? AND (status = 'pending' OR requested_at >= ?) LIMIT 1", (kind, item_id, cutoff)).fetchone() is not None

    def _audit_outside(self, conn: sqlite3.Connection, c: Cand, cfg: dict[str, Any] | None, what: str, rev: str | None) -> None:
        """§10.2: a sensitive item changed or created without an Arx op. No config, no template text, no values - revisions and classes only."""
        try:
            classes = config_sensitive(c.kind, cfg)
            if not classes:
                return
            audit(conn, actor=None, action="automation.changed_outside", decision="allowed", resource_type="automation_item", resource_id=f"{c.kind}:{c.item_id}",
                  details={"kind": c.kind, "what": what, "revision_after": rev, "classes": classes})
        except Exception:  # noqa: BLE001 - an audit hiccup never blocks the mirror
            log.exception("could not audit an outside change of %s", c.item_id)

    # -- events and deferred fetches

    def on_ha_event(self, frame: dict[str, Any]) -> None:
        """A frame of one of the subscriptions: `automation_reloaded` / `scene_reloaded` (a full pull), `automation_triggered {entity_id}` / `script_started
        {entity_id}` (a run)."""
        event = frame.get("event") if isinstance(frame, dict) else None
        if not isinstance(event, dict):
            return
        etype = event.get("event_type")
        data = event.get("data") if isinstance(event.get("data"), dict) else {}
        if etype in ("automation_reloaded", "scene_reloaded"):
            self._maybe_clear_authoring_block()
            self._queue("*")
            self.flush()
        elif etype in ("automation_triggered", "script_started"):
            eid = data.get("entity_id")
            if isinstance(eid, str) and self.db is not None:
                with self.db.connection(label="automations event") as conn:
                    if feature_on(conn):
                        note_run_for_entity(conn, eid, event.get("time_fired") or self.stamp(), "event", self.now())

    def _maybe_clear_authoring_block(self) -> None:
        """A write that never loaded blocks writing (`authoring_block`); a reload that Home Assistant announces a minute or more later is the administrator's fix
        (the include line of the file), not the failed write's own."""
        if self.db is None:
            return
        with self.db.connection(label="automations authoring block") as conn:
            st = tr.mirror_state(conn)
            at = _parse(st.get("authoring_block_at"))
            if st.get("authoring_block") and (at is None or (self.now() - at).total_seconds() >= AUTHORING_RETRY_S):
                st["authoring_block"], st["authoring_block_at"] = None, None
                self._save(conn, st)

    def on_entity_state(self, conn: sqlite3.Connection, row: dict[str, Any], old_state: dict[str, Any] | None) -> None:
        """An automation / script / scene state was mirrored (inside `handle_state_event`'s transaction: nothing here talks to HA). A new entity queues a fetch;
        `last_triggered` moving is a run; a state or `current` change tells the clients."""
        if not feature_on(conn):
            return
        eid = row["entity_id"]
        domain = eid.split(".", 1)[0]
        cached = conn.execute("SELECT kind, item_id FROM ha_config_items WHERE entity_id = ?", (eid,)).fetchone()
        if cached is None:
            self._queue("*")
            return
        attrs, old_attrs = row.get("attributes") or {}, (old_state or {}).get("attributes") or {}
        lt = attrs.get("last_triggered")
        if lt and lt != old_attrs.get("last_triggered") and old_state is not None:
            note_run_for_entity(conn, eid, lt, "event", self.now())
        if row.get("state") != (old_state or {}).get("state") or attrs.get("current") != old_attrs.get("current") or lt != old_attrs.get("last_triggered"):
            publish([domain])

    def _queue(self, key: str) -> None:
        with self._lock:
            self._pending.add(key)
            if self.debounce_s > 0 and self._timer is None:
                self._timer = threading.Timer(self.debounce_s, self._timer_fire)
                self._timer.daemon = True
                self._timer.start()

    def flush(self) -> None:
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
            self.pull(None, "event")
        except Exception:  # noqa: BLE001
            log.exception("deferred automations refresh failed")


MIRROR = Mirror()
_STORM_AUDITED: dict[str, dt.datetime] = {}  # item -> when its storm was last audited (one audit row per window)


def publish(kinds: list[str]) -> None:
    ha_sync.publish({"type": "automations_changed", "kinds": sorted(set(kinds)), "ids": []})


def stamp() -> str:
    return MIRROR.stamp()


# ================================================================ cache accessors

def cache_rows(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM ha_config_items ORDER BY kind, item_id").fetchall()


def cache_row(conn: sqlite3.Connection, kind: str, item_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM ha_config_items WHERE kind = ? AND item_id = ?", (kind, item_id)).fetchone()


def row_config(row: sqlite3.Row) -> dict[str, Any] | None:
    try:
        cfg = json.loads(row["config_json"]) if row["config_json"] else None
    except ValueError:
        cfg = None
    return cfg if isinstance(cfg, dict) else None


def meta_rows(conn: sqlite3.Connection) -> dict[tuple[str, str], sqlite3.Row]:
    return {(r["kind"], r["item_id"]): r for r in conn.execute("SELECT * FROM automation_meta").fetchall()}


def versions_keep(conn: sqlite3.Connection) -> int:
    from .automation_settings import stored

    return stored("automations.versions_keep", get_setting(conn, "automations.versions_keep", "20"))


def note_version(conn: sqlite3.Connection, kind: str, item_id: str, rev: str, blob: str | None, masked: int, via: str, actor: str | None, actor_username: str | None, now: dt.datetime,
                 *, keep: int = 20) -> None:
    """A revision seen: one row per (item, revision); the oldest beyond `keep` go (the current one always stays)."""
    if blob is None:
        return
    conn.execute("INSERT INTO automation_versions(kind, item_id, revision, config_json, masked, seen_at, via, actor, actor_username) VALUES (?,?,?,?,?,?,?,?,?) "
                 "ON CONFLICT(kind, item_id, revision) DO UPDATE SET via = CASE WHEN excluded.via = 'arx' THEN 'arx' ELSE via END, actor = COALESCE(excluded.actor, actor), "
                 "actor_username = COALESCE(excluded.actor_username, actor_username)",
                 (kind, item_id, rev, blob, masked, _iso(now), via, actor, actor_username))
    conn.execute("DELETE FROM automation_versions WHERE kind = ? AND item_id = ? AND id NOT IN (SELECT id FROM automation_versions WHERE kind = ? AND item_id = ? ORDER BY id DESC LIMIT ?)",
                 (kind, item_id, kind, item_id, keep))


def note_arx_write(conn: sqlite3.Connection, kind: str, item_id: str, principal: Any, *, created: bool = False) -> None:
    now = stamp()
    conn.execute("INSERT OR IGNORE INTO automation_meta(kind, item_id, created_via, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?)", (kind, item_id, "arx" if created else "external", now, now))
    if created:
        conn.execute("UPDATE automation_meta SET created_via = 'arx', created_by = ?, created_by_username = ?, created_at = ? WHERE kind = ? AND item_id = ?", (principal.user_id, principal.username, now, kind, item_id))
    conn.execute("UPDATE automation_meta SET updated_by = ?, updated_by_username = ?, updated_at = ?, gone_at = NULL WHERE kind = ? AND item_id = ?", (principal.user_id, principal.username, now, kind, item_id))


def refresh_entity_state(conn: sqlite3.Connection, entity_id: str | None) -> None:
    """After a write: the entity's fresh state into the mirror (HA's `state_changed` arrives a moment later; a response must not wait for it)."""
    if not entity_id:
        return
    try:
        st = tr.get_transport().state(entity_id)
    except ApiError:
        return
    if isinstance(st, dict) and st.get("entity_id") == entity_id:
        ha_sync.upsert_state(conn, st)


# ================================================================ runs (events and traces)

def note_run_for_entity(conn: sqlite3.Connection, entity_id: str, at_raw: Any, source: str, now: dt.datetime) -> None:
    row = conn.execute("SELECT kind, item_id FROM ha_config_items WHERE entity_id = ?", (entity_id,)).fetchone()
    if row is None:
        return
    at = _parse(str(at_raw)) or now
    stamp_s = _iso(at)
    run_id = "ev" + hashlib.sha1(f"{row['kind']}|{row['item_id']}|{stamp_s}".encode("utf-8")).hexdigest()[:14]
    cur = conn.execute("INSERT OR IGNORE INTO automation_runs(id, kind, item_id, at, source) VALUES (?,?,?,?,?)", (run_id, row["kind"], row["item_id"], stamp_s, source))
    if cur.rowcount:
        storm_check(conn, row["kind"], row["item_id"], now)
        publish([row["kind"]])


def storm_check(conn: sqlite3.Connection, kind: str, item_id: str, now: dt.datetime) -> str | None:
    """§9.4 runtime guard: more than `storm_item_per_min` runs of one item (or `storm_total_per_min` in total) in the last minute is audited ONCE per window
    (`automation.storm`, no values); the administrator's review list shows it. Auto-disable is slice C (the setting is stored, nothing is switched off here)."""
    from .automation_settings import stored

    limits = stored("automations.limits", get_setting(conn, "automations.limits", "{}"))
    since = _iso(now - dt.timedelta(minutes=1))
    n_item = conn.execute("SELECT COUNT(*) FROM automation_runs WHERE kind = ? AND item_id = ? AND at >= ?", (kind, item_id, since)).fetchone()[0]
    n_all = conn.execute("SELECT COUNT(*) FROM automation_runs WHERE at >= ?", (since,)).fetchone()[0]
    which = "item" if n_item > limits["storm_item_per_min"] else ("total" if n_all > limits["storm_total_per_min"] else None)
    if which is None:
        return None
    key = f"{kind}:{item_id}:{which}"
    last = _STORM_AUDITED.get(key)
    if last is None or (now - last).total_seconds() >= 60:
        _STORM_AUDITED[key] = now
        audit(conn, actor=None, action="automation.storm", decision="allowed", resource_type="automation_item", resource_id=f"{kind}:{item_id}",
              details={"kind": kind, "scope": which, "runs_last_minute": n_item if which == "item" else n_all})
    return which


def runs_summary(conn: sqlite3.Connection, now: dt.datetime) -> dict[tuple[str, str], dict[str, Any]]:
    """(kind, item_id) -> {last_at, last_result, n7}: the list's last run and 7-day count."""
    since = _iso(now - dt.timedelta(days=7))
    out: dict[tuple[str, str], dict[str, Any]] = {}
    for r in conn.execute("SELECT kind, item_id, MAX(at) AS last_at, COUNT(DISTINCT at) AS n FROM automation_runs WHERE at >= ? GROUP BY kind, item_id", (since,)).fetchall():
        res = conn.execute("SELECT result FROM automation_runs WHERE kind = ? AND item_id = ? AND at = ? ORDER BY source DESC LIMIT 1", (r["kind"], r["item_id"], r["last_at"])).fetchone()
        out[(r["kind"], r["item_id"])] = {"last_at": r["last_at"], "last_result": res["result"] if res else None, "n7": r["n"]}
    return out


# ================================================================ housekeeping

def janitor(db: Database, settings: dict[str, Any]) -> dict[str, int]:
    """The janitor pass: expired trash, runs and ops past their retention, trash claims nothing finished. No Home Assistant call."""
    out = {"trash": 0, "runs": 0, "ops": 0}
    with db.connection(label="automations janitor") as conn:
        now = MIRROR.now()
        out["trash"] = conn.execute("DELETE FROM automation_trash WHERE expires_at <= ?", (_iso(now),)).rowcount
        out["runs"] = conn.execute("DELETE FROM automation_runs WHERE at < ?", (_iso(now - dt.timedelta(days=RUN_KEEP_DAYS)),)).rowcount
        out["ops"] = conn.execute("DELETE FROM automation_ops WHERE requested_at < ? AND status != 'pending'", (_iso(now - dt.timedelta(days=OP_KEEP_DAYS)),)).rowcount
        conn.execute("UPDATE automation_trash SET restored_at = NULL WHERE restored_at LIKE '~%' AND substr(restored_at, instr(restored_at, ':') + 1) < ?", (_iso(now - dt.timedelta(hours=1)),))
    return out
