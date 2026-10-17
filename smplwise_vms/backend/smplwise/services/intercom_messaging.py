"""CR-036 WA: WhatsApp messages from the people screen - Arx's own rules (settings, templates, the credential guard, the record, the
limits, the opt-out list). The WisKey side is services/intercom_messaging_adapter.py; the routes are routers/access_control_messaging.py.

Owner decisions of 2026-10-12 (binding, private/wiskey-foldin/OWNER_ANSWERS_SCREENS_2026-10-12.md, answers 9 and 10): the sender may use
approved TEMPLATES and FREE TEXT; administrators edit the templates; the free-text box NEVER inserts a PIN or any credential by itself;
every send is audited in Arx; sending to several people at once with one template is in stage 1. Every decision below is an
administrator setting whose default is the owner's answer (or the safest value where the owner said nothing).

What lives here:

- the SETTINGS DOCUMENT (`access.messaging`, one JSON value in the settings table; deliberately NOT one of routers/settings.py DEFAULTS, so
  `GET /settings` - which every signed-in user may read - never carries the templates): `enabled` (the master switch, default OFF: the
  WisKey side, ask W11, is unanswered and nothing here has run against a real WisKey), `free_text` (default on), `bulk_max` (50),
  `rate_per_hour` (60, installation-wide), the 2.6.5 review's caps `per_sender_per_hour` (50) / `per_person_per_day` (3) /
  `per_station_per_hour` (50) and `send_hours` (08:00-21:00 local, null = off), `organization` (the `{organization}` value), `account`
  (which messaging account when WisKey has several), the TEMPLATES and a `revision`. Validation is the server's and total: a template body may hold the placeholders {name} and
  {organization} only, never anything that reads like a credential, no control characters, bounded sizes.
- the CREDENTIAL GUARD (a best-effort guard on what a sender TYPES; nothing in Arx knows a PIN, so nothing can insert one): a `{pin}`-style
  placeholder, or a credential word followed within a few characters by a run of 4-8 digits ("code 4821", "קוד הגישה 123456").
- the RECORD (`intercom_messages`, migration 0076): who sent which template (or "free") to which person, how many characters, and what
  happened - NEVER the text, a phone number, a PIN or WisKey's token. The row is written BEFORE anything is sent (no record, no message),
  carries the browser's `client_request_id` (a repeat is refused), and doubles as the rate counter and the person's message history.
  A message that provably never left Arx ("not sent") deletes its row again: the history lists what was handed on.
- the OPT-OUT LIST (`intercom_message_optout`): people who asked not to be messaged; enforced on every send whatever WisKey says.
- the PERSON RULE: who may message whom (`may_message`) - the person must be visible to the caller AND the caller must hold
  `access.people.message` on EVERY station the person is assigned to (the rule `person_editable` applies to writes).
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import re
import secrets
import sqlite3
import unicodedata
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable
from zoneinfo import ZoneInfo

from ..db import Database, get_setting, set_setting
from ..errors import ApiError
from . import intercom_authority as ia

log = logging.getLogger("smplwise.intercom")

PERMISSION = ia.PEOPLE_MESSAGE
SETTING_KEY = "access.messaging"
AUDIT_SEND = "intercom.person.message"
AUDIT_OPTOUT = "intercom.person.message_optout"
AUDIT_SETTINGS = "intercom.messaging.settings"

# ---------------------------------------------------------------- limits (the editor shows the same numbers: `limits()`)
TEXT_MAX = 1000  # a free text / a rendered template, as the sender sees it (WisKey itself allows 12 000)
LABEL_MAX = 40
BODY_MAX = 600
RENDERED_MAX = 1500  # the worst case of a template once {name} and {organization} are filled in
ORGANIZATION_MAX = 60
NAME_MAX = 128  # a person's display name as WisKey keeps it
TEMPLATES_MAX = 20
PLACEHOLDERS_MAX = 6  # per template
BULK_RANGE = (1, 200)
RATE_RANGE = (1, 1000)
DEFAULT_BULK_MAX = 50
DEFAULT_RATE_PER_HOUR = 60
# review F3 / F4 / F5 (2.6.5): the caps below the installation's hour, each an administrator setting
PER_SENDER_RANGE = (1, 1000)
PER_PERSON_DAY_RANGE = (1, 50)
PER_STATION_RANGE = (1, 1000)
DEFAULT_PER_SENDER_PER_HOUR = 50  # one sender: one full bulk run an hour, not the whole installation's allowance
DEFAULT_PER_PERSON_PER_DAY = 3  # one recipient (by record AND by number) - a notice, a reminder, a correction
DEFAULT_PER_STATION_PER_HOUR = 50  # the people of one station
DEFAULT_SEND_HOURS = {"from": "08:00", "to": "21:00"}  # local time, every day (the tickets' send-hours rules: from < to, end exclusive)
RUN_WINDOW_S = 600  # a sender's "run" as the server sees it (review F4): bulk_max messages per 10 minutes, whatever bulk_id says
DAY_S = 86400
DEFAULT_COUNTRY = "972"  # a local number with a leading 0, for the phone hash only
PHONE_KEY_SETTING = "access.messaging.phone_key"  # the HMAC key of the phone hashes (not a routers/settings.py DEFAULT: never served)
# WA-CONSENT-LINK (docs/changes/CR-WA-CONSENT-LINK.md): consent by link - the settings live in this same document
CONSENT_WAIT_RANGE = (1, 30)  # days a consent request waits for an answer before the held message is dropped
DEFAULT_CONSENT_WAIT_DAYS = 7
CONSENT_LANGS = ("he", "en", "ar", "ru")
WA_TEMPLATE_NAME = re.compile(r"^[a-z0-9_]{1,128}$")  # a WhatsApp Business template name (Meta: lowercase, digits, underscore)
WA_TEMPLATE_LANG = re.compile(r"^[a-z]{2,3}(?:_[A-Z]{2})?$")  # a WhatsApp template language code: he, en, en_US, ar, ru
CONSENT_KEYS = ("consent_by_link", "consent_wait_days", "consent_language", "consent_wa_template", "consent_wa_language")
WINDOW_S = 3600
PACE_MS = 2200  # the spacing the dialog keeps between the sends of one bulk run (the message lane refills 0.5 a second)
RECIPIENT_READS = 6  # the preview of a selection looks at this many people (each lookup spends a read token of the sender: the burst is 10); the rest are decided as each message goes
KEEP_DAYS = 400  # message records older than this are removed (the audit log keeps its own retention)
PENDING_STALE_S = 120  # a record still "pending" after this long is shown as unknown (the process died between the two rows)
HISTORY_MAX = 50
PLACEHOLDERS = ("name", "organization")
TEMPLATE_ID = re.compile(r"^[a-z0-9][a-z0-9_]{0,31}$")
COMMAND_ID = r"^[A-Za-z0-9-]{8,64}$"  # the browser's id of one attempt (no LIKE wildcards, no spaces)
BULK_ID = r"^[A-Za-z0-9-]{8,64}$"

DEFAULT_TEMPLATES: tuple[dict[str, str], ...] = (
    {"id": "card_ready", "label": "כרטיס מוכן", "body": "שלום {name}, כרטיס הכניסה שלך מוכן לאיסוף."},
    {"id": "validity_reminder", "label": "תזכורת תוקף", "body": "שלום {name}, תוקף הכניסה שלך מסתיים בקרוב. נא לפנות למשרד."},
    {"id": "closure", "label": "הכניסה סגורה", "body": "שלום {name}, הכניסה סגורה זמנית. נעדכן כשתיפתח שוב."},
)


def limits() -> dict[str, Any]:
    """The numbers the Settings editor validates against (the server is the judge; the editor only answers sooner)."""
    return {"templates_max": TEMPLATES_MAX, "label_max": LABEL_MAX, "body_max": BODY_MAX, "text_max": TEXT_MAX, "organization_max": ORGANIZATION_MAX,
            "bulk_max": list(BULK_RANGE), "rate_per_hour": list(RATE_RANGE), "per_sender_per_hour": list(PER_SENDER_RANGE),
            "per_person_per_day": list(PER_PERSON_DAY_RANGE), "per_station_per_hour": list(PER_STATION_RANGE),
            "placeholders": list(PLACEHOLDERS), "placeholders_max": PLACEHOLDERS_MAX}


# ---------------------------------------------------------------- the credential guard

# A placeholder that would put a credential into a text: {pin}, {code}, {card}, {password}, {token}, {credential...}. (The editor
# refuses any placeholder but {name} and {organization} anyway; this is the free text's guard and the belt over the braces.)
CREDENTIAL_PLACEHOLDER = re.compile(r"\{\s*(?:pin|code|passcode|card|password|token|credential|secret)\w*\s*\}", re.IGNORECASE)
# The words that introduce a code (en / de / fr / he / ru / ar), followed within CREDENTIAL_GAP characters - a line break included - by a
# run of 4-8 digits; matched against the NORMALISED forms of `_guard_forms` (review F1). No anchor after "pin" or around "code" (so
# "pincode", "Zugangscode", "accesscode" count); "pin" keeps a letter boundary BEFORE it ("opinion", "shopping" are not codes) and "pass"
# one after it ("passover"). "קוד" / "פין" never had anchors.
CREDENTIAL_GAP = 30
CREDENTIAL_WORDS = re.compile(
    r"(?:(?<![a-z])pin|code|pass(?![a-z])|password|passwort|kennwort|mot de passe|"
    r"קוד|סיסמ|ססמ|פין|"
    r"код|пин|пароль|"
    r"رمز|كود|كلمة السر|كلمة المرور|رقم سري)"
    r"[^0-9]{0," + str(CREDENTIAL_GAP) + r"}[0-9]{4,8}")
# Digits written as words (review F1): replaced by the digit before the match, so "four eight two one" reads "4 8 2 1" (then "4821").
_DIGIT_WORDS: dict[str, tuple[str, ...]] = {
    "0": ("zero", "אפס", "ноль", "нуль", "صفر"),
    "1": ("one", "אחת", "אחד", "один", "одна", "واحد"),
    "2": ("two", "שתיים", "שתים", "שניים", "два", "две", "اثنان", "اثنين"),
    "3": ("three", "שלוש", "שלושה", "שלש", "три", "ثلاثة", "ثلاث"),
    "4": ("four", "ארבע", "ארבעה", "четыре", "اربعة", "اربع"),
    "5": ("five", "חמש", "חמישה", "חמשה", "пять", "خمسة", "خمس"),
    "6": ("six", "שש", "שישה", "ששה", "шесть", "ستة", "ست"),
    "7": ("seven", "שבע", "שבעה", "семь", "سبعة", "سبع"),
    "8": ("eight", "שמונה", "восемь", "ثمانية", "ثمان"),
    "9": ("nine", "תשע", "תשעה", "девять", "تسعة", "تسع"),
}
_DIGIT_WORD = {w: d for d, words in _DIGIT_WORDS.items() for w in words}
# a digit word standing alone (a Hebrew one may carry the conjunction ו-)
_DIGIT_WORD_RE = re.compile(r"(?<!\w)ו?(" + "|".join(sorted(map(re.escape, _DIGIT_WORD), key=len, reverse=True)) + r")(?!\w)")
# separators people put between the digits of a code: "4 8 2 1", "48-21", "4.8.2.1", a line break
_DIGIT_GAP = re.compile(r"(?<=[0-9])[\s\-.,_/\\|·•*]{1,3}(?=[0-9])")
# single letters spelled apart: "p.i.n.", "P I N"
_SPELLED = re.compile(r"(?<![^\W\d_])((?:[^\W\d_][.\s]){2,}[^\W\d_])\.?(?![^\W\d_])")
# letters that look like Latin ones (a Cyrillic "р" in "рin"); a second form, so the Russian words still match as written
_HOMOGLYPHS = str.maketrans({"а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "і": "i", "ӏ": "l", "ѕ": "s", "ԁ": "d", "к": "k", "м": "m", "н": "h",
                             "т": "t", "у": "y", "х": "x", "α": "a", "ε": "e", "ι": "i", "κ": "k", "ν": "v", "ο": "o", "ρ": "p", "τ": "t", "υ": "u"})
_ARABIC_ALEF = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا"})


def _ascii_digits(text: str) -> str:
    """Every decimal digit of any script (Arabic-Indic, Extended Arabic-Indic, Devanagari, ...) as its ASCII digit."""
    out = []
    for ch in text:
        if not ch.isascii() and ch.isdigit():
            value = unicodedata.digit(ch, None)
            out.append(str(value) if value is not None and 0 <= value <= 9 else ch)
        else:
            out.append(ch)
    return "".join(out)


def _guard_forms(text: str) -> tuple[str, str]:
    """The forms of a text the credential guard looks at (review F1): NFKC (fullwidth / superscript / circled digits become plain ones),
    every format character (Cf: zero-width space, soft hyphen, bidi marks) and combining mark (Mn: Hebrew points) dropped, case folded,
    every Unicode digit as ASCII, digit WORDS as digits, letters spelled apart joined, the separators between digits collapsed (a line
    break is one) - and the same with look-alike letters mapped to Latin."""
    t = unicodedata.normalize("NFKC", text)
    t = "".join(ch for ch in t if unicodedata.category(ch) not in ("Cf", "Mn")).casefold()
    t = _ascii_digits(t).translate(_ARABIC_ALEF)
    t = _DIGIT_WORD_RE.sub(lambda m: _DIGIT_WORD[m.group(1)], t)
    t = _SPELLED.sub(lambda m: re.sub(r"[.\s]", "", m.group(1)), t)
    for _ in range(4):  # "4 8 2 1" -> "4821" (a pass may leave every other gap: the look-behind sees the original string)
        joined = _DIGIT_GAP.sub("", t)
        if joined == t:
            break
        t = joined
    return t, t.translate(_HOMOGLYPHS)


def has_credential_placeholder(text: str) -> bool:
    return CREDENTIAL_PLACEHOLDER.search(text) is not None


def looks_like_credential(text: str) -> bool:
    """The text reads like a PIN or an access code (best effort: it is a guard on what a person TYPES - Arx never holds a PIN, and the
    templates are checked at save time, so nothing in Arx can put one into a message by itself). Checked on the normalised forms of
    `_guard_forms`, so spacing, line breaks, invisible characters, points, look-alike letters, other scripts' digits and digits written
    as words do not slip past. Mirrored (as an early answer only) in frontend/src/access-control/messaging-logic.ts."""
    if has_credential_placeholder(text):
        return True
    return any(CREDENTIAL_WORDS.search(form) is not None or has_credential_placeholder(form) for form in _guard_forms(text))


def _has_control(text: str, *, newline: bool) -> bool:
    for ch in text:
        if ch == "\n" and newline:
            continue
        if unicodedata.category(ch) in ("Cc", "Zl", "Zp"):
            return True
    return False


def clean_text(text: str) -> str:
    """A sender's text, normalised: line ends as \\n, trailing spaces off every line, the whole trimmed. (Content rules are
    `check_free_text`'s.)"""
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    return "\n".join(lines).strip()


