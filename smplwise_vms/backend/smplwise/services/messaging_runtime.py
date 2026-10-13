"""CR-038 slice 5a: services/messaging_accounts.py wired into the product - the `messaging.whatsapp` settings document, the entity
mirror (read-only), the use registry other modules join, the shared send ledger of migration 0082, the module key `k_messaging`, the
Settings view (routers/messaging_accounts.py) and the hooks slice 5b plugs its outbox into.

Nothing here writes to `ha-whatsapp` or to Home Assistant. The only Home Assistant read is the on-demand label read of a connection
entity's `phone_number` attribute (`POST /messaging/whatsapp/refresh`), of which only the last four digits are kept. Discovery
itself reads the existing `ha_entities` mirror (no new HA call). UNVERIFIED on the owner's installation until the owner-approved
read-only live check: that `ha-whatsapp` entities carry `platform = 'whatsapp'` + a `config_entry_id`, the `<entry_id>_connection`
binary sensor and its `phone_number` attribute (docs/changes/CR-038-S5A-NOTES.md).

Hooks for later slices (assign once at import / start-up; tests reset them):
- `register_uses(provider)`         another module's uses (`provider(conn) -> tuple[UseSpec, ...]`), shown while its module is on
- `register_departments(module, fn)` the per-department override rows of a module's per-department uses (`fn(conn) -> [{id, name}]`)
- `register_label_renderer(module, fn)` renders a module's use labels (tickets: the D33 name tokens)
- `QUEUED_COUNTER`  (5b)  `fn(conn, use_key, department_id | None) -> int`: queued + held rows of a use (the confirm before a move)
- `TEST_SENDER`     (5b)  `fn(conn, account_ref, digits, requested_by) -> {id, state}`: enqueue one `test` row on the outbox
- `accounts_service(db)` / `DbSendLedger(db)` / `messaging_key(data_dir)` / `recipient_key(key, digits)`: what the outbox worker uses
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import os
import secrets
import sqlite3
import threading
from dataclasses import replace
from pathlib import Path
from typing import Any, Callable, Iterable

from . import messaging_accounts as ma
from .tickets.channel import CONNECTED, AccountRef, keyed_hash

log = logging.getLogger("smplwise.messaging")
UTC = dt.timezone.utc

MANAGE = "messaging.accounts.manage"
KEY_NAME = "messaging_key"
TEST_SEND_ENV = "SW_MESSAGING_TEST_SEND"  # "1" = the owner approved live test sends (CLAUDE.md: each live action is approved)
JANITOR_EVERY = dt.timedelta(hours=1)

# one process-wide tracker: the sends-derived state and the `missing` marks are shared by the routes and the outbox worker
TRACKER = ma.SendStateTracker()

_USE_PROVIDERS: list[Callable[[sqlite3.Connection], tuple[ma.UseSpec, ...]]] = []
_DEPARTMENTS: dict[str, Callable[[sqlite3.Connection], list[dict[str, str]]]] = {}
_LABELS: dict[str, Callable[[sqlite3.Connection, str], str]] = {}
_MODULE_LABELS: dict[str, Callable[[sqlite3.Connection], str]] = {}
QUEUED_COUNTER: Callable[[sqlite3.Connection, str, str | None], int] | None = None
TEST_SENDER: Callable[[sqlite3.Connection, AccountRef, str, str], dict[str, Any]] | None = None
_janitor_at: dt.datetime | None = None
_key_lock = threading.Lock()


# ---------------------------------------------------------------- registration (other modules join here)

def register_uses(provider: Callable[[sqlite3.Connection], tuple[ma.UseSpec, ...]]) -> None:
    if provider not in _USE_PROVIDERS:
        _USE_PROVIDERS.append(provider)


def register_departments(module: str, fn: Callable[[sqlite3.Connection], list[dict[str, str]]]) -> None:
    _DEPARTMENTS[module] = fn


def register_label_renderer(module: str, fn: Callable[[sqlite3.Connection, str], str], module_label: Callable[[sqlite3.Connection], str]) -> None:
    _LABELS[module] = fn
    _MODULE_LABELS[module] = module_label


def _tickets_module_on(conn: sqlite3.Connection) -> bool:
    from .tickets import access

    return access.module_on(conn)


def _tickets_uses(conn: sqlite3.Connection) -> tuple[ma.UseSpec, ...]:
    return ma.tickets_uses(lambda: _tickets_module_on(conn))


def _tickets_departments(conn: sqlite3.Connection) -> list[dict[str, str]]:
    from .tickets import store

    return [{"id": d["id"], "name": d["name"]} for d in store.departments(conn, include_inactive=False)]


def _tickets_label(conn: sqlite3.Connection, text: str) -> str:
    from .tickets import naming

    return naming.render_for(conn, text, "he")


def _tickets_module_label(conn: sqlite3.Connection) -> str:
    return _tickets_label(conn, "{tickets}")


def _register_builtin() -> None:
    register_uses(_tickets_uses)
    register_departments("tickets", _tickets_departments)
    register_label_renderer("tickets", _tickets_label, _tickets_module_label)


_register_builtin()


def registry(conn: sqlite3.Connection) -> ma.UseRegistry:
    """The use registry of this request: every registered module's uses, their `active` bound to this connection."""
    reg = ma.UseRegistry()
    for provider in _USE_PROVIDERS:
        for spec in provider(conn):
            reg.register(spec)
    return reg


