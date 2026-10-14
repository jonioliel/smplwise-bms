"""CR-038, owner decision D33 (2026-10-13): the module's USER-FACING name is configurable. Internal identifiers (tables, routes,
permission keys, the `tickets.enabled` switch) stay "tickets"; every text a person reads that names the module goes through ONE
display-name pair per language - singular and plural, plus the grammatical gender where the language has one - read from the
setting `tickets.name` through this module (server) and `frontend/src/tickets/naming.ts` (screens).

THE CONTRACT (every slice that adds text naming the module follows it):
- write the text as a TEMPLATE with tokens, never with the default word:
    {ticket}            the singular        ("קריאה")
    {tickets}           the plural          ("קריאות")
    {f:<text>|m:<text>} a word that agrees with the name's gender ("חדשה" / "חדש"); Russian may add |n:<text>
- render it with `render(text, names)` (a resolved language entry) or `render_for(conn, text, lang)`;
- permission labels and built-in role names carry the tokens in routers/access.py / roles.json and are rendered wherever they are
  served (`rendered_labels`, `rbac.role_name`); notification texts (slice 6), WhatsApp templates and the vendor page (slices 4 / 5b)
  render through `names_for(conn, lang)` with the contact's language.
A test fails when a tickets text carries the default word instead of a token (tests/test_tickets_naming.py, and the frontend's
tests/unit-tickets-naming.spec.ts for the screens).

The setting is a JSON document `{"revision": n, "he": {"one", "many", "gender"}, "en": {...}, "ar": {...}, "ru": {...}}`, edited by
holders of `tickets.configure` (Settings > the module > general). A missing, corrupt or invalid entry reads as the default of that
language (fail safe: the product always has a name to show). It is installation configuration: kept out of project backups
(services/backup.SETTINGS_KEEP) like `tickets.enabled` and `tickets.settings`."""
from __future__ import annotations

import json
import re
import sqlite3
import unicodedata
from typing import Any

SETTING_KEY = "tickets.name"
LANGS: tuple[str, ...] = ("he", "en", "ar", "ru")
GENDERS: dict[str, tuple[str, ...]] = {"he": ("f", "m"), "ar": ("f", "m"), "ru": ("f", "m", "n"), "en": ("",)}
DEFAULTS: dict[str, dict[str, str]] = {
    "he": {"one": "קריאה", "many": "קריאות", "gender": "f"},
    "en": {"one": "Ticket", "many": "Tickets", "gender": ""},
    "ar": {"one": "بلاغ", "many": "بلاغات", "gender": "m"},
    "ru": {"one": "Заявка", "many": "Заявки", "gender": "f"},
}
NAME_MIN, NAME_MAX = 1, 30
# letters and marks of any script, digits, spaces and a few typographic signs (Hebrew geresh / gershayim, apostrophe, quotes,
# hyphen, period, parentheses); nothing that is markup or a template token (< > { } [ ] & $ ` | \ / @ # % ^ * = + ~ ; :)
_ALLOWED_PUNCT = set(" -'\"׳״.()")
_TOKEN = re.compile(r"\{(tickets|ticket)\}|\{f:([^{}|]*)\|m:([^{}|]*)(?:\|n:([^{}|]*))?\}")


class NameInvalid(ValueError):
    def __init__(self, field: str, code: str):
        super().__init__(f"{field}:{code}")
        self.field = field
        self.code = code


def clean_name(value: Any, field: str) -> str:
    """One name (singular or plural) as stored: whitespace collapsed, controls and format characters refused, 1-30 characters of
    letters, marks, digits, spaces and a few typographic signs. Raises NameInvalid."""
    if not isinstance(value, str):
        raise NameInvalid(field, "required")
    for ch in value:
        if unicodedata.category(ch) in ("Cc", "Cf", "Cs", "Co", "Cn") and ch not in " ":
            raise NameInvalid(field, "control_character")
    text = " ".join(value.split())
    if len(text) < NAME_MIN:
        raise NameInvalid(field, "required")
    if len(text) > NAME_MAX:
        raise NameInvalid(field, "too_long")
    for ch in text:
        cat = unicodedata.category(ch)
        if cat[0] in ("L", "M") or cat == "Nd" or ch in _ALLOWED_PUNCT:
            continue
        raise NameInvalid(field, "character")
    if not any(unicodedata.category(ch)[0] == "L" for ch in text):
        raise NameInvalid(field, "no_letter")
    return text


