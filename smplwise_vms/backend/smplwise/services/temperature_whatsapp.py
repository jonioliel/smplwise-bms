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
* DOCUMENT SENDING - the PDF itself, a temporary signed link, or an attached HTML report. The transport sends text only today
  (`whatsapp.send_message`). The switch is the installation setting `report_attachment` (ATTACHMENT_MODES; only "none" is accepted until a
  transport supports one): `attachment_for()` is the single seam that will return the document for a send, and `process()` already passes
  its result to `_send()`; turning a mode on needs the transport capability + the mode added to ATTACHMENT_MODES - no rework of the queue,
  schedules or dialog.
* VENDORS - sending to an external contact goes through the tickets message queue (`ticket_outbox`), whose `purpose` CHECK needs a
  table-rebuild migration. Until that is approved, vendors are listed in the dialog DISABLED with the reason `coming_later` and the API
  refuses them (422 `vendor_coming_later`). The rows and schedules already carry `recipient_kind`, so vendors (one-off AND scheduled,
  chosen per recipient - owner decision 6) need no schema change here."""
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
MODULE = "temperature"
CHANNEL = "whatsapp"
ATTACHMENT_MODES: tuple[str, ...] = ("none",)          # future: "pdf" | "link" | "html" (owner TODO, see the module docstring)
RANGE_KEYS: tuple[str, ...] = ("24h", "7d", "30d", "week", "month", "prev_week", "prev_month")
FREQS: tuple[str, ...] = ("daily", "weekly", "monthly")
PER_PASS = 5                                            # sends tried per 60 s pass (the account pacing holds the rest)
MAX_RECIPIENTS = 30


def _uses(conn: sqlite3.Connection) -> tuple[ma.UseSpec, ...]:
    return (ma.UseSpec(USE_KEY, MODULE, "דוחות טמפרטורה", inherits="notifications.whatsapp"),)


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

def recipients(conn: sqlite3.Connection) -> dict[str, Any]:
    """System users (selectable; `reach` says whether the summary can reach them: ok | no_address | no_consent - the owner: warn, but allow
    the selection) and vendors (listed, NOT selectable yet: `coming_later`). Never a number."""
    from .notify_whatsapp import raw_number, resolve_number

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
    for r in rows:
        vendors.append({"id": r["id"], "name": r["display_name"], "company": r["company"], "has_phone": bool(r["phone_e164"]),
                        "selectable": False, "reason": "coming_later"})
    return {"users": users, "vendors": vendors, "attachment": "none", "attachment_modes": list(ATTACHMENT_MODES)}


def _check_recipients(conn: sqlite3.Connection, items: list[dict[str, Any]]) -> list[dict[str, str]]:
    if not items or len(items) > MAX_RECIPIENTS:
        raise SendInvalid("validation", "יש לבחור נמענים.", "Choose recipients.", ["recipients"])
    active = {r[0] for r in conn.execute("SELECT id FROM users WHERE active = 1").fetchall()}
    out: list[dict[str, str]] = []
    for i, it in enumerate(items):
        kind, rid = it.get("kind"), it.get("id")
        if kind == "vendor":
            raise SendInvalid("vendor_coming_later", "שליחה לספקים תתאפשר בהמשך.", "Sending to vendors comes later.", [f"recipients.{i}"])
        if kind != "user" or rid not in active:
            raise SendInvalid("recipient_user", "משתמש לא מוכר.", "Unknown user.", [f"recipients.{i}"])
        if not any(o["id"] == rid for o in out):
            out.append({"kind": "user", "id": rid})
    return out


def queue_send(conn: sqlite3.Connection, principal: Any, unit_ids: list[str], lo: int, hi: int, lang: str, items: list[dict[str, Any]], now_ts: float,
               schedule_id: str | None = None) -> dict[str, Any]:
    """One send row per recipient (not before now; the send hours and the pacing decide when it really leaves)."""
    rec = _check_recipients(conn, items)
    batch = new_id()
    req = json.dumps({"units": unit_ids, "from": lo, "to": hi, "lang": lang if lang in ("he", "en") else "he"})
    stamp = iso_utc(dt.datetime.fromtimestamp(now_ts, dt.timezone.utc))
    for r in rec:
        conn.execute("""INSERT INTO infra_temp_report_sends(id, batch_id, schedule_id, recipient_kind, user_id, request_json, status, not_before, created_by, created_at)
                        VALUES (?,?,?,?,?,?, 'queued', ?, ?, ?)""", (new_id(), batch, schedule_id, r["kind"], r["id"], req, stamp, getattr(principal, "user_id", None), stamp))
    return {"batch_id": batch, "queued": len(rec)}


def batch_view(conn: sqlite3.Connection, batch_id: str) -> list[dict[str, Any]]:
    rows = conn.execute("""SELECT s.id, s.user_id, s.status, s.reason, s.not_before, s.finished_at, u.display_name, u.username FROM infra_temp_report_sends s
                           LEFT JOIN users u ON u.id = s.user_id WHERE s.batch_id = ? ORDER BY s.created_at""", (batch_id,)).fetchall()
    return [{"id": r["id"], "name": r["display_name"] or r["username"] or "", "status": r["status"], "reason": r["reason"], "not_before": r["not_before"],
             "finished_at": r["finished_at"]} for r in rows]


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
        cand = dt.datetime.combine(day, dt.time(h, m), tz).timestamp()
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

def attachment_for(conn: sqlite3.Connection, row: dict[str, Any], model: dict[str, Any]) -> Any:
    """THE seam of the deferred document sending (owner TODO): returns what to attach to this send - today always None (mode "none").
    A future mode ("pdf" via a media-capable transport, "link" = a short-lived signed download link, "html") returns its payload here;
    `_send` passes it on. Nothing else changes."""
    mode = t.load_defaults(conn).get("report_attachment", "none")
    if mode not in ATTACHMENT_MODES or mode == "none":
        return None
    return None  # pragma: no cover - no other mode exists yet


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
    tz = t.site_zone(conn)
    stamp = iso_utc(dt.datetime.fromtimestamp(now_ts, dt.timezone.utc))
    n = 0
    for s in conn.execute("SELECT * FROM infra_temp_report_schedules WHERE enabled = 1 AND next_run_at <= ?", (stamp,)).fetchall():
        d = dict(s)
        lo, hi = range_of(d["range_key"], now_ts, tz)
        try:
            queue_send(conn, None, json.loads(d["units_json"]), lo, hi, d["lang"], json.loads(d["recipients_json"]), now_ts, schedule_id=d["id"])
        except SendInvalid as e:  # a recipient left: the schedule records why and keeps its cadence
            log.warning("temperature report schedule skipped: %s", e.code)
        nxt = next_run({"freq": d["freq"], "at": d["at"], "dow": d["dow"], "dom": d["dom"]}, now_ts, tz)
        conn.execute("UPDATE infra_temp_report_schedules SET last_run_at = ?, next_run_at = ? WHERE id = ?",
                     (stamp, iso_utc(dt.datetime.fromtimestamp(nxt, dt.timezone.utc)), d["id"]))
        n += 1
    return n


def process(db: Database, now_ts: float | None = None) -> dict[str, int]:
    """One pass: due schedules become send rows; due rows are sent inside the send hours (else held until the next opening)."""
    from . import temperature_report as rep
    from .notify_whatsapp import resolve_number
    from .tickets import hours
    from .tickets import messaging as tmsg

    ts = float(now_ts if now_ts is not None else time.time())
    now = dt.datetime.fromtimestamp(ts, dt.timezone.utc)
    stamp = iso_utc(now)
    out = {"scheduled": 0, "sent": 0, "held": 0, "skipped": 0, "failed": 0, "retry": 0}
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
        req = json.loads(r["request_json"])
        with db.connection(mode="read", label="temperature.wa.build") as conn:
            found = resolve_number(conn, r["user_id"]) if r["user_id"] else None
            if found is None or found.consent != "granted":
                why = "no_address" if found is None else "no_consent"
                model = None
            else:
                units, doors = _visible_units(conn, r["user_id"], req["units"])
                why = None if units else "no_reach"
                model = rep.build(conn, units, doors, int(req["from"]), int(req["to"]), req.get("lang") or found.lang, ts, chart=False, events=False, signature=False) if units else None
                attachment = attachment_for(conn, r, model) if model else None
        if why or model is None:
            _finish(db, r["id"], "skipped", why, ts, attempts=r["attempts"])
            out["skipped"] += 1
            continue
        status, reason = _send(db, r, found.digits, rep.text_summary(model), attachment, now)  # type: ignore[union-attr]
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


__all__ = ["USE_KEY", "ATTACHMENT_MODES", "recipients", "queue_send", "process", "range_of", "next_run", "save_schedule", "schedules", "attachment_for", "parse_utc"]