# ---------------------------------------------------------------- the settings document

def load_doc(conn: sqlite3.Connection) -> ma.MappingDoc:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (ma.SETTING_KEY,)).fetchone()
    return ma.parse_doc(row[0] if row else None)


def store_doc(conn: sqlite3.Connection, doc: ma.MappingDoc) -> None:
    conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                 (ma.SETTING_KEY, json.dumps(ma.doc_to_json(doc), ensure_ascii=False, separators=(",", ":"))))


# ---------------------------------------------------------------- the mirror and the service

def ws_connected() -> bool:
    from . import ha_sync

    return bool(ha_sync.STATE.connected)


def _ws(ws: Callable[[], bool] | None) -> Callable[[], bool]:
    return ws or (lambda: ws_connected())  # looked up at call time (tests replace ws_connected)


def service(conn: sqlite3.Connection, *, ws: Callable[[], bool] | None = None) -> ma.AccountsService:
    """The account service on one request's connection (the settings routes)."""
    return ma.AccountsService(load_doc=lambda: load_doc(conn), reader=ma.SqliteMirrorReader(conn, _ws(ws)), registry=registry(conn), tracker=TRACKER)


class DbMirrorReader:
    """`LinkedAccountsReader` for a worker thread: every call reads on its own short read connection."""

    def __init__(self, db: Any, ws: Callable[[], bool] | None = None) -> None:
        self._db = db
        self._ws = _ws(ws)

    def whatsapp_rows(self) -> list[ma.MirrorRow]:
        with self._db.connection(mode="read", label="messaging.mirror") as conn:
            return ma.SqliteMirrorReader(conn).whatsapp_rows()

    def entity_state(self, entity_id: str) -> str | None:
        with self._db.connection(mode="read", label="messaging.mirror") as conn:
            return ma.SqliteMirrorReader(conn).entity_state(entity_id)

    def ws_connected(self) -> bool:
        return bool(self._ws())


def accounts_service(db: Any, *, ws: Callable[[], bool] | None = None) -> ma.AccountsService:
    """The account service for the outbox worker (slice 5b): the document and the registry are read fresh on every call, on short
    read connections (a moved use applies to the next claim, D27)."""

    def load() -> ma.MappingDoc:
        with db.connection(mode="read", label="messaging.doc") as conn:
            return load_doc(conn)

    def live_active(key: str) -> Callable[[], bool]:
        def check() -> bool:  # the owning module's switch, read when asked (a short read connection of its own)
            with db.connection(mode="read", label="messaging.registry") as conn:
                spec = registry(conn).get(key)
                return bool(spec is not None and spec.active())

        return check

    with db.connection(mode="read", label="messaging.registry") as conn:
        specs = registry(conn).all()
    reg = ma.UseRegistry(replace(s, active=live_active(s.key)) for s in specs)
    return ma.AccountsService(load_doc=load, reader=DbMirrorReader(db, ws), registry=reg, tracker=TRACKER)


