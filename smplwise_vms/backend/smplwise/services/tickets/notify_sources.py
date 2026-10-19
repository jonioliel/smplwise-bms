"""CR-038 section 13.4: the module's CR-018 notification sources, as plain data (services/notify_policy.py builds its `Source` rows from
this list - no import of the notification engine here, so the catalogue can be read while notify_policy is still loading).

Titles and bodies are rendered by services/tickets/notify_bridge.py at emit time - with the module's configured name (D33) - and
reach the engine as the `title` / `body` parameters; the catalogue templates are therefore just "{title}" / "{body}". The settings
labels never name the module (a rename must not leave a stale word in the policy matrix); the category is `tickets`.

Recipients: `ticket_managers` (the manager members of the ticket's department; `ticket.new_unassigned` only those with notify_new),
`ticket_assignee` (the internal assignee), `managers` for the installation-level `ticket.channel_down`. Visibility: subject kind
`ticket` -> services/tickets/access.visible (notify_visibility), `system` for the channel source. All are OFF while the module is
off (the bridge emits nothing, and the policy matrix does not list them)."""
from __future__ import annotations

from typing import Any

PREFIX = "ticket."
CATEGORY = "tickets"
RULE_MANAGERS = "ticket_managers"
RULE_ASSIGNEE = "ticket_assignee"
SUBJECT = "ticket"
# TKRFQ5 (RFQ contract section 16): the requests-for-quotation sources. Subject kind `rfq` (visibility = rfq.visible, the request's own
# rule), recipients `rfq_managers` (the RFQ manager rule: the creator, the internal owner and the department's managers, each with
# tickets.external where the request lies). Rendered by services/tickets/rfq_notify.py; never an amount, a vendor name or a text.
RFQ_PREFIX = "rfq."
RULE_RFQ_MANAGERS = "rfq_managers"
SUBJECT_RFQ = "rfq"
PREFIXES = (PREFIX, RFQ_PREFIX)

