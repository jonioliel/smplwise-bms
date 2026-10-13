"""CR-038 slice 4, spec 10.2 (owner decision D5): the life of a handler link on the manager's side - minting, the sliding expiry
with its cap, the read-only grace after close, revocation, a new generation, and what the ticket page shows about the link.

Rules (spec 10.2):
- durations: `links.sliding_days` (1-90, default 14), `links.cap_days` (7-365, default 90, never below the sliding window),
  `links.grace_hours` (0-168, default 24) from `tickets.settings`, each overridable per department (NULL = installation);
- at mint: cap_at = now + cap_days; expires_at = min(cap_at, now + max(sliding_days, resolve_within(priority) + 1 day)) - the first
  expiry always covers the priority's resolve window (review C10); an empty resolve threshold counts as 0;
- sliding: an action of the handler through the link, a manager's resend and a reminder move expires_at to
  min(cap_at, now + sliding_days), never backwards; opening the page alone never extends it;
- close / cancel: grace_until = now + grace_hours (read-only page); grace 0 revokes at once;
- revoked at once (no grace): reassign, return / "לא שלי", manual revoke, key rotation, a contact's phone / e-mail change, a
  contact's erase, a new generation (the old token dies by the hash change);
- a LOWER cap setting pulls the cap (and the expiry) of live links in at once; a higher one applies to new links only.
Tokens are derived, never stored (links.derive_token under the link's key, `ticket_links.key_id`)."""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Any

from . import links, settings_doc, store_links
from .keyring import KEYS

SLIDING_RANGE = (1, 90)
CAP_RANGE = (7, 365)
GRACE_RANGE = (0, 168)
UTC = dt.timezone.utc


def now_utc() -> dt.datetime:
    return dt.datetime.now(UTC).replace(microsecond=0)


def iso(at: dt.datetime) -> str:
    return at.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return None


@dataclass(frozen=True)
class Durations:
    sliding_days: int
    cap_days: int
    grace_hours: int


def _bounded(value: Any, lo: int, hi: int) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int) or not lo <= value <= hi:
        return None
    return value


def durations(conn, department_id: str | None) -> Durations:
    """The effective D5 durations of a department: its override when set and in range, else the installation's value."""
    doc = settings_doc.read(conn)["links"]
    dept = store_links.department_link_overrides(conn, department_id) if department_id else None
    sliding = (_bounded(dept["link_sliding_days"], *SLIDING_RANGE) if dept else None) or doc["sliding_days"]
    cap = (_bounded(dept["link_cap_days"], *CAP_RANGE) if dept else None) or doc["cap_days"]
    grace = _bounded(dept["link_grace_hours"], *GRACE_RANGE) if dept else None
    if grace is None:
        grace = doc["grace_hours"]
    return Durations(sliding_days=sliding, cap_days=max(cap, sliding), grace_hours=grace)


def resolve_window_min(conn, department_id: str, priority_id: str) -> int:
    value = store_links.resolve_within_min(conn, department_id, priority_id)
    return int(value) if isinstance(value, int) and value > 0 else 0


def first_expiry(now: dt.datetime, d: Durations, resolve_min: int) -> tuple[dt.datetime, dt.datetime]:
    """(expires_at, cap_at) of a new link or a new generation."""
    cap = now + dt.timedelta(days=d.cap_days)
    window = max(dt.timedelta(days=d.sliding_days), dt.timedelta(minutes=resolve_min) + dt.timedelta(days=1))
    return min(cap, now + window), cap


# ---------------------------------------------------------------- public address / readiness


def public_base_url(conn) -> str:
    return settings_doc.read(conn)["public"]["base_url"]


def handler_url(conn, link_row: dict[str, Any]) -> str:
    """The URL of a live link (the token in the fragment). Raises links.PublicUrlError when no public address is configured and
    ModuleKeyError when the key the row names is missing."""
    token = links.derive_token(KEYS.get(link_row["key_id"]), link_row["id"], int(link_row["generation"]))
    return links.handler_url(public_base_url(conn), token)


