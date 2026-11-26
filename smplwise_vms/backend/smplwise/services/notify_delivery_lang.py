"""NOTIFY-RECIPIENT-LANG-2520: a notification DELIVERY speaks the recipient's language.

The notification centre already shows a row in the reader's interface language (I18N-REST-2520, services/notify.serialize): the row keeps
the Hebrew title / body it was written with plus the signal's params, and an English reader gets the same source's English templates
(services/notify_policy_en.py) rendered from those params. This module gives the delivery channels the same thing, per recipient:

- Web Push (services/notify_channels.WebPushChannel) and the phone app (services/mobile_push.AppPushChannel): the recipient is a user;
  the language is that user's stored `ui.lang` (services/default_names.lang_of_user; no value, an unknown value or no user = Hebrew).
- e-mail (services/notify_email.EmailChannel): the recipient is an installation-level address the administrator typed, not a user. Its
  language is the `ui.lang` of the active Arx user whose own e-mail (`users.email`, "for the notification e-mail channel only") is that
  address - when every such user agrees; no such user, or users in different languages = Hebrew.
- WhatsApp is NOT changed here: its message texts are approved templates owned outside this team (services/notify_whatsapp.py).

What is translated: the title and body ONLY when the stored Hebrew is exactly what the source's Hebrew templates give for the stored params
(the same guard as the centre: a row written by an older version, or a body from its own `_template`, goes out as stored), the source's
resolve text when the resolve notice carries that very text, and the fixed words the channels add themselves (severity, "new notification",
"ended", the action buttons, the mail's labels). Names inside the params (a place, a device) are data and stay as they were written.
A Hebrew recipient gets the same bytes as before. Nothing is written back to the row.
"""
from __future__ import annotations

import json
import logging
import sqlite3
from typing import Any

from . import notify_policy as policies

log = logging.getLogger("smplwise.notify")

DEFAULT_LANG = "he"
_IN_CHUNK = 500

# The fixed words the channels add to a delivery, keyed by their Hebrew (the frontend's push preview uses the same English:
# frontend/src/i18n/lang/en/i18n/msg/api-notify.ts).
TEXT_EN: dict[str, str] = {
    # severity (notify_policy.SEVERITY_LABEL_HE)
    "מידע": "Info",
    "התראה": "Alert",
    "קריטי": "Critical",
    # Web Push / phone app payload (notify_channels.payload_v2)
    "התראה חדשה": "New notification",
    "הסתיים": "Ended",
    "אישור": "Acknowledge",
    "השתק לשעה": "Mute for an hour",
    "פתח דלת": "Open the door",
    # the test push of the browser and of the phone app
    "Arx · התראת בדיקה": "Arx · Test notification",
    "ההתראות פועלות במכשיר הזה.": "Notifications are working on this device.",
    # e-mail (notify_email.compose_notification / compose_digest / compose_test)
    "לא אושר: ": "Not acknowledged: ",
    "הסתיים: ": "Ended: ",
    "החמרה: ": "Severity raised: ",
    "חומרה": "Severity",
    "זמן": "Time",
    "מקום": "Place",
    "מספר אירועים": "Occurrences",
    "מצב": "Status",
    "פרטים": "Details",
    "טרם אושר - הועבר לאחראים": "Not acknowledged yet - passed on to the people in charge",
    "לפרטים ולטיפול - היכנסו ל־Arx.": "For details and handling, sign in to Arx.",
    "פתח ב־Arx": "Open in Arx",
    "נשלח אוטומטית מ־Arx. אין להשיב להודעה זו.": "Sent automatically by Arx. Please do not reply to this message.",
    "{total} התראות נוספות": "{total} more notifications",
    "ועוד {rest} סוגי התראות": "and {rest} more notification types",
    "בדקה האחרונה נוצרו התראות רבות; הן מקובצות כאן להודעה אחת.": "Many notifications were raised in the last minute; they are grouped here into one message.",
    "הודעת בדיקה מ־Arx": "Test message from Arx",
    "הודעת בדיקה": "Test message",
    "Arx · הודעת בדיקה": "Arx · Test message",
    "אם קיבלתם הודעה זו - הדואר היוצא מוגדר נכון.": "If you received this message, outgoing mail is set up correctly.",
}


def word(he: str, lang: str) -> str:
    """A fixed delivery text in `lang`: its English for an English recipient, else the Hebrew exactly as given."""
    if lang == DEFAULT_LANG:
        return he
    return TEXT_EN.get(he, he)


