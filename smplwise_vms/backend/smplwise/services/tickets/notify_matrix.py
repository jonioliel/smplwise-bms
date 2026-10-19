"""TKNOTIFMATRIX (CR-038 section 18A, "per-department notification matrix, daily digest"): which ticket event notifies, per department,
whether it goes at once, in the department's daily digest, or not at all - and through which channels.

Everything sits behind two settings that default to TODAY's behaviour (`tickets.settings` block `notify`, owner decision 1):
  - `notify.matrix_enabled` (default off): while off, `decide()` answers "now" for everything and `channels_for()` changes nothing.
    The matrix `notify.matrix` is `{department id | "*": {source: "now" | "digest" | "off"}}`; a missing cell is "now" and a
    department's own cell wins over the "*" cell, cell by cell (decision 8).
  - `notify.digest_enabled` (default off): while off a "digest" cell behaves as "now" (an event is never held for a digest that will
    not be sent), and anything still held is released at the next janitor step.

The 2.9.1 owner decisions on top of the first cut:
  2. the digest time is per department (`notify.departments[dept].digest_time`, else the installation's `notify.digest_time`, default
     08:00 in the installation time zone); every department's digest runs at its own time. An event held before today's slot goes in
     today's digest; one held after it waits for tomorrow's.
  3. the recipients are per department (`notify.departments[dept|"*"].recipients`): the department's managers (default) plus named
     users and the holders of named roles - each recipient still only for the tickets he may see (access.visible, per ticket).
  4. every matrix source may be digested, an assignee's reminder too: such an entry goes in its ASSIGNEE's own digest. Nothing is lost:
     an event that cannot be held is sent at once; a digest that cannot be created sends its events at once (the original event,
     bypassing the matrix); only when that fails too does the entry stay for the next run.
  5. urgent events - a ticket of a high / urgent priority, or an SLA crossing (`ticket.stuck`, `ticket.reminder`) - go at once whatever
     the matrix says while `notify.urgent_immediate` holds (default on); per SLA policy (department x priority) `notify.sla_urgent`
     overrides that with "immediate" or "matrix".
  6. ONE `ticket.digest` notification per recipient and department: its title / body carry counts per event type and the department
     name only (that is all a push, an e-mail or a WhatsApp message can show). The list of tickets (number, title, event) is NOT stored:
     the notification keeps ticket ids and event keys, and `detail_for()` renders the list when the recipient opens the row in the app,
     filtered by what he may see at that moment (a ticket that moved away disappears from the list).
  7. per department (and "*") a channel override {push | email | whatsapp: on | off}; absent = the source's own channel policy
     (CR-018's source x channel grid) - applied by services/notify_channels.dispatch through `channels_for()`.

The queue is the setting `tickets.notify_digest_queue` (no table); nothing here raises into a ticket action."""
from __future__ import annotations

import datetime as dt
import json
import logging
import sqlite3
import time
from typing import Any

from ...db import Database, get_setting, now_iso, set_setting
from ...rbac import Principal
from . import settings_doc, store
from .notify_sources import RULE_ASSIGNEE, SOURCE_DEFS, SUBJECT

log = logging.getLogger("smplwise.tickets.notify_matrix")

MODES = ("now", "digest", "off")
# the department-scoped ticket sources a matrix can address (installation-level and per-user ones are not departmental)
_EXCLUDED = {"ticket.channel_down", "ticket.staff_mobile", "ticket.portal_tech_request", "ticket.digest"}
MATRIX_SOURCES: tuple[str, ...] = tuple(d["key"] for d in SOURCE_DEFS
                                        if d["key"].startswith("ticket.") and d["key"] not in _EXCLUDED and d.get("subject", SUBJECT) == SUBJECT)
