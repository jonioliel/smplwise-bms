"""CR-038 9.7 / 14.3 / D26 / D33: message templates - placeholders, validation, the starter texts in he / en / ar / ru, the choice of
a template for a contact's language, and rendering.

Rules (9.7):
- Allow-listed placeholders only (PLACEHOLDERS). `{link}` is mandatory in assign / reminder / reopened / update; `{code}` is
  mandatory in, and allowed only in, the `code` template, which carries no link and no ticket title (this module is stricter and
  also refuses `{place}` and `{device}` there: a forwarded code message discloses nothing about the ticket).
- No Unicode Cc / Cf characters (control, bidi, zero-width - review T9), no URL other than `{link}`, at most 1000 rendered
  characters (checked against worst-case values at save time; capped values at send time).
- `{module_name}` / `{module_name_plural}` (D33) render in the CONTACT's language from the `display_name` setting (14.3); an
  agreeing word is written `{g:f=<feminine>|m=<masculine>|n=<neuter>}` and follows the noun's gender in that language. Starter
  texts never hard-code the module's noun (a lint test enforces it), so renaming the module changes every starter message.
- The rendered text is never stored and never logged: the outbox keeps template id + revision + params without `{link}` /
  `{code}`; the two secrets are passed to `render` at send time only.
- Rendering is ONE pass (a value is never scanned for placeholders again).
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Iterable, Mapping

from . import naming as _naming
from .channel import DEFAULT_LANG, LANGS, LINK_PURPOSES, PURPOSES, Button, one_line, strip_controls

PLACEHOLDERS = ("name", "number", "department", "title", "place", "device", "priority", "organization", "link", "code",
                "manager", "eta", "module_name", "module_name_plural")
SECRET_PLACEHOLDERS = frozenset({"link", "code"})  # never in params_json; passed at send time only
PARAM_KEYS = frozenset(PLACEHOLDERS) - SECRET_PLACEHOLDERS - {"module_name", "module_name_plural"}
CODE_FORBIDDEN = frozenset({"link", "title", "place", "device"})
RENDERED_MAX = 1000
BODY_MAX = 1500

# per-placeholder caps: worst-case values at save time, hard caps at send time
VALUE_MAX = {"name": 80, "number": 7, "department": 60, "title": 120, "place": 200, "device": 80, "priority": 30,
             "organization": 60, "link": 120, "code": 6, "manager": 80, "eta": 24, "module_name": 30, "module_name_plural": 30}
SECRET_MAX = {"link": 400, "code": 6}  # send time (slice 5b): the real URL is system-made and never cut (a cut link is a dead link)

# 14.3 defaults - ONE source (slice 5b unified the two naming schemes): slice 1's naming.DEFAULTS (`tickets.name`, tokens {ticket} /
# {tickets}) for all four languages; these templates keep their {module_name} / {module_name_plural} tokens, rendered from the same
# names (the outbox passes naming.names_for per language). English has no grammatical gender there: "n" here.
DEFAULT_DISPLAY_NAME: dict[str, dict[str, Any]] = {
    lang: {"one": _naming.DEFAULTS[lang]["one"], "many": _naming.DEFAULTS[lang]["many"], "gender": _naming.DEFAULTS[lang]["gender"] or "n"}
    for lang in LANGS
}
# the default nouns (and listed case forms) that user-facing message texts must not hard-code (14.3 lint); the earlier message-core
# defaults stay listed too
DEFAULT_NOUNS = tuple(dict.fromkeys(
    [_naming.DEFAULTS[lang][form] for lang in LANGS for form in ("one", "many")]
    + ["ticket", "tickets", "طلب", "طلبات", "заявка", "заявки", "заявку", "заявок"]))

_TOKEN = re.compile(r"\{([^{}]*)\}")
_GENDER = re.compile(r"^g:([fmn]=[^|{}]*)(\|[fmn]=[^|{}]*)*$")
# a URL that is not {link}: a scheme, `www.`, a punycode label, or (deep review B5) a bare domain followed by a path - labels
# joined by dots, the last one of letters only (2+), then `/` - which WhatsApp turns into a link ("evil.example/x"). Numbers
# with dots and slashes ("1.5/2", "2.5.6/ב") are not domains.
_URL = re.compile(r"(?i)\b(?:https?://|www\.|xn--)|\b[\w-]+(?:\.[\w-]+)*\.[^\W\d_]{2,}/")

# the reply words and button captions per language (buttons are OFF by default, 9.3)
BUTTON_TEXT = {
    "he": {"ack": "התקבל", "wip": "בטיפול"},
    "en": {"ack": "Received", "wip": "In progress"},
    "ar": {"ack": "تم الاستلام", "wip": "قيد المعالجة"},
    "ru": {"ack": "Получено", "wip": "В работе"},
}
BUTTON_ACTIONS = ("ack", "wip")

# Starter templates (one per purpose x language). ar / ru need a native speaker's review before the release (slice 8, 9.7).
STARTERS: dict[str, dict[str, str]] = {
    "assign": {
        "he": "שלום {name},\n{module_name} {number} ({department}): {title}\n{place}\nלעדכון הטיפול: {link}\nלאישור מהיר השב 1 = התקבל, 2 = בטיפול",
        "en": "Hello {name},\nNew {module_name} #{number} ({department}): {title}\n{place}\nUpdate the handling: {link}\nQuick reply: 1 = received, 2 = in progress",
        "ar": "مرحبًا {name}،\n{module_name} رقم {number} ({department}): {title}\n{place}\nلتحديث المعالجة: {link}\nللرد السريع: 1 = تم الاستلام، 2 = قيد المعالجة",
        "ru": "Здравствуйте, {name}!\n{g:f=Новая|m=Новый|n=Новое} {module_name} № {number} ({department}): {title}\n{place}\nОбновить статус: {link}\nБыстрый ответ: 1 = получено, 2 = в работе",
    },
    "reminder": {
        "he": "תזכורת: {module_name} {number} ({department}): {title}\nלעדכון הטיפול: {link}\nלאישור מהיר השב 1 = התקבל, 2 = בטיפול",
        "en": "Reminder: {module_name} #{number} ({department}): {title}\nUpdate the handling: {link}\nQuick reply: 1 = received, 2 = in progress",
        "ar": "تذكير: {module_name} رقم {number} ({department}): {title}\nلتحديث المعالجة: {link}\nللرد السريع: 1 = تم الاستلام، 2 = قيد المعالجة",
        "ru": "Напоминание: {module_name} № {number} ({department}): {title}\nОбновить статус: {link}\nБыстрый ответ: 1 = получено, 2 = в работе",
    },
    "code": {
        "he": "קוד האימות: {code}\nהקוד בתוקף 10 דקות. אין למסור אותו לאחרים.",
        "en": "Verification code: {code}\nValid for 10 minutes. Do not share it.",
        "ar": "رمز التحقق: {code}\nصالح لمدة 10 دقائق. لا تشاركه مع أحد.",
        "ru": "Код подтверждения: {code}\nДействует 10 минут. Никому его не сообщайте.",
    },
    "closed": {
        "he": "{module_name} {number} ({department}) {g:f=נסגרה|m=נסגר|n=נסגר}. תודה.",
        "en": "{module_name} #{number} ({department}) is closed. Thank you.",
        "ar": "تم إغلاق {module_name} رقم {number} ({department}). شكرًا.",
        "ru": "{module_name} № {number} ({department}) {g:f=закрыта|m=закрыт|n=закрыто}. Спасибо.",
    },
    "reassigned": {
        "he": "{module_name} {number} ({department}) {g:f=הועברה|m=הועבר|n=הועבר} לטיפול אחר. הקישור שקיבלתם אינו פעיל עוד.",
        "en": "{module_name} #{number} ({department}) was handed to someone else. Your link no longer works.",
        "ar": "تم تحويل {module_name} رقم {number} ({department}) إلى جهة أخرى. الرابط الذي استلمته لم يعد فعالًا.",
        "ru": "{module_name} № {number} ({department}) {g:f=передана|m=передан|n=передано} другому исполнителю. Ваша ссылка больше не действует.",
    },
    "reopened": {
        "he": "{module_name} {number} ({department}) {g:f=נפתחה|m=נפתח|n=נפתח} מחדש: {title}\n{place}\nלעדכון הטיפול: {link}\nלאישור מהיר השב 1 = התקבל, 2 = בטיפול",
        "en": "{module_name} #{number} ({department}) was reopened: {title}\n{place}\nUpdate the handling: {link}\nQuick reply: 1 = received, 2 = in progress",
        "ar": "أعيد فتح {module_name} رقم {number} ({department}): {title}\n{place}\nلتحديث المعالجة: {link}\nللرد السريع: 1 = تم الاستلام، 2 = قيد المعالجة",
        "ru": "{module_name} № {number} ({department}) {g:f=открыта|m=открыт|n=открыто} снова: {title}\n{place}\nОбновить статус: {link}\nБыстрый ответ: 1 = получено, 2 = в работе",
    },
    "update": {
        "he": "עדכון: {module_name} {number} ({department}): {title}\n{place}\nלעדכון הטיפול: {link}",
        "en": "Update: {module_name} #{number} ({department}): {title}\n{place}\nUpdate the handling: {link}",
        "ar": "تحديث: {module_name} رقم {number} ({department}): {title}\n{place}\nلتحديث المعالجة: {link}",
        "ru": "Обновление: {module_name} № {number} ({department}): {title}\n{place}\nОбновить статус: {link}",
    },
    # slice 9 (11A.7): the vendor's cost claim - never an amount in a message; the vendor reopens the handler link it already
    # received (the claim step opens on it until the claim window ends)
    "cost_rejected": {
        "he": "דרישת העלות ל{module_name} {number} ({department}) הוחזרה לתיקון. פתחו את הקישור שקיבלתם כדי לעיין בהערה ולהגיש מחדש.",
        "en": "The cost claim for {module_name} #{number} ({department}) was sent back for correction. Open the link you received to see the note and resubmit.",
        "ar": "أعيدت مطالبة التكلفة لـ {module_name} رقم {number} ({department}) للتصحيح. افتحوا الرابط الذي استلمتموه للاطلاع على الملاحظة وإعادة التقديم.",
        "ru": "Счёт по {module_name} № {number} ({department}) возвращён на исправление. Откройте полученную ссылку, чтобы увидеть замечание и отправить снова.",
    },
    "cost_approved": {
        "he": "דרישת העלות ל{module_name} {number} ({department}) אושרה. תודה.",
        "en": "The cost claim for {module_name} #{number} ({department}) was approved. Thank you.",
        "ar": "تمت الموافقة على مطالبة التكلفة لـ {module_name} رقم {number} ({department}). شكرًا.",
        "ru": "Счёт по {module_name} № {number} ({department}) одобрен. Спасибо.",
    },
    "cost_reopened": {
        "he": "אפשר שוב להגיש דרישת עלות ל{module_name} {number} ({department}). פתחו את הקישור שקיבלתם כדי להגיש.",
        "en": "You can submit the cost claim for {module_name} #{number} ({department}) again. Open the link you received to submit it.",
        "ar": "يمكنكم مجددًا تقديم مطالبة التكلفة لـ {module_name} رقم {number} ({department}). افتحوا الرابط الذي استلمتموه للتقديم.",
        "ru": "Вы снова можете отправить счёт по {module_name} № {number} ({department}). Откройте полученную ссылку, чтобы отправить его.",
    },
    "test": {
        "he": "הודעת בדיקה. אין צורך להשיב.",
        "en": "Test message. No reply needed.",
        "ar": "رسالة اختبار. لا حاجة للرد.",
        "ru": "Тестовое сообщение. Отвечать не нужно.",
    },
}


class TemplateError(ValueError):
    """`code` is a stable word; the message never carries a value."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class TemplateText:
    """One stored template (`ticket_templates kind='message'`), or a starter (`id` = 'starter:<purpose>:<lang>', no revision)."""

    id: str
    purpose: str
    lang: str
    body: str = field(repr=False)
    department_id: str | None = None
    revision: int | None = None
    active: bool = True

    @property
    def is_starter(self) -> bool:
        return self.id.startswith("starter:")


