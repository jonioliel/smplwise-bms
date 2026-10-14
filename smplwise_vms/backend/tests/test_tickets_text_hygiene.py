"""CR-038 text hygiene (services/tickets/text_hygiene.py): Cc / Cf / Cs stripped before length checks, line handling, combining
marks, template character checks, CSV formula-injection escaping. Every string here is invented."""
from __future__ import annotations

import csv
import io
import random
import unicodedata

import pytest
from pydantic import BaseModel, ValidationError

from smplwise.services.tickets import text_hygiene as th

BIDI = ["‪", "‫", "‬", "‭", "‮", "⁦", "⁧", "⁨", "⁩", "‎", "‏", "؜"]
ZERO_WIDTH = ["​", "‍", "⁠", "﻿", "­"]  # U+200C ZWNJ is spelling: kept (V11)


def test_bidi_overrides_and_zero_width_characters_are_removed():
    # the review's example: an override that would show a different sentence to the manager
    spoof = "בוצע‮" + "אל" + "‬"
    assert th.clean_text(spoof) == "בוצעאל"
    for ch in BIDI + ZERO_WIDTH:
        assert th.clean_text(f"a{ch}b") == "ab", repr(ch)
    # a tag character (Cf, U+E0041) and a lone surrogate (Cs) go as well
    assert th.clean_text("x\U000e0041y") == "xy"
    assert th.clean_text("x\ud800y") == "xy"


def test_controls_and_noncharacters_are_removed():
    for cp in list(range(0x00, 0x09)) + [0x0e, 0x1b, 0x7f, 0x80, 0x9f]:
        assert th.clean_text(f"a{chr(cp)}b") == "ab", hex(cp)
    for ch in ("﷐", "﷯", "￾", "￿", "\U0001fffe", "\U0010ffff"):
        assert th.clean_text(f"a{ch}b") == "ab"


def test_single_line_collapses_every_whitespace_and_line_break():
    assert th.clean_text("  שלום \t עולם\r\n שורה  ") == "שלום עולם שורה"
    assert th.clean_text("a\x0bb\x0cc\x85d") == "a b c d"


def test_multi_line_keeps_paragraphs_and_normalises_separators():
    raw = "שורה 1  \r\nשורה 2\rשורה 3 שורה 4\n\n\n\n\nסוף\t!  "
    assert th.clean_text(raw, multiline=True) == "שורה 1\nשורה 2\nשורה 3\nשורה 4\n\nסוף !"


def test_niqqud_stays_and_stacked_marks_are_cut():
    pointed = "שָׁלוֹם"  # shin + qamats + shin dot etc.
    assert th.clean_text(pointed) == pointed
    zalgo = "a" + "́" * 50 + "b"
    out = th.clean_text(zalgo)
    assert out == unicodedata.normalize("NFC", "a" + "́" * th.MAX_COMBINING + "b")  # the cap, then NFC (a + U+0301 = U+00E1)


def test_enclosing_and_class_zero_marks_are_capped_too():
    """Review finding 15: the canonical combining class is 0 for enclosing marks (Me) and some nonspacing ones; the cap
    counts by category."""
    # Me class 0 (enclosing circle, Cyrillic millions sign), Mn class 0 (Thaana abafili), Mc class 0 (Devanagari visarga)
    for mark in ("⃝", "҉", "ަ", "ः"):
        out = th.clean_text("x" + mark * 60 + "y")
        assert out == "x" + mark * th.MAX_COMBINING + "y", hex(ord(mark))


def test_spelling_format_characters_are_kept_and_the_text_is_nfc():
    """Code review V11: ZWNJ (Persian / Urdu spelling) and the prepended number signs stay - they have no bidi or hiding
    effect; the Arabic letter mark U+061C is a bidi control and goes. The result is NFC: precomposed and decomposed niqqud
    give one string."""
    persian = "\u0645\u06cc\u200c\u062e\u0648\u0627\u0647\u0645"  # "I want", with its required ZWNJ
    assert th.clean_text(persian) == persian
    year = "\u0600\u0661\u0664\u0664\u0667"  # the Arabic number sign over a year
    assert th.clean_text(year) == year
    for ch in sorted(th.KEEP_FORMAT):
        assert th.clean_text(f"a{ch}b") == f"a{ch}b", hex(ord(ch))
        assert not th.is_hidden(ch) and th.hidden_characters(f"a{ch}b") == []
    assert th.clean_text("a\u061cb") == "ab"
    decomposed = "e\u0301"  # e + combining acute
    assert th.clean_text(decomposed) == "\u00e9"
    shin = "\u05e9\u05c1"  # shin + shin dot: NFC keeps it as two code points (excluded from composition), one form
    assert th.clean_text(shin) == th.clean_text("\ufb2a") == "\u05e9\u05c1"


