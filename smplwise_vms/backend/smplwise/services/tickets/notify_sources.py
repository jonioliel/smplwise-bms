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
)
KEYS: tuple[str, ...] = tuple(d["key"] for d in SOURCE_DEFS)


def module_on(conn: Any) -> bool:
    """The module switch, read without importing the module's services (the policy matrix hides these sources while it is off)."""
    try:
        row = conn.execute("SELECT value FROM settings WHERE key = 'tickets.enabled'").fetchone()
    except Exception:  # noqa: BLE001 - a database without the settings table (a unit fixture) has no module either
        return False
    return bool(row) and str(row[0]) == "true"


def listed(conn: Any, source_key: str) -> bool:
    """Whether the policy matrix lists a source now: every non-ticket source; the ticket sources only while the module is on."""
    return not source_key.startswith(PREFIX) or module_on(conn)


def source_kwargs() -> list[dict[str, Any]]:
    """The keyword arguments of notify_policy.Source for every ticket source."""
    return [
        {"key": d["key"], "label": d["label"], "category": CATEGORY, "severity": d["severity"], "title": "{title}", "body": "{body}",
         "who": d["who"], "push": d.get("push", True), "subject": d.get("subject", SUBJECT), "resolves": d["resolves"], "resolve_text": "טופל"}
        for d in SOURCE_DEFS
    ]
