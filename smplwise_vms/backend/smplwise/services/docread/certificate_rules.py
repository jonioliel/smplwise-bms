"""SUPPLIERDOCS-297: the deterministic rule-based extractor for CERTIFICATES in text-layer PDFs (insurance confirmation, licence,
work-at-height and similar). No model, no learning, no network: label anchors (Hebrew and English) plus date / number parsers.

Fields: supplier, document_number, issue_date, expiry_date, scope (scope of cover / licence class / standard). Every field is optional:
a field that is not found is `none` with a None value - never a guess. Rules (CR-OCR119 section 3, adapted):

* Text hygiene first: bidi / control / format characters removed, geresh and gershayim variants unified, form feeds become lines.
* A value is taken next to its label on the same line - after the label, else BEFORE it (`pdftotext -layout` prints a right-aligned
  Hebrew label after its value on the physical line) - and for dates, from the next line when the label line has none.
* Dates: dd/mm/yyyy, dd.mm.yy, dd-mm-yyyy, yyyy-mm-dd, Hebrew and English month names. Numeric dates are read day-first (Israel);
  a date whose day and month could swap, or a two-digit year, is `medium`. Impossible dates are refused. A validity RANGE gives start
  and end with `medium`. An expiry before the issue date lowers both to `low` (flag `date_order`).
* Visual-order Hebrew (some generators store lines reversed): tried only when the logical text hits no label at all; the recovered
  fields are capped at `low` (flag `visual_order`).
* Snippets (<= 80 characters) are scrubbed: bank accounts, card-like numbers and id / company numbers never leave this module in a
  snippet, and a supplier's tax id is cut from the supplier name.

Confidence is a label, not a probability: `high` = label found and the value parses cleanly; `medium` = label found but the reading is
ambiguous or came from a neighbouring line / a range; `low` = recovered from reversed text or contradicted by another field."""
from __future__ import annotations

import re
import unicodedata
from dataclasses import replace
from datetime import date

from .ports import SNIPPET_MAX, VALUE_MAX, Extraction, FieldSuggestion

RULES_VERSION = "cert-rules-1"
FIELDS = ("supplier", "document_number", "issue_date", "expiry_date", "scope")
TEXT_FIELDS = ("supplier", "scope")
DATE_FIELDS = ("issue_date", "expiry_date")
YEAR_MIN, YEAR_MAX = 1990, 2100

_HEB = "א-ת"
_NB = rf"(?<![{_HEB}A-Za-z])"  # an anchor starts a word (Hebrew or Latin)
_MS = r"מס['.]?"  # מס' / מס. / מס


def _rx(*parts: str) -> list[re.Pattern[str]]:
    return [re.compile(_NB + p, re.IGNORECASE) for p in parts]


ANCHORS: dict[str, list[re.Pattern[str]]] = {
    "supplier": _rx(r"שם\s+המבוטח", r"שם\s+הספק", r"שם\s+הקבלן", r"שם\s+בעל\s+(?:ה)?רישיון", r"בעל\s+(?:ה)?רישיון", r"שם\s+החברה", r"שם\s+העסק",
                    r"המבוטח", r"name\s+of\s+(?:the\s+)?insured", r"insured\s+name", r"licen[cs]e\s+holder", r"company\s+name", r"supplier",
                    r"contractor", r"insured\b"),
    "document_number": _rx(r"מספר\s+(?:ה)?פוליסה", r"פוליסה\s+(?:מס['.]?|מספר)", _MS + r"\s*(?:ה)?פוליסה", r"מספר\s+(?:ה)?רישיון",
                           r"רישיון\s+(?:מס['.]?|מספר)", _MS + r"\s*(?:ה)?רישיון", r"מספר\s+(?:ה)?תעודה", r"תעודה\s+(?:מס['.]?|מספר)",
                           r"מספר\s+(?:ה)?אישור", r"אישור\s+(?:מס['.]?|מספר)", _MS + r"\s*(?:ה)?אישור",
                           r"policy\s+(?:no\b\.?|number|#)", r"licen[cs]e\s+(?:no\b\.?|number|#)", r"certificate\s+(?:no\b\.?|number|#)"),
    "issue_date": _rx(r"תאריך\s+(?:ה)?הנפקה", r"תאריך\s+(?:ה)?הוצאה", r"הונפק\s+(?:ביום|בתאריך)", r"תאריך\s+(?:ה)?אישור",
                      r"date\s+of\s+issue", r"issue\s+date", r"issued\s+on", r"date\s+issued"),
    "expiry_date": _rx(r"בתוקף\s+עד", r"תוקף\s+(?:\S+\s+){0,2}?עד", r"תאריך\s+(?:ה)?תפוגה", r"תאריך\s+(?:ה)?סיום", r"פג\s+תוקף",
                       r"valid\s+(?:until|through|thru|to)\b", r"expir(?:y|ation)\s+date", r"date\s+of\s+expiry", r"expires(?:\s+on)?\b"),
    "scope": _rx(r"היקף\s+(?:ה)?כיסוי", r"סוג\s+(?:ה)?כיסוי", r"סוג\s+(?:ה)?רישיון", r"סוג\s+(?:ה)?עבודה", r"היקף", r"תחום", r"כיסוי", r"תקן",
                 r"scope(?:\s+of\s+(?:work|cover(?:age)?))?", r"coverage", r"licen[cs]e\s+class", r"standard"),
}
RANGE_ANCHORS = _rx(r"תקופת\s+(?:ה)?ביטוח", r"תקופת\s+(?:ה)?תוקף", r"תקופת\s+(?:ה)?פוליסה", r"period\s+of\s+(?:insurance|validity)",
                    r"policy\s+period", r"insurance\s+period")

