"""CAL-ATTENDEES-2343 - the attendee notices (owner answer 7B): an in-app Arx notification for users and residents with an Arx account, the
installation's configured messaging channel for external guests (and residents without an account).

* WRITE: every notice is a row in `cal_attendee_notices`, written inside the request's transaction (`enqueue_*`). Nothing is sent there.
* SEND: `dispatch(db)` runs from the janitor tick (every ~30 s) AFTER the commit. It re-reads the entry and decides at send time:
  - an invite / change goes out only while the entry is `confirmed` (a `pending` request waits; rejected / withdrawn / expired / cancelled
    entries drop it as `retracted`), never for a finished single entry;
  - a cancel waits the undo window (`cancel_notice_delay_s`, owner 02.11: ~6 s) and goes out only if the entry is STILL cancelled (or the
    occurrence is still excluded) - an undo inside the window (`retract_cancel`, or simply the restored state) means nobody is told;
  - a removed attendee who never got anything is not told about the removal.
  The text is built at send time from the current data, so a queued change never reports a stale time.
* CHANNELS for an external address (`GuestChannel`): the installation's order (`guest_channel_order`, default whatsapp -> sms -> email) and
  the FIRST channel that is configured now AND has the person's address. WhatsApp is live (the shared account / pacing / adapter of the
  messaging module, use `calendar.attendees`, inheriting the notifications account); SMS and e-mail are registered as `soon` and are
  skipped until a real channel is registered with `register_channel()` - THE PLUG POINT for e-mail (docs/changes/CAL-ATTENDEES-2343.md).
* PRIVACY: a phone or an address is opened from the seal / the directory only in memory, for the one send; never in a notice row, a
  notification, an audit row or a log line. The in-app notification carries the entry's title and time, never another person's name."""
from __future__ import annotations

import datetime as dt
import json
import logging
import re
import sqlite3
from dataclasses import dataclass
from typing import Any, Callable, Protocol
from zoneinfo import ZoneInfo

from ...audit import audit
from ...db import Database
from . import attendees as att
from . import model
from .calendars import new_id

log = logging.getLogger(__name__)

USE_KEY = "calendar.attendees"
MODULE = "calendar"
SOURCES = {"invite": "calendar.attendee.invite", "change": "calendar.attendee.change", "cancel": "calendar.attendee.cancel", "removed": "calendar.attendee.removed"}
SUBJECT = "calendar_event"
PER_PASS = 50
MAX_ATTEMPTS = 3
PENDING_RECHECK_S = 120
LINK = "#/calendars/cal"
DAY = ("ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳", "א׳")  # Monday .. Sunday


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


# ---------------------------------------------------------------- enqueue (inside the request's transaction)

def _actor_rows(conn: sqlite3.Connection, root_id: str, actor: str | None) -> set[str]:
    return {r["id"] for r in att.my_rows(conn, root_id, actor)} if actor else set()


def _queued(conn: sqlite3.Connection, attendee_id: str, kinds: tuple[str, ...]) -> bool:
    marks = ",".join("?" * len(kinds))
    return conn.execute(f"SELECT 1 FROM cal_attendee_notices WHERE attendee_id = ? AND state = 'queued' AND kind IN ({marks})", (attendee_id, *kinds)).fetchone() is not None


def _put(conn: sqlite3.Connection, attendee_id: str, root_id: str, kind: str, not_before: dt.datetime, now: dt.datetime, occurrence_start: str | None = None) -> str:
    nid = new_id("atn")
    conn.execute("INSERT INTO cal_attendee_notices(id, attendee_id, event_id, kind, occurrence_start, not_before, created_at) VALUES (?,?,?,?,?,?,?)",
                 (nid, attendee_id, root_id, kind, occurrence_start, model.iso(not_before), model.iso(now)))
    return nid


def enqueue_invites(conn: sqlite3.Connection, root_id: str, attendee_ids: list[str], now: dt.datetime, actor: str | None) -> int:
    mine = _actor_rows(conn, root_id, actor)
    n = 0
    for aid in attendee_ids:
        if aid in mine:
            continue  # joining yourself needs no invitation
        _put(conn, aid, root_id, "invite", now, now)
        n += 1
    return n