def starter(purpose: str, lang: str) -> TemplateText | None:
    texts = STARTERS.get(purpose)
    if not texts:
        return None
    lang = lang if lang in texts else DEFAULT_LANG
    return TemplateText(id=f"starter:{purpose}:{lang}", purpose=purpose, lang=lang, body=texts[lang])


def choose(candidates: Iterable[TemplateText], *, purpose: str, lang: str, department_id: str | None) -> TemplateText | None:
    """D26: the contact's language first, then Hebrew. Within a language: the department's template, then the installation's, then
    the starter of that language (the spec's starters ship in he / en / ar / ru as templates of their own, 9.7 - slice 5b reading:
    an Arabic-speaking vendor gets the Arabic starter rather than an administrator's Hebrew text). Hebrew is the fallback only for a
    purpose without a starter in the contact's language (the cost notices of slice 9)."""
    lang = lang if lang in LANGS else DEFAULT_LANG
    live = [t for t in candidates if t.active and t.purpose == purpose]
    order = [lang] if lang == DEFAULT_LANG else [lang, DEFAULT_LANG]
    for want in order:
        for dept in ((department_id, None) if department_id else (None,)):
            for t in live:
                if t.lang == want and t.department_id == dept:
                    return t
        own = STARTERS.get(purpose, {})
        if want in own:
            return starter(purpose, want)
    return starter(purpose, lang)