# ---------------------------------------------------------------- mint, revoke, extend, grace, new generation


def mint(conn, *, ticket: dict[str, Any], assignment_id: str, contact_id: str, require_code: bool, now: dt.datetime) -> dict[str, Any]:
    """A new link (generation 1) for an external assignment, under the current module key (minted only by the "module on" path -
    keyring.py, W12; a missing key here is ModuleKeyError). Returns the row; the token is derived again whenever it is needed."""
    key_id, key = KEYS.current(create=False)
    link_id = links.new_link_id()
    token = links.derive_token(key, link_id, 1)
    d = durations(conn, ticket["department_id"])
    expires, cap = first_expiry(now, d, resolve_window_min(conn, ticket["department_id"], ticket["priority_id"]))
    row = {"id": link_id, "ticket_id": ticket["id"], "assignment_id": assignment_id, "contact_id": contact_id, "generation": 1,
           "key_id": key_id, "token_hash": links.token_hash(token), "require_code": 1 if require_code else 0, "sent_via": None,
           "created_at": iso(now), "expires_at": iso(expires), "cap_at": iso(cap), "open_count": 0, "update_count": 0}
    store_links.insert_link(conn, row)
    return store_links.link(conn, link_id) or row


def revoke(conn, link_row: dict[str, Any] | None, reason: str, at: dt.datetime) -> bool:
    """Revoked at once; its code sessions die with it (a new generation also kills them). True when this call revoked it."""
    if not link_row:
        return False
    done = store_links.revoke_link(conn, link_row["id"], reason, iso(at))
    if done:
        store_links.drop_sessions(conn, link_row["id"])
    return done


def revoke_for_assignment(conn, assignment_id: str | None, reason: str, at: dt.datetime) -> dict[str, Any] | None:
    row = store_links.link_for_assignment(conn, assignment_id)
    if row and revoke(conn, row, reason, at):
        return row
    return None


def on_final(conn, ticket_id: str, assignment_id: str | None, to_status: str, department_id: str, at: dt.datetime) -> None:
    """Close / cancel of a ticket: the link of the assignment that was current gets the read-only grace (D5); with a grace of 0
    hours it is revoked at once. Every other live link of the ticket (none should exist) is revoked."""
    grace_h = durations(conn, department_id).grace_hours
    for row in store_links.links_of_ticket(conn, ticket_id):
        if row["revoked_at"]:
            continue
        if row["assignment_id"] == assignment_id and grace_h > 0:
            store_links.update_link(conn, row["id"], {"grace_until": iso(at + dt.timedelta(hours=grace_h))})
        else:
            revoke(conn, row, "cancelled" if to_status == "cancelled" else "closed", at)


def on_reopened(conn, ticket_id: str, at: dt.datetime) -> None:
    """A reopened ticket: a link still in its read-only grace is dead now (the page must never show "closed, thank you" for an
    open ticket; a reassignment mints a new link)."""
    for row in store_links.links_of_ticket(conn, ticket_id):
        if not row["revoked_at"]:
            revoke(conn, row, "closed", at)


def extend(conn, link_id: str, department_id: str, at: dt.datetime) -> None:
    d = durations(conn, department_id)
    store_links.extend_link(conn, link_id, iso(at + dt.timedelta(days=d.sliding_days)))


