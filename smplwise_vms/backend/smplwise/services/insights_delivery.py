"""CR-INSIGHT215 slice 3 (owner question 4, answer: "send monthly only after setup and after choosing to enable"): the scheduled monthly delivery
of the building report.

What it is: on the chosen day of the month (1-28) and local time, the report of the PREVIOUS month goes out as a TEXT SUMMARY (the summary
lines of the report model, the same numbers as the PDF) by e-mail and / or WhatsApp. The full PDF stays in the system (download from the report
screen): neither transport carries a document today, exactly as for the temperature report (owner decision A of 2026-10-19). Nothing is built on a
document seam here; adding one later is a change of the message builders only.

OFF until the owner turns it on, in this order (each step is checked on the server, not only on the screen):
1. SETUP - the day, the time, the language and at least one working channel: e-mail needs the installation's outgoing mail to be configured
   (Settings › התראות › דוא"ל, the notification recipients get it); WhatsApp needs at least one chosen system user.
2. The report switch (`reports.building.enabled`) is on.
3. The ENABLE switch (`enabled`), turned on by someone with `system.configure` AND `insights.manage` after steps 1-2 hold. Turning it on records
   `enabled_at` and `enabled_by`; a month whose send time is BEFORE `enabled_at` is never sent retroactively. Turning it off, or any setup becoming
   incomplete, stops the next send without deleting the setup.

Who receives what: a WhatsApp recipient gets the summary built with HIS OWN permissions (only a user holding `reports.building` is sent anything;
a section he may not read is not in his message), on the number he opted in for himself (notify_whatsapp.resolve_number: no number / no consent =
`skipped`, the setup screen warns before). The e-mail goes to the installation's configured notification addresses and is built with the
permissions of the person who enabled the delivery (who must still hold `reports.building`). The shared WhatsApp account, pacing and send
hours are the same as every other sender (the use `insights.reports` inherits the notifications account).

Idempotent: `insights_report_sends` has one row per (month, channel, recipient), unique, so a month goes out once however often the worker runs and
whatever the restarts. A row that cannot leave is retried a few times (`MAX_ATTEMPTS`), then `failed`. No phone number, address or message text is
stored or audited: a row keeps the user id (or a short hash of an address), the month and the outcome."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import logging
import sqlite3
import time
from typing import Any

from ..db import Database, get_setting, new_id, set_setting
from ..rbac import INSTALLATION, authorize
from . import insights_access as access
from . import insights_common as ic
from . import messaging_accounts as ma
from . import messaging_runtime as mr
from .timeutil import iso_utc

log = logging.getLogger("smplwise.insights.delivery")

USE_KEY = "insights.reports"
MODULE = "insights"
CONFIG_KEY = "insights.delivery"
STATE_KEY = "insights.delivery.state"
MAX_USERS = 30
MAX_ATTEMPTS = 4
PER_PASS = 5
THROTTLE_S = 55.0
_HHMM = (0, 23, 0, 59)
_last_pass = 0.0

DEFAULTS: dict[str, Any] = {"enabled": False, "dom": 1, "at": "08:00", "lang": "he", "email": False, "whatsapp": False, "users": [],
                            "enabled_at": None, "enabled_by": None}
EDITABLE = ("dom", "at", "lang", "email", "whatsapp", "users")


def whatsapp_wanted(conn: sqlite3.Connection) -> bool:
    try:
        c = load(conn)
        return bool(c["enabled"] and c["whatsapp"])
    except Exception:  # noqa: BLE001 - before the migrations / unreadable: not wanted
        return False


def _uses(conn: sqlite3.Connection) -> tuple[ma.UseSpec, ...]:
    return (ma.UseSpec(USE_KEY, MODULE, "דוח בניין חודשי", inherits="notifications.whatsapp", active=lambda: whatsapp_wanted(conn)),)


mr.register_uses(_uses)
mr.register_label_renderer(MODULE, lambda conn, text: text, lambda conn: "דוחות")


class Invalid(ValueError):
    def __init__(self, code: str, fields: list[str]):
        super().__init__(code)
        self.code, self.fields = code, fields


# ---------------------------------------------------------------- the stored configuration

def load(conn: sqlite3.Connection) -> dict[str, Any]:
    """The saved configuration over the defaults. A corrupt row reads as the defaults - which is OFF (fail closed)."""
    raw = get_setting(conn, CONFIG_KEY, None)
    out = dict(DEFAULTS)
    if not raw:
        return out
    try:
        doc = json.loads(raw)
    except ValueError:
        return out
    if not isinstance(doc, dict):
        return out
    out.update({k: doc[k] for k in DEFAULTS if k in doc})
    out["enabled"] = out["enabled"] is True
    return out


def _state(conn: sqlite3.Connection) -> dict[str, Any]:
    try:
        v = json.loads(get_setting(conn, STATE_KEY, "{}") or "{}")
    except ValueError:
        return {}
    return v if isinstance(v, dict) else {}


def validate(body: Any, conn: sqlite3.Connection) -> dict[str, Any]:
    """The editable part of the configuration checked whole; `Invalid(fields)` names every bad field. Missing keys keep their saved value."""
    if not isinstance(body, dict) or set(body) - set(EDITABLE):
        raise Invalid("validation", ["config"])
    cur = load(conn)
    out = {k: cur[k] for k in EDITABLE}
    fields: list[str] = []
    if "dom" in body:
        v = body["dom"]
        if isinstance(v, bool) or not isinstance(v, int) or not 1 <= v <= 28:
            fields.append("dom")
        else:
            out["dom"] = v
    if "at" in body:
        v = body["at"]
        if not isinstance(v, str) or len(v) != 5 or v[2] != ":" or not (v[:2] + v[3:]).isdigit() or int(v[:2]) > 23 or int(v[3:]) > 59:
            fields.append("at")
        else:
            out["at"] = v
    if "lang" in body:
        if body["lang"] not in ("he", "en"):
            fields.append("lang")
        else:
            out["lang"] = body["lang"]
    for k in ("email", "whatsapp"):
        if k in body:
            if not isinstance(body[k], bool):
                fields.append(k)
            else:
                out[k] = body[k]
    if "users" in body:
        users = body["users"]
        if not isinstance(users, list) or len(users) > MAX_USERS or any(not isinstance(u, str) for u in users):
            fields.append("users")
        else:
            active = {r[0] for r in conn.execute("SELECT id FROM users WHERE active = 1").fetchall()}
            if any(u not in active for u in users):
                fields.append("users")
            else:
                out["users"] = list(dict.fromkeys(users))
    if fields:
        raise Invalid("validation", fields)
    return out


def mail_ready(conn: sqlite3.Connection) -> bool:
    from . import notify_email

    try:
        return notify_email.load_config(conn) is not None
    except Exception:  # noqa: BLE001
        return False


def setup_problems(conn: sqlite3.Connection, cfg: dict[str, Any]) -> list[str]:
    """Why the delivery cannot be turned on yet ([] = setup is complete). Stable codes the screen words."""
    out = []
    if not cfg["email"] and not cfg["whatsapp"]:
        out.append("no_channel")
    if cfg["email"] and not mail_ready(conn):
        out.append("email_not_configured")
    if cfg["whatsapp"] and not cfg["users"]:
        out.append("no_recipients")
    if not ic.switch_on(conn, ic.SW_REPORT):
        out.append("report_off")
    return out


def recipients(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """The users the WhatsApp text can go to. `reach` = ok | no_address | no_consent | no_permission (the person does not hold
    reports.building: nothing is sent to him). Never a number."""
    from .notify_visibility import principal_of
    from .notify_whatsapp import raw_number, resolve_number

    out = []
    for r in conn.execute("SELECT id, username, display_name FROM users WHERE active = 1 AND deleted_at IS NULL ORDER BY display_name, username").fetchall():
        p = principal_of(conn, r["id"])
        if p is None or not authorize(conn, p, ic.REPORT, INSTALLATION).allowed:
            reach = "no_permission"
        elif raw_number(conn, r["id"]) is None:
            reach = "no_address"
        else:
            found = resolve_number(conn, r["id"])
            reach = "ok" if found is not None and found.consent == "granted" else "no_consent"
        out.append({"id": r["id"], "name": r["display_name"] or r["username"], "reach": reach})
    return out


def view(conn: sqlite3.Connection) -> dict[str, Any]:
    cfg = load(conn)
    st = _state(conn)
    last = conn.execute("SELECT month, status, COUNT(*) AS n FROM insights_report_sends WHERE month = (SELECT MAX(month) FROM insights_report_sends) GROUP BY month, status").fetchall()
    return {"config": {k: cfg[k] for k in (*EDITABLE, "enabled", "enabled_at")}, "problems": setup_problems(conn, cfg), "email_ready": mail_ready(conn),
            "recipients": recipients(conn), "planned_month": st.get("planned"),
            "last": {"month": last[0]["month"], "counts": {r["status"]: r["n"] for r in last}} if last else None}


def save(conn: sqlite3.Connection, edit: dict[str, Any], enable: bool | None, user_id: str | None, now_ts: float) -> dict[str, Any]:
    """Store the validated edit and, when asked, the enable switch. Turning ON re-checks the whole setup (`Invalid('setup_incomplete')`)."""
    cfg = {**load(conn), **edit}
    if enable is True and not cfg["enabled"]:
        problems = setup_problems(conn, cfg)
        if problems:
            raise Invalid("setup_incomplete", problems)
        cfg.update(enabled=True, enabled_at=iso_utc(dt.datetime.fromtimestamp(now_ts, dt.timezone.utc)), enabled_by=user_id)
    elif enable is False:
        cfg.update(enabled=False)
    elif cfg["enabled"]:
        problems = [p for p in setup_problems(conn, cfg) if p != "report_off"]
        if problems:  # an edit that would leave an enabled delivery without a channel / recipients is refused, not silently disabled
            raise Invalid("setup_incomplete", problems)
    set_setting(conn, CONFIG_KEY, json.dumps(cfg, ensure_ascii=False, sort_keys=True))
    return cfg


# ---------------------------------------------------------------- when

def previous_month(now_ts: float, tz: Any) -> str:
    first = dt.datetime.fromtimestamp(now_ts, dt.timezone.utc).astimezone(tz).replace(day=1)
    p = first - dt.timedelta(days=1)
    return f"{p.year:04d}-{p.month:02d}"


def send_instant(now_ts: float, cfg: dict[str, Any], tz: Any) -> float:
    """The unix instant of this local month's send time (day `dom`, time `at`)."""
    from .temperature import local_instant

    now = dt.datetime.fromtimestamp(now_ts, dt.timezone.utc).astimezone(tz)
    return local_instant(dt.date(now.year, now.month, int(cfg["dom"])), int(cfg["at"][:2]) * 60 + int(cfg["at"][3:]), tz)


