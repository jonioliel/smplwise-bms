"""CR-INFRA-TEMPERATURE 2.9.1 phase 2: the temperature report by WhatsApp - TEXT SUMMARY ONLY for now (owner decision 2026-10-19, option A).

What it is: a one-off send or a schedule (daily / weekly / monthly) of the report's key numbers (the range, per unit min / max / average /
out-of-range time / alerts) to chosen recipients; the full PDF stays in the system (download from the report dialog). It REUSES the existing
WhatsApp infrastructure through its public functions - nothing new is invented and nothing of theirs is edited:
* the transport and adapter of the tickets module (services/tickets/channel_whatsapp.WhatsAppChannel via notify_whatsapp.transport());
* the account: the use `infra.temperature.reports` joins the installation's account mapping (Settings › ערוץ ההודעות) and INHERITS the
  notifications account until an administrator picks another;
* the pacing: messaging_accounts.PacingGate over the shared send ledger (one budget per number, shared with tickets and notifications);
* the recipient's number and CONSENT: notify_whatsapp.resolve_number - a system user receives only on the number they opted in for
  themselves (and verified, when verification is on); no number / no consent = the row is `skipped` and the dialog warned before;
* the installation's WhatsApp SEND HOURS (tickets.settings `send_hours`, services/tickets/hours.py): a send outside the window is `held`
  and goes out at the next opening (logged with the reason);
* the text hygiene of the notification channel (notify_whatsapp.clean: one line, no markup, no link-looking token).

Nothing here stores, logs or audits a phone number or the message text: a send row keeps the REQUEST (units, range, language) and the text
is rebuilt from the data at send time.

DEFERRED by the owner (docs/changes/CR-INFRA-TEMPERATURE.md section 9, open items - do not forget):
* DOCUMENT SENDING - the transport sends text only (`whatsapp.send_message`). The switch is the installation setting `report_attachment`
  (ATTACHMENT_MODES, "none" by default). Mode "link" (TEMPVENDOR-295 for vendors, TEMPREPORT-297 for system users, owner 2026-10-27): the
  recipient's PDF becomes a temporary, hash-only, read-only download (out_documents) and the text carries the link - for a system user only
  when the sender holds `infra.temperature.report_link_send`. Security review TEMPREPORT-2310: the system-user link has its OWN switch
  `report_link_users` (`user_link_mode`); `report_attachment` is the vendor mode only. `attachment_for()` is the single seam; the attached-file mode is designed in
  docs/changes/CR-TEMPREPORT-297.md and waits for the WhatsApp file contract.
* VENDORS (TEMPVENDOR-295, CR-VENDORQ2-295 section 3): an external contact is reached ONLY through the tickets message queue
  (`contact_reports.queue`, outbox purpose `report`; services/temperature_vendor_reports.py is the registered provider). OFF by default behind
  `reports.to_contacts` (+ `reports.email` for e-mail, `reports.documents` for the link). The channel (WhatsApp or e-mail) is chosen per vendor
  and per report - NEVER switched automatically. A vendor receives exactly the units the sender selected, and the send is refused at queue time
  for any unit the sender may not see himself (a report is never a way around the scope); the text is rebuilt at send time from the data the
  sender may see. The outbox owns hours, pacing, retries and the audit row; `infra_temp_report_sends.status` becomes `handed` and the provider
  closes it."""
from __future__ import annotations

import datetime as dt
import json
import logging
import sqlite3
import time
from typing import Any

from ..db import Database, new_id, now_iso
from . import messaging_accounts as ma
from . import messaging_runtime as mr
from . import temperature as t
from .timeutil import iso_utc, parse_utc

log = logging.getLogger("smplwise.temperature.whatsapp")

USE_KEY = "infra.temperature.reports"
LINK_SEND_PERM = "infra.temperature.report_link_send"  # TEMPREPORT-297: the sender's permission for a link in a system user's message
MODULE = "temperature"
CHANNEL = "whatsapp"
ATTACHMENT_MODES: tuple[str, ...] = ("none", "link")    # "link": vendors (TEMPVENDOR-295) get the PDF by a temporary link (system users: `report_link_users`); "file" waits for the file contract
RANGE_KEYS: tuple[str, ...] = ("24h", "7d", "30d", "week", "month", "prev_week", "prev_month")
FREQS: tuple[str, ...] = ("daily", "weekly", "monthly")
PER_PASS = 5                                            # sends tried per 60 s pass (the account pacing holds the rest)
MAX_RECIPIENTS = 30
VENDOR_CHANNELS: tuple[str, ...] = ("whatsapp", "email")


def module_on(conn: sqlite3.Connection) -> bool:
    """TEMPREG-295: the temperature module is ON once a unit is defined - the same rule that shows the temperatures tab (frontend
    shell/nav.ts: hidden until a unit exists). There is no separate temperature master switch; a database before the migrations is off."""
    try:
        return conn.execute("SELECT 1 FROM infra_temp_units LIMIT 1").fetchone() is not None
    except sqlite3.Error:
        return False


def _uses(conn: sqlite3.Connection) -> tuple[ma.UseSpec, ...]:
    return (ma.UseSpec(USE_KEY, MODULE, "דוחות טמפרטורה", inherits="notifications.whatsapp", active=lambda: module_on(conn)),)


mr.register_uses(_uses)
mr.register_label_renderer(MODULE, lambda conn, text: text, lambda conn: "טמפרטורות")