def new_generation(conn, link_row: dict[str, Any], ticket: dict[str, Any], at: dt.datetime) -> dict[str, Any]:
    """"קישור חדש": generation + 1 under the CURRENT key, a new cap and first expiry, every earlier token, code session and code
    of the link dead (codes and their windows are generation-scoped; the old sessions are deleted here)."""
    key_id, key = KEYS.current(create=False)
    gen = int(link_row["generation"]) + 1
    token = links.derive_token(key, link_row["id"], gen)
    d = durations(conn, ticket["department_id"])
    expires, cap = first_expiry(at, d, resolve_window_min(conn, ticket["department_id"], ticket["priority_id"]))
    store_links.update_link(conn, link_row["id"], {
        "generation": gen, "key_id": key_id, "token_hash": links.token_hash(token), "expires_at": iso(expires), "cap_at": iso(cap),
        "grace_until": None, "revoked_at": None, "revoked_reason": None,
    })
    store_links.drop_sessions(conn, link_row["id"])
    return store_links.link(conn, link_row["id"]) or link_row


def pull_in_caps(conn, cap_days: int, *, department_id: str | None = None) -> int:
    """A LOWER cap: every live link of the affected tickets gets cap_at = min(cap_at, created_at + cap_days) at once. With
    `department_id` None: the departments that use the installation value."""
    pulls: dict[str, str] = {}
    for row in store_links.live_links(conn):
        dept = store_links.ticket_department_cap(conn, row["ticket_id"])
        if dept is None:
            continue
        if department_id is not None and dept["department_id"] != department_id:
            continue
        if department_id is None and _bounded(dept["link_cap_days"], *CAP_RANGE) is not None:
            continue  # a department with its own cap keeps it
        created = parse(row["created_at"])
        if created is None:
            continue
        pulls[row["id"]] = iso(created + dt.timedelta(days=cap_days))
    return store_links.pull_in_caps(conn, pulls)


# ---------------------------------------------------------------- state, and what the ticket page shows


def state(row: dict[str, Any], now: dt.datetime) -> str:
    """live | grace | expired | revoked (the manager's view of one link row)."""
    if row.get("revoked_at"):
        return "revoked"
    expires = min(parse(row["expires_at"]) or now, parse(row["cap_at"]) or now)
    if expires <= now:
        return "expired"
    grace = parse(row.get("grace_until"))
    if grace is not None:
        return "grace" if grace > now else "expired"
    return "live"


def link_block(conn, ticket: dict[str, Any], *, manager: bool, external: bool, now: dt.datetime | None = None) -> dict[str, Any] | None:
    """The link of the ticket's current (or last) external assignment for a manager - never the token or the URL (the copy route
    returns it once, audited). None for everyone else and for tickets that never went outside."""
    if not manager:
        return None
    row = store_links.link_for_assignment(conn, ticket.get("current_assignment_id")) or store_links.latest_link_of_ticket(conn, ticket["id"])
    if row is None:
        return None
    now = now or now_utc()
    st = state(row, now)
    current = row["assignment_id"] == ticket.get("current_assignment_id") and ticket.get("status") not in ("closed", "cancelled")
    locked = bool(store_links.locked_links(conn, [row["id"]], iso(now)))
    return {
        "state": st,
        "current": current,
        "generation": int(row["generation"]),
        "created_at": row["created_at"],
        "expires_at": min(row["expires_at"], row["cap_at"]),
        "cap_at": row["cap_at"],
        "grace_until": row.get("grace_until"),
        "revoked_at": row.get("revoked_at"),
        "revoked_reason": row.get("revoked_reason"),
        "sent_via": row.get("sent_via"),
        "first_opened_at": row.get("first_opened_at"),
        "last_opened_at": row.get("last_opened_at"),
        "open_count": int(row.get("open_count") or 0),
        "devices": store_links.access_devices(conn, row["id"]),
        "update_count": int(row.get("update_count") or 0),
        "require_code": bool(row["require_code"]),
        "code_locked": locked,
        "can": {
            "copy": external and current and st == "live",
            "new": external and current and st in ("live", "expired", "revoked") and row.get("revoked_reason") not in ("contact_erased", "module_key"),
            "revoke": current and st in ("live", "grace"),
            "resend": False,  # slice 5b: no message channel exists yet - the manager copies the link
        },
    }