HE_MONTHS = {"ינואר": 1, "פברואר": 2, "מרץ": 3, "מרס": 3, "אפריל": 4, "מאי": 5, "יוני": 6, "יולי": 7, "אוגוסט": 8, "ספטמבר": 9,
             "אוקטובר": 10, "נובמבר": 11, "דצמבר": 12}
EN_MONTHS = {m: i for i, ms in enumerate((("january", "jan"), ("february", "feb"), ("march", "mar"), ("april", "apr"), ("may",),
                                          ("june", "jun"), ("july", "jul"), ("august", "aug"), ("september", "sep", "sept"),
                                          ("october", "oct"), ("november", "nov"), ("december", "dec")), 1) for m in ms}
_HE_M = "|".join(sorted(HE_MONTHS, key=len, reverse=True))
_EN_M = "|".join(sorted(EN_MONTHS, key=len, reverse=True))
_DATE_RX = [
    ("num", re.compile(r"(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(?!\d)")),
    ("iso", re.compile(r"(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)")),
    ("he", re.compile(rf"(?<!\d)(\d{{1,2}})\s+(?:[בל]-?\s*)?({_HE_M})\s*,?\s*(\d{{4}})(?!\d)")),
    ("en_dmy", re.compile(rf"(?<!\d)(\d{{1,2}})(?:st|nd|rd|th)?\s+({_EN_M})\.?,?\s+(\d{{4}})(?!\d)", re.IGNORECASE)),
    ("en_mdy", re.compile(rf"(?<![A-Za-z])({_EN_M})\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?,?\s+(\d{{4}})(?!\d)", re.IGNORECASE)),
]
_DOCNO = re.compile(r"(?<![A-Za-z0-9])([A-Za-z0-9][A-Za-z0-9/\-.]{1,39})")
_SEP_LEAD = re.compile(r"^[\s:：\-–—.#]+")
_SEP_TRAIL = re.compile(r"[\s:：\-–—,;]+$")
_COLUMN = re.compile(r"\s{2,}")
_TAX_TAIL = re.compile(r"\s*[,(]?\s*(?:ח\.?\s?פ\.?|ע\.?\s?מ\.?|ת\.?\s?ז\.?|עוסק\s+מורשה|tax\s+id|vat\s+(?:no|number)|company\s+(?:no|number|id))[\s\S]*$",
                       re.IGNORECASE)