# key, label (settings matrix, no module noun), severity (the default; a ticket's priority decides at emit time), who, push, resolves, subject
SOURCE_DEFS: tuple[dict[str, Any], ...] = (
    {"key": "ticket.new_unassigned", "label": "חדש וממתין למטפל", "severity": "alert", "who": RULE_MANAGERS, "resolves": True},
    {"key": "ticket.assigned", "label": "הועבר לטיפולך", "severity": "alert", "who": RULE_ASSIGNEE, "resolves": True},
    {"key": "ticket.reminder", "label": "תזכורת למטפל", "severity": "alert", "who": RULE_ASSIGNEE, "resolves": True},
    {"key": "ticket.stuck", "label": "חריגה מזמני הטיפול", "severity": "alert", "who": RULE_MANAGERS, "resolves": True},
    {"key": "ticket.returned", "label": "הוחזר למנהל", "severity": "alert", "who": RULE_MANAGERS, "resolves": True},
    {"key": "ticket.done", "label": "טיפול הסתיים - ממתין לסגירה", "severity": "info", "who": RULE_MANAGERS, "resolves": True, "push": False},
    {"key": "ticket.reply_unmatched", "label": "תשובה שלא שויכה", "severity": "info", "who": RULE_MANAGERS, "resolves": True, "push": False},
    {"key": "ticket.send_failed", "label": "הודעה למטפל לא נשלחה", "severity": "alert", "who": RULE_MANAGERS, "resolves": True},
    {"key": "ticket.contact_changed", "label": "פרטי איש קשר השתנו", "severity": "alert", "who": RULE_MANAGERS, "resolves": True},
    {"key": "ticket.channel_down", "label": "חשבון וואטסאפ מנותק", "severity": "alert", "who": "managers", "resolves": True, "subject": "system"},
    {"key": "ticket.cost_submitted", "label": "הוגשה דרישת תשלום", "severity": "info", "who": RULE_MANAGERS, "resolves": True},  # S9b: audience `costs`
    {"key": "ticket.cost_missing", "label": "לא הוגשה דרישת תשלום", "severity": "alert", "who": RULE_MANAGERS, "resolves": True},  # S9b: audience `costs`
    # TKSTAFF1 (security review F3): the user's own mobile for no-login work links was set / changed by someone else - told to that user
    # only (subject `session` = the user), never the number
    {"key": "ticket.staff_mobile", "label": "הנייד שלי לקישורי עבודה השתנה", "severity": "info", "who": "initiator", "resolves": False,
     "subject": "session"},
    # VPORTALRFQ: a vendor company asked in the portal to add / replace a technician - to the managers (installation level, subject
    # `system`), resolved when an editor decides or the vendor withdraws it; no name, no number in the text
    {"key": "ticket.portal_tech_request", "label": "בקשת ספק לעדכון טכנאי",  # no label_en, like the other ticket sources
     "severity": "info", "who": "managers", "resolves": True, "subject": "system", "push": False},
    # TKRFQ5: what a vendor did on his quote page (or by a WhatsApp reply) and the deadline - to the RFQ managers only
    {"key": "rfq.quote_received", "label": "הצעת מחיר התקבלה או עודכנה", "label_en": "Quote received or updated", "severity": "info",
     "who": RULE_RFQ_MANAGERS, "resolves": True, "subject": SUBJECT_RFQ},
    {"key": "rfq.declined", "label": "ספק השיב שאינו מעוניין", "label_en": "Vendor declined", "severity": "info", "who": RULE_RFQ_MANAGERS,
     "resolves": True, "subject": SUBJECT_RFQ, "push": False},
    {"key": "rfq.question", "label": "שאלת הבהרה מספק", "label_en": "Clarification question from a vendor", "severity": "alert",
     "who": RULE_RFQ_MANAGERS, "resolves": True, "subject": SUBJECT_RFQ},
    {"key": "rfq.due_passed", "label": "המועד להגשת הצעות עבר", "label_en": "Quote deadline passed", "severity": "info",
     "who": RULE_RFQ_MANAGERS, "resolves": True, "subject": SUBJECT_RFQ},
    # CR-RFQ-PAYMENT-SCHEDULE: the awarded vendor confirmed his arrival date (+ the payment schedule) or proposed another date
    {"key": "rfq.arrival", "label": "ספק אישר מועד הגעה או הציע מועד אחר", "label_en": "Vendor confirmed or proposed an arrival date",
     "severity": "info", "who": RULE_RFQ_MANAGERS, "resolves": True, "subject": SUBJECT_RFQ},
    # RFQQUESTIONS: a vendor question still unanswered after `rfq.question_reminder_hours` (default 24, 0 = off)
    {"key": "rfq.question_unanswered", "label": "שאלת ספק ממתינה לתשובה", "label_en": "Vendor question waiting for an answer",
     "severity": "alert", "who": RULE_RFQ_MANAGERS, "resolves": True, "subject": SUBJECT_RFQ},
    # RFQPAY2: an approved instalment passed its due day and is not marked paid - the RFQ managers who see the costs (audience `costs`);
    # resolved when nothing of that award is overdue any more. WhatsApp off by default (as every source)
    {"key": "rfq.instalment_overdue", "label": "מועד תשלום לספק עבר", "label_en": "Vendor payment past its date", "severity": "alert",
     "who": RULE_RFQ_MANAGERS, "resolves": True, "subject": SUBJECT_RFQ},
    # CR-AWARD-NOTICE: the awarded vendor gave notice through his link that he postpones the work (the reference and the place only);
    # resolved when a manager moves the arrival window or acknowledges it, or the request ends
    {"key": "rfq.vendor_postponement", "label": "ספק הודיע על דחיית העבודה", "label_en": "Vendor gave notice of postponing the work",
     "severity": "alert", "who": RULE_RFQ_MANAGERS, "resolves": True, "subject": SUBJECT_RFQ},
    # MGRDASH phases 4-5 (docs/design/MANAGER_DASHBOARD_SPEC_HE.md section 9): the manager overview's alerts - ALL OFF by default
    # (`enabled: False`), switched on in the notification settings. Never a person in the text, never an amount.
    # phase 4: an approved instalment is due tomorrow and not marked paid - the RFQ managers who may mark it (tickets.costs + view,
    # audience `pay`); one row per award and day, resolved when it is paid / moved or the day comes
    {"key": "rfq.instalment_due_tomorrow", "label": "מועד תשלום לספק מחר", "label_en": "Vendor payment due tomorrow", "severity": "info",
     "who": RULE_RFQ_MANAGERS, "resolves": True, "subject": SUBJECT_RFQ, "enabled": False},
)
KEYS: tuple[str, ...] = tuple(d["key"] for d in SOURCE_DEFS)
LABELS_EN: dict[str, str] = {d["key"]: d["label_en"] for d in SOURCE_DEFS if d.get("label_en")}


def module_on(conn: Any) -> bool:
    """The module switch, read without importing the module's services (the policy matrix hides these sources while it is off)."""
    try:
        row = conn.execute("SELECT value FROM settings WHERE key = 'tickets.enabled'").fetchone()
    except Exception:  # noqa: BLE001 - a database without the settings table (a unit fixture) has no module either
        return False
    return bool(row) and str(row[0]) == "true"


def listed(conn: Any, source_key: str) -> bool:
    """Whether the policy matrix lists a source now: every non-ticket source; the ticket and RFQ sources only while the module is on."""
    return not source_key.startswith(PREFIXES) or module_on(conn)


def source_kwargs() -> list[dict[str, Any]]:
    """The keyword arguments of notify_policy.Source for every ticket source."""
    return [
        {"key": d["key"], "label": d["label"], "category": CATEGORY, "severity": d["severity"], "title": "{title}", "body": "{body}",
         "who": d["who"], "push": d.get("push", True), "subject": d.get("subject", SUBJECT), "resolves": d["resolves"], "resolve_text": "טופל",
         "enabled": d.get("enabled", True)}
        for d in SOURCE_DEFS
    ]