DIGESTABLE: frozenset[str] = frozenset(MATRIX_SOURCES)  # owner decision 4 (2.9.1): assignee sources too
ASSIGNEE_SOURCES: frozenset[str] = frozenset(d["key"] for d in SOURCE_DEFS if d["key"] in MATRIX_SOURCES and d["who"] == RULE_ASSIGNEE)
SLA_SOURCES: frozenset[str] = frozenset({"ticket.stuck", "ticket.reminder"})  # the SLA monitor's ladder: a threshold was crossed
URGENT_PRIORITY_KEYS: frozenset[str] = frozenset({"urgent", "high"})
LABELS: dict[str, str] = {d["key"]: d["label"] for d in SOURCE_DEFS}
CHANNEL_GROUPS: dict[str, tuple[str, ...]] = {"push": ("webpush", "app"), "email": ("email",), "whatsapp": ("whatsapp",)}

QUEUE_KEY = "tickets.notify_digest_queue"
QUEUE_MAX = 2000  # a full queue holds nothing more: the event goes at once (never dropped)
DETAIL_MAX = 100  # tickets listed in one digest's detail (the counts still cover all)
EVERY_S = 60
_LAST: dict[str, float] = {}
DIGEST_SOURCE = "ticket.digest"
_STAMP = "%Y-%m-%dT%H:%M:%SZ"


def _now() -> dt.datetime:
    from .. import notify

    return notify.now_utc()  # the notification engine's clock (tests replace it)


def _cfg(conn: sqlite3.Connection) -> dict[str, Any]:
    return settings_doc.read(conn)["notify"]


# ---------------------------------------------------------------- the decision for one event

def _row(row_or_dept: dict[str, Any] | str | None) -> dict[str, Any]:
    return row_or_dept if isinstance(row_or_dept, dict) else {"department_id": row_or_dept}


def is_urgent(conn: sqlite3.Connection, row: dict[str, Any], source: str) -> bool:
    """A high / urgent priority ticket, or an SLA crossing (owner decision 5)."""
    if source in SLA_SOURCES:
        return True
    prio = store.priority(conn, str(row["priority_id"])) if row.get("priority_id") else None
    return bool(prio) and prio.get("key") in URGENT_PRIORITY_KEYS  # type: ignore[union-attr]


def urgent_goes_now(conn: sqlite3.Connection, cfg: dict[str, Any], row: dict[str, Any], source: str) -> bool:
    """Whether this event bypasses the matrix: urgent, and its SLA policy (department x priority) says "immediate" - or says nothing
    and the installation's `urgent_immediate` holds."""
    if not is_urgent(conn, row, source):
        return False
    over = cfg["sla_urgent"].get(f"{row.get('department_id') or ''}/{row.get('priority_id') or ''}")
    if over in ("immediate", "matrix"):
        return over == "immediate"
    return bool(cfg["urgent_immediate"])


def decide(conn: sqlite3.Connection, row: dict[str, Any] | str | None, source: str) -> str:
    """"now" | "digest" | "off" for one event of a ticket row (a bare department id is accepted: no priority, so never urgent unless an
    SLA source). Anything unusual (matrix off, unknown source, corrupt cell, a read error) reads as "now"."""
    try:
        cfg = _cfg(conn)
        if not cfg["matrix_enabled"] or source not in MATRIX_SOURCES:
            return "now"
        r = _row(row)
        matrix = cfg["matrix"]
        mode = (matrix.get(str(r.get("department_id") or "")) or {}).get(source) or (matrix.get("*") or {}).get(source) or "now"
        if mode not in MODES or mode == "now":
            return "now"
        if urgent_goes_now(conn, cfg, r, source):
            return "now"
        if mode == "digest" and (not cfg["digest_enabled"] or source not in DIGESTABLE):
            return "now"
        return mode
    except Exception:  # noqa: BLE001 - fail safe: today's behaviour
        log.warning("notification matrix read failed", exc_info=True)
        return "now"


# ---------------------------------------------------------------- the per-department settings (inherit "*" field by field)