# ---------------------------------------------------------------- templates and the settings document

def render(body: str, *, name: str, organization: str) -> str:
    """A template body with {name} and {organization} filled in, in ONE pass (a value is never scanned for placeholders again)."""
    values = {"name": _one_line(name)[:NAME_MAX], "organization": _one_line(organization)[:ORGANIZATION_MAX]}
    return re.sub(r"\{(name|organization)\}", lambda m: values[m.group(1)], body)


def _one_line(text: str) -> str:
    return " ".join("".join(" " if unicodedata.category(c) in ("Cc", "Zl", "Zp") else c for c in text).split())


def _defaults() -> dict[str, Any]:
    return {"revision": 0, "enabled": False, "free_text": True, "bulk_max": DEFAULT_BULK_MAX, "rate_per_hour": DEFAULT_RATE_PER_HOUR,
            "per_sender_per_hour": DEFAULT_PER_SENDER_PER_HOUR, "per_person_per_day": DEFAULT_PER_PERSON_PER_DAY,
            "per_station_per_hour": DEFAULT_PER_STATION_PER_HOUR, "send_hours": dict(DEFAULT_SEND_HOURS),
            "organization": "", "account": "", "templates": [dict(t) for t in DEFAULT_TEMPLATES], **_consent_defaults()}


