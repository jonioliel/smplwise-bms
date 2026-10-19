"""CR-038 phase 2 (TKRULES-291, docs/changes/CR-038-TKRULES-NOTES.md): the engine that opens tickets from alerts.

A janitor step next to the SLA monitor (retention.janitor -> tick(), its own once-a-minute throttle). It READS the notification core's
open conditions (`notifications`, CR-018) - every alert source of the product already lands there as one open row per dedupe key with
its start (`first_at`) and its end (`state = resolved`) - and acts through the tickets service layer with the SYSTEM author only:

  fire   an open alert of a rule's source (and subject), active for the rule's hold time, not acted on yet by that rule:
           an OPEN ticket with the stable key  -> absorbed (a system note), no new ticket, not counted;
           today's tickets of the rule >= its limit -> suppressed (audited once; never retried later - no midnight burst);
           else -> create.create_by_rule() (placeless, unassigned, the alert as the first internal note) -> created;
           a refusal of the creation path (department inactive, priority gone) -> refused (audited).
  clear  a created / absorbed fire whose alert ended (resolved or pruned): a system note on the ticket and, when the rule says
         `comment_close` and the ticket is still `new` and unassigned (and no other occurrence it absorbed is still active), the system
         closes it. Once per fire.

Guards: the module switch and the document's `enabled` (the global kill switch) stop everything; `ticket_rule_fires` UNIQUE(rule,
notification) makes every step idempotent; at most store_rules.FIRE_SCAN new fires per rule per tick; the trigger sources exclude the
module's own (no loop). Each rule and each clear runs in a write transaction of its own: one bad row never stops the others."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import logging
import time
from typing import Any

from ...audit import audit
from ...db import Database, get_setting
from ...errors import ApiError
from ..timeutil import iso_utc, parse_utc, zone
from . import access, create, model, notify_bridge, rules_doc, sla, store, store_rules

log = logging.getLogger("smplwise.tickets.rules")

EVERY_S = 60
_LAST: dict[str, float] = {}
STATS: dict[str, Any] = {"last_run_at": None, "created": 0, "absorbed": 0, "suppressed": 0, "refused": 0, "cleared": 0, "closed": 0, "errors": 0}

SOURCE_NOTE = "נפתח אוטומטית מהכלל \"[rule]\".\nהתראה: [alert]\n[details]\nמקום: [place]\nפעילה מאז: [since]"
ABSORB_NOTE = "ההתראה חזרה: [alert]. לא {f:נפתחה|m:נפתח} {ticket} {f:נוספת|m:נוסף} - הטיפול ממשיך כאן."
CLEAR_NOTE = "ההתראה הסתיימה: [alert]."
CLOSED_NOTE = " {the_ticket} {f:נסגרה|m:נסגר} אוטומטית כי עוד לא {f:הועברה|m:הועבר} לטיפול."
NOT_CLOSED_NOTE = " {the_ticket} לא {f:נסגרה|m:נסגר} אוטומטית כי הטיפול כבר התחיל."


def utcnow() -> dt.datetime:
    """The engine's clock (tests replace it)."""
    return dt.datetime.now(dt.timezone.utc)


def _zone(conn) -> Any:
    return zone(get_setting(conn, "time.zone", None) or "Asia/Jerusalem")


def local_day(conn, now: dt.datetime) -> str:
    """The installation's local date of an instant: the daily limit counts per local day."""
    return now.astimezone(_zone(conn)).date().isoformat()


def stable_key(rule_id: str, alert_key: str) -> str:
    """`trule:<rule id>:<24 hex of sha256(the notification's dedupe key)>` - the same condition always gives the same key (bounded length,
    no raw entity id in the ticket row)."""
    return f"trule:{rule_id}:{hashlib.sha256(alert_key.encode('utf-8')).hexdigest()[:24]}"


def _source_label(source: str) -> str:
    from .. import notify_policy

    s = notify_policy.BY_KEY.get(source)
    return s.label if s else source


def values_of(conn, n: dict[str, Any]) -> dict[str, str]:
    """The template values of one alert row: its title, its body, its place, its source's label, its start in local time."""
    since = ""
    try:
        since = parse_utc(n["first_at"]).astimezone(_zone(conn)).strftime("%d/%m/%Y %H:%M")
    except (KeyError, TypeError, ValueError):
        since = ""
    return {"alert": n.get("title") or "", "details": n.get("body") or "", "place": n.get("place") or "", "source": _source_label(n.get("source") or ""),
            "since": since}