def department_cfg(cfg: dict[str, Any], dept_id: str) -> dict[str, Any]:
    """The effective digest time, recipients and channel override of one department."""
    deps = cfg.get("departments") or {}
    own, star = deps.get(dept_id) or {}, deps.get("*") or {}
    rec = own.get("recipients") or star.get("recipients") or {"managers": True, "users": [], "roles": []}
    channels = {**(star.get("channels") or {}), **(own.get("channels") or {})}
    return {"digest_time": own.get("digest_time") or cfg["digest_time"], "recipients": rec, "channels": channels}


def channels_for(conn: sqlite3.Connection, n: dict[str, Any], channels: dict[str, Any], available: set[str] | frozenset[str]) -> dict[str, Any]:
    """services/notify_channels.dispatch: the channels of one ticket notification after its department's override (decision 7). An
    "on" turns on only a channel this installation has; anything unusual returns the policy's channels unchanged."""
    try:
        if not str(n.get("source") or "").startswith("ticket."):
            return channels
        cfg = _cfg(conn)
        dept = (n.get("origin") or {}).get("department_id")
        if not cfg["matrix_enabled"] or not isinstance(dept, str) or not dept:
            return channels
        over = department_cfg(cfg, dept)["channels"]
        if not over:
            return channels
        out = dict(channels)
        for group, value in over.items():
            for name in CHANNEL_GROUPS.get(group, ()):
                if value == "off":
                    out[name] = False
                elif value == "on" and name in available:
                    out[name] = True
        return out
    except Exception:  # noqa: BLE001
        log.warning("department channel override failed", exc_info=True)
        return channels


def role_members(conn: sqlite3.Connection, roles: list[str]) -> list[str]:
    """The users bound to any of `roles` now (directly or through a group), at any scope - the caller keeps only who may see the ticket."""
    if not roles:
        return []
    marks = ",".join("?" * len(roles))
    now = now_iso()
    out = [r[0] for r in conn.execute(
        f"""SELECT DISTINCT b.subject_id FROM bindings b WHERE b.subject_kind = 'user' AND b.role_id IN ({marks})
            AND b.revoked_at IS NULL AND b.effect = 'allow' AND (b.expires_at IS NULL OR b.expires_at > ?)""", (*roles, now)).fetchall()]
    out += [r[0] for r in conn.execute(
        f"""SELECT DISTINCT m.user_id FROM bindings b JOIN group_members m ON m.group_id = b.subject_id WHERE b.subject_kind = 'group'
            AND b.role_id IN ({marks}) AND b.revoked_at IS NULL AND b.effect = 'allow' AND (b.expires_at IS NULL OR b.expires_at > ?)""",
        (*roles, now)).fetchall()]
    return list(dict.fromkeys(out))


# ---------------------------------------------------------------- the queue