def enqueue_change(conn: sqlite3.Connection, root_id: str, now: dt.datetime, actor: str | None, occurrence_start: str | None = None) -> int:
    """The time or the room changed. Skipped when the calendar's `notify_on_change` is off; one queued change / invite per attendee is enough
    (its text is built at send time)."""
    ev = conn.execute("SELECT calendar_id FROM cal_events WHERE id = ?", (root_id,)).fetchone()
    if ev is None or not att.policy_of(conn, ev["calendar_id"])["notify_on_change"]:
        return 0
    mine = _actor_rows(conn, root_id, actor)
    n = 0
    for r in att.live(conn, root_id):
        if r["id"] in mine or _queued(conn, r["id"], ("invite", "change")):
            continue
        _put(conn, r["id"], root_id, "change", now, now, occurrence_start)
        n += 1
    return n


def enqueue_cancel(conn: sqlite3.Connection, root_id: str, now: dt.datetime, actor: str | None, occurrence_start: str | None = None) -> int:
    """The entry (or one occurrence) was cancelled: the notice waits the undo window. An attendee whose invitation never left is not told."""
    delay = att.read_settings(conn)["cancel_notice_delay_s"]
    mine = _actor_rows(conn, root_id, actor)
    n = 0
    for r in att.live(conn, root_id):
        if r["id"] in mine:
            continue
        if not r["notified_at"] and _queued(conn, r["id"], ("invite",)):
            continue  # he was never told about it; the queued invite is retracted at send time (the entry is cancelled)
        _put(conn, r["id"], root_id, "cancel", now + dt.timedelta(seconds=delay), now, occurrence_start)
        n += 1
    return n


def enqueue_removed(conn: sqlite3.Connection, r: sqlite3.Row, now: dt.datetime, actor: str | None) -> bool:
    """An attendee taken off the list. Queued invites / changes to him are retracted; he is told only if something already reached him."""
    conn.execute("UPDATE cal_attendee_notices SET state = 'retracted', reason = 'removed', done_at = ? WHERE attendee_id = ? AND state = 'queued'", (model.iso(now), r["id"]))
    if not r["notified_at"] or r["id"] in _actor_rows(conn, r["event_id"], actor):
        return False
    _put(conn, r["id"], r["event_id"], "removed", now + dt.timedelta(seconds=att.read_settings(conn)["cancel_notice_delay_s"]), now)
    return True


def retract_cancel(conn: sqlite3.Connection, root_id: str, now: dt.datetime | None = None) -> int:
    """THE UNDO HOOK: an entry restored inside the undo window drops its queued cancel notices (the send-time check does the same)."""
    return conn.execute("UPDATE cal_attendee_notices SET state = 'retracted', reason = 'undone', done_at = ? WHERE event_id = ? AND state = 'queued' AND kind = 'cancel'",
                        (model.iso(now or utcnow()), root_id)).rowcount


# ---------------------------------------------------------------- channels for an external address (the plug point)

class GuestChannel(Protocol):
    key: str
    address: str  # 'phone' | 'email' - which address of the person this channel needs
    state: str  # 'live' | 'soon'

    def available(self, db: Database) -> bool: ...

    def send(self, db: Database, notice_id: str, address: str, text: str, now: dt.datetime) -> tuple[str, str | None]:
        """(status, reason): status `sent` | `retry` | `failed`. Never logs the address or the text."""
        ...


@dataclass
class SoonChannel:
    """A channel the installation does not have yet (SMS, e-mail): listed, never chosen."""

    key: str
    address: str
    state: str = "soon"

    def available(self, db: Database) -> bool:  # noqa: ARG002
        return False

    def send(self, db: Database, notice_id: str, address: str, text: str, now: dt.datetime) -> tuple[str, str | None]:  # noqa: ARG002
        return "failed", "channel_unavailable"


