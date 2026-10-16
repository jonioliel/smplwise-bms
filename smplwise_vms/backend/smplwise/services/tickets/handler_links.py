"""CR-038 slice 4, spec 10.2 (owner decision D5): the life of a handler link on the manager's side - minting, the sliding expiry
with its cap, the read-only grace after close, revocation, a new generation, and what the ticket page shows about the link.

Rules (spec 10.2):
- durations: `links.sliding_days` (1-90, default 14), `links.cap_days` (7-365, default 90, never below the sliding window),
  `links.grace_hours` (0-168, default 24) from `tickets.settings`, each overridable per department (NULL = installation) - read
  through slice 2's department policy (policy.effective), the one place that resolves them;
- at mint: cap_at = now + cap_days; expires_at = min(cap_at, now + max(sliding_days, resolve_within(priority) + 1 day)) - the first
  expiry always covers the priority's resolve window (review C10); an empty resolve threshold counts as 0;
- sliding: an action of the handler through the link, a manager's resend and a reminder move expires_at to
  min(cap_at, now + sliding_days), never backwards; opening the page alone never extends it;
- close / cancel: grace_until = now + grace_hours (read-only page); grace 0 revokes at once;
- revoked at once (no grace): reassign, return / "לא שלי", manual revoke, key rotation, a contact's phone / e-mail change, a
  contact's erase, a new generation (the old token dies by the hash change);
- a LOWER cap (installation or department) pulls the cap (and the expiry) of live links in at once, counted from the start of
  the link's current generation (`generation_at`); a higher one applies to new links only.
`sent_at` / `sent_via` say when and how the current generation first left (the manager's copy here; slice 5b's outbox through
`mark_sent`) - slice 6's "link not opened" (`link_unopened_min`) counts from `sent_at`.
Tokens are derived, never stored (links.derive_token under the link's key, `ticket_links.key_id`).

TKSTAFF1 (owner 2026-10-16, security design R5 / R6 / R7): a link has a KIND - 'external' (a vendor / contact) or 'staff' (an internal
employee's no-login link over their own assignment, services/tickets/staff_links.py). A staff link takes the installation's
`staff_links.*` durations (sliding 3 days, cap 14 days, grace 1 hour by default; no department override) and a lower STAFF cap pulls
in staff links only. Every revocation and every new generation cancels the link's queued / held messages (spec 9.2), so a message
queued before a phone change or a "new link" never leaves with a dead or superseded link."""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Any, Callable

from . import links, policy, settings_doc, store, store_links
from .keyring import KEYS

UTC = dt.timezone.utc

# Slice 5b registers the status notice to the contact whose link a manager's act ended: fn(conn, link_row, purpose, at) with purpose
# "closed" (close / cancel: the read-only grace starts) or "reassigned" (revoked at once). None = no message channel (slice 4).
NOTICE: Callable[[Any, dict[str, Any], str, dt.datetime], None] | None = None
# Slice 5b: can a message channel (WhatsApp / e-mail) carry this link's contact a resend now? None = no (the manager copies the link).
CHANNEL_OK: Callable[[Any, dict[str, Any]], bool] | None = None


def _notice(conn, row: dict[str, Any], purpose: str, at: dt.datetime) -> None:
    fn = NOTICE
    if fn is None:
        return
    try:
        fn(conn, row, purpose, at)
    except Exception:  # noqa: BLE001 - a notice never fails the manager's act
        import logging

        logging.getLogger("smplwise.tickets.links").warning("ticket notice failed purpose=%s", purpose, exc_info=True)


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


def _of_policy(p: policy.DepartmentPolicy) -> Durations:
    return Durations(sliding_days=p.link_sliding_days, cap_days=max(p.link_cap_days, p.link_sliding_days), grace_hours=p.link_grace_hours)


def durations(conn, department_id: str | None, *, installation: dict[str, Any] | None = None, kind: str = "external") -> Durations:
    """The effective D5 durations of a department (its override when set and in range, else the installation's value). TKSTAFF1: a
    staff link takes the installation's `staff_links.*` (R6) - never a department override."""
    inst = installation if installation is not None else settings_doc.read(conn)
    if kind == "staff":
        st = inst["staff_links"]
        return Durations(sliding_days=st["sliding_days"], cap_days=max(st["cap_days"], st["sliding_days"]), grace_hours=st["grace_hours"])
    dept = (store.department_any(conn, department_id) if department_id else None) or {}
    return _of_policy(policy.resolve(inst, dept))


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


def public_prefix(conn) -> str:
    """TK255: the bare path prefix the vendor URLs carry (the address's own path, else `public.path_prefix`)."""
    pub = settings_doc.read(conn)["public"]
    return links.effective_prefix(pub["base_url"], pub["path_prefix"])