def _consent_defaults() -> dict[str, Any]:
    """WA-CONSENT-LINK: OFF by default (the owner's decision: `unknown` may still be messaged until an administrator turns it on)."""
    return {"consent_by_link": False, "consent_wait_days": DEFAULT_CONSENT_WAIT_DAYS, "consent_language": "he", "consent_wa_template": "",
            "consent_wa_language": ""}


def _consent_read(stored: dict[str, Any]) -> dict[str, Any]:
    """The consent fields of a stored document, each checked again (a value out of shape reads as its default: fail closed = OFF)."""
    out = _consent_defaults()
    out["consent_by_link"] = stored.get("consent_by_link") is True
    days = stored.get("consent_wait_days")
    if _is_int(days) and CONSENT_WAIT_RANGE[0] <= days <= CONSENT_WAIT_RANGE[1]:
        out["consent_wait_days"] = days
    if stored.get("consent_language") in CONSENT_LANGS:
        out["consent_language"] = stored["consent_language"]
    name = stored.get("consent_wa_template")
    if isinstance(name, str) and (name == "" or WA_TEMPLATE_NAME.fullmatch(name)):
        out["consent_wa_template"] = name
    lang = stored.get("consent_wa_language")
    if isinstance(lang, str) and (lang == "" or WA_TEMPLATE_LANG.fullmatch(lang)):
        out["consent_wa_language"] = lang
    return out


CAP_FIELDS: dict[str, tuple[tuple[int, int], int]] = {
    "per_sender_per_hour": (PER_SENDER_RANGE, DEFAULT_PER_SENDER_PER_HOUR),
    "per_person_per_day": (PER_PERSON_DAY_RANGE, DEFAULT_PER_PERSON_PER_DAY),
    "per_station_per_hour": (PER_STATION_RANGE, DEFAULT_PER_STATION_PER_HOUR),
}


def send_hours_error(value: Any) -> str | None:
    """None when `value` is a send-hours window by the tickets' rules (services/tickets/hours.py: `{"from": "HH:MM", "to": "HH:MM"}`,
    from < to, no window across midnight); else the problem code (window_invalid / window_across_midnight / window_empty)."""
    from .tickets import hours

    if not isinstance(value, dict) or set(value) != {"from", "to"}:
        return "window_invalid"
    try:
        hours.parse_window(value)
    except hours.WindowError as exc:
        return exc.code
    return None