# ---------------------------------------------------------------- module name (D33)

def names_for(display_name: Mapping[str, Any] | None, lang: str) -> dict[str, str]:
    """The module's noun forms and gender in `lang`, falling back field by field to the defaults of that language."""
    lang = lang if lang in LANGS else DEFAULT_LANG
    base = dict(DEFAULT_DISPLAY_NAME[lang])
    doc = display_name.get(lang) if isinstance(display_name, Mapping) else None
    if isinstance(doc, Mapping):
        for key in ("one", "many"):
            value = one_line(doc.get(key), VALUE_MAX["module_name"]).replace("{", "").replace("}", "")
            if value:
                base[key] = value
        if doc.get("gender") in ("f", "m", "n"):
            base["gender"] = doc["gender"]
    return base


def _gender_choice(token: str, gender: str) -> str:
    forms = dict(part.split("=", 1) for part in token[2:].split("|"))
    for g in (gender, "m", "f", "n"):
        if g in forms:
            return forms[g]
    return ""


# ---------------------------------------------------------------- validation (save time)

_WORST = {k: "W" * v for k, v in VALUE_MAX.items()}


def problems(purpose: str, body: Any, *, for_contacts: bool = True) -> list[dict[str, str]]:
    """Field problems of one message template ([] = valid). Codes: purpose_unknown, empty, too_long, control_chars,
    brace_unbalanced, placeholder_unknown, gender_malformed, url_not_link, link_required, code_required, code_not_allowed,
    code_discloses."""
    out: list[dict[str, str]] = []

    def add(code: str) -> None:
        if not any(p["code"] == code for p in out):
            out.append({"code": code, "field": "body"})

    if purpose not in PURPOSES:
        return [{"code": "purpose_unknown", "field": "purpose"}]
    if not isinstance(body, str) or not body.strip():
        return [{"code": "empty", "field": "body"}]
    if len(body) > BODY_MAX:
        add("too_long")
    if any(unicodedata.category(ch) in ("Cc", "Cf", "Zl", "Zp") for ch in body.replace("\r\n", "\n") if ch != "\n"):
        add("control_chars")
    if body.count("{") != body.count("}") or "{" in _TOKEN.sub("", body) or "}" in _TOKEN.sub("", body):
        add("brace_unbalanced")
    names = []
    for m in _TOKEN.finditer(body):
        token = m.group(1)
        if token.startswith("g:"):
            if not _GENDER.match(token) or _URL.search(token):
                add("gender_malformed")
            continue
        if token not in PLACEHOLDERS:
            add("placeholder_unknown")
            continue
        names.append(token)
    if _URL.search(_TOKEN.sub("", body)):
        add("url_not_link")
    if purpose == "code":
        if "code" not in names:
            add("code_required")
        if CODE_FORBIDDEN.intersection(names):
            add("code_discloses")
    else:
        if "code" in names:
            add("code_not_allowed")
        if for_contacts and purpose in LINK_PURPOSES and "link" not in names:
            add("link_required")
    if not any(p["code"] in ("brace_unbalanced", "gender_malformed") for p in out):
        worst = render(body, _WORST, lang="he", display_name={l: {"one": "W" * 30, "many": "W" * 30} for l in LANGS},
                       secrets={"link": _WORST["link"], "code": _WORST["code"]}, check_length=False)
        if len(worst) > RENDERED_MAX:
            add("too_long")
    return out