class WhatsAppChannel:
    """The installation's WhatsApp account through the messaging module (shared pacing ledger, the tickets adapter)."""

    key, address, state = "whatsapp", "phone", "live"

    def available(self, db: Database) -> bool:
        from .. import messaging_runtime as mr  # noqa: PLC0415

        try:
            acc = mr.accounts_service(db).resolve(USE_KEY)
        except Exception:  # noqa: BLE001 - an unreadable mapping is "not configured"
            return False
        return acc is not None and bool(acc.value)

    def send(self, db: Database, notice_id: str, address: str, text: str, now: dt.datetime) -> tuple[str, str | None]:
        from .. import messaging_accounts as ma  # noqa: PLC0415
        from .. import messaging_runtime as mr  # noqa: PLC0415
        from ..notify_whatsapp import _messaging_key, transport  # noqa: PLC0415
        from ..tickets.channel import NOT_SENT, REFUSED, SENT, OutboundMessage, Recipient, phone_digits  # noqa: PLC0415
        from ..tickets.channel_whatsapp import WhatsAppChannel as Adapter  # noqa: PLC0415

        digits = phone_digits(re.sub(r"[^\d]", "", address))
        if not digits:
            return "failed", "no_address"
        svc = mr.accounts_service(db)
        account = svc.resolve(USE_KEY)
        if account is None or not account.value:
            return "failed", "channel_unavailable"
        if not svc.status(account.key).sendable:
            return "retry", "channel_down"
        gate = ma.PacingGate(mr.DbSendLedger(db))
        rkey = mr.recipient_key(_messaging_key(db), digits)
        decision = gate.check(account_key=account.key, pacing=svc.pacing(account.key), recipient_key=rkey, kind="message", now=now)
        if not decision.allowed:
            return "retry", "rate_limited"
        msg = OutboundMessage(outbox_id=notice_id, channel="whatsapp", purpose="notify", recipient=Recipient(None, phone=digits), text=text, account=account)
        result = Adapter(transport(), svc).send(msg)
        svc.note_result(account.key, result)
        if result.may_have_left:
            try:
                gate.record(account_key=account.key, use_key=USE_KEY, recipient_key=rkey, kind="message", now=now)
            except Exception:  # noqa: BLE001
                log.warning("calendar attendee send ledger row failed")
        if result.outcome == SENT:
            return "sent", None
        if result.outcome == REFUSED:
            return "failed", "provider_refused"
        if result.outcome == NOT_SENT:
            return "retry", result.outcome_code or "not_sent"
        return "failed", "unknown_outcome"  # it may have left: never retried


CHANNELS: dict[str, GuestChannel] = {"whatsapp": WhatsAppChannel(), "sms": SoonChannel("sms", "phone"), "email": SoonChannel("email", "email")}


def register_channel(channel: GuestChannel) -> None:
    """THE PLUG POINT: e-mail (or SMS) registers its sender here under its key; it is then chosen in the installation's order."""
    if channel.key not in att.GUEST_CHANNELS or channel.address not in ("phone", "email"):
        raise ValueError("unknown guest channel")
    CHANNELS[channel.key] = channel


def channels_view(db: Database) -> list[dict[str, Any]]:
    return [{"key": k, "address": CHANNELS[k].address, "state": CHANNELS[k].state, "available": CHANNELS[k].state == "live" and CHANNELS[k].available(db)} for k in att.GUEST_CHANNELS]


def choose_channel(order: list[str], addresses: dict[str, bool], available: Callable[[str], bool]) -> tuple[str | None, str | None]:
    """(channel, None) or (None, reason): `no_address` (no phone and no e-mail), `channel_unavailable` (an address, but no configured channel for it)."""
    if not any(addresses.values()):
        return None, "no_address"
    for key in order:
        ch = CHANNELS.get(key)
        if ch is not None and addresses.get(ch.address) and available(key):
            return key, None
    return None, "channel_unavailable"


# ---------------------------------------------------------------- texts (built at send time)

def _local(ts: str, tz: str) -> dt.datetime:
    return model.parse_utc(ts, "t").astimezone(ZoneInfo(tz))