def handler_url(conn, link_row: dict[str, Any]) -> str:
    """The URL of a live link (the token in the fragment). Raises links.PublicUrlError when no public address is configured and
    ModuleKeyError when the key the row names is missing."""
    token = links.derive_token(KEYS.get(link_row["key_id"]), link_row["id"], int(link_row["generation"]))
    return links.handler_url(public_base_url(conn), token, public_prefix(conn))


# ---------------------------------------------------------------- mint, revoke, extend, grace, new generation


def mint(conn, *, ticket: dict[str, Any], assignment_id: str, contact_id: str, require_code: bool, now: dt.datetime,
         kind: str = "external") -> dict[str, Any]:
    """A new link (generation 1) for an external assignment, under the current module key (minted only by the "module on" path -
    keyring.py, W12; a missing key here is ModuleKeyError). Returns the row; the token is derived again whenever it is needed."""
    key_id, key = KEYS.current(create=False)
    link_id = links.new_link_id()
    token = links.derive_token(key, link_id, 1)
    d = durations(conn, ticket["department_id"], kind=kind)
    expires, cap = first_expiry(now, d, resolve_window_min(conn, ticket["department_id"], ticket["priority_id"]))
    row = {"id": link_id, "kind": kind, "ticket_id": ticket["id"], "assignment_id": assignment_id, "contact_id": contact_id, "generation": 1,
           "key_id": key_id, "token_hash": links.token_hash(token), "require_code": 1 if require_code else 0, "sent_via": None,
           "created_at": iso(now), "generation_at": iso(now), "expires_at": iso(expires), "cap_at": iso(cap), "open_count": 0,
           "update_count": 0}
    store_links.insert_link(conn, row)
    return store_links.link(conn, link_id) or row


def revoke(conn, link_row: dict[str, Any] | None, reason: str, at: dt.datetime) -> bool:
    """Revoked at once; its code sessions die with it (a new generation also kills them). True when this call revoked it."""
    if not link_row:
        return False
    done = store_links.revoke_link(conn, link_row["id"], reason, iso(at))
    if done:
        store_links.drop_sessions(conn, link_row["id"])
        cancel_messages(conn, link_row["id"], at)
    return done


def _outbox_iso(at: dt.datetime) -> str:
    return at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"  # outbox times carry milliseconds (outbox_store.iso)


def cancel_messages(conn, link_id: str, at: dt.datetime) -> int:
    """TKSTAFF1 (R7 / spec 9.2): the link's queued / held messages are cancelled - except the "closed" / "reassigned" notices, which
    tell the holder that the link ended (queued after the revocation by _notice)."""
    return store_links.cancel_open_messages(conn, link_id, _outbox_iso(at), keep=("closed", "reassigned"))


def revoke_for_assignment(conn, assignment_id: str | None, reason: str, at: dt.datetime) -> dict[str, Any] | None:
    row = store_links.link_for_assignment(conn, assignment_id)
    if row and revoke(conn, row, reason, at):
        if reason == "reassigned":
            _notice(conn, row, "reassigned", at)  # slice 5b: "handed to someone else, your link no longer works"
        return row
    return None


def on_final(conn, ticket_id: str, assignment_id: str | None, to_status: str, department_id: str, at: dt.datetime) -> None:
    """Close / cancel of a ticket: the link of the assignment that was current gets the read-only grace (D5); with a grace of 0
    hours it is revoked at once. Every other live link of the ticket (none should exist) is revoked."""
    for row in store_links.links_of_ticket(conn, ticket_id):
        if row["revoked_at"]:
            continue
        grace_h = durations(conn, department_id, kind=row.get("kind") or "external").grace_hours
        if row["assignment_id"] == assignment_id and grace_h > 0:
            store_links.update_link(conn, row["id"], {"grace_until": iso(at + dt.timedelta(hours=grace_h))})
        else:
            revoke(conn, row, "cancelled" if to_status == "cancelled" else "closed", at)
        if row["assignment_id"] == assignment_id:
            _notice(conn, row, "closed", at)  # slice 5b: the handler of the current assignment is told (held by the send hours)


def on_reopened(conn, ticket_id: str, at: dt.datetime) -> None:
    """A reopened ticket: a link still in its read-only grace is dead now (the page must never show "closed, thank you" for an
    open ticket; a reassignment mints a new link)."""
    for row in store_links.links_of_ticket(conn, ticket_id):
        if not row["revoked_at"]:
            revoke(conn, row, "closed", at)