def _is_int(v: Any) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def read_settings(conn: sqlite3.Connection) -> dict[str, Any]:
    """The stored document, every field checked again on the way out. Nothing stored = the defaults (messaging OFF); a stored value
    that cannot be read, or whose templates no longer pass `check_template`, reads as OFF with the defaults - fail closed: a corrupt
    catalogue never reaches a message."""
    raw = get_setting(conn, SETTING_KEY)
    cfg = _defaults()
    if not raw:
        return cfg
    try:
        stored = json.loads(raw)
        if not isinstance(stored, dict):
            raise ValueError("not an object")
        out = _defaults()
        out["revision"] = stored["revision"] if _is_int(stored.get("revision")) and stored["revision"] >= 0 else 0
        out["enabled"] = stored.get("enabled") is True
        out["free_text"] = stored.get("free_text") is not False
        out["bulk_max"] = stored["bulk_max"] if _is_int(stored.get("bulk_max")) and BULK_RANGE[0] <= stored["bulk_max"] <= BULK_RANGE[1] else DEFAULT_BULK_MAX
        out["rate_per_hour"] = stored["rate_per_hour"] if _is_int(stored.get("rate_per_hour")) and RATE_RANGE[0] <= stored["rate_per_hour"] <= RATE_RANGE[1] else DEFAULT_RATE_PER_HOUR
        for key, ((lo, hi), default) in CAP_FIELDS.items():  # a document of 2.6.4 has none of these: the defaults
            out[key] = stored[key] if _is_int(stored.get(key)) and lo <= stored[key] <= hi else default
        if "send_hours" in stored:  # null = switched off by an administrator; anything unreadable = the default window (never wider)
            hours_doc = stored["send_hours"]
            out["send_hours"] = None if hours_doc is None else (dict(hours_doc) if send_hours_error(hours_doc) is None else dict(DEFAULT_SEND_HOURS))
        out["organization"] = stored["organization"] if isinstance(stored.get("organization"), str) and len(stored["organization"]) <= ORGANIZATION_MAX else ""
        out["account"] = stored["account"] if isinstance(stored.get("account"), str) and len(stored["account"]) <= 128 else ""
        templates = stored.get("templates")
        if not isinstance(templates, list):
            raise ValueError("templates")
        out["templates"] = [{"id": t["id"], "label": t["label"], "body": t["body"]} for t in templates]
        if template_errors(out["templates"], out["organization"]) or looks_like_credential(out["organization"]):
            raise ValueError("templates fail validation")
        out.update(_consent_read(stored))
        return out
    except (ValueError, KeyError, TypeError):
        log.warning("intercom messaging: the stored settings could not be read; messaging reads as switched off")
        return cfg


def template_errors(templates: list[dict[str, Any]], organization: str) -> list[dict[str, str]]:
    """Every problem of a template list, as `{path, code}` (the editor turns a code into words): count, ids, labels, bodies,
    placeholders, credentials, control characters, sizes."""
    errors: list[dict[str, str]] = []
    if len(templates) > TEMPLATES_MAX:
        errors.append({"path": "templates", "code": "too_many"})
    ids: set[str] = set()
    labels: set[str] = set()
    for i, t in enumerate(templates):
        base = f"templates.{i}"
        tid, label, body = t.get("id"), t.get("label"), t.get("body")
        if not isinstance(tid, str) or not TEMPLATE_ID.fullmatch(tid):
            errors.append({"path": f"{base}.id", "code": "bad_id"})
        elif tid in ids:
            errors.append({"path": f"{base}.id", "code": "duplicate_id"})
        else:
            ids.add(tid)
        errors.extend(_label_errors(label, f"{base}.label", labels))
        errors.extend(_body_errors(body, f"{base}.body", organization))
    return errors


def _label_errors(label: Any, path: str, seen: set[str]) -> list[dict[str, str]]:
    if not isinstance(label, str):
        return [{"path": path, "code": "type"}]
    if not label.strip():
        return [{"path": path, "code": "empty"}]
    if label != label.strip() or len(label) > LABEL_MAX:
        return [{"path": path, "code": "too_long" if len(label) > LABEL_MAX else "untrimmed"}]
    if _has_control(label, newline=False):
        return [{"path": path, "code": "control_chars"}]
    key = label.casefold()
    if key in seen:
        return [{"path": path, "code": "duplicate_label"}]
    seen.add(key)
    return []


def _body_errors(body: Any, path: str, organization: str) -> list[dict[str, str]]:
    if not isinstance(body, str):
        return [{"path": path, "code": "type"}]
    if not body.strip():
        return [{"path": path, "code": "empty"}]
    if body != clean_text(body):
        return [{"path": path, "code": "untrimmed"}]
    if len(body) > BODY_MAX:
        return [{"path": path, "code": "too_long"}]
    if _has_control(body, newline=True):
        return [{"path": path, "code": "control_chars"}]
    if has_credential_placeholder(body):
        return [{"path": path, "code": "credential"}]
    found = re.findall(r"\{([^{}]*)\}", body)
    stripped = re.sub(r"\{[^{}]*\}", "", body)
    if "{" in stripped or "}" in stripped:
        return [{"path": path, "code": "bad_braces"}]
    if any(name not in PLACEHOLDERS for name in found):
        return [{"path": path, "code": "unknown_placeholder"}]
    if looks_like_credential(body):
        return [{"path": path, "code": "credential"}]
    if len(found) > PLACEHOLDERS_MAX:
        return [{"path": path, "code": "too_many_placeholders"}]
    if "organization" in found and not organization.strip():
        return [{"path": path, "code": "organization_missing"}]
    # review F8: the TEXT a person receives, not only the body - "הקוד שלך {organization}" with an organization of "4821"
    if looks_like_credential(render(body, name="x" * 8, organization=organization)):
        return [{"path": path, "code": "credential"}]
    worst = len(re.sub(r"\{(?:name|organization)\}", "", body)) + found.count("name") * NAME_MAX + found.count("organization") * ORGANIZATION_MAX
    if worst > RENDERED_MAX:
        return [{"path": path, "code": "too_long"}]
    return []