def when_text(ev: sqlite3.Row, occurrence_start: str | None = None) -> str:
    tz = ev["tz"]
    if occurrence_start:
        from .recurrence import LOCAL_FMT  # noqa: PLC0415

        s = dt.datetime.strptime(occurrence_start, LOCAL_FMT)
        dur = dt.datetime.strptime(ev["local_end"], LOCAL_FMT) - dt.datetime.strptime(ev["local_start"], LOCAL_FMT)
        e = s + dur
    else:
        s, e = _local(ev["starts_at"], tz), _local(ev["ends_at"], tz)
    day = f"יום {DAY[s.weekday()]} {s:%d.%m}"
    if ev["all_day"]:
        return day + (" · חוזר" if ev["rrule"] and not occurrence_start else "")
    return f"{day} {s:%H:%M}–{e:%H:%M}" + (" · חוזר" if ev["rrule"] and not occurrence_start else "")


def place_text(conn: sqlite3.Connection, ev: sqlite3.Row) -> str:
    rooms = [r["name"] for r in conn.execute("SELECT c.name FROM cal_event_rooms r JOIN cal_calendars c ON c.id = r.room_calendar_id WHERE r.event_id = ? AND r.state IN ('pending','confirmed') ORDER BY c.name_key",
                                             (ev["id"],)).fetchall()]
    if not rooms:
        cal = conn.execute("SELECT name, type FROM cal_calendars WHERE id = ?", (ev["calendar_id"],)).fetchone()
        rooms = [cal["name"]] if cal and cal["type"] == "room" else []
    return ", ".join(rooms)


def message_text(conn: sqlite3.Connection, kind: str, ev: sqlite3.Row, occurrence_start: str | None) -> str:
    """The external message: one line, cleaned like every message of the notification channel (no markup, no link-looking token)."""
    from ..notify_whatsapp import clean  # noqa: PLC0415

    title, when, place = clean(ev["title"], 80), clean(when_text(ev, occurrence_start), 60), clean(place_text(conn, ev), 80)
    at = f" · {place}" if place else ""
    org = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (ev["organizer_user_id"],)).fetchone()
    by = clean((org["display_name"] or org["username"]) if org else "", 40)
    if kind == "invite":
        return f"הוזמנת ל{title}: {when}{at}." + (f" מזמין/ה: {by}." if by else "")
    if kind == "change":
        return f"עדכון ל{title}: המועד החדש {when}{at}."
    if kind == "cancel":
        return f"{title} ({when}) בוטל."
    return f"ההזמנה ל{title} ({when}) בוטלה עבורך."


# ---------------------------------------------------------------- dispatch (after the commit)

@dataclass
class _Job:
    notice_id: str
    attendee_id: str
    event_id: str
    channel: str
    address: str  # in memory only
    text: str


def _finish(conn: sqlite3.Connection, notice_id: str, state: str, reason: str | None, now: dt.datetime, channel: str | None = None) -> None:
    conn.execute("UPDATE cal_attendee_notices SET state = ?, reason = ?, channel = COALESCE(?, channel), done_at = ? WHERE id = ?", (state, reason, channel, model.iso(now), notice_id))


def _cut_off(ev: sqlite3.Row, local_start: str) -> bool:
    """A series cut before this occurrence ("this and the following" cancelled): the series now ends before it."""
    from .recurrence import LOCAL_FMT  # noqa: PLC0415

    if not ev["rrule"] or not ev["series_until"]:
        return False
    try:
        d = dt.datetime.strptime(local_start, LOCAL_FMT)
    except ValueError:
        return False
    return model.parse_utc(ev["series_until"], "u") < d.replace(tzinfo=ZoneInfo(ev["tz"])).astimezone(dt.timezone.utc)


def _still_due(conn: sqlite3.Connection, n: sqlite3.Row, a: sqlite3.Row | None, ev: sqlite3.Row | None, now: dt.datetime) -> tuple[str, str | None]:
    """'send' | 'wait' | 'retract' (+ reason), decided on the CURRENT entry."""
    if ev is None or a is None:
        return "retract", "event_gone"
    kind = n["kind"]
    if kind == "removed":
        return ("send", None) if a["removed_at"] else ("retract", "undone")
    if a["removed_at"]:
        return "retract", "removed"
    if kind == "cancel":
        if n["occurrence_start"]:
            ex = set(json.loads(ev["exdates_json"] or "[]"))
            ovr = conn.execute("SELECT state FROM cal_events WHERE override_of = ? AND override_start = ? ORDER BY updated_at DESC LIMIT 1", (ev["id"], n["occurrence_start"])).fetchone()
            gone = n["occurrence_start"] in ex or (ovr is not None and ovr["state"] == "cancelled") or ev["state"] == "cancelled" or _cut_off(ev, n["occurrence_start"])
            return ("send", None) if gone else ("retract", "undone")
        return ("send", None) if ev["state"] == "cancelled" else ("retract", "undone")
    if ev["state"] == "pending":
        return "wait", None
    if ev["state"] != "confirmed":
        return "retract", "event_state"
    if not ev["rrule"] and model.parse_utc(ev["ends_at"], "e") <= now:
        return "retract", "past"
    return "send", None