def extend(conn, link_id: str, department_id: str, at: dt.datetime) -> None:
    row = store_links.link(conn, link_id)
    d = durations(conn, department_id, kind=(row or {}).get("kind") or "external")
    store_links.extend_link(conn, link_id, iso(at + dt.timedelta(days=d.sliding_days)))


def new_generation(conn, link_row: dict[str, Any], ticket: dict[str, Any], at: dt.datetime) -> dict[str, Any]:
    """"קישור חדש": generation + 1 under the CURRENT key, a new cap and first expiry, every earlier token, code session and code
    of the link dead (codes and their windows are generation-scoped; the old sessions are deleted here). TK251: the open record
    is generation-scoped too - the first open of the NEW link writes its own "הקישור נפתח" line, the manager's card shows when the
    new link was opened (not the old one) and the "link not opened" clock (monitor, `generation_at`) starts again."""
    key_id, key = KEYS.current(create=False)
    gen = int(link_row["generation"]) + 1
    token = links.derive_token(key, link_row["id"], gen)
    d = durations(conn, ticket["department_id"], kind=link_row.get("kind") or "external")
    cancel_messages(conn, link_row["id"], at)  # TKSTAFF1: what was queued for the old generation never leaves (B3's companion)
    expires, cap = first_expiry(at, d, resolve_window_min(conn, ticket["department_id"], ticket["priority_id"]))
    store_links.update_link(conn, link_row["id"], {
        "generation": gen, "key_id": key_id, "token_hash": links.token_hash(token), "generation_at": iso(at), "expires_at": iso(expires),
        "cap_at": iso(cap), "grace_until": None, "revoked_at": None, "revoked_reason": None, "sent_via": None, "sent_at": None,
        "first_opened_at": None, "last_opened_at": None, "open_count": 0,
    })
    store_links.drop_sessions(conn, link_row["id"])
    return store_links.link(conn, link_row["id"]) or link_row


def mark_sent(conn, link_id: str, via: str, at: dt.datetime) -> None:
    """The current generation left by `via` ('manual' = the manager's copy here; 'whatsapp' / 'email' = slice 5b's outbox once a
    message is accepted). `sent_at` keeps the FIRST time; a link that ever went by e-mail stays 'email' (the D6 rule: its code must
    then go by WhatsApp - a later copy must not open the e-mail fallback)."""
    store_links.mark_sent(conn, link_id, via, iso(at))


def pull_in_caps(conn, *, department_id: str | None = None, kind: str = "external") -> int:
    """A LOWER cap (installation or department): every live link of that kind - of one department, or all - gets
    cap_at = min(cap_at, generation_at + effective cap days) and its expiry with it, at once. Never moves a cap later. TKSTAFF1: the
    vendor caps (installation / department) pull in external links only; the staff cap (`staff_links.cap_days`) staff links only."""
    inst = settings_doc.read(conn)
    caps: dict[str, int] = {}
    pulls: dict[str, str] = {}
    for row in store_links.live_links_with_department(conn, department_id, kind=kind):
        dept_id = row["department_id"]
        if dept_id not in caps:
            caps[dept_id] = durations(conn, dept_id, installation=inst, kind=kind).cap_days
        start = parse(row.get("generation_at")) or parse(row["created_at"])
        if start is None:
            continue
        pulls[row["id"]] = iso(start + dt.timedelta(days=caps[dept_id]))
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
    from .code_flow import lock_state  # slice 7: the lock card shows until when (the current generation's window)

    locked_until = lock_state(conn, row, now) if locked else None
    staff = row.get("kind") == "staff"
    return {
        "kind": row.get("kind") or "external",  # TKSTAFF1: 'staff' = an internal employee's no-login link
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
        "sent_at": row.get("sent_at"),
        "first_opened_at": row.get("first_opened_at"),
        "last_opened_at": row.get("last_opened_at"),
        "open_count": int(row.get("open_count") or 0),
        # TK251: the devices of THIS generation (none before its first open; access rows carry no generation, so the time decides)
        "devices": store_links.access_devices(conn, row["id"], since=row.get("generation_at")) if row.get("first_opened_at") else 0,
        "update_count": int(row.get("update_count") or 0),
        "require_code": bool(row["require_code"]),
        "code_locked": locked,
        "code_locked_until": locked_until,
        "can": {
            "copy": external and current and st == "live" and not staff,  # TKSTAFF1: a staff link leaves by WhatsApp only
            "new": external and current and st in ("live", "expired", "revoked") and row.get("revoked_reason") not in ("contact_erased", "module_key"),
            "revoke": current and st in ("live", "grace"),
            "resend": bool(external and current and st == "live" and CHANNEL_OK is not None and CHANNEL_OK(conn, row)),  # slice 5b
        },
    }