_LONG_DIGITS_TAIL = re.compile(r"\s+\d{7,}\s*$")
# snippet scrubbing: never carry an id / company number, a bank account or a card-like number out of this module
_SCRUB = [
    (re.compile(r"\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{2,4}){3,}\b"), "[…]"),                                  # IBAN
    (re.compile(r"(ח\.?\s?פ\.?|ע\.?\s?מ\.?|ת\.?\s?ז\.?|עוסק\s+מורשה|tax\s+id|id\s+no\.?)\s*:?\s*\d[\d\s-]{4,}", re.IGNORECASE), r"\1 ***"),
    (re.compile(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)"), "[…]"),                                              # card-like
    (re.compile(r"(?<![\d-])\d{9}(?![\d-])"), "*********"),                                               # a bare 9-digit id
]
_BIDI = dict.fromkeys(map(ord, "‎‏‪‫‬‭‮⁦⁧⁨⁩؜﻿"), None)
_QUOTES = str.maketrans({"״": '"', "“": '"', "”": '"', "„": '"', "׳": "'", "‘": "'", "’": "'",
                         "\t": " ", "\f": "\n", "\r": "\n", " ": " "})
_RUN = re.compile(r"[0-9A-Za-z/.\-:]+")


# ---------------------------------------------------------------- text hygiene

def normalise(text: str) -> str:
    text = unicodedata.normalize("NFC", str(text or "")).translate(_BIDI).translate(_QUOTES)
    return "".join(ch for ch in text if ch == "\n" or unicodedata.category(ch)[0] != "C")


def to_visual(text: str) -> str:
    """Logical <-> visual order of a line (an involution): the characters reversed, then every run of digits / Latin / date
    punctuation reversed back, as a visual-order generator stores them. Used to recover reversed text and to build test fixtures."""
    return "\n".join(_RUN.sub(lambda m: m.group(0)[::-1], line[::-1]) for line in str(text).split("\n"))


def clean_value(raw: str | None) -> str | None:
    if raw is None:
        return None
    v = " ".join(normalise(raw).replace("\n", " ").split())
    v = _SEP_TRAIL.sub("", _SEP_LEAD.sub("", v)).strip()
    return v[:VALUE_MAX].strip() or None


def scrub(text: str) -> str:
    out = " ".join(str(text).split())
    for rx, repl in _SCRUB:
        out = rx.sub(repl, out)
    return out


def _snippet(line: str, at: int) -> str:
    s = " ".join(line.split())
    if len(s) > SNIPPET_MAX:
        start = max(0, min(at - 10, len(s) - SNIPPET_MAX))
        s = s[start:start + SNIPPET_MAX]
    return scrub(s)[:SNIPPET_MAX]


# ---------------------------------------------------------------- dates

def _mkdate(y: int, m: int, d: int) -> date | None:
    if not (YEAR_MIN <= y <= YEAR_MAX):
        return None
    try:
        return date(y, m, d)
    except ValueError:
        return None


def find_dates(line: str) -> list[tuple[int, int, date, str]]:
    """Every valid date on a line: (start, end, date, confidence), in line order, overlaps removed."""
    found: list[tuple[int, int, date, str]] = []
    for kind, rx in _DATE_RX:
        for m in rx.finditer(line):
            conf = "high"
            if kind == "num":
                d, mo, y = int(m.group(1)), int(m.group(2)), m.group(3)
                if len(y) == 2:
                    y, conf = "20" + y, "medium"
                if d <= 12 and mo <= 12 and d != mo:
                    conf = "medium"
                dt = _mkdate(int(y), mo, d)
            elif kind == "iso":
                dt = _mkdate(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            elif kind == "he":
                dt = _mkdate(int(m.group(3)), HE_MONTHS[m.group(2)], int(m.group(1)))
            elif kind == "en_dmy":
                dt = _mkdate(int(m.group(3)), EN_MONTHS[m.group(2).lower()], int(m.group(1)))
            else:
                dt = _mkdate(int(m.group(3)), EN_MONTHS[m.group(1).lower()], int(m.group(2)))
            if dt is not None and not any(s < m.end() and m.start() < e for s, e, _, _ in found):
                found.append((m.start(), m.end(), dt, conf))
    return sorted(found)


# ---------------------------------------------------------------- the field rules

def _anchor(line: str, field: str) -> re.Match[str] | None:
    for rx in ANCHORS[field]:
        m = rx.search(line)
        if m:
            return m
    return None


def _any_anchor(line: str) -> bool:
    return any(_anchor(line, f) for f in FIELDS) or any(rx.search(line) for rx in RANGE_ANCHORS)


def _starts_with_label(value: str) -> bool:
    """A "value" that is itself the next label (an empty field followed by another label) is not a value."""
    return any(rx.match(value) for f in FIELDS for rx in ANCHORS[f]) or any(rx.match(value) for rx in RANGE_ANCHORS)


def _beside(line: str, m: re.Match[str]) -> str:
    """The text value next to a label: after it (up to a column gap), else the nearest column before it (RTL layout)."""
    after = _COLUMN.split(_SEP_LEAD.sub("", line[m.end():]).strip(), maxsplit=1)[0]
    if clean_value(after):
        return after
    before = _SEP_TRAIL.sub("", line[: m.start()])
    parts = [p for p in _COLUMN.split(before.strip()) if p.strip()]
    return parts[-1] if parts else ""


def _text_field(lines: list[str], field: str) -> FieldSuggestion:
    for line in lines:
        m = _anchor(line, field)
        if not m:
            continue
        raw = _beside(line, m)
        if field == "supplier":
            raw = _LONG_DIGITS_TAIL.sub("", _TAX_TAIL.sub("", raw))
        value = clean_value(raw)
        if value and not _starts_with_label(value):
            return FieldSuggestion(value=value, confidence="high", evidence=m.group(0).strip(), snippet=_snippet(line, m.start()))
    return FieldSuggestion()


def _docno_field(lines: list[str]) -> FieldSuggestion:
    for line in lines:
        m = _anchor(line, "document_number")
        if not m:
            continue
        after = [t for t in _DOCNO.findall(_SEP_LEAD.sub("", line[m.end():])) if any(c.isdigit() for c in t)]
        before = [t for t in _DOCNO.findall(line[: m.start()]) if any(c.isdigit() for c in t)]
        token = after[0] if after else (before[-1] if before else None)
        if token:
            return FieldSuggestion(value=token.rstrip(".-/")[:40], confidence="high", evidence=m.group(0).strip(), snippet=_snippet(line, m.start()))
    return FieldSuggestion()


def _date_field(lines: list[str], field: str) -> FieldSuggestion:
    for i, line in enumerate(lines):
        m = _anchor(line, field)
        if not m:
            continue
        dates = find_dates(line)
        after = [d for d in dates if d[0] >= m.end()]
        before = [d for d in dates if d[1] <= m.start()]
        pick, conf_cap = (after[0] if after else (before[-1] if before else None)), "high"
        if pick is None:
            nxt = next((ln for ln in lines[i + 1:i + 2] if ln.strip()), "")
            if nxt and not _any_anchor(nxt) and find_dates(nxt):
                pick, conf_cap = find_dates(nxt)[0], "medium"
        if pick is not None:
            conf = "medium" if "medium" in (pick[3], conf_cap) else "high"
            return FieldSuggestion(value=pick[2].isoformat(), confidence=conf, evidence=m.group(0).strip(), snippet=_snippet(line, m.start()))
    return FieldSuggestion()


def _range(lines: list[str]) -> tuple[FieldSuggestion, FieldSuggestion]:
    for line in lines:
        for rx in RANGE_ANCHORS:
            m = rx.search(line)
            if not m:
                continue
            dates = [d for d in find_dates(line) if d[0] >= m.end()] or find_dates(line)
            if len(dates) >= 2:
                snip = _snippet(line, m.start())
                ev = m.group(0).strip()
                return (FieldSuggestion(value=dates[0][2].isoformat(), confidence="medium", evidence=ev, snippet=snip),
                        FieldSuggestion(value=dates[1][2].isoformat(), confidence="medium", evidence=ev, snippet=snip))
    return FieldSuggestion(), FieldSuggestion()


def _extract_lines(lines: list[str]) -> tuple[dict[str, FieldSuggestion], list[str]]:
    flags: list[str] = []
    out = {"supplier": _text_field(lines, "supplier"), "document_number": _docno_field(lines),
           "issue_date": _date_field(lines, "issue_date"), "expiry_date": _date_field(lines, "expiry_date"), "scope": _text_field(lines, "scope")}
    if out["issue_date"].value is None or out["expiry_date"].value is None:
        start, end = _range(lines)
        if out["issue_date"].value is None and start.value:
            out["issue_date"] = start
        if out["expiry_date"].value is None and end.value:
            out["expiry_date"] = end
    iss, exp = out["issue_date"].value, out["expiry_date"].value
    if iss and exp and exp < iss:
        out["issue_date"] = replace(out["issue_date"], confidence="low")
        out["expiry_date"] = replace(out["expiry_date"], confidence="low")
        flags.append("date_order")
    return out, flags


def _hits(lines: list[str]) -> int:
    return sum(1 for line in lines if _any_anchor(line))


def extract(text: str) -> Extraction:
    """The certificate fields of a document's text. Pure and deterministic: the same text always gives the same result."""
    lines = normalise(text).split("\n")
    flags: list[str] = []
    if _hits(lines) == 0 and re.search(f"[{_HEB}]", "\n".join(lines)):
        visual = to_visual("\n".join(lines)).split("\n")
        if _hits(visual) > 0:
            lines, flags = visual, ["visual_order"]
    fields, more = _extract_lines(lines)
    flags.extend(more)
    if "visual_order" in flags:
        fields = {k: (replace(v, confidence="low") if v.value is not None else v) for k, v in fields.items()}
    found = sum(1 for v in fields.values() if v.value is not None)
    summary = "good" if found == len(FIELDS) else ("none" if found == 0 else "partial")
    return Extraction(fields={k: fields[k] for k in FIELDS}, summary=summary, flags=tuple(flags))
