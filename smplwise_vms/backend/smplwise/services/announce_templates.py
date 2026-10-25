"""ANNOUNCE-295 (stage A): the ready-made announcement templates (תבניות הודעה).

A template is `{id, kind, name: {he,en,ru}, text: {he,en,ru}}`. `kind` is `routine` (a building notice the announcer picks, edits if he wants and
sends to a room or the whole building) or `emergency` (a one-click emergency announcement: no confirmation step, every allowed speaker, every
language the template has). The spoken languages are Hebrew, English and Russian (`LANGUAGES`) and Arabic. A template
may leave a language out (Hebrew is the one that is required), and the announcer is only ever offered the languages a template has.

The list lives in the settings table (`announce.templates`, a JSON list) and is edited in Settings by `system.configure` as a whole list (strict
validation, every text goes through the same plain-text cleaning as a typed text). Until it is edited the built-in defaults below apply; they are
not rows, so a new default shipped in a later version reaches an installation that never customised its list. Changing the list is audited.
"""
from __future__ import annotations

import json
import re
import sqlite3
from typing import Any

from ..db import get_setting

LANGUAGES = ("he", "en", "ru", "ar")
KINDS = ("routine", "emergency")
K_TEMPLATES = "announce.templates"
K_EMERGENCY_LANGS = "announce.emergency_languages"
MAX_TEMPLATES = 30
NAME_MAX = 60
ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")

DEFAULTS: list[dict[str, Any]] = [
    {"id": "water_off", "kind": "routine",
     "name": {"he": "הפסקת מים", "en": "Water interruption", "ru": "Отключение воды", "ar": "انقطاع المياه"},
     "text": {"he": "שימו לב: בעוד זמן קצר תופסק אספקת המים בבניין לצורך עבודות תחזוקה.",
              "en": "Attention: the water supply to the building will be interrupted shortly for maintenance work.",
              "ru": "Внимание: в ближайшее время подача воды в здание будет прекращена для проведения работ.",
              "ar": "انتبهوا: سيتم قطع المياه عن المبنى قريبًا لأعمال الصيانة."}},
    {"id": "elevator_service", "kind": "routine",
     "name": {"he": "מעלית בטיפול", "en": "Elevator service", "ru": "Обслуживание лифта", "ar": "صيانة المصعد"},
     "text": {"he": "שימו לב: המעלית אינה זמינה כרגע בשל טיפול. אנו מתנצלים על אי הנוחות.",
              "en": "Attention: the elevator is unavailable at the moment due to service. We apologise for the inconvenience.",
              "ru": "Внимание: лифт временно недоступен из-за технического обслуживания. Приносим извинения за неудобства.",
              "ar": "انتبهوا: المصعد غير متاح حاليًا بسبب الصيانة. نعتذر عن الإزعاج."}},
    {"id": "visitors", "kind": "routine",
     "name": {"he": "אורחים בבניין", "en": "Visitors in the building", "ru": "Гости в здании", "ar": "ضيوف في المبنى"},
     "text": {"he": "שימו לב: בשעות הקרובות יגיעו אורחים לבניין.",
              "en": "Attention: visitors will arrive at the building in the coming hours.",
              "ru": "Внимание: в ближайшие часы в здание прибудут гости.",
              "ar": "انتبهوا: سيصل ضيوف إلى المبنى في الساعات القادمة."}},
    {"id": "evacuate", "kind": "emergency",
     "name": {"he": "פינוי הבניין", "en": "Evacuate the building", "ru": "Эвакуация здания", "ar": "إخلاء المبنى"},
     "text": {"he": "חירום. יש לפנות את הבניין מיד דרך יציאות החירום. אל תשתמשו במעליות.",
              "en": "Emergency. Evacuate the building immediately through the emergency exits. Do not use the elevators.",
              "ru": "Чрезвычайная ситуация. Немедленно покиньте здание через аварийные выходы. Не пользуйтесь лифтами.",
              "ar": "حالة طوارئ. أخلوا المبنى فورًا عبر مخارج الطوارئ. لا تستخدموا المصاعد."}},
    {"id": "shelter", "kind": "emergency",
     "name": {"he": "הישארו במקום מוגן", "en": "Shelter in place", "ru": "Оставайтесь в укрытии", "ar": "ابقوا في مكان محمي"},
     "text": {"he": "חירום. הישארו במקום מוגן ופעלו לפי הנחיות הצוות.",
              "en": "Emergency. Stay in a protected place and follow the staff instructions.",
              "ru": "Чрезвычайная ситуация. Оставайтесь в безопасном месте и следуйте указаниям персонала.",
              "ar": "حالة طوارئ. ابقوا في مكان محمي واتبعوا تعليمات الطاقم."}},
]
DEFAULT_EMERGENCY_LANGS = ["he", "en", "ru", "ar"]