def validate_settings(data: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
    """The document a PUT stores, or ApiError 422 `message_settings_invalid` with `details.errors` = every problem as `{path, code}`.
    A template that comes without an id gets a fresh one; ids the sender kept stay (history rows refer to them)."""
    errors: list[dict[str, str]] = []

    def need(key: str, kind: str) -> Any:
        v = data.get(key)
        if kind == "bool":
            ok = isinstance(v, bool)
        elif kind == "int":
            ok = _is_int(v)
        else:
            ok = isinstance(v, str)
        if not ok:
            errors.append({"path": key, "code": "type"})
        return v

    enabled = need("enabled", "bool")
    free_text = need("free_text", "bool")
    bulk_max = need("bulk_max", "int")
    rate = need("rate_per_hour", "int")
    organization = need("organization", "str")
    account = need("account", "str")
    if _is_int(bulk_max) and not BULK_RANGE[0] <= bulk_max <= BULK_RANGE[1]:
        errors.append({"path": "bulk_max", "code": "range"})
    if _is_int(rate) and not RATE_RANGE[0] <= rate <= RATE_RANGE[1]:
        errors.append({"path": "rate_per_hour", "code": "range"})
    # review F3 / F5: optional in the body - an editor that does not know them (2.6.4) keeps the stored values
    caps: dict[str, Any] = {}
    for key, ((lo, hi), _default) in CAP_FIELDS.items():
        caps[key] = data[key] if key in data else current[key]
        if not _is_int(caps[key]):
            errors.append({"path": key, "code": "type"})
        elif not lo <= caps[key] <= hi:
            errors.append({"path": key, "code": "range"})
    send_hours = data["send_hours"] if "send_hours" in data else current["send_hours"]
    if send_hours is not None:
        problem = send_hours_error(send_hours)
        if problem:
            errors.append({"path": "send_hours", "code": problem})
        else:
            send_hours = {"from": send_hours["from"], "to": send_hours["to"]}
    if isinstance(organization, str):
        organization = organization.strip()
        if len(organization) > ORGANIZATION_MAX:
            errors.append({"path": "organization", "code": "too_long"})
        elif _has_control(organization, newline=False):
            errors.append({"path": "organization", "code": "control_chars"})
        elif "{" in organization or "}" in organization:
            errors.append({"path": "organization", "code": "bad_braces"})
        elif looks_like_credential(organization):  # review F8
            errors.append({"path": "organization", "code": "credential"})
    if isinstance(account, str):
        account = account.strip()
        if len(account) > 128 or _has_control(account, newline=False):
            errors.append({"path": "account", "code": "too_long"})
    raw_templates = data.get("templates")
    templates: list[dict[str, str]] = []
    if not isinstance(raw_templates, list):
        errors.append({"path": "templates", "code": "type"})
    else:
        taken = {t.get("id") for t in raw_templates if isinstance(t, dict) and isinstance(t.get("id"), str) and t.get("id")}
        for i, t in enumerate(raw_templates[: TEMPLATES_MAX + 1]):
            if not isinstance(t, dict):
                errors.append({"path": f"templates.{i}", "code": "type"})
                continue
            tid = t.get("id")
            if tid in (None, ""):
                tid = _fresh_id(taken)
                taken.add(tid)
            label, body = t.get("label"), t.get("body")
            templates.append({"id": tid, "label": label.strip() if isinstance(label, str) else label, "body": clean_text(body) if isinstance(body, str) else body})
        errors.extend(template_errors(templates, organization if isinstance(organization, str) else ""))
    consent = _consent_validate(data, current, errors)
    if errors:
        raise ApiError(422, "message_settings_invalid", "הגדרות ההודעות אינן תקינות.", details={"errors": errors[:60]})
    return {"revision": current["revision"] + 1, "enabled": enabled, "free_text": free_text, "bulk_max": bulk_max, "rate_per_hour": rate,
            **caps, "send_hours": send_hours, "organization": organization, "account": account, "templates": templates, **consent}


def _consent_validate(data: dict[str, Any], current: dict[str, Any], errors: list[dict[str, str]]) -> dict[str, Any]:
    """WA-CONSENT-LINK: the consent fields of a PUT. Each is OPTIONAL (a client that predates them keeps the stored value); a value that
    is present must be valid. Turning consent by link on needs an `{organization}` (the request names who asks)."""
    defaults = _consent_defaults()
    out: dict[str, Any] = {key: data[key] if data.get(key) is not None else current.get(key, defaults[key]) for key in CONSENT_KEYS}
    if not isinstance(out["consent_by_link"], bool):
        errors.append({"path": "consent_by_link", "code": "type"})
    days = out["consent_wait_days"]
    if not _is_int(days):
        errors.append({"path": "consent_wait_days", "code": "type"})
    elif not CONSENT_WAIT_RANGE[0] <= days <= CONSENT_WAIT_RANGE[1]:
        errors.append({"path": "consent_wait_days", "code": "range"})
    if out["consent_language"] not in CONSENT_LANGS:
        errors.append({"path": "consent_language", "code": "type"})
    name = out["consent_wa_template"]
    if not isinstance(name, str) or not (name == "" or WA_TEMPLATE_NAME.fullmatch(name)):
        errors.append({"path": "consent_wa_template", "code": "bad_name"})
    lang = out["consent_wa_language"]
    if not isinstance(lang, str) or not (lang == "" or WA_TEMPLATE_LANG.fullmatch(lang)):
        errors.append({"path": "consent_wa_language", "code": "bad_language"})
    organization = data.get("organization") if isinstance(data.get("organization"), str) else current.get("organization", "")
    if out["consent_by_link"] is True and not str(organization).strip():
        errors.append({"path": "consent_by_link", "code": "organization_missing"})
    return out


def _fresh_id(taken: Iterable[Any]) -> str:
    taken = set(taken)
    while True:
        candidate = "t" + secrets.token_hex(4)
        if candidate not in taken:
            return candidate


def save_settings(conn: sqlite3.Connection, doc: dict[str, Any]) -> None:
    set_setting(conn, SETTING_KEY, json.dumps(doc, ensure_ascii=False, separators=(",", ":")))


def public_templates(cfg: dict[str, Any]) -> list[dict[str, str]]:
    """The templates as the dialog gets them. `{organization}` is filled in here - the name is the administrator's own setting, not a secret -
    so the text a sender sees (and may edit into a free text, which the server never renders) is the text that goes out; `{name}` stays: it
    is the person's, the dialog shows it filled for one person and the server renders it for real at send time."""
    organization = _one_line(cfg["organization"])[:ORGANIZATION_MAX]
    return [{**t, "body": re.sub(r"\{organization\}", lambda _m: organization, t["body"])} for t in cfg["templates"]]


# ---------------------------------------------------------------- what a sender may send

def check_free_text(cfg: dict[str, Any], text: str | None) -> str:
    """The cleaned text of a free message, or the ApiError the sender sees. Allowed only while the administrator allows it; never empty,
    never longer than TEXT_MAX, no control characters, never anything that reads like a credential."""
    if not cfg["free_text"]:
        raise ApiError(403, "message_free_text_disabled", "הודעה חופשית אינה מופעלת - אפשר לשלוח תבנית בלבד.")
    cleaned = clean_text(text or "")
    if not cleaned:
        raise ApiError(422, "message_empty", "ההודעה ריקה.")
    if len(cleaned) > TEXT_MAX:
        raise ApiError(422, "message_too_long", f"ההודעה ארוכה מדי (עד {TEXT_MAX} תווים).")
    if _has_control(cleaned, newline=True):
        raise ApiError(422, "message_forbidden_content", "ההודעה מכילה תווים שאי אפשר לשלוח.")
    if looks_like_credential(cleaned):
        raise ApiError(422, "message_forbidden_content", "אי אפשר לשלוח קוד גישה או פרטי כניסה בהודעה.")
    return cleaned


def pick_template(cfg: dict[str, Any], template_id: str, revision: int | None) -> dict[str, str]:
    """The approved template the sender picked (`{id, label, body}`). The revision of the catalogue they saw must be the current one: an
    administrator may have edited it since the dialog opened (409 `message_template_changed`), and the sender must not send a text they
    did not see. The text for this person is `render(template["body"], name=..., organization=cfg["organization"])`."""
    template = next((t for t in cfg["templates"] if t["id"] == template_id), None)
    if template is None:
        raise ApiError(422, "message_template_unknown", "התבנית אינה קיימת עוד.")
    if revision is None or revision != cfg["revision"]:
        raise ApiError(409, "message_template_changed", "התבניות עודכנו מאז שהחלון נפתח - בחרו שוב.", details={"templates_revision": cfg["revision"]})
    return template


# ---------------------------------------------------------------- the person rule

def may_message(auth: ia.Authority, person: dict[str, Any]) -> bool:
    """Whether this caller may message this person (a closed projection from the adapter): the person is visible to them at all
    (`access.people.read` on a station of theirs, or unrestricted for a person with no station) AND they hold `access.people.message`
    on EVERY station the person is assigned to - the rule `person_editable` applies to writes; a person with no station (or with an
    assignment WisKey redacted) only to a caller unrestricted for both. Fail closed."""
    if ia.person_level_of(auth, person) == ia.NONE:
        return False
    ids = ia.person_station_ids(person)
    if not ids:
        return auth.unrestricted(PERMISSION) and auth.unrestricted(ia.PEOPLE_READ)
    return all(auth.station(PERMISSION, s) for s in ids)


def mask_phone(phone: str | None) -> str | None:
    """Everything but the last two digits hidden - the most a sender ever sees without opening the person's page. A fixed width
    (review F10): the mask does not tell the length of the number, or whether it is international."""
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) < 4:
        return None
    return "•" * 6 + digits[-2:]