def _inapp_user(conn: sqlite3.Connection, a: sqlite3.Row) -> str | None:
    """The Arx account that gets the in-app notification: the user, or the account a resident's directory row is linked to."""
    uid = a["ref_id"] if a["kind"] == "user" else None
    if a["kind"] == "resident":
        try:
            c = conn.execute("SELECT user_id FROM ticket_contacts WHERE id = ?", (a["ref_id"],)).fetchone()
        except sqlite3.Error:
            c = None
        uid = c["user_id"] if c and c["user_id"] else None
    if not uid:
        return None
    u = conn.execute("SELECT id FROM users WHERE id = ? AND active = 1 AND deleted_at IS NULL", (uid,)).fetchone()
    return u["id"] if u else None


def _external_address(conn: sqlite3.Connection, data_dir: Any, a: sqlite3.Row) -> tuple[dict[str, str], str | None]:
    """({'phone', 'email'}, refusal reason) of a guest (the seal) or of a resident without an account (his directory row)."""
    if a["kind"] == "guest":
        if a["erased_at"]:
            return {"phone": "", "email": ""}, "erased"
        return att.guest_contact(data_dir, a), None
    try:
        c = conn.execute("SELECT * FROM ticket_contacts WHERE id = ? AND erased_at IS NULL", (a["ref_id"],)).fetchone()
    except sqlite3.Error:
        c = None
    if c is None:
        return {"phone": "", "email": ""}, "no_address"
    keys = c.keys()
    if "notify_whatsapp" in keys and not c["notify_whatsapp"]:
        return {"phone": "", "email": c["email"] or ""}, None  # he declined WhatsApp messages in the directory
    phone = c["phone_e164"] or ""
    return {"phone": ("+" + phone.lstrip("+")) if phone else "", "email": c["email"] or ""}, None


def _inapp(conn: sqlite3.Connection, n: sqlite3.Row, ev: sqlite3.Row, uid: str) -> tuple[str, str | None]:
    from .. import notify  # noqa: PLC0415

    params = {"name": ev["title"], "when": when_text(ev, n["occurrence_start"]), "place": place_text(conn, ev) or None}
    res = notify.emit_full(conn, notify.Signal(source=SOURCES[n["kind"]], subject_kind=SUBJECT, subject_id=ev["id"], dedupe_key=f"cal_att:{n['id']}",
                                               params={k: v for k, v in params.items() if v}, origin={"attendee_user_id": uid, "cal_event_id": ev["id"]},
                                               link=LINK, category="building"))
    if res.action in ("created", "folded", "renotified"):
        return "sent", None
    return "skipped", res.action  # disabled by the administrator / unknown source


