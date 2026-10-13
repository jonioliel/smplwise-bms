"""CR-038 text hygiene for every free-text field of the tickets module, on both surfaces (spec section 16, review T9 / R10).

Rule of the module: every title, description, note, return reason, contact name, inbound text and template text passes
`clean_text` (or `clean_field`) BEFORE its length is checked and before it is stored. What happens to a value:

- Unicode category Cc (controls: NUL, ESC, DEL, the C1 block), Cf (format characters: the bidi embeddings / overrides /
  isolates U+202A-202E and U+2066-2069, LRM / RLM / ALM, zero-width space and joiners U+200B-200D, the BOM U+FEFF, the soft
  hyphen, the Arabic letter mark, tag characters) and Cs (lone surrogates) are removed. Accepted side effect (spec 10.3):
  emoji joined by ZWJ fall apart into their parts and LRM / RLM marks disappear. A bidi override inside a Hebrew note can no
  longer turn "בוצע" into "לא בוצע" on the manager's screen.
- The noncharacters U+FDD0-U+FDEF and U+xFFFE / U+xFFFF are removed.
- A run of more than MAX_COMBINING combining marks on one letter is cut to MAX_COMBINING ("zalgo" text that paints over the
  neighbouring lines). Hebrew niqqud and Arabic harakat stay: a letter carries at most three or four marks.
- Line breaks: in a multi-line field CR LF, CR, VT, FF, NEL, U+2028 and U+2029 become LF, every line loses its trailing
  spaces, more than one empty line in a row becomes one, and the text is stripped. In a single-line field every run of
  whitespace (line breaks included) becomes one space. A tab is a space in both. (The same results as the slice-1 helper
  `model.clean_text` for the characters both handle; this module also normalises the rarer separators.)

Rendering rules that go with it (no code here can enforce them; reviews of the screens and of the public page must):
- text is rendered only as text: Lit text bindings, `textContent`; never `unsafeHTML`, `innerHTML` or Markdown;
- NO AUTO-LINKIFY anywhere (AUTO_LINKIFY below): a URL a vendor typed into a note stays plain text on the manager's screen and
  on the public page. A clickable vendor-supplied link in the manager's session is a phishing lever (review T9-2).

CSV export (spec 13.6 / 11A.9): `csv_cell` prefixes a text cell whose first character a spreadsheet would read as the start
of a formula (`=`, `+`, `-`, `@`, a tab or a CR - and, the safer reading, their full-width forms) with an apostrophe.
Numbers are left as numbers."""
from __future__ import annotations

import re
import unicodedata
from decimal import Decimal
from typing import Annotated, Any, Iterable

# Guidance flag for every renderer of ticket text (documentation only, read by reviews and the lint of slice 1).
AUTO_LINKIFY = False

MAX_COMBINING = 8  # combining marks kept on one base character
_REMOVED_CATEGORIES = frozenset({"Cc", "Cf", "Cs"})
# every character that ends a line; inside a multi-line field each becomes LF, inside a single-line field a space
_LINE_BREAKS = frozenset({"\n", "\r", "\x0b", "\x0c", "\x85", " ", " "})
_MULTI_NEWLINES = re.compile(r"\n{3,}")
# CSV formula starters (spec 13.6) and their full-width forms (U+FF1D, U+FF0B, U+FF0D, U+FF20), which some spreadsheet
# locales also evaluate
FORMULA_STARTERS = ("=", "+", "-", "@", "\t", "\r", "＝", "＋", "－", "＠")


def _noncharacter(cp: int) -> bool:
    return 0xFDD0 <= cp <= 0xFDEF or (cp & 0xFFFE) == 0xFFFE


def is_hidden(ch: str) -> bool:
    """True for a character this module never keeps (Cc / Cf / Cs, a noncharacter). Line breaks and tabs are Cc too; the
    cleaners map them to LF / space before this test."""
    return unicodedata.category(ch) in _REMOVED_CATEGORIES or _noncharacter(ord(ch))