# ---------------------------------------------------------------- the phone hash (review F3 / F6)

def normalise_phone(phone: Any) -> str | None:
    """A number as E.164 digits without '+' (8-15 digits; a leading '00' or '+' dropped, a local number's leading 0 replaced by
    DEFAULT_COUNTRY), or None. Used only to compute `phone_hash` - never stored."""
    if not isinstance(phone, str):
        return None
    s = re.sub(r"[\s\-().]", "", _ascii_digits(unicodedata.normalize("NFKC", phone)).strip())
    if s.startswith("+"):
        s = s[1:]
    elif s.startswith("00"):
        s = s[2:]
    elif s.startswith("0"):
        s = DEFAULT_COUNTRY + s[1:]
    return s if s.isdigit() and 8 <= len(s) <= 15 else None


def _phone_key(conn: sqlite3.Connection, *, create: bool) -> bytes | None:
    raw = get_setting(conn, PHONE_KEY_SETTING)
    if isinstance(raw, str) and re.fullmatch(r"[0-9a-f]{64}", raw):
        return bytes.fromhex(raw)
    if not create:
        return None
    key = secrets.token_hex(32)
    set_setting(conn, PHONE_KEY_SETTING, key)
    return bytes.fromhex(key)


def phone_hash(conn: sqlite3.Connection, phone: Any, *, create: bool = False) -> str | None:
    """HMAC-SHA256 of the normalised number under the installation's own random key (created on the first write that needs it; until
    then no hash exists anywhere, so a read without one finds nothing). "The same number" without keeping a number."""
    digits = normalise_phone(phone)
    if digits is None:
        return None
    key = _phone_key(conn, create=create)
    return hmac.new(key, digits.encode("ascii"), hashlib.sha256).hexdigest() if key else None


# ---------------------------------------------------------------- send hours (review F5)

def hours_now() -> datetime:
    """The clock of the send-hours check (a function, so the tests can stand at 02:40)."""
    return utc()


