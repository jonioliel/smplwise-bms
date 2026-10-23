"""CR-WA-PACING-295 (owner decisions 2026-10-24): the WhatsApp send policy that sits beside the pacing budget.

Two installation settings, both editable in Settings > messaging channel (setting `messaging.wa_policy`, kept out of project backups):

- the ALLOW-LIST of every handler and provider who may receive WhatsApp from the add-on. Entries are stored as the messaging key's HMAC of the
  number (the same recipient key the send ledger uses) plus a label, a role and the last four digits - never the number. When `enforce` is on, a
  send to a number that is not on the list ends `not_sent` with code `recipient_not_allowed` (never dropped silently: the module's normal
  not-sent path and an audit row `messaging.whatsapp.recipient_blocked` record it). `enforce` is OFF by default so an existing installation
  keeps sending until the administrator has filled the list.
- the SELF-MESSAGES test window: a timed switch (1-240 minutes) that auto-expires. Arx cannot change the home system's integration, so this is
  the record of the window the administrator opened there: while it is active the screen says so and when it ends; at the end it switches
  itself off and leaves an audit row. Outside a window `self_messages` is expected OFF.

Interactive buttons stay off elsewhere (channel_whatsapp); nothing here changes that. The pacing numbers (hour / day) are the account's own
`Pacing` (messaging_accounts), 100 an hour and 600 a day by default, editable in the account's pacing.
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import re
import secrets
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Mapping

log = logging.getLogger(__name__)
UTC = dt.timezone.utc

SETTING_KEY = "messaging.wa_policy"
ROLES = ("handler", "provider", "other")
MAX_ENTRIES = 500
LABEL_MAX = 80
SELF_MINUTES_RANGE = (1, 240)
SELF_MINUTES_DEFAULT = 30
BLOCKED_CODE = "recipient_not_allowed"
KEY_RE = re.compile(r"^[0-9a-f]{16,128}$")
ID_RE = re.compile(r"^[a-z0-9]{6,24}$")
LAST4_RE = re.compile(r"^\d{4}$")


@dataclass(frozen=True)
class AllowEntry:
    id: str
    label: str
    role: str
    key: str = field(repr=False)
    last4: str | None


@dataclass(frozen=True)
class WaPolicy:
    enforce: bool = False
    allow: tuple[AllowEntry, ...] = ()
    self_until: dt.datetime | None = None

    def keys(self) -> frozenset[str]:
        return frozenset(e.key for e in self.allow)

    def self_active(self, now: dt.datetime) -> bool:
        return self.self_until is not None and now < self.self_until


def _parse_time(v: Any) -> dt.datetime | None:
    if not isinstance(v, str):
        return None
    try:
        t = dt.datetime.fromisoformat(v)
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=UTC)


def parse(raw: Any) -> WaPolicy:
    """Total and forgiving: anything unusable is the default (enforcement off, empty list, no window)."""
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except ValueError:
            raw = None
    if not isinstance(raw, Mapping):
        return WaPolicy()
    entries: list[AllowEntry] = []
    seen: set[str] = set()
    for e in raw.get("allow") if isinstance(raw.get("allow"), list) else []:
        if not isinstance(e, Mapping):
            continue
        key, eid = e.get("key"), e.get("id")
        if not (isinstance(key, str) and KEY_RE.match(key) and isinstance(eid, str) and ID_RE.match(eid)) or key in seen:
            continue
        seen.add(key)
        label = e.get("label") if isinstance(e.get("label"), str) else ""
        last4 = e.get("last4") if isinstance(e.get("last4"), str) and LAST4_RE.match(e["last4"]) else None
        entries.append(AllowEntry(eid, label[:LABEL_MAX], e.get("role") if e.get("role") in ROLES else "other", key, last4))
    return WaPolicy(enforce=raw.get("enforce") is True, allow=tuple(entries[:MAX_ENTRIES]), self_until=_parse_time(raw.get("self_until")))


def to_json(p: WaPolicy) -> dict[str, Any]:
    return {"enforce": p.enforce, "allow": [{"id": e.id, "label": e.label, "role": e.role, "key": e.key, "last4": e.last4} for e in p.allow],
            "self_until": p.self_until.astimezone(UTC).isoformat() if p.self_until else None}


def load(conn: sqlite3.Connection) -> WaPolicy:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (SETTING_KEY,)).fetchone()
    return parse(row[0] if row else None)


def store(conn: sqlite3.Connection, p: WaPolicy) -> None:
    conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                 (SETTING_KEY, json.dumps(to_json(p), separators=(",", ":"))))


# ---------------------------------------------------------------- pure edits (each returns the new policy and a list of problems)

Problems = list[dict[str, str]]


def with_enforce(p: WaPolicy, enforce: bool) -> WaPolicy:
    return WaPolicy(enforce=enforce, allow=p.allow, self_until=p.self_until)


def with_entry(p: WaPolicy, *, key: str, digits: str, label: str, role: str, entry_id: str | None = None) -> tuple[WaPolicy, Problems]:
    problems: Problems = []
    label = " ".join(str(label or "").split())[:LABEL_MAX]
    if not label:
        problems.append({"code": "label_required", "field": "label"})
    if role not in ROLES:
        problems.append({"code": "role_unknown", "field": "role"})
    if any(e.key == key for e in p.allow):
        problems.append({"code": "already_listed", "field": "phone"})
    if len(p.allow) >= MAX_ENTRIES:
        problems.append({"code": "list_full", "field": "phone"})
    if problems:
        return p, problems
    entry = AllowEntry(entry_id or secrets.token_hex(6), label, role, key, digits[-4:])
    return WaPolicy(p.enforce, p.allow + (entry,), p.self_until), []


def without_entry(p: WaPolicy, entry_id: str) -> tuple[WaPolicy, Problems]:
    if not any(e.id == entry_id for e in p.allow):
        return p, [{"code": "not_found", "field": "id"}]
    return WaPolicy(p.enforce, tuple(e for e in p.allow if e.id != entry_id), p.self_until), []


def with_self_window(p: WaPolicy, minutes: int | None, now: dt.datetime) -> tuple[WaPolicy, Problems]:
    """`minutes` None = switch off now; otherwise open (or restart) a window of that many minutes."""
    if minutes is None:
        return WaPolicy(p.enforce, p.allow, None), []
    if isinstance(minutes, bool) or not isinstance(minutes, int) or not SELF_MINUTES_RANGE[0] <= minutes <= SELF_MINUTES_RANGE[1]:
        return p, [{"code": "out_of_range", "field": "minutes"}]
    return WaPolicy(p.enforce, p.allow, now + dt.timedelta(minutes=minutes)), []


def view(p: WaPolicy, now: dt.datetime, can_manage: bool) -> dict[str, Any]:
    return {"enforce": p.enforce, "can_manage": can_manage, "max_entries": MAX_ENTRIES,
            "allow": [{"id": e.id, "label": e.label, "role": e.role, "last4": e.last4} for e in p.allow],
            "self_messages": {"active": p.self_active(now), "until": p.self_until.astimezone(UTC).isoformat() if p.self_active(now) and p.self_until else None,
                              "minutes_default": SELF_MINUTES_DEFAULT, "minutes_range": list(SELF_MINUTES_RANGE)}}


def expire_window(conn: sqlite3.Connection, now: dt.datetime) -> bool:
    """A window whose time has passed switches itself off (once) and leaves an audit row. True when it did. Needs a write connection."""
    p = load(conn)
    if p.self_until is None or now < p.self_until:
        return False
    store(conn, WaPolicy(p.enforce, p.allow, None))
    from ..audit import audit

    audit(conn, actor=None, action="messaging.whatsapp.self_messages", decision="allowed", resource_type="installation", resource_id=SETTING_KEY,
          details={"state": "expired", "ended_at": p.self_until.astimezone(UTC).isoformat()})
    return True


# ---------------------------------------------------------------- the send-path guard

def guard_decision(p: WaPolicy, recipient_key: str) -> str | None:
    """None = may send; else the refusal code. With enforcement off every recipient may be sent to."""
    if not p.enforce:
        return None
    return None if recipient_key in p.keys() else BLOCKED_CODE


def make_guard(db: Any, *, key_of: Callable[[Any], bytes | None] | None = None) -> Callable[[str, str | None, str | None], str | None]:
    """The hook `WhatsAppChannel` calls before every send: (digits, outbox_id, purpose) -> refusal code or None. Reads the policy on its own
    short read connection. A damaged policy row or key file must not stop alerts, so any error fails OPEN and is logged (the audit row of a
    refusal is best effort for the same reason)."""
    from . import messaging_runtime as mr

    def key_bytes() -> bytes | None:
        return mr.messaging_key(Path(db.path).parent)

    def guard(digits: str, outbox_id: str | None, purpose: str | None) -> str | None:
        try:
            if not Path(db.path).exists():  # a database that is gone (a stopped app, a finished test) has no policy
                return None
            with db.connection(mode="read", label="wa_policy.guard") as conn:
                p = load(conn)
            if not p.enforce:
                return None
            kb = (key_of or (lambda _d: key_bytes()))(db)
            if kb is None:
                return None
            rkey = mr.recipient_key(kb, digits)
            code = guard_decision(p, rkey)
        except Exception:  # noqa: BLE001 - fail open, see the docstring
            log.warning("whatsapp recipient policy unreadable; the send is not blocked", exc_info=True)
            return None
        if code is not None:
            try:
                from ..audit import audit

                with db.connection(label="wa_policy.blocked") as wconn:
                    audit(wconn, actor=None, action="messaging.whatsapp.recipient_blocked", decision="denied", resource_type="installation",
                          resource_id=outbox_id or "", reason=code, details={"purpose": purpose or "", "recipient": rkey[:12]})
            except Exception:  # noqa: BLE001
                log.warning("whatsapp recipient_blocked audit row failed")
        return code

    return guard