# ---------------------------------------------------------------- the ledger and the key

class DbSendLedger:
    """`messaging_accounts.SendLedger` over migration 0082 for a worker thread: each call on its own short connection (a record is
    its own small write transaction)."""

    def __init__(self, db: Any) -> None:
        self._db = db

    def record(self, *, account_key: str, use_key: str, recipient_key: str, kind: str, at: dt.datetime) -> None:
        with self._db.connection(label="messaging.ledger") as conn:
            ma.SqliteSendLedger(conn).record(account_key=account_key, use_key=use_key, recipient_key=recipient_key, kind=kind, at=at)

    def times(self, *, since: dt.datetime, account_key: str | None = None, recipient_key: str | None = None,
              kinds: Iterable[str] | None = None) -> list[dt.datetime]:
        with self._db.connection(mode="read", label="messaging.ledger") as conn:
            return ma.SqliteSendLedger(conn).times(since=since, account_key=account_key, recipient_key=recipient_key, kinds=kinds)

    def last_at(self, account_key: str) -> dt.datetime | None:
        with self._db.connection(mode="read", label="messaging.ledger") as conn:
            return ma.SqliteSendLedger(conn).last_at(account_key)

    def prune(self, before: dt.datetime) -> int:
        with self._db.connection(label="messaging.ledger") as conn:
            return ma.SqliteSendLedger(conn).prune(before)


def key_path(data_dir: Path) -> Path:
    return Path(data_dir) / "secrets" / KEY_NAME


def messaging_key(data_dir: Path, *, create: bool = True) -> bytes | None:
    """`k_messaging` (7.3A): 32 random bytes in <data>/secrets/messaging_key (mode 600, never in the database, never in a project
    backup, never in an answer) - keys the ledger's recipients so another module can use the ledger without the tickets key."""
    p = key_path(data_dir)
    with _key_lock:
        if p.exists():
            raw = p.read_bytes()
            if len(raw) != 32:
                raise RuntimeError("messaging key file is damaged")
            return raw
        if not create:
            return None
        p.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.chmod(p.parent, 0o700)
        except OSError:
            pass
        key = secrets.token_bytes(32)
        tmp = p.with_name(f".{KEY_NAME}.{secrets.token_hex(4)}.tmp")
        fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0), 0o600)
        try:
            os.write(fd, key)
            os.fsync(fd)
        finally:
            os.close(fd)
        os.replace(tmp, p)
        return key


def recipient_key(key: bytes, digits: str) -> str:
    return keyed_hash(key, digits)


def janitor(db: Any, now: dt.datetime | None = None) -> int:
    """Prune ledger rows older than `messaging_accounts.LEDGER_KEEP` (2 days). Self-throttled to hourly."""
    global _janitor_at
    now = now or dt.datetime.now(UTC)
    if _janitor_at is not None and now - _janitor_at < JANITOR_EVERY:
        return 0
    _janitor_at = now
    with db.connection(label="messaging.janitor") as conn:
        n = ma.SqliteSendLedger(conn).prune(now - ma.LEDGER_KEEP)
    if n:
        log.info("messaging ledger pruned rows=%d", n)
    return n


# ---------------------------------------------------------------- the test send switch

def test_send_enabled() -> bool:
    """The per-account test send needs the outbox (slice 5b registers TEST_SENDER) AND the owner's approval of live sends
    (environment `SW_MESSAGING_TEST_SEND=1`). Off by default: no route of this slice sends anything."""
    return TEST_SENDER is not None and os.environ.get(TEST_SEND_ENV) == "1"


# ---------------------------------------------------------------- the Settings view

def _label(conn: sqlite3.Connection, spec: ma.UseSpec) -> str:
    fn = _LABELS.get(spec.module)
    return fn(conn, spec.label_he) if fn else spec.label_he


def module_label(conn: sqlite3.Connection, module: str) -> str:
    fn = _MODULE_LABELS.get(module)
    return fn(conn) if fn else module