def _fill(conn, template: str, values: dict[str, str]) -> str:
    """A note of the engine: the module's name tokens (D33) first, then the alert's values (cleaned; a brace in them is plain text)."""
    text = access.text(conn, template)
    for k, v in values.items():
        text = text.replace(f"[{k}]", model.clean_text(v))
    return "\n".join(line for line in text.split("\n") if line.strip() and not line.strip().endswith(":"))


# ---------------------------------------------------------------- the tick

def tick(db: Database, *, force: bool = False) -> dict[str, int]:
    """The janitor step. Returns what this run did (all zero when throttled, the module is off or the kill switch is on)."""
    key = str(db.path)
    mono = time.monotonic()
    done = {"created": 0, "absorbed": 0, "suppressed": 0, "refused": 0, "cleared": 0, "closed": 0}
    if not force and mono - _LAST.get(key, -EVERY_S) < EVERY_S:
        return done
    _LAST[key] = mono
    now = utcnow()
    try:
        with db.connection(label="tickets.rules") as conn:
            if not access.module_on(conn):
                return done
            doc = rules_doc.read(conn)
        if not doc["enabled"]:
            return done
        for rule in doc["rules"]:
            if rule.get("invalid") or not rule.get("enabled"):
                continue
            try:
                with db.connection(label="tickets.rules") as conn:
                    for k, v in fire_rule(conn, doc, rule, now).items():
                        done[k] += v
            except Exception:  # noqa: BLE001 - one bad rule never stops the others
                STATS["errors"] += 1
                log.warning("tickets rule %s failed", rule.get("id"), exc_info=True)
        with db.connection(label="tickets.rules") as conn:
            pending = store_rules.pending_clears(conn)
        for fire in pending:
            try:
                with db.connection(label="tickets.rules") as conn:
                    r = clear_one(conn, doc, fire, now)
                done["cleared"] += 1 if r else 0
                done["closed"] += 1 if r == "closed" else 0
            except Exception:  # noqa: BLE001
                STATS["errors"] += 1
                log.warning("tickets rule clear failed on %s", fire.get("id"), exc_info=True)
    except Exception:  # noqa: BLE001 - a housekeeping step never fails the janitor
        STATS["errors"] += 1
        log.warning("tickets rule engine step failed", exc_info=True)
    for k, v in done.items():
        STATS[k] += v
    STATS["last_run_at"] = iso_utc(now)
    return done


def fire_rule(conn, doc: dict[str, Any], rule: dict[str, Any], now: dt.datetime) -> dict[str, int]:
    """Every new held alert of one rule (inside the caller's write transaction)."""
    out = {"created": 0, "absorbed": 0, "suppressed": 0, "refused": 0}
    if not rules_doc.source_allowed(rule["source"]):  # the catalogue changed under a stored rule: never a trigger
        return out
    held_before = iso_utc(now - dt.timedelta(minutes=int(rule.get("hold_min") or 0)))
    day = local_day(conn, now)
    limit = rules_doc.effective_limit(doc, rule)
    for n in store_rules.open_alerts(conn, rule["source"], rule.get("subject_id") or "", held_before, unfired_for=rule["id"]):
        outcome = fire_one(conn, rule, n, now, day, limit)
        if outcome:
            out[outcome] += 1
    return out


