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
  `rate_per_hour` (60, installation-wide), `organization` (the `{organization}` value), `account` (which messaging account when WisKey has
  several), the TEMPLATES and a `revision`. Validation is the server's and total: a template body may hold the placeholders {name} and
  {organization} only, never anything that reads like a credential, no control characters, bounded sizes.
- the CREDENTIAL GUARD (a best-effort guard on what a sender TYPES; nothing in Arx knows a PIN, so nothing can insert one): a `{pin}`-style
  placeholder, or a credential word followed within a few characters by a run of 4-8 digits ("code 4821", "קוד הגישה 123456").
- the RECORD (`intercom_messages`, migration 0079): who sent which template (or "free") to which person, how many characters, and what
  happened - NEVER the text, a phone number, a PIN or WisKey's token. The row is written BEFORE anything is sent (no record, no message),
  carries the browser's `client_request_id` (a repeat is refused), and doubles as the rate counter and the person's message history.
  A message that provably never left Arx ("not sent") deletes its row again: the history lists what was handed on.
- the OPT-OUT LIST (`intercom_message_optout`): people who asked not to be messaged; enforced on every send whatever WisKey says.
- the PERSON RULE: who may message whom (`may_message`) - the person must be visible to the caller AND the caller must hold
  `access.people.message` on EVERY station the person is assigned to (the rule `person_editable` applies to writes).
"""
from __future__ import annotations

import json
import logging
import re
import secrets
import sqlite3
import unicodedata
import uuid
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

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
            "bulk_max": list(BULK_RANGE), "rate_per_hour": list(RATE_RANGE), "placeholders": list(PLACEHOLDERS), "placeholders_max": PLACEHOLDERS_MAX}


# ---------------------------------------------------------------- the credential guard

# A placeholder that would put a credential into a text: {pin}, {code}, {card}, {password}, {token}, {credential...}. (The editor
# refuses any placeholder but {name} and {organization} anyway; this is the free text's guard and the belt over the braces.)
CREDENTIAL_PLACEHOLDER = re.compile(r"\{\s*(?:pin|code|passcode|card|password|token|credential|secret)\w*\s*\}", re.IGNORECASE)
# The words that introduce a code, followed within a few characters by a run of 4-8 digits: "code 4821", "PIN: 123456", "קוד הגישה 4821".
CREDENTIAL_WORDS = re.compile(r"(?:\bpin\b|\bcode\b|passcode|password|קוד|סיסמ[הא]|סיסמת|פין)[^\d\n]{0,14}\d{4,8}", re.IGNORECASE)


def has_credential_placeholder(text: str) -> bool:
    return CREDENTIAL_PLACEHOLDER.search(text) is not None


def looks_like_credential(text: str) -> bool:
    """The text reads like a PIN or an access code (best effort: it is a guard on what a person TYPES - Arx never holds a PIN, and the
    templates are checked at save time, so nothing in Arx can put one into a message by itself)."""
    return has_credential_placeholder(text) or CREDENTIAL_WORDS.search(text) is not None


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
            "organization": "", "account": "", "templates": [dict(t) for t in DEFAULT_TEMPLATES]}


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
        out["organization"] = stored["organization"] if isinstance(stored.get("organization"), str) and len(stored["organization"]) <= ORGANIZATION_MAX else ""
        out["account"] = stored["account"] if isinstance(stored.get("account"), str) and len(stored["account"]) <= 128 else ""
        templates = stored.get("templates")
        if not isinstance(templates, list):
            raise ValueError("templates")
        out["templates"] = [{"id": t["id"], "label": t["label"], "body": t["body"]} for t in templates]
        if template_errors(out["templates"], out["organization"]):
            raise ValueError("templates fail validation")
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
    if isinstance(organization, str):
        organization = organization.strip()
        if len(organization) > ORGANIZATION_MAX:
            errors.append({"path": "organization", "code": "too_long"})
        elif _has_control(organization, newline=False):
            errors.append({"path": "organization", "code": "control_chars"})
        elif "{" in organization or "}" in organization:
            errors.append({"path": "organization", "code": "bad_braces"})
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
    if errors:
        raise ApiError(422, "message_settings_invalid", "הגדרות ההודעות אינן תקינות.", details={"errors": errors[:60]})
    return {"revision": current["revision"] + 1, "enabled": enabled, "free_text": free_text, "bulk_max": bulk_max, "rate_per_hour": rate,
            "organization": organization, "account": account, "templates": templates}


def _fresh_id(taken: Iterable[Any]) -> str:
    taken = set(taken)
    while True:
        candidate = "t" + secrets.token_hex(4)
        if candidate not in taken:
            return candidate


def save_settings(conn: sqlite3.Connection, doc: dict[str, Any]) -> None:
    set_setting(conn, SETTING_KEY, json.dumps(doc, ensure_ascii=False, separators=(",", ":")))


def public_templates(cfg: dict[str, Any]) -> list[dict[str, str]]:
    return deepcopy(cfg["templates"])


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
    """Everything but the last two digits hidden - the most a sender ever sees without opening the person's page."""
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) < 4:
        return None
    return "•" * (len(digits) - 2) + digits[-2:]


# ---------------------------------------------------------------- the record, the limits, the opt-out list

def utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def window_state(conn: sqlite3.Connection, limit: int, *, now: datetime | None = None) -> dict[str, Any]:
    """The hourly allowance: `{limit, used, resets_in_s}` over the last WINDOW_S seconds. What counts is every message handed on
    (pending, sent, unknown); a refusal by the service sent nothing and does not. `resets_in_s` is when the oldest counted one ages out."""
    now = now or utc()
    since = iso(now - timedelta(seconds=WINDOW_S))
    row = conn.execute("SELECT COUNT(*), MIN(at) FROM intercom_messages WHERE at >= ? AND outcome IN ('pending', 'sent', 'unknown')", (since,)).fetchone()
    used, oldest = int(row[0]), row[1]
    resets = 0
    if oldest:
        try:
            resets = max(1, int((datetime.fromisoformat(oldest.replace("Z", "+00:00")) + timedelta(seconds=WINDOW_S) - now).total_seconds()))
        except ValueError:
            resets = WINDOW_S
    return {"limit": limit, "used": used, "resets_in_s": resets}


def begin_attempt(db: Database, *, principal: Any, person_id: str, kind: str, template_id: str | None, template_label: str | None,
                  template_revision: int | None, chars: int, bulk_id: str | None, bulk_total: int | None, client_request_id: str,
                  request_id: str | None, cfg: dict[str, Any], audit_details: dict[str, Any]) -> str:
    """Write the attempt: ONE short write transaction that checks the limits, inserts the record and the audit row together. Nothing is
    sent before this commits (no record, no message). Raises ApiError (nothing written) for a repeated `client_request_id`
    (409 message_duplicate), a bulk run that does not fit (422) or the hourly allowance (429 message_rate_limited, scope `hour`)."""
    from ..audit import audit

    now = utc()
    message_id = uuid.uuid4().hex
    with db.write_aside() as w:
        w.execute("DELETE FROM intercom_messages WHERE at < ?", (iso(now - timedelta(days=KEEP_DAYS)),))
        if w.execute("SELECT 1 FROM intercom_messages WHERE actor_user_id = ? AND client_request_id = ?", (principal.user_id, client_request_id)).fetchone():
            raise ApiError(409, "message_duplicate", "ההודעה הזו כבר נשלחה (אותו מזהה בקשה), ולכן לא נשלחה שוב.", details={"outcome": "not_sent"})
        if bulk_id:
            rows = w.execute("SELECT actor_user_id, kind, template_id FROM intercom_messages WHERE bulk_id = ?", (bulk_id,)).fetchall()
            if any(r[0] != principal.user_id or r[1] != kind or r[2] != template_id for r in rows):
                raise ApiError(422, "message_bulk_mismatch", "כל ההודעות בשליחה אחת לרבים חייבות להיות מאותה תבנית (או כולן הודעה חופשית).", details={"outcome": "not_sent"})
            if len(rows) >= cfg["bulk_max"] or (bulk_total is not None and len(rows) >= bulk_total):
                raise ApiError(422, "message_bulk_too_many", f"אפשר לשלוח לעד {cfg['bulk_max']} אנשים בבת אחת.", details={"outcome": "not_sent", "bulk_max": cfg["bulk_max"]})
        state = window_state(w, cfg["rate_per_hour"], now=now)
        if state["used"] >= state["limit"]:
            raise ApiError(429, "message_rate_limited", "הגעתם למכסת ההודעות לשעה.", retryable=True,
                           details={"outcome": "not_sent", "scope": "hour", "retry_after_s": state["resets_in_s"], "quota": state})
        w.execute(
            """INSERT INTO intercom_messages(id, at, actor_user_id, actor_name, person_id, kind, template_id, template_label, template_revision, chars,
                                             bulk_id, client_request_id, request_id, outcome)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')""",
            (message_id, iso(now), principal.user_id, (getattr(principal, "display_name", None) or getattr(principal, "username", None) or "")[:128] or None, person_id, kind,
             template_id, template_label, template_revision, chars, bulk_id, client_request_id, request_id),
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


def history(conn: sqlite3.Connection, person_id: str, limit: int = 30, *, now: datetime | None = None) -> list[dict[str, Any]]:
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


def opted_out(conn: sqlite3.Connection, person_id: str) -> dict[str, Any] | None:
    row = conn.execute("SELECT at, by_name FROM intercom_message_optout WHERE person_id = ?", (person_id,)).fetchone()
    return {"at": row["at"], "by": row["by_name"]} if row else None


def set_opt_out(db: Database, *, principal: Any, person_id: str, declined: bool, request_id: str | None) -> dict[str, Any] | None:
    """Mark / unmark a person as one who asked not to be messaged; one audit row (the person id and the new state - nothing else)."""
    from ..audit import audit

    name = (getattr(principal, "display_name", None) or getattr(principal, "username", None) or "")[:128] or None
    with db.write_aside() as w:
        if declined:
            w.execute("INSERT INTO intercom_message_optout(person_id, at, by_user_id, by_name) VALUES (?, ?, ?, ?) ON CONFLICT(person_id) DO UPDATE SET at = excluded.at, by_user_id = excluded.by_user_id, by_name = excluded.by_name",
                      (person_id, iso(utc()), principal.user_id, name))
        else:
            w.execute("DELETE FROM intercom_message_optout WHERE person_id = ?", (person_id,))
        audit(w, actor=principal, action=AUDIT_OPTOUT, decision="allowed", resource_type="intercom_person", resource_id=person_id, request_id=request_id,
              details={"opted_out": declined})
        return opted_out(w, person_id)


def consent_from(opted: bool, wiskey: str) -> str:
    """The effective consent: `declined` if the person is on Arx's opt-out list or WisKey says so; `granted` if WisKey says so;
    otherwise `unknown` (which is allowed - a message about the person's own access is service information)."""
    if opted or wiskey == "declined":
        return "declined"
    return "granted" if wiskey == "granted" else "unknown"


def consent_of(conn: sqlite3.Connection, person_id: str, wiskey: str) -> str:
    return consent_from(opted_out(conn, person_id) is not None, wiskey)