def queued(conn: sqlite3.Connection, use_key: str, department_id: str | None) -> int:
    if QUEUED_COUNTER is None:
        return 0
    try:
        return int(QUEUED_COUNTER(conn, use_key, department_id))
    except Exception:  # noqa: BLE001 - a count never fails the screen
        log.warning("messaging queued count failed use=%s", use_key, exc_info=True)
        return 0


def departments_of(conn: sqlite3.Connection, module: str) -> list[dict[str, str]]:
    fn = _DEPARTMENTS.get(module)
    if fn is None:
        return []
    try:
        return fn(conn)
    except sqlite3.Error:
        return []


def _iso(moment: dt.datetime | None) -> str | None:
    return moment.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z") if moment else None


def resolution_moves(conn: sqlite3.Connection, before: ma.MappingDoc, after: ma.MappingDoc, reg: ma.UseRegistry) -> list[dict[str, Any]]:
    """Every (use, department) whose resolved account changes between two documents, with the queued + held messages that would
    leave from the new account (9.9.3: shown and confirmed before saving; D27)."""
    out: list[dict[str, Any]] = []
    for spec in reg.all():
        if not spec.active():
            continue
        depts = [d["id"] for d in departments_of(conn, spec.module)] if spec.per_department else []
        b, a = ma.resolve_key(before, reg, spec.key), ma.resolve_key(after, reg, spec.key)

        def own(doc: ma.MappingDoc, dept: str) -> bool:  # the department has its own override in this document
            return bool(doc.uses.get(f"{spec.key}{ma.DEPT_SEP}{dept}"))

        if b != a:
            # the installation row moves the rows of every department that follows the installation value before the change
            total = queued(conn, spec.key, None) - sum(queued(conn, spec.key, d) for d in depts if own(before, d))
            out.append({"use": spec.key, "department_id": None, "before": b, "after": a, "count": max(total, 0)})
        for d in depts:
            bd = ma.resolve_key(before, reg, spec.key, department_id=d)
            ad = ma.resolve_key(after, reg, spec.key, department_id=d)
            if bd != ad and (own(before, d) or own(after, d)):
                out.append({"use": spec.key, "department_id": d, "before": bd, "after": ad, "count": queued(conn, spec.key, d)})
    return out