class SendInvalid(ValueError):
    def __init__(self, code: str, message: str, message_en: str, fields: list[str] | None = None) -> None:
        super().__init__(code)
        self.code, self.message, self.message_en, self.fields = code, message, message_en, fields or []


# ---------------------------------------------------------------- ranges (presets in the installation's local time)

def range_of(key: str, now_ts: float, tz: Any) -> tuple[int, int]:
    """(from, to) unix seconds of a preset: the last 24 h / 7 / 30 days, this week (from Sunday) / month so far, the previous week / month."""
    now = dt.datetime.fromtimestamp(now_ts, dt.timezone.utc).astimezone(tz)
    if key in t.RANGES:
        return int(now_ts - t.RANGES[key]), int(now_ts)
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week0 = midnight - dt.timedelta(days=(now.weekday() + 1) % 7)  # Sunday
    month0 = midnight.replace(day=1)
    if key == "week":
        return int(week0.timestamp()), int(now_ts)
    if key == "month":
        return int(month0.timestamp()), int(now_ts)
    if key == "prev_week":
        return int((week0 - dt.timedelta(days=7)).timestamp()), int(week0.timestamp())
    if key == "prev_month":
        prev0 = (month0 - dt.timedelta(days=1)).replace(day=1)
        return int(prev0.timestamp()), int(month0.timestamp())
    raise ValueError("range")


# ---------------------------------------------------------------- recipients (the dialog's list)

def vendor_reports_reason(conn: sqlite3.Connection) -> str | None:
    """None when a report may be queued to an external contact now; else the stable reason. Needs the service module (the directory and the
    queue belong to it) AND `reports.to_contacts` - both off by default."""
    from .tickets import access, contact_reports

    try:
        if not access.module_on(conn):
            return "module_off"
        return None if contact_reports.enabled(conn) else "reports_off"
    except Exception:  # noqa: BLE001 - an unreadable settings document or a database before the migrations: off (fail closed)
        return "reports_off"


def recipients(conn: sqlite3.Connection) -> dict[str, Any]:
    """System users (selectable; `reach` says whether the summary can reach them: ok | no_address | no_consent - the owner: warn, but allow
    the selection) and vendors. A vendor is `selectable` only while vendor reports are on AND at least one channel can carry the report now;
    `channels` says per channel `ok` or the reason (no_whatsapp | no_email | reports_email_off | no_contact). While vendor reports are off the
    vendor stays listed, disabled, with `coming_later`. Never a number or an address."""
    from .notify_whatsapp import raw_number, resolve_number
    from .tickets import contact_reports

    users = []
    for r in conn.execute("SELECT id, username, display_name FROM users WHERE active = 1 AND (deleted_at IS NULL) ORDER BY display_name, username").fetchall():
        found = raw_number(conn, r["id"])
        reach = "no_address" if found is None else ("ok" if resolve_number(conn, r["id"]).consent == "granted" else "no_consent")  # type: ignore[union-attr]
        users.append({"id": r["id"], "name": r["display_name"] or r["username"], "reach": reach, "selectable": True})
    vendors = []
    try:
        rows = conn.execute("""SELECT id, display_name, company, phone_e164 FROM ticket_contacts WHERE kind = 'vendor' AND active = 1 AND erased_at IS NULL
                               ORDER BY display_name""").fetchall()
    except sqlite3.Error:
        rows = []
    on = vendor_reports_reason(conn) is None
    for r in rows:
        v: dict[str, Any] = {"id": r["id"], "name": r["display_name"], "company": r["company"], "has_phone": bool(r["phone_e164"]), "selectable": False, "reason": "coming_later"}
        if on:
            ch = {c: contact_reports.reach(conn, r["id"], c) for c in VENDOR_CHANNELS}
            first = next((c for c in VENDOR_CHANNELS if ch[c] == "ok"), None)
            v.update(channels=ch, selectable=first is not None, channel=first or "whatsapp", reason=None if first else ch["whatsapp"])
        vendors.append(v)
    link = on and link_mode(conn)
    return {"users": users, "vendors": vendors, "attachment": "link" if link else "none", "user_attachment": "link" if user_link_mode(conn) else "none",
            "attachment_modes": list(ATTACHMENT_MODES),
            "vendor_reports": {"enabled": on, "email": on and contact_reports.email_enabled(conn)}}


def _documents_on(conn: sqlite3.Connection) -> bool:
    from .tickets import out_documents

    try:
        return bool(out_documents.config(conn)["enabled"])
    except Exception:  # noqa: BLE001
        return False