def fire_one(conn, rule: dict[str, Any], n: dict[str, Any], now: dt.datetime, day: str, limit: int) -> str | None:
    stamp = iso_utc(now)
    key = stable_key(rule["id"], n["dedupe_key"])
    data = {"rule_id": rule["id"], "source": n["source"], "notification_id": n["id"]}
    open_ticket = access.open_by_dedupe_key_system(conn, key)
    if open_ticket is None and store_rules.created_on(conn, rule["id"], day) >= limit:
        if store_rules.insert_fire(conn, rule_id=rule["id"], notification_id=n["id"], dedupe_key=key, outcome="suppressed", ticket_id=None,
                                   day=day, at=stamp, cleared=True):
            audit(conn, actor=None, action="tickets.rule.suppressed", decision="denied", resource_type="ticket_rule", resource_id=rule["id"],
                  reason="daily_limit", details={"limit": limit, "day": day, "source": n["source"], "notification_id": n["id"]})
            return "suppressed"
        return None
    values = values_of(conn, n)
    spec = create.TicketSpec(
        department_id=rule["department_id"], title=rules_doc.render(rule["title"], values, multiline=False, max_len=model.TITLE_MAX),
        description=rules_doc.render(rule.get("description") or "", values, multiline=True, max_len=model.DESCRIPTION_MAX),
        category_id=rule.get("category_id"), priority_id=rule.get("priority_id"), origin="rule", rule_ref=f"rule:{rule['id']}", dedupe_key=key)
    conn.execute("SAVEPOINT ticket_rule_fire")
    try:
        res = create.create_by_rule(conn, spec, source_note=_fill(conn, SOURCE_NOTE, {"rule": rule["name"], **values}),
                                    absorb_note=_fill(conn, ABSORB_NOTE, values), data=data)
        if not store_rules.insert_fire(conn, rule_id=rule["id"], notification_id=n["id"], dedupe_key=key, outcome=res.kind, ticket_id=res.ticket_id,
                                       day=day, at=stamp):
            conn.execute("ROLLBACK TO ticket_rule_fire")  # acted on meanwhile: nothing twice
            conn.execute("RELEASE ticket_rule_fire")
            return None
    except ApiError as exc:
        conn.execute("ROLLBACK TO ticket_rule_fire")
        conn.execute("RELEASE ticket_rule_fire")
        fields = [f.get("field") for f in (exc.details or {}).get("fields", []) if isinstance(f, dict)]
        if store_rules.insert_fire(conn, rule_id=rule["id"], notification_id=n["id"], dedupe_key=key, outcome="refused", ticket_id=None, day=day,
                                   at=stamp, cleared=True):
            audit(conn, actor=None, action="tickets.rule.refused", decision="denied", resource_type="ticket_rule", resource_id=rule["id"],
                  reason=exc.code, details={"fields": fields, "source": n["source"], "notification_id": n["id"]})
            return "refused"
        return None
    except BaseException:
        conn.execute("ROLLBACK TO ticket_rule_fire")
        conn.execute("RELEASE ticket_rule_fire")
        raise
    conn.execute("RELEASE ticket_rule_fire")
    return res.kind


def clear_one(conn, doc: dict[str, Any], fire: dict[str, Any], now: dt.datetime) -> str | None:
    """The end of one fire's alert: a system note (and the close when the rule says so and nobody took the ticket). Returns
    'noted' | 'closed' | None (nothing to do: the ticket is gone or already final)."""
    stamp = iso_utc(now)
    if not store_rules.mark_cleared(conn, fire["id"], stamp):
        return None
    row = store.ticket_row_system(conn, fire["ticket_id"]) if fire.get("ticket_id") else None
    if row is None or row["status"] in model.FINAL:
        return None
    rule = next((r for r in doc["rules"] if r.get("id") == fire["rule_id"]), None)
    n = store_rules.notification(conn, fire["notification_id"]) or {}
    values = values_of(conn, n) if n else {"alert": "", "details": "", "place": "", "source": "", "since": ""}
    held = bool(row.get("current_assignment_id")) and not row.get("asg_ended_at")
    wants_close = bool(rule and rule.get("on_clear") == "comment_close")
    others = store_rules.still_active_for_ticket(conn, row["id"], fire["id"])
    close = wants_close and row["status"] == "new" and not held and others == 0 and model.may_move("system", "new", "closed")
    text = CLEAR_NOTE + (CLOSED_NOTE if close else NOT_CLOSED_NOTE if wants_close and others == 0 else "")
    store.insert_event(conn, row["id"], "note", actor_kind="system", actor_name=create.SYSTEM_NAME, via="system", body=_fill(conn, text, values) or None,
                       data={"rule_ref": f"rule:{fire['rule_id']}", "alert_ended": True, "notification_id": fire["notification_id"]}, at=stamp)
    store.update_ticket(conn, row["id"], {"last_activity_at": stamp}, bump=False)
    if close and _close(conn, store.ticket_row_system(conn, row["id"]) or row, stamp, fire["rule_id"]):
        return "closed"
    return "noted"