def check_params(params: Mapping[str, Any]) -> dict[str, str]:
    """`params_json` of an outbox row: allow-listed keys only, never `{link}` / `{code}` (or anything else). Values become strings."""
    bad = [k for k in params if k not in PARAM_KEYS]
    if bad:
        raise TemplateError("param_not_allowed")
    return {k: one_line(v, VALUE_MAX[k]) for k, v in params.items()}


# ---------------------------------------------------------------- rendering (send time)

def render(body: str, params: Mapping[str, Any], *, lang: str, display_name: Mapping[str, Any] | None = None,
           secrets: Mapping[str, str] | None = None, check_length: bool = True) -> str:
    """Fill a template in ONE pass. Values are one line, Cc/Cf stripped and capped; a line that was only placeholders and renders
    empty (e.g. no place) is dropped. Raises TemplateError('too_long') when the result passes RENDERED_MAX (provably not sent)."""
    names = names_for(display_name, lang)
    values: dict[str, str] = {k: one_line(params.get(k), VALUE_MAX[k]) for k in PARAM_KEYS}
    for key in SECRET_PLACEHOLDERS:
        values[key] = one_line((secrets or {}).get(key), SECRET_MAX[key])
    values["module_name"] = names["one"]
    values["module_name_plural"] = names["many"]

    def sub(m: re.Match[str]) -> str:
        token = m.group(1)
        if token.startswith("g:") and _GENDER.match(token):
            return _gender_choice(token, names["gender"])
        value = values.get(token, "")
        if token in ("module_name", "module_name_plural") and not m.string[:m.start()].strip():
            value = value[:1].upper() + value[1:]  # a line that starts with the noun starts with a capital (en / ru)
        return value

    lines = []
    for line in strip_controls(body, multiline=True).split("\n"):
        filled = _TOKEN.sub(sub, line)
        if filled.strip() or not line.strip():
            lines.append(filled.rstrip())
        # a line that had content but rendered empty is dropped
    text = "\n".join(lines).strip()
    if check_length and len(text) > RENDERED_MAX:
        raise TemplateError("too_long")
    return text


def buttons_for(nonce: str, lang: str) -> tuple[Button, ...]:
    texts = BUTTON_TEXT.get(lang) or BUTTON_TEXT[DEFAULT_LANG]
    return tuple(Button(id=f"t:{nonce}:{action}", text=texts[action]) for action in BUTTON_ACTIONS)


def footer_for(params: Mapping[str, Any], *, lang: str, display_name: Mapping[str, Any] | None = None) -> str:
    names = names_for(display_name, lang)
    return f"{names['one']} {one_line(params.get('number'), VALUE_MAX['number'])}".strip()