def severity_label(severity: str, lang: str) -> str:
    return word(policies.SEVERITY_LABEL_HE.get(severity, ""), lang) if severity in policies.SEVERITY_LABEL_HE else ""


def note_in(n: dict[str, Any], lang: str) -> dict[str, Any]:
    """The decoded notification row (notify._row_note) with its title and body in `lang`: the row itself for Hebrew; otherwise a COPY with
    the source's templates in that language rendered from the stored params - only when the stored Hebrew is exactly what the source's Hebrew
    templates give for those params. Anything else (an older row, a body from its own template, a failure) is the row as stored."""
    if lang == DEFAULT_LANG:
        return n
    try:
        params = n.get("params") or {}
        if (n.get("title"), n.get("body")) != policies.render(n["source"], params):
            return n
        title, body = policies.render(n["source"], params, lang)
    except Exception:  # noqa: BLE001 - the delivery goes out in Hebrew rather than not at all
        log.warning("notification %s: rendering in %s failed", n.get("id"), lang, exc_info=True)
        return n
    if (title, body) == (n.get("title"), n.get("body")):
        return n
    return {**n, "title": title, "body": body}


def resolve_text_in(source: str | None, text: str | None, lang: str) -> str | None:
    """The resolve notice's text in `lang`: the source's English resolve text when the notice carries the source's own Hebrew resolve text
    (or none); a text of its own stays as given."""
    if lang == DEFAULT_LANG or not source:
        return text
    s = policies.BY_KEY.get(source)
    if s is None or (text is not None and text != s.resolve_text):
        return text
    from .notify_policy_en import TEMPLATES_EN

    en = TEMPLATES_EN.get(policies.base_key(source))
    return en[2] if en is not None and en[2] else text


def user_langs(conn: sqlite3.Connection, user_ids: list[str]) -> dict[str, str]:
    """{user_id: interface language} for many users, one statement per 500 ids; a user without a valid stored `ui.lang` is Hebrew.
    The same rule as services/default_names.lang_of_user (one value per user, offered languages only)."""
    from .default_names import LANGS, lang_of_user

    ids = list(dict.fromkeys(u for u in user_ids if isinstance(u, str)))
    out = {u: DEFAULT_LANG for u in ids}
    try:
        for i in range(0, len(ids), _IN_CHUNK):
            chunk = ids[i:i + _IN_CHUNK]
            for r in conn.execute(f"SELECT user_id, value_json FROM user_prefs WHERE key = 'ui.lang' AND user_id IN ({','.join('?' * len(chunk))})", chunk).fetchall():
                out[r[0]] = _lang_value(r[1], LANGS)
    except sqlite3.Error:  # no prefs table yet (an old database): fall back to one lookup per user, which also says Hebrew on failure
        return {u: lang_of_user(conn, u) for u in ids}
    return out


def _lang_value(raw: Any, langs: tuple[str, ...]) -> str:
    try:
        value = json.loads(raw) if raw is not None else None
    except (ValueError, TypeError):
        return DEFAULT_LANG
    return value if isinstance(value, str) and value in langs else DEFAULT_LANG


def address_langs(conn: sqlite3.Connection, addresses: list[str] | tuple[str, ...]) -> dict[str, str]:
    """{address: language} for installation-level mail addresses: the `ui.lang` of the active users whose own e-mail is that address
    (case-insensitive) when they all agree; else Hebrew. Never says which user matched."""
    out = {a: DEFAULT_LANG for a in addresses}
    wanted = {a.strip().lower(): a for a in addresses if isinstance(a, str) and a.strip()}
    if not wanted:
        return out
    try:
        rows = conn.execute("SELECT id, email FROM users WHERE active = 1 AND email IS NOT NULL AND email != ''").fetchall()
    except sqlite3.Error:  # an old database without the column: every address is Hebrew, as before
        return out
    owners: dict[str, list[str]] = {}
    for r in rows:
        key = str(r[1]).strip().lower()
        if key in wanted:
            owners.setdefault(key, []).append(r[0])
    if not owners:
        return out
    langs = user_langs(conn, [u for us in owners.values() for u in us])
    for key, users in owners.items():
        found = {langs.get(u, DEFAULT_LANG) for u in users}
        if len(found) == 1:
            out[wanted[key]] = found.pop()
    return out
