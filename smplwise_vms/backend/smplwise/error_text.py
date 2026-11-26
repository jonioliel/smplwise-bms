"""I18N-REST-2520: the English of the server's constant refusal texts - the `user_message` an `ApiError` (or one of the error helpers
and error classes that build one) is raised with as a plain Hebrew literal.

Before this table an English user saw those texts in Hebrew unless the raising code had put a `details.message_en` beside them
(I18N-BACKEND-2490 step 2). The table is keyed by the Hebrew text itself, as the frontend's source-text tables are (`tr('<Hebrew>')`,
frontend/src/i18n/msg.ts): nothing at the 2,300 raising sites changes, a Hebrew reader gets the same bytes as before, and the English is
chosen only where the envelope is answered (errors.ApiError.message_in, after the `Msg` and `details.message_en` steps).

- `error_text_en.json` (beside this module): {Hebrew: English}, written by hand with the words of the frontend's English catalogues
  (docs/i18n/GLOSSARY_EN.md). A text the table lacks answers its Hebrew, as before.
- Texts built at run time (names and numbers inside the sentence): I18N-RUNTIME-ERRORS-2520 turned the f-strings into `tpl(<Hebrew
  template>, **params)` - a `Tpl`, whose `str` value is exactly the f-string it replaced (each param formatted as the f-string
  formatted it), and whose English is the template of `error_text_tpl_en.json` ("templates": {Hebrew template: English template})
  filled with the same params. A param that is itself a word of the product (a Hebrew label chosen from a fixed table: a weekday, a
  state, the name of an operation) is rendered through "words" ({Hebrew: English}) of the same file; a `Msg` param renders itself;
  anything else (a name, a number, a code) is data and is shown as it is.
  scripts/i18n_backend_errors.py counts every kind per module and keeps a ratchet (docs/i18n/BE_ERRORS_EN_RATCHET.json, read by
  tests/test_i18n_errors_en_2520.py): a constant or a template without English, or a new run-time f-string Hebrew text, fails the test.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from .i18n import DEFAULT_LANG, Msg, fill

TABLE_FILE = Path(__file__).with_name("error_text_en.json")
TPL_FILE = Path(__file__).with_name("error_text_tpl_en.json")
TPL_KEY = "error_text.tpl"


@lru_cache(maxsize=1)
def table() -> dict[str, str]:
    """The Hebrew -> English table (read once)."""
    return json.loads(TABLE_FILE.read_text(encoding="utf-8"))


def english(message: object) -> str | None:
    """The English of a constant Hebrew refusal text, or None (not a string, or not in the table)."""
    if type(message) is not str:  # a Msg renders itself; anything else is not a text of this table
        return None
    return table().get(message) or None


# ---------------------------------------------------------------- run-time texts (I18N-RUNTIME-ERRORS-2520)

@lru_cache(maxsize=1)
def tpl_tables() -> dict[str, dict[str, str]]:
    """{"templates": {Hebrew template: English template}, "words": {Hebrew word: English word}} (read once)."""
    doc = json.loads(TPL_FILE.read_text(encoding="utf-8"))
    return {"templates": dict(doc.get("templates") or {}), "words": dict(doc.get("words") or {})}


def _as_text(value: Any) -> str:
    """A param as the f-string formatted it (`format(value, "")`); a `Msg` (or an error whose `str` is one) stays a `Msg`."""
    return value if isinstance(value, str) else format(value, "")


def word(value: Any, lang: str) -> str:
    """One param in `lang`: a `Msg` rendered, a fixed Hebrew word of the "words" table (or a constant refusal text of the table above)
    in its English, anything else (data) as it is."""
    text = _as_text(value)
    if lang == DEFAULT_LANG:
        return str.__str__(text)
    if isinstance(text, Msg):
        return text.render(lang)
    if lang != "en":
        return text
    # a fixed word of this table, or a whole constant refusal text passed on (another error's `user_message`)
    return tpl_tables()["words"].get(text) or table().get(text) or text


class Tpl(Msg):
    """A refusal text built at run time: its `str` value is the Hebrew template filled with the params (byte for byte the f-string it
    replaced); `render("en")` fills the English template of `error_text_tpl_en.json` (the Hebrew when the table has none)."""

    template: str

    def __new__(cls, template: str, /, **params: Any) -> "Tpl":
        self = str.__new__(cls, fill(template, {k: str.__str__(_as_text(v)) for k, v in params.items()}))
        self.key = TPL_KEY
        self.params = params
        self.template = template
        return self

    def __reduce__(self) -> tuple[Any, ...]:  # copy / deepcopy / pickle keep the template
        return (_rebuild_tpl, (self.template, self.params))

    def render(self, lang: str) -> str:
        if lang == DEFAULT_LANG:
            return str.__str__(self)
        en = tpl_tables()["templates"].get(self.template) if lang == "en" else None
        if not en:
            return str.__str__(self)
        return fill(en, {k: word(v, lang) for k, v in self.params.items()})


def _rebuild_tpl(template: str, params: dict[str, Any]) -> Tpl:
    return Tpl(template, **params)


def tpl(template: str, /, **params: Any) -> Tpl:
    """The refusal text `template` (Hebrew, `{name}` slots) with its params - see `Tpl`."""
    return Tpl(template, **params)