class TemplateInvalid(ValueError):
    def __init__(self, field: str) -> None:
        super().__init__(field)
        self.field = field


def _clean(text: Any, limit: int) -> str:
    # the same plain-text rules as a typed text (control characters refused, markup removed, length limited)
    from . import announcements as ann

    t = ann.clean_text(text)
    if len(t) > limit:
        raise ann.err(422, "text_invalid")
    return t


def validate(raw: Any) -> list[dict[str, Any]]:
    """The strict form of a whole template list; raises TemplateInvalid(field) for anything else."""
    from . import announcements as ann

    if not isinstance(raw, list) or len(raw) > MAX_TEMPLATES:
        raise TemplateInvalid("templates")
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for i, t in enumerate(raw):
        if not isinstance(t, dict) or set(t) - {"id", "kind", "name", "text"}:
            raise TemplateInvalid(f"templates[{i}]")
        tid, kind = t.get("id"), t.get("kind")
        if not isinstance(tid, str) or not ID_RE.match(tid) or tid in seen or kind not in KINDS:
            raise TemplateInvalid(f"templates[{i}]")
        seen.add(tid)
        name, text = t.get("name"), t.get("text")
        if not isinstance(name, dict) or not isinstance(text, dict) or set(name) - set(LANGUAGES) or set(text) - set(LANGUAGES):
            raise TemplateInvalid(f"templates[{i}]")
        names: dict[str, str] = {}
        texts: dict[str, str] = {}
        try:
            for lang in LANGUAGES:
                if lang in name and name[lang] not in ("", None):
                    names[lang] = _clean(name[lang], NAME_MAX)
                if lang in text and text[lang] not in ("", None):
                    texts[lang] = _clean(text[lang], ann.MAX_TEXT)
        except Exception:  # noqa: BLE001 - ApiError text_invalid -> the field
            raise TemplateInvalid(f"templates[{i}]") from None
        if "he" not in names or "he" not in texts:
            raise TemplateInvalid(f"templates[{i}]")
        out.append({"id": tid, "kind": kind, "name": names, "text": texts})
    return out


def load(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """The effective list: the saved one when it is valid, else the built-in defaults (never raises)."""
    raw = get_setting(conn, K_TEMPLATES)
    if raw in (None, ""):
        return [dict(t) for t in DEFAULTS]
    try:
        return validate(json.loads(raw))
    except (ValueError, TemplateInvalid):
        return [dict(t) for t in DEFAULTS]


def by_id(conn: sqlite3.Connection, template_id: str) -> dict[str, Any] | None:
    return next((t for t in load(conn) if t["id"] == template_id), None)


def emergency_languages(conn: sqlite3.Connection) -> list[str]:
    raw = get_setting(conn, K_EMERGENCY_LANGS)
    try:
        v = json.loads(raw) if raw else DEFAULT_EMERGENCY_LANGS
    except ValueError:
        v = DEFAULT_EMERGENCY_LANGS
    got = [x for x in LANGUAGES if isinstance(v, list) and x in v]
    return got or list(DEFAULT_EMERGENCY_LANGS)


def validate_languages(raw: Any) -> list[str]:
    if not isinstance(raw, list) or not raw or any(x not in LANGUAGES for x in raw):
        raise TemplateInvalid("emergency_languages")
    return [x for x in LANGUAGES if x in raw]


def pairs(template: dict[str, Any], languages: list[str]) -> list[tuple[str, str]]:
    """The (language, text) pairs a template yields for the wanted languages, in canonical order, skipping languages it lacks."""
    return [(lang, template["text"][lang]) for lang in LANGUAGES if lang in languages and lang in template["text"]]
