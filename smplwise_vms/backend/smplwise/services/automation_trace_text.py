"""I18N-BACKEND-2490 (third pass): the words of a run's summary and trace (services/automation_trace.py) - Hebrew exactly as
automation_trace wrote it before this change, English written by hand with the words of the frontend's English catalogue
(frontend/src/i18n/lang/en/i18n/msg/api-automation.ts: "Ran at {hhmm} because {sentence}", 'The condition "{sentence}" passed';
msg/automation.ts for the trigger kinds). Keys are `trace.<name>`. The step and condition sentences inside them are the automation
sentences (`auto.*`, services/automation_text_i18n.py) and render on their own."""
from __future__ import annotations

from ..i18n import register

TEXTS: dict[str, tuple[str, str]] = {
    # describe_trigger: Home Assistant's trigger description
    "trigger": ("הפעלה", "Trigger"),
    "change_in": ("שינוי ב־{name}", "Change in {name}"),
    "value_change_in": ("שינוי ערך ב־{name}", "Value change in {name}"),
    "template": ("תבנית", "Template"),
    "kind.time": ("שעה קבועה", "Set time"),
    "kind.time_pattern": ("דפוס זמן", "Time pattern"),
    "kind.sun": ("שמש", "Sun"),
    "kind.homeassistant": ("הפעלת המערכת", "System start"),
    "kind.event": ("אירוע", "Event"),
    "kind.webhook": ("קריאה חיצונית", "External call"),
    "kind.zone": ("אזור", "Zone"),
    "kind.mqtt": ("הודעה", "Message"),
    "kind.manual": ("הרצה ידנית", "Manual run"),
    # summary
    "ran_at": ("רצה ב־{when} · {desc}", "Ran at {when} · {desc}"),
    "ran": ("רצה · {desc}", "Ran · {desc}"),
    "suffix_error": (" · נעצרה בשגיאה", " · stopped with an error"),
    "suffix_not_met": (" · התנאים לא התקיימו", " · the conditions were not met"),
    # detail
    "condition": ("תנאי", "Condition"),
    "ran_at_because": ("רצה ב־{when} כי {sentence}", "Ran at {when} because {sentence}"),
    "ran_because": ("רצה כי {sentence}", "Ran because {sentence}"),
    "cond_passed": ("התנאי '{sentence}' עבר", "The condition '{sentence}' passed"),
    "cond_failed": ("התנאי '{sentence}' לא עבר", "The condition '{sentence}' did not pass"),
    "did": ("ביצעה: {steps}", "Did: {steps}"),
    "stopped_error": ("נעצרה בשגיאה", "Stopped with an error"),
}

register("trace", TEXTS)