def clean_text(value: object, *, multiline: bool = False, max_combining: int = MAX_COMBINING) -> str:
    """The cleaned text of `value` (None -> ""). See the module docstring for what is removed and how whitespace is treated."""
    if value is None:
        return ""
    s = value if isinstance(value, str) else str(value)
    if multiline:
        s = s.replace("\r\n", "\n")
    out: list[str] = []
    marks = 0
    for ch in s:
        if ch in _LINE_BREAKS:
            out.append("\n" if multiline else " ")
            marks = 0
            continue
        if ch == "\t":
            out.append(" ")
            marks = 0
            continue
        if is_hidden(ch):
            continue
        if unicodedata.combining(ch):
            marks += 1
            if marks > max_combining:
                continue
        else:
            marks = 0
        out.append(ch)
    text = "".join(out)
    if not multiline:
        return " ".join(text.split())
    lines = [ln.rstrip() for ln in text.split("\n")]
    return _MULTI_NEWLINES.sub("\n\n", "\n".join(lines)).strip()


def hidden_characters(value: str) -> list[tuple[int, str]]:
    """(index, U+XXXX) of every character a template or a setting must NOT contain (spec 9.7: templates with Cc / Cf characters
    are refused with 422, not silently cleaned). Line feeds and tabs are allowed in templates and are not listed."""
    found: list[tuple[int, str]] = []
    for i, ch in enumerate(value):
        if ch in ("\n", "\t"):
            continue
        if ch in _LINE_BREAKS or is_hidden(ch):
            found.append((i, f"U+{ord(ch):04X}"))
    return found


class TextProblem(ValueError):
    """A free-text field was refused: `code` is `type`, `required` or `too_long`; the message names the field only (never
    the value, which may hold a phone number or a person's words)."""

    def __init__(self, field: str, code: str) -> None:
        super().__init__(f"{field}: {code}")
        self.field = field
        self.code = code


def clean_field(value: object, field: str, *, max_len: int, required: bool = False, multiline: bool = False) -> str:
    """`clean_text` plus the field's limits, judged AFTER cleaning (a value padded with invisible characters cannot pass a
    limit it would fail once cleaned, nor fail one it would pass). A raw value longer than 4 x max_len + 64 characters is
    refused before it is scanned at all (the request bodies are capped anyway; this bounds the work per field)."""
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise TextProblem(field, "type")
    if len(value) > 4 * max_len + 64:
        raise TextProblem(field, "too_long")
    text = clean_text(value, multiline=multiline)
    if required and not text:
        raise TextProblem(field, "required")
    if len(text) > max_len:
        raise TextProblem(field, "too_long")
    return text


def clean_str(max_len: int, *, multiline: bool = False, required: bool = True) -> Any:
    """A pydantic field type: `note: clean_str(2000, multiline=True)` cleans the value and checks its length; a refusal is a
    validation error whose `type` is `required` / `too_long` / `type` (the public app turns it into a `{code, field}` pair)."""
    from pydantic import BeforeValidator
    from pydantic_core import PydanticCustomError

    def _clean(v: object) -> str:
        try:
            return clean_field(v, "value", max_len=max_len, required=required, multiline=multiline)
        except TextProblem as exc:
            raise PydanticCustomError(exc.code, exc.code) from None

    return Annotated[str, BeforeValidator(_clean)]


# ---------------------------------------------------------------- CSV export


def csv_cell(value: Any) -> Any:
    """One CSV cell, safe to open in a spreadsheet: None -> ""; numbers (int, float, Decimal - bool is not a number here)
    unchanged; any other value as text, with a leading apostrophe when it starts like a formula. The csv module's quoting
    does the rest (separators, quotes, line breaks)."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float, Decimal)):
        return value
    text = str(value)
    if text.startswith(FORMULA_STARTERS):
        return "'" + text
    return text


def csv_row(values: Iterable[Any]) -> list[Any]:
    return [csv_cell(v) for v in values]