def _entry(lang: str, raw: Any) -> dict[str, str]:
    """A stored language entry, validated; the default of the language when absent or invalid."""
    base = dict(DEFAULTS[lang])
    if not isinstance(raw, dict):
        return base
    try:
        one = clean_name(raw.get("one"), f"{lang}.one")
        many = clean_name(raw.get("many"), f"{lang}.many")
    except NameInvalid:
        return base
    gender = raw.get("gender", base["gender"])
    if gender not in GENDERS[lang]:
        gender = base["gender"]
    return {"one": one, "many": many, "gender": gender}


def read(conn: sqlite3.Connection) -> dict[str, Any]:
    """The whole document with every language resolved (stored value or default) and its revision (0 = never saved)."""
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (SETTING_KEY,)).fetchone()
    try:
        doc = json.loads(row[0]) if row else {}
    except (ValueError, TypeError):
        doc = {}
    if not isinstance(doc, dict):
        doc = {}
    rev = doc.get("revision")
    out: dict[str, Any] = {"revision": rev if isinstance(rev, int) and not isinstance(rev, bool) and rev >= 0 else 0}
    for lang in LANGS:
        out[lang] = _entry(lang, doc.get(lang))
    return out


def names_for(conn: sqlite3.Connection, lang: str = "he") -> dict[str, str]:
    doc = read(conn)
    return doc[lang if lang in LANGS else "he"]


def validate(body: dict[str, Any]) -> dict[str, dict[str, str]]:
    """The languages a save sends (each one complete: one, many, gender), validated. Raises NameInvalid on the first problem."""
    out: dict[str, dict[str, str]] = {}
    for lang in LANGS:
        if lang not in body or body[lang] is None:
            continue
        raw = body[lang]
        if not isinstance(raw, dict):
            raise NameInvalid(lang, "format")
        one = clean_name(raw.get("one"), f"{lang}.one")
        many = clean_name(raw.get("many"), f"{lang}.many")
        gender = raw.get("gender", DEFAULTS[lang]["gender"])
        if gender not in GENDERS[lang]:
            raise NameInvalid(f"{lang}.gender", "choice")
        out[lang] = {"one": one, "many": many, "gender": gender}
    return out


def store(conn: sqlite3.Connection, languages: dict[str, dict[str, str]], revision: int) -> dict[str, Any]:
    """Write the document (the languages not sent keep their stored value). The caller checked the revision."""
    current = read(conn)
    doc: dict[str, Any] = {"revision": revision}
    for lang in LANGS:
        doc[lang] = languages.get(lang, current[lang])
    conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                 (SETTING_KEY, json.dumps(doc, ensure_ascii=False, separators=(",", ":"))))
    return read(conn)


def render(text: str, names: dict[str, str]) -> str:
    """Replace the tokens of a template with one language's names (see the module docstring)."""

    def sub(m: re.Match[str]) -> str:
        if m.group(1) == "tickets":
            return names["many"]
        if m.group(1) == "ticket":
            return names["one"]
        gender = names.get("gender") or "f"
        if gender == "m":
            return m.group(3)
        if gender == "n" and m.group(4) is not None:
            return m.group(4)
        return m.group(2)

    return _TOKEN.sub(sub, text)


def render_for(conn: sqlite3.Connection, text: str, lang: str = "he") -> str:
    return render(text, names_for(conn, lang))


def has_tokens(text: str) -> bool:
    return _TOKEN.search(text) is not None


def render_catalogue(conn: sqlite3.Connection, labels: dict[str, str], lang: str = "he") -> dict[str, str]:
    """A label catalogue (permission labels, role names) with every templated entry rendered; others untouched."""
    names = names_for(conn, lang)
    return {k: (render(v, names) if "{" in v else v) for k, v in labels.items()}