def _queue(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    try:
        q = json.loads(get_setting(conn, QUEUE_KEY, "[]") or "[]")
    except (ValueError, TypeError):
        return []
    if not isinstance(q, list):
        return []
    return [e for e in q if isinstance(e, dict) and all(isinstance(e.get(k), str) for k in ("t", "d", "s"))]


def _save(conn: sqlite3.Connection, q: list[dict[str, Any]]) -> None:
    set_setting(conn, QUEUE_KEY, json.dumps(q, ensure_ascii=False, separators=(",", ":")))


def _same(e: dict[str, Any], ticket_id: str, source: str, user: Any) -> bool:
    return e["t"] == ticket_id and e["s"] == source and (e.get("o") or {}).get("user_id") == user


def enqueue(conn: sqlite3.Connection, row: dict[str, Any], source: str, *, dedupe: str = "", severity: str | None = None,
            origin: dict[str, Any] | None = None, values: dict[str, Any] | None = None) -> bool:
    """Hold one event for the digest - one entry per ticket, source and (for an assignee source) assignee; with what is needed to send
    it at once later if the digest fails. False = could not hold it (the caller sends it at once)."""
    try:
        q = _queue(conn)
        o = {k: v for k, v in (origin or {}).items() if isinstance(v, (str, int, bool)) or v is None}
        if any(_same(e, row["id"], source, o.get("user_id")) for e in q):
            return True
        if len(q) >= QUEUE_MAX:
            return False
        v = {k: str(x) for k, x in (values or {}).items() if isinstance(x, (str, int))}
        q.append({"t": row["id"], "d": row["department_id"], "s": source, "at": _now().strftime(_STAMP), "k": dedupe, "sev": severity,
                  "o": o, "v": v})
        _save(conn, q)
        return True
    except Exception:  # noqa: BLE001
        log.warning("digest enqueue failed", exc_info=True)
        return False


def pending(conn: sqlite3.Connection) -> int:
    return len(_queue(conn))


def pending_by_department(conn: sqlite3.Connection) -> dict[str, int]:
    out: dict[str, int] = {}
    for e in _queue(conn):
        out[e["d"]] = out.get(e["d"], 0) + 1
    return out


# ---------------------------------------------------------------- the digest

def _digest_text(conn: sqlite3.Connection, dept_name: str, counts: dict[str, int]) -> tuple[str, str]:
    from . import notify_bridge as nb

    total = sum(counts.values())
    parts = [f"{n} {LABELS.get(s, s)}" for s, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))][:5]
    title = nb.text(conn, "תקציר {ticket}: {n} אירועים", n=total)
    body = " · ".join([dept_name, *parts]) if dept_name else " · ".join(parts)
    return title, body


def _emit_digest(conn: sqlite3.Connection, dept_id: str, uid: str, items: list[dict[str, Any]], slot_key: str) -> bool:
    """One `ticket.digest` for one recipient. The previous open digest of the same department and recipient is resolved (one live row)."""
    from .. import notify
    from . import notify_bridge as nb

    counts: dict[str, int] = {}
    for e in items:
        counts[e["s"]] = counts.get(e["s"], 0) + 1
    dept = store.department_any(conn, dept_id) or {}
    title, body = _digest_text(conn, str(dept.get("name") or ""), counts)
    prefix = f"ticket-digest:{dept_id}:{uid}:"
    key = prefix + slot_key
    for old in store.open_notification_keys(conn, prefix):
        if old != key:
            nb.resolve(conn, DIGEST_SOURCE, old)
    first = items[0]["t"]
    try:
        res = notify.emit_full(conn, notify.Signal(
            source=DIGEST_SOURCE, subject_kind=SUBJECT, subject_id=first, severity="info", dedupe_key=key,
            params={"title": title, "body": body, "total": len(items), "items": [{"t": e["t"], "s": e["s"]} for e in items[:DETAIL_MAX]]},
            link="#/tickets", origin={"ticket_id": first, "department_id": dept_id, "audience": "digest", "user_id": uid}))
    except Exception:  # noqa: BLE001
        log.warning("digest emit failed for %s", dept_id, exc_info=True)
        return False
    return res.action in ("created", "folded", "renotified")


def _flush_department(conn: sqlite3.Connection, cfg: dict[str, Any], dept_id: str, entries: list[dict[str, Any]], slot_key: str) -> tuple[int, list[dict[str, Any]]]:
    """Send the held entries of one department: a digest per recipient. Returns (digests created, entries to keep for the next run)."""
    from . import notify_bridge as nb

    rec = department_cfg(cfg, dept_id)["recipients"]
    extra = list(rec.get("users") or []) + role_members(conn, list(rec.get("roles") or []))
    per_user: dict[str, list[dict[str, Any]]] = {}
    for e in entries:
        row = nb.open_ticket(conn, e["t"])
        if row is None:
            continue  # over meanwhile: nothing to summarise
        for uid in nb.digest_audience(conn, e, row, managers=bool(rec.get("managers", True)), extra=extra):
            per_user.setdefault(uid, []).append(e)
    failed: dict[int, dict[str, Any]] = {}
    sent = 0
    for uid, items in per_user.items():
        if _emit_digest(conn, dept_id, uid, items, slot_key):
            sent += 1
        else:
            failed.update({id(e): e for e in items})
    keep = [e for e in failed.values() if not nb.emit_held(conn, e)]  # decision 4: a failed digest sends its events at once
    return sent, keep