def _check_recipients(conn: sqlite3.Connection, items: list[dict[str, Any]]) -> list[dict[str, str]]:
    if not items or len(items) > MAX_RECIPIENTS:
        raise SendInvalid("validation", "יש לבחור נמענים.", "Choose recipients.", ["recipients"])
    from .tickets import contact_reports, store_links

    active = {r[0] for r in conn.execute("SELECT id FROM users WHERE active = 1").fetchall()}
    out: list[dict[str, str]] = []
    for i, it in enumerate(items):
        kind, rid = it.get("kind"), it.get("id")
        if kind == "vendor":
            if vendor_reports_reason(conn) is not None:
                raise SendInvalid("vendor_coming_later", "שליחה לספקים תתאפשר בהמשך.", "Sending to vendors comes later.", [f"recipients.{i}"])
            channel = it.get("channel") or "whatsapp"
            if channel not in VENDOR_CHANNELS:
                raise SendInvalid("validation", "ערוץ שליחה לא תקין.", "Invalid delivery channel.", [f"recipients.{i}.channel"])
            if channel == "email" and not contact_reports.email_enabled(conn):
                raise SendInvalid("reports_email_off", "שליחת דוחות בדוא״ל כבויה.", "Sending reports by e-mail is off.", [f"recipients.{i}.channel"])
            c = store_links.contact(conn, rid if isinstance(rid, str) else None)
            if c is None or c.get("kind") != "vendor" or c.get("erased_at") or not c.get("active", 1):
                raise SendInvalid("recipient_vendor", "ספק לא מוכר.", "Unknown vendor.", [f"recipients.{i}"])
            if not any(o["kind"] == "vendor" and o["id"] == rid for o in out):
                out.append({"kind": "vendor", "id": rid, "channel": channel})
            continue
        if kind != "user" or rid not in active:
            raise SendInvalid("recipient_user", "משתמש לא מוכר.", "Unknown user.", [f"recipients.{i}"])
        if not any(o["kind"] == "user" and o["id"] == rid for o in out):
            out.append({"kind": "user", "id": rid})
    return out


def _sender_may_see(conn: sqlite3.Connection, principal: Any, sender_id: str | None, unit_ids: list[str]) -> bool:
    """TEMPVENDOR-295 (owner decision, the lead's recommendation): a vendor has no Arx scope, so he receives exactly the units the sender chose,
    and every one of them must be visible to the sender himself (devices.read on the unit's sensor) - else the whole send is refused."""
    from . import temperature_access as ta
    from .notify_visibility import principal_of

    p = principal if getattr(principal, "user_id", None) else (principal_of(conn, sender_id) if sender_id else None)
    if p is None:
        return False
    try:
        scope = ta.Scope(conn, p)
    except Exception:  # noqa: BLE001 - no devices.read at all
        return False
    seen = {u["id"] for u, _d in scope.filter([u for u in t.units(conn, enabled_only=True) if u["id"] in unit_ids])}
    return bool(unit_ids) and all(i in seen for i in unit_ids)


def queue_send(conn: sqlite3.Connection, principal: Any, unit_ids: list[str], lo: int, hi: int, lang: str, items: list[dict[str, Any]], now_ts: float,
               schedule_id: str | None = None, sender_id: str | None = None) -> dict[str, Any]:
    """One send row per recipient (not before now; the send hours and the pacing decide when it really leaves). `sender_id` is the person the
    send is made on behalf of: the principal's user, or - for a schedule run - the schedule's creator. A vendor needs the sender to see every
    unit (`vendor_scope`, refused here, at queue time); the row records the sender and the chosen channel."""
    rec = _check_recipients(conn, items)
    sender = sender_id or getattr(principal, "user_id", None)
    if any(r["kind"] == "vendor" for r in rec) and not _sender_may_see(conn, principal, sender, unit_ids):
        raise SendInvalid("vendor_scope", "אי אפשר לשלוח לספק יחידה שאינך רשאי לראות.", "A vendor cannot receive a unit you may not see.", ["units"])
    batch = new_id()
    base = {"units": unit_ids, "from": lo, "to": hi, "lang": lang if lang in ("he", "en") else "he"}
    stamp = iso_utc(dt.datetime.fromtimestamp(now_ts, dt.timezone.utc))
    for r in rec:
        req = json.dumps({**base, "channel": r["channel"]} if r["kind"] == "vendor" else base)
        vendor = r["kind"] == "vendor"
        conn.execute("""INSERT INTO infra_temp_report_sends(id, batch_id, schedule_id, recipient_kind, user_id, contact_id, request_json, status, not_before, created_by, created_at)
                        VALUES (?,?,?,?,?,?,?, 'queued', ?, ?, ?)""",
                     (new_id(), batch, schedule_id, r["kind"], None if vendor else r["id"], r["id"] if vendor else None, req, stamp, sender, stamp))
    return {"batch_id": batch, "queued": len(rec), "vendors": sum(1 for r in rec if r["kind"] == "vendor")}


def batch_view(conn: sqlite3.Connection, batch_id: str) -> list[dict[str, Any]]:
    rows = conn.execute("""SELECT s.id, s.user_id, s.contact_id, s.recipient_kind, s.request_json, s.status, s.reason, s.not_before, s.finished_at,
                                  u.display_name, u.username, c.display_name AS contact_name
                           FROM infra_temp_report_sends s LEFT JOIN users u ON u.id = s.user_id LEFT JOIN ticket_contacts c ON c.id = s.contact_id
                           WHERE s.batch_id = ? ORDER BY s.created_at""", (batch_id,)).fetchall()
    out = []
    for r in rows:
        item = {"id": r["id"], "name": (r["contact_name"] if r["recipient_kind"] == "vendor" else r["display_name"] or r["username"]) or "", "status": r["status"],
                "reason": r["reason"], "not_before": r["not_before"], "finished_at": r["finished_at"]}
        if r["recipient_kind"] == "vendor":
            item["kind"] = "vendor"
            try:
                item["channel"] = json.loads(r["request_json"]).get("channel")
            except ValueError:
                item["channel"] = None
        out.append(item)
    return out


# ---------------------------------------------------------------- schedules