def dispatch(db: Database, data_dir: Any, now: dt.datetime | None = None) -> dict[str, int]:
    """One pass over the due notices. Phase 1 (one write transaction): decide, send the in-app ones (the notification pipeline only enqueues),
    collect the external jobs. Phase 2 (no transaction): send them. Phase 3: record the outcomes."""
    now = now or utcnow()
    out = {"sent": 0, "skipped": 0, "retracted": 0, "failed": 0, "waiting": 0}
    jobs: list[_Job] = []
    with db.connection(label="calendar.attendees.dispatch") as conn:
        if not model.read_settings(conn)["enabled"]:
            return out
        s = att.read_settings(conn)
        rows = conn.execute("SELECT * FROM cal_attendee_notices WHERE state = 'queued' AND not_before <= ? ORDER BY not_before, rowid LIMIT ?", (model.iso(now), PER_PASS)).fetchall()
        avail: dict[str, bool] = {}

        def available(key: str) -> bool:
            if key not in avail:
                ch = CHANNELS.get(key)
                avail[key] = bool(ch and ch.state == "live" and ch.available(db))
            return avail[key]

        for n in rows:
            a = conn.execute("SELECT * FROM cal_attendees WHERE id = ?", (n["attendee_id"],)).fetchone()
            ev = conn.execute("SELECT * FROM cal_events WHERE id = ?", (n["event_id"],)).fetchone()
            verdict, why = _still_due(conn, n, a, ev, now)
            if verdict == "wait":
                conn.execute("UPDATE cal_attendee_notices SET not_before = ? WHERE id = ?", (model.iso(now + dt.timedelta(seconds=PENDING_RECHECK_S)), n["id"]))
                out["waiting"] += 1
                continue
            if verdict == "retract":
                _finish(conn, n["id"], "retracted", why, now)
                out["retracted"] += 1
                continue
            if not s["enabled"]:
                _finish(conn, n["id"], "skipped", "disabled", now)
                out["skipped"] += 1
                continue
            uid = _inapp_user(conn, a) if a["kind"] != "guest" else None
            if uid:
                if not s["notify_users_inapp"]:
                    _finish(conn, n["id"], "skipped", "disabled", now, "inapp")
                    out["skipped"] += 1
                    continue
                state, reason = _inapp(conn, n, ev, uid)
                _finish(conn, n["id"], state, reason, now, "inapp")
                if state == "sent":
                    conn.execute("UPDATE cal_attendees SET notified_at = ? WHERE id = ?", (model.iso(now), a["id"]))
                out["sent" if state == "sent" else "skipped"] += 1
                continue
            if not s["notify_guests"]:
                _finish(conn, n["id"], "skipped", "disabled", now)
                out["skipped"] += 1
                continue
            addr, refused = _external_address(conn, data_dir, a)
            key, reason = (None, refused) if refused else choose_channel(s["guest_channel_order"], {"phone": bool(addr["phone"]), "email": bool(addr["email"])}, available)
            if key is None:
                _finish(conn, n["id"], "skipped", reason, now)
                _audit_notice(conn, n, None, "skipped", reason)
                out["skipped"] += 1
                continue
            conn.execute("UPDATE cal_attendee_notices SET attempts = attempts + 1, channel = ? WHERE id = ?", (key, n["id"]))
            jobs.append(_Job(n["id"], a["id"], ev["id"], key, addr[CHANNELS[key].address], message_text(conn, n["kind"], ev, n["occurrence_start"])))
    results: list[tuple[_Job, str, str | None]] = []
    for j in jobs:
        try:
            status, reason = CHANNELS[j.channel].send(db, j.notice_id, j.address, j.text, now)
        except Exception:  # noqa: BLE001 - a broken channel never stops the pass (nothing about the person is logged)
            log.warning("calendar attendee notice via %s failed", j.channel)
            status, reason = "retry", "channel_error"
        results.append((j, status, reason))
    if results:
        with db.connection(label="calendar.attendees.dispatch") as conn:
            for j, status, reason in results:
                n = conn.execute("SELECT * FROM cal_attendee_notices WHERE id = ?", (j.notice_id,)).fetchone()
                if status == "sent":
                    _finish(conn, j.notice_id, "sent", None, now, j.channel)
                    conn.execute("UPDATE cal_attendees SET notified_at = ? WHERE id = ?", (model.iso(now), j.attendee_id))
                    out["sent"] += 1
                elif status == "retry" and n is not None and n["attempts"] < MAX_ATTEMPTS:
                    conn.execute("UPDATE cal_attendee_notices SET not_before = ?, reason = ? WHERE id = ?", (model.iso(now + dt.timedelta(minutes=5 * n["attempts"])), reason, j.notice_id))
                    out["waiting"] += 1
                    continue
                else:
                    _finish(conn, j.notice_id, "failed", reason, now, j.channel)
                    out["failed"] += 1
                if n is not None:
                    _audit_notice(conn, n, j.channel, "sent" if status == "sent" else "failed", reason)
    return out