def _at(e: dict[str, Any]) -> dt.datetime | None:
    try:
        return dt.datetime.strptime(str(e.get("at") or ""), _STAMP).replace(tzinfo=dt.timezone.utc)
    except ValueError:
        return None


def run(conn: sqlite3.Connection, now: dt.datetime | None = None) -> int:
    """One digest pass: every department whose slot (today at its digest time, local) has passed sends the entries held BEFORE that
    slot. While the matrix or the digest is off, everything still held is released at once. Returns how many digests were created."""
    from .messaging import time_zone

    q = _queue(conn)
    if not q:
        return 0
    cfg = _cfg(conn)
    now = now or _now()
    local = now.astimezone(time_zone(conn))
    release = not (cfg["matrix_enabled"] and cfg["digest_enabled"])
    by_dept: dict[str, list[dict[str, Any]]] = {}
    for e in q:
        by_dept.setdefault(e["d"], []).append(e)
    keep: list[dict[str, Any]] = []
    sent = 0
    for dept_id, items in by_dept.items():
        if release:
            due, slot_key = items, local.strftime("%Y-%m-%dT%H:%M")
        else:
            hh, mm = (int(x) for x in department_cfg(cfg, dept_id)["digest_time"].split(":"))
            slot = local.replace(hour=hh, minute=mm, second=0, microsecond=0)
            if local < slot:
                keep.extend(items)
                continue
            slot_utc = slot.astimezone(dt.timezone.utc)
            due, later = [], []
            for e in items:
                at = _at(e)
                (due if at is None or at < slot_utc else later).append(e)
            keep.extend(later)
            slot_key = slot.strftime("%Y-%m-%d")
        if due:
            n, kept = _flush_department(conn, cfg, dept_id, due, slot_key)
            sent += n
            keep.extend(kept)
    _save(conn, keep)
    return sent


def tick(db: Database, *, force: bool = False, now: dt.datetime | None = None) -> int:
    """The janitor step (every minute at most)."""
    key = str(db.path)
    mono = time.monotonic()
    if not force and mono - _LAST.get(key, -EVERY_S) < EVERY_S:
        return 0
    _LAST[key] = mono
    try:
        with db.connection(label="tickets.digest") as conn:
            from .access import module_on

            if not module_on(conn):
                return 0
            return run(conn, now)
    except Exception:  # noqa: BLE001 - a housekeeping step never fails the tick
        log.warning("ticket digest step failed", exc_info=True)
        return 0


# ---------------------------------------------------------------- the detail a recipient sees in the app

def detail_for(conn: sqlite3.Connection, principal: Principal, params: dict[str, Any]) -> dict[str, Any]:
    """notify.serialize for a `ticket.digest` row: the listed tickets the reader may see NOW (number, title, event), in the order held.
    Nothing of this is stored in the notification or sent through a channel."""
    from . import access

    items = [i for i in (params.get("items") or []) if isinstance(i, dict) and isinstance(i.get("t"), str) and isinstance(i.get("s"), str)]
    seen = access.visible_many(access.Viewer(conn, principal), [i["t"] for i in items]) if items else {}
    out: list[dict[str, Any]] = []
    for i in items:
        s = seen.get(i["t"])
        if s is None:
            continue
        out.append({"ticket_id": i["t"], "number": s.row.get("number"), "title": s.row.get("title") or "", "event": i["s"],
                    "event_label": LABELS.get(i["s"], i["s"])})
    total = params.get("total")
    return {"total": total if isinstance(total, int) else len(items), "items": out, "hidden": len(items) - len(out)}