def next_run(s: dict[str, Any], after_ts: float, tz: Any) -> float:
    """The next run of a schedule strictly after `after_ts` (local wall clock of the installation zone)."""
    h, m = int(s["at"][:2]), int(s["at"][3:])
    base = dt.datetime.fromtimestamp(after_ts, dt.timezone.utc).astimezone(tz)
    for add in range(0, 400):
        day = (base + dt.timedelta(days=add)).date()
        if s["freq"] == "weekly" and (day.weekday() + 1) % 7 != int(s.get("dow") or 0):
            continue
        if s["freq"] == "monthly" and day.day != min(int(s.get("dom") or 1), 28):
            continue
        cand = t.local_instant(day, h * 60 + m, tz)  # DST-safe (ambiguous = first occurrence, skipped = moved forward)
        if cand > after_ts:
            return cand
    return after_ts + 86400


def validate_schedule(conn: sqlite3.Connection, body: dict[str, Any]) -> dict[str, Any]:
    if body.get("freq") not in FREQS:
        raise SendInvalid("validation", "תדירות לא תקינה.", "Invalid frequency.", ["freq"])
    if body.get("range") not in RANGE_KEYS:
        raise SendInvalid("validation", "טווח לא תקין.", "Invalid range.", ["range"])
    at = body.get("at") or ""
    if not (isinstance(at, str) and len(at) == 5 and at[2] == ":" and at[:2].isdigit() and at[3:].isdigit() and int(at[:2]) < 24 and int(at[3:]) < 60):
        raise SendInvalid("validation", "שעה לא תקינה.", "Invalid time.", ["at"])
    dow, dom = body.get("dow"), body.get("dom")
    if body["freq"] == "weekly" and not (isinstance(dow, int) and 0 <= dow <= 6):
        raise SendInvalid("validation", "יום לא תקין.", "Invalid day.", ["dow"])
    if body["freq"] == "monthly" and not (isinstance(dom, int) and 1 <= dom <= 28):
        raise SendInvalid("validation", "יום בחודש לא תקין.", "Invalid day of the month.", ["dom"])
    return {"freq": body["freq"], "range": body["range"], "at": at, "dow": dow if body["freq"] == "weekly" else None, "dom": dom if body["freq"] == "monthly" else None,
            "recipients": _check_recipients(conn, body.get("recipients") or [])}


def save_schedule(conn: sqlite3.Connection, principal: Any, unit_ids: list[str], lang: str, body: dict[str, Any], now_ts: float, sched_id: str | None = None) -> str:
    v = validate_schedule(conn, body)
    if any(r["kind"] == "vendor" for r in v["recipients"]) and not _sender_may_see(conn, principal, getattr(principal, "user_id", None), unit_ids):
        raise SendInvalid("vendor_scope", "אי אפשר לשלוח לספק יחידה שאינך רשאי לראות.", "A vendor cannot receive a unit you may not see.", ["units"])
    tz = t.site_zone(conn)
    nxt = iso_utc(dt.datetime.fromtimestamp(next_run(v, now_ts, tz), dt.timezone.utc))
    stamp = now_iso()
    sid = sched_id or new_id()
    conn.execute("""INSERT INTO infra_temp_report_schedules(id, units_json, range_key, lang, freq, dow, dom, at, recipients_json, enabled, created_by, created_at, updated_at, next_run_at)
                    VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?,?)
                    ON CONFLICT(id) DO UPDATE SET units_json = excluded.units_json, range_key = excluded.range_key, lang = excluded.lang, freq = excluded.freq,
                      dow = excluded.dow, dom = excluded.dom, at = excluded.at, recipients_json = excluded.recipients_json, enabled = 1, updated_at = excluded.updated_at,
                      next_run_at = excluded.next_run_at""",
                 (sid, json.dumps(unit_ids), v["range"], lang if lang in ("he", "en") else "he", v["freq"], v["dow"], v["dom"], v["at"], json.dumps(v["recipients"]),
                  getattr(principal, "user_id", None), stamp, stamp, nxt))
    return sid