def test_emoji_joiners_fall_apart_as_accepted_by_the_spec():
    family = "\U0001F468‍\U0001F469‍\U0001F467"
    assert th.clean_text(family) == "\U0001F468\U0001F469\U0001F467"


def test_clean_field_judges_length_after_cleaning():
    padded = "​" * 30 + "abc"
    assert th.clean_field(padded, "note", max_len=5) == "abc"
    with pytest.raises(th.TextProblem) as e:
        th.clean_field("abcdef", "note", max_len=5)
    assert (e.value.field, e.value.code) == ("note", "too_long")
    with pytest.raises(th.TextProblem) as e:
        th.clean_field("​‮ ", "note", max_len=5, required=True)
    assert e.value.code == "required"
    with pytest.raises(th.TextProblem) as e:
        th.clean_field(12, "note", max_len=5)
    assert e.value.code == "type"
    # a huge raw value is refused before it is scanned, and the message never carries the value
    with pytest.raises(th.TextProblem) as e:
        th.clean_field("0501234567" * 10_000, "note", max_len=100)
    assert e.value.code == "too_long" and "0501234567" not in str(e.value)


def test_pydantic_field_type_reports_codes_only():
    class M(BaseModel):
        note: th.clean_str(10, multiline=True)

    assert M(note=" שלום‮ ").note == "שלום"
    with pytest.raises(ValidationError) as e:
        M(note="x" * 11)
    assert e.value.errors()[0]["type"] == "too_long"
    with pytest.raises(ValidationError) as e:
        M(note="​")
    assert e.value.errors()[0]["type"] == "required"


def test_hidden_characters_lists_what_a_template_must_not_hold():
    assert th.hidden_characters("שלום {name}\n\tבקשה") == []
    assert th.hidden_characters("a‮b\rc") == [(1, "U+202E"), (3, "U+000D")]


def test_random_text_never_keeps_a_hidden_character_and_never_raises():
    rng = random.Random(3801)
    pool = [chr(c) for c in range(0, 0x3000)] + BIDI + ZERO_WIDTH + ["\U0001F600", "\ud800", "\U000e0041"]
    for _ in range(2000):
        s = "".join(rng.choice(pool) for _ in range(rng.randint(0, 60)))
        for multiline in (False, True):
            out = th.clean_text(s, multiline=multiline)
            assert not any(th.is_hidden(ch) for ch in out if ch != "\n")
            assert "\t" not in out and "\r" not in out
            if not multiline:
                assert "\n" not in out and out == out.strip()


@pytest.mark.parametrize("cell", ["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx", "＝1", "＋1", "－1", "＠1",
                                  "=cmd|' /C calc'!A0"])
def test_csv_cells_that_start_like_a_formula_get_an_apostrophe(cell):
    assert th.csv_cell(cell) == "'" + cell


def test_csv_cells_keep_numbers_and_plain_text():
    assert th.csv_cell(-5) == -5 and th.csv_cell(1.5) == 1.5 and th.csv_cell(None) == "" and th.csv_cell(True) == "true"
    assert th.csv_cell("מזגן חדר 102") == "מזגן חדר 102"
    assert th.csv_cell(" =1") == " =1"  # not at the start: a spreadsheet reads it as text
    buf = io.StringIO()
    csv.writer(buf).writerow(th.csv_row(["=HYPERLINK(\"http://x\")", 3, "a,b"]))
    assert buf.getvalue().startswith("\"'=HYPERLINK(\"\"http://x\"\")\",3,\"a,b\"")


def test_auto_linkify_is_off_by_rule():
    assert th.AUTO_LINKIFY is False