def _close(conn, row: dict[str, Any], stamp: str, rule_id: str) -> bool:
    """The system closes a rule ticket nobody took (status new, no assignment) - the monitor's automatic close, for this case."""
    from .monitor import _purge_days

    purge = iso_utc(parse_utc(stamp) + dt.timedelta(days=_purge_days(conn)))
    fields = {"status": "closed", "closed_at": stamp, "closed_by": None, "current_assignment_id": None, "purge_after": purge,
              "waiting_on": "none", "waiting_reason": None, "last_activity_at": stamp}
    if not store.update_ticket(conn, row["id"], fields, expect_revision=row["revision"]):
        return False
    sla.refresh(conn, row["id"])
    store.set_sla_state(conn, row["id"], {"stuck_kind": None, "stuck_level": 0, "reminders_sent": 0, "next_check_at": None})
    store.insert_event(conn, row["id"], "closed", actor_kind="system", actor_name=create.SYSTEM_NAME, via="system", from_status="new", to_status="closed",
                       at=stamp, data={"rule_ref": f"rule:{rule_id}", "alert_ended": True})
    audit(conn, actor=None, action="ticket.close", decision="allowed", resource_type="ticket", resource_id=row["id"],
          details={"number": row["number"], "from": "new", "to": "closed", "actor": "system", "rule_ref": f"rule:{rule_id}"})
    notify_bridge.ticket_status(conn, row["id"], "new", "closed")
    return True


# ---------------------------------------------------------------- the dry run ("בדיקת כלל")

def _note_view(n: dict[str, Any]) -> dict[str, Any]:
    d = dict(n)
    for col, k in (("origin_json", "origin"), ("params_json", "params")):
        try:
            d[k] = json.loads(d.get(col) or "{}")
        except ValueError:
            d[k] = {}
    return d


def dry_run(conn, principal: Any, raw: Any, now: dt.datetime | None = None) -> dict[str, Any]:
    """What one rule (as typed in the editor, saved or not) would do now. Writes nothing. Lists only the alerts the CALLER may see
    (notify_visibility.Reach); raises rules_doc.Invalid for a rule that does not validate."""
    from ..notify_visibility import Reach

    rule, problems = rules_doc.validate_rule(conn, raw)
    if problems:
        raise rules_doc.Invalid(problems)
    now = now or utcnow()
    doc = rules_doc.read(conn)
    reach = Reach(conn, principal)
    rows = [n for n in store_rules.open_alerts(conn, rule["source"], rule["subject_id"], None, limit=200) if reach.can_see(_note_view(n))]
    held_before = iso_utc(now - dt.timedelta(minutes=rule["hold_min"]))
    held = [n for n in rows if n["first_at"] <= held_before]
    saved = rule.get("id") if any(r["id"] == rule.get("id") for r in doc["rules"]) else None
    limit = rules_doc.effective_limit(doc, rule)
    today = store_rules.created_on(conn, saved, local_day(conn, now)) if saved else 0
    first = held[0] if held else (rows[0] if rows else None)
    sample_values = {"alert": "דליפת מים", "details": "החיישן דיווח על מים.", "place": "קומה 1", "source": _source_label(rule["source"]), "since": ""}
    values = values_of(conn, first) if first else sample_values
    would = "create"
    if not doc["enabled"]:
        would = "rules_off"
    elif not rule["enabled"]:
        would = "rule_off"
    elif not rows:
        would = "nothing"
    elif not held:
        would = "wait_hold"
    else:
        target = next((n for n in held if not (saved and store_rules.fired(conn, saved, n["id"]))), None)
        if target is None:
            would = "already_handled"
        elif saved and access.open_by_dedupe_key_system(conn, stable_key(saved, target["dedupe_key"])) is not None:
            would = "absorb"
        elif today >= limit:
            would = "suppressed"
    dept = store.department(conn, rule["department_id"]) or {}
    pr = store.priority(conn, rule["priority_id"]) if rule.get("priority_id") else store.default_priority(conn, rule["department_id"])
    return {
        "would": would, "matches": len(rows), "held": len(held), "effective_limit": limit, "today_created": today, "sample_values": first is None,
        "alerts": [{"title": n.get("title") or "", "place": n.get("place") or "", "first_at": n["first_at"], "held": n["first_at"] <= held_before}
                   for n in rows[:5]],
        "preview": {"title": rules_doc.render(rule["title"], values, multiline=False, max_len=model.TITLE_MAX),
                    "description": rules_doc.render(rule["description"], values, multiline=True, max_len=model.DESCRIPTION_MAX),
                    "department": dept.get("name") or "", "priority": (pr or {}).get("name") or ""},
    }