def view(conn: sqlite3.Connection, *, can_manage: bool, now: dt.datetime | None = None,
         ws: Callable[[], bool] | None = None) -> dict[str, Any]:
    """The answer of `GET /messaging/whatsapp` (9.9.3): accounts with state, last send, 24-hour sends against the daily cap and the
    uses mapped to them; the active uses with their mapping, per-department rows and queued counts; the warnings. A manual account's
    typed value (it may be a phone number) is only in the answer for holders of `messaging.accounts.manage`."""
    now = now or dt.datetime.now(UTC)
    ws = _ws(ws)
    svc = service(conn, ws=ws)
    reg = svc.registry
    doc = svc.doc()
    found = svc.discovered()
    statuses = svc.statuses()
    ledger = ma.SqliteSendLedger(conn)
    active = [s for s in reg.all() if s.active()]
    dept_rows: dict[str, list[dict[str, str]]] = {}
    for s in active:
        if s.per_department and s.module not in dept_rows:
            dept_rows[s.module] = departments_of(conn, s.module)

    # which uses point at which account (direct mappings only: an inheriting use shows as "כמו ...")
    mapped_uses: dict[str, list[str]] = {}
    for k, v in doc.uses.items():
        base = k.partition(ma.DEPT_SEP)[0]
        spec = reg.get(base)
        if v and spec is not None and spec.active():
            mapped_uses.setdefault(v, []).append(k)
    for s in active:
        if s.inherits and not doc.uses.get(s.key):
            parent = doc.uses.get(s.inherits)
            if parent:
                mapped_uses.setdefault(parent, []).append(s.key)

    keys = [a.key for a in doc.accounts] + [k for k in found if doc.account(k) is None]
    accounts = []
    for key in keys:
        acc = doc.account(key)
        st = statuses.get(key) or ma.account_status(key, doc, found, svc.reader, svc.tracker)
        entry_id = key.split(":", 1)[1] if key.startswith("entry:") else None
        pacing = acc.pacing if acc else ma.Pacing()
        last4 = acc.last4 if acc and acc.last4 else (ma.last4_of(acc.value) if acc and acc.kind == "manual" else None)
        suggested = ("וואטסאפ ····" + last4 if last4 else ma.suggest_label(entry_id, None)) if entry_id else "וואטסאפ (ידני)"
        item: dict[str, Any] = {
            "key": key, "kind": acc.kind if acc else "discovered", "label": (acc.label if acc else "") or suggested, "label_set": bool(acc and acc.label),
            "last4": last4, "state": st.state, "state_source": st.source, "in_mirror": key in found, "stored": acc is not None,
            "shared_outside": bool(acc and acc.shared_outside), "removed": bool(acc and acc.removed),
            "pacing": pacing.__dict__.copy(), "uses": sorted(mapped_uses.get(key, [])),
            "sends_24h": len(ledger.times(since=now - dt.timedelta(days=1), account_key=key)),
            "last_send_at": _iso(ledger.last_at(key)),
            "has_status_entity": bool(found[key].connection_entity_id) if key in found else bool(acc and acc.status_entity_id),
        }
        if acc is not None and acc.kind == "manual":
            item["account"] = acc.value if can_manage else None
            item["status_entity_id"] = acc.status_entity_id
            item["connected_states"] = list(acc.connected_states)
        accounts.append(item)

    uses = []
    for s in active:
        row: dict[str, Any] = {
            "key": s.key, "module": s.module, "label": _label(conn, s), "inherits": s.inherits,
            "inherits_label": _label(conn, reg.get(s.inherits)) if s.inherits and reg.get(s.inherits) else None,
            "per_department": s.per_department, "required": s.required, "value": doc.uses.get(s.key),
            "resolved": ma.resolve_key(doc, reg, s.key), "queued": queued(conn, s.key, None),
        }
        if s.per_department:
            row["departments"] = [{"id": d["id"], "name": d["name"], "value": doc.uses.get(f"{s.key}{ma.DEPT_SEP}{d['id']}"),
                                   "resolved": ma.resolve_key(doc, reg, s.key, department_id=d["id"])} for d in dept_rows.get(s.module, [])]
        uses.append(row)

    warns = ma.warnings(doc, reg, statuses, [d["id"] for rows in dept_rows.values() for d in rows])
    for a in doc.accounts:
        if a.kind == "manual" and a.value and not a.removed:
            _, w = ma.manual_value_problems(a.value, found, ma.MappingDoc(doc.revision, tuple(x for x in doc.accounts if x.key != a.key), doc.uses))
            for code in w:
                warns.append({"code": code, "account_key": a.key, "severity": "amber"})

    from .notify_settings import email_internal

    try:
        mail = email_internal(conn)
        email_ok = bool(mail.get("host") and mail.get("from"))
    except sqlite3.Error:
        email_ok = False
    required_ok = all(ma.resolve_key(doc, reg, s.key) for s in active if s.required)
    connected_any = any(statuses.get(ma.resolve_key(doc, reg, s.key) or "") and statuses[ma.resolve_key(doc, reg, s.key) or ""].state == CONNECTED
                        for s in active if s.required)
    channels = [
        {"key": "whatsapp", "state": ("active" if connected_any else "down") if active and required_ok else ("not_configured" if active else "idle")},
        {"key": "email", "state": "active" if email_ok else "not_configured"},
        {"key": "inapp", "state": "active"},
        {"key": "sms", "state": "soon"},  # D13: a future work item; shown disabled
    ]
    modules = sorted({s.module for s in reg.all()})
    return {
        "revision": doc.revision, "can_manage": can_manage, "ws_connected": bool(ws()),
        "accounts": accounts, "uses": uses, "mapping": dict(doc.uses), "warnings": warns, "channels": channels,
        "modules": {m: module_label(conn, m) for m in modules},
        "pacing_ranges": {k: list(v) for k, v in ma.PACING_RANGES.items()}, "pacing_default": ma.Pacing().__dict__.copy(),
        "test_send": {"enabled": test_send_enabled()},
    }