def _audit_notice(conn: sqlite3.Connection, n: sqlite3.Row, channel: str | None, state: str, reason: str | None) -> None:
    """Ids, kind, channel and outcome only - never an address, a name or the text."""
    audit(conn, actor=None, action="calendar.attendee.notice", decision="allowed" if state == "sent" else "denied", resource_type="calendar_event", resource_id=n["event_id"],
          reason=reason, details={"notice_id": n["id"], "attendee_id": n["attendee_id"], "kind": n["kind"], "channel": channel, "state": state})


def erase_due(db: Database, now: dt.datetime | None = None) -> int:
    """Guest contacts past `erase_after` are destroyed (always, also while the module is off - retention never depends on a switch)."""
    now = now or utcnow()
    with db.connection(label="calendar.attendees.erase") as conn:
        n = conn.execute("UPDATE cal_attendees SET name_sealed = NULL, phone_sealed = NULL, email_sealed = NULL, erased_at = ? WHERE kind = 'guest' AND erased_at IS NULL AND erase_after <= ?",
                         (model.iso(now), model.iso(now))).rowcount
        if n:
            audit(conn, actor=None, action="calendar.attendees.erase", decision="allowed", resource_type="installation", resource_id="calendar", details={"records": n})
        conn.execute("DELETE FROM cal_attendee_notices WHERE state <> 'queued' AND done_at < ?", (model.iso(now - dt.timedelta(days=90)),))
    return n


def reset_erase_after(conn: sqlite3.Connection, root_id: str, now: dt.datetime) -> None:
    """After a change of the entry's end (edit, cancel): the guests' retention follows the calendars' guest rule."""
    conn.execute("UPDATE cal_attendees SET erase_after = ? WHERE event_id = ? AND kind = 'guest' AND erased_at IS NULL", (att._erase_after(conn, root_id, now), root_id))


_last_erase = 0.0


def tick(db: Database, data_dir: Any) -> None:
    """Every janitor pass (~30 s): the due notices; hourly: the guest-contact retention."""
    global _last_erase
    import time  # noqa: PLC0415

    try:
        dispatch(db, data_dir)
    except Exception:  # noqa: BLE001 - never stops the janitor tick
        log.warning("calendar attendee notices failed", exc_info=True)
    if not _last_erase or time.monotonic() - _last_erase > 3000:
        _last_erase = time.monotonic()
        try:
            erase_due(db)
        except Exception:  # noqa: BLE001
            log.warning("calendar attendee retention failed", exc_info=True)


def _module_on(conn: sqlite3.Connection) -> bool:
    try:
        return bool(model.read_settings(conn)["enabled"])
    except Exception:  # noqa: BLE001
        return False


def _register_use() -> None:
    from .. import messaging_accounts as ma  # noqa: PLC0415
    from .. import messaging_runtime as mr  # noqa: PLC0415
    from .. import notify_whatsapp  # noqa: F401, PLC0415 - registers `notifications.whatsapp` first: a use inherits only from one registered before it

    def uses(conn: sqlite3.Connection) -> tuple[Any, ...]:
        return (ma.UseSpec(USE_KEY, MODULE, "הזמנות ליומן", inherits="notifications.whatsapp", active=lambda: _module_on(conn)),)

    mr.register_uses(uses)
    mr.register_label_renderer(MODULE, lambda conn, text: text, lambda conn: "יומנים")


_register_use()


# ---------------------------------------------------------------- the notification centre's hooks (services/notify.py, notify_visibility.py)

def recipient_users(conn: sqlite3.Connection, n: dict[str, Any]) -> list[str]:
    """Recipient rule `calendar_attendee`: exactly the attendee the row was made for."""
    uid = (n.get("origin") or {}).get("attendee_user_id")
    return [uid] if isinstance(uid, str) and uid else []


def can_see(conn: sqlite3.Connection, principal: Any, n: dict[str, Any]) -> bool:
    """Visibility of an attendee notification: the attendee himself, while the calendars module is on."""
    uid = (n.get("origin") or {}).get("attendee_user_id")
    return bool(uid) and uid == principal.user_id and _module_on(conn)