def due(conn: sqlite3.Connection, now_ts: float) -> str | None:
    """The month to plan now, or None: delivery on, setup complete, the send time of this month has come, it is not before the moment the
    delivery was enabled, and the month has not been planned yet."""
    cfg = load(conn)
    if not cfg["enabled"] or setup_problems(conn, cfg):
        return None
    tz = ic.site_zone(conn)
    at = send_instant(now_ts, cfg, tz)
    if now_ts < at or not cfg["enabled_at"] or at < ic.ts_of(cfg["enabled_at"]):
        return None
    month = previous_month(now_ts, tz)
    return None if _state(conn).get("planned") == month else month


def plan(conn: sqlite3.Connection, month: str, now_ts: float) -> int:
    """One row per recipient for `month`. Returns the rows made (0 is fine: the month is still marked planned)."""
    cfg = load(conn)
    stamp = iso_utc(dt.datetime.fromtimestamp(now_ts, dt.timezone.utc))
    n = 0

    def add(channel: str, key: str, user_id: str | None) -> None:
        nonlocal n
        cur = conn.execute("""INSERT OR IGNORE INTO insights_report_sends(id, month, channel, recipient_key, user_id, lang, status, not_before, created_by, created_at)
                              VALUES (?,?,?,?,?,?, 'queued', ?, ?, ?)""", (new_id(), month, channel, key, user_id, cfg["lang"], stamp, cfg["enabled_by"], stamp))
        n += cur.rowcount

    if cfg["email"]:
        from . import notify_email

        mail = notify_email.load_config(conn)
        for a in (mail.recipients if mail else ()):
            add("email", hashlib.sha256(a.lower().encode("utf-8")).hexdigest()[:16], None)
    if cfg["whatsapp"]:
        for uid in cfg["users"]:
            add("whatsapp", uid, uid)
    set_setting(conn, STATE_KEY, json.dumps({"planned": month}))
    return n