def _zone(conn: sqlite3.Connection) -> ZoneInfo:
    try:
        return ZoneInfo(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")
    except Exception:  # noqa: BLE001 - a corrupt zone name: the product's default zone
        return ZoneInfo("Asia/Jerusalem")


def send_hours_state(conn: sqlite3.Connection, cfg: dict[str, Any], *, now: datetime | None = None) -> dict[str, Any] | None:
    """`{from, to, open_now, next_opening}` of the administrator's send hours in the installation's zone (the tickets' window rules:
    services/tickets/hours.py), or None when an administrator switched them off."""
    from .tickets import hours

    if cfg.get("send_hours") is None:
        return None
    window = hours.effective_window(cfg["send_hours"])  # (a stored value that cannot be read is the default window, never "always")
    now = (now or hours_now()).astimezone(timezone.utc)
    opening = hours.next_opening(now, window, _zone(conn))
    open_now = opening == now
    return {**window.as_doc(), "open_now": open_now, "next_opening": None if open_now else iso(opening)}


def check_send_hours(conn: sqlite3.Connection, cfg: dict[str, Any]) -> None:
    """409 `message_outside_hours` (nothing sent, `details.next_allowed_at`) outside the send hours."""
    state = send_hours_state(conn, cfg)
    if state is not None and not state["open_now"]:
        raise ApiError(409, "message_outside_hours", f"אפשר לשלוח הודעות בין {state['from']} ל־{state['to']}. ההודעה לא נשלחה.",
                       details={"outcome": "not_sent", "next_allowed_at": state["next_opening"], "send_hours": {"from": state["from"], "to": state["to"]}})


# ---------------------------------------------------------------- the record, the limits, the opt-out list

def utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


HANDED_ON = "('pending', 'sent', 'unknown')"  # what left Arx (or may have): the installation's, the person's and the station's caps
ATTEMPTED = "('pending', 'sent', 'unknown', 'refused')"  # + what the service refused: a sender's own caps (review F9: probing is not free)


def _count(conn: sqlite3.Connection, where: str, args: tuple[Any, ...], seconds: int, now: datetime, *, join: str = "") -> tuple[int, int]:
    """(how many records match `where` in the last `seconds`, seconds until the oldest of them ages out). `where` / `join` are this
    module's own constants."""
    row = conn.execute(f"SELECT COUNT(*), MIN(m.at) FROM intercom_messages m {join} WHERE m.at >= ? AND {where}", (iso(now - timedelta(seconds=seconds)), *args)).fetchone()
    used, oldest = int(row[0]), row[1]
    resets = 0
    if oldest:
        try:
            resets = max(1, int((datetime.fromisoformat(oldest.replace("Z", "+00:00")) + timedelta(seconds=seconds) - now).total_seconds()))
        except ValueError:
            resets = seconds
    return used, resets


def window_state(conn: sqlite3.Connection, limit: int, *, now: datetime | None = None) -> dict[str, Any]:
    """The hourly allowance: `{limit, used, resets_in_s}` over the last WINDOW_S seconds. What counts is every message handed on
    (pending, sent, unknown); a refusal by the service sent nothing and does not. `resets_in_s` is when the oldest counted one ages out."""
    used, resets = _count(conn, f"m.outcome IN {HANDED_ON}", (), WINDOW_S, now or utc())
    return {"limit": limit, "used": used, "resets_in_s": resets}


def sender_state(conn: sqlite3.Connection, user_id: str, limit: int, *, now: datetime | None = None) -> dict[str, Any]:
    """One sender's own hourly allowance (review F3; a refusal counts too - F9): `{limit, used, resets_in_s}`."""
    used, resets = _count(conn, f"m.actor_user_id = ? AND m.outcome IN {ATTEMPTED}", (user_id,), WINDOW_S, now or utc())
    return {"limit": limit, "used": used, "resets_in_s": resets}


def _rate_limited(scope: str, message: str, state: dict[str, Any]) -> ApiError:
    return ApiError(429, "message_rate_limited", message, retryable=True,
                    details={"outcome": "not_sent", "scope": scope, "retry_after_s": state["resets_in_s"], "quota": state})


def begin_attempt(db: Database, *, principal: Any, person_id: str, kind: str, template_id: str | None, template_label: str | None,
                  template_revision: int | None, chars: int, bulk_id: str | None, bulk_total: int | None, client_request_id: str,
                  request_id: str | None, cfg: dict[str, Any], audit_details: dict[str, Any], phone: str | None = None,
                  station_ids: Iterable[str] | None = None) -> str:
    """Write the attempt: ONE short write transaction that checks the limits, inserts the record and the audit row together. Nothing is
    sent before this commits (no record, no message). Raises ApiError (nothing written) for a repeated `client_request_id`
    (409 message_duplicate), a bulk run that does not fit (422 message_bulk_mismatch / message_bulk_too_many - the latter also for
    more than `bulk_max` messages of one sender in RUN_WINDOW_S, whatever `bulk_id` the client sent, review F4) or a cap
    (429 message_rate_limited, `scope`: `sender` - the sender's hour, refusals included; `person` - the recipient's day, by record AND by
    number; `station` - the hour of a station the recipient is on; `hour` - the installation's). The record keeps the number only as
    `phone_hash` and the person's stations as `station_ids`."""
    from ..audit import audit

    now = utc()
    message_id = uuid.uuid4().hex
    stations = sorted({s for s in (station_ids or []) if isinstance(s, str)})
    with db.write_aside() as w:
        w.execute("DELETE FROM intercom_messages WHERE at < ?", (iso(now - timedelta(days=KEEP_DAYS)),))
        if w.execute("SELECT 1 FROM intercom_messages WHERE actor_user_id = ? AND client_request_id = ?", (principal.user_id, client_request_id)).fetchone():
            raise ApiError(409, "message_duplicate", "ההודעה הזו כבר נשלחה (אותו מזהה בקשה), ולכן לא נשלחה שוב.", details={"outcome": "not_sent"})
        too_many = ApiError(422, "message_bulk_too_many", f"אפשר לשלוח לעד {cfg['bulk_max']} אנשים בבת אחת.", details={"outcome": "not_sent", "bulk_max": cfg["bulk_max"]})
        if bulk_id:
            rows = w.execute("SELECT actor_user_id, kind, template_id FROM intercom_messages WHERE bulk_id = ?", (bulk_id,)).fetchall()
            if any(r[0] != principal.user_id or r[1] != kind or r[2] != template_id for r in rows):
                raise ApiError(422, "message_bulk_mismatch", "כל ההודעות בשליחה אחת לרבים חייבות להיות מאותה תבנית (או כולן הודעה חופשית).", details={"outcome": "not_sent"})
            if len(rows) >= cfg["bulk_max"] or (bulk_total is not None and len(rows) >= bulk_total):
                raise too_many
        run, run_resets = _count(w, f"m.actor_user_id = ? AND m.outcome IN {ATTEMPTED}", (principal.user_id,), RUN_WINDOW_S, now)
        if run >= cfg["bulk_max"]:
            too_many.details.update(scope="window", retry_after_s=run_resets)
            raise too_many
        sender = sender_state(w, principal.user_id, cfg["per_sender_per_hour"], now=now)
        if sender["used"] >= sender["limit"]:
            raise _rate_limited("sender", "הגעתם למכסת ההודעות שלכם לשעה.", sender)
        hashed = phone_hash(w, phone, create=True)
        if hashed:
            used, resets = _count(w, f"(m.person_id = ? OR m.phone_hash = ?) AND m.outcome IN {HANDED_ON}", (person_id, hashed), DAY_S, now)
        else:
            used, resets = _count(w, f"m.person_id = ? AND m.outcome IN {HANDED_ON}", (person_id,), DAY_S, now)
        if used >= cfg["per_person_per_day"]:
            raise _rate_limited("person", "האדם הזה קיבל היום את מספר ההודעות המרבי.", {"limit": cfg["per_person_per_day"], "used": used, "resets_in_s": resets})
        for station in stations:
            used, resets = _count(w, f"j.value = ? AND m.outcome IN {HANDED_ON}", (station,), WINDOW_S, now, join=", json_each(m.station_ids) j")
            if used >= cfg["per_station_per_hour"]:
                raise _rate_limited("station", "אנשי העמדה הזו קיבלו את מספר ההודעות המרבי לשעה.", {"limit": cfg["per_station_per_hour"], "used": used, "resets_in_s": resets})
        state = window_state(w, cfg["rate_per_hour"], now=now)
        if state["used"] >= state["limit"]:
            raise _rate_limited("hour", "הגעתם למכסת ההודעות לשעה.", state)
        w.execute(
            """INSERT INTO intercom_messages(id, at, actor_user_id, actor_name, person_id, kind, template_id, template_label, template_revision, chars,
                                             bulk_id, client_request_id, request_id, outcome, phone_hash, station_ids)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)""",
            (message_id, iso(now), principal.user_id, (getattr(principal, "display_name", None) or getattr(principal, "username", None) or "")[:128] or None, person_id, kind,
             template_id, template_label, template_revision, chars, bulk_id, client_request_id, request_id, hashed, json.dumps(stations) if stations else None),
        )
        audit(w, actor=principal, action=AUDIT_SEND, decision="allowed", resource_type="intercom_person", resource_id=person_id, request_id=request_id,
              details={**audit_details, "phase": "attempt", "message_id": message_id})
    return message_id


def finish_attempt(db: Database, *, principal: Any, message_id: str, person_id: str, outcome: str, reason: str | None, request_id: str | None,
                   audit_details: dict[str, Any]) -> None:
    """The outcome of an attempt: `sent`, `refused` (the service answered with a proven refusal), `unknown` (handed on, no usable answer)
    or `not_sent` (it never left Arx - the record is removed; the audit rows keep the story). Best effort, like the physical actions'
    outcome row: if the database is busy the caller still gets the real result and the attempt row stands (a `pending` record older than
    PENDING_STALE_S reads as unknown)."""
    from ..audit import audit

    for attempt in range(3):
        try:
            with db.write_aside() as w:
                if outcome == "not_sent":
                    w.execute("DELETE FROM intercom_messages WHERE id = ?", (message_id,))
                else:
                    w.execute("UPDATE intercom_messages SET outcome = ?, reason = ?, done_at = ? WHERE id = ?", (outcome, reason, iso(utc()), message_id))
                audit(w, actor=principal, action=AUDIT_SEND, decision="allowed", reason=reason, resource_type="intercom_person", resource_id=person_id,
                      request_id=request_id, details={**audit_details, "phase": "outcome", "outcome": outcome, "message_id": message_id})
            return
        except Exception:  # noqa: BLE001 - the message is out; its attempt row stands (see the docstring)
            if attempt == 2:
                log.exception("intercom messaging: the outcome (%s) of message %s could not be recorded; its attempt row stands", outcome, message_id)


def history(conn: sqlite3.Connection, person_id: str, limit: int = HISTORY_MAX, *, now: datetime | None = None) -> list[dict[str, Any]]:
    """The person's messages, newest first, as the person's page lists them. The sender is a name snapshot; a template is its label
    snapshot (null for a free text); `outcome` is `sent` (accepted by the service - never "delivered"), `refused` (not sent) or
    `unknown`; a record still pending after PENDING_STALE_S is `unknown`."""
    now = now or utc()
    out = []
    for r in conn.execute(
        "SELECT id, at, actor_name, kind, template_id, template_label, outcome, reason, bulk_id FROM intercom_messages WHERE person_id = ? ORDER BY at DESC, rowid DESC LIMIT ?",
        (person_id, max(1, min(limit, HISTORY_MAX))),
    ).fetchall():
        outcome = r["outcome"]
        if outcome == "pending":
            try:
                aged = (now - datetime.fromisoformat(r["at"].replace("Z", "+00:00"))).total_seconds() > PENDING_STALE_S
            except ValueError:
                aged = True
            outcome = "unknown" if aged else "pending"
        out.append({"id": r["id"], "at": r["at"], "by": r["actor_name"], "kind": r["kind"], "template_id": r["template_id"], "template_label": r["template_label"],
                    "outcome": outcome, "reason": r["reason"], "bulk": r["bulk_id"] is not None})
    return out


def opted_out(conn: sqlite3.Connection, person_id: str, phone: str | None = None) -> dict[str, Any] | None:
    """The person's opt-out (`{at, by}`), by their record - or by their NUMBER (review F6: a second record with the same phone, a
    person re-created under a new id, a shared family phone)."""
    row = conn.execute("SELECT at, by_name FROM intercom_message_optout WHERE person_id = ?", (person_id,)).fetchone()
    if row is None:
        hashed = phone_hash(conn, phone)
        if hashed:
            row = conn.execute("SELECT at, by_name FROM intercom_message_optout WHERE phone_hash = ? ORDER BY at DESC LIMIT 1", (hashed,)).fetchone()
    return {"at": row["at"], "by": row["by_name"]} if row else None


def set_opt_out(db: Database, *, principal: Any, person_id: str, declined: bool, request_id: str | None, phone: str | None = None) -> dict[str, Any] | None:
    """Mark / unmark a person as one who asked not to be messaged; one audit row (the person id, the new state and - on a clear - how
    many rows went; nothing else). Marking keeps the record's id AND the number's hash; clearing removes both kinds (the record's own row
    and any row of the same number: it is the same person's phone). Whether the caller MAY clear is the route's question (review F6:
    system.configure)."""
    from ..audit import audit

    name = (getattr(principal, "display_name", None) or getattr(principal, "username", None) or "")[:128] or None
    with db.write_aside() as w:
        details: dict[str, Any] = {"opted_out": declined}
        if declined:
            hashed = phone_hash(w, phone, create=True)
            w.execute("INSERT INTO intercom_message_optout(person_id, at, by_user_id, by_name, phone_hash) VALUES (?, ?, ?, ?, ?) ON CONFLICT(person_id) DO UPDATE SET "
                      "at = excluded.at, by_user_id = excluded.by_user_id, by_name = excluded.by_name, phone_hash = COALESCE(excluded.phone_hash, phone_hash)",
                      (person_id, iso(utc()), principal.user_id, name, hashed))
        else:
            hashed = phone_hash(w, phone)
            cur = w.execute("DELETE FROM intercom_message_optout WHERE person_id = ? OR (? IS NOT NULL AND phone_hash = ?)", (person_id, hashed, hashed))
            details["cleared"] = cur.rowcount
        audit(w, actor=principal, action=AUDIT_OPTOUT, decision="allowed", resource_type="intercom_person", resource_id=person_id, request_id=request_id,
              details=details)
        return opted_out(w, person_id, phone)


def consent_from(opted: bool, wiskey: str, link_granted: bool = False) -> str:
    """The effective consent: `declined` if the person is on Arx's opt-out list (a "decline" pressed on a consent link is written there
    too) or WisKey says so; `granted` if WisKey says so or the person approved a consent link (WA-CONSENT-LINK); otherwise `unknown`
    (allowed unless the administrator turned consent by link on - then the first message is the consent request)."""
    if opted or wiskey == "declined":
        return "declined"
    return "granted" if wiskey == "granted" or link_granted else "unknown"


def link_granted(conn: sqlite3.Connection, person_id: str) -> bool:
    """WA-CONSENT-LINK: the person approved a consent link (intercom_consent; migration 0116)."""
    try:
        return conn.execute("SELECT 1 FROM intercom_consent WHERE person_id = ? AND state = 'granted'", (person_id,)).fetchone() is not None
    except sqlite3.OperationalError:  # a database before 0116
        return False


def consent_of(conn: sqlite3.Connection, person_id: str, wiskey: str, phone: str | None = None) -> str:
    # integ/270: WA-SEND-FIX's opt-out by number (review F6) AND WA-CONSENT-LINK's consent granted by link
    return consent_from(opted_out(conn, person_id, phone) is not None, wiskey, link_granted(conn, person_id))