def schedules(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    out = []
    for r in conn.execute("SELECT * FROM infra_temp_report_schedules ORDER BY created_at").fetchall():
        d = dict(r)
        d["units"] = json.loads(d.pop("units_json") or "[]")
        d["recipients"] = json.loads(d.pop("recipients_json") or "[]")
        d["enabled"] = bool(d["enabled"])
        out.append(d)
    return out


# ---------------------------------------------------------------- the worker pass (called from the temperature runtime every 60 s)

def link_mode(conn: sqlite3.Connection) -> bool:
    """VENDORS (TEMPVENDOR-295): the attachment mode "link" (installation setting `report_attachment`, "none" by default) AND
    `reports.documents` (the public listener's document switch of the tickets module). Both are off by default."""
    return t.load_defaults(conn).get("report_attachment", "none") == "link" and _documents_on(conn)


def user_link_mode(conn: sqlite3.Connection) -> bool:
    """SYSTEM USERS (TEMPREPORT-297; security review TEMPREPORT-2310 S1): their own switch `report_link_users` (OFF by default) AND
    `reports.documents`. Independent of the vendor mode: turning one audience on never turns the other on."""
    return bool(t.load_defaults(conn).get("report_link_users", False)) and _documents_on(conn)


def people_in_links(conn: sqlite3.Connection) -> bool:
    """TEMPREPORT-2310 S3: a PDF that leaves by a public link names staff and carries free-text maintenance reasons only when
    `report_link_people` is on (OFF by default)."""
    return bool(t.load_defaults(conn).get("report_link_people", False))


def may_send_link(conn: sqlite3.Connection, sender_id: str | None) -> bool:
    """TEMPREPORT-297: a system user's message carries the report link only when the person the send is made on behalf of (the one-off sender, or
    the schedule's creator) holds `infra.temperature.report_link_send` NOW. Fails closed."""
    from ..rbac import INSTALLATION, authorize
    from .notify_visibility import principal_of

    if not sender_id:
        return False
    try:
        p = principal_of(conn, sender_id)
        return p is not None and authorize(conn, p, LINK_SEND_PERM, INSTALLATION).allowed
    except Exception:  # noqa: BLE001 - an unknown user / a database before the permission: no link
        return False


def wants_document(conn: sqlite3.Connection, row: dict[str, Any]) -> bool:
    """TEMPVENDOR-295: a vendor row while the link mode is on. TEMPREPORT-297: a system user's row too, when the sender may send links
    (`may_send_link`); without the permission the user gets the text summary as before ("available in the system")."""
    if not row:
        return False
    if row.get("recipient_kind") == "vendor":
        return link_mode(conn)
    return (row.get("recipient_kind") == "user" and bool(row.get("user_id")) and user_link_mode(conn)
            and may_send_link(conn, row.get("created_by")))


def attachment_for(conn: sqlite3.Connection, row: dict[str, Any], model: dict[str, Any], *, pdf: bytes | None = None, now: dt.datetime | None = None) -> Any:
    """THE seam of document sending (the "link" adapter; see docs/changes/CR-TEMPREPORT-297.md for the attached-file adapter, which waits for
    the WhatsApp file contract). Mode "none" (default): None. Mode "link" + `pdf` (the rendered report): the PDF is minted as a snapshot in
    `outbound_documents` for THIS recipient (a temporary link; the token is derived, only its hash is stored) and its id is returned.
    * a vendor row: recipient_kind `contact`, hours / opens from `reports.*`; the id goes to the queue (`document_id`);
    * a system user's row (TEMPREPORT-297): recipient_kind `user`, hours / opens from `report_link_hours` / `report_link_max_opens`; the
      caller turns the id into the link line of the text.
    The caller holds the write transaction. Refusals raise `out_documents.DocumentRefused`."""
    if pdf is None or not row or not wants_document(conn, row):
        return None
    from . import temperature_report as rep
    from . import temperature_report_link as rl
    from .tickets import out_documents

    at = now or dt.datetime.now(dt.timezone.utc)
    try:  # TEMPLINK-2320 (owner 5A): the sender's mint limit (rolling 24 h) - a user link and a vendor link count alike
        rl.check_daily_limit(conn, row.get("created_by"), at, kind="user" if row.get("recipient_kind") == "user" else "vendor")
    except rl.LinkRefused as e:
        raise out_documents.DocumentRefused(e.code) from None
    if row.get("recipient_kind") == "user":
        d = t.load_defaults(conn)
        doc = out_documents.mint(conn, module=MODULE, source_id=row["id"], recipient_kind="user", recipient_id=row["user_id"], media_type="application/pdf",
                                 filename=rep.filename(model), content=pdf, created_by=row.get("created_by"), now=at,
                                 hours=int(d["report_link_hours"]), max_opens=int(d["report_link_max_opens"]))
        return doc["id"]
    doc = out_documents.mint(conn, module=MODULE, source_id=row["id"], recipient_kind="contact", recipient_id=row["contact_id"], media_type="application/pdf",
                             filename=rep.filename(model), content=pdf, created_by=row.get("created_by"), now=at)
    return doc["id"]


def _finish(db: Database, sid: str, status: str, reason: str | None, now_ts: float, *, attempts: int | None = None, not_before: str | None = None) -> None:
    stamp = iso_utc(dt.datetime.fromtimestamp(now_ts, dt.timezone.utc))
    with db.connection(label="temperature.wa.finish") as conn:
        if status == "held":
            conn.execute("UPDATE infra_temp_report_sends SET status = 'held', reason = ?, not_before = ? WHERE id = ?", (reason, not_before, sid))
        else:
            conn.execute("UPDATE infra_temp_report_sends SET status = ?, reason = ?, finished_at = ?, attempts = COALESCE(?, attempts) WHERE id = ?",
                         (status, reason, stamp, attempts, sid))


def _visible_units(conn: sqlite3.Connection, user_id: str, unit_ids: list[str]) -> tuple[list[sqlite3.Row], set[str]]:
    """The recipient sees only the units he may see himself (devices.read on the unit's sensor) - a report is never a way around the scope."""
    from . import temperature_access as ta
    from .notify_visibility import principal_of

    p = principal_of(conn, user_id)
    if p is None:
        return [], set()
    try:
        scope = ta.Scope(conn, p)
    except Exception:  # noqa: BLE001 - no devices.read at all
        return [], set()
    rows = [u for u in t.units(conn, enabled_only=True) if u["id"] in unit_ids]
    vis = scope.filter(rows)
    return [u for u, _d in vis], {u["id"] for u, d in vis if d}


def _send(db: Database, row: dict[str, Any], digits: str, text: str, attachment: Any, now: dt.datetime) -> tuple[str, str | None]:
    """One message through the shared account, pacing and adapter. Returns (status, reason)."""
    from .notify_whatsapp import transport
    from .tickets.channel import NOT_SENT, REFUSED, SENT, OutboundMessage, Recipient
    from .tickets.channel_whatsapp import WhatsAppChannel

    svc = mr.accounts_service(db)
    account = svc.resolve(USE_KEY)
    if account is None or not account.value:
        return "failed", "channel_unavailable"
    if not svc.status(account.key).sendable:
        return "retry", "channel_down"
    gate = ma.PacingGate(mr.DbSendLedger(db))
    from .notify_whatsapp import _messaging_key

    rkey = mr.recipient_key(_messaging_key(db), digits)
    decision = gate.check(account_key=account.key, pacing=svc.pacing(account.key), recipient_key=rkey, kind="message", now=now)
    if not decision.allowed:
        return "retry", "rate_limited"
    msg = OutboundMessage(outbox_id=row["id"], channel=CHANNEL, purpose="notify", recipient=Recipient(None, phone=digits), text=text, account=account)
    result = WhatsAppChannel(transport(), svc).send(msg)
    svc.note_result(account.key, result)
    if result.may_have_left:
        try:
            gate.record(account_key=account.key, use_key=USE_KEY, recipient_key=rkey, kind="message", now=now)
        except Exception:  # noqa: BLE001
            log.warning("temperature report send ledger row failed")
    if result.outcome == SENT:
        return "sent", None
    if result.outcome == REFUSED:
        return "failed", "provider_refused"
    if result.outcome == NOT_SENT:
        return "retry", result.outcome_code or "not_sent"
    return "failed", "unknown_outcome"  # it may have left: never retried


def run_schedules(conn: sqlite3.Connection, now_ts: float) -> int:
    from ..audit import audit

    tz = t.site_zone(conn)
    stamp = iso_utc(dt.datetime.fromtimestamp(now_ts, dt.timezone.utc))
    n = 0
    for s in conn.execute("SELECT * FROM infra_temp_report_schedules WHERE enabled = 1 AND next_run_at <= ?", (stamp,)).fetchall():
        d = dict(s)
        lo, hi = range_of(d["range_key"], now_ts, tz)
        for rcp in json.loads(d["recipients_json"]):  # one at a time: a vendor that can no longer be reached never blocks the others
            try:
                queue_send(conn, None, json.loads(d["units_json"]), lo, hi, d["lang"], [rcp], now_ts, schedule_id=d["id"], sender_id=d["created_by"])
            except SendInvalid as e:  # a recipient left / the scope changed: the schedule records why and keeps its cadence
                log.warning("temperature report schedule skipped: %s", e.code)
                audit(conn, actor=None, action="infra.temperature.report.schedule_skip", decision="denied", resource_type="infra_temp_report_schedule", resource_id=d["id"],
                      reason=e.code, details={"kind": rcp.get("kind")})
        nxt = next_run({"freq": d["freq"], "at": d["at"], "dow": d["dow"], "dom": d["dom"]}, now_ts, tz)
        conn.execute("UPDATE infra_temp_report_schedules SET last_run_at = ?, next_run_at = ? WHERE id = ?",
                     (stamp, iso_utc(dt.datetime.fromtimestamp(nxt, dt.timezone.utc)), d["id"]))
        n += 1
    return n


def _hand_off_vendor(db: Database, r: dict[str, Any], ts: float, now: dt.datetime, out: dict[str, int]) -> None:
    """A vendor row does NOT go through `_send` / `resolve_number` (those are for system users and their own consent): it is handed to the
    tickets message queue (`contact_reports.queue`), which owns the send hours, the pacing, the retries, the number / address rules and the
    outcome; the provider (temperature_vendor_reports) closes the row. The document (mode "link") is rendered first - outside any write
    transaction - and minted in the SAME transaction as the queue row, so no link exists without its message."""
    from ..audit import audit
    from . import temperature_pdf, temperature_report as rep
    from .tickets import contact_reports as cr
    from .tickets import out_documents

    req = json.loads(r["request_json"])
    channel = req.get("channel") or "whatsapp"
    attempts = int(r["attempts"] or 0) + 1
    why: str | None = None
    model: dict[str, Any] | None = None
    with db.connection(mode="read", label="temperature.wa.vendor") as conn:
        why = vendor_reports_reason(conn)
        if why is None:
            reach = cr.reach(conn, r["contact_id"], channel)
            why = None if reach == "ok" else reach
        if why is None:
            units, doors = _visible_units(conn, r["created_by"], req["units"]) if r["created_by"] else ([], set())  # only what the SENDER may see
            if not units:
                why = "no_reach"
            elif wants_document(conn, r):
                model = rep.build(conn, units, doors, int(req["from"]), int(req["to"]), req.get("lang") or "he", ts, chart=True, events=True, signature=False,
                                  people=people_in_links(conn))  # S3: a public link names no staff unless the installation says so
    pdf: bytes | None = None
    if why is None and model is not None:
        try:
            pdf = temperature_pdf.render(model)
        except temperature_pdf.PdfError as e:
            if e.code in ("pdf_page_limit", "pdf_too_large"):
                why = "document_too_large"
            elif attempts < 4:  # the engine is busy / unavailable: another try in a few minutes (the text is NOT sent without the document the sender asked for)
                with db.connection(label="temperature.wa.retry") as conn:
                    conn.execute("UPDATE infra_temp_report_sends SET status = 'retry', reason = ?, attempts = ?, not_before = ? WHERE id = ?",
                                 (e.code, attempts, iso_utc(now + dt.timedelta(minutes=5 * attempts)), r["id"]))
                out["retry"] += 1
                return
            else:
                why = e.code
    if why is None:
        with db.connection(label="temperature.wa.handoff") as conn:
            doc_id: str | None = None
            try:
                doc_id = attachment_for(conn, r, model or {}, pdf=pdf, now=now)
                cr.queue(conn, module=MODULE, source_id=r["id"], contact_id=r["contact_id"], requested_by=r["created_by"], idempotency_key=f"{MODULE}:{r['id']}",
                         use_key=USE_KEY, document_id=doc_id, channel=channel)
            except (cr.ReportRefused, out_documents.DocumentRefused) as e:
                why = e.code
                if doc_id:
                    out_documents.revoke(conn, doc_id, "send_failed", now)
            if why is None:
                conn.execute("UPDATE infra_temp_report_sends SET status = 'handed', reason = NULL, attempts = ? WHERE id = ?", (attempts, r["id"]))
                audit(conn, actor=None, action="infra.temperature.report.handoff", decision="allowed", resource_type="infra_temp_report_send", resource_id=r["id"],
                      details={"channel": channel, "units": len(req["units"]), "document": bool(doc_id)})
                out["handed"] += 1
                return
    with db.connection(label="temperature.wa.vendor_skip") as conn:
        audit(conn, actor=None, action="infra.temperature.report.handoff", decision="denied", resource_type="infra_temp_report_send", resource_id=r["id"],
              reason=why, details={"channel": channel})
    _finish(db, r["id"], "skipped", why, ts, attempts=attempts)
    out["skipped"] += 1


def _recipient_label(conn: sqlite3.Connection, user_id: str | None) -> str | None:
    """The recipient's display name for the audit row (a label, never a number)."""
    if not user_id:
        return None
    r = conn.execute("SELECT username, display_name FROM users WHERE id = ?", (user_id,)).fetchone()
    return (r["display_name"] or r["username"]) if r else None


def _user_document_audit(conn: sqlite3.Connection, r: dict[str, Any], doc_id: str | None, decision: str, status: str, reason: str | None,
                         extra: dict[str, Any] | None = None) -> None:
    """`infra.temperature.report.document.send`: who sent (the sender's user id), to which recipient (user id + display name), when (the audit
    time), the document id, the outcome. Never the number, the text, the link or the token; the downloads are counted on the document row and
    each one is audited by out_documents (`report.document.open`)."""
    from ..audit import audit

    audit(conn, actor=None, action="infra.temperature.report.document.send", decision=decision, resource_type="outbound_document" if doc_id else "infra_temp_report_send",
          resource_id=doc_id or r["id"], reason=reason if decision == "denied" else None,
          details={"send_id": r["id"], "sender": r.get("created_by"), "recipient": r.get("user_id"), "recipient_label": _recipient_label(conn, r.get("user_id")),
                   "status": status, "reason": reason, **(extra or {})})


def _user_document(db: Database, r: dict[str, Any], model: dict[str, Any], ts: float, now: dt.datetime, out: dict[str, int]) -> dict[str, Any] | None:
    """TEMPREPORT-297: render the recipient's PDF (outside any write transaction), mint it for him and derive the link. Returns {id, url, until,
    expires_at, max_opens}, or None after recording a retry (the PDF engine is busy) or a skip (too large / no public address / documents off)."""
    from . import temperature_pdf
    from .tickets import links as tlinks
    from .tickets import out_documents

    attempts = int(r["attempts"] or 0) + 1
    why: str | None = None
    pdf: bytes | None = None
    try:
        pdf = temperature_pdf.render(model)
    except temperature_pdf.PdfError as e:
        if e.code in ("pdf_page_limit", "pdf_too_large"):
            why = "document_too_large"
        elif attempts < 4:
            with db.connection(label="temperature.wa.retry") as conn:
                conn.execute("UPDATE infra_temp_report_sends SET status = 'retry', reason = ?, attempts = ?, not_before = ? WHERE id = ?",
                             (e.code, attempts, iso_utc(now + dt.timedelta(minutes=5 * attempts)), r["id"]))
            out["retry"] += 1
            return None
        else:
            why = e.code
    if why is None:
        with db.connection(label="temperature.wa.document") as conn:
            doc_id: str | None = None
            try:
                doc_id = attachment_for(conn, r, model, pdf=pdf, now=now)
                row = out_documents.row(conn, doc_id) if doc_id else None
                if row is None:
                    raise out_documents.DocumentRefused("documents_off")
                link = out_documents.url(conn, row)
                return {"id": doc_id, "url": link, "until": parse_utc(row["expires_at"]), "expires_at": row["expires_at"], "max_opens": int(row["max_opens"])}
            except out_documents.DocumentRefused as e:
                why = e.code
            except tlinks.PublicUrlError:
                why = "public_link_unavailable"
            if doc_id:
                out_documents.revoke(conn, doc_id, "send_failed", now)
    with db.connection(label="temperature.wa.document_skip") as conn:
        _user_document_audit(conn, r, None, "denied", "skipped", why)
    _finish(db, r["id"], "skipped", why, ts, attempts=attempts)
    out["skipped"] += 1
    return None


def _user_document_done(db: Database, r: dict[str, Any], doc: dict[str, Any], status: str, reason: str | None, units: int, now: dt.datetime) -> None:
    """After the send: a message that surely did not leave revokes its link (a retry mints a fresh one); `unknown_outcome` may have left, so the
    link stays live until it expires. One audit row either way."""
    from .tickets import out_documents

    with db.connection(label="temperature.wa.document_done") as conn:
        if status != "sent" and reason != "unknown_outcome":
            out_documents.revoke(conn, doc["id"], "send_failed", now)
        _user_document_audit(conn, r, doc["id"], "allowed" if status == "sent" else "denied", status, reason,
                             {"units": units, "expires_at": doc["expires_at"], "max_opens": doc["max_opens"]})


def process(db: Database, now_ts: float | None = None) -> dict[str, int]:
    """One pass: due schedules become send rows; due rows are sent inside the send hours (else held until the next opening). A system user's row is sent
    here; a vendor's row is handed to the tickets message queue (`_hand_off_vendor`) and closed later by the provider."""
    from . import temperature_report as rep
    from .notify_whatsapp import resolve_number
    from .tickets import hours
    from .tickets import messaging as tmsg

    ts = float(now_ts if now_ts is not None else time.time())
    now = dt.datetime.fromtimestamp(ts, dt.timezone.utc)
    stamp = iso_utc(now)
    out = {"scheduled": 0, "sent": 0, "held": 0, "handed": 0, "skipped": 0, "failed": 0, "retry": 0}
    with db.connection(label="temperature.wa.plan") as conn:
        try:
            out["scheduled"] = run_schedules(conn, ts)
        except sqlite3.Error:
            return out
        due = [dict(r) for r in conn.execute("""SELECT * FROM infra_temp_report_sends WHERE status IN ('queued','held','retry') AND not_before <= ?
                                                ORDER BY not_before LIMIT ?""", (stamp, PER_PASS)).fetchall()]
        if not due:
            return out
        window, tz = tmsg.send_window(conn, None), tmsg.time_zone(conn)
    if not hours.in_window(now, window, tz):
        nb = iso_utc(hours.next_opening(now, window, tz))
        for r in due:
            _finish(db, r["id"], "held", "send_hours", ts, not_before=nb)
            out["held"] += 1
        return out
    for r in due:
        if r["recipient_kind"] == "vendor":
            _hand_off_vendor(db, r, ts, now, out)
            continue
        req = json.loads(r["request_json"])
        doc_wanted = False
        with db.connection(mode="read", label="temperature.wa.build") as conn:
            found = resolve_number(conn, r["user_id"]) if r["user_id"] else None
            if found is None or found.consent != "granted":
                why = "no_address" if found is None else "no_consent"
                model = None
            else:
                units, doors = _visible_units(conn, r["user_id"], req["units"])  # the RECIPIENT's scope: the link carries nothing he may not see
                why = None if units else "no_reach"
                doc_wanted = bool(units) and wants_document(conn, r)
                model = (rep.build(conn, units, doors, int(req["from"]), int(req["to"]), req.get("lang") or found.lang, ts, chart=doc_wanted, events=doc_wanted,
                                   signature=False, people=people_in_links(conn)) if units else None)  # S3: no staff names behind a public link by default
        if why or model is None:
            _finish(db, r["id"], "skipped", why, ts, attempts=r["attempts"])
            out["skipped"] += 1
            continue
        doc: dict[str, Any] | None = None
        if doc_wanted:
            doc = _user_document(db, r, model, ts, now, out)
            if doc is None:
                continue  # retried later or skipped (recorded); the text never leaves without the document the mode promises
        text = rep.text_summary(model, link=doc["url"], until=doc["until"]) if doc else rep.text_summary(model)
        status, reason = _send(db, r, found.digits, text, doc["id"] if doc else None, now)  # type: ignore[union-attr]
        if doc:
            _user_document_done(db, r, doc, status, reason, len(model["units"]), now)
        attempts = int(r["attempts"] or 0) + 1
        if status == "retry" and attempts < 4:
            with db.connection(label="temperature.wa.retry") as conn:
                conn.execute("UPDATE infra_temp_report_sends SET status = 'retry', reason = ?, attempts = ?, not_before = ? WHERE id = ?",
                             (reason, attempts, iso_utc(now + dt.timedelta(minutes=5 * attempts)), r["id"]))
            out["retry"] += 1
            continue
        _finish(db, r["id"], "failed" if status == "retry" else status, reason, ts, attempts=attempts)
        out["sent" if status == "sent" else "failed"] += 1
    return out


def prune(conn: sqlite3.Connection, now_ts: float) -> int:
    cutoff = iso_utc(dt.datetime.fromtimestamp(now_ts - 90 * 86400, dt.timezone.utc))
    return conn.execute("DELETE FROM infra_temp_report_sends WHERE finished_at IS NOT NULL AND finished_at < ?", (cutoff,)).rowcount


from . import temperature_vendor_reports  # noqa: E402,F401 - registers the provider `temperature` of the vendor-report queue (once, at import)

__all__ = ["USE_KEY", "ATTACHMENT_MODES", "recipients", "queue_send", "process", "range_of", "next_run", "save_schedule", "schedules", "attachment_for", "parse_utc"]