# ---------------------------------------------------------------- the message

def build_model(conn: sqlite3.Connection, principal: Any, month: str, lang: str, now_ts: float, store: Any = None) -> dict[str, Any] | None:
    """The report model as `principal` may read it (None when he may not read the report at all)."""
    from . import building_report as rep

    if not authorize(conn, principal, ic.REPORT, INSTALLATION).allowed or not ic.switch_on(conn, ic.SW_REPORT):
        return None
    return rep.build(conn, principal, list(ic.load(conn)["report"]["sections"]), month, lang, now_ts, store=store, **access.build_args(conn, principal))


def whatsapp_text(model: dict[str, Any]) -> str:
    from . import building_report as rep
    from .notify_whatsapp import TEXT_MAX, clean

    lang = model["lang"]
    L = rep.LABELS[lang]
    foot = "הדוח המלא (PDF) זמין ב-Arx." if lang == "he" else "The full PDF report is available in Arx."
    lines = [f'{L["title"]} · ⁦{model["month"]}⁩']
    lines += [f'{clean(x["title"], 30)}: {clean(x["text"], 120)}' for x in model["data"].get("summary") or []]
    out = "\n".join([*lines, foot])
    return out if len(out) <= TEXT_MAX else "\n".join([*lines[:1], *lines[1:][: max(0, TEXT_MAX // 60)], foot])[:TEXT_MAX]


def email_message(model: dict[str, Any], link_base: str = "") -> Any:
    from . import building_report as rep
    from . import notify_email as ne

    lang = model["lang"]
    L = rep.LABELS[lang]
    rows = [(x["title"], x["text"]) for x in model["data"].get("summary") or []]
    intro = f'{L["month"]}: {model["month"]}'
    note = "הדוח המלא (PDF) זמין להורדה ב-Arx." if lang == "he" else "The full PDF report is available for download in Arx."
    link = f"{link_base}/#/tickets/reports/building" if link_base else ""
    text = "\n".join([ne._rtl(L["title"]), ne._rtl(intro), "", *[ne._rtl(f"{k}: {v}") for k, v in rows], "", ne._rtl(note), "", ne._rtl(ne.FOOTER)])
    return ne.Rendered(f'Arx · {L["title"]} {model["month"]}', text, ne._page(L["title"], rows, "info", link, ne.FOOTER, f"{intro} · {note}", cta=False))


# ---------------------------------------------------------------- sending

def _finish(db: Database, sid: str, status: str, reason: str | None, now_ts: float, *, attempts: int | None = None, not_before: str | None = None) -> None:
    stamp = iso_utc(dt.datetime.fromtimestamp(now_ts, dt.timezone.utc))
    with db.connection(label="insights.delivery.finish") as conn:
        if status in ("held", "retry"):
            conn.execute("UPDATE insights_report_sends SET status = ?, reason = ?, not_before = COALESCE(?, not_before), attempts = COALESCE(?, attempts) WHERE id = ?",
                         (status, reason, not_before, attempts, sid))
        else:
            conn.execute("UPDATE insights_report_sends SET status = ?, reason = ?, finished_at = ?, attempts = COALESCE(?, attempts) WHERE id = ?", (status, reason, stamp, attempts, sid))


def _send_whatsapp(db: Database, row: dict[str, Any], digits: str, text: str, now: dt.datetime) -> tuple[str, str | None]:
    """One message through the shared account, pacing and adapter (the same path as every other sender). (status, reason)."""
    from .notify_whatsapp import _messaging_key, transport
    from .tickets.channel import NOT_SENT, REFUSED, SENT, OutboundMessage, Recipient
    from .tickets.channel_whatsapp import WhatsAppChannel

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
    msg = OutboundMessage(outbox_id=row["id"], channel="whatsapp", purpose="notify", recipient=Recipient(None, phone=digits), text=text, account=account)
    result = WhatsAppChannel(transport(), svc).send(msg)
    svc.note_result(account.key, result)
    if result.may_have_left:
        try:
            gate.record(account_key=account.key, use_key=USE_KEY, recipient_key=rkey, kind="message", now=now)
        except Exception:  # noqa: BLE001
            log.warning("insights report send ledger row failed")
    if result.outcome == SENT:
        return "sent", None
    if result.outcome == REFUSED:
        return "failed", "provider_refused"
    if result.outcome == NOT_SENT:
        return "retry", result.outcome_code or "not_sent"
    return "failed", "unknown_outcome"  # it may have left: never retried


def _retry_or_fail(db: Database, row: dict[str, Any], reason: str | None, ts: float, now: dt.datetime, out: dict[str, int]) -> None:
    attempts = int(row["attempts"] or 0) + 1
    if attempts < MAX_ATTEMPTS:
        _finish(db, row["id"], "retry", reason, ts, attempts=attempts, not_before=iso_utc(now + dt.timedelta(minutes=5 * attempts)))
        out["retry"] += 1
    else:
        _finish(db, row["id"], "failed", reason, ts, attempts=attempts)
        out["failed"] += 1


def _deliver_email(db: Database, row: dict[str, Any], ts: float, now: dt.datetime, out: dict[str, int], store: Any) -> None:
    from . import notify_email as ne
    from .notify_visibility import principal_of

    month = row["month"]
    with db.connection(mode="read", label="insights.delivery.mail") as conn:
        cfg = ne.load_config(conn)
        mail = None
        target = None
        if cfg is not None:
            target = next((a for a in cfg.recipients if hashlib.sha256(a.lower().encode("utf-8")).hexdigest()[:16] == row["recipient_key"]), None)
        who = principal_of(conn, row["created_by"]) if row["created_by"] else None
        model = build_model(conn, who, month, row["lang"], ts, store) if who is not None else None
        if model is not None and cfg is not None and target is not None:
            mail = email_message(model, cfg.link_base)
    if cfg is None or target is None:
        _finish(db, row["id"], "skipped", "email_not_configured", ts)
        out["skipped"] += 1
        return
    if model is None or mail is None:
        _finish(db, row["id"], "skipped", "not_permitted", ts)
        out["skipped"] += 1
        return
    try:
        ne.smtp_send(cfg, target, mail)
    except ne.MailError as e:
        if e.transient:
            _retry_or_fail(db, row, e.kind, ts, now, out)
        else:
            _finish(db, row["id"], "failed", e.kind, ts, attempts=int(row["attempts"] or 0) + 1)
            out["failed"] += 1
        return
    _finish(db, row["id"], "sent", None, ts, attempts=int(row["attempts"] or 0) + 1)
    out["sent"] += 1


def _deliver_whatsapp(db: Database, row: dict[str, Any], ts: float, now: dt.datetime, out: dict[str, int], store: Any) -> None:
    from .notify_visibility import principal_of
    from .notify_whatsapp import resolve_number

    with db.connection(mode="read", label="insights.delivery.wa") as conn:
        found = resolve_number(conn, row["user_id"]) if row["user_id"] else None
        who = principal_of(conn, row["user_id"]) if row["user_id"] else None
        why: str | None = None
        text = ""
        if found is None:
            why = "no_address"
        elif found.consent != "granted":
            why = "no_consent"
        elif who is None:
            why = "no_user"
        else:
            model = build_model(conn, who, row["month"], row["lang"], ts, store)
            if model is None:
                why = "not_permitted"
            else:
                text = whatsapp_text(model)
    if why:
        _finish(db, row["id"], "skipped", why, ts)
        out["skipped"] += 1
        return
    status, reason = _send_whatsapp(db, row, found.digits, text, now)  # type: ignore[union-attr]
    if status == "retry":
        _retry_or_fail(db, row, reason, ts, now, out)
        return
    _finish(db, row["id"], status, reason, ts, attempts=int(row["attempts"] or 0) + 1)
    out["sent" if status == "sent" else "failed"] += 1


def process(db: Database, now_ts: float | None = None, store: Any = None) -> dict[str, int]:
    """One pass: plan the month when it is due, then send the due rows (WhatsApp only inside the installation's send hours)."""
    from .tickets import hours
    from .tickets import messaging as tmsg

    ts = float(now_ts if now_ts is not None else time.time())
    now = dt.datetime.fromtimestamp(ts, dt.timezone.utc)
    stamp = iso_utc(now)
    out = {"planned": 0, "sent": 0, "held": 0, "skipped": 0, "failed": 0, "retry": 0}
    with db.connection(label="insights.delivery.plan") as conn:
        try:
            month = due(conn, ts)
            if month is not None:
                out["planned"] = plan(conn, month, ts)
            rows = [dict(r) for r in conn.execute("SELECT * FROM insights_report_sends WHERE status IN ('queued','held','retry') AND not_before <= ? ORDER BY not_before LIMIT ?",
                                                  (stamp, PER_PASS)).fetchall()]
            window, tz = tmsg.send_window(conn, None), tmsg.time_zone(conn)
            if rows and not ic.switch_on(conn, ic.SW_REPORT):
                rows = []  # the report was switched off after the plan: nothing leaves
        except sqlite3.Error:
            return out
    for r in rows:
        if r["channel"] == "whatsapp" and not hours.in_window(now, window, tz):
            _finish(db, r["id"], "held", "send_hours", ts, not_before=iso_utc(hours.next_opening(now, window, tz)))
            out["held"] += 1
            continue
        try:
            (_deliver_email if r["channel"] == "email" else _deliver_whatsapp)(db, r, ts, now, out, store)
        except Exception:  # noqa: BLE001 - one bad row never stops the others; it is retried, then failed
            log.warning("insights report delivery row failed", exc_info=True)
            _retry_or_fail(db, r, "internal", ts, now, out)
    return out


def janitor(db: Database, settings: Any = None, now_ts: float | None = None) -> dict[str, int] | None:
    """main.janitor_tick (every 30 s): self-throttled to once a minute; a read first so a quiet installation takes no write lock."""
    global _last_pass
    t = float(now_ts if now_ts is not None else time.time())
    if t - _last_pass < THROTTLE_S:
        return None
    _last_pass = t
    with db.connection(mode="read", label="insights.delivery.peek") as conn:
        try:
            busy = load(conn)["enabled"] or conn.execute("SELECT 1 FROM insights_report_sends WHERE status IN ('queued','held','retry') LIMIT 1").fetchone() is not None
        except sqlite3.Error:
            return None
    if not busy:
        return None
    store = None
    if settings is not None:
        from pathlib import Path

        from . import energy_store as st

        if (Path(settings.data_dir) / st.FILE_NAME).exists():
            store = st.store_for(settings)
    out = process(db, t, store)
    with db.connection(label="insights.delivery.prune") as conn:
        cutoff = iso_utc(dt.datetime.fromtimestamp(t - 400 * 86400, dt.timezone.utc))
        conn.execute("DELETE FROM insights_report_sends WHERE finished_at IS NOT NULL AND finished_at < ?", (cutoff,))
    return out


def reset() -> None:
    global _last_pass
    _last_pass = 0.0

